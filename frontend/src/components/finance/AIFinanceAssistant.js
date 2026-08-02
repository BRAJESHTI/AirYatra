import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, Send, RefreshCw, Sparkles, MessageSquare, User, Wallet,
  TrendingUp, AlertTriangle, HelpCircle, Mic, MicOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import api from '@/services/apiClient';
import { toast } from 'sonner';

const suggestedQueries = [
  "Show me pending payments over ₹1L",
  "What's my current bank balance?",
  "List overdue challans",
  "Today ka collection kitna hai?",
  "Pending vendor bills dikhao",
  "This month ka profit margin?",
  "Which vendors are due for payment?",
  "GST payment kab due hai?"
];

export default function AIFinanceAssistant() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Namaste! 🙏 Main AirYatra ka AI Finance Assistant hoon. Aap mujhse kuch bhi pooch sakte hain - bank balance, pending payments, challans, ya koi bhi finance related query. Kaise madad kar sakta hoon?'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [sessionId] = useState(() => `finance-chat-${Date.now()}`);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      // Try streaming first
      setStreaming(true);
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/finance/phase4/ai-assistant/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMessage, session_id: sessionId })
      });

      if (!response.ok) {
        throw new Error('Stream failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              assistantMessage += data.content;
              setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                  role: 'assistant',
                  content: assistantMessage,
                  streaming: true
                };
                return newMessages;
              });
            } else if (data.done) {
              setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                  role: 'assistant',
                  content: assistantMessage,
                  streaming: false
                };
                return newMessages;
              });
            } else if (data.error) {
              throw new Error(data.error);
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    } catch (error) {
      // Fallback to non-streaming
      try {
        const response = await api.post('/finance/phase4/ai-assistant/query', {
          query: userMessage,
          session_id: sessionId
        });
        
        const aiResponse = response.data.response || response.data.fallback || 'Sorry, unable to process your query.';
        setMessages(prev => {
          // Remove streaming message if exists
          const filtered = prev.filter(m => !m.streaming);
          return [...filtered, { role: 'assistant', content: aiResponse }];
        });
      } catch (fallbackError) {
        setMessages(prev => [
          ...prev.filter(m => !m.streaming),
          { role: 'assistant', content: 'Sorry, there was an error processing your query. Please try again.' }
        ]);
        toast.error('AI query failed');
      }
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  };

  const handleSuggestionClick = (query) => {
    setInput(query);
    inputRef.current?.focus();
  };

  return (
    <div className="h-[calc(100vh-200px)] flex flex-col" data-testid="ai-finance-assistant">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot className="h-7 w-7 text-purple-400" />
            AI Finance Assistant / वित्त सहायक
          </h1>
          <p className="text-slate-400 mt-1">Ask anything about your finances in natural language</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 rounded-full border border-purple-500/50">
          <Sparkles className="h-4 w-4 text-purple-400" />
          <span className="text-purple-400 text-sm font-medium">GPT-4o Powered</span>
        </div>
      </div>

      {/* Chat Container */}
      <Card className="flex-1 bg-slate-800/50 border-slate-700 flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, idx) => (
            <div 
              key={idx}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.role === 'user' ? 'bg-blue-500' : 'bg-purple-500'
                }`}>
                  {message.role === 'user' ? 
                    <User className="h-4 w-4 text-white" /> :
                    <Bot className="h-4 w-4 text-white" />
                  }
                </div>
                <div className={`rounded-2xl px-4 py-3 ${
                  message.role === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-slate-900 text-slate-200 border border-slate-700'
                }`}>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.streaming && (
                    <span className="inline-block w-2 h-4 bg-purple-400 animate-pulse ml-1" />
                  )}
                </div>
              </div>
            </div>
          ))}
          {loading && !streaming && (
            <div className="flex justify-start">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="rounded-2xl px-4 py-3 bg-slate-900 border border-slate-700">
                  <RefreshCw className="h-5 w-5 text-purple-400 animate-spin" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions */}
        {messages.length <= 2 && (
          <div className="px-4 pb-2">
            <p className="text-xs text-slate-500 mb-2">Suggested questions:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedQueries.slice(0, 4).map((query, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(query)}
                  className="text-xs px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-full transition-colors"
                >
                  {query}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-slate-700">
          <div className="flex gap-3">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask anything about your finances... (Hindi/English)"
              className="flex-1 bg-slate-900 border-slate-700 text-white"
              disabled={loading}
            />
            <Button 
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {loading ? 
                <RefreshCw className="h-4 w-4 animate-spin" /> :
                <Send className="h-4 w-4" />
              }
            </Button>
          </div>
        </div>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-3 mt-4">
        <Card className="bg-slate-800/30 border-slate-700">
          <CardContent className="p-3 flex items-center gap-3">
            <Wallet className="h-5 w-5 text-emerald-400" />
            <div>
              <p className="text-xs text-slate-400">Quick: Balance</p>
              <p className="text-sm text-white">Type &quot;balance&quot;</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/30 border-slate-700">
          <CardContent className="p-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            <div>
              <p className="text-xs text-slate-400">Quick: Pending</p>
              <p className="text-sm text-white">Type &quot;pending&quot;</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/30 border-slate-700">
          <CardContent className="p-3 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-blue-400" />
            <div>
              <p className="text-xs text-slate-400">Quick: Today</p>
              <p className="text-sm text-white">Type &quot;today&quot;</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/30 border-slate-700">
          <CardContent className="p-3 flex items-center gap-3">
            <HelpCircle className="h-5 w-5 text-purple-400" />
            <div>
              <p className="text-xs text-slate-400">Examples</p>
              <p className="text-sm text-white">Type &quot;help&quot;</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
