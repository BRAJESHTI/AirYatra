import React from 'react';
import { Link } from 'react-router-dom';
import { Plane, Shield, Users, TrendingUp, Star, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

function LandingPage({ user }) {
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass" data-testid="landing-nav">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Plane className="h-8 w-8 text-orange-500" />
            <span className="text-2xl font-bold text-white tracking-tight">AirYatra</span>
          </div>
          <div className="flex items-center space-x-4">
            {user ? (
              <Link to={`/${user.roles[0]}`}>
                <Button variant="default" className="bg-orange-500 hover:bg-orange-600" data-testid="dashboard-btn">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" className="text-white" data-testid="login-btn">
                    Login
                  </Button>
                </Link>
                <Link to="/booking">
                  <Button className="bg-orange-500 hover:bg-orange-600" data-testid="book-now-btn">
                    Book Now
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6" data-testid="hero-section">
        <div className="absolute inset-0 overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1710273371790-a82d32156f2a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwxfHxoZWxpY29wdGVyJTIwZmx5aW5nJTIwb3ZlciUyMGNpdHklMjBza3lsaW5lJTIwYWVyaWFsJTIwdmlld3xlbnwwfHx8fDE3NjYzMzgyNjJ8MA&ixlib=rb-4.1.0&q=85"
            alt="Helicopter flying"
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 hero-overlay"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto text-center space-y-8">
          <h1 className="text-6xl md:text-7xl font-black text-white tracking-tight" data-testid="hero-title">
            Sky-High Journeys,
            <br />
            <span className="text-orange-500">Simplified</span>
          </h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto font-light">
            India's Premier Helicopter Charter Aggregator. Connect with verified operators,
            book flights instantly, and soar above the ordinary.
          </p>
          <div className="flex justify-center gap-4">
            <Link to="/booking">
              <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-lg px-8 py-6" data-testid="hero-book-btn">
                Book Your Flight
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 text-lg px-8 py-6" data-testid="become-operator-btn">
                Become an Operator
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-slate-900" data-testid="features-section">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-white text-center mb-12" data-testid="features-title">
            Why Choose AirYatra?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="glass p-8 rounded-lg corner-markers">
              <Shield className="h-12 w-12 text-orange-500 mb-4" />
              <h3 className="text-2xl font-bold text-white mb-3">Verified Operators</h3>
              <p className="text-slate-400">
                All operators are thoroughly verified with AOC certificates, insurance, and safety compliance.
              </p>
            </div>
            <div className="glass p-8 rounded-lg corner-markers">
              <TrendingUp className="h-12 w-12 text-orange-500 mb-4" />
              <h3 className="text-2xl font-bold text-white mb-3">Best Prices</h3>
              <p className="text-slate-400">
                AI-powered price suggestions ensure you get competitive quotes from multiple operators.
              </p>
            </div>
            <div className="glass p-8 rounded-lg corner-markers">
              <Users className="h-12 w-12 text-orange-500 mb-4" />
              <h3 className="text-2xl font-bold text-white mb-3">Seamless Booking</h3>
              <p className="text-slate-400">
                From quote requests to digital tickets, manage your entire journey in one platform.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-6 bg-slate-950" data-testid="stats-section">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-5xl font-black text-orange-500 mb-2">500+</div>
            <div className="text-slate-400 uppercase tracking-wider text-sm">Flights Completed</div>
          </div>
          <div>
            <div className="text-5xl font-black text-orange-500 mb-2">50+</div>
            <div className="text-slate-400 uppercase tracking-wider text-sm">Verified Operators</div>
          </div>
          <div>
            <div className="text-5xl font-black text-orange-500 mb-2">100%</div>
            <div className="text-slate-400 uppercase tracking-wider text-sm">Safety Record</div>
          </div>
          <div>
            <div className="text-5xl font-black text-orange-500 mb-2">4.9/5</div>
            <div className="text-slate-400 uppercase tracking-wider text-sm">Customer Rating</div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-orange-500 to-orange-600" data-testid="cta-section">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-5xl font-black text-white" data-testid="cta-title">
            Ready to Take Off?
          </h2>
          <p className="text-xl text-white/90">
            Book your helicopter charter today and experience aviation excellence.
          </p>
          <Link to="/booking">
            <Button size="lg" className="bg-slate-900 hover:bg-slate-800 text-white text-lg px-12 py-6" data-testid="cta-book-btn">
              Start Booking
            </Button>
          </Link>
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
            © 2025 AirYatra. All rights reserved. India's Premier Helicopter Charter Platform.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;