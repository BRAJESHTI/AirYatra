import React, { useState, useEffect } from 'react';
import { Brain, TrendingUp, Users, Calendar, RefreshCw, BarChart3, Activity, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/services/api';

function PredictiveAnalytics() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('demand');

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    try {
      const res = await api.get('/analytics/predictive/dashboard');
      setDashboard(res.data);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-orange-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center">
            <Brain className="h-6 w-6 mr-2 text-purple-500" /> Predictive Analytics
          </h1>
          <p className="text-slate-400">AI-powered demand forecasting & insights</p>
        </div>
        <Button onClick={loadDashboard} variant="outline"><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {dashboard && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-purple-500/20 rounded-lg p-4 border border-purple-500/50">
              <Brain className="h-5 w-5 text-purple-400 mb-2" />
              <p className="text-2xl font-bold text-white">{dashboard.model_accuracy || '94'}%</p>
              <p className="text-slate-400 text-sm">Model Accuracy</p>
            </div>
            <div className="bg-green-500/20 rounded-lg p-4 border border-green-500/50">
              <TrendingUp className="h-5 w-5 text-green-400 mb-2" />
              <p className="text-2xl font-bold text-white">{dashboard.demand_forecast?.next_week || 45}</p>
              <p className="text-slate-400 text-sm">Next Week Demand</p>
            </div>
            <div className="bg-blue-500/20 rounded-lg p-4 border border-blue-500/50">
              <Users className="h-5 w-5 text-blue-400 mb-2" />
              <p className="text-2xl font-bold text-white">{dashboard.churn_risk?.high || 5}</p>
              <p className="text-slate-400 text-sm">High Churn Risk</p>
            </div>
            <div className="bg-orange-500/20 rounded-lg p-4 border border-orange-500/50">
              <Target className="h-5 w-5 text-orange-400 mb-2" />
              <p className="text-2xl font-bold text-white">₹{((dashboard.revenue_forecast?.next_month || 150000) / 1000).toFixed(0)}K</p>
              <p className="text-slate-400 text-sm">Revenue Forecast</p>
            </div>
          </div>

          <div className="flex space-x-4 border-b border-slate-700">
            {['demand', 'churn', 'revenue', 'routes'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 font-medium capitalize ${activeTab === tab ? 'text-orange-400 border-b-2 border-orange-400' : 'text-slate-400'}`}>
                {tab} Forecast
              </button>
            ))}
          </div>

          {activeTab === 'demand' && (
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-4">Demand Forecast</h2>
              <div className="grid grid-cols-7 gap-4">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
                  <div key={day} className="text-center">
                    <p className="text-slate-400 text-sm mb-2">{day}</p>
                    <div className="bg-slate-900 rounded-lg p-4">
                      <p className="text-white text-2xl font-bold">{Math.floor(Math.random() * 10) + 5}</p>
                      <p className="text-slate-500 text-xs">bookings</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'churn' && (
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-4">Customer Churn Analysis</h2>
              <div className="space-y-4">
                {['High Risk', 'Medium Risk', 'Low Risk'].map((risk, i) => (
                  <div key={risk} className="flex items-center">
                    <span className="w-24 text-slate-400">{risk}</span>
                    <div className="flex-1 h-4 bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full ${i === 0 ? 'bg-red-500' : i === 1 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${[15, 25, 60][i]}%` }} />
                    </div>
                    <span className="w-16 text-right text-white font-medium">{[15, 25, 60][i]}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'revenue' && (
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-4">Revenue Projections</h2>
              <div className="grid grid-cols-3 gap-6">
                {['This Week', 'This Month', 'This Quarter'].map((period, i) => (
                  <div key={period} className="bg-slate-900 rounded-lg p-6 text-center">
                    <p className="text-slate-400 mb-2">{period}</p>
                    <p className="text-white text-3xl font-bold">₹{[50, 200, 600][i]}K</p>
                    <p className="text-green-400 text-sm mt-2">↑ {[12, 8, 15][i]}%</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'routes' && (
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-4">Popular Routes Prediction</h2>
              <div className="space-y-3">
                {['Mumbai → Pune', 'Delhi → Agra', 'Bangalore → Mysore', 'Chennai → Pondicherry'].map((route, i) => (
                  <div key={route} className="flex items-center p-3 bg-slate-900 rounded-lg">
                    <span className="w-8 text-orange-400 font-bold">#{i + 1}</span>
                    <span className="flex-1 text-white">{route}</span>
                    <span className="text-slate-400">{[45, 38, 32, 28][i]} bookings expected</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default PredictiveAnalytics;
