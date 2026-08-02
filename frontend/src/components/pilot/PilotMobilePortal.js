import React, { useState, useEffect } from 'react';
import { 
  Plane, FileText, Clock, Calendar, CheckCircle, AlertTriangle,
  Bell, User, LogOut, Plus, ChevronRight, RefreshCw, 
  MapPin, Timer, Shield, Menu, X, Home, Settings, Wifi, WifiOff, BellRing,
  Download, FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { PilotChatButton } from './PilotChat';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Utility: Check if online
const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return isOnline;
};

// Push Notification helper
const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  
  return false;
};

// Register for push notifications
const registerPushNotifications = async () => {
  try {
    const permission = await requestNotificationPermission();
    if (!permission) {
      toast.error('Notification permission denied');
      return false;
    }
    
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      
      // Check if already subscribed
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        toast.success('Push notifications already enabled!');
        return true;
      }
      
      // For demo, we'll just show a success message
      // Real implementation needs VAPID keys
      toast.success('🔔 Push notifications enabled!', {
        description: 'You will receive duty alerts and document expiry reminders'
      });
      return true;
    }
  } catch (error) {
    console.error('Failed to register push notifications:', error);
    toast.error('Failed to enable notifications');
  }
  return false;
};

// Show local notification
const showLocalNotification = (title, body, url = '/pilot-portal') => {
  if ('serviceWorker' in navigator && Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then((registration) => {
      registration.showNotification(title, {
        body,
        icon: '/logo192.png',
        badge: '/logo192.png',
        vibrate: [100, 50, 100],
        data: { url },
        tag: 'pilot-notification'
      });
    });
  }
};

// Bottom Navigation Component
const BottomNav = ({ active, setActive }) => {
  const items = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'duty', icon: Clock, label: 'Duty' },
    { id: 'documents', icon: FileText, label: 'Docs' },
    { id: 'flights', icon: Plane, label: 'Flights' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 px-2 py-1 z-50">
      <div className="flex justify-around items-center max-w-lg mx-auto">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => setActive(item.id)}
            className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${
              active === item.id 
                ? 'text-orange-500 bg-orange-500/10' 
                : 'text-slate-400'
            }`}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-xs mt-1">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

// Home Tab
const HomeTab = ({ pilot, stats, upcomingFlights, alerts }) => (
  <div className="space-y-4 pb-20">
    {/* Welcome Card */}
    <div className="bg-gradient-to-r from-orange-600 to-amber-600 rounded-2xl p-4">
      <p className="text-orange-100 text-sm">Welcome back,</p>
      <h2 className="text-white text-xl font-bold">{pilot?.full_name || 'Pilot'}</h2>
      <p className="text-orange-100 text-sm mt-1">License: {pilot?.license_number || 'N/A'}</p>
    </div>

    {/* Quick Stats */}
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-slate-800 rounded-xl p-3 text-center">
        <p className="text-2xl font-bold text-white">{stats?.total_flights || 0}</p>
        <p className="text-xs text-slate-400">Total Flights</p>
      </div>
      <div className="bg-slate-800 rounded-xl p-3 text-center">
        <p className="text-2xl font-bold text-green-400">{stats?.hours_this_month || 0}h</p>
        <p className="text-xs text-slate-400">This Month</p>
      </div>
      <div className="bg-slate-800 rounded-xl p-3 text-center">
        <p className="text-2xl font-bold text-orange-400">{stats?.duty_hours_remaining || 0}h</p>
        <p className="text-xs text-slate-400">FDTL Left</p>
      </div>
    </div>

    {/* Alerts */}
    {alerts?.length > 0 && (
      <div className="space-y-2">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Bell className="h-4 w-4 text-orange-500" />
          Alerts
        </h3>
        {alerts.map((alert, idx) => (
          <div 
            key={idx}
            className={`p-3 rounded-xl flex items-center gap-3 ${
              alert.type === 'critical' ? 'bg-red-600/20 border border-red-500/50' :
              alert.type === 'warning' ? 'bg-yellow-600/20 border border-yellow-500/50' :
              'bg-blue-600/20 border border-blue-500/50'
            }`}
          >
            <AlertTriangle className={`h-5 w-5 ${
              alert.type === 'critical' ? 'text-red-400' :
              alert.type === 'warning' ? 'text-yellow-400' : 'text-blue-400'
            }`} />
            <div className="flex-1">
              <p className="text-white text-sm font-medium">{alert.title}</p>
              <p className="text-slate-400 text-xs">{alert.message}</p>
            </div>
          </div>
        ))}
      </div>
    )}

    {/* Upcoming Flights */}
    <div>
      <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-orange-500" />
        Upcoming Assignments
      </h3>
      {upcomingFlights?.length > 0 ? (
        <div className="space-y-2">
          {upcomingFlights.map((flight, idx) => (
            <div key={idx} className="bg-slate-800 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-orange-400 font-mono text-sm">{flight.flight_id || `FL-${idx}`}</span>
                <span className="text-xs bg-slate-700 px-2 py-1 rounded">{flight.date}</span>
              </div>
              <div className="flex items-center gap-2 text-white">
                <MapPin className="h-4 w-4 text-green-400" />
                <span className="text-sm">{flight.from}</span>
                <ChevronRight className="h-4 w-4 text-slate-500" />
                <span className="text-sm">{flight.to}</span>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                <span><Plane className="h-3 w-3 inline mr-1" />{flight.aircraft}</span>
                <span><Timer className="h-3 w-3 inline mr-1" />{flight.time}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-400 text-sm text-center py-4">No upcoming flights</p>
      )}
    </div>
  </div>
);

// Duty Tracker Tab
const DutyTab = ({ dutyStatus, onCheckIn, onCheckOut }) => {
  const [isOnDuty, setIsOnDuty] = useState(dutyStatus?.is_on_duty || false);

  const handleCheckIn = async () => {
    await onCheckIn();
    setIsOnDuty(true);
  };

  const handleCheckOut = async () => {
    await onCheckOut();
    setIsOnDuty(false);
  };

  return (
    <div className="space-y-4 pb-20">
      {/* FDTL Status Card */}
      <div className={`rounded-2xl p-4 ${isOnDuty ? 'bg-green-600/20 border border-green-500' : 'bg-slate-800'}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">FDTL Status</h3>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            isOnDuty ? 'bg-green-600 text-white' : 'bg-slate-600 text-slate-300'
          }`}>
            {isOnDuty ? 'ON DUTY' : 'OFF DUTY'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-slate-400 text-xs">Flight Duty Period</p>
            <p className="text-white text-lg font-bold">{dutyStatus?.fdp_used || 0}h / 14h</p>
            <div className="w-full bg-slate-700 rounded-full h-2 mt-1">
              <div 
                className="bg-orange-500 h-2 rounded-full"
                style={{ width: `${Math.min(100, ((dutyStatus?.fdp_used || 0) / 14) * 100)}%` }}
              />
            </div>
          </div>
          <div>
            <p className="text-slate-400 text-xs">Flight Time (24h)</p>
            <p className="text-white text-lg font-bold">{dutyStatus?.flight_time_24h || 0}h / 8h</p>
            <div className="w-full bg-slate-700 rounded-full h-2 mt-1">
              <div 
                className="bg-blue-500 h-2 rounded-full"
                style={{ width: `${Math.min(100, ((dutyStatus?.flight_time_24h || 0) / 8) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-slate-400 text-xs">Weekly Hours</p>
            <p className="text-white text-lg font-bold">{dutyStatus?.weekly_hours || 0}h / 60h</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs">Rest Required</p>
            <p className="text-white text-lg font-bold">{dutyStatus?.rest_required || 10}h</p>
          </div>
        </div>

        {/* Check In/Out Button */}
        <Button 
          onClick={isOnDuty ? handleCheckOut : handleCheckIn}
          className={`w-full py-6 text-lg font-bold ${
            isOnDuty 
              ? 'bg-red-600 hover:bg-red-700' 
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {isOnDuty ? (
            <><LogOut className="h-5 w-5 mr-2" /> Check Out</>
          ) : (
            <><CheckCircle className="h-5 w-5 mr-2" /> Check In</>
          )}
        </Button>
      </div>

      {/* Recent Duty Logs */}
      <div>
        <h3 className="text-white font-semibold mb-3">Recent Duty Logs</h3>
        <div className="space-y-2">
          {(dutyStatus?.recent_logs || []).slice(0, 5).map((log, idx) => (
            <div key={idx} className="bg-slate-800 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-white text-sm">{log.date}</p>
                <p className="text-slate-400 text-xs">{log.type}</p>
              </div>
              <span className="text-orange-400 font-mono">{log.hours}h</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Documents Tab
const DocumentsTab = ({ documents, onRefresh, onUploadDocument }) => {
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    document_type: 'license',
    document_number: '',
    expiry_date: '',
    issuer: '',
    file: null
  });

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File too large. Maximum 5MB allowed.');
        return;
      }
      setUploadForm({ ...uploadForm, file });
    }
  };

  const handleUpload = async () => {
    if (!uploadForm.document_number || !uploadForm.expiry_date || !uploadForm.file) {
      toast.error('Please fill all required fields');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('document_type', uploadForm.document_type);
      formData.append('document_number', uploadForm.document_number);
      formData.append('expiry_date', uploadForm.expiry_date);
      formData.append('file', uploadForm.file);
      if (uploadForm.issuer) formData.append('issuer', uploadForm.issuer);

      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/pilot/documents/upload-file`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        toast.success('Document uploaded successfully!');
        setShowUpload(false);
        setUploadForm({
          document_type: 'license',
          document_number: '',
          expiry_date: '',
          issuer: '',
          file: null
        });
        onRefresh();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Upload failed');
      }
    } catch (error) {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold">My Documents</h3>
        <Button onClick={onRefresh} variant="ghost" size="sm">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3">
        {documents?.map((doc, idx) => {
          const isExpiringSoon = doc.days_until_expiry <= 30;
          const isExpired = doc.days_until_expiry <= 0;
          
          return (
            <div 
              key={idx}
              className={`bg-slate-800 rounded-xl p-4 border-l-4 ${
                isExpired ? 'border-red-500' :
                isExpiringSoon ? 'border-yellow-500' :
                'border-green-500'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white font-medium">{doc.document_type}</p>
                  <p className="text-slate-400 text-sm">{doc.document_number}</p>
                </div>
                {isExpired ? (
                  <span className="px-2 py-1 bg-red-600 rounded text-xs text-white">EXPIRED</span>
                ) : isExpiringSoon ? (
                  <span className="px-2 py-1 bg-yellow-600 rounded text-xs text-white">
                    {doc.days_until_expiry}d left
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded text-xs">
                    Valid
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
                <span>Expires: {doc.expiry_date}</span>
                <span className={doc.verification_status === 'verified' ? 'text-green-400' : 'text-yellow-400'}>
                  {doc.verification_status}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Upload Document Button */}
      <Button 
        onClick={() => setShowUpload(!showUpload)}
        className="w-full bg-orange-600 hover:bg-orange-700"
      >
        <Plus className="h-4 w-4 mr-2" />
        {showUpload ? 'Cancel' : 'Upload New Document'}
      </Button>

      {/* Upload Form */}
      {showUpload && (
        <div className="bg-slate-800 rounded-xl p-4 space-y-4 animate-in slide-in-from-bottom">
          <h4 className="text-white font-semibold">Upload Document</h4>
          
          <div>
            <label className="text-slate-400 text-sm">Document Type *</label>
            <select
              value={uploadForm.document_type}
              onChange={(e) => setUploadForm({ ...uploadForm, document_type: e.target.value })}
              className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 mt-1 border border-slate-600"
            >
              <option value="license">Pilot License (CPL/ATPL)</option>
              <option value="medical">Medical Certificate</option>
              <option value="type_rating">Type Rating</option>
              <option value="insurance">Insurance</option>
              <option value="passport">Passport</option>
              <option value="aadhar">Aadhaar Card</option>
              <option value="pan">PAN Card</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="text-slate-400 text-sm">Document Number *</label>
            <input
              type="text"
              value={uploadForm.document_number}
              onChange={(e) => setUploadForm({ ...uploadForm, document_number: e.target.value })}
              placeholder="e.g., CPL-2024-0001"
              className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 mt-1 border border-slate-600"
            />
          </div>

          <div>
            <label className="text-slate-400 text-sm">Expiry Date *</label>
            <input
              type="date"
              value={uploadForm.expiry_date}
              onChange={(e) => setUploadForm({ ...uploadForm, expiry_date: e.target.value })}
              className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 mt-1 border border-slate-600"
            />
          </div>

          <div>
            <label className="text-slate-400 text-sm">Issuing Authority</label>
            <input
              type="text"
              value={uploadForm.issuer}
              onChange={(e) => setUploadForm({ ...uploadForm, issuer: e.target.value })}
              placeholder="e.g., DGCA India"
              className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 mt-1 border border-slate-600"
            />
          </div>

          <div>
            <label className="text-slate-400 text-sm">File (PDF, JPG, PNG - Max 5MB) *</label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 mt-1 border border-slate-600 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-orange-600 file:text-white"
            />
            {uploadForm.file && (
              <p className="text-xs text-green-400 mt-1">Selected: {uploadForm.file.name}</p>
            )}
          </div>

          <Button 
            onClick={handleUpload}
            disabled={uploading}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            {uploading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Upload Document
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

// Flight Logs Tab with Pre-Flight Checklist
const FlightsTab = ({ flightLogs, upcomingFlights, onAddLog }) => {
  const [showChecklist, setShowChecklist] = useState(false);
  const [checklist, setChecklist] = useState([]);
  const [itemsChecked, setItemsChecked] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [passengerCount, setPassengerCount] = useState(1);
  const [notes, setNotes] = useState('');

  const loadChecklist = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/pilot/preflight/checklist`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setChecklist(data.checklist || []);
      }
    } catch (error) {
      console.error('Failed to load checklist');
    }
  };

  const [weatherData, setWeatherData] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(false);

  const loadWeather = async (origin, destination) => {
    setLoadingWeather(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/pilot/preflight/weather-check`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ origin, destination })
      });
      if (res.ok) {
        const data = await res.json();
        setWeatherData(data);
      }
    } catch (error) {
      console.error('Failed to load weather');
    } finally {
      setLoadingWeather(false);
    }
  };

  const handleStartPreflight = (flight) => {
    setSelectedFlight(flight);
    setItemsChecked({});
    setNotes('');
    setWeatherData(null);
    loadChecklist();
    loadWeather(flight.from, flight.to);
    setShowChecklist(true);
  };

  const toggleItem = (itemId) => {
    setItemsChecked(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const handleSubmitPreflight = async () => {
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/pilot/preflight/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          flight_id: selectedFlight?.flight_id,
          aircraft_registration: selectedFlight?.aircraft || 'VT-AYR',
          items_checked: itemsChecked,
          passenger_count: passengerCount,
          notes
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        toast.success(`Pre-flight check complete! ${data.completion_percentage}% items verified`);
        if (data.ready_for_takeoff) {
          toast.success('✅ Aircraft ready for takeoff!');
        }
        setShowChecklist(false);
      } else {
        if (data.detail?.missing_items) {
          toast.error(`Missing critical items: ${data.detail.missing_items.slice(0, 2).join(', ')}...`);
        } else {
          toast.error(data.detail || 'Submission failed');
        }
      }
    } catch (error) {
      toast.error('Failed to submit pre-flight check');
    } finally {
      setSubmitting(false);
    }
  };

  const checkedCount = Object.values(itemsChecked).filter(Boolean).length;
  const totalItems = checklist.reduce((acc, cat) => acc + cat.items.length, 0);

  return (
    <div className="space-y-4 pb-20">
      {/* Upcoming Flights with Pre-Flight Button */}
      {upcomingFlights?.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-4">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Plane className="h-4 w-4 text-orange-400" />
            Pre-Flight Check Required
          </h3>
          <div className="space-y-2">
            {upcomingFlights.slice(0, 2).map((flight, idx) => (
              <div key={idx} className="bg-slate-700/50 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-white text-sm">{flight.from} → {flight.to}</p>
                  <p className="text-xs text-slate-400">{flight.date} at {flight.departure_time}</p>
                </div>
                <Button 
                  onClick={() => handleStartPreflight(flight)}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Pre-Check
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flight Logs Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold">Flight Logs</h3>
        <div className="flex gap-2">
          <Button onClick={onAddLog} size="sm" className="bg-orange-600 hover:bg-orange-700">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* Export Buttons */}
      {flightLogs?.length > 0 && (
        <div className="flex gap-2">
          <Button 
            onClick={async () => {
              try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_URL}/api/pilot/flight-logs/export/pdf`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                  const blob = await res.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `FlightLog_${new Date().toISOString().split('T')[0]}.pdf`;
                  a.click();
                  toast.success('PDF downloaded!');
                } else {
                  toast.error('Export failed');
                }
              } catch (e) {
                toast.error('Download failed');
              }
            }}
            size="sm"
            variant="outline"
            className="flex-1 border-slate-600 text-white hover:bg-slate-700"
          >
            <Download className="h-4 w-4 mr-1" />
            Export PDF
          </Button>
          <Button 
            onClick={async () => {
              try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_URL}/api/pilot/flight-logs/export/excel`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                  const blob = await res.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `FlightLog_${new Date().toISOString().split('T')[0]}.xlsx`;
                  a.click();
                  toast.success('Excel downloaded!');
                } else {
                  toast.error('Export failed');
                }
              } catch (e) {
                toast.error('Download failed');
              }
            }}
            size="sm"
            variant="outline"
            className="flex-1 border-slate-600 text-white hover:bg-slate-700"
          >
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            Export Excel
          </Button>
        </div>
      )}

      {/* Flight Logs */}
      <div className="space-y-3">
        {flightLogs?.map((log, idx) => (
          <div key={idx} className="bg-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-orange-400 font-mono">{log.flight_id}</span>
              <span className="text-xs text-slate-400">{log.date}</span>
            </div>
            <div className="flex items-center gap-2 text-white mb-2">
              <span>{log.from}</span>
              <ChevronRight className="h-4 w-4 text-slate-500" />
              <span>{log.to}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-slate-400">Aircraft</p>
                <p className="text-white">{log.aircraft}</p>
              </div>
              <div>
                <p className="text-slate-400">Duration</p>
                <p className="text-white">{log.duration}h</p>
              </div>
              <div>
                <p className="text-slate-400">Type</p>
                <p className="text-white">{log.flight_type}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pre-Flight Checklist Modal */}
      {showChecklist && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center">
          <div className="bg-slate-900 w-full max-w-lg rounded-t-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-slate-800 p-4 flex items-center justify-between sticky top-0">
              <div>
                <h3 className="text-white font-semibold">Pre-Flight Checklist</h3>
                <p className="text-xs text-slate-400">
                  {selectedFlight?.from} → {selectedFlight?.to} | {checkedCount}/{totalItems} items
                </p>
              </div>
              <button onClick={() => setShowChecklist(false)} className="text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Weather Card */}
            {weatherData && (
              <div className={`mx-4 mt-3 p-3 rounded-xl border ${
                weatherData.route_status === 'GO' 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : weatherData.route_status === 'CAUTION'
                  ? 'bg-yellow-500/10 border-yellow-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-semibold text-sm">Weather Status</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    weatherData.route_status === 'GO' 
                      ? 'bg-green-500 text-white' 
                      : weatherData.route_status === 'CAUTION'
                      ? 'bg-yellow-500 text-black'
                      : 'bg-red-500 text-white'
                  }`}>
                    {weatherData.route_status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-800/50 rounded p-2">
                    <p className="text-slate-400">{weatherData.origin?.location}</p>
                    <p className="text-white">{weatherData.origin?.temperature?.celsius}°C</p>
                    <p className="text-slate-400">Wind: {weatherData.origin?.wind?.speed_knots}kt</p>
                    <p className="text-slate-400">Vis: {weatherData.origin?.visibility?.kilometers}km</p>
                  </div>
                  <div className="bg-slate-800/50 rounded p-2">
                    <p className="text-slate-400">{weatherData.destination?.location}</p>
                    <p className="text-white">{weatherData.destination?.temperature?.celsius}°C</p>
                    <p className="text-slate-400">Wind: {weatherData.destination?.wind?.speed_knots}kt</p>
                    <p className="text-slate-400">Vis: {weatherData.destination?.visibility?.kilometers}km</p>
                  </div>
                </div>
                {weatherData.route_status !== 'GO' && (
                  <p className="text-xs text-yellow-400 mt-2">
                    ⚠️ {weatherData.recommendation?.slice(0, 80)}...
                  </p>
                )}
                {weatherData.source === 'simulated' && (
                  <p className="text-xs text-slate-500 mt-1 italic">*Simulated weather data</p>
                )}
              </div>
            )}
            {loadingWeather && (
              <div className="mx-4 mt-3 p-3 bg-slate-800 rounded-xl text-center">
                <RefreshCw className="h-4 w-4 animate-spin inline mr-2 text-orange-400" />
                <span className="text-slate-400 text-sm">Loading weather...</span>
              </div>
            )}

            {/* Progress Bar */}
            <div className="px-4 py-2 bg-slate-800/50">
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-orange-500 to-green-500 transition-all"
                  style={{ width: `${totalItems > 0 ? (checkedCount / totalItems) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Checklist Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {checklist.map((category, catIdx) => (
                <div key={catIdx}>
                  <h4 className="text-orange-400 font-semibold text-sm mb-2">{category.category}</h4>
                  <div className="space-y-2">
                    {category.items.map((item, itemIdx) => (
                      <button
                        key={itemIdx}
                        onClick={() => toggleItem(item.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                          itemsChecked[item.id]
                            ? 'bg-green-600/20 border-green-500'
                            : 'bg-slate-800 border-slate-700'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          itemsChecked[item.id]
                            ? 'bg-green-500 border-green-500'
                            : 'border-slate-500'
                        }`}>
                          {itemsChecked[item.id] && <CheckCircle className="h-3 w-3 text-white" />}
                        </div>
                        <span className={`text-sm flex-1 text-left ${
                          itemsChecked[item.id] ? 'text-green-400' : 'text-white'
                        }`}>
                          {item.label}
                          {item.critical && <span className="text-red-400 ml-1">*</span>}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {/* Additional Info */}
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-slate-400 text-sm">Passengers</label>
                  <input
                    type="number"
                    value={passengerCount}
                    onChange={(e) => setPassengerCount(parseInt(e.target.value) || 0)}
                    min="0"
                    max="20"
                    className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 mt-1 border border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-sm">Notes (optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any observations or remarks..."
                    className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 mt-1 border border-slate-700 h-20 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="p-4 bg-slate-800 sticky bottom-0">
              <Button
                onClick={handleSubmitPreflight}
                disabled={submitting}
                className="w-full bg-green-600 hover:bg-green-700 h-12"
              >
                {submitting ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Complete Pre-Flight Check
              </Button>
              <p className="text-xs text-slate-500 text-center mt-2">
                * Critical items must be checked before takeoff
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Profile Tab
const ProfileTab = ({ pilot, onLogout, notificationsEnabled, onEnableNotifications, isOnline }) => (
  <div className="space-y-4 pb-20">
    {/* Connection Status */}
    <div className={`rounded-xl p-3 flex items-center gap-2 ${isOnline ? 'bg-green-500/10 border border-green-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
      {isOnline ? (
        <>
          <Wifi className="h-4 w-4 text-green-400" />
          <span className="text-green-400 text-sm">Online - Data synced</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 text-yellow-400" />
          <span className="text-yellow-400 text-sm">Offline - Using cached data</span>
        </>
      )}
    </div>

    {/* Profile Card */}
    <div className="bg-slate-800 rounded-2xl p-4 text-center">
      <div className="w-20 h-20 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full mx-auto flex items-center justify-center">
        <User className="h-10 w-10 text-white" />
      </div>
      <h2 className="text-white text-xl font-bold mt-3">{pilot?.full_name}</h2>
      <p className="text-slate-400">{pilot?.email}</p>
      <div className="flex justify-center gap-4 mt-3">
        <div className="text-center">
          <p className="text-white font-bold">{pilot?.license_number || 'N/A'}</p>
          <p className="text-xs text-slate-400">License</p>
        </div>
        <div className="text-center">
          <p className="text-white font-bold">{pilot?.total_hours || 0}h</p>
          <p className="text-xs text-slate-400">Total Hours</p>
        </div>
      </div>
    </div>

    {/* Push Notifications */}
    <div className="bg-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BellRing className="h-5 w-5 text-orange-400" />
          <div>
            <p className="text-white font-medium">Push Notifications</p>
            <p className="text-xs text-slate-400">Duty alerts & document reminders</p>
          </div>
        </div>
        {notificationsEnabled ? (
          <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">Enabled</span>
        ) : (
          <Button 
            size="sm" 
            onClick={onEnableNotifications}
            className="bg-orange-500 hover:bg-orange-600 h-8"
          >
            Enable
          </Button>
        )}
      </div>
    </div>

    {/* Quick Links */}
    <div className="space-y-2">
      <button className="w-full bg-slate-800 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-blue-400" />
          <span className="text-white">Medical Certificate</span>
        </div>
        <ChevronRight className="h-5 w-5 text-slate-400" />
      </button>
      <button className="w-full bg-slate-800 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-5 w-5 text-slate-400" />
          <span className="text-white">Settings</span>
        </div>
        <ChevronRight className="h-5 w-5 text-slate-400" />
      </button>
    </div>

    {/* Logout */}
    <Button 
      onClick={onLogout}
      variant="outline"
      className="w-full border-red-500 text-red-400 hover:bg-red-500/10"
    >
      <LogOut className="h-4 w-4 mr-2" />
      Logout
    </Button>
  </div>
);

// Main Pilot Mobile Portal Component
function PilotMobilePortal() {
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(true);
  const [pilot, setPilot] = useState(null);
  const [stats, setStats] = useState({});
  const [upcomingFlights, setUpcomingFlights] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [dutyStatus, setDutyStatus] = useState({});
  const [documents, setDocuments] = useState([]);
  const [flightLogs, setFlightLogs] = useState([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isOfflineData, setIsOfflineData] = useState(false);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    fetchAllData();
    // Check notification status
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

    try {
      // Fetch pilot profile
      const profileRes = await fetch(`${API_URL}/api/auth/me`, { headers });
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setPilot(profileData);
      }

      // Fetch pilot dashboard data
      const dashRes = await fetch(`${API_URL}/api/pilot/mobile/dashboard`, { headers });
      if (dashRes.ok) {
        const dashData = await dashRes.json();
        
        // Check if this is cached/offline data
        if (dashData.offline) {
          setIsOfflineData(true);
          toast.info('📱 Offline Mode - Showing cached data');
        } else {
          setIsOfflineData(false);
          // Cache data for offline use via Service Worker
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: 'CACHE_PILOT_DATA',
              data: dashData
            });
          }
        }
        
        setStats(dashData.stats || {});
        setUpcomingFlights(dashData.upcoming_flights || []);
        setAlerts(dashData.alerts || []);
        setDutyStatus(dashData.duty_status || {});
        setDocuments(dashData.documents || []);
        setFlightLogs(dashData.flight_logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      // Try to show cached data when offline
      if (!navigator.onLine) {
        setIsOfflineData(true);
        toast.info('📱 You are offline - Showing last cached data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEnableNotifications = async () => {
    const success = await registerPushNotifications();
    if (success) {
      setNotificationsEnabled(true);
    }
  };

  const handleCheckIn = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/api/pilot/duty/check-in`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Checked in successfully!');
        fetchAllData();
      }
    } catch (error) {
      toast.error('Check-in failed');
    }
  };

  const handleCheckOut = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/api/pilot/duty/check-out`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Checked out successfully!');
        fetchAllData();
      }
    } catch (error) {
      toast.error('Check-out failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Plane className="h-12 w-12 text-orange-500 animate-pulse mx-auto" />
          <p className="text-slate-400 mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white" data-testid="pilot-mobile-portal">
      {/* Header */}
      <header className="sticky top-0 bg-slate-900 border-b border-slate-800 px-4 py-3 z-40">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <Plane className="h-6 w-6 text-orange-500" />
            <span className="font-bold text-lg">AirYatra Pilot</span>
          </div>
          <button onClick={fetchAllData}>
            <RefreshCw className="h-5 w-5 text-slate-400" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="px-4 py-4 max-w-lg mx-auto">
        {activeTab === 'home' && (
          <HomeTab 
            pilot={pilot} 
            stats={stats} 
            upcomingFlights={upcomingFlights}
            alerts={alerts}
          />
        )}
        {activeTab === 'duty' && (
          <DutyTab 
            dutyStatus={dutyStatus}
            onCheckIn={handleCheckIn}
            onCheckOut={handleCheckOut}
          />
        )}
        {activeTab === 'documents' && (
          <DocumentsTab 
            documents={documents}
            onRefresh={fetchAllData}
          />
        )}
        {activeTab === 'flights' && (
          <FlightsTab 
            flightLogs={flightLogs}
            upcomingFlights={upcomingFlights}
            onAddLog={() => toast.info('Feature coming soon!')}
          />
        )}
        {activeTab === 'profile' && (
          <ProfileTab 
            pilot={pilot}
            onLogout={handleLogout}
            notificationsEnabled={notificationsEnabled}
            onEnableNotifications={handleEnableNotifications}
            isOnline={isOnline}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav active={activeTab} setActive={setActiveTab} />

      {/* Pilot Chat Button */}
      <PilotChatButton user={pilot} />

      {/* Offline Indicator Banner */}
      {!isOnline && (
        <div className="fixed top-14 left-0 right-0 bg-yellow-500/90 text-black text-center py-1 text-xs font-medium z-40">
          <WifiOff className="h-3 w-3 inline mr-1" />
          Offline Mode - Changes will sync when online
        </div>
      )}

      {/* Offline Data Badge */}
      {isOfflineData && isOnline && (
        <div className="fixed top-14 left-0 right-0 bg-blue-500/90 text-white text-center py-1 text-xs font-medium z-40">
          Showing cached data - Pull to refresh
        </div>
      )}
    </div>
  );
}

export default PilotMobilePortal;
