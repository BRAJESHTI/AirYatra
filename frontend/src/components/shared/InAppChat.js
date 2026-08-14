import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, User, Bot, Paperclip, Search, Phone, Video, MoreVertical, Check, CheckCheck, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { chatAPI } from '@/services/api';
import { toast } from 'sonner';

function InAppChat({ user, bookingId }) {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    loadConversations();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (activeConversation) {
      loadMessages(activeConversation.booking_id);
      connectWebSocket(activeConversation.booking_id);
    }
  }, [activeConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      const response = await chatAPI.getConversations();
      setConversations(response.data.conversations || []);
      if (bookingId) {
        const conv = response.data.conversations?.find(c => c.booking_id === bookingId);
        if (conv) setActiveConversation(conv);
      }
    } catch (error) {
      console.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (convBookingId) => {
    try {
      const response = await chatAPI.getMessages(convBookingId, 100);
      setMessages(response.data.messages || []);
    } catch (error) {
      console.error('Failed to load messages');
    }
  };

  const connectWebSocket = (convBookingId) => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    const wsUrl = `${process.env.REACT_APP_BACKEND_URL?.replace('https', 'wss').replace('http', 'ws')}/api/ws/chat/${convBookingId}`;
    
    try {
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
      };
      
      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'message') {
          setMessages(prev => [...prev, data.message]);
        }
      };
      
      wsRef.current.onerror = (error) => {
        console.log('WebSocket error:', error);
      };
      
      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
      };
    } catch (e) {
      console.log('WebSocket connection failed');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversation) return;
    
    setSending(true);
    try {
      // Optimistic update
      const tempMessage = {
        id: `temp-${Date.now()}`,
        content: newMessage,
        sender_id: user?.id,
        sender_name: user?.full_name || 'You',
        sender_type: user?.roles?.includes('operator') ? 'operator' : 'customer',
        created_at: new Date().toISOString(),
        status: 'sending'
      };
      setMessages(prev => [...prev, tempMessage]);
      setNewMessage('');
      
      await chatAPI.sendMessage({
        booking_id: activeConversation.booking_id,
        content: newMessage
      });
      
      // Update message status
      setMessages(prev => prev.map(m => 
        m.id === tempMessage.id ? { ...m, status: 'sent' } : m
      ));
    } catch (error) {
      toast.error('Failed to send message');
      setMessages(prev => prev.filter(m => m.id !== `temp-${Date.now()}`));
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const filteredConversations = conversations.filter(conv => 
    conv.other_party_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.booking_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getMessageStatusIcon = (status) => {
    switch (status) {
      case 'sending': return <Clock className="h-3 w-3 text-slate-500" />;
      case 'sent': return <Check className="h-3 w-3 text-slate-400" />;
      case 'delivered': return <CheckCheck className="h-3 w-3 text-slate-400" />;
      case 'read': return <CheckCheck className="h-3 w-3 text-blue-400" />;
      default: return null;
    }
  };

  return (
    <div className="h-[calc(100vh-200px)] flex rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
      {/* Conversations List */}
      <div className="w-80 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-lg font-semibold text-white mb-3">Messages</h3>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="pl-9 bg-slate-800 border-slate-700"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-slate-400">Loading...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No conversations yet</p>
            </div>
          ) : (
            filteredConversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => setActiveConversation(conv)}
                className={`w-full p-4 text-left border-b border-slate-800 transition-colors ${
                  activeConversation?.id === conv.id ? 'bg-slate-800' : 'hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                    <span className="text-white font-medium">
                      {conv.other_party_name?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <p className="text-white font-medium truncate">{conv.other_party_name || 'Unknown'}</p>
                      <span className="text-xs text-slate-500">{formatTime(conv.last_message_at)}</span>
                    </div>
                    <p className="text-sm text-slate-400 truncate">{conv.last_message || 'No messages'}</p>
                    <p className="text-xs text-orange-400">#{conv.booking_number}</p>
                  </div>
                  {conv.unread_count > 0 && (
                    <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {conv.unread_count}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                  <span className="text-white font-medium">
                    {activeConversation.other_party_name?.charAt(0) || 'U'}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">{activeConversation.other_party_name}</p>
                  <p className="text-xs text-slate-400">Booking: #{activeConversation.booking_number}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" className="text-slate-400">
                  <Phone className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" className="text-slate-400">
                  <Video className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" className="text-slate-400">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message, index) => {
                const isOwn = message.sender_id === user?.id;
                const showDate = index === 0 || 
                  formatDate(message.created_at) !== formatDate(messages[index - 1]?.created_at);
                
                return (
                  <React.Fragment key={message.id}>
                    {showDate && (
                      <div className="text-center">
                        <span className="text-xs text-slate-500 bg-slate-800 px-3 py-1 rounded-full">
                          {formatDate(message.created_at)}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] ${isOwn ? 'order-2' : 'order-1'}`}>
                        {!isOwn && (
                          <p className="text-xs text-slate-500 mb-1">{message.sender_name}</p>
                        )}
                        <div className={`rounded-2xl px-4 py-2 ${
                          isOwn 
                            ? 'bg-orange-500 text-white rounded-tr-sm' 
                            : 'bg-slate-800 text-white rounded-tl-sm'
                        }`}>
                          <p className="text-sm">{message.content}</p>
                        </div>
                        <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          <span className="text-xs text-slate-500">{formatTime(message.created_at)}</span>
                          {isOwn && getMessageStatusIcon(message.status || 'sent')}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="ghost" className="text-slate-400">
                  <Paperclip className="h-5 w-5" />
                </Button>
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-slate-800 border-slate-700"
                  disabled={sending}
                />
                <Button 
                  type="submit" 
                  disabled={!newMessage.trim() || sending}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-lg">Select a conversation</p>
              <p className="text-slate-500"></p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default InAppChat;
