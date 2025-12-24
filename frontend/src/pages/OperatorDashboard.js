import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import { Plane, Home, Building2, Users, FileText, MessageSquare, LogOut, Settings, Fuel, MapPin, Shield, BookOpen, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { operatorAPI } from '../services/api';
import { toast } from 'sonner';
import NotificationBell from '../components/shared/NotificationBell';

// Import operator sub-pages
import OperatorHome from '../components/operator/OperatorHome';
import OperatorOnboarding from '../components/operator/OperatorOnboarding';
import FleetManagement from '../components/operator/FleetManagement';
import InquiryInbox from '../components/operator/InquiryInbox';
import PilotManagement from '../components/operator/PilotManagement';
import FlightRecordsManager from '../components/operator/FlightRecordsManager';
import FuelRecordsManager from '../components/operator/FuelRecordsManager';
import LiveTrackingMap from '../components/operator/LiveTrackingMap';
import LandingPermissionViewer from '../components/operator/LandingPermissionViewer';
import JourneyOTPManager from '../components/operator/JourneyOTPManager';

function OperatorDashboard({ user, onLogout }) {
  const [hasProfile, setHasProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [operator, setOperator] = useState(null);

  useEffect(() => {
    checkProfile();
  }, []);

  const checkProfile = async () => {
    try {
      const response = await operatorAPI.getProfile();
      setHasProfile(response.data.has_profile);
      setOperator(response.data.operator);
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // Show onboarding if no profile
  if (!hasProfile) {
    return <OperatorOnboarding user={user} onComplete={checkProfile} />;
  }

  return (
    <div className="min-h-screen bg-slate-950" data-testid="operator-dashboard">
      {/* Top Navigation */}
      <nav className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Plane className="h-8 w-8 text-orange-500" />
            <span className="text-2xl font-bold text-white">AirYatra Operator</span>
          </div>
          <div className="flex items-center space-x-4">
            <NotificationBell user={user} />
            <div className="text-right">
              <div className="text-white font-medium" data-testid="operator-name">{operator?.company_name}</div>
              <div className="text-slate-400 text-sm" data-testid="verification-status">
                Status: <span className={operator?.status === 'active' ? 'text-green-400' : 'text-orange-400'}>
                  {operator?.status}
                </span>
              </div>
            </div>
            <Button variant="ghost" onClick={onLogout} className="text-white" data-testid="logout-btn">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-slate-900 min-h-screen p-6">
          <nav className="space-y-2">
            <Link to="/operator" className="flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800" data-testid="dashboard-link">
              <Home className="h-5 w-5" />
              <span>Dashboard</span>
            </Link>
            <Link to="/operator/fleet" className="flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800" data-testid="fleet-link">
              <Plane className="h-5 w-5" />
              <span>Fleet Management</span>
            </Link>
            <Link to="/operator/pilots" className="flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800" data-testid="pilots-link">
              <Users className="h-5 w-5" />
              <span>Pilots</span>
            </Link>
            <Link to="/operator/inquiries" className="flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800" data-testid="inquiries-link">
              <MessageSquare className="h-5 w-5" />
              <span>Inquiries</span>
            </Link>
            <Link to="/operator/journey-otp" className="flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 bg-orange-500/10 border border-orange-500/30" data-testid="journey-otp-link">
              <Key className="h-5 w-5 text-orange-400" />
              <span className="text-orange-400">Journey OTP</span>
            </Link>
            
            {/* Tracking Section */}
            <div className="pt-4 mt-4 border-t border-slate-700">
              <p className="text-xs text-slate-500 uppercase tracking-wider px-4 mb-2">Tracking</p>
              <Link to="/operator/flight-records" className="flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800" data-testid="flight-records-link">
                <BookOpen className="h-5 w-5" />
                <span>Flight Records</span>
              </Link>
              <Link to="/operator/fuel-records" className="flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800" data-testid="fuel-records-link">
                <Fuel className="h-5 w-5" />
                <span>Fuel Records</span>
              </Link>
              <Link to="/operator/live-tracking" className="flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800" data-testid="live-tracking-link">
                <MapPin className="h-5 w-5" />
                <span>Live Tracking</span>
              </Link>
              <Link to="/operator/landing-permissions" className="flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800" data-testid="permissions-link">
                <Shield className="h-5 w-5" />
                <span>Landing Permissions</span>
              </Link>
            </div>

            <Link to="/operator/profile" className="flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 mt-4" data-testid="profile-link">
              <Settings className="h-5 w-5" />
              <span>Profile</span>
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          <Routes>
            <Route index element={<OperatorHome operator={operator} />} />
            <Route path="fleet" element={<FleetManagement operator={operator} />} />
            <Route path="inquiries" element={<InquiryInbox operator={operator} />} />
            <Route path="pilots" element={<PilotManagement operator={operator} />} />
            <Route path="journey-otp" element={<JourneyOTPManager operator={operator} />} />
            <Route path="flight-records" element={<FlightRecordsManager operator={operator} />} />
            <Route path="fuel-records" element={<FuelRecordsManager operator={operator} />} />
            <Route path="live-tracking" element={<LiveTrackingMap operator={operator} />} />
            <Route path="landing-permissions" element={<LandingPermissionViewer operator={operator} />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default OperatorDashboard;