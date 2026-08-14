import React, { useState, useEffect } from 'react';
import { 
  Clock, Play, Pause, RefreshCw, Loader2, CheckCircle, 
  Calendar, Bell, Users, FileText, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '../../services/api';
import { toast } from 'sonner';

function SchedulerStatus() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    loadStatus();
    // Refresh every 30 seconds
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadStatus = async () => {
    try {
      const response = await api.get('/scheduler/status');
      setStatus(response.data);
    } catch (error) {
      console.error('Failed to load scheduler status:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerAutoReassign = async () => {
    setTriggering(true);
    try {
      const response = await api.post('/scheduler/trigger/auto-reassign');
      toast.success(response.data.message);
      loadStatus();
    } catch (error) {
      toast.error('Failed to trigger auto-reassignment');
    } finally {
      setTriggering(false);
    }
  };

  const pauseJob = async (jobId) => {
    try {
      await api.post(`/scheduler/pause/${jobId}`);
      toast.success(`Job ${jobId} paused`);
      loadStatus();
    } catch (error) {
      toast.error('Failed to pause job');
    }
  };

  const resumeJob = async (jobId) => {
    try {
      await api.post(`/scheduler/resume/${jobId}`);
      toast.success(`Job ${jobId} resumed`);
      loadStatus();
    } catch (error) {
      toast.error('Failed to resume job');
    }
  };

  const getJobIcon = (jobId) => {
    switch (jobId) {
      case 'auto_reassign_leads': return <Users className="h-4 w-4 text-orange-400" />;
      case 'send_notifications': return <Bell className="h-4 w-4 text-blue-400" />;
      case 'cleanup_sessions': return <Clock className="h-4 w-4 text-purple-400" />;
      case 'daily_reports': return <FileText className="h-4 w-4 text-green-400" />;
      default: return <Clock className="h-4 w-4 text-slate-400" />;
    }
  };

  const formatNextRun = (dateStr) => {
    if (!dateStr) return 'Not scheduled';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date - now;
    
    if (diff < 0) return 'Running now...';
    if (diff < 60000) return `In ${Math.round(diff / 1000)}s`;
    if (diff < 3600000) return `In ${Math.round(diff / 60000)}m`;
    if (diff < 86400000) return `In ${Math.round(diff / 3600000)}h`;
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Clock className="h-6 w-6 text-orange-400" />
            Background Scheduler</h2>
          <p className="text-slate-400 mt-1">
            Automated tasks running in background
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm flex items-center gap-2 ${
            status?.running 
              ? 'bg-green-500/20 text-green-400' 
              : 'bg-red-500/20 text-red-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${status?.running ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            {status?.running ? 'Running' : 'Stopped'}
          </span>
          <Button onClick={loadStatus} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-orange-400 font-medium">Quick Actions</h3>
            <p className="text-slate-400 text-sm mt-1">
              Manually trigger background jobs without waiting for schedule
            </p>
          </div>
          <Button 
            onClick={triggerAutoReassign}
            disabled={triggering}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {triggering ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Users className="h-4 w-4 mr-2" />
            )}
            Trigger Lead Reassignment
          </Button>
        </div>
      </div>

      {/* Scheduled Jobs */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700">
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-white font-semibold">Scheduled Jobs</h3>
        </div>
        <div className="divide-y divide-slate-700">
          {status?.jobs?.map((job) => (
            <div key={job.id} className="p-4 flex items-center justify-between hover:bg-slate-800/50 transition">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center">
                  {getJobIcon(job.id)}
                </div>
                <div>
                  <p className="text-white font-medium">{job.name}</p>
                  <p className="text-slate-400 text-sm">{job.trigger}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-slate-300 text-sm">Next Run</p>
                  <p className="text-orange-400 font-medium">{formatNextRun(job.next_run)}</p>
                </div>
                {job.next_run ? (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => pauseJob(job.id)}
                    className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                  >
                    <Pause className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => resumeJob(job.id)}
                    className="border-green-500/50 text-green-400 hover:bg-green-500/10"
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Job Descriptions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-5 w-5 text-orange-400" />
            <h4 className="text-white font-medium">Auto Reassign Leads</h4>
          </div>
          <p className="text-slate-400 text-sm">
            Automatically reassigns leads that haven't been contacted within 1 hour to another sales person.
            Runs every 15 minutes.
          </p>
        </div>
        
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="h-5 w-5 text-blue-400" />
            <h4 className="text-white font-medium">Send Notifications</h4>
          </div>
          <p className="text-slate-400 text-sm">
            Processes pending email, SMS, and push notifications from the queue.
            Runs every 5 minutes.
          </p>
        </div>
        
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-purple-400" />
            <h4 className="text-white font-medium">Cleanup Sessions</h4>
          </div>
          <p className="text-slate-400 text-sm">
            Removes expired user sessions and tokens older than 7 days.
            Runs every hour.
          </p>
        </div>
        
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-5 w-5 text-green-400" />
            <h4 className="text-white font-medium">Daily Reports</h4>
          </div>
          <p className="text-slate-400 text-sm">
            Generates daily summary reports with lead counts, bookings, and conversion metrics.
            Runs once daily.
          </p>
        </div>
      </div>
    </div>
  );
}

export default SchedulerStatus;
