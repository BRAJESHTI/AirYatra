import React from 'react';
import { Briefcase, Target, Plane } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

// Dropdown options
export const udanPrakarOptions = [
  { id: 'one_way', name: 'One Way / एक तरफा' },
  { id: 'round_trip', name: 'Round Trip / आना-जाना' },
  { id: 'multi_city', name: 'Multi City / बहु-शहर' },
  { id: 'hourly_charter', name: 'Hourly Charter / घंटे के हिसाब से' },
];

export const bookingForOptions = [
  { id: 'self', name: 'Self / स्वयं के लिए' },
  { id: 'family', name: 'Family / परिवार' },
  { id: 'corporate', name: 'Corporate / कॉर्पोरेट' },
  { id: 'group', name: 'Group / समूह' },
  { id: 'vip', name: 'VIP / विशेष अतिथि' },
];

export const bookingPurposeOptions = [
  { id: 'tourism', name: 'Tourism / पर्यटन', icon: '🏔️' },
  { id: 'pilgrimage', name: 'Pilgrimage / तीर्थ यात्रा', icon: '🛕' },
  { id: 'business', name: 'Business / व्यापार', icon: '💼' },
  { id: 'medical', name: 'Medical Emergency / चिकित्सा आपातकाल', icon: '🏥' },
  { id: 'wedding', name: 'Wedding / शादी', icon: '💒' },
  { id: 'film_shooting', name: 'Film Shooting / फिल्म शूटिंग', icon: '🎬' },
  { id: 'survey', name: 'Aerial Survey / हवाई सर्वेक्षण', icon: '📡' },
  { id: 'other', name: 'Other / अन्य', icon: '📝' },
];

const BookingPurposeStep = ({ formData, onInputChange }) => {
  return (
    <div className="space-y-6">
      {/* Udan Prakar / Flight Type */}
      <div>
        <Label className="text-white text-lg mb-4 flex items-center gap-2">
          <Plane className="h-5 w-5 text-orange-400" />
          Flight Type / उड़ान प्रकार
        </Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {udanPrakarOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onInputChange('udan_prakar', option.id)}
              className={`p-4 rounded-lg border transition-all text-center ${
                formData.udan_prakar === option.id
                  ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                  : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
              }`}
            >
              {option.name}
            </button>
          ))}
        </div>
      </div>

      {/* Booking For */}
      <div>
        <Label className="text-white text-lg mb-4 flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-blue-400" />
          Booking For / बुकिंग किसके लिए
        </Label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {bookingForOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onInputChange('booking_for', option.id)}
              className={`p-4 rounded-lg border transition-all text-center ${
                formData.booking_for === option.id
                  ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                  : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
              }`}
            >
              {option.name}
            </button>
          ))}
        </div>
      </div>

      {/* Booking Purpose */}
      <div>
        <Label className="text-white text-lg mb-4 flex items-center gap-2">
          <Target className="h-5 w-5 text-green-400" />
          Purpose / उद्देश्य
        </Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {bookingPurposeOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onInputChange('booking_purpose', option.id)}
              className={`p-4 rounded-lg border transition-all text-left ${
                formData.booking_purpose === option.id
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
              }`}
            >
              <span className="text-2xl mb-2 block">{option.icon}</span>
              <span className={formData.booking_purpose === option.id ? 'text-green-400' : 'text-slate-300'}>
                {option.name}
              </span>
            </button>
          ))}
        </div>

        {/* Other purpose input */}
        {formData.booking_purpose === 'other' && (
          <div className="mt-4">
            <Label className="text-slate-300">Please specify / कृपया बताएं</Label>
            <Input
              value={formData.booking_purpose_other || ''}
              onChange={(e) => onInputChange('booking_purpose_other', e.target.value)}
              placeholder="Enter purpose..."
              className="bg-slate-800 border-slate-600 text-white mt-1"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingPurposeStep;
