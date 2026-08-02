/**
 * CRM Components Index
 * Export all CRM-related components for easy importing
 */

export { default as CRMStatsCards } from './CRMStatsCards';
export { default as CRMLeadsList } from './CRMLeadsList';
export { default as CRMLeadModal } from './CRMLeadModal';

// Status and Priority configurations
export const statusConfig = {
  new: { color: 'bg-blue-500', label: 'New' },
  contacted: { color: 'bg-yellow-500', label: 'Contacted' },
  qualified: { color: 'bg-purple-500', label: 'Qualified' },
  proposal_sent: { color: 'bg-indigo-500', label: 'Proposal Sent' },
  negotiation: { color: 'bg-orange-500', label: 'Negotiation' },
  won: { color: 'bg-green-500', label: 'Won' },
  lost: { color: 'bg-red-500', label: 'Lost' },
  follow_up: { color: 'bg-cyan-500', label: 'Follow Up' },
  not_interested: { color: 'bg-gray-500', label: 'Not Interested' },
};

export const priorityConfig = {
  hot: { color: 'bg-red-500', label: '🔥 Hot' },
  warm: { color: 'bg-orange-500', label: '☀️ Warm' },
  cold: { color: 'bg-blue-500', label: '❄️ Cold' },
};

export const sourceIcons = {
  facebook: '📘', whatsapp: '💬', email: '📧', gmail: '📩',
  indiamart: '🏭', justdial: '📞', sulekha: '🔍', website: '🌐',
  referral: '👥', walk_in: '🚶', phone_inquiry: '📱', other: '📝',
};
