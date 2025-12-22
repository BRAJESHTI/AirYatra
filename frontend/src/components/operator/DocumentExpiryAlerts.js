import React, { useState, useEffect } from 'react';
import { AlertTriangle, FileText, Calendar, User, Plane, ChevronRight } from 'lucide-react';
import { pilotDocumentAPI, aircraftDocumentAPI } from '../../services/api';
import { toast } from 'sonner';

function DocumentExpiryAlerts() {
  const [expiringPilotDocs, setExpiringPilotDocs] = useState([]);
  const [expiringAircraftDocs, setExpiringAircraftDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExpiringDocuments();
  }, []);

  const fetchExpiringDocuments = async () => {
    try {
      const [pilotRes, aircraftRes] = await Promise.all([
        pilotDocumentAPI.getExpiringDocuments(),
        aircraftDocumentAPI.getExpiringDocuments()
      ]);
      setExpiringPilotDocs(pilotRes.data.documents || []);
      setExpiringAircraftDocs(aircraftRes.data.documents || []);
    } catch (error) {
      console.error('Failed to load expiring documents');
    } finally {
      setLoading(false);
    }
  };

  const getDaysUntilExpiry = (expiryDate) => {
    if (!expiryDate) return null;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getUrgencyClass = (days) => {
    if (days <= 7) return 'bg-red-500/20 border-red-500/30 text-red-400';
    if (days <= 14) return 'bg-orange-500/20 border-orange-500/30 text-orange-400';
    return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400';
  };

  const totalExpiring = expiringPilotDocs.length + expiringAircraftDocs.length;

  if (loading) {
    return (
      <div className="glass p-4 rounded-lg">
        <p className="text-slate-400">Loading alerts...</p>
      </div>
    );
  }

  if (totalExpiring === 0) {
    return null; // Don't show widget if no expiring documents
  }

  return (
    <div className="glass p-4 rounded-lg border-l-4 border-orange-500" data-testid="document-alerts">
      <div className="flex items-center space-x-2 mb-4">
        <AlertTriangle className="h-5 w-5 text-orange-500" />
        <h3 className="text-lg font-semibold text-white">Document Expiry Alerts</h3>
        <span className="px-2 py-0.5 bg-orange-500/20 rounded-full text-orange-400 text-sm">
          {totalExpiring}
        </span>
      </div>

      <div className="space-y-3 max-h-64 overflow-y-auto">
        {/* Pilot Documents */}
        {expiringPilotDocs.map((doc) => {
          const days = getDaysUntilExpiry(doc.expiry_date);
          return (
            <div
              key={doc.id}
              className={`p-3 rounded-lg border ${getUrgencyClass(days)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4" />
                  <div>
                    <p className="font-medium text-white">{doc.pilot_name || 'Pilot'}</p>
                    <p className="text-sm opacity-80">{doc.document_type?.replace(/_/g, ' ')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {days <= 0 ? 'Expired!' : `${days} days`}
                  </p>
                  <p className="text-xs opacity-70">
                    {new Date(doc.expiry_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {/* Aircraft Documents */}
        {expiringAircraftDocs.map((doc) => {
          const days = getDaysUntilExpiry(doc.expiry_date);
          return (
            <div
              key={doc.id}
              className={`p-3 rounded-lg border ${getUrgencyClass(days)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <Plane className="h-4 w-4" />
                  <div>
                    <p className="font-medium text-white">{doc.aircraft_registration || 'Aircraft'}</p>
                    <p className="text-sm opacity-80">{doc.document_type?.replace(/_/g, ' ')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {days <= 0 ? 'Expired!' : `${days} days`}
                  </p>
                  <p className="text-xs opacity-70">
                    {new Date(doc.expiry_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <a
        href="/operator/fleet"
        className="flex items-center justify-center mt-4 text-orange-400 hover:text-orange-300 text-sm"
      >
        View All Documents <ChevronRight className="h-4 w-4 ml-1" />
      </a>
    </div>
  );
}

export default DocumentExpiryAlerts;
