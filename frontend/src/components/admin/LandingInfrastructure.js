import React, { useState, useEffect } from 'react';
import { 
  Plane, MapPin, Building2, TreePine, Plus, Search, Filter, Edit, Trash2, 
  Eye, Check, X, Calendar, DollarSign, FileText, AlertTriangle, ChevronDown,
  Globe, Navigation, Clock, Fuel, Loader2, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { landingAPI } from '@/services/api';
import { toast } from 'sonner';

// Landing Type Icons
const typeIcons = {
  airport: Plane,
  govt_helipad: Building2,
  private_helipad: Building2,
  village_land: TreePine,
};

// Landing Type Colors
const typeColors = {
  airport: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  govt_helipad: 'bg-green-500/20 text-green-400 border-green-500/30',
  private_helipad: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  village_land: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

// Landing Type Labels
const typeLabels = {
  airport: 'Airport',
  govt_helipad: 'Govt Helipad',
  private_helipad: 'Private Helipad',
  village_land: 'Village Land',
};

// Owner Type Labels
const ownerLabels = {
  government: 'Government',
  private: 'Private',
  trust: 'Trust',
  hotel: 'Hotel/Resort',
  hospital: 'Hospital',
  corporate: 'Corporate',
  individual: 'Individual',
};

// Category Labels
const categoryLabels = {
  airport: 'Airport',
  pilgrimage: 'Pilgrimage',
  hospital: 'Hospital/Medical',
  hotel_resort: 'Hotel/Resort',
  corporate: 'Corporate',
  state_government: 'State Government',
  central_government: 'Central Government',
  military: 'Military',
  private_estate: 'Private Estate',
};

// Indian States
const indianStates = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Chandigarh', 'Jammu & Kashmir', 'Ladakh', 'Puducherry'
];

function LandingInfrastructure() {
  const [landingPoints, setLandingPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterState, setFilterState] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({
    airports: 0,
    govt_helipads: 0,
    private_helipads: 0,
    village_lands: 0
  });

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'airport',
    owner_type: 'government',
    category: '',
    city: '',
    district: '',
    state: '',
    address: '',
    pincode: '',
    latitude: '',
    longitude: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    icao_code: '',
    facilities: [],
    operating_hours: '',
    permission_required: false,
    rent_applicable: false,
    availability_calendar_required: false,
    lighting_available: false,
    fuel_available: false,
    night_operations: false,
    notes: ''
  });

  useEffect(() => {
    loadLandingPoints();
  }, [page, filterType, filterState]);

  const loadLandingPoints = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (filterType !== 'all') params.type = filterType;
      if (filterState !== 'all') params.state = filterState;
      
      const response = await landingAPI.getLandingPoints(params);
      setLandingPoints(response.data.landing_points || []);
      setTotalPages(response.data.pages || 1);
      
      // Calculate stats
      const allPoints = response.data.landing_points || [];
      setStats({
        airports: allPoints.filter(p => p.type === 'airport').length,
        govt_helipads: allPoints.filter(p => p.type === 'govt_helipad').length,
        private_helipads: allPoints.filter(p => p.type === 'private_helipad').length,
        village_lands: allPoints.filter(p => p.type === 'village_land').length
      });
    } catch (error) {
      toast.error('Failed to load landing points');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      // Validate required fields
      if (!formData.name || !formData.type || !formData.city || !formData.state) {
        toast.error('Please fill all required fields');
        return;
      }
      
      const data = {
        ...formData,
        latitude: parseFloat(formData.latitude) || null,
        longitude: parseFloat(formData.longitude) || null,
      };
      
      await landingAPI.createLandingPoint(data);
      toast.success('Landing point created successfully');
      setShowAddModal(false);
      resetForm();
      loadLandingPoints();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create landing point');
    }
  };

  const handleUpdate = async () => {
    try {
      const data = {
        ...formData,
        latitude: parseFloat(formData.latitude) || null,
        longitude: parseFloat(formData.longitude) || null,
      };
      
      await landingAPI.updateLandingPoint(selectedPoint.id, data);
      toast.success('Landing point updated successfully');
      setShowEditModal(false);
      loadLandingPoints();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update landing point');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this landing point?')) return;
    
    try {
      await landingAPI.deleteLandingPoint(id);
      toast.success('Landing point deleted');
      loadLandingPoints();
    } catch (error) {
      toast.error('Failed to delete landing point');
    }
  };

  const openEditModal = (point) => {
    setSelectedPoint(point);
    setFormData({
      name: point.name || '',
      type: point.type || 'airport',
      owner_type: point.owner_type || 'government',
      category: point.category || '',
      city: point.city || '',
      district: point.district || '',
      state: point.state || '',
      address: point.address || '',
      pincode: point.pincode || '',
      latitude: point.latitude?.toString() || '',
      longitude: point.longitude?.toString() || '',
      contact_name: point.contact_name || '',
      contact_phone: point.contact_phone || '',
      contact_email: point.contact_email || '',
      icao_code: point.icao_code || '',
      facilities: point.facilities || [],
      operating_hours: point.operating_hours || '',
      permission_required: point.permission_required || false,
      rent_applicable: point.rent_applicable || false,
      availability_calendar_required: point.availability_calendar_required || false,
      lighting_available: point.lighting_available || false,
      fuel_available: point.fuel_available || false,
      night_operations: point.night_operations || false,
      notes: point.notes || ''
    });
    setShowEditModal(true);
  };

  const openDetailModal = (point) => {
    setSelectedPoint(point);
    setShowDetailModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'airport',
      owner_type: 'government',
      category: '',
      city: '',
      district: '',
      state: '',
      address: '',
      pincode: '',
      latitude: '',
      longitude: '',
      contact_name: '',
      contact_phone: '',
      contact_email: '',
      icao_code: '',
      facilities: [],
      operating_hours: '',
      permission_required: false,
      rent_applicable: false,
      availability_calendar_required: false,
      lighting_available: false,
      fuel_available: false,
      night_operations: false,
      notes: ''
    });
  };

  const filteredPoints = landingPoints.filter(point => {
    const matchesSearch = point.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         point.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         point.code?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const TypeIcon = ({ type }) => {
    const Icon = typeIcons[type] || MapPin;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Landing Infrastructure</h2>
          <p className="text-slate-400">Manage airports, helipads, and landing points</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="bg-orange-500 hover:bg-orange-600">
          <Plus className="h-4 w-4 mr-2" /> Add Landing Point
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="glass p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Plane className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.airports}</p>
              <p className="text-sm text-slate-400">Airports</p>
            </div>
          </div>
        </div>
        <div className="glass p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Building2 className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.govt_helipads}</p>
              <p className="text-sm text-slate-400">Govt Helipads</p>
            </div>
          </div>
        </div>
        <div className="glass p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Building2 className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.private_helipads}</p>
              <p className="text-sm text-slate-400">Private Helipads</p>
            </div>
          </div>
        </div>
        <div className="glass p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <TreePine className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.village_lands}</p>
              <p className="text-sm text-slate-400">Village Lands</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name, city, or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-600 text-white"
          />
        </div>
        
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48 bg-slate-800 border-slate-600 text-white">
            <SelectValue placeholder="Filter by Type" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-600">
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="airport">Airports</SelectItem>
            <SelectItem value="govt_helipad">Govt Helipads</SelectItem>
            <SelectItem value="private_helipad">Private Helipads</SelectItem>
            <SelectItem value="village_land">Village Lands</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterState} onValueChange={setFilterState}>
          <SelectTrigger className="w-48 bg-slate-800 border-slate-600 text-white">
            <SelectValue placeholder="Filter by State" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-600 max-h-60">
            <SelectItem value="all">All States</SelectItem>
            {indianStates.map(state => (
              <SelectItem key={state} value={state}>{state}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={loadLandingPoints} className="border-slate-600">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Table */}
      <div className="glass rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-orange-400 animate-spin" />
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="text-left p-4 text-slate-400 font-medium">Landing Point</th>
                <th className="text-left p-4 text-slate-400 font-medium">Type</th>
                <th className="text-left p-4 text-slate-400 font-medium">Location</th>
                <th className="text-left p-4 text-slate-400 font-medium">Rules</th>
                <th className="text-left p-4 text-slate-400 font-medium">Status</th>
                <th className="text-right p-4 text-slate-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPoints.map((point) => (
                <tr key={point.id} className="border-t border-slate-700/50 hover:bg-slate-800/30">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${typeColors[point.type]}`}>
                        <TypeIcon type={point.type} />
                      </div>
                      <div>
                        <p className="text-white font-medium">{point.name}</p>
                        <p className="text-sm text-slate-400">{point.code}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs ${typeColors[point.type]}`}>
                      {typeLabels[point.type]}
                    </span>
                  </td>
                  <td className="p-4">
                    <p className="text-white">{point.city}</p>
                    <p className="text-sm text-slate-400">{point.state}</p>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      {point.permission_required && (
                        <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                          Permission
                        </span>
                      )}
                      {point.rent_applicable && (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                          Rent
                        </span>
                      )}
                      {point.availability_calendar_required && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                          Calendar
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    {point.is_active ? (
                      <span className="flex items-center gap-1 text-green-400 text-sm">
                        <Check className="h-4 w-4" /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-400 text-sm">
                        <X className="h-4 w-4" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openDetailModal(point)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEditModal(point)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-400" onClick={() => handleDelete(point.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 p-4 border-t border-slate-700">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </Button>
            <span className="text-slate-400 px-4 py-2">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={showAddModal || showEditModal} onOpenChange={() => { setShowAddModal(false); setShowEditModal(false); }}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {showEditModal ? 'Edit Landing Point' : 'Add New Landing Point'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {showEditModal ? 'Update landing point details' : 'Add a new airport, helipad, or village landing point'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label className="text-slate-300">Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g., Kedarnath Helipad"
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>

              <div>
                <Label className="text-slate-300">Type *</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({...formData, type: v})}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    <SelectItem value="airport">Airport</SelectItem>
                    <SelectItem value="govt_helipad">Government Helipad</SelectItem>
                    <SelectItem value="private_helipad">Private Helipad</SelectItem>
                    <SelectItem value="village_land">Village/Private Land</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-slate-300">Owner Type</Label>
                <Select value={formData.owner_type} onValueChange={(v) => setFormData({...formData, owner_type: v})}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {Object.entries(ownerLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-slate-300">Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.type === 'airport' && (
                <div>
                  <Label className="text-slate-300">ICAO Code</Label>
                  <Input
                    value={formData.icao_code}
                    onChange={(e) => setFormData({...formData, icao_code: e.target.value.toUpperCase()})}
                    placeholder="e.g., VIDP"
                    maxLength={4}
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
              )}
            </div>

            {/* Location */}
            <div className="border-t border-slate-700 pt-4">
              <h4 className="text-white font-medium mb-4">Location Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">City *</Label>
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                    placeholder="e.g., Kedarnath"
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">District</Label>
                  <Input
                    value={formData.district}
                    onChange={(e) => setFormData({...formData, district: e.target.value})}
                    placeholder="e.g., Rudraprayag"
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">State *</Label>
                  <Select value={formData.state} onValueChange={(v) => setFormData({...formData, state: v})}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600 max-h-60">
                      {indianStates.map(state => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300">PIN Code</Label>
                  <Input
                    value={formData.pincode}
                    onChange={(e) => setFormData({...formData, pincode: e.target.value})}
                    placeholder="e.g., 246445"
                    maxLength={6}
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Latitude</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={formData.latitude}
                    onChange={(e) => setFormData({...formData, latitude: e.target.value})}
                    placeholder="e.g., 30.7346"
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Longitude</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={formData.longitude}
                    onChange={(e) => setFormData({...formData, longitude: e.target.value})}
                    placeholder="e.g., 79.0669"
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-slate-300">Address</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    placeholder="Full address"
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
              </div>
            </div>

            {/* Rules & Settings */}
            <div className="border-t border-slate-700 pt-4">
              <h4 className="text-white font-medium mb-4">Rules & Settings</h4>
              <div className="grid grid-cols-3 gap-4">
                <label className="flex items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.permission_required}
                    onChange={(e) => setFormData({...formData, permission_required: e.target.checked})}
                    className="rounded bg-slate-800 border-slate-600"
                  />
                  Permission Required
                </label>
                <label className="flex items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.rent_applicable}
                    onChange={(e) => setFormData({...formData, rent_applicable: e.target.checked})}
                    className="rounded bg-slate-800 border-slate-600"
                  />
                  Rent Applicable
                </label>
                <label className="flex items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.availability_calendar_required}
                    onChange={(e) => setFormData({...formData, availability_calendar_required: e.target.checked})}
                    className="rounded bg-slate-800 border-slate-600"
                  />
                  Availability Calendar
                </label>
                <label className="flex items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.lighting_available}
                    onChange={(e) => setFormData({...formData, lighting_available: e.target.checked})}
                    className="rounded bg-slate-800 border-slate-600"
                  />
                  Lighting Available
                </label>
                <label className="flex items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.fuel_available}
                    onChange={(e) => setFormData({...formData, fuel_available: e.target.checked})}
                    className="rounded bg-slate-800 border-slate-600"
                  />
                  Fuel Available
                </label>
                <label className="flex items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.night_operations}
                    onChange={(e) => setFormData({...formData, night_operations: e.target.checked})}
                    className="rounded bg-slate-800 border-slate-600"
                  />
                  Night Operations
                </label>
              </div>
            </div>

            {/* Contact Info */}
            <div className="border-t border-slate-700 pt-4">
              <h4 className="text-white font-medium mb-4">Contact Information</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-slate-300">Contact Name</Label>
                  <Input
                    value={formData.contact_name}
                    onChange={(e) => setFormData({...formData, contact_name: e.target.value})}
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Phone</Label>
                  <Input
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Email</Label>
                  <Input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({...formData, contact_email: e.target.value})}
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label className="text-slate-300">Notes</Label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white"
                rows={3}
                placeholder="Additional notes..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
              <Button variant="outline" onClick={() => { setShowAddModal(false); setShowEditModal(false); }}>
                Cancel
              </Button>
              <Button onClick={showEditModal ? handleUpdate : handleCreate} className="bg-orange-500 hover:bg-orange-600">
                {showEditModal ? 'Update' : 'Create'} Landing Point
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <TypeIcon type={selectedPoint?.type} />
              {selectedPoint?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedPoint && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-400">Code</p>
                  <p className="text-white font-mono">{selectedPoint.code}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Type</p>
                  <span className={`px-2 py-1 rounded text-xs ${typeColors[selectedPoint.type]}`}>
                    {typeLabels[selectedPoint.type]}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Location</p>
                  <p className="text-white">{selectedPoint.city}, {selectedPoint.district}</p>
                  <p className="text-sm text-slate-400">{selectedPoint.state}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Coordinates</p>
                  <p className="text-white font-mono text-sm">
                    {selectedPoint.latitude?.toFixed(4)}, {selectedPoint.longitude?.toFixed(4)}
                  </p>
                </div>
                {selectedPoint.icao_code && (
                  <div>
                    <p className="text-sm text-slate-400">ICAO Code</p>
                    <p className="text-white font-mono">{selectedPoint.icao_code}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-slate-400">Owner Type</p>
                  <p className="text-white">{ownerLabels[selectedPoint.owner_type]}</p>
                </div>
              </div>

              <div className="border-t border-slate-700 pt-4">
                <p className="text-sm text-slate-400 mb-2">Rules</p>
                <div className="flex flex-wrap gap-2">
                  {selectedPoint.permission_required && (
                    <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm">
                      ⚠️ Permission Required
                    </span>
                  )}
                  {selectedPoint.rent_applicable && (
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
                      💰 Rent Applicable
                    </span>
                  )}
                  {selectedPoint.availability_calendar_required && (
                    <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
                      📅 Calendar Required
                    </span>
                  )}
                  {selectedPoint.fuel_available && (
                    <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm">
                      ⛽ Fuel Available
                    </span>
                  )}
                  {selectedPoint.night_operations && (
                    <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-full text-sm">
                      🌙 Night Ops
                    </span>
                  )}
                </div>
              </div>

              {selectedPoint.contact_name && (
                <div className="border-t border-slate-700 pt-4">
                  <p className="text-sm text-slate-400 mb-2">Contact</p>
                  <p className="text-white">{selectedPoint.contact_name}</p>
                  <p className="text-slate-400">{selectedPoint.contact_phone}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default LandingInfrastructure;
