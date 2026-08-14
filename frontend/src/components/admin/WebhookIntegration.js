import React, { useState } from 'react';
import { 
  Webhook, Copy, ExternalLink, CheckCircle, AlertTriangle,
  Facebook, MessageSquare, Mail, Phone, Building2, Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function WebhookIntegration() {
  const [copiedUrl, setCopiedUrl] = useState(null);
  
  const backendUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;
  
  const webhookEndpoints = [
    {
      id: 'facebook',
      name: 'Facebook Lead Ads',
      nameHi: '',
      icon: Facebook,
      color: 'blue',
      endpoint: `${backendUrl}/api/crm/leads/webhook/facebook`,
      method: 'POST',
      description: 'Receive leads from Facebook Lead Ads campaigns',
      setupSteps: [
        'Go to Facebook Business Manager → Events Manager',
        'Create a new Custom Integration',
        'Set Webhook URL to the endpoint above',
        'Subscribe to "leadgen" events',
        'Test with a sample lead form submission'
      ],
      samplePayload: {
        name: 'Customer Name',
        email: 'customer@email.com',
        phone: '+919876543210',
        requirements: 'Interested in helicopter booking'
      }
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp Business',
      nameHi: '',
      icon: MessageSquare,
      color: 'green',
      endpoint: `${backendUrl}/api/crm/leads/webhook/whatsapp`,
      method: 'POST',
      description: 'Receive leads from WhatsApp Business API',
      setupSteps: [
        'Configure WhatsApp Business API',
        'Set up webhook in Meta Developer Portal',
        'Use the endpoint above for message callbacks',
        'Enable message template for lead capture'
      ],
      samplePayload: {
        name: 'WhatsApp User',
        phone: '+919876543210',
        requirements: 'Query received via WhatsApp'
      }
    },
    {
      id: 'indiamart',
      name: 'IndiaMart',
      nameHi: '',
      icon: Building2,
      color: 'orange',
      endpoint: `${backendUrl}/api/crm/leads/webhook/indiamart`,
      method: 'POST',
      description: 'Receive leads from IndiaMart seller dashboard',
      setupSteps: [
        'Login to IndiaMart Seller Dashboard',
        'Go to Lead Manager → Settings',
        'Configure Lead Push API with the endpoint above',
        'Enable real-time lead notifications'
      ],
      samplePayload: {
        name: 'Buyer Name',
        email: 'buyer@company.com',
        phone: '+919876543210',
        company_name: 'ABC Industries',
        city: 'Mumbai',
        requirements: 'Need helicopter for corporate event'
      }
    },
    {
      id: 'justdial',
      name: 'JustDial',
      nameHi: '',
      icon: Phone,
      color: 'red',
      endpoint: `${backendUrl}/api/crm/leads/webhook/justdial`,
      method: 'POST',
      description: 'Receive leads from JustDial business listing',
      setupSteps: [
        'Contact JustDial support for API access',
        'Configure webhook URL in JustDial dashboard',
        'Map lead fields to our payload format'
      ],
      samplePayload: {
        name: 'Caller Name',
        phone: '+919876543210',
        city: 'Delhi',
        requirements: 'Enquiry from JustDial'
      }
    },
    {
      id: 'email',
      name: 'Email Parser',
      nameHi: '',
      icon: Mail,
      color: 'purple',
      endpoint: `${backendUrl}/api/crm/leads/webhook/email`,
      method: 'POST',
      description: 'Parse and create leads from email inquiries',
      setupSteps: [
        'Set up email forwarding to parsing service (Parseur, Mailparser)',
        'Configure parsing rules for customer details',
        'Send parsed data to our webhook endpoint',
        'Or use Zapier/Make for email-to-webhook automation'
      ],
      samplePayload: {
        name: 'Email Sender',
        email: 'customer@gmail.com',
        requirements: 'Extracted from email body'
      }
    },
    {
      id: 'website',
      name: 'Website Form',
      nameHi: '',
      icon: Globe,
      color: 'cyan',
      endpoint: `${backendUrl}/api/crm/leads/webhook/website`,
      method: 'POST',
      description: 'Receive leads from your website contact forms',
      setupSteps: [
        'Add form to your website with required fields',
        'On form submit, POST data to webhook endpoint',
        'Include: name, email, phone, requirements fields'
      ],
      samplePayload: {
        name: 'Website Visitor',
        email: 'visitor@example.com',
        phone: '+919876543210',
        city: 'Bangalore',
        requirements: 'Submitted via website contact form'
      }
    }
  ];

  const colorClasses = {
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(id);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const [expandedCard, setExpandedCard] = useState(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Webhook className="h-6 w-6 text-purple-400" />
          Webhook Integration</h2>
        <p className="text-slate-400 mt-1">
          Connect external lead sources to automatically capture leads in CRM
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-purple-200 font-medium">How Webhooks Work</p>
          <p className="text-purple-200/70 text-sm mt-1">
            When a lead is generated on an external platform (Facebook, WhatsApp, IndiaMart), 
            that platform sends the lead data to our webhook URL. Our system automatically 
            creates a new lead in CRM and assigns it to a sales person.
          </p>
        </div>
      </div>

      {/* Webhook Endpoints Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {webhookEndpoints.map((webhook) => {
          const Icon = webhook.icon;
          const isExpanded = expandedCard === webhook.id;
          
          return (
            <div 
              key={webhook.id}
              className={`rounded-xl border ${colorClasses[webhook.color]} transition-all duration-200`}
            >
              <div 
                className="p-4 cursor-pointer"
                onClick={() => setExpandedCard(isExpanded ? null : webhook.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${colorClasses[webhook.color]} flex items-center justify-center`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">{webhook.name}</h3>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-300">
                    {webhook.method}
                  </span>
                </div>
                <p className="text-slate-400 text-sm mt-3">{webhook.description}</p>
              </div>
              
              {/* Expandable Section */}
              {isExpanded && (
                <div className="border-t border-slate-700 p-4 space-y-4">
                  {/* Endpoint URL */}
                  <div>
                    <label className="text-slate-300 text-sm font-medium">Webhook URL:</label>
                    <div className="flex gap-2 mt-1">
                      <code className="flex-1 p-2 bg-slate-900 rounded text-green-400 text-xs overflow-x-auto">
                        {webhook.endpoint}
                      </code>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => copyToClipboard(webhook.endpoint, webhook.id)}
                      >
                        {copiedUrl === webhook.id ? (
                          <CheckCircle className="h-4 w-4 text-green-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Setup Steps */}
                  <div>
                    <label className="text-slate-300 text-sm font-medium">Setup Steps:</label>
                    <ol className="mt-2 space-y-1">
                      {webhook.setupSteps.map((step, idx) => (
                        <li key={idx} className="text-slate-400 text-sm flex gap-2">
                          <span className="text-orange-400">{idx + 1}.</span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                  
                  {/* Sample Payload */}
                  <div>
                    <label className="text-slate-300 text-sm font-medium">Sample Payload:</label>
                    <pre className="mt-1 p-3 bg-slate-900 rounded text-xs text-slate-300 overflow-x-auto">
                      {JSON.stringify(webhook.samplePayload, null, 2)}
                    </pre>
                  </div>
                  
                  {/* Test Button */}
                  <Button 
                    size="sm" 
                    className="w-full bg-slate-700 hover:bg-slate-600"
                    onClick={() => {
                      copyToClipboard(
                        `curl -X POST "${webhook.endpoint}" -H "Content-Type: application/json" -d '${JSON.stringify(webhook.samplePayload)}'`,
                        `curl-${webhook.id}`
                      );
                      toast.success('cURL command copied! Test in terminal.');
                    }}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy cURL Test Command
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Testing Section */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h3 className="text-white font-semibold mb-4">Quick Test</h3>
        <p className="text-slate-400 text-sm mb-4">
          Use this cURL command in terminal to test webhook lead creation:
        </p>
        <div className="relative">
          <pre className="p-4 bg-slate-900 rounded-lg text-green-400 text-xs overflow-x-auto">
{`curl -X POST "${backendUrl}/api/crm/leads/webhook/website" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Test Lead",
    "email": "test@example.com",
    "phone": "+919876543210",
    "city": "Mumbai",
    "requirements": "Test webhook integration"
  }'`}
          </pre>
          <Button 
            size="sm" 
            className="absolute top-2 right-2"
            variant="outline"
            onClick={() => copyToClipboard(
              `curl -X POST "${backendUrl}/api/crm/leads/webhook/website" -H "Content-Type: application/json" -d '{"name": "Test Lead", "email": "test@example.com", "phone": "+919876543210", "city": "Mumbai", "requirements": "Test webhook integration"}'`,
              'test-curl'
            )}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Zapier/Make Integration */}
      <div className="bg-gradient-to-br from-orange-500/10 to-purple-500/10 rounded-xl p-6 border border-orange-500/30">
        <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
          <ExternalLink className="h-5 w-5 text-orange-400" />
          No-Code Integration with Zapier / Make
        </h3>
        <p className="text-slate-400 text-sm mb-4">
          If a platform doesn't support webhooks directly, use Zapier or Make (Integromat) 
          to connect it to our CRM:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a 
            href="https://zapier.com/apps/webhooks/integrations" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition"
          >
            <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <span className="text-xl">⚡</span>
            </div>
            <div>
              <p className="text-white font-medium">Zapier</p>
              <p className="text-slate-400 text-xs">Connect 5000+ apps</p>
            </div>
            <ExternalLink className="h-4 w-4 text-slate-500 ml-auto" />
          </a>
          <a 
            href="https://www.make.com/en/integrations/http" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition"
          >
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <span className="text-xl">🔮</span>
            </div>
            <div>
              <p className="text-white font-medium">Make (Integromat)</p>
              <p className="text-slate-400 text-xs">Visual automation builder</p>
            </div>
            <ExternalLink className="h-4 w-4 text-slate-500 ml-auto" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default WebhookIntegration;
