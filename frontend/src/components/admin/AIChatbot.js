import React, { useState, useEffect } from 'react';
import { Bot, Send, MessageSquare, RefreshCw, ThumbsUp, ThumbsDown, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '@/services/api';

function AIChatbot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [faqs, setFaqs] = useState([]);
  const [sessionId] = useState(() => `session_${Date.now()}`);

  useEffect(() => { loadFAQs(); }, []);

  const loadFAQs = async () => {
    try {
      const res = await api.get('/chatbot/faq');
      setFaqs(res.data.topics || []);
    } catch (error) { console.error(error); }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/chatbot/chat', {
        session_id: sessionId,
        message: input,
        context: {}
      });
      setMessages(prev => [...prev, { role: 'bot', content: res.data.response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'bot', content: 'Sorry, I could not process your request.' }]);
    }
    finally { setLoading(false); }
  };

  const sendFeedback = async (messageIdx, helpful) => {
    try {
      await api.post('/chatbot/feedback', { session_id: sessionId, message_index: messageIdx, helpful });
    } catch (error) { console.error(error); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center">
            <Bot className="h-6 w-6 mr-2 text-purple-500" /> AI Support Chatbot
          </h1>
          <p className="text-slate-400">24/7 automated customer support</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-slate-800 rounded-lg border border-slate-700 flex flex-col h-[600px]">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-white font-semibold">Chat with AirYatra Bot</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <Bot className="h-16 w-16 mx-auto text-purple-500 mb-4" />
                <p className="text-white text-lg">Hello! How can I help you today?</p>
                <p className="text-slate-400 text-sm mt-2">Ask me anything about bookings, pricing, or policies</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] p-3 rounded-lg ${msg.role === 'user' ? 'bg-orange-500 text-white' : 'bg-slate-700 text-white'}`}>
                  <p>{msg.content}</p>
                  {msg.role === 'bot' && (
                    <div className="flex justify-end space-x-2 mt-2">
                      <button onClick={() => sendFeedback(i, true)} className="text-slate-400 hover:text-green-400"><ThumbsUp className="h-4 w-4" /></button>
                      <button onClick={() => sendFeedback(i, false)} className="text-slate-400 hover:text-red-400"><ThumbsDown className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-700 p-3 rounded-lg">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="p-4 border-t border-slate-700">
            <div className="flex space-x-2">
              <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendMessage()} placeholder="Type your message..." className="bg-slate-700 flex-1" />
              <Button onClick={sendMessage} className="bg-orange-500" disabled={loading}><Send className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
            <BookOpen className="h-5 w-5 mr-2 text-blue-400" /> Quick FAQs
          </h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <button key={i} onClick={() => setInput(faq.title)} className="w-full text-left p-3 bg-slate-900 rounded-lg hover:bg-slate-700 transition-colors">
                <p className="text-white font-medium">{faq.title}</p>
                <p className="text-slate-400 text-sm">{faq.preview}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIChatbot;
