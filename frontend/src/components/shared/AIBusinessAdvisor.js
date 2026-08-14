import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, Send, X, Minimize2, Maximize2, Sparkles, TrendingUp, 
  Users, DollarSign, Megaphone, Building2, RefreshCw, Trash2,
  MessageSquare, ChevronDown, Copy, Check, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Quick prompt buttons
const QUICK_PROMPTS = [
  { id: 'sales_report', label: 'Sales Report', icon: TrendingUp, color: 'text-green-400' },
  { id: 'profit_analysis', label: 'Profit Analysis', icon: DollarSign, color: 'text-yellow-400' },
  { id: 'marketing_ideas', label: 'Marketing Ideas', icon: Megaphone, color: 'text-purple-400' },
  { id: 'hr_summary', label: 'HR Summary', icon: Users, color: 'text-blue-400' },
  { id: 'customer_insights', label: 'Customer Insights', icon: Building2, color: 'text-orange-400' },
  { id: 'weekly_briefing', label: 'Weekly Brief', icon: Sparkles, color: 'text-pink-400' },
];

function AIBusinessAdvisor({ isOpen, onToggle }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Add welcome message
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `🙏 Namaste! Main hoon **AirYatra AI Business Advisor™**

I can help you with:
- 📊 Sales & Revenue Analysis
- 💰 Profit Tracking & Cost Optimization
- 📣 Marketing Campaign Ideas
- 👥 HR & Team Insights
- 🎯 Customer Analytics

Use the quick prompts below or ask your own question!`,
        timestamp: new Date()
      }]);
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async (message, isQuickPrompt = false) => {
    if (!message.trim() && !isQuickPrompt) return;
    
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      
      let endpoint, body;
      
      if (isQuickPrompt) {
        endpoint = `${API_URL}/api/ai-advisor/quick-prompt`;
        body = JSON.stringify({ prompt_type: message });
      } else {
        endpoint = `${API_URL}/api/ai-advisor/chat`;
        body = JSON.stringify({
          message: message,
          session_id: sessionId,
          context_type: 'general'
        });
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to get response');
      }

      const data = await res.json();
      
      if (data.session_id) {
        setSessionId(data.session_id);
      }

      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      toast.error(error.message || 'Failed to get AI response');
      
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: '❌ Sorry, kuch problem hui. Please try again.',
        timestamp: new Date(),
        isError: true
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleQuickPrompt = (promptId) => {
    const prompt = QUICK_PROMPTS.find(p => p.id === promptId);
    if (prompt) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'user',
        content: `📊 ${prompt.label}`,
        timestamp: new Date()
      }]);
      sendMessage(promptId, true);
    }
  };

  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success('Copied to clipboard!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const clearChat = () => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: '🔄 Chat cleared! How can I help you?',
      timestamp: new Date()
    }]);
    setSessionId(null);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform z-50 group"
        title="AI Business Advisor"
      >
        <Bot className="h-7 w-7 text-white" />
        <span className="absolute -top-2 -right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
          <Sparkles className="h-3 w-3 text-white" />
        </span>
      </button>
    );
  }

  return (
    <div 
      className={`fixed bottom-6 right-6 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 flex flex-col transition-all duration-300 ${
        isMinimized ? 'w-80 h-14' : 'w-96 h-[600px] max-h-[80vh]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-gradient-to-r from-orange-600/20 to-amber-600/20 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full flex items-center justify-center">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">AI Business Advisor™</h3>
            <p className="text-xs text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
              Online
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={clearChat}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="Clear chat"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button 
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </button>
          <button 
            onClick={onToggle}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Quick Prompts */}
          <div className="px-3 py-2 border-b border-slate-800 overflow-x-auto">
            <div className="flex gap-2">
              {QUICK_PROMPTS.map(prompt => (
                <button
                  key={prompt.id}
                  onClick={() => handleQuickPrompt(prompt.id)}
                  disabled={loading}
                  className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-300 whitespace-nowrap transition-colors disabled:opacity-50"
                >
                  <prompt.icon className={`h-3 w-3 ${prompt.color}`} />
                  {prompt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(msg => (
              <div 
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                    msg.role === 'user' 
                      ? 'bg-orange-600 text-white rounded-br-md' 
                      : msg.isError 
                        ? 'bg-red-900/30 text-red-300 rounded-bl-md border border-red-800'
                        : 'bg-slate-800 text-slate-200 rounded-bl-md'
                  }`}
                >
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">
                    {msg.content.split('\n').map((line, i) => (
                      <React.Fragment key={i}>
                        {line.startsWith('**') && line.endsWith('**') ? (
                          <strong>{line.slice(2, -2)}</strong>
                        ) : line.startsWith('- ') ? (
                          <span className="block ml-2">• {line.slice(2)}</span>
                        ) : (
                          line
                        )}
                        {i < msg.content.split('\n').length - 1 && <br />}
                      </React.Fragment>
                    ))}
                  </div>
                  
                  {msg.role === 'assistant' && !msg.isError && msg.id !== 'welcome' && (
                    <div className="flex justify-end mt-2 pt-2 border-t border-slate-700/50">
                      <button
                        onClick={() => copyToClipboard(msg.content, msg.id)}
                        className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
                      >
                        {copiedId === msg.id ? (
                          <><Check className="h-3 w-3" /> Copied</>
                        ) : (
                          <><Copy className="h-3 w-3" /> Copy</>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Analyzing...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-slate-700">
            <div className="flex items-center gap-2 bg-slate-800 rounded-xl px-3 py-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask anything about your business..."
                disabled={loading}
                className="flex-1 bg-transparent text-white placeholder-slate-500 text-sm focus:outline-none"
              />
              <button
                onClick={() => sendMessage(inputValue)}
                disabled={!inputValue.trim() || loading}
                className="p-2 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-white transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 mt-2 text-center">
              Powered by AirYatra AI • Data refreshed in real-time
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default AIBusinessAdvisor;
