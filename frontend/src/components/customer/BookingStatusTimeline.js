import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Clock, CheckCircle, XCircle, AlertCircle, Loader2,
  Send, Bell, UserCheck, CreditCard, FileCheck, Plane,
  MapPin, User, Shield, Cloud, CheckCircle2, Phone
} from 'lucide-react';

/**
 * Booking Status Timeline Component
 * Shows step-by-step progress of booking
 */

const BOOKING_STEPS = [
  { 
    id: 'inquiry_sent', 
    label: 'Booking Initiated',
    description: 'Your booking request has been submitted',
    icon: Send,
    color: 'blue'
  },
  { 
    id: 'quotes_received', 
    label: 'Quotes Received',
    description: 'Operators have provided quotes',
    icon: Bell,
    color: 'purple'
  },
  { 
    id: 'quote_accepted', 
    label: 'Quote Accepted',
    description: 'You have selected an operator',
    icon: UserCheck,
    color: 'indigo'
  },
  { 
    id: 'documents_verified', 
    label: 'Documents Verified',
    description: 'DGCA, AOC & Insurance verified',
    icon: FileCheck,
    color: 'cyan'
  },
  { 
    id: 'payment_completed', 
    label: 'Payment Received',
    description: 'Payment successfully processed',
    icon: CreditCard,
    color: 'green'
  },
  { 
    id: 'pilot_assigned', 
    label: 'Pilot Assigned',
    description: 'Captain assigned for your flight',
    icon: User,
    color: 'amber'
  },
  { 
    id: 'preflight_complete', 
    label: 'Pre-flight Check',
    description: 'Aircraft ready for departure',
    icon: Shield,
    color: 'teal'
  },
  { 
    id: 'flight_in_progress', 
    label: 'Flight In Progress',
    description: 'Your journey has begun',
    icon: Plane,
    color: 'orange'
  },
  { 
    id: 'completed', 
    label: 'Journey Completed',
    description: 'Thank you for flying with us!',
    icon: CheckCircle2,
    color: 'emerald'
  }
];

const STATUS_MAP = {
  'pending_acceptance': 0,
  'pending_quotes': 0,
  'quotes_received': 1,
  'quote_accepted': 2,
  'passenger_details_filled': 2,
  'documents_pending': 2,
  'documents_verified': 3,
  'payment_pending': 3,
  'payment_completed': 4,
  'confirmed': 5,
  'pilot_assigned': 5,
  'preflight_complete': 6,
  'in_progress': 7,
  'flight_in_progress': 7,
  'completed': 8,
  'cancelled': -1
};

const getStepStatus = (stepIndex, currentStepIndex, isCancelled) => {
  if (isCancelled) return 'cancelled';
  if (stepIndex < currentStepIndex) return 'completed';
  if (stepIndex === currentStepIndex) return 'current';
  return 'pending';
};

const StepIcon = ({ step, status }) => {
  const Icon = step.icon;
  
  const baseClasses = "h-8 w-8 flex items-center justify-center rounded-full transition-all duration-300";
  
  switch (status) {
    case 'completed':
      return (
        <div className={`${baseClasses} bg-green-500`}>
          <CheckCircle className="h-5 w-5 text-white" />
        </div>
      );
    case 'current':
      return (
        <div className={`${baseClasses} bg-orange-500 ring-4 ring-orange-500/30 animate-pulse`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      );
    case 'cancelled':
      return (
        <div className={`${baseClasses} bg-red-500`}>
          <XCircle className="h-5 w-5 text-white" />
        </div>
      );
    default:
      return (
        <div className={`${baseClasses} bg-slate-700 border-2 border-slate-600`}>
          <Icon className="h-4 w-4 text-slate-500" />
        </div>
      );
  }
};

const BookingStatusTimeline = ({ 
  status, 
  booking,
  showDetails = true,
  compact = false,
  className = ""
}) => {
  const currentStepIndex = STATUS_MAP[status] ?? 0;
  const isCancelled = status === 'cancelled';

  // Extract timeline events if available
  const timelineEvents = booking?.timeline || [];

  if (compact) {
    const currentStep = BOOKING_STEPS[Math.max(0, currentStepIndex)] || BOOKING_STEPS[0];
    const Icon = currentStep.icon;
    
    return (
      <div className={`flex items-center gap-3 ${className}`} data-testid="booking-timeline-compact">
        <div className={`h-10 w-10 flex items-center justify-center rounded-full ${
          isCancelled ? 'bg-red-500/20' : 
          currentStepIndex === BOOKING_STEPS.length - 1 ? 'bg-green-500/20' : 'bg-orange-500/20'
        }`}>
          {isCancelled ? (
            <XCircle className="h-5 w-5 text-red-400" />
          ) : currentStepIndex === BOOKING_STEPS.length - 1 ? (
            <CheckCircle className="h-5 w-5 text-green-400" />
          ) : (
            <Icon className="h-5 w-5 text-orange-400" />
          )}
        </div>
        <div>
          <p className={`font-medium ${isCancelled ? 'text-red-400' : 'text-white'}`}>
            {isCancelled ? 'Cancelled' : currentStep.label}
          </p>
          <p className="text-xs text-slate-400">
            Step {currentStepIndex + 1} of {BOOKING_STEPS.length}
          </p>
        </div>
        {/* Progress bar */}
        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden ml-4">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${
              isCancelled ? 'bg-red-500' : 'bg-gradient-to-r from-orange-500 to-green-500'
            }`}
            style={{ width: `${isCancelled ? 100 : ((currentStepIndex + 1) / BOOKING_STEPS.length) * 100}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <Card className={`bg-slate-900 border-slate-700 ${className}`} data-testid="booking-timeline">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-orange-400" />
            Booking Progress
          </CardTitle>
          <Badge className={
            isCancelled ? 'bg-red-500/20 text-red-400' :
            currentStepIndex === BOOKING_STEPS.length - 1 ? 'bg-green-500/20 text-green-400' :
            'bg-orange-500/20 text-orange-400'
          }>
            {isCancelled ? 'Cancelled' : 
             currentStepIndex === BOOKING_STEPS.length - 1 ? 'Completed' : 
             `Step ${currentStepIndex + 1}/${BOOKING_STEPS.length}`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Progress Overview */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-400">Progress</span>
            <span className="text-white font-medium">
              {Math.round(((currentStepIndex + 1) / BOOKING_STEPS.length) * 100)}%
            </span>
          </div>
          <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-700 ${
                isCancelled ? 'bg-red-500' : 'bg-gradient-to-r from-orange-500 via-amber-500 to-green-500'
              }`}
              style={{ width: `${((currentStepIndex + 1) / BOOKING_STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Timeline */}
        <div className="relative">
          {BOOKING_STEPS.map((step, index) => {
            const stepStatus = getStepStatus(index, currentStepIndex, isCancelled);
            const timelineEvent = timelineEvents.find(e => e.step === step.id);
            
            return (
              <div key={step.id} className="flex gap-4 pb-6 last:pb-0">
                {/* Vertical Line */}
                <div className="flex flex-col items-center">
                  <StepIcon step={step} status={stepStatus} />
                  {index < BOOKING_STEPS.length - 1 && (
                    <div className={`w-0.5 flex-1 mt-2 ${
                      stepStatus === 'completed' ? 'bg-green-500' :
                      stepStatus === 'current' ? 'bg-gradient-to-b from-orange-500 to-slate-700' :
                      'bg-slate-700'
                    }`} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pb-2">
                  <div className="flex items-center gap-2">
                    <h4 className={`font-medium ${
                      stepStatus === 'completed' ? 'text-green-400' :
                      stepStatus === 'current' ? 'text-orange-400' :
                      stepStatus === 'cancelled' ? 'text-red-400' :
                      'text-slate-500'
                    }`}>
                      {step.label}
                    </h4>
                    {stepStatus === 'current' && (
                      <Badge className="bg-orange-500/20 text-orange-400 text-xs animate-pulse">
                        Current
                      </Badge>
                    )}
                  </div>
                  <p className={`text-sm mt-0.5 ${
                    stepStatus === 'pending' ? 'text-slate-600' : 'text-slate-400'
                  }`}>
                    {step.description}
                  </p>
                  
                  {/* Timestamp if available */}
                  {timelineEvent?.timestamp && (
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(timelineEvent.timestamp).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  )}

                  {/* Additional Details */}
                  {showDetails && stepStatus === 'completed' && (
                    <div className="mt-2 space-y-1">
                      {step.id === 'pilot_assigned' && booking?.pilot && (
                        <div className="flex items-center gap-2 text-sm bg-slate-800/50 rounded-lg p-2">
                          <User className="h-4 w-4 text-amber-400" />
                          <span className="text-slate-300">
                            Capt. {booking.pilot.name}
                          </span>
                          {booking.pilot.rating && (
                            <Badge className="bg-amber-500/20 text-amber-400 text-xs">
                              ★ {booking.pilot.rating}
                            </Badge>
                          )}
                        </div>
                      )}
                      {step.id === 'quote_accepted' && booking?.operator && (
                        <div className="flex items-center gap-2 text-sm bg-slate-800/50 rounded-lg p-2">
                          <Shield className="h-4 w-4 text-indigo-400" />
                          <span className="text-slate-300">
                            {booking.operator.name}
                          </span>
                          {booking.operator.verified && (
                            <Badge className="bg-green-500/20 text-green-400 text-xs">
                              Verified
                            </Badge>
                          )}
                        </div>
                      )}
                      {step.id === 'payment_completed' && booking?.payment && (
                        <div className="flex items-center gap-2 text-sm bg-slate-800/50 rounded-lg p-2">
                          <CreditCard className="h-4 w-4 text-green-400" />
                          <span className="text-slate-300">
                            ₹{booking.payment.amount?.toLocaleString('en-IN')} paid via {booking.payment.method}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Cancelled Message */}
        {isCancelled && (
          <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
              <div>
                <p className="text-red-400 font-medium">Booking Cancelled</p>
                <p className="text-red-400/70 text-sm mt-1">
                  {booking?.cancellation_reason || 'This booking has been cancelled.'}
                </p>
                {booking?.refund_status && (
                  <Badge className="mt-2 bg-slate-800 text-slate-300">
                    Refund: {booking.refund_status}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Help Section */}
        {!isCancelled && currentStepIndex < BOOKING_STEPS.length - 1 && (
          <div className="mt-6 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">Need help with your booking?</p>
              <Button variant="outline" size="sm" className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10">
                <Phone className="h-4 w-4 mr-2" />
                Contact Support
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BookingStatusTimeline;
