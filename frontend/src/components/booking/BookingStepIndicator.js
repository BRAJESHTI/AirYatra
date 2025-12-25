import React from 'react';
import { Check } from 'lucide-react';

// Step indicator component for booking flow
const BookingStepIndicator = ({ currentStep, steps }) => (
  <div className="flex items-center justify-center mb-8 overflow-x-auto pb-2">
    {steps.map((step, index) => (
      <React.Fragment key={step.id}>
        <div className="flex flex-col items-center min-w-[80px]">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
            currentStep > index ? 'bg-green-500 text-white' :
            currentStep === index ? 'bg-orange-500 text-white ring-4 ring-orange-500/30' :
            'bg-slate-700 text-slate-400'
          }`}>
            {currentStep > index ? <Check className="h-5 w-5" /> : index + 1}
          </div>
          <span className={`text-xs mt-2 text-center ${currentStep === index ? 'text-orange-400 font-medium' : 'text-slate-500'}`}>
            {step.title}
          </span>
        </div>
        {index < steps.length - 1 && (
          <div className={`w-12 h-1 mx-1 rounded ${currentStep > index ? 'bg-green-500' : 'bg-slate-700'}`} />
        )}
      </React.Fragment>
    ))}
  </div>
);

export default BookingStepIndicator;
