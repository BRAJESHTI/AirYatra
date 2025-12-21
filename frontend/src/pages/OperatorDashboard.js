import React from 'react';
import { LogOut, Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';

function OperatorDashboard({ user, onLogout }) {
  return (
    <div className="min-h-screen bg-slate-950" data-testid="operator-dashboard">
      <nav className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Plane className="h-8 w-8 text-orange-500" />
            <span className="text-2xl font-bold text-white">AirYatra Operator</span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-slate-300">Welcome, {user.full_name}</span>
            <Button variant="ghost" onClick={onLogout} className="text-white" data-testid="logout-btn">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </nav>
      <div className="max-w-7xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-white mb-4" data-testid="dashboard-title">Operator Dashboard</h1>
        <p className="text-slate-400">Manage your fleet, respond to inquiries, and track bookings.</p>
        <div className="mt-8 glass p-8 rounded-lg">
          <p className="text-slate-300">Operator features coming soon...</p>
        </div>
      </div>
    </div>
  );
}

export default OperatorDashboard;