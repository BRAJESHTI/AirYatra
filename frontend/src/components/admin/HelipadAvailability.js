import React, { useState, useEffect } from 'react';
import { 
  Calendar, ChevronLeft, ChevronRight, Plus, X, Check, Clock, 
  AlertCircle, Loader2, Building2, MapPin
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

function HelipadAvailability() {
  const [helipads, setHelipads] = useState([]);
  const [selectedHelipad, setSelectedHelipad] = useState(null);
  const [calendar, setCalendar] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  
  // Slot form
  const [slotForm, setSlotForm] = useState({
    date: '',
    from_time: '06:00',
    to_time: '18:00',
    status: 'available',
    reason: ''
  });

  // Bulk form
  const [bulkForm, setBulkForm] = useState({
    start_date: '',
    end_date: '',
    status: 'available',
    reason: ''
  });

  useEffect(() => {
    loadHelipads();
  }, []);

  useEffect(() => {
    if (selectedHelipad) {
      loadCalendar();
    }
  }, [selectedHelipad, currentMonth]);

  const loadHelipads = async () => {
    try {
      const response = await landingAPI.getLandingPoints({ 
        type: 'private_helipad',
        limit: 100 
      });
      // Also get govt helipads with calendar requirement
      const govtResponse = await landingAPI.getLandingPoints({ 
        type: 'govt_helipad',
        limit: 100 
      });
      
      const allHelipads = [
        ...(response.data.landing_points || []),
        ...(govtResponse.data.landing_points || [])
      ].filter(h => h.availability_calendar_required);
      
      setHelipads(allHelipads);
      if (allHelipads.length > 0 && !selectedHelipad) {
        setSelectedHelipad(allHelipads[0]);
      }
    } catch (error) {
      console.error('Failed to load helipads:', error);
    }
  };

  const loadCalendar = async () => {
    if (!selectedHelipad) return;
    setLoading(true);
    try {
      const month = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
      const response = await landingAPI.getAvailabilityCalendar(selectedHelipad.id, month);
      setCalendar(response.data.calendar || []);
    } catch (error) {
      console.error('Failed to load calendar:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSlot = async () => {
    if (!selectedHelipad) return;
    
    try {
      await landingAPI.createAvailabilitySlot({
        landing_point_id: selectedHelipad.id,
        ...slotForm
      });
      toast.success('Availability slot created');
      setShowSlotModal(false);
      loadCalendar();
    } catch (error) {
      toast.error('Failed to create slot');
    }
  };

  const handleBulkCreate = async () => {
    if (!selectedHelipad) return;
    
    try {
      await landingAPI.createBulkAvailability({
        landing_point_id: selectedHelipad.id,
        ...bulkForm
      });
      toast.success('Bulk availability created');
      setShowBulkModal(false);
      loadCalendar();
    } catch (error) {
      toast.error('Failed to create bulk availability');
    }
  };

  const openSlotModal = (date) => {
    setSelectedDate(date);
    setSlotForm({
      date: date,
      from_time: '06:00',
      to_time: '18:00',
      status: 'available',
      reason: ''
    });
    setShowSlotModal(true);
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    
    const days = [];
    
    // Padding days from previous month
    for (let i = 0; i < startPadding; i++) {
      days.push({ date: null, isPadding: true });
    }
    
    // Days of current month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const slot = calendar.find(s => s.date === dateStr);
      days.push({
        date: dateStr,
        day,
        slot,
        isPast: new Date(dateStr) < new Date().setHours(0, 0, 0, 0)
      });
    }
    
    return days;
  };

  const getSlotColor = (slot) => {
    if (!slot) return 'bg-slate-800/50 hover:bg-slate-700/50 cursor-pointer';
    switch (slot.status) {
      case 'available':
        return 'bg-green-500/20 border-green-500/30 text-green-400';
      case 'blocked':
        return 'bg-red-500/20 border-red-500/30 text-red-400';
      case 'maintenance':
        return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400';
      case 'booked':
        return 'bg-blue-500/20 border-blue-500/30 text-blue-400';
      default:
        return 'bg-slate-800/50';
    }
  };

  const days = generateCalendarDays();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Helipad Availability</h2>
          <p className="text-slate-400">Manage helipad availability calendar</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowBulkModal(true)} variant="outline" className="border-slate-600">
            <Calendar className="h-4 w-4 mr-2" /> Bulk Update
          </Button>
        </div>
      </div>

      {/* Helipad Selector */}
      <div className="glass p-4 rounded-xl">
        <Label className="text-slate-300 mb-2 block">Select Helipad</Label>
        <Select 
          value={selectedHelipad?.id || ''} 
          onValueChange={(id) => setSelectedHelipad(helipads.find(h => h.id === id))}
        >
          <SelectTrigger className="w-full bg-slate-800 border-slate-600 text-white">
            <SelectValue placeholder="Select a helipad" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-600 max-h-60">
            {helipads.map(helipad => (
              <SelectItem key={helipad.id} value={helipad.id}>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-purple-400" />
                  <span>{helipad.name}</span>
                  <span className="text-slate-400 text-sm">({helipad.city}, {helipad.state})</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedHelipad && (
        <>
          {/* Selected Helipad Info */}
          <div className="glass p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/20 rounded-lg">
                <Building2 className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">{selectedHelipad.name}</h3>
                <p className="text-slate-400 text-sm flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {selectedHelipad.city}, {selectedHelipad.state}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                <span className="text-sm text-slate-400">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span className="text-sm text-slate-400">Blocked</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                <span className="text-sm text-slate-400">Maintenance</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                <span className="text-sm text-slate-400">Booked</span>
              </div>
            </div>
          </div>

          {/* Calendar */}
          <div className="glass rounded-xl overflow-hidden">
            {/* Month Navigation */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <Button variant="ghost" size="sm" onClick={prevMonth}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h3 className="text-lg font-semibold text-white">
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h3>
              <Button variant="ghost" size="sm" onClick={nextMonth}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            {/* Calendar Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 text-orange-400 animate-spin" />
              </div>
            ) : (
              <div className="p-4">
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-sm font-medium text-slate-400 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-2">
                  {days.map((dayInfo, index) => (
                    <div
                      key={index}
                      className={`
                        min-h-[80px] p-2 rounded-lg border transition-all
                        ${dayInfo.isPadding ? 'bg-transparent border-transparent' : ''}
                        ${dayInfo.isPast && !dayInfo.isPadding ? 'opacity-50' : ''}
                        ${!dayInfo.isPadding && !dayInfo.isPast ? getSlotColor(dayInfo.slot) : ''}
                        ${!dayInfo.isPadding && !dayInfo.isPast && !dayInfo.slot ? 'cursor-pointer hover:border-orange-500/50' : ''}
                      `}
                      onClick={() => {
                        if (!dayInfo.isPadding && !dayInfo.isPast) {
                          openSlotModal(dayInfo.date);
                        }
                      }}
                    >
                      {!dayInfo.isPadding && (
                        <>
                          <span className={`text-sm font-medium ${dayInfo.slot ? '' : 'text-white'}`}>
                            {dayInfo.day}
                          </span>
                          {dayInfo.slot && (
                            <div className="mt-1">
                              <span className="text-xs capitalize">{dayInfo.slot.status}</span>
                              {dayInfo.slot.from_time && (
                                <p className="text-xs opacity-70 flex items-center gap-1 mt-1">
                                  <Clock className="h-3 w-3" />
                                  {dayInfo.slot.from_time} - {dayInfo.slot.to_time}
                                </p>
                              )}
                            </div>
                          )}
                          {!dayInfo.slot && !dayInfo.isPast && (
                            <div className="mt-2 flex justify-center">
                              <Plus className="h-4 w-4 text-slate-500" />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Single Slot Modal */}
      <Dialog open={showSlotModal} onOpenChange={setShowSlotModal}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">
              Set Availability - {selectedDate}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Configure availability for {selectedHelipad?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-slate-300">Status</Label>
              <Select value={slotForm.status} onValueChange={(v) => setSlotForm({...slotForm, status: v})}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="available">
                    <span className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-400" /> Available
                    </span>
                  </SelectItem>
                  <SelectItem value="blocked">
                    <span className="flex items-center gap-2">
                      <X className="h-4 w-4 text-red-400" /> Blocked
                    </span>
                  </SelectItem>
                  <SelectItem value="maintenance">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-400" /> Maintenance
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">From Time</Label>
                <Input
                  type="time"
                  value={slotForm.from_time}
                  onChange={(e) => setSlotForm({...slotForm, from_time: e.target.value})}
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">To Time</Label>
                <Input
                  type="time"
                  value={slotForm.to_time}
                  onChange={(e) => setSlotForm({...slotForm, to_time: e.target.value})}
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
            </div>

            <div>
              <Label className="text-slate-300">Reason (optional)</Label>
              <Input
                value={slotForm.reason}
                onChange={(e) => setSlotForm({...slotForm, reason: e.target.value})}
                placeholder="e.g., VIP event, maintenance work"
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowSlotModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateSlot} className="bg-orange-500 hover:bg-orange-600">
                Save Availability
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Update Modal */}
      <Dialog open={showBulkModal} onOpenChange={setShowBulkModal}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Bulk Update Availability</DialogTitle>
            <DialogDescription className="text-slate-400">
              Set availability for a date range
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Start Date</Label>
                <Input
                  type="date"
                  value={bulkForm.start_date}
                  onChange={(e) => setBulkForm({...bulkForm, start_date: e.target.value})}
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">End Date</Label>
                <Input
                  type="date"
                  value={bulkForm.end_date}
                  onChange={(e) => setBulkForm({...bulkForm, end_date: e.target.value})}
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
            </div>

            <div>
              <Label className="text-slate-300">Status</Label>
              <Select value={bulkForm.status} onValueChange={(v) => setBulkForm({...bulkForm, status: v})}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-slate-300">Reason (optional)</Label>
              <Input
                value={bulkForm.reason}
                onChange={(e) => setBulkForm({...bulkForm, reason: e.target.value})}
                placeholder="e.g., Seasonal closure"
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowBulkModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleBulkCreate} className="bg-orange-500 hover:bg-orange-600">
                Apply to All Dates
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default HelipadAvailability;
