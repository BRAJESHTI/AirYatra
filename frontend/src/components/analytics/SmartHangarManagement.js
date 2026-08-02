import React, { useState, useEffect } from 'react';
import { 
  Warehouse, PlaneTakeoff, Package, Calendar, Plus,
  Loader2, RefreshCw, MapPin, Clock, DollarSign,
  AlertTriangle, CheckCircle, Boxes, Wrench
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid
} from 'recharts';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const COLORS = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#ec4899'];

function SmartHangarManagement() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('occupancy');
  const [bookingDialog, setBookingDialog] = useState(false);
  const [selectedHangar, setSelectedHangar] = useState(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    
    try {
      const res = await fetch(`${API_URL}/api/hangar/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        setDashboard(await res.json());
      }
    } catch (error) {
      toast.error('Failed to load hangar data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        <span className="ml-2 text-slate-400">Loading Hangar Data...</span>
      </div>
    );
  }

  const tabs = [
    { id: 'occupancy', label: 'Occupancy', icon: Warehouse },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'bookings', label: 'Bookings', icon: Calendar },
  ];

  const occupancy = dashboard?.occupancy;
  const inventory = dashboard?.inventory;

  return (
    <div className="space-y-6" data-testid="hangar-management">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Warehouse className="h-7 w-7 text-blue-500" />
            Smart Hangar Management
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Hangar slots, inventory tracking & aircraft parking
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setBookingDialog(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Book Slot
          </Button>
          <Button onClick={fetchDashboard} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {occupancy && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-600/30 rounded-xl p-4">
            <p className="text-blue-400 text-sm">Total Hangars</p>
            <p className="text-3xl font-bold text-white">{occupancy.summary.total_hangars}</p>
          </div>
          <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-600/30 rounded-xl p-4">
            <p className="text-green-400 text-sm">Total Capacity</p>
            <p className="text-3xl font-bold text-white">{occupancy.summary.total_capacity}</p>
          </div>
          <div className="bg-gradient-to-br from-orange-600/20 to-orange-800/20 border border-orange-600/30 rounded-xl p-4">
            <p className="text-orange-400 text-sm">Occupied</p>
            <p className="text-3xl font-bold text-white">{occupancy.summary.total_occupied}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-600/30 rounded-xl p-4">
            <p className="text-purple-400 text-sm">Available</p>
            <p className="text-3xl font-bold text-white">{occupancy.summary.total_available}</p>
          </div>
          <div className="bg-gradient-to-br from-cyan-600/20 to-cyan-800/20 border border-cyan-600/30 rounded-xl p-4">
            <p className="text-cyan-400 text-sm">Occupancy Rate</p>
            <p className="text-3xl font-bold text-white">{occupancy.summary.overall_occupancy_percentage}%</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-colors ${
              activeTab === tab.id 
                ? 'bg-blue-600 text-white' 
                : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Occupancy Tab */}
      {activeTab === 'occupancy' && occupancy && (
        <div className="space-y-6">
          {/* Occupancy Chart */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Hangar Occupancy Overview</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={occupancy.occupancy}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} angle={-15} textAnchor="end" />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                />
                <Bar dataKey="capacity" name="Capacity" fill="#3b82f6" />
                <Bar dataKey="occupied" name="Occupied" fill="#f97316" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Hangar Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {occupancy.occupancy.map((hangar) => (
              <div key={hangar.hangar_id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-white">{hangar.name}</h4>
                    <p className="text-sm text-slate-400 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {hangar.location}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    hangar.occupancy_percentage > 80 ? 'bg-red-600/20 text-red-400' :
                    hangar.occupancy_percentage > 50 ? 'bg-yellow-600/20 text-yellow-400' :
                    'bg-green-600/20 text-green-400'
                  }`}>
                    {hangar.occupancy_percentage}% Full
                  </span>
                </div>

                {/* Capacity Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">Slots: {hangar.occupied}/{hangar.capacity}</span>
                    <span className="text-green-400">{hangar.available} available</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        hangar.occupancy_percentage > 80 ? 'bg-red-500' :
                        hangar.occupancy_percentage > 50 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${hangar.occupancy_percentage}%` }}
                    />
                  </div>
                </div>

                {/* Facilities */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {hangar.facilities?.slice(0, 3).map(f => (
                    <span key={f} className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">
                      {f.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>

                {/* Parked Aircraft */}
                {hangar.parked_aircraft?.length > 0 && (
                  <div className="border-t border-slate-700 pt-3 mt-3">
                    <p className="text-xs text-slate-400 mb-2">Parked Aircraft:</p>
                    <div className="flex flex-wrap gap-1">
                      {hangar.parked_aircraft.map((a, i) => (
                        <span key={i} className="px-2 py-0.5 bg-orange-600/20 text-orange-400 rounded text-xs font-mono">
                          {a.aircraft_registration}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rate */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700">
                  <span className="text-sm text-slate-400">Daily Rate</span>
                  <span className="text-white font-bold">₹{hangar.daily_rate?.toLocaleString()}</span>
                </div>

                <Button 
                  onClick={() => { setSelectedHangar(hangar); setBookingDialog(true); }}
                  className="w-full mt-3 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30"
                  variant="ghost"
                  disabled={hangar.available === 0}
                >
                  {hangar.available > 0 ? 'Book Slot' : 'No Slots Available'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inventory Tab */}
      {activeTab === 'inventory' && inventory && (
        <div className="space-y-6">
          {/* Inventory Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-600/30 rounded-xl p-4">
              <p className="text-blue-400 text-sm">Total Items</p>
              <p className="text-3xl font-bold text-white">{inventory.summary.total_items}</p>
            </div>
            <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-600/30 rounded-xl p-4">
              <p className="text-green-400 text-sm">Total Value</p>
              <p className="text-3xl font-bold text-white">₹{(inventory.summary.total_value / 100000).toFixed(1)}L</p>
            </div>
            <div className="bg-gradient-to-br from-red-600/20 to-red-800/20 border border-red-600/30 rounded-xl p-4">
              <p className="text-red-400 text-sm">Low Stock Alerts</p>
              <p className="text-3xl font-bold text-white">{inventory.summary.low_stock_count}</p>
            </div>
          </div>

          {/* Inventory Table */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Boxes className="h-5 w-5 text-blue-500" />
              Inventory Items
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-slate-400 text-sm border-b border-slate-700">
                    <th className="pb-3">Item</th>
                    <th className="pb-3">Part #</th>
                    <th className="pb-3">Category</th>
                    <th className="pb-3">Qty</th>
                    <th className="pb-3">Min</th>
                    <th className="pb-3">Unit Cost</th>
                    <th className="pb-3">Location</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-700/50">
                      <td className="py-3 text-white font-medium">{item.name}</td>
                      <td className="py-3 text-slate-400 font-mono text-sm">{item.part_number}</td>
                      <td className="py-3">
                        <span className="px-2 py-1 bg-slate-700 rounded text-xs capitalize">
                          {item.category?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 text-white font-bold">{item.quantity}</td>
                      <td className="py-3 text-slate-400">{item.min_quantity}</td>
                      <td className="py-3 text-green-400">₹{item.unit_cost?.toLocaleString()}</td>
                      <td className="py-3 text-slate-400">{item.location}</td>
                      <td className="py-3">
                        {item.quantity <= item.min_quantity ? (
                          <span className="flex items-center gap-1 text-red-400 text-sm">
                            <AlertTriangle className="h-4 w-4" />
                            Low Stock
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-green-400 text-sm">
                            <CheckCircle className="h-4 w-4" />
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Bookings Tab */}
      {activeTab === 'bookings' && dashboard && (
        <div className="space-y-6">
          {/* Revenue Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-600/30 rounded-xl p-4">
              <p className="text-green-400 text-sm">This Month Revenue</p>
              <p className="text-3xl font-bold text-white">₹{(dashboard.revenue?.this_month / 100000).toFixed(1)}L</p>
            </div>
            <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-600/30 rounded-xl p-4">
              <p className="text-blue-400 text-sm">Total Bookings (This Month)</p>
              <p className="text-3xl font-bold text-white">{dashboard.revenue?.total_bookings}</p>
            </div>
          </div>

          {/* Upcoming Bookings */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-500" />
              Upcoming Bookings (Next 7 Days)
            </h3>
            
            {dashboard.upcoming_bookings?.length > 0 ? (
              <div className="space-y-3">
                {dashboard.upcoming_bookings.map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                        <PlaneTakeoff className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-white">{booking.aircraft_registration}</p>
                        <p className="text-sm text-slate-400">{booking.hangar_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white">{booking.start_date} → {booking.end_date}</p>
                      <p className="text-sm text-orange-400">{booking.purpose}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 font-bold">₹{booking.total_cost?.toLocaleString()}</p>
                      <p className="text-xs text-slate-400">{booking.days} days</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-center py-8">No upcoming bookings</p>
            )}
          </div>
        </div>
      )}

      {/* Booking Dialog */}
      <Dialog open={bookingDialog} onOpenChange={setBookingDialog}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Book Hangar Slot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-slate-400">
              {selectedHangar ? `Booking for: ${selectedHangar.name}` : 'Select a hangar from the list'}
            </p>
            <p className="text-sm text-orange-400">
              Feature coming soon - Contact admin for manual booking
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SmartHangarManagement;
