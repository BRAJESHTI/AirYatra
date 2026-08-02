import React from 'react';
import { Link } from 'react-router-dom';
import { Plane, ArrowLeft, Shield, Lock, Eye, Database, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

function PrivacyPage() {
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
          <h1 className="text-4xl font-bold text-white mb-8">Privacy Policy</h1>
          <p className="text-slate-400 mb-8">Last Updated: August 2026</p>

          {/* Quick Overview */}
          <div className="grid md:grid-cols-3 gap-4 mb-12">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
              <Shield className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-white font-medium">Data Protected</p>
              <p className="text-slate-400 text-sm">256-bit encryption</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
              <Lock className="h-8 w-8 text-blue-500 mx-auto mb-2" />
              <p className="text-white font-medium">Secure Storage</p>
              <p className="text-slate-400 text-sm">ISO certified servers</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
              <Eye className="h-8 w-8 text-orange-500 mx-auto mb-2" />
              <p className="text-white font-medium">Transparent</p>
              <p className="text-slate-400 text-sm">No hidden tracking</p>
            </div>
          </div>
          
          <div className="prose prose-invert max-w-none space-y-8">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Database className="h-5 w-5 text-orange-500" />
                Information We Collect
              </h2>
              <p className="text-slate-400 mb-3">We collect information that you provide directly:</p>
              <ul className="list-disc list-inside text-slate-400 space-y-2">
                <li>Name, email address, and phone number for account creation</li>
                <li>Identity documents (passport, Aadhaar) for aviation security compliance</li>
                <li>Payment information processed securely through our payment partners</li>
                <li>Travel preferences and booking history to improve your experience</li>
                <li>Communication records for customer support purposes</li>
              </ul>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">How We Use Your Information</h2>
              <ul className="list-disc list-inside text-slate-400 space-y-2">
                <li>Process and manage your flight bookings</li>
                <li>Communicate booking confirmations and updates</li>
                <li>Comply with aviation security and regulatory requirements</li>
                <li>Improve our services and personalize your experience</li>
                <li>Send promotional communications (with your consent)</li>
                <li>Detect and prevent fraudulent activities</li>
              </ul>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Information Sharing</h2>
              <p className="text-slate-400 mb-3">We share your information only with:</p>
              <ul className="list-disc list-inside text-slate-400 space-y-2">
                <li>Aviation operators to fulfill your booking</li>
                <li>Payment processors for secure transactions</li>
                <li>Government authorities as required by aviation regulations</li>
                <li>Service providers who assist in our operations (under strict confidentiality)</li>
              </ul>
              <p className="text-slate-400 mt-3">
                We never sell your personal information to third parties.
              </p>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Data Security</h2>
              <p className="text-slate-400">
                We implement industry-standard security measures including:
              </p>
              <ul className="list-disc list-inside text-slate-400 space-y-2 mt-3">
                <li>256-bit SSL encryption for all data transmission</li>
                <li>Two-factor authentication (2FA) for account security</li>
                <li>Regular security audits and penetration testing</li>
                <li>Secure data centers with ISO 27001 certification</li>
                <li>Employee access controls and training</li>
              </ul>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Your Rights</h2>
              <p className="text-slate-400 mb-3">You have the right to:</p>
              <ul className="list-disc list-inside text-slate-400 space-y-2">
                <li>Access your personal data</li>
                <li>Correct inaccurate information</li>
                <li>Request deletion of your data (subject to legal requirements)</li>
                <li>Opt-out of marketing communications</li>
                <li>Data portability</li>
              </ul>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Cookies</h2>
              <p className="text-slate-400">
                We use essential cookies to provide our services and analytics cookies 
                (with your consent) to improve user experience. You can manage cookie 
                preferences through your browser settings.
              </p>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Mail className="h-5 w-5 text-orange-500" />
                Contact Us
              </h2>
              <p className="text-slate-400">
                For privacy-related inquiries or to exercise your rights, contact our 
                Data Protection Officer at{' '}
                <a href="mailto:privacy@airyatra.com" className="text-orange-400 hover:text-orange-300">
                  privacy@airyatra.com
                </a>
                {' '}or{' '}
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

export default PrivacyPage;
