import React from 'react';
import { Calendar, Clock, Navigation, MapPin, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import LandingPointSelector from '../../shared/LandingPointSelector';
import MultiCityRouteBuilder from '../MultiCityRouteBuilder';

/**
 * Step 3: Route selection (Pickup / Drop Landing Points or Multi-City) + Date/Time + Waiting/Night Halt.
 * Split from BookingPage.js for maintainability.
 */
const Step3Route = ({
  formData,
  handleInputChange,
  handleLandingPointSelect,
  multiCityRoutes,
  setMultiCityRoutes,
  setDistanceKm,
  distanceKm,
  permissionRequired,
  pricingSettings,
  t,
}) => (
  <div className="space-y-6">
    {/* Multi-City Route Builder (for multi_city booking type) */}
    {formData.booking_type === 'multi_city' ? (
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <MultiCityRouteBuilder
          routes={multiCityRoutes.legs}
          onRoutesChange={(data) => {
            setMultiCityRoutes(data);
            setDistanceKm(data.totalDistance);
          }}
          selectedDate={formData.departure_date}
          aircraftType={formData.aircraft_type}
          basePrice={pricingSettings?.rate_per_hour || 80000}
          perLegDiscount={5}
          minLegs={2}
          maxLegs={8}
        />
      </div>
    ) : (
      <>
        {/* Pickup Location - Landing Point Selector */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Navigation className="h-5 w-5 text-green-400" />
            {t('bookingForm.pickupLocation')}
          </h3>
          <LandingPointSelector
            label={t('bookingForm.selectPickupPoint')}
            type="pickup"
            selectedDate={formData.departure_date}
            aircraftType={formData.aircraft_type}
            onSelect={(data) => handleLandingPointSelect('pickup', data)}
            selectedPoint={formData.pickup_landing_point}
          />
        </div>

        {/* Drop Location - Landing Point Selector */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-red-400" />
            {t('bookingForm.dropLocation')}
          </h3>
          <LandingPointSelector
            label={t('bookingForm.selectDropPoint')}
            type="drop"
            selectedDate={formData.departure_date}
            aircraftType={formData.aircraft_type}
            onSelect={(data) => handleLandingPointSelect('drop', data)}
            selectedPoint={formData.drop_landing_point}
          />
        </div>
      </>
    )}

    {/* Distance Display */}
    {distanceKm > 0 && (
      <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/30 text-center">
        <p className="text-blue-400 text-sm">{t('bookingForm.estimatedDistance')}</p>
        <p className="text-white text-3xl font-bold" data-testid="distance-km">{distanceKm} KM</p>
      </div>
    )}

    {/* Permission Warning */}
    {permissionRequired && (
      <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/30">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-6 w-6 text-yellow-400 shrink-0" />
          <div>
            <h4 className="text-yellow-400 font-semibold">{t('bookingForm.villageDocsTitle')}</h4>
            <p className="text-yellow-400/70 text-sm mt-1">
              {t('bookingForm.villageDocsDesc')}
            </p>
            <ul className="text-yellow-400/70 text-sm mt-2 list-disc list-inside space-y-1">
              <li>{t('bookingForm.docCollectorNoc')}</li>
              <li>{t('bookingForm.docFireDept')}</li>
              <li>{t('bookingForm.docPoliceStation')}</li>
              <li>{t('bookingForm.docSpDcp')}</li>
            </ul>
            <p className="text-yellow-400/80 text-xs mt-3 font-medium">
              ⚠️ {t('bookingForm.villageDocsNote')}
            </p>
          </div>
        </div>
      </div>
    )}

    {/* Date & Time */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <Label className="text-white mb-2 block">
          <Calendar className="h-4 w-4 inline mr-2" />
          {t('bookingForm.departureDate')} <span className="text-red-500">*</span>
        </Label>
        <Input
          type="date"
          value={formData.departure_date}
          onChange={(e) => handleInputChange('departure_date', e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="bg-slate-800 border-slate-600 text-white"
          data-testid="departure-date-input"
        />
      </div>

      <div>
        <Label className="text-white mb-2 block">
          <Clock className="h-4 w-4 inline mr-2" />
          {t('bookingForm.pickupTime')} <span className="text-red-500">*</span>
        </Label>
        <Input
          type="time"
          value={formData.pickup_time}
          onChange={(e) => handleInputChange('pickup_time', e.target.value)}
          className="bg-slate-800 border-slate-600 text-white"
          data-testid="pickup-time-input"
        />
      </div>
    </div>

    {/* Additional Aviation Options */}
    <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700">
      <p className="text-slate-400 text-sm mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-yellow-400" />
        {t('bookingForm.additionalOptions')}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-slate-300 mb-2 block text-sm">
            {t('bookingForm.waitingTime')}
          </Label>
          <Input
            type="number"
            min="0"
            step="30"
            value={formData.waiting_time || 0}
            onChange={(e) => handleInputChange('waiting_time', parseInt(e.target.value) || 0)}
            placeholder="0"
            className="bg-slate-800 border-slate-600 text-white"
            data-testid="waiting-time-input"
          />
          <p className="text-xs text-slate-500 mt-1">{t('bookingForm.waitingTimeNote')}</p>
        </div>

        <div>
          <Label className="text-slate-300 mb-2 block text-sm">
            {t('bookingForm.nightHalts')}
          </Label>
          <Input
            type="number"
            min="0"
            max="30"
            value={formData.night_halts || 0}
            onChange={(e) => handleInputChange('night_halts', parseInt(e.target.value) || 0)}
            placeholder="0"
            className="bg-slate-800 border-slate-600 text-white"
            data-testid="night-halts-input"
          />
          <p className="text-xs text-slate-500 mt-1">{t('bookingForm.nightHaltsNote')}</p>
        </div>
      </div>
    </div>
  </div>
);

export default Step3Route;
