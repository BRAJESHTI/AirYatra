import React from 'react';
import { Users, Baby, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { aircraftTypes } from '../bookingConfig';

/**
 * Step 1: Aircraft Service selection + Passenger counters.
 * Split from BookingPage.js for maintainability.
 */
const Step1Passengers = ({ formData, handleInputChange, t }) => (
  <div className="space-y-6">
    {/* Service Category Selection */}
    <div>
      <Label className="text-white text-lg mb-4 block">
        Choose Your Service <span className="text-red-500">*</span>
      </Label>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {aircraftTypes.map((type) => {
          const isSelected = formData.aircraft_type === type.value;
          return (
            <button
              key={type.value}
              data-testid={`service-${type.value}`}
              onClick={() => handleInputChange('aircraft_type', type.value)}
              className={`relative rounded-xl border-2 overflow-hidden text-left transition-all duration-200 group ${
                isSelected
                  ? 'border-orange-500 shadow-lg shadow-orange-500/25'
                  : 'border-slate-700 hover:border-slate-500 hover:-translate-y-0.5'
              }`}
            >
              <div className="relative h-28 sm:h-32 overflow-hidden">
                <img
                  src={type.image}
                  alt={type.label}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/30 to-transparent" />
                {isSelected && (
                  <div className="absolute top-2 right-2 h-6 w-6 bg-orange-500 rounded-full flex items-center justify-center shadow">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
              <div className={`p-3 ${isSelected ? 'bg-orange-500/10' : 'bg-slate-800/70'}`}>
                <span className={`font-semibold block text-sm sm:text-base leading-tight ${isSelected ? 'text-orange-300' : 'text-white'}`}>
                  {type.label}
                </span>
                <span className="text-slate-400 text-xs block mt-1">{type.description}</span>
                <span className="text-slate-500 text-xs block mt-0.5">Up to {type.maxPassengers} {type.value === 'cargo' ? 'crew' : 'passengers'}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>

    {/* Adult Passengers */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
        <Users className="h-5 w-5 text-orange-400" />
        {t('bookingForm.adultPassengers')}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Male Adults */}
        <div>
          <Label className="text-slate-300 mb-2 block">{t('bookingForm.male')}</Label>
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => handleInputChange('adults_male', Math.max(0, formData.adults_male - 1))}
              className="border-slate-600"
              data-testid="decrement-male-btn"
            >
              -
            </Button>
            <span className="text-white text-2xl font-bold w-12 text-center" data-testid="adults-male-count">{formData.adults_male}</span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => handleInputChange('adults_male', formData.adults_male + 1)}
              className="border-slate-600"
              data-testid="increment-male-btn"
            >
              +
            </Button>
          </div>
        </div>

        {/* Female Adults */}
        <div>
          <Label className="text-slate-300 mb-2 block">{t('bookingForm.female')}</Label>
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => handleInputChange('adults_female', Math.max(0, formData.adults_female - 1))}
              className="border-slate-600"
              data-testid="decrement-female-btn"
            >
              -
            </Button>
            <span className="text-white text-2xl font-bold w-12 text-center" data-testid="adults-female-count">{formData.adults_female}</span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => handleInputChange('adults_female', formData.adults_female + 1)}
              className="border-slate-600"
              data-testid="increment-female-btn"
            >
              +
            </Button>
          </div>
        </div>
      </div>

      {/* Total Adults */}
      <div className="mt-4 pt-4 border-t border-slate-700">
        <p className="text-slate-400">
          {t('bookingForm.totalAdults')}: <span className="text-orange-400 font-bold text-xl">{formData.total_passengers}</span>
        </p>
      </div>
    </div>

    {/* Children */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
      <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
        <Baby className="h-5 w-5 text-blue-400" />
        {t('bookingForm.children')}
      </h3>
      <p className="text-green-400 text-sm mb-4">✨ {t('bookingForm.childrenFree')}</p>

      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => handleInputChange('children_count', Math.max(0, formData.children_count - 1))}
          className="border-slate-600"
          data-testid="decrement-children-btn"
        >
          -
        </Button>
        <span className="text-white text-2xl font-bold w-12 text-center" data-testid="children-count">{formData.children_count}</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => handleInputChange('children_count', Math.min(2, formData.children_count + 1))}
          className="border-slate-600"
          disabled={formData.children_count >= 2}
          data-testid="increment-children-btn"
        >
          +
        </Button>
      </div>
    </div>
  </div>
);

export default Step1Passengers;
