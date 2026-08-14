import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Bot, User, Minimize2, Maximize2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '@/services/api';
import { toast } from 'sonner';

function AIChatbot({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Load welcome message when opened
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `🙏 Welcome to AirYatra!

I'm your AI assistant. I can help you with:
• 🚁 Booking inquiries & pricing
• 📍 Route recommendations
• 📋 Flight status updates
• ❓ General questions

How can I assist you today?
`,
        timestamp: new Date().toISOString()
      }]);
    }
  }, [isOpen]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    const aiMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      ai_generated: true,
      streaming: true
    }]);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/ai/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversation_id: conversationId
        })
      });

      if (!response.ok || !response.body) throw new Error('Stream failed');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.delta) {
              fullText += data.delta;
              setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: fullText } : m));
            } else if (data.error) {
              throw new Error(data.error);
            } else if (data.done) {
              if (!conversationId) setConversationId(data.conversation_id);
              setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, streaming: false } : m));
            }
          } catch (e) {
            if (e.message && e.message !== 'Unexpected end of JSON input') throw e;
          }
        }
      }
      if (!fullText) throw new Error('Empty response');
    } catch (error) {
      setMessages(prev => prev.map(m => m.id === aiMsgId ? {
        ...m,
        streaming: false,
        content: `I'm having trouble connecting right now. Please try again or contact support@airyatra.com

`,
        ai_generated: false
      } : m));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setConversationId(null);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 z-40"
        title="Chat with AI Assistant"
      >
        <div className="relative">
          <MessageCircle className="h-5 w-5" />
          <Sparkles className="h-2.5 w-2.5 absolute -top-1 -right-1 text-yellow-300" />
        </div>
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 z-50 transition-all duration-300 ${
      isMinimized ? 'w-80 h-14' : 'w-96 h-[500px]'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-gradient-to-r from-orange-600 to-orange-500 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bot className="h-8 w-8 text-white" />
            <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-orange-500" />
          </div>
          <div>
            <h3 className="text-white font-semibold">AirYatra AI</h3>
            <p className="text-orange-100 text-xs">Always here to help</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-white/80 hover:text-white p-1"
          >
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="text-white/80 hover:text-white p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 h-[350px]">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.role === 'user' 
                    ? 'bg-blue-500' 
                    : 'bg-gradient-to-br from-orange-500 to-orange-600'
                }`}>
                  {message.role === 'user' 
                    ? <User className="h-4 w-4 text-white" />
                    : <Bot className="h-4 w-4 text-white" />
                  }
                </div>
                
                {/* Message */}
                <div className={`max-w-[80%] ${message.role === 'user' ? 'text-right' : ''}`}>
                  <div className={`p-3 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-sm'
                      : 'bg-slate-800 text-slate-100 rounded-tl-sm'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-500">
                      {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {message.role === 'assistant' && message.ai_generated && (
                      <span className="text-xs text-orange-400 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> AI
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-slate-800 p-3 rounded-2xl rounded-tl-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          <div className="px-4 py-2 flex gap-2 overflow-x-auto border-t border-slate-800">
            {['Pricing?', 'Routes', 'Booking Help', 'Contact'].map((action) => (
              <button
                key={action}
                onClick={() => {
                  setInput(action === 'Pricing?' ? 'What are your prices?' : 
                          action === 'Routes' ? 'What routes do you offer?' :
                          action === 'Booking Help' ? 'How do I book a helicopter?' :
                          'How can I contact support?');
                }}
                className="px-3 py-1 text-xs bg-slate-800 text-slate-300 rounded-full hover:bg-slate-700 whitespace-nowrap"
              >
                {action}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-800">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="flex-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                disabled={loading}
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="bg-orange-500 hover:bg-orange-600"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex justify-between mt-2">
              <button
                onClick={startNewConversation}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                New conversation
              </button>
              <span className="text-xs text-slate-600">
                Powered by AI ✨
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default AIChatbot;
