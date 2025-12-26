import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileText, 
  CreditCard, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  IndianRupee,
  Building2,
  Calendar,
  Send,
  BarChart3
} from 'lucide-react';
import api from '@/services/apiClient';
import { toast } from 'sonner';

// Import sub-components
import GSTReturns from './GSTReturns';
import GSTPayments from './GSTPayments';
import ITCManagement from './ITCManagement';
import VendorCompliance from './VendorCompliance';

const GSTDashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    let isMounted = true;
    const fetchDashboard = async () => {
      setLoading(true);
      try {
        const response = await api.get('/gst/dashboard');
        if (isMounted) {
          setDashboard(response.data);
        }
      } catch (error) {
        console.error('Error:', error);
        if (isMounted) {
          toast.error('Failed to load GST dashboard');
        }
      }
      if (isMounted) {
        setLoading(false);
      }
    };
    fetchDashboard();
    return () => { isMounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">GST Compliance / GST अनुपालन</h2>
          <p className="text-slate-400">GSTR-1, GSTR-3B, ITC Management, Vendor Compliance</p>
        </div>
        <Button onClick={fetchDashboard} variant="outline" className="border-slate-600 text-slate-300">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-800">
          <TabsTrigger value="overview" className="data-[state=active]:bg-emerald-600">Overview</TabsTrigger>
          <TabsTrigger value="returns" className="data-[state=active]:bg-emerald-600">GST Returns</TabsTrigger>
          <TabsTrigger value="payments" className="data-[state=active]:bg-emerald-600">Payments</TabsTrigger>
          <TabsTrigger value="itc" className="data-[state=active]:bg-emerald-600">Input/Output ITC</TabsTrigger>
          <TabsTrigger value="compliance" className="data-[state=active]:bg-emerald-600">Vendor Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {dashboard && (
            <div className="space-y-6">
              {/* Period */}
              <div className="flex items-center space-x-2 text-slate-400">
                <Calendar className="h-4 w-4" />
                <span>Current Period: {dashboard.current_period}</span>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="bg-emerald-500/20 border-emerald-500/30">
                  <CardContent className="pt-6">
                    <TrendingUp className="h-8 w-8 text-emerald-400 mb-2" />
                    <p className="text-3xl font-bold text-white">₹{(dashboard.itc_summary?.output_gst || 0).toLocaleString()}</p>
                    <p className="text-slate-400 text-sm">Output GST / आउटपुट GST</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-blue-500/20 border-blue-500/30">
                  <CardContent className="pt-6">
                    <TrendingDown className="h-8 w-8 text-blue-400 mb-2" />
                    <p className="text-3xl font-bold text-white">₹{(dashboard.itc_summary?.input_gst || 0).toLocaleString()}</p>
                    <p className="text-slate-400 text-sm">Input GST (ITC) / इनपुट GST</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-yellow-500/20 border-yellow-500/30">
                  <CardContent className="pt-6">
                    <IndianRupee className="h-8 w-8 text-yellow-400 mb-2" />
                    <p className="text-3xl font-bold text-white">₹{(dashboard.itc_summary?.net_payable || 0).toLocaleString()}</p>
                    <p className="text-slate-400 text-sm">Net Payable / देय राशि</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-red-500/20 border-red-500/30">
                  <CardContent className="pt-6">
                    <AlertTriangle className="h-8 w-8 text-red-400 mb-2" />
                    <p className="text-3xl font-bold text-white">₹{(dashboard.vendor_compliance?.at_risk_itc || 0).toLocaleString()}</p>
                    <p className="text-slate-400 text-sm">At-Risk ITC / जोखिम में ITC</p>
                  </CardContent>
                </Card>
              </div>

              {/* Filing & Payment Status */}
              <div className="grid grid-cols-2 gap-6">
                {/* Filing Status */}
                <Card className="bg-slate-900 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <FileText className="h-5 w-5 mr-2 text-blue-400" />
                      Filing Status / फाइलिंग स्थिति
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Pending Returns:</span>
                      <Badge className={dashboard.filing_status?.pending_returns > 0 ? 'bg-yellow-500' : 'bg-green-500'}>
                        {dashboard.filing_status?.pending_returns || 0}
                      </Badge>
                    </div>
                    
                    {dashboard.filing_status?.upcoming_due_dates?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-slate-400 text-sm">Upcoming Due Dates:</p>
                        {dashboard.filing_status.upcoming_due_dates.map((due, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-slate-800 rounded p-2">
                            <span className="text-white">{due.return_type} - {due.period}</span>
                            <span className="text-yellow-400 text-sm">{due.due_date}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <Button onClick={() => setActiveTab('returns')} className="w-full bg-blue-600">
                      Manage Returns
                    </Button>
                  </CardContent>
                </Card>

                {/* Payment Status */}
                <Card className="bg-slate-900 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <CreditCard className="h-5 w-5 mr-2 text-emerald-400" />
                      Payment Status / भुगतान स्थिति
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Total Unpaid:</span>
                      <span className="text-red-400 font-bold text-lg">₹{(dashboard.payment_status?.total_unpaid || 0).toLocaleString()}</span>
                    </div>
                    
                    {dashboard.payment_status?.unpaid_returns?.length > 0 && (
                      <div className="space-y-2">
                        {dashboard.payment_status.unpaid_returns.slice(0, 3).map((ret, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-slate-800 rounded p-2">
                            <span className="text-white">{ret.return_type} - {ret.period}</span>
                            <span className="text-red-400">₹{(ret.total_tax_payable || 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <Button onClick={() => setActiveTab('payments')} className="w-full bg-emerald-600">
                      Record Payment
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Vendor Compliance Alert */}
              {dashboard.vendor_compliance?.non_compliant > 0 && (
                <Alert className="bg-red-500/10 border-red-500/30">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  <AlertDescription className="text-red-400">
                    <strong>{dashboard.vendor_compliance.non_compliant} vendors</strong> have not filed their GSTR-1. 
                    This puts <strong>₹{(dashboard.vendor_compliance.at_risk_itc || 0).toLocaleString()}</strong> of your ITC at risk.
                    <Button onClick={() => setActiveTab('compliance')} variant="link" className="text-red-300 p-0 ml-2">
                      View Details →
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Quick ITC Summary */}
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <BarChart3 className="h-5 w-5 mr-2 text-purple-400" />
                    ITC Summary / ITC सारांश
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <p className="text-slate-400 text-sm mb-2">CGST</p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-emerald-400">Output</span>
                          <span className="text-white">₹{((dashboard.itc_summary?.output_gst || 0) / 2).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-blue-400">Input</span>
                          <span className="text-white">₹{((dashboard.itc_summary?.input_gst || 0) / 2).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm mb-2">SGST</p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-emerald-400">Output</span>
                          <span className="text-white">₹{((dashboard.itc_summary?.output_gst || 0) / 2).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-blue-400">Input</span>
                          <span className="text-white">₹{((dashboard.itc_summary?.input_gst || 0) / 2).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm mb-2">IGST</p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-emerald-400">Output</span>
                          <span className="text-white">₹0</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-blue-400">Input</span>
                          <span className="text-white">₹0</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="returns">
          <GSTReturns />
        </TabsContent>

        <TabsContent value="payments">
          <GSTPayments />
        </TabsContent>

        <TabsContent value="itc">
          <ITCManagement />
        </TabsContent>

        <TabsContent value="compliance">
          <VendorCompliance />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GSTDashboard;