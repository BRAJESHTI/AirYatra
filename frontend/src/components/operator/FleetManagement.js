import React, { useState, useEffect } from 'react';
import { Plane, Plus, Edit, Trash2, CheckCircle, FileText, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fleetAPI, aircraftDocumentAPI } from '../../services/api';
import { toast } from 'sonner';
import DocumentUploader from '../DocumentUploader';
import DocumentViewer from '../DocumentViewer';

function FleetManagement({ operator }) {
  const [aircraft, setAircraft] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedAircraft, setSelectedAircraft] = useState(null);
  const [isDocDialogOpen, setIsDocDialogOpen] = useState(false);
  const [aircraftDocs, setAircraftDocs] = useState({ photos: [], documents: [] });
  const [formData, setFormData] = useState({
    aircraft_type: '',
    manufacturer: '',
    model_name: '',
    manufacture_year: '',
    registration_number: '',
    capacity: '',
    base_location: '',
    hourly_rate: '',
    enrollment_odometer_km: '',
  });

  useEffect(() => {
    fetchAircraft();
  }, []);

  const fetchAircraft = async () => {
    try {
      const response = await fleetAPI.getAll();
      setAircraft(response.data.aircraft);
    } catch (error) {
      toast.error('Failed to load aircraft');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await fleetAPI.create({
        ...formData,
        capacity: parseInt(formData.capacity),
        hourly_rate: parseFloat(formData.hourly_rate),
        manufacture_year: formData.manufacture_year ? parseInt(formData.manufacture_year) : null,
        enrollment_odometer_km: formData.enrollment_odometer_km ? parseFloat(formData.enrollment_odometer_km) : 0,
      });
      toast.success('Aircraft added successfully');
      setIsAddDialogOpen(false);
      setFormData({
        aircraft_type: '',
        manufacturer: '',
        model_name: '',
        manufacture_year: '',
        registration_number: '',
        capacity: '',
        base_location: '',
        hourly_rate: '',
        enrollment_odometer_km: '',
      });
      fetchAircraft();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add aircraft');
    }
  };

  const handleViewDocuments = async (aircraft) => {
    setSelectedAircraft(aircraft);
    setIsDocDialogOpen(true);
    await fetchAircraftDocuments(aircraft.id);
  };

  const fetchAircraftDocuments = async (aircraftId) => {
    try {
      const response = await aircraftDocumentAPI.getAircraftDocuments(aircraftId);
      setAircraftDocs(response.data);
    } catch (error) {
      toast.error('Failed to load documents');
    }
  };

  const handleDocumentUploadComplete = () => {
    if (selectedAircraft) {
      fetchAircraftDocuments(selectedAircraft.id);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this aircraft?')) return;
    
    try {
      await fleetAPI.delete(id);
      toast.success('Aircraft deleted');
      fetchAircraft();
    } catch (error) {
      toast.error('Failed to delete aircraft');
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="max-w-6xl mx-auto" data-testid="fleet-management">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2" data-testid="fleet-title">Fleet Management</h1>
          <p className="text-slate-400">Manage your helicopter fleet</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-orange-500 hover:bg-orange-600" data-testid="add-aircraft-btn">
              <Plus className="h-5 w-5 mr-2" />
              Add Aircraft
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Add New Aircraft</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="add-aircraft-form">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manufacturer">Manufacturer *</Label>
                  <Input
                    id="manufacturer"
                    name="manufacturer"
                    placeholder="Bell Helicopter"
                    value={formData.manufacturer}
                    onChange={handleChange}
                    required
                    className="bg-slate-800 border-slate-700"
                    data-testid="manufacturer-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model_name">Model Name *</Label>
                  <Input
                    id="model_name"
                    name="model_name"
                    placeholder="407GXi"
                    value={formData.model_name}
                    onChange={handleChange}
                    required
                    className="bg-slate-800 border-slate-700"
                    data-testid="model-name-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="aircraft_type">Full Aircraft Type *</Label>
                <Input
                  id="aircraft_type"
                  name="aircraft_type"
                  placeholder="Bell 407GXi"
                  value={formData.aircraft_type}
                  onChange={handleChange}
                  required
                  className="bg-slate-800 border-slate-700"
                  data-testid="aircraft-type-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manufacture_year">Year of Manufacture *</Label>
                  <Input
                    id="manufacture_year"
                    name="manufacture_year"
                    type="number"
                    min="1950"
                    max="2030"
                    placeholder="2020"
                    value={formData.manufacture_year}
                    onChange={handleChange}
                    required
                    className="bg-slate-800 border-slate-700"
                    data-testid="manufacture-year-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="registration_number">Registration Number *</Label>
                  <Input
                    id="registration_number"
                    name="registration_number"
                    placeholder="VT-ABC"
                    value={formData.registration_number}
                    onChange={handleChange}
                    required
                    className="bg-slate-800 border-slate-700"
                    data-testid="registration-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="capacity">Passenger Capacity *</Label>
                  <Input
                    id="capacity"
                    name="capacity"
                    type="number"
                    min="1"
                    max="20"
                    placeholder="6"
                    value={formData.capacity}
                    onChange={handleChange}
                    required
                    className="bg-slate-800 border-slate-700"
                    data-testid="capacity-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hourly_rate">Hourly Rate (₹) *</Label>
                  <Input
                    id="hourly_rate"
                    name="hourly_rate"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="50000"
                    value={formData.hourly_rate}
                    onChange={handleChange}
                    required
                    className="bg-slate-800 border-slate-700"
                    data-testid="hourly-rate-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="base_location">Base Location *</Label>
                <Input
                  id="base_location"
                  name="base_location"
                  placeholder="Mumbai"
                  value={formData.base_location}
                  onChange={handleChange}
                  required
                  className="bg-slate-800 border-slate-700"
                  data-testid="base-location-input"
                />
              </div>

              <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600" data-testid="submit-aircraft-btn">
                Add Aircraft
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Aircraft List */}
      <div className="glass p-6 rounded-lg">
        {loading ? (
          <div className="text-slate-400">Loading aircraft...</div>
        ) : aircraft.length === 0 ? (
          <div className="text-center py-12">
            <Plane className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 mb-4">No aircraft in your fleet yet</p>
            <Button onClick={() => setIsAddDialogOpen(true)} className="bg-orange-500 hover:bg-orange-600" data-testid="add-first-aircraft-btn">
              Add Your First Aircraft
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {aircraft.map((item) => (
              <div key={item.id} className="bg-slate-800 p-6 rounded-lg border border-slate-700" data-testid={`aircraft-${item.id}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">{item.aircraft_type}</h3>
                    <p className="text-slate-400 text-sm">{item.registration_number}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(item.id)}
                      className="text-red-400 hover:text-red-300"
                      data-testid={`delete-aircraft-${item.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Capacity:</span>
                    <span className="text-white font-medium">{item.capacity} passengers</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Base Location:</span>
                    <span className="text-white font-medium">{item.base_location}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Hourly Rate:</span>
                    <span className="text-white font-medium">₹{item.hourly_rate.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Status:</span>
                    <span className={`flex items-center space-x-1 ${
                      item.is_available ? 'text-green-400' : 'text-red-400'
                    }`}>
                      <CheckCircle className="h-4 w-4" />
                      <span>{item.is_available ? 'Available' : 'Unavailable'}</span>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default FleetManagement;