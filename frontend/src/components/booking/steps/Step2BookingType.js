import React from 'react';
import { Plane, User, Target, Check, Scale, Siren } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import BookingTypeSelector from '../BookingTypeSelector';
import { udanPrakarOptions, bookingForOptions, bookingPurposeOptions } from '../bookingConfig';

/**
 * Step 2: Booking Type (9 types) + Flight Type / Booking For / Booking Purpose dropdowns.
 * Split from BookingPage.js for maintainability.
 */
const Step2BookingType = ({
  formData,
  handleInputChange,
  priceEstimate,
  selectedAircraft,
  setSelectedAircraft,
  setShowEmergencyForm,
  setShowCompareModal,
  t,
}) => (
  <div className="space-y-6">
    {/* Emergency & Compare Buttons */}
    <div className="flex gap-3 mb-2">
      <Button
        variant="outline"
        onClick={() => setShowEmergencyForm(true)}
        className="border-red-500/50 text-red-400 hover:bg-red-500/10"
        data-testid="emergency-booking-btn"
      >
        <Siren className="h-4 w-4 mr-2" />
        Emergency Booking
      </Button>
      <Button
        variant="outline"
        onClick={() => setShowCompareModal(true)}
        className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
        data-testid="compare-aircraft-btn"
      >
        <Scale className="h-4 w-4 mr-2" />
        Compare Aircraft
      </Button>
    </div>

    {/* Selected Aircraft Display */}
    {selectedAircraft && (
      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Check className="h-5 w-5 text-green-400" />
          <div>
            <p className="text-white font-medium">
              {selectedAircraft.basic_info?.model || selectedAircraft.model} Selected
            </p>
            <p className="text-slate-400 text-sm">
              {selectedAircraft.basic_info?.manufacturer || selectedAircraft.manufacturer}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedAircraft(null)}
          className="text-slate-400"
          data-testid="change-aircraft-btn"
        >
          Change
        </Button>
      </div>
    )}

    {/* Booking Type Selector (9 types) */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
      <BookingTypeSelector
        selected={formData.booking_type}
        onSelect={(type) => handleInputChange('booking_type', type)}
        basePrice={priceEstimate?.total || 0}
        passengerCount={formData.total_passengers}
        showPriceImpact={priceEstimate?.total > 0}
      />
    </div>

    {/* Udan Ka Prakar - Dropdown */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
      <Label className="text-white text-lg mb-3 block flex items-center gap-2">
        <Plane className="h-5 w-5 text-orange-400" />
        {t('bookingForm.flightType')} <span className="text-red-500">*</span>
      </Label>
      <select
        value={formData.udan_prakar}
        onChange={(e) => handleInputChange('udan_prakar', e.target.value)}
        className="w-full p-4 bg-slate-900 border border-slate-600 rounded-xl text-white text-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 cursor-pointer"
        data-testid="flight-type-select"
      >
        <option value="" className="bg-slate-900">{t('bookingForm.selectOption')}</option>
        {udanPrakarOptions.map((option) => (
          <option key={option.value} value={option.value} className="bg-slate-900">
            {option.icon} {t(`options.${option.value}`)}
          </option>
        ))}
      </select>
      {formData.udan_prakar && (
        <p className="mt-2 text-orange-400 text-sm flex items-center gap-2">
          <Check className="h-4 w-4" />
          {t('bookingForm.selected')}: {t(`options.${formData.udan_prakar}`)}
        </p>
      )}
    </div>

    {/* Booking For - Dropdown */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
      <Label className="text-white text-lg mb-3 block flex items-center gap-2">
        <User className="h-5 w-5 text-blue-400" />
        {t('bookingForm.bookingFor')} <span className="text-red-500">*</span>
      </Label>
      <select
        value={formData.booking_for}
        onChange={(e) => handleInputChange('booking_for', e.target.value)}
        className="w-full p-4 bg-slate-900 border border-slate-600 rounded-xl text-white text-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 cursor-pointer"
        data-testid="booking-for-select"
      >
        <option value="" className="bg-slate-900">{t('bookingForm.selectOption')}</option>
        {bookingForOptions.map((option) => (
          <option key={option.value} value={option.value} className="bg-slate-900">
            {option.icon} {t(`options.${option.value}`)}
          </option>
        ))}
      </select>
      {formData.booking_for && (
        <p className="mt-2 text-blue-400 text-sm flex items-center gap-2">
          <Check className="h-4 w-4" />
          {t('bookingForm.selected')}: {t(`options.${formData.booking_for}`)}
        </p>
      )}
    </div>

    {/* Booking Purpose - Dropdown */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
      <Label className="text-white text-lg mb-3 block flex items-center gap-2">
        <Target className="h-5 w-5 text-green-400" />
        {t('bookingForm.bookingPurpose')} <span className="text-red-500">*</span>
      </Label>
      <select
        value={formData.booking_purpose}
        onChange={(e) => handleInputChange('booking_purpose', e.target.value)}
        className="w-full p-4 bg-slate-900 border border-slate-600 rounded-xl text-white text-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 cursor-pointer"
        data-testid="booking-purpose-select"
      >
        <option value="" className="bg-slate-900">{t('bookingForm.selectOption')}</option>
        {bookingPurposeOptions.map((option) => (
          <option key={option.value} value={option.value} className="bg-slate-900">
            {option.icon} {t(`options.${option.value}`)}
          </option>
        ))}
      </select>
      {formData.booking_purpose && (
        <p className="mt-2 text-green-400 text-sm flex items-center gap-2">
          <Check className="h-4 w-4" />
          {t('bookingForm.selected')}: {t(`options.${formData.booking_purpose}`)}
        </p>
      )}

      {formData.booking_purpose === 'other' && (
        <Input
          placeholder={t('bookingForm.specifyPurpose')}
          value={formData.booking_purpose_other}
          onChange={(e) => handleInputChange('booking_purpose_other', e.target.value)}
          className="mt-4 bg-slate-800 border-slate-600 text-white"
          data-testid="purpose-other-input"
        />
      )}
    </div>
  </div>
);

export default Step2BookingType;
