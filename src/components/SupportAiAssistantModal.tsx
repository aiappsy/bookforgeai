import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  Bot,
  User,
  BookOpen,
  Headphones,
  FileCheck,
  Palette,
  CreditCard,
  HelpCircle,
  RefreshCw,
  Zap,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import Markdown from 'react-markdown';
import { UserProfile } from '../services/firebase';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface SupportAiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  bookCount?: number;
}

export const SupportAiAssistantModal: React.FC<SupportAiAssistantModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  bookCount = 0
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `👋 **Hello! I'm your manus Publishing Expert & Support AI.**\n\nI'm fully trained on all features of this publishing suite. How can I help you today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages]);

  if (!isOpen) return null;

  const quickPrompts = [
    "How do I create a 300 DPI print cover and spine?",
    "How do I convert my manuscript into an Audiobook?",
    "How does the Anti-AI Humanizer Studio work?",
    "How do I manage PayPal SaaS subscriptions & Admin settings?",
    "How do I export my book for Amazon KDP publishing?"
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputText('');
    setLoading(true);

    try {
      const historyForApi = [...messages, userMsg].map((m) => ({
        role: m.role,
        text: m.text
      }));

      const res = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyForApi,
          userContext: {
            email: userProfile?.email || 'Guest User',
            plan: userProfile?.plan || 'Free',
            bookCount
          }
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Support service unavailable');

      const botMsg: Message = {
        id: `bot_${Date.now()}`,
        role: 'assistant',
        text: data.text || "I'm here to help! Ask me anything about writing, formatting, or publishing with manus.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          text: `⚠️ **Connection Note**: ${err.message || 'Unable to connect to Support AI service right now. Please try again.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end p-0 sm:p-4 bg-zinc-950/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl h-full sm:h-[92vh] bg-white sm:rounded-3xl shadow-2xl border border-zinc-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-950 via-zinc-900 to-slate-900 text-white p-5 flex items-center justify-between shrink-0 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-2.5 bg-blue-500/20 border border-blue-400/30 rounded-2xl text-blue-300">
                <Bot className="w-6 h-6" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-zinc-900 rounded-full" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold tracking-tight">manus Expert AI Assistant</h2>
                <span className="text-[9px] font-black uppercase bg-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full border border-blue-400/30">
                  Gemini 3.6 Flash
                </span>
              </div>
              <p className="text-xs text-zinc-300">
                24/7 Publishing Help, KDP Guides & Feature Support
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Context Banner */}
        <div className="bg-blue-50/80 px-4 py-2 border-b border-blue-100 flex items-center justify-between text-xs text-blue-900">
          <span className="font-semibold flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-blue-600" />
            {userProfile?.email || 'Author Workspace'}
          </span>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="bg-blue-200/80 text-blue-900 font-bold px-2 py-0.5 rounded-full uppercase text-[9px]">
              {userProfile?.plan || 'Free'} Tier
            </span>
            <span>{bookCount} Manuscripts</span>
          </div>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-zinc-50/50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-none font-medium'
                    : 'bg-white border border-zinc-200/80 text-zinc-800 rounded-tl-none space-y-2'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                ) : (
                  <div className="markdown-body">
                    <Markdown>{msg.text}</Markdown>
                  </div>
                )}
                <div
                  className={`text-[9px] mt-1.5 font-sans ${
                    msg.role === 'user' ? 'text-blue-200 text-right' : 'text-zinc-400 text-left'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-2xl bg-zinc-900 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-3 text-xs text-zinc-500">
              <div className="w-8 h-8 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Bot className="w-4 h-4 animate-pulse" />
              </div>
              <div className="bg-white px-4 py-3 rounded-2xl border border-zinc-200 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                <span className="font-semibold text-zinc-600">Consulting manus Publishing Knowledge Base...</span>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Quick Prompts */}
        {messages.length < 4 && (
          <div className="px-4 py-2 bg-white border-t border-zinc-100 shrink-0">
            <p className="text-[10px] font-extrabold uppercase text-zinc-400 tracking-wider mb-2">
              Suggested Support Topics
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(prompt)}
                  disabled={loading}
                  className="px-3 py-1.5 bg-zinc-100 hover:bg-blue-50 hover:text-blue-700 text-zinc-700 rounded-xl text-[11px] font-medium shrink-0 transition-all border border-zinc-200/60 flex items-center gap-1 cursor-pointer"
                >
                  <span>{prompt}</span>
                  <ChevronRight className="w-3 h-3 text-zinc-400" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-4 bg-white border-t border-zinc-200 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask anything about using manus..."
              className="flex-1 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 placeholder:text-zinc-400"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              className="p-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl transition-all shadow-md shrink-0 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-2 px-1">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              Powered by Gemini 3.6 Flash Server API
            </span>
            <span>Multi-User Isolated Support Session</span>
          </div>
        </div>
      </div>
    </div>
  );
};
