import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Plane, Shield, Globe, Building2, FileCheck, Zap, HeartHandshake,
  CheckCircle, ArrowRight, Phone, Mail, Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const SERVICES = [
  {
    id: 'charter',
    icon: Plane,
    title: 'Private Jet Charter',
    titleHi: '',
    description: 'Luxury private jets for business and leisure travel. Fly on your schedule with maximum comfort and privacy.',
    features: [
      'Flexible scheduling - fly when you want',
      'VIP ground handling at all airports',
      'Gourmet in-flight catering',
      'Wi-Fi and entertainment systems',
      'Dedicated flight coordinator'
    ],
    color: 'from-orange-500 to-orange-600',
    price: 'Starting from ₹3,50,000/hour'
  },
  {
    id: 'helicopter',
    icon: Globe,
    title: 'Helicopter Services',
    titleHi: '',
    description: 'Quick city transfers, scenic aerial tours, and emergency medical evacuations with our modern helicopter fleet.',
    features: [
      'City-to-city rapid transfers',
      'Scenic aerial tours',
      'Wedding & event flights',
      'Corporate shuttle services',
      'Medical evacuation (HEMS)'
    ],
    color: 'from-blue-500 to-blue-600',
    price: 'Starting from ₹85,000/hour'
  },
  {
    id: 'corporate',
    icon: Building2,
    title: 'Corporate Solutions',
    titleHi: '',
    description: 'Dedicated aviation solutions for enterprises with volume discounts, priority booking, and travel analytics.',
    features: [
      'Corporate flight accounts',
      'Volume-based discounts',
      'Dedicated account manager',
      'Real-time travel analytics',
      'Invoice consolidation'
    ],
    color: 'from-purple-500 to-purple-600',
    price: 'Custom pricing'
  },
  {
    id: 'management',
    icon: FileCheck,
    title: 'Aircraft Management',
    titleHi: '',
    description: 'Complete aircraft management including maintenance scheduling, crew management, and charter revenue optimization.',
    features: [
      'Maintenance scheduling & tracking',
      'Crew management & training',
      'Charter revenue optimization',
      'Regulatory compliance',
      'Insurance coordination'
    ],
    color: 'from-green-500 to-green-600',
    price: 'Contact for details'
  },
  {
    id: 'emergency',
    icon: Zap,
    title: 'Emergency Services',
    titleHi: '',
    description: '24/7 emergency aviation support for medical evacuations, organ transport, and disaster relief operations.',
    features: [
      'Air ambulance services',
      'Organ transport flights',
      'Disaster relief operations',
      'Search & rescue support',
      'Critical patient transfer'
    ],
    color: 'from-red-500 to-red-600',
    price: '24/7 Emergency Line'
  },
  {
    id: 'concierge',
    icon: HeartHandshake,
    title: 'Concierge Services',
    titleHi: '',
    description: 'End-to-end travel assistance including luxury hotel bookings, ground transportation, and event planning.',
    features: [
      'Luxury hotel reservations',
      'Limousine & car services',
      'Restaurant reservations',
      'Event & meeting planning',
      'Personal shopping assistance'
    ],
    color: 'from-pink-500 to-pink-600',
    price: 'Complimentary with flights'
  }
];

function ServicesPage() {
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
            <Link to="/about">
              <Button variant="ghost" className="text-slate-300 hover:text-white">About</Button>
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
          <span className="text-orange-500 font-semibold text-sm uppercase tracking-wider">Our Services</span>
          <h1 className="text-5xl md:text-6xl font-bold text-white mt-4 mb-6">
            Premium Aviation Solutions
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            From private jets to emergency medical services, we provide comprehensive aviation solutions tailored to your needs
          </p>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid gap-12">
            {SERVICES.map((service, index) => (
              <div 
                key={service.id}
                className={`grid lg:grid-cols-2 gap-8 items-center ${index % 2 === 1 ? 'lg:flex-row-reverse' : ''}`}
              >
                {/* Content */}
                <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                  <div className={`bg-gradient-to-br ${service.color} p-4 rounded-xl w-fit mb-6`}>
                    <service.icon className="h-10 w-10 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-2">{service.title}</h2>
                  <p className="text-slate-400 text-lg mb-6">{service.description}</p>
                  
                  <ul className="space-y-3 mb-6">
                    {service.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-slate-300">
                        <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <div className="flex items-center gap-4">
                    <span className="text-orange-500 font-semibold">{service.price}</span>
                    <Link to="/booking">
                      <Button className={`bg-gradient-to-r ${service.color}`}>
                        Enquire Now <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
                
                {/* Image/Visual */}
                <div className={`bg-slate-800/50 border border-slate-700 rounded-2xl p-8 ${index % 2 === 1 ? 'lg:order-1' : ''}`}>
                  <div className="aspect-video bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl flex items-center justify-center">
                    <service.icon className="h-24 w-24 text-slate-600" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-orange-500 to-orange-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Ready to Experience Premium Aviation?</h2>
          <p className="text-white/90 text-lg mb-8">
            Contact our team for a customized quote or book your flight directly
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/booking">
              <Button size="lg" className="bg-slate-900 hover:bg-slate-800 text-white">
                Book a Flight
              </Button>
            </Link>
            <a href="mailto:airyatraadmin@gmail.com">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                <Mail className="mr-2 h-5 w-5" />
                Email Us
              </Button>
            </a>
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

export default ServicesPage;
