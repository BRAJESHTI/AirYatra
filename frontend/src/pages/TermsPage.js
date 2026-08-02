import React from 'react';
import { Link } from 'react-router-dom';
import { Plane, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-slate-950/90 backdrop-blur-lg border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center space-x-2">
            <Plane className="h-8 w-8 text-orange-500" />
            <span className="text-2xl font-bold text-white tracking-tight">AirYatra</span>
          </Link>
          <div className="flex items-center space-x-4">
            <Link to="/">
              <Button variant="ghost" className="text-slate-300 hover:text-white">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-white mb-8">Terms of Service</h1>
          <p className="text-slate-400 mb-4">Last Updated: August 2026</p>
          
          <div className="prose prose-invert max-w-none space-y-8">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
              <p className="text-slate-400">
                By accessing and using AirYatra&#39;s services, you agree to be bound by these Terms of Service 
                and all applicable laws and regulations. If you do not agree with any of these terms, 
                you are prohibited from using or accessing our services.
              </p>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">2. Services</h2>
              <p className="text-slate-400 mb-3">
                AirYatra provides a platform connecting customers with verified aviation operators for:
              </p>
              <ul className="list-disc list-inside text-slate-400 space-y-2">
                <li>Private jet charter services</li>
                <li>Helicopter services including tours and transfers</li>
                <li>Corporate aviation solutions</li>
                <li>Emergency medical aviation</li>
                <li>Aircraft management services</li>
              </ul>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">3. Booking and Payments</h2>
              <p className="text-slate-400 mb-3">
                All bookings are subject to availability and confirmation by the operator. Payment terms:
              </p>
              <ul className="list-disc list-inside text-slate-400 space-y-2">
                <li>Advance payment may be required for booking confirmation</li>
                <li>Cancellation fees apply as per the cancellation policy</li>
                <li>Prices are subject to change based on fuel surcharges and other factors</li>
                <li>All payments are processed securely through our payment partners</li>
              </ul>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">4. User Responsibilities</h2>
              <p className="text-slate-400 mb-3">Users agree to:</p>
              <ul className="list-disc list-inside text-slate-400 space-y-2">
                <li>Provide accurate personal and travel information</li>
                <li>Comply with all aviation security requirements</li>
                <li>Arrive at least 30 minutes before scheduled departure</li>
                <li>Adhere to baggage and passenger weight restrictions</li>
                <li>Follow all instructions from flight crew</li>
              </ul>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">5. Liability</h2>
              <p className="text-slate-400">
                AirYatra acts as an intermediary platform. While we verify all operators, 
                the actual aviation services are provided by independent operators who 
                maintain their own insurance and certifications. AirYatra&#39;s liability is 
                limited to the platform services provided.
              </p>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">6. Contact</h2>
              <p className="text-slate-400">
                For questions about these terms, please contact us at{' '}
                <a href="mailto:airyatraadmin@gmail.com" className="text-orange-400 hover:text-orange-300">
                  airyatraadmin@gmail.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 py-12 px-6 border-t border-slate-800">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Plane className="h-6 w-6 text-orange-500" />
            <span className="text-xl font-bold text-white">AirYatra</span>
          </div>
          <p className="text-slate-400 text-sm">
            © 2024 AirYatra. India&#39;s Premier Aviation Platform.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default TermsPage;
