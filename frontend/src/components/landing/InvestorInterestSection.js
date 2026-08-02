import React, { useState } from 'react';
import { TrendingUp, Mail, Phone, Building2, Send, CheckCircle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const INVESTMENT_RANGES = [
  { value: '1-5L', label: '₹1 - 5 Lakhs' },
  { value: '5-25L', label: '₹5 - 25 Lakhs' },
  { value: '25L-1Cr', label: '₹25 Lakhs - 1 Crore' },
  { value: '1Cr+', label: '₹1 Crore+' }
];

function InvestorInterestSection() {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    company_name: '',
    investment_range: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [referenceId, setReferenceId] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.full_name || !formData.email || !formData.phone || !formData.investment_range) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/content/investor-interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Submission failed');
      }

      setSubmitted(true);
      setReferenceId(data.reference_id);
      toast.success('Thank you! We will contact you shortly.');
    } catch (err) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <section className="py-20 px-6 bg-gradient-to-br from-slate-900 to-slate-950" data-testid="investor-section">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-green-500/20 p-4 rounded-full w-fit mx-auto mb-6">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Thank You for Your Interest!</h2>
          <p className="text-slate-400 mb-4">
            Your inquiry has been received. Our investment relations team will contact you within 24-48 hours.
          </p>
          <p className="text-orange-400 text-sm">
            Reference ID: <span className="font-mono">{referenceId}</span>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 px-6 bg-gradient-to-br from-slate-900 to-slate-950" data-testid="investor-section">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Info */}
          <div>
            <span className="text-orange-500 font-semibold text-sm uppercase tracking-wider">Investor Relations</span>
            <h2 className="text-4xl md:text-5xl font-bold text-white mt-3 mb-6">
              Invest in the Future of Indian Aviation
            </h2>
            <p className="text-slate-400 text-lg mb-8">
              Join us in revolutionizing private aviation in India. AirYatra is growing rapidly with 
              a proven business model and ambitious expansion plans.
            </p>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <div className="text-3xl font-bold text-orange-500">500+</div>
                <div className="text-slate-400 text-sm">Flights Completed</div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <div className="text-3xl font-bold text-orange-500">40%</div>
                <div className="text-slate-400 text-sm">YoY Growth</div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <div className="text-3xl font-bold text-orange-500">15+</div>
                <div className="text-slate-400 text-sm">Cities Served</div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <div className="text-3xl font-bold text-orange-500">₹50Cr+</div>
                <div className="text-slate-400 text-sm">Revenue Target</div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span>Profitable unit economics with clear path to profitability</span>
            </div>
          </div>

          {/* Right: Form */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-white mb-6">Express Your Interest</h3>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-slate-300">Full Name *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  <Input
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    placeholder="Your full name"
                    className="pl-10 bg-slate-900 border-slate-600 text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <Input
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="your@email.com"
                      className="pl-10 bg-slate-900 border-slate-600 text-white"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Phone *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <Input
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+91 98765 43210"
                      className="pl-10 bg-slate-900 border-slate-600 text-white"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Company (Optional)</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  <Input
                    name="company_name"
                    value={formData.company_name}
                    onChange={handleChange}
                    placeholder="Your company name"
                    className="pl-10 bg-slate-900 border-slate-600 text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Investment Range *</Label>
                <div className="grid grid-cols-2 gap-3">
                  {INVESTMENT_RANGES.map((range) => (
                    <button
                      key={range.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, investment_range: range.value }))}
                      className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                        formData.investment_range === range.value
                          ? 'bg-orange-500 border-orange-500 text-white'
                          : 'bg-slate-900 border-slate-600 text-slate-300 hover:border-orange-500/50'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Message (Optional)</Label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Tell us about your investment goals..."
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white h-12"
              >
                {loading ? (
                  'Submitting...'
                ) : (
                  <>
                    <Send className="mr-2 h-5 w-5" />
                    Submit Interest
                  </>
                )}
              </Button>

              <p className="text-xs text-slate-500 text-center">
                By submitting, you agree to be contacted by our investment team
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

export default InvestorInterestSection;
