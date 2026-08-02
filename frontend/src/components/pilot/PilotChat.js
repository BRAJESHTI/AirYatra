import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, Send, X, ChevronDown, User, Clock, Check, CheckCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function PilotChat({ isOpen, onClose, user }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      loadMessages();
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    // Poll for new messages every 10 seconds when open
    if (isOpen && conversationId) {
      const interval = setInterval(() => {
        loadMessages(true);
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [isOpen, conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      // Get conversations
      const convRes = await fetch(`${API_URL}/api/chat/conversations`, { headers });
      if (convRes.ok) {
        const convData = await convRes.json();
        const conversations = convData.conversations || [];
        
        if (conversations.length > 0) {
          const conv = conversations[0];
          setConversationId(conv.id);
          
          // Get messages
          const msgRes = await fetch(`${API_URL}/api/chat/messages/${conv.id}`, { headers });
          if (msgRes.ok) {
            const msgData = await msgRes.json();
            setMessages(msgData.messages || []);
          }
        }
      }

      // Get unread count
      const unreadRes = await fetch(`${API_URL}/api/chat/unread-count`, { headers });
      if (unreadRes.ok) {
        const unreadData = await unreadRes.json();
        setUnreadCount(unreadData.unread_count || 0);
      }
    } catch (error) {
      console.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/chat/messages/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: newMessage.trim() })
      });

      if (res.ok) {
        const data = await res.json();
        setConversationId(data.conversation_id);
        setNewMessage('');
        loadMessages(true);
      } else {
        toast.error('Failed to send message');
      }
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' ' + 
           date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center sm:items-center">
      <div className="bg-slate-900 w-full max-w-md h-[80vh] sm:h-[600px] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden border border-slate-700 shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold">Operations Team</h3>
              <p className="text-white/80 text-xs">AirYatra Support</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900">
          {loading && messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-slate-400">Loading...</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <MessageCircle className="h-8 w-8 text-slate-600" />
              </div>
              <p className="text-slate-400">No messages yet</p>
              <p className="text-slate-500 text-sm mt-1">
                Send a message to start chatting with the operations team
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isOwnMessage = msg.sender_id === user?.id;
              
              return (
                <div 
                  key={msg.id || idx}
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] ${isOwnMessage ? 'order-2' : 'order-1'}`}>
                    {!isOwnMessage && (
                      <p className="text-xs text-slate-500 mb-1 ml-1">{msg.sender_name}</p>
                    )}
                    <div className={`rounded-2xl px-4 py-2 ${
                      isOwnMessage 
                        ? 'bg-orange-600 text-white rounded-br-md' 
                        : 'bg-slate-800 text-white rounded-bl-md'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    <div className={`flex items-center gap-1 mt-1 ${
                      isOwnMessage ? 'justify-end' : 'justify-start'
                    }`}>
                      <Clock className="h-3 w-3 text-slate-500" />
                      <span className="text-xs text-slate-500">
                        {formatTime(msg.created_at)}
                      </span>
                      {isOwnMessage && (
                        <CheckCheck className="h-3 w-3 text-slate-500 ml-1" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Replies */}
        <div className="px-4 py-2 bg-slate-800/50 flex gap-2 overflow-x-auto">
          {[
            "Hi, I need help",
            "Flight update?",
            "Document query",
            "Weather concern"
          ].map((reply, idx) => (
            <button
              key={idx}
              onClick={() => setNewMessage(reply)}
              className="px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-xs whitespace-nowrap hover:bg-slate-600 transition-colors"
            >
              {reply}
            </button>
          ))}
        </div>

        {/* Input */}
        <form onSubmit={sendMessage} className="p-4 bg-slate-800 flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-slate-700 text-white rounded-full px-4 py-2 outline-none focus:ring-2 focus:ring-orange-500 text-sm"
          />
          <Button 
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="bg-orange-600 hover:bg-orange-700 rounded-full w-10 h-10 p-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

// Chat button for pilot portal
export function PilotChatButton({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadUnreadCount();
    // Poll every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadUnreadCount = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/chat/unread-count`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unread_count || 0);
      }
    } catch (error) {
      // Silent fail
    }
  };

  return (
    <>
      <button
        onClick={() => {
          setIsOpen(true);
          setUnreadCount(0);
        }}
        className="fixed bottom-24 right-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 z-40"
        title="Chat with Operations"
      >
        <div className="relative">
          <MessageCircle className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
      </button>
      
      <PilotChat 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
        user={user}
      />
    </>
  );
}

export default PilotChat;
