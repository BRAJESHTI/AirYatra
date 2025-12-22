import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Mail, Phone, Award, FileText, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { operatorAPI, pilotDocumentAPI } from '../../services/api';
import { toast } from 'sonner';
import DocumentUploader from '../DocumentUploader';
import DocumentViewer from '../DocumentViewer';

function PilotManagement({ operator }) {
  const [pilots, setPilots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedPilot, setSelectedPilot] = useState(null);
  const [isDocDialogOpen, setIsDocDialogOpen] = useState(false);
  const [pilotDocuments, setPilotDocuments] = useState([]);
  const [formData, setFormData] = useState({
    full_name: '',
    license_number: '',
    phone: '',
    email: '',
    experience_years: '',
  });

  useEffect(() => {
    fetchPilots();
  }, []);

  const fetchPilots = async () => {
    try {
      const response = await operatorAPI.getPilots();
      setPilots(response.data.pilots);
    } catch (error) {
      toast.error('Failed to load pilots');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await operatorAPI.createPilot({
        ...formData,
        experience_years: parseInt(formData.experience_years),
      });
      toast.success('Pilot added successfully');
      setIsAddDialogOpen(false);
      setFormData({
        full_name: '',
        license_number: '',
        phone: '',
        email: '',
        experience_years: '',
      });
      fetchPilots();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add pilot');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this pilot?')) return;
    
    try {
      await operatorAPI.deletePilot(id);
      toast.success('Pilot removed');
      fetchPilots();
    } catch (error) {
      toast.error('Failed to remove pilot');
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleViewDocuments = async (pilot) => {
    setSelectedPilot(pilot);
    setIsDocDialogOpen(true);
    await fetchPilotDocuments(pilot.id);
  };

  const fetchPilotDocuments = async (pilotId) => {
    try {
      const response = await pilotDocumentAPI.getPilotDocuments(pilotId);
      setPilotDocuments(response.data.documents);
    } catch (error) {
      toast.error('Failed to load documents');
    }
  };

  const handleDocumentUploadComplete = () => {
    if (selectedPilot) {
      fetchPilotDocuments(selectedPilot.id);
    }
  };

  return (
    <div className="max-w-6xl mx-auto" data-testid="pilot-management">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2" data-testid="pilots-title">Pilot Management</h1>
          <p className="text-slate-400">Manage your pilot roster</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-orange-500 hover:bg-orange-600" data-testid="add-pilot-btn">
              <Plus className="h-5 w-5 mr-2" />
              Add Pilot
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Add New Pilot</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="add-pilot-form">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  name="full_name"
                  placeholder="Captain John Doe"
                  value={formData.full_name}
                  onChange={handleChange}
                  required
                  className="bg-slate-800 border-slate-700"
                  data-testid="pilot-name-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="license_number">License Number *</Label>
                <Input
                  id="license_number"
                  name="license_number"
                  placeholder="CPL-12345"
                  value={formData.license_number}
                  onChange={handleChange}
                  required
                  className="bg-slate-800 border-slate-700"
                  data-testid="license-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    name="phone"
                    placeholder="+91 9876543210"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    className="bg-slate-800 border-slate-700"
                    data-testid="pilot-phone-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="pilot@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="bg-slate-800 border-slate-700"
                    data-testid="pilot-email-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="experience_years">Experience (Years) *</Label>
                <Input
                  id="experience_years"
                  name="experience_years"
                  type="number"
                  min="0"
                  max="50"
                  placeholder="10"
                  value={formData.experience_years}
                  onChange={handleChange}
                  required
                  className="bg-slate-800 border-slate-700"
                  data-testid="experience-input"
                />
              </div>

              <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600" data-testid="submit-pilot-btn">
                Add Pilot
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pilots List */}
      <div className="glass p-6 rounded-lg">
        {loading ? (
          <div className="text-slate-400">Loading pilots...</div>
        ) : pilots.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 mb-4">No pilots added yet</p>
            <Button onClick={() => setIsAddDialogOpen(true)} className="bg-orange-500 hover:bg-orange-600" data-testid="add-first-pilot-btn">
              Add Your First Pilot
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {pilots.map((pilot) => (
              <div key={pilot.id} className="bg-slate-800 p-6 rounded-lg border border-slate-700" data-testid={`pilot-${pilot.id}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">{pilot.full_name}</h3>
                    <div className="flex items-center space-x-2 text-slate-400 text-sm mt-1">
                      <Award className="h-4 w-4" />
                      <span>{pilot.license_number}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(pilot.id)}
                    className="text-red-400 hover:text-red-300"
                    data-testid={`delete-pilot-${pilot.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-sm">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <span className="text-white">{pilot.phone}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <span className="text-white">{pilot.email}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <Award className="h-4 w-4 text-slate-400" />
                    <span className="text-white">{pilot.experience_years} years experience</span>
                  </div>
                  <div className="pt-3 border-t border-slate-700 flex items-center justify-between">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs ${
                      pilot.is_available ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {pilot.is_available ? 'Available' : 'Unavailable'}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewDocuments(pilot)}
                      className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                      data-testid={`view-docs-${pilot.id}`}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Documents
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pilot Documents Dialog */}
      <Dialog open={isDocDialogOpen} onOpenChange={setIsDocDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {selectedPilot?.full_name} - Documents
            </DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="view" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-slate-800">
              <TabsTrigger value="view" className="data-[state=active]:bg-orange-500">View Documents</TabsTrigger>
              <TabsTrigger value="upload" className="data-[state=active]:bg-orange-500">Upload New</TabsTrigger>
            </TabsList>
            
            <TabsContent value="view" className="mt-4">
              <DocumentViewer
                documents={pilotDocuments}
                onDelete={pilotDocumentAPI.deleteDocument}
                onRefresh={() => selectedPilot && fetchPilotDocuments(selectedPilot.id)}
              />
            </TabsContent>
            
            <TabsContent value="upload" className="mt-4 space-y-6">
              <DocumentUploader
                entityId={selectedPilot?.id}
                entityType="pilot"
                documentType="photo"
                apiService={pilotDocumentAPI}
                label="Pilot Photo"
                accept=".jpg,.jpeg,.png"
                onUploadComplete={handleDocumentUploadComplete}
              />
              
              <DocumentUploader
                entityId={selectedPilot?.id}
                entityType="pilot"
                documentType="license_copy"
                apiService={pilotDocumentAPI}
                label="License Copy"
                accept=".pdf,.jpg,.jpeg,.png"
                showIssueDate={true}
                showExpiryDate={true}
                onUploadComplete={handleDocumentUploadComplete}
              />
              
              <DocumentUploader
                entityId={selectedPilot?.id}
                entityType="pilot"
                documentType="experience_certificate"
                apiService={pilotDocumentAPI}
                label="Experience Certificate"
                accept=".pdf,.jpg,.jpeg,.png"
                onUploadComplete={handleDocumentUploadComplete}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PilotManagement;