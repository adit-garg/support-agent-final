import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const TikitlySupport = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const QUICK_ACTIONS = [
    "How do I create a new event?",
    "How do I add and configure ticket types?",
    "What are add-ons and how do I create them?",
    "Explain the different commission models",
    "How can I issue complimentary tickets?",
    "How do I check my event metrics?",
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSendMessageStream = async (questionText) => {
    const question = questionText || inputValue.trim();
    if (!question) return;

    const userMessage = { type: 'user', content: question };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Create empty assistant message
    const assistantMessage = { type: 'assistant', content: '' };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const response = await fetch('${import.meta.env.VITE_API_URL}/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      if (!response.body) throw new Error("No stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;

        if (value) {
          const chunk = decoder.decode(value);

          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: updated[updated.length - 1].content + chunk,
            };
            return updated;
          });
        }
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          type: 'assistant',
          content: 'Sorry, I encountered an error connecting to Tikitly Support.',
        };
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (question) => {
    handleSendMessageStream(question);
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  useEffect(() => {
    // Prevent zoom on mobile when focusing input
    const viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      const meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
      document.head.appendChild(meta);
    } else {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }

    return () => {
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Support Button - Responsive positioning */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-full px-5 py-3 sm:px-7 sm:py-4 shadow-2xl hover:shadow-3xl hover:scale-105 transition-all duration-300 flex items-center gap-2 sm:gap-3 font-semibold text-sm sm:text-base z-50"
        >
          <MessageCircle size={20} className="sm:w-[22px] sm:h-[22px]" />
          <span className="hidden sm:inline">Get Support</span>
          <span className="sm:hidden">Support</span>
        </button>
      )}

      {/* Chat Window - Fully Responsive with keyboard handling */}
      {isOpen && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[440px] sm:h-[680px] md:w-[500px] lg:w-[560px] lg:h-[720px] bg-white sm:rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="bg-gradient-to-r from-white to-slate-50 px-4 sm:px-7 py-4 sm:py-6 border-b border-slate-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">Tikitly Support</h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">Get help with events, tickets, and features</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-gray-600 hover:text-gray-900 transition-all flex-shrink-0"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Status Bar */}
          <div className="px-4 sm:px-7 py-2.5 sm:py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping opacity-75"></div>
              </div>
              <span className="text-xs font-semibold text-green-700">Ready</span>
            </div>
            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="text-xs text-gray-600 hover:text-gray-900 font-semibold px-2 py-1 rounded-lg hover:bg-slate-200 transition-all"
              >
                Clear chat
              </button>
            )}
          </div>

          {/* Messages Area - Responsive scrolling */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-7 py-4 sm:py-6 bg-slate-50 min-h-0">
            {messages.length === 0 ? (
              <div>
                <p className="text-sm text-gray-600 mb-3 sm:mb-4 font-medium">Common questions:</p>
                <div className="space-y-2 sm:space-y-2.5">
                  {QUICK_ACTIONS.map((question, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickAction(question)}
                      className="w-full text-left px-4 sm:px-5 py-3 sm:py-4 bg-white border-2 border-slate-200 rounded-xl text-xs sm:text-sm text-gray-800 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 font-medium shadow-sm hover:shadow-md hover:translate-x-1"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {messages.map((message, idx) => (
                  <div
                    key={idx}
                    className={`rounded-2xl px-4 sm:px-5 py-3 sm:py-4 max-w-[90%] sm:max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                      message.type === 'user'
                        ? 'bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-slate-300 ml-auto text-gray-900 rounded-br-sm'
                        : 'bg-white border-2 border-slate-200 mr-auto text-gray-800 rounded-bl-sm shadow-md'
                    }`}
                  >
                    <div className="prose prose-sm max-w-none text-gray-800 text-xs sm:text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content || (message.type === 'assistant' && isLoading && idx === messages.length - 1 ? '' : message.content)}
                      </ReactMarkdown>
                      {/* Show loading indicator only in the last assistant message if it's empty and loading */}
                      {message.type === 'assistant' && !message.content && isLoading && idx === messages.length - 1 && (
                        <div className="flex items-center gap-2 sm:gap-3">
                          <Loader2 className="animate-spin text-gray-600" size={16} />
                          <p className="text-xs sm:text-sm text-gray-600 font-medium">Analyzing...</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Area - Responsive padding */}
          <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex-shrink-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendMessageStream()}
                placeholder="Ask a question..."
                className="flex-1 px-4 sm:px-5 py-3 sm:py-3.5 border-2 border-slate-300 rounded-xl text-base sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-slate-300 focus:border-slate-400 bg-slate-50 focus:bg-white transition-all font-medium"
                disabled={isLoading}
              />
              <button
                onClick={() => handleSendMessageStream()}
                disabled={!inputValue.trim() || isLoading}
                className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-3 sm:p-3.5 rounded-xl hover:scale-105 hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 flex-shrink-0"
              >
                <Send size={18} className="sm:w-[20px] sm:h-[20px]" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TikitlySupport;
