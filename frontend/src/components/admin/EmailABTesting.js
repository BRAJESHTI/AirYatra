import React, { useState, useEffect, useCallback } from 'react';
import { 
  FlaskConical, Plus, Play, Pause, Trophy, 
  TrendingUp, Mail, Eye, MousePointer2, 
  RefreshCw, Loader2, Trash2, Check, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import api from '../../services/api';
import { toast } from 'sonner';

/**
 * Email A/B Testing Dashboard
 * Create and monitor A/B tests for email subject lines
 */
export default function EmailABTesting() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);
  const [creating, setCreating] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    test_name: '',
    email_type: 'booking_confirmation',
    variant_a_subject: '',
    variant_a_preview: '',
    variant_b_subject: '',
    variant_b_preview: '',
    split_ratio: 50,
    auto_winner: true,
    auto_winner_metric: 'open_rate',
    auto_winner_threshold: 100
  });

  const fetchTests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/email-ab-tests/list');
      setTests(res.data.tests || []);
    } catch (err) {
      console.error('Failed to fetch A/B tests:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

  const handleCreateTest = async () => {
    if (!formData.test_name || !formData.variant_a_subject || !formData.variant_b_subject) {
      toast.error('Please fill in test name and both subject lines');
      return;
    }

    setCreating(true);
    try {
      const payload = {
        test_name: formData.test_name,
        email_type: formData.email_type,
        variant_a: {
          subject: formData.variant_a_subject,
          preview_text: formData.variant_a_preview
        },
        variant_b: {
          subject: formData.variant_b_subject,
          preview_text: formData.variant_b_preview
        },
        split_ratio: formData.split_ratio,
        auto_winner: formData.auto_winner,
        auto_winner_metric: formData.auto_winner_metric,
        auto_winner_threshold: formData.auto_winner_threshold
      };

      await api.post('/email-ab-tests/create', payload);
      toast.success('A/B Test created successfully!');
      setShowCreateModal(false);
      resetForm();
      fetchTests();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create test');
    }
    setCreating(false);
  };

  const resetForm = () => {
    setFormData({
      test_name: '',
      email_type: 'booking_confirmation',
      variant_a_subject: '',
      variant_a_preview: '',
      variant_b_subject: '',
      variant_b_preview: '',
      split_ratio: 50,
      auto_winner: true,
      auto_winner_metric: 'open_rate',
      auto_winner_threshold: 100
    });
  };

  const handleSelectWinner = async (testId, winner) => {
    try {
      await api.post(`/email-ab-tests/${testId}/select-winner`, { winner });
      toast.success(`Variant ${winner} selected as winner!`);
      fetchTests();
      setSelectedTest(null);
    } catch (err) {
      toast.error('Failed to select winner');
    }
  };

  const handlePauseResume = async (testId, isPaused) => {
    try {
      if (isPaused) {
        await api.post(`/email-ab-tests/${testId}/resume`);
        toast.success('Test resumed');
      } else {
        await api.post(`/email-ab-tests/${testId}/pause`);
        toast.success('Test paused');
      }
      fetchTests();
    } catch (err) {
      toast.error('Action failed');
    }
  };

  const handleDeleteTest = async (testId) => {
    if (!confirm('Are you sure you want to delete this test?')) return;

    try {
      await api.delete(`/email-ab-tests/${testId}`);
      toast.success('Test deleted');
      fetchTests();
    } catch (err) {
      toast.error('Failed to delete test');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">Active</span>;
      case 'paused':
        return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">Paused</span>;
      case 'winner_selected':
        return <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">Winner Selected</span>;
      default:
        return <span className="px-2 py-1 bg-slate-500/20 text-slate-400 rounded text-xs">{status}</span>;
    }
  };

  const emailTypes = [
    { value: 'booking_confirmation', label: 'Booking Confirmation' },
    { value: 'payment_receipt', label: 'Payment Receipt' },
    { value: 'promotional', label: 'Promotional' },
    { value: 'newsletter', label: 'Newsletter' },
    { value: 'reminder', label: 'Reminder' },
    { value: 'welcome', label: 'Welcome Email' }
  ];

  return (
    <div className="space-y-6" data-testid="email-ab-testing">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-orange-500" />
            Email A/B Testing
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Compare subject lines to optimize email open rates
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchTests} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateModal(true)} className="bg-orange-500 hover:bg-orange-600">
            <Plus className="h-4 w-4 mr-2" />
            New A/B Test
          </Button>
        </div>
      </div>

      {/* Tests List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : tests.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/50 rounded-xl border border-slate-700">
          <FlaskConical className="h-16 w-16 mx-auto text-slate-600 mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No A/B Tests Yet</h3>
          <p className="text-slate-400 mb-4">
            Create your first test to compare email subject lines
          </p>
          <Button onClick={() => setShowCreateModal(true)} className="bg-orange-500 hover:bg-orange-600">
            <Plus className="h-4 w-4 mr-2" />
            Create First Test
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {tests.map(test => (
            <div
              key={test.id}
              className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 hover:border-slate-600 transition-all"
            >
              {/* Test Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    {test.test_name}
                    {test.winner && <Trophy className="h-4 w-4 text-yellow-500" />}
                  </h3>
                  <p className="text-sm text-slate-400">
                    {emailTypes.find(t => t.value === test.email_type)?.label || test.email_type}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(test.status)}
                  {test.status === 'active' && (
                    <Button size="sm" variant="ghost" onClick={() => handlePauseResume(test.id, false)}>
                      <Pause className="h-4 w-4" />
                    </Button>
                  )}
                  {test.status === 'paused' && (
                    <Button size="sm" variant="ghost" onClick={() => handlePauseResume(test.id, true)}>
                      <Play className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteTest(test.id)}>
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              </div>

              {/* Variants Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Variant A */}
                <div className={`p-4 rounded-lg border ${
                  test.winner === 'A' ? 'bg-green-500/10 border-green-500' : 'bg-slate-700/50 border-slate-600'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-white flex items-center gap-2">
                      Variant A
                      {test.winner === 'A' && <Trophy className="h-4 w-4 text-green-500" />}
                    </span>
                    <span className="text-sm text-slate-400">{test.split_ratio}% split</span>
                  </div>
                  <p className="text-sm text-slate-300 mb-3 line-clamp-2">
                    &ldquo;{test.variant_a?.subject}&rdquo;
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold text-white">{test.variant_a?.sent_count || 0}</p>
                      <p className="text-xs text-slate-400">Sent</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-green-400">{test.variant_a?.open_rate || 0}%</p>
                      <p className="text-xs text-slate-400">Opens</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-blue-400">{test.variant_a?.click_rate || 0}%</p>
                      <p className="text-xs text-slate-400">Clicks</p>
                    </div>
                  </div>
                </div>

                {/* Variant B */}
                <div className={`p-4 rounded-lg border ${
                  test.winner === 'B' ? 'bg-green-500/10 border-green-500' : 'bg-slate-700/50 border-slate-600'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-white flex items-center gap-2">
                      Variant B
                      {test.winner === 'B' && <Trophy className="h-4 w-4 text-green-500" />}
                    </span>
                    <span className="text-sm text-slate-400">{100 - test.split_ratio}% split</span>
                  </div>
                  <p className="text-sm text-slate-300 mb-3 line-clamp-2">
                    &ldquo;{test.variant_b?.subject}&rdquo;
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold text-white">{test.variant_b?.sent_count || 0}</p>
                      <p className="text-xs text-slate-400">Sent</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-green-400">{test.variant_b?.open_rate || 0}%</p>
                      <p className="text-xs text-slate-400">Opens</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-blue-400">{test.variant_b?.click_rate || 0}%</p>
                      <p className="text-xs text-slate-400">Clicks</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Select Winner (if no winner yet) */}
              {!test.winner && test.status === 'active' && (
                <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between">
                  <p className="text-sm text-slate-400">
                    {test.auto_winner 
                      ? `Auto-select winner after ${test.auto_winner_threshold} recipients based on ${test.auto_winner_metric.replace('_', ' ')}`
                      : 'Manual winner selection required'
                    }
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleSelectWinner(test.id, 'A')}>
                      Select A
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleSelectWinner(test.id, 'B')}>
                      Select B
                    </Button>
                  </div>
                </div>
              )}

              {/* Winner Info */}
              {test.winner && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <p className="text-sm text-green-400">
                    <Trophy className="h-4 w-4 inline mr-1" />
                    Winner: Variant {test.winner} - {test.winner_reason || 'Selected'}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Test Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-orange-500" />
              Create New A/B Test
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Test Name *</Label>
                <Input
                  placeholder="e.g., Booking Email Subject Test"
                  value={formData.test_name}
                  onChange={(e) => setFormData({...formData, test_name: e.target.value})}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Email Type</Label>
                <select
                  className="w-full mt-1 p-2 border rounded-lg bg-slate-800 border-slate-700"
                  value={formData.email_type}
                  onChange={(e) => setFormData({...formData, email_type: e.target.value})}
                >
                  {emailTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Variant A */}
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <h4 className="font-semibold text-white mb-3">Variant A (Control)</h4>
              <div className="space-y-3">
                <div>
                  <Label>Subject Line *</Label>
                  <Input
                    placeholder="Your flight is confirmed! ✈️"
                    value={formData.variant_a_subject}
                    onChange={(e) => setFormData({...formData, variant_a_subject: e.target.value})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Preview Text</Label>
                  <Input
                    placeholder="Check your booking details inside"
                    value={formData.variant_a_preview}
                    onChange={(e) => setFormData({...formData, variant_a_preview: e.target.value})}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Variant B */}
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <h4 className="font-semibold text-white mb-3">Variant B (Challenger)</h4>
              <div className="space-y-3">
                <div>
                  <Label>Subject Line *</Label>
                  <Input
                    placeholder="Booking Confirmed - AirYatra"
                    value={formData.variant_b_subject}
                    onChange={(e) => setFormData({...formData, variant_b_subject: e.target.value})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Preview Text</Label>
                  <Input
                    placeholder="Your flight details are ready"
                    value={formData.variant_b_preview}
                    onChange={(e) => setFormData({...formData, variant_b_preview: e.target.value})}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Split Ratio (% for Variant A)</Label>
                <Input
                  type="number"
                  min="10"
                  max="90"
                  value={formData.split_ratio}
                  onChange={(e) => setFormData({...formData, split_ratio: parseInt(e.target.value) || 50})}
                  className="mt-1"
                />
                <p className="text-xs text-slate-400 mt-1">
                  A: {formData.split_ratio}% | B: {100 - formData.split_ratio}%
                </p>
              </div>
              <div>
                <Label>Auto-Select Threshold</Label>
                <Input
                  type="number"
                  min="10"
                  max="10000"
                  value={formData.auto_winner_threshold}
                  onChange={(e) => setFormData({...formData, auto_winner_threshold: parseInt(e.target.value) || 100})}
                  className="mt-1"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Recipients before auto-selecting winner
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.auto_winner}
                  onChange={(e) => setFormData({...formData, auto_winner: e.target.checked})}
                  className="rounded"
                />
                <span className="text-sm text-slate-300">Auto-select winner</span>
              </label>
              
              <select
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
                value={formData.auto_winner_metric}
                onChange={(e) => setFormData({...formData, auto_winner_metric: e.target.value})}
                disabled={!formData.auto_winner}
              >
                <option value="open_rate">Based on Open Rate</option>
                <option value="click_rate">Based on Click Rate</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateTest} 
              disabled={creating}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {creating ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating...</>
              ) : (
                <><Plus className="h-4 w-4 mr-2" />Create Test</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
