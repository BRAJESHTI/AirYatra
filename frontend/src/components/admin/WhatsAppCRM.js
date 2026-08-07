import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Send, Phone, Search, User, Clock, CheckCircle2, AlertTriangle, Loader2, RefreshCw, Plus, X, ExternalLink, Settings, Zap, FileText, Filter, ChevronRight, Bell, Bookmark, Archive, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import api from '../../services/api';
import { toast } from 'sonner';

// WhatsApp message templates
const MESSAGE_TEMPLATES = [
  {
    id: 'booking_confirmation',
    name: 'Booking Confirmation',
    name_hi: 'बुकिंग पुष्टि',
    category: 'booking',
    template: `🛩️ *AirYatra Booking Confirmed*

Hi {{customer_name}},

Your booking #{{booking_id}} is confirmed!

📍 Route: {{from}} → {{to}}
📅 Date: {{date}}
⏰ Time: {{time}}
✈️ Aircraft: {{aircraft}}

Total: ₹{{amount}}

Track: {{tracking_link}}

Safe travels! 🙏`
  },
  {
    id: 'complaint_filed',
    name: 'Complaint Filed',
    name_hi: 'शिकायत दर्ज',
    category: 'complaint',
    template: `📋 *Complaint Registered*

Hi {{customer_name}},

Your complaint #{{complaint_number}} has been filed.

Subject: {{subject}}
Status: Under Review

The operator has 24 hours to respond. We will update you on the decision.

Track: {{tracking_link}}`
  },
  {
    id: 'complaint_decision',
    name: 'Complaint Decision',
    name_hi: 'शिकायत निर्णय',
    category: 'complaint',
    template: `⚖️ *Complaint Decision*

Hi {{customer_name}},

Decision on complaint #{{complaint_number}}:

Verdict: *{{decision}}*
{{compensation_text}}

{{next_steps}}

Questions? Reply to this message.`
  },
  {
    id: 'operator_complaint_alert',
    name: 'Operator Complaint Alert',
    name_hi: 'ऑपरेटर शिकायत अलर्ट',
    category: 'complaint',
    template: `🚨 *URGENT: New Complaint*

A complaint has been filed against your service.

Complaint #: {{complaint_number}}
Subject: {{subject}}
Severity: {{severity}}

⏰ *Respond within 24 hours* to avoid penalty.

View: {{complaint_link}}`
  },
  {
    id: 'deadline_reminder',
    name: 'Deadline Reminder',
    name_hi: 'समय सीमा स्मरण',
    category: 'reminder',
    template: `⏰ *Deadline Reminder*

Hi {{operator_name}},

Complaint #{{complaint_number}} needs your response.

Time remaining: *{{time_remaining}}*

Late response = ₹5,000 penalty

Respond now: {{response_link}}`
  },
  {
    id: 'payment_reminder',
    name: 'Payment Reminder',
    name_hi: 'भुगतान स्मरण',
    category: 'payment',
    template: `💰 *Payment Reminder*

Hi {{customer_name}},

Your booking #{{booking_id}} payment is pending.

Amount: ₹{{amount}}
Due: {{due_date}}

Pay now: {{payment_link}}

Need help? Reply to this message.`
  },
  {
    id: 'custom',
    name: 'Custom Message',
    name_hi: 'कस्टम संदेश',
    category: 'custom',
    template: ''
  }
];

const QUICK_REPLIES = [
  { id: 'thanks', text: 'Thank you for contacting AirYatra! How can we help?' },
  { id: 'booking_help', text: 'I can help with your booking. Please share your booking number.' },
  { id: 'complaint_status', text: 'Let me check the status of your complaint. Please share the complaint number.' },
  { id: 'payment_help', text: 'For payment issues, please share your booking/order number.' },
  { id: 'hold', text: 'Please hold while I check this for you. I\'ll respond shortly.' },
  { id: 'escalate', text: 'I\'m escalating this to our senior team. You\'ll receive a callback within 2 hours.' },
];

export default function WhatsAppCRM() {
  const [conversations, setConversations] = useState([]);
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateVars, setTemplateVars] = useState({});
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      // In production, this would fetch from WhatsApp Business API
      // For now, we'll show mock data structure
      const mockConversations = [
        {
          id: '1',
          phone: '+919876543210',
          name: 'Rajesh Kumar',
          lastMessage: 'When will my helicopter arrive?',
          lastMessageTime: new Date().toISOString(),
          unreadCount: 2,
          category: 'booking',
          status: 'active',
          bookingId: 'BK-20260807-ABC'
        },
        {
          id: '2',
          phone: '+919876543211',
          name: 'Priya Sharma',
          lastMessage: 'I want to file a complaint',
          lastMessageTime: new Date(Date.now() - 3600000).toISOString(),
          unreadCount: 1,
          category: 'complaint',
          status: 'pending',
          complaintId: 'COMP-12345678'
        },
        {
          id: '3',
          phone: '+919876543212',
          name: 'Operator - Sky Wings',
          lastMessage: 'We have responded to the complaint',
          lastMessageTime: new Date(Date.now() - 7200000).toISOString(),
          unreadCount: 0,
          category: 'operator',
          status: 'resolved'
        }
      ];
      
      setConversations(mockConversations);
    } catch (err) {
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load messages for a conversation
  const loadMessages = useCallback(async (convoId) => {
    try {
      // Mock messages for now
      const mockMessages = [
        {
          id: '1',
          sender: 'customer',
          text: 'Hello, I have a question about my booking',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          status: 'read'
        },
        {
          id: '2',
          sender: 'agent',
          text: 'Hi! Welcome to AirYatra. How can I help you today?',
          timestamp: new Date(Date.now() - 3500000).toISOString(),
          status: 'delivered',
          agentName: 'Support Team'
        },
        {
          id: '3',
          sender: 'customer',
          text: 'When will my helicopter arrive?',
          timestamp: new Date(Date.now() - 3400000).toISOString(),
          status: 'read'
        }
      ];
      
      setMessages(mockMessages);
    } catch (err) {
      toast.error('Failed to load messages');
    }
  }, []);

  useEffect(() => {
    loadConversations();
    
    // Check WhatsApp connection status
    checkConnectionStatus();
  }, [loadConversations]);

  useEffect(() => {
    if (selectedConvo) {
      loadMessages(selectedConvo.id);
    }
  }, [selectedConvo, loadMessages]);

  const checkConnectionStatus = async () => {
    // In production, check actual WhatsApp Business API status
    setConnectionStatus('connected'); // Mock for now
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedConvo) return;
    
    setSending(true);
    try {
      // In production, send via WhatsApp Business API
      const newMessage = {
        id: Date.now().toString(),
        sender: 'agent',
        text: messageText,
        timestamp: new Date().toISOString(),
        status: 'sent',
        agentName: 'You'
      };
      
      setMessages(prev => [...prev, newMessage]);
      setMessageText('');
      
      toast.success('Message sent');
    } catch (err) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleSendTemplate = async () => {
    if (!selectedTemplate || !selectedConvo) return;
    
    // Fill template with variables
    let filledTemplate = selectedTemplate.template;
    Object.entries(templateVars).forEach(([key, value]) => {
      filledTemplate = filledTemplate.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    
    setSending(true);
    try {
      const newMessage = {
        id: Date.now().toString(),
        sender: 'agent',
        text: filledTemplate,
        timestamp: new Date().toISOString(),
        status: 'sent',
        agentName: 'You',
        isTemplate: true,
        templateId: selectedTemplate.id
      };
      
      setMessages(prev => [...prev, newMessage]);
      setShowTemplateDialog(false);
      setSelectedTemplate(null);
      setTemplateVars({});
      
      toast.success('Template message sent');
    } catch (err) {
      toast.error('Failed to send template');
    } finally {
      setSending(false);
    }
  };

  const handleQuickReply = (reply) => {
    setMessageText(reply.text);
  };

  const openWhatsAppWeb = (phone) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const filteredConversations = conversations.filter(c => {
    if (filterCategory !== 'all' && c.category !== filterCategory) return false;
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !c.phone.includes(searchQuery)) return false;
    return true;
  });

  const extractTemplateVars = (template) => {
    const matches = template.match(/{{(\w+)}}/g) || [];
    return [...new Set(matches.map(m => m.replace(/[{}]/g, '')))];
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col" data-testid="whatsapp-crm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/20">
            <MessageSquare className="h-6 w-6 text-green-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">WhatsApp CRM</h1>
            <p className="text-xs text-slate-400">Customer Support Chat</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
            connectionStatus === 'connected' 
              ? 'bg-green-500/20 text-green-400' 
              : 'bg-red-500/20 text-red-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-400' : 'bg-red-400'
            }`} />
            {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
          </span>
          <Button 
            onClick={() => setShowNewChatDialog(true)}
            size="sm"
            className="bg-green-500 hover:bg-green-600"
          >
            <Plus className="h-4 w-4 mr-1" /> New Chat
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Conversations List */}
        <div className="w-80 border-r border-slate-700 flex flex-col">
          {/* Search & Filter */}
          <div className="p-3 space-y-2 border-b border-slate-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-600 text-white h-9"
              />
            </div>
            <div className="flex gap-1">
              {['all', 'booking', 'complaint', 'operator'].map(cat => (
                <Button
                  key={cat}
                  size="sm"
                  variant={filterCategory === cat ? 'default' : 'ghost'}
                  onClick={() => setFilterCategory(cat)}
                  className={`text-xs h-7 ${filterCategory === cat ? 'bg-green-500' : ''}`}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-green-400" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-4 text-center text-slate-400">
                <MessageSquare className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">No conversations found</p>
              </div>
            ) : (
              filteredConversations.map(convo => (
                <div
                  key={convo.id}
                  onClick={() => setSelectedConvo(convo)}
                  className={`p-3 border-b border-slate-700/50 cursor-pointer hover:bg-slate-800/50 ${
                    selectedConvo?.id === convo.id ? 'bg-slate-800' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                        <User className="h-5 w-5 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{convo.name}</p>
                        <p className="text-xs text-slate-400 truncate">{convo.phone}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">{formatTime(convo.lastMessageTime)}</p>
                      {convo.unreadCount > 0 && (
                        <span className="inline-block mt-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                          {convo.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-slate-400 mt-1 truncate">{convo.lastMessage}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      convo.category === 'complaint' ? 'bg-orange-500/20 text-orange-400' :
                      convo.category === 'booking' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-slate-500/20 text-slate-400'
                    }`}>
                      {convo.category}
                    </span>
                    {convo.bookingId && (
                      <span className="text-xs text-slate-500">{convo.bookingId}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedConvo ? (
            <>
              {/* Chat Header */}
              <div className="p-3 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                    <User className="h-5 w-5 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{selectedConvo.name}</p>
                    <p className="text-xs text-slate-400">{selectedConvo.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openWhatsAppWeb(selectedConvo.phone)}
                    className="text-green-400"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowTemplateDialog(true)}
                    className="border-slate-600"
                  >
                    <FileText className="h-4 w-4 mr-1" /> Templates
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === 'agent' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[70%] rounded-lg p-3 ${
                      msg.sender === 'agent'
                        ? 'bg-green-500/20 text-white'
                        : 'bg-slate-800 text-white'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-xs text-slate-400">{formatTime(msg.timestamp)}</span>
                        {msg.sender === 'agent' && (
                          <CheckCircle2 className="h-3 w-3 text-green-400" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Replies */}
              <div className="px-4 py-2 border-t border-slate-700 overflow-x-auto">
                <div className="flex gap-2">
                  {QUICK_REPLIES.map(reply => (
                    <Button
                      key={reply.id}
                      size="sm"
                      variant="outline"
                      onClick={() => handleQuickReply(reply)}
                      className="border-slate-600 text-xs whitespace-nowrap h-7"
                    >
                      <Zap className="h-3 w-3 mr-1" />
                      {reply.id.replace('_', ' ')}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Message Input */}
              <div className="p-3 border-t border-slate-700">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    className="bg-slate-800 border-slate-600 text-white"
                    data-testid="whatsapp-message-input"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={sending || !messageText.trim()}
                    className="bg-green-500 hover:bg-green-600"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 text-slate-600" />
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm mt-1">Choose a chat from the sidebar to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-400" />
              Message Templates
            </DialogTitle>
          </DialogHeader>
          
          {!selectedTemplate ? (
            <div className="space-y-2">
              {MESSAGE_TEMPLATES.map(template => (
                <div
                  key={template.id}
                  onClick={() => {
                    setSelectedTemplate(template);
                    const vars = extractTemplateVars(template.template);
                    setTemplateVars(vars.reduce((acc, v) => ({ ...acc, [v]: '' }), {}));
                  }}
                  className="p-3 rounded-lg border border-slate-700 hover:border-green-500/50 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">{template.name}</p>
                      <p className="text-xs text-slate-400">{template.name_hi}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300">
                      {template.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSelectedTemplate(null); setTemplateVars({}); }}
                className="text-slate-400"
              >
                ← Back to templates
              </Button>
              
              <div className="p-3 rounded-lg bg-slate-800 text-sm font-mono whitespace-pre-wrap">
                {selectedTemplate.template}
              </div>
              
              {Object.keys(templateVars).length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-400">Fill in the variables:</p>
                  {Object.keys(templateVars).map(varName => (
                    <div key={varName}>
                      <Label className="text-slate-300 text-xs">{varName}</Label>
                      <Input
                        value={templateVars[varName]}
                        onChange={(e) => setTemplateVars(prev => ({ ...prev, [varName]: e.target.value }))}
                        className="mt-1 bg-slate-800 border-slate-600 text-white"
                        placeholder={`Enter ${varName}...`}
                      />
                    </div>
                  ))}
                </div>
              )}
              
              <Button
                onClick={handleSendTemplate}
                disabled={sending}
                className="w-full bg-green-500 hover:bg-green-600"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Send Template
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Chat Dialog */}
      <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-green-400" />
              Start New Chat
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300">Phone Number (with country code)</Label>
              <Input
                value={newChatPhone}
                onChange={(e) => setNewChatPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="mt-1 bg-slate-800 border-slate-600 text-white"
              />
            </div>
            <Button
              onClick={() => {
                if (newChatPhone) {
                  openWhatsAppWeb(newChatPhone);
                  setShowNewChatDialog(false);
                  setNewChatPhone('');
                }
              }}
              className="w-full bg-green-500 hover:bg-green-600"
            >
              <ExternalLink className="h-4 w-4 mr-2" /> Open in WhatsApp
            </Button>
            <p className="text-xs text-slate-400 text-center">
              This will open WhatsApp Web in a new tab
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
