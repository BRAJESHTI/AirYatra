import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Clock, Check, X, DollarSign, Users, MapPin, Plane, Calendar, 
  CreditCard, ChevronRight, RefreshCw, Bell, AlertCircle, Star,
  FileText, Loader2, TreePine
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { customerAPI, bookingAPI, landingAPI } from '@/services/api';
import { toast } from 'sonner';
import PassengerDetailsForm from './PassengerDetailsForm';
import VillageLandingDocuments from './VillageLandingDocuments';

const STATUS_STEPS = [
  { id: 'pending_acceptance', label: 'Inquiry Sent', labelHi: 'इंक्वायरी भेजी गई', icon: Clock },
  { id: 'quote_received', label: 'Quotes Received', labelHi: 'कोट प्राप्त', icon: Bell },
  { id: 'quote_accepted', label: 'Quote Accepted', labelHi: 'कोट स्वीकृत', icon: Check },
  { id: 'passenger_details_filled', label: 'Details Filled', labelHi: 'विवरण भरा', icon: Users },
  { id: 'payment_pending', label: 'Payment', labelHi: 'भुगतान', icon: CreditCard },
  { id: 'confirmed', label: 'Confirmed', labelHi: 'पुष्टि', icon: Check },
];

function InquiryStatus({ user }) {
  const { inquiryId } = useParams();
  const navigate = useNavigate();
  const [inquiry, setInquiry] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showQuotesDialog, setShowQuotesDialog] = useState(false);
  const [showPassengerForm, setShowPassengerForm] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (inquiryId) {
      loadInquiryStatus();
    }
  }, [inquiryId]);

  const loadInquiryStatus = async () => {
    setLoading(true);
    try {
      const response = await bookingAPI.getInquiryStatus(inquiryId);
      setInquiry(response.data.inquiry);
      setQuotes(response.data.operator_responses || []);
      
      // Load payment info if needed
      if (['quote_accepted', 'passenger_details_filled', 'payment_pending'].includes(response.data.inquiry?.status)) {
        const paymentResponse = await customerAPI.getPaymentInfo(inquiryId);
        setPaymentInfo(paymentResponse.data);
      }
    } catch (error) {
      toast.error('Failed to load inquiry status');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentStepIndex = () => {
    if (!inquiry) return 0;
    const index = STATUS_STEPS.findIndex(s => s.id === inquiry.status);
    return index >= 0 ? index : 0;
  };

  const handleAcceptQuote = async (quote) => {
    setProcessing(true);
    try {
      await customerAPI.respondToQuote(inquiryId, quote.id, { action: 'accept' });
      toast.success('🎉 Quote accepted! Now fill passenger details. / कोट स्वीकार! अब यात्री विवरण भरें।');
      setShowQuotesDialog(false);
      loadInquiryStatus();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to accept quote');
    } finally {
      setProcessing(false);
    }
  };

  const handlePassengerDetailsComplete = (data) => {
    setShowPassengerForm(false);
    toast.success('✅ Passenger details saved! Proceed to payment. / यात्री विवरण सहेजा गया!');
    loadInquiryStatus();
  };

  const handleProceedToPayment = () => {
    // Navigate to payment page with inquiry details
    navigate(`/customer/payment/${inquiryId}`, { 
      state: { 
        inquiry, 
        paymentInfo,
        amount: paymentInfo?.advance_amount || inquiry?.estimated_price 
      } 
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <RefreshCw className="h-8 w-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  if (!inquiry) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <p className="text-white text-xl">Inquiry not found</p>
          <Button onClick={() => navigate('/customer')} className="mt-4">
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const currentStep = getCurrentStepIndex();

  return (
    <div className="min-h-screen bg-slate-950 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Inquiry Status / इंक्वायरी स्थिति
          </h1>
          <p className="text-orange-400 font-mono text-lg">
            {inquiry.inquiry_number || inquiry.id?.slice(0, 8)}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 mb-8">
          <div className="flex items-center justify-between overflow-x-auto pb-2">
            {STATUS_STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isCompleted = index < currentStep;
              const isCurrent = index === currentStep;
              const isPending = index > currentStep;
              
              return (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center min-w-[80px]">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                      isCompleted ? 'bg-green-500 text-white' :
                      isCurrent ? 'bg-orange-500 text-white ring-4 ring-orange-500/30' :
                      'bg-slate-700 text-slate-400'
                    }`}>
                      {isCompleted ? <Check className="h-6 w-6" /> : <StepIcon className="h-6 w-6" />}
                    </div>
                    <span className={`text-xs mt-2 text-center ${
                      isCurrent ? 'text-orange-400 font-medium' : 
                      isCompleted ? 'text-green-400' : 'text-slate-500'
                    }`}>
                      {step.label}
                    </span>
                    <span className="text-xs text-slate-600">{step.labelHi}</span>
                  </div>
                  {index < STATUS_STEPS.length - 1 && (
                    <div className={`flex-1 h-1 mx-2 rounded ${
                      index < currentStep ? 'bg-green-500' : 'bg-slate-700'
                    }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Current Status Message */}
        <div className={`rounded-xl p-6 mb-8 border ${
          inquiry.status === 'confirmed' ? 'bg-green-500/10 border-green-500/30' :
          inquiry.status === 'pending_acceptance' ? 'bg-yellow-500/10 border-yellow-500/30' :
          'bg-orange-500/10 border-orange-500/30'
        }`}>
          {inquiry.status === 'pending_acceptance' && (
            <div className="text-center">
              <Clock className="h-12 w-12 text-yellow-400 mx-auto mb-3 animate-pulse" />
              <h3 className="text-xl font-bold text-yellow-400">
                Please Wait / कृपया प्रतीक्षा करें
              </h3>
              <p className="text-slate-300 mt-2">
                Your booking acceptance is pending to operators.
              </p>
              <p className="text-slate-400 text-sm">
                आपकी बुकिंग ऑपरेटर्स की स्वीकृति के लिए लंबित है।
              </p>
            </div>
          )}

          {inquiry.status === 'quote_received' && (
            <div className="text-center">
              <Bell className="h-12 w-12 text-blue-400 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-blue-400">
                Quotes Received! / कोट प्राप्त!
              </h3>
              <p className="text-slate-300 mt-2">
                {quotes.length} operator(s) have sent you quotes. Please review and accept one.
              </p>
              <Button 
                onClick={() => setShowQuotesDialog(true)} 
                className="mt-4 bg-blue-500 hover:bg-blue-600"
              >
                <DollarSign className="h-4 w-4 mr-2" /> View Quotes ({quotes.length})
              </Button>
            </div>
          )}

          {inquiry.status === 'quote_accepted' && (
            <div className="text-center">
              <Check className="h-12 w-12 text-green-400 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-green-400">
                Booking Accepted! / बुकिंग स्वीकृत!
              </h3>
              <p className="text-slate-300 mt-2">
                Please fill passenger details to proceed with payment.
              </p>
              <Button 
                onClick={() => setShowPassengerForm(true)} 
                className="mt-4 bg-orange-500 hover:bg-orange-600"
              >
                <Users className="h-4 w-4 mr-2" /> Fill Passenger Details
              </Button>
            </div>
          )}

          {inquiry.status === 'passenger_details_filled' && (
            <div className="text-center">
              <CreditCard className="h-12 w-12 text-orange-400 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-orange-400">
                Proceed to Payment / भुगतान करें
              </h3>
              <p className="text-slate-300 mt-2">
                Passenger details saved. Complete {paymentInfo?.advance_percent || 50}% advance payment to confirm booking.
              </p>
              <div className="mt-4 p-4 bg-slate-800/50 rounded-lg inline-block">
                <p className="text-slate-400 text-sm">Amount to Pay:</p>
                <p className="text-orange-400 text-3xl font-bold">
                  ₹{(paymentInfo?.advance_amount || inquiry.estimated_price)?.toLocaleString()}
                </p>
                {paymentInfo?.advance_percent < 100 && (
                  <p className="text-slate-500 text-xs mt-1">
                    Remaining ₹{paymentInfo?.remaining_amount?.toLocaleString()} before flight
                  </p>
                )}
              </div>
              <Button 
                onClick={handleProceedToPayment} 
                className="mt-4 bg-green-600 hover:bg-green-700"
              >
                <CreditCard className="h-4 w-4 mr-2" /> Pay Now
              </Button>
            </div>
          )}

          {inquiry.status === 'confirmed' && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-3">
                <Check className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-xl font-bold text-green-400">
                Booking Confirmed! / बुकिंग पुष्टि!
              </h3>
              <p className="text-slate-300 mt-2">
                Your booking has been confirmed. Have a safe flight!
              </p>
            </div>
          )}
        </div>

        {/* Booking Summary */}
        <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-orange-400" />
            Booking Summary / बुकिंग सारांश
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Aircraft</p>
              <p className="text-white">{inquiry.aircraft_type === 'helicopter' ? '🚁 Helicopter' : '✈️ Plane'}</p>
            </div>
            <div>
              <p className="text-slate-500">Passengers</p>
              <p className="text-white">{inquiry.total_passengers} Adults + {inquiry.children_count || 0} Children</p>
            </div>
            <div>
              <p className="text-slate-500">Flight Type</p>
              <p className="text-white">{inquiry.udan_prakar}</p>
            </div>
            <div>
              <p className="text-slate-500">Date & Time</p>
              <p className="text-white">{inquiry.departure_date} {inquiry.pickup_time}</p>
            </div>
            <div>
              <p className="text-slate-500">Purpose</p>
              <p className="text-white">{inquiry.booking_purpose}</p>
            </div>
            <div>
              <p className="text-slate-500">Distance</p>
              <p className="text-orange-400 font-bold">{inquiry.distance_km} KM</p>
            </div>
          </div>

          {/* Route */}
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-green-400 flex items-center gap-1 text-sm">
                  <MapPin className="h-4 w-4" /> Pickup
                </p>
                <p className="text-white font-medium">{inquiry.pickup_location}</p>
                <p className="text-slate-500 text-xs">{inquiry.pickup_district}, {inquiry.pickup_state}</p>
              </div>
              <ChevronRight className="h-6 w-6 text-slate-500" />
              <div className="flex-1">
                <p className="text-red-400 flex items-center gap-1 text-sm">
                  <MapPin className="h-4 w-4" /> Drop
                </p>
                <p className="text-white font-medium">{inquiry.drop_location}</p>
                <p className="text-slate-500 text-xs">{inquiry.drop_district}, {inquiry.drop_state}</p>
              </div>
            </div>
          </div>

          {/* Estimated Price */}
          <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between items-center">
            <span className="text-slate-400">Estimated Amount:</span>
            <span className="text-orange-400 text-2xl font-bold">
              ₹{(inquiry.accepted_quote?.amount || inquiry.estimated_price || 0).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Back to Dashboard */}
        <div className="mt-6 text-center">
          <Button variant="outline" onClick={() => navigate('/customer')} className="border-slate-600">
            ← Back to Dashboard
          </Button>
        </div>
      </div>

      {/* Quotes Dialog */}
      <Dialog open={showQuotesDialog} onOpenChange={setShowQuotesDialog}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-orange-400" />
              Operator Quotes / ऑपरेटर कोट्स
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {quotes.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No quotes received yet</p>
            ) : (
              quotes.map((quote, idx) => (
                <div key={idx} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-white font-semibold">{quote.operator_name || 'Operator'}</p>
                      {quote.notes && (
                        <p className="text-slate-400 text-sm mt-1">"{quote.notes}"</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-orange-400 text-2xl font-bold">
                        ₹{quote.amount?.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleAcceptQuote(quote)}
                    disabled={processing}
                    className="w-full mt-4 bg-green-600 hover:bg-green-700"
                  >
                    {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                    Accept This Quote
                  </Button>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuotesDialog(false)} className="border-slate-600">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Passenger Details Form Dialog */}
      <Dialog open={showPassengerForm} onOpenChange={setShowPassengerForm}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-orange-400" />
              Passenger Details / यात्री विवरण
            </DialogTitle>
          </DialogHeader>
          <PassengerDetailsForm 
            inquiry={inquiry} 
            onComplete={handlePassengerDetailsComplete}
            onCancel={() => setShowPassengerForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default InquiryStatus;
