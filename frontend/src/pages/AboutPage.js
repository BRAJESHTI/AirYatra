import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Plane, Shield, Award, Star, Users, Target, Heart, 
  CheckCircle, MapPin, Mail, Phone, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const COMPANY_INFO = {
  address: "Office No 7,8 Daynemic Granduer, D Wing, Ground Floor, Undri-Wadachi Road, Undri, Pune - 411060",
  email: "airyatraadmin@gmail.com",
  phone: "+91 98765 43210",
  hours: "Mon - Sat: 9:00 AM - 7:00 PM"
};

const TEAM = [
  { name: 'Rahul Sharma', role: 'CEO & Founder', image: '👨‍✈️' },
  { name: 'Priya Patel', role: 'Operations Head', image: '👩‍💼' },
  { name: 'Amit Singh', role: 'Chief Pilot', image: '👨‍✈️' },
  { name: 'Sneha Desai', role: 'Customer Relations', image: '👩‍💼' }
];

const MILESTONES = [
  { year: '2020', title: 'Founded', description: 'AirYatra launched in Pune' },
  { year: '2021', title: 'First 100 Flights', description: 'Completed milestone flights' },
  { year: '2022', title: 'Pan-India Operations', description: 'Expanded to 15+ cities' },
  { year: '2023', title: 'ISO Certification', description: 'Quality management certified' },
  { year: '2024', title: '500+ Flights', description: 'Growing strong with 100% safety' }
];

function AboutPage() {
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
              <Button variant="ghost" className="text-slate-300 hover:text-white">Home</Button>
            </Link>
            <Link to="/services">
              <Button variant="ghost" className="text-slate-300 hover:text-white">Services</Button>
            </Link>
            <Link to="/booking">
              <Button className="bg-orange-500 hover:bg-orange-600">Book Now</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-orange-500 font-semibold text-sm uppercase tracking-wider">About Us</span>
          <h1 className="text-5xl md:text-6xl font-bold text-white mt-4 mb-6">
            India&#39;s Trusted Aviation Partner
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Since 2020, AirYatra has been revolutionizing how India flies private with our commitment to safety, luxury, and excellence
          </p>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold text-white mb-6">Our Story</h2>
              <p className="text-slate-400 text-lg mb-6">
                AirYatra was born from a simple vision: to make private aviation accessible, safe, and luxurious for every Indian. 
                Founded in Pune in 2020, we started with a single helicopter and a dream to transform India&#39;s charter aviation industry.
              </p>
              <p className="text-slate-400 mb-6">
                Today, we operate a fleet of 50+ aircraft including private jets, helicopters, and turboprops, 
                serving clients across 15+ cities in India. Our commitment to safety, transparency, and customer 
                satisfaction has made us the preferred choice for discerning travelers.
              </p>
              <p className="text-slate-400">
                Whether it is a business executive flying to Mumbai for an important meeting, a family chartering 
                a helicopter for a wedding, or an emergency medical evacuation - AirYatra delivers with precision and care.
              </p>
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-center">
                <div className="text-5xl font-bold text-orange-500 mb-2">500+</div>
                <div className="text-slate-400">Flights Completed</div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-center">
                <div className="text-5xl font-bold text-orange-500 mb-2">50+</div>
                <div className="text-slate-400">Aircraft Fleet</div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-center">
                <div className="text-5xl font-bold text-orange-500 mb-2">15+</div>
                <div className="text-slate-400">Cities Served</div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-center">
                <div className="text-5xl font-bold text-orange-500 mb-2">100%</div>
                <div className="text-slate-400">Safety Record</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-20 px-6 bg-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12">
            {/* Mission */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8">
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-4 rounded-xl w-fit mb-6">
                <Target className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Our Mission</h3>
              <p className="text-slate-400">
                To democratize private aviation in India by providing safe, reliable, and luxurious charter 
                services that exceed customer expectations while maintaining the highest standards of operational excellence.
              </p>
            </div>

            {/* Vision */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-xl w-fit mb-6">
                <Star className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Our Vision</h3>
              <p className="text-slate-400">
                To become India&#39;s most trusted aviation platform, connecting every corner of the country 
                with premium charter services and setting new benchmarks for safety, innovation, and customer delight.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">Our Core Values</h2>
            <p className="text-slate-400">The principles that guide everything we do</p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="bg-green-500/20 p-4 rounded-full w-fit mx-auto mb-4">
                <Shield className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Safety First</h3>
              <p className="text-slate-400 text-sm">Uncompromising commitment to aviation safety standards</p>
            </div>
            <div className="text-center">
              <div className="bg-orange-500/20 p-4 rounded-full w-fit mx-auto mb-4">
                <Award className="h-8 w-8 text-orange-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Excellence</h3>
              <p className="text-slate-400 text-sm">Striving for perfection in every flight operation</p>
            </div>
            <div className="text-center">
              <div className="bg-blue-500/20 p-4 rounded-full w-fit mx-auto mb-4">
                <Users className="h-8 w-8 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Customer Focus</h3>
              <p className="text-slate-400 text-sm">Your satisfaction is our top priority</p>
            </div>
            <div className="text-center">
              <div className="bg-pink-500/20 p-4 rounded-full w-fit mx-auto mb-4">
                <Heart className="h-8 w-8 text-pink-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Integrity</h3>
              <p className="text-slate-400 text-sm">Transparent pricing and honest communication</p>
            </div>
          </div>
        </div>
      </section>

      {/* Journey Timeline */}
      <section className="py-20 px-6 bg-slate-900">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">Our Journey</h2>
            <p className="text-slate-400">Milestones that shaped AirYatra</p>
          </div>
          
          <div className="space-y-8">
            {MILESTONES.map((milestone, index) => (
              <div key={index} className="flex items-center gap-6">
                <div className="bg-orange-500 text-white font-bold px-4 py-2 rounded-lg min-w-[80px] text-center">
                  {milestone.year}
                </div>
                <div className="flex-1 bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <h3 className="text-white font-semibold">{milestone.title}</h3>
                  <p className="text-slate-400 text-sm">{milestone.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">Certifications & Compliance</h2>
            <p className="text-slate-400">Operating with the highest standards</p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-6">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-8 py-4 flex items-center gap-3">
              <Shield className="h-6 w-6 text-green-500" />
              <span className="text-white">DGCA Approved</span>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-8 py-4 flex items-center gap-3">
              <Award className="h-6 w-6 text-blue-500" />
              <span className="text-white">ISO 9001:2015</span>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-8 py-4 flex items-center gap-3">
              <Star className="h-6 w-6 text-yellow-500" />
              <span className="text-white">NSOP Certified</span>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-8 py-4 flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-orange-500" />
              <span className="text-white">IS-BAO Compliant</span>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 px-6 bg-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">Visit Our Office</h2>
            <p className="text-slate-400">We would love to meet you in person</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center">
              <div className="bg-orange-500/20 p-3 rounded-full w-fit mx-auto mb-4">
                <MapPin className="h-6 w-6 text-orange-500" />
              </div>
              <h3 className="text-white font-semibold mb-2">Head Office</h3>
              <p className="text-slate-400 text-sm">{COMPANY_INFO.address}</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center">
              <div className="bg-blue-500/20 p-3 rounded-full w-fit mx-auto mb-4">
                <Mail className="h-6 w-6 text-blue-500" />
              </div>
              <h3 className="text-white font-semibold mb-2">Email</h3>
              <a href={`mailto:${COMPANY_INFO.email}`} className="text-orange-400 hover:text-orange-300 text-sm">
                {COMPANY_INFO.email}
              </a>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center">
              <div className="bg-green-500/20 p-3 rounded-full w-fit mx-auto mb-4">
                <Phone className="h-6 w-6 text-green-500" />
              </div>
              <h3 className="text-white font-semibold mb-2">Phone</h3>
              <a href={`tel:${COMPANY_INFO.phone}`} className="text-orange-400 hover:text-orange-300 text-sm">
                {COMPANY_INFO.phone}
              </a>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center">
              <div className="bg-purple-500/20 p-3 rounded-full w-fit mx-auto mb-4">
                <Clock className="h-6 w-6 text-purple-500" />
              </div>
              <h3 className="text-white font-semibold mb-2">Hours</h3>
              <p className="text-slate-400 text-sm">{COMPANY_INFO.hours}</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gradient-to-r from-orange-500 to-orange-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Ready to Fly With Us?</h2>
          <p className="text-white/90 text-lg mb-8">
            Experience the AirYatra difference - where luxury meets reliability
          </p>
          <Link to="/booking">
            <Button size="lg" className="bg-slate-900 hover:bg-slate-800 text-white">
              Book Your Flight Now
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
            © 2024 AirYatra. India&#39;s Premier Aviation Platform.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default AboutPage;
