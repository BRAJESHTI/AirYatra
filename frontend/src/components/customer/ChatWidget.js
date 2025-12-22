import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, User, Plane, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { chatAPI } from '../../services/api';
import { toast } from 'sonner';

function ChatWidget({ user }) {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadConversations();
  }, []);

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
    } catch (error) {
      console.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (bookingId) => {
    try {
      const response = await chatAPI.getMessages(bookingId);
      setMessages(response.data.messages || []);
    } catch (error) {
      toast.error('Failed to load messages');
    }
  };

  const handleSelectConversation = (conv) => {
    setSelectedConversation(conv);
    loadMessages(conv.booking_id);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;

    setSending(true);
    try {
      const response = await chatAPI.sendMessage({
        booking_id: selectedConversation.booking_id,
        message: newMessage.trim()
      });
      
      setMessages([...messages, response.data.chat_message]);
      setNewMessage('');
      
      // Update conversation list
      loadConversations();
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex h-[600px] rounded-xl overflow-hidden border border-slate-700" data-testid="chat-widget">
      {/* Conversations List */}
      <div className="w-80 bg-slate-900 border-r border-slate-700">
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-orange-400" />
            Messages
          </h3>
        </div>
        
        <div className="overflow-y-auto h-[calc(100%-60px)]">
          {loading ? (
            <p className="text-center py-8 text-slate-400">Loading...</p>
          ) : conversations.length === 0 ? (
            <p className="text-center py-8 text-slate-400">No conversations</p>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.booking_id}
                onClick={() => handleSelectConversation(conv)}
                className={`w-full p-4 text-left border-b border-slate-800 hover:bg-slate-800 transition-colors ${
                  selectedConversation?.booking_id === conv.booking_id ? 'bg-slate-800' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-white font-medium">{conv.booking_number || conv.booking_id?.slice(0, 8)}</p>
                    <p className="text-sm text-slate-400">{conv.route}</p>
                  </div>
                  {conv.unread_count > 0 && (
                    <span className="px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full">
                      {conv.unread_count}
                    </span>
                  )}
                </div>
                {conv.last_message && (
                  <p className="text-sm text-slate-500 mt-1 truncate">
                    {conv.last_message.message}
                  </p>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-950">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-700 bg-slate-900">
              <p className="text-white font-medium">{selectedConversation.booking_number}</p>
              <p className="text-sm text-slate-400">{selectedConversation.route}</p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => {
                const isMe = msg.sender_id === user?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[70%] ${isMe ? 'order-2' : 'order-1'}`}>
                      <div className={`flex items-center gap-2 mb-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {!isMe && (
                          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
                            {msg.sender_type === 'operator' ? (
                              <Plane className="h-3 w-3 text-orange-400" />
                            ) : (
                              <User className="h-3 w-3 text-slate-400" />
                            )}
                          </div>
                        )}
                        <span className="text-xs text-slate-500">
                          {msg.sender_name || (isMe ? 'You' : 'Operator')}
                        </span>
                      </div>
                      <div
                        className={`p-3 rounded-lg ${isMe
                            ? 'bg-orange-500 text-white'
                            : 'bg-slate-800 text-slate-200'
                          }`}
                      >
                        <p>{msg.message}</p>
                      </div>
                      <p className={`text-xs text-slate-500 mt-1 ${isMe ? 'text-right' : 'text-left'}`}>
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-700 bg-slate-900">
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="icon" className="text-slate-400">
                  <Paperclip className="h-5 w-5" />
                </Button>
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-slate-800 border-slate-700 text-white"
                />
                <Button type="submit" disabled={sending || !newMessage.trim()} className="bg-orange-500 hover:bg-orange-600">
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatWidget;
