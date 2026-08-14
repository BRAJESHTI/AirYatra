import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, XCircle, Loader2, BarChart3, RefreshCw, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '../../services/api';
import { toast } from 'sonner';

// CSS Score color coding based on thresholds
const getScoreColor = (score) => {
  if (score >= 80) return { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/40' };
  if (score >= 70) return { bg: 'bg-lime-500/20', text: 'text-lime-400', border: 'border-lime-500/40' };
  if (score >= 60) return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/40' };
  if (score >= 50) return { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/40' };
  return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40' };
};

const getStatusBadge = (score) => {
  if (score >= 70) return { label: 'HEALTHY', icon: CheckCircle2, color: 'text-green-400' };
  if (score >= 60) return { label: 'WARNING', icon: AlertTriangle, color: 'text-yellow-400' };
  if (score >= 50) return { label: 'AT RISK', icon: AlertTriangle, color: 'text-orange-400' };
  return { label: 'CRITICAL', icon: XCircle, color: 'text-red-400' };
};

const getTrendIcon = (trend) => {
  if (trend === 'improving') return { icon: TrendingUp, color: 'text-green-400', label: '↑ Improving' };
  if (trend === 'declining') return { icon: TrendingDown, color: 'text-red-400', label: '↓ Declining' };
  return { icon: Minus, color: 'text-slate-400', label: '— Stable' };
};

export default function CSSWidget({ operatorId, compact = false }) {
  const [cssData, setCssData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadCSSData = useCallback(async () => {
    if (!operatorId) {
      setLoading(false);
      return;
    }
    
    try {
      setError(null);
      const response = await api.get(`/css/operator/${operatorId}`);
      setCssData(response.data);
    } catch (err) {
      // If no CSS data exists yet, show placeholder
      if (err.response?.status === 403 || err.response?.status === 404) {
        setCssData(null);
      } else {
        setError(err.response?.data?.detail || 'Failed to load CSS data');
      }
    } finally {
      setLoading(false);
    }
  }, [operatorId]);

  useEffect(() => {
    loadCSSData();
  }, [loadCSSData]);

  if (loading) {
    return (
      <div className={`glass rounded-xl ${compact ? 'p-4' : 'p-6'}`}>
        <div className="flex items-center justify-center gap-2 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading CSS Score...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`glass rounded-xl ${compact ? 'p-4' : 'p-6'}`}>
        <div className="text-center text-red-400">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">{error}</p>
          <Button size="sm" variant="outline" onClick={loadCSSData} className="mt-2 border-slate-600">
            <RefreshCw className="h-4 w-4 mr-1" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  // No CSS data yet
  if (!cssData || !cssData.history || cssData.history.length === 0) {
    return (
      <div className={`glass rounded-xl ${compact ? 'p-4' : 'p-6'}`}>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-5 w-5 text-blue-400" />
          <h3 className="font-semibold text-white">CSS Score</h3>
        </div>
        <div className="text-center py-4 text-slate-400">
          <p className="text-sm">No CSS data available yet</p>
          <p className="text-xs mt-1">Score will appear after first month of operations</p>
        </div>
      </div>
    );
  }

  const latestScore = cssData.history[0];
  const scoreColors = getScoreColor(latestScore.css_score);
  const status = getStatusBadge(latestScore.css_score);
  const trend = getTrendIcon(latestScore.score_trend);

  // Compact mode for sidebar/small widget
  if (compact) {
    return (
      <div className={`rounded-xl p-4 ${scoreColors.bg} border ${scoreColors.border}`} data-testid="css-widget-compact">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className={`h-5 w-5 ${scoreColors.text}`} />
            <span className="text-sm text-slate-300">CSS Score</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${scoreColors.text}`}>{latestScore.css_score}</span>
            <trend.icon className={`h-4 w-4 ${trend.color}`} />
          </div>
        </div>
        <div className="flex items-center justify-between mt-2 text-xs">
          <span className={status.color}>{status.label}</span>
          <span className="text-slate-400">{latestScore.calculation_month}/{latestScore.calculation_year}</span>
        </div>
      </div>
    );
  }

  // Full widget with history
  return (
    <div className="glass rounded-xl p-6" data-testid="css-widget-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-400" />
          <h3 className="font-semibold text-white">Customer Satisfaction Score</h3>
        </div>
        <Button size="sm" variant="ghost" onClick={loadCSSData} className="text-slate-400 hover:text-white">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Current Score Card */}
      <div className={`rounded-xl p-4 ${scoreColors.bg} border ${scoreColors.border} mb-4`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">Current Score</p>
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold ${scoreColors.text}`}>{latestScore.css_score}</span>
              <span className="text-slate-500">/100</span>
            </div>
          </div>
          <div className="text-right">
            <div className={`flex items-center gap-1 ${status.color}`}>
              <status.icon className="h-5 w-5" />
              <span className="font-semibold">{status.label}</span>
            </div>
            <div className={`flex items-center gap-1 mt-1 ${trend.color} text-sm`}>
              <trend.icon className="h-4 w-4" />
              <span>{trend.label}</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                latestScore.css_score >= 70 ? 'bg-green-500' :
                latestScore.css_score >= 60 ? 'bg-yellow-500' :
                latestScore.css_score >= 50 ? 'bg-orange-500' : 'bg-red-500'
              }`}
              style={{ width: `${latestScore.css_score}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>0</span>
            <span className="text-red-400">50</span>
            <span className="text-yellow-400">60</span>
            <span className="text-green-400">70</span>
            <span>100</span>
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-slate-800/50">
          <p className="text-xs text-slate-400">Average Rating</p>
          <p className="text-lg font-semibold text-yellow-400">
            ⭐ {latestScore.average_rating?.toFixed(1) || 'N/A'}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-slate-800/50">
          <p className="text-xs text-slate-400">Complaints This Month</p>
          <p className={`text-lg font-semibold ${latestScore.total_complaints_month > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {latestScore.total_complaints_month || 0}
          </p>
        </div>
      </div>

      {/* Thresholds Warning */}
      {latestScore.css_score < 70 && (
        <div className={`p-3 rounded-lg mb-4 ${
          latestScore.css_score < 50 ? 'bg-red-500/10 border border-red-500/30' :
          latestScore.css_score < 60 ? 'bg-orange-500/10 border border-orange-500/30' :
          'bg-yellow-500/10 border border-yellow-500/30'
        }`}>
          <p className={`text-sm font-medium ${
            latestScore.css_score < 50 ? 'text-red-400' :
            latestScore.css_score < 60 ? 'text-orange-400' : 'text-yellow-400'
          }`}>
            {latestScore.css_score < 50 ? '⚠️ DELISTING RISK' :
             latestScore.css_score < 60 ? '⚠️ SUSPENSION RISK' : '⚠️ Rating Drop Warning'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {latestScore.css_score < 50 ? 'Score below 50 triggers automatic delisting' :
             latestScore.css_score < 60 ? 'Score below 60 triggers 7-14 day suspension' :
             'Improve score to avoid penalties'}
          </p>
        </div>
      )}

      {/* Score History */}
      {cssData.history.length > 1 && (
        <div>
          <p className="text-sm text-slate-400 mb-2">Score History</p>
          <div className="space-y-2">
            {cssData.history.slice(0, 6).map((record, idx) => {
              const colors = getScoreColor(record.css_score);
              const prevScore = cssData.history[idx + 1]?.css_score;
              const diff = prevScore ? record.css_score - prevScore : 0;
              
              return (
                <div key={record.css_id || idx} className="flex items-center justify-between p-2 rounded bg-slate-800/30">
                  <span className="text-sm text-slate-400">
                    {record.calculation_month}/{record.calculation_year}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${colors.text}`}>{record.css_score}</span>
                    {diff !== 0 && (
                      <span className={`text-xs flex items-center ${diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {diff > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                        {Math.abs(diff).toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Tips */}
      <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
        <p className="text-sm text-blue-400 font-medium">Tips to Improve CSS:</p>
        <ul className="text-xs text-slate-400 mt-1 space-y-1">
          <li>• Respond to complaints within 2 hours</li>
          <li>• Minimize cancellations & delays</li>
          <li>• Request reviews from satisfied customers</li>
        </ul>
      </div>
    </div>
  );
}
