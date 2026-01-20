from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_community.embeddings import SentenceTransformerEmbeddings
from langchain_openai import ChatOpenAI
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnableParallel, RunnablePassthrough, RunnableLambda
from langchain_core.output_parsers import StrOutputParser
from fastapi.responses import StreamingResponse

import os
from dotenv import load_dotenv
load_dotenv()
app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    # allow_origins=["http://localhost:3000", "http://localhost:5173","http://192.168.0.188:3000"],
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    question: str

class ChatResponse(BaseModel):
    answer: str

# Load vector store once at startup
VECTOR_STORE_PATH = "./vector_store"
vector_store = None
rag_chain = None


@app.on_event("startup")
async def startup_event():
    global vector_store, rag_chain

    embeddings = SentenceTransformerEmbeddings(
        model_name="all-mpnet-base-v2"
    )

    vector_store = FAISS.load_local(
        VECTOR_STORE_PATH,
        embeddings,
        allow_dangerous_deserialization=True
    )
    rag_chain = create_advanced_retrieval_chain(vector_store)

def stream_answer(chain, question: str):
    for chunk in chain.stream(question):
        if chunk:
            yield chunk


def create_advanced_retrieval_chain(vector_store):
    retriever = vector_store.as_retriever(
        search_type="similarity",
        search_kwargs={"k": 4}
    )
    print("🔥 Chain created")
    llm = ChatOpenAI(
        model="gpt-5-nano",
        temperature=0.2,
        streaming=True
    )
    
    prompt = PromptTemplate(
        template="""You are the Tikitly Support Agent.

                Rules:
                - Answer ONLY from the provided documentation context.
                - If the user says thanks or says okay respond with a short message.
                - If not found, reply exactly:
                "I don't have that information in my current knowledge base. Please contact Tikitly support for assistance."
                - Answer fast and concisely.
                Style:
                - Short, clear, and helpful
                - Max 5 steps OR 6 bullet points
                - Use aesthetically pleasing icons
                - Step-by-step for workflows
                - Start with a short friendly heading
                - End with a single helpful hint line

                Language:
                - Detect language automatically
                - Reply in the same language (English or Dutch)

                KNOWLEDGE BASE CONTEXT:
                    {context}
                    
                    QUESTION:
                    {question}
                    
                    """,
        input_variables=['context', 'question']
    )
    
    def format_docs(retrieved_docs):
        if not retrieved_docs:
            return ""
        
        context_parts = []
        for i, doc in enumerate(retrieved_docs, 1):
            source = doc.metadata.get('source', 'Documentation')
            source_info = f"{os.path.basename(source)}"
            context_parts.append(f"[Source {i} - {source_info}]:\n{doc.page_content}")
        
        return "\n\n---\n\n".join(context_parts)
    
    parallel_chain = RunnableParallel({
        'context': retriever | RunnableLambda(format_docs),
        'question': RunnablePassthrough()
    })
    
    parser = StrOutputParser()
    return parallel_chain | prompt | llm | parser

@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    try:
        return StreamingResponse(
            stream_answer(rag_chain, request.question),
            media_type="text/plain"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        answer = rag_chain.invoke(request.question)
        return ChatResponse(answer=answer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)