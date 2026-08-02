import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Plane, Shield, Users, TrendingUp, CheckCircle, Crown, Building2, Lock, Sparkles,
  ChevronLeft, ChevronRight, MapPin, Mail, Phone, Clock, Star, Award, 
  Briefcase, HeartHandshake, Globe, Headphones, FileCheck, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import LanguageSwitcher from '../components/shared/LanguageSwitcher';
import TestimonialsSlider from '../components/landing/TestimonialsSlider';
import InvestorInterestSection from '../components/landing/InvestorInterestSection';

// Hero Slider Images
const HERO_SLIDES = [
  {
    id: 1,
    image: "https://images.unsplash.com/photo-1619659085985-f51a00f0160a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHw0fHxsdXh1cnklMjBwcml2YXRlJTIwamV0JTIwY2hhcnRlciUyMGF2aWF0aW9ufGVufDB8fHx8MTc4NTY3MjI4NHww&ixlib=rb-4.1.0&q=85",
    title: "Premium Charter Flights",
    subtitle: "Experience luxury in the skies with our world-class fleet",
    titleHi: "प्रीमियम चार्टर फ्लाइट्स"
  },
  {
    id: 2,
    image: "https://images.unsplash.com/photo-1474302770737-173ee21bab63?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwzfHxsdXh1cnklMjBwcml2YXRlJTIwamV0JTIwY2hhcnRlciUyMGF2aWF0aW9ufGVufDB8fHx8MTc4NTY3MjI4NHww&ixlib=rb-4.1.0&q=85",
    title: "Private Jet Excellence",
    subtitle: "Your personal aircraft awaits for seamless journeys",
    titleHi: "प्राइवेट जेट एक्सीलेंस"
  },
  {
    id: 3,
    image: "https://images.unsplash.com/photo-1782865423531-27f6fab92fe8?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2OTV8MHwxfHNlYXJjaHwyfHxoZWxpY29wdGVyJTIwYWVyaWFsJTIwdG91ciUyMGNpdHlzY2FwZXxlbnwwfHx8fDE3ODU2NzIyODl8MA&ixlib=rb-4.1.0&q=85",
    title: "Helicopter Services",
    subtitle: "City tours, transfers & emergency medical services",
    titleHi: "हेलीकॉप्टर सेवाएं"
  },
  {
    id: 4,
    image: "https://images.unsplash.com/photo-1625513123245-fcb02d69ad12?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBwcml2YXRlJTIwamV0JTIwY2hhcnRlciUyMGF2aWF0aW9ufGVufDB8fHx8MTc4NTY3MjI4NHww&ixlib=rb-4.1.0&q=85",
    title: "Luxury Interiors",
    subtitle: "Travel in comfort with premium cabin amenities",
    titleHi: "लग्जरी इंटीरियर्स"
  },
  {
    id: 5,
    image: "https://images.unsplash.com/photo-1661954864180-e61dea14208a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwyfHxsdXh1cnklMjBwcml2YXRlJTIwamV0JTIwY2hhcnRlciUyMGF2aWF0aW9ufGVufDB8fHx8MTc4NTY3MjI4NHww&ixlib=rb-4.1.0&q=85",
    title: "In-Flight Dining",
    subtitle: "Gourmet cuisine served at 40,000 feet",
    titleHi: "इन-फ्लाइट डाइनिंग"
  }
];

// Company Info
const COMPANY_INFO = {
  address: "Office No 7,8 Daynemic Granduer, D Wing, Ground Floor, Undri-Wadachi Road, Undri, Pune - 411060",
  email: "airyatraadmin@gmail.com",
  phone: "+91 98765 43210",
  hours: "Mon - Sat: 9:00 AM - 7:00 PM"
};

function LandingPage({ user }) {
  const { t } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Auto-slide effect
  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const nextSlide = () => {
    setIsAutoPlaying(false);
    setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
  };

  const prevSlide = () => {
    setIsAutoPlaying(false);
    setCurrentSlide((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
  };

  const goToSlide = (index) => {
    setIsAutoPlaying(false);
    setCurrentSlide(index);
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-slate-950/90 backdrop-blur-lg border-b border-slate-800" data-testid="landing-nav">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Plane className="h-8 w-8 text-orange-500" />
            <span className="text-2xl font-bold text-white tracking-tight">AirYatra</span>
          </div>
          
          {/* Navigation Links */}
          <div className="hidden lg:flex items-center space-x-8">
            <a href="#services" className="text-slate-300 hover:text-orange-500 transition-colors">Services</a>
            <Link to="/fleet" className="text-slate-300 hover:text-orange-500 transition-colors">Fleet</Link>
            <Link to="/blog" className="text-slate-300 hover:text-orange-500 transition-colors">Blog</Link>
            <a href="#about" className="text-slate-300 hover:text-orange-500 transition-colors">About</a>
            <a href="#contact" className="text-slate-300 hover:text-orange-500 transition-colors">Contact</a>
          </div>
          
          <div className="flex items-center space-x-3">
            <LanguageSwitcher />
            {user ? (
              <Link to={`/${user.roles[0]}`}>
                <Button variant="default" className="bg-orange-500 hover:bg-orange-600" data-testid="dashboard-btn">
                  {t('nav.dashboard')}
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" className="text-white hidden sm:inline-flex" data-testid="login-btn">
                    {t('nav.login')}
                  </Button>
                </Link>
                <Link to="/booking">
                  <Button className="bg-orange-500 hover:bg-orange-600" data-testid="book-now-btn">
                    {t('nav.bookNow')}
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section with 5-Slide Carousel */}
      <section className="relative h-screen" data-testid="hero-section">
        {/* Slides */}
        <div className="absolute inset-0 overflow-hidden">
          {HERO_SLIDES.map((slide, index) => (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                index === currentSlide ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <img
                src={slide.image}
                alt={slide.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/50 to-slate-950"></div>
            </div>
          ))}
        </div>
        
        {/* Slide Content */}
        <div className="relative h-full flex items-center justify-center px-6">
          <div className="max-w-5xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 bg-orange-500/20 border border-orange-500/30 rounded-full px-4 py-2 mb-4">
              <Sparkles className="h-4 w-4 text-orange-400" />
              <span className="text-orange-400 text-sm font-medium">India&#39;s Premier Aviation Platform</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight animate-fade-in" data-testid="hero-title">
              {HERO_SLIDES[currentSlide].title}
            </h1>
            <p className="text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto font-light">
              {HERO_SLIDES[currentSlide].subtitle}
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
              <Link to="/booking">
                <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-lg px-10 py-6 rounded-full" data-testid="hero-book-btn">
                  <Plane className="mr-2 h-5 w-5" />
                  Book Your Flight
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 text-lg px-10 py-6 rounded-full" data-testid="become-operator-btn">
                  Become an Operator
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Slide Navigation Arrows */}
        <button
          onClick={prevSlide}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/30 hover:bg-black/50 rounded-full text-white transition-all z-10"
          aria-label="Previous slide"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button
          onClick={nextSlide}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/30 hover:bg-black/50 rounded-full text-white transition-all z-10"
          aria-label="Next slide"
        >
          <ChevronRight className="h-6 w-6" />
        </button>

        {/* Slide Indicators */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-10">
          {HERO_SLIDES.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                index === currentSlide 
                  ? 'bg-orange-500 w-8' 
                  : 'bg-white/40 hover:bg-white/60'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-24 px-6 bg-slate-900" data-testid="services-section">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-orange-500 font-semibold text-sm uppercase tracking-wider">Our Services</span>
            <h2 className="text-4xl md:text-5xl font-bold text-white mt-3 mb-4">
              Premium Aviation Solutions
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              From private jets to helicopters, we provide end-to-end aviation services tailored to your needs
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Service Card 1 */}
            <div className="group bg-slate-800/50 border border-slate-700 rounded-2xl p-8 hover:border-orange-500/50 transition-all hover:-translate-y-1">
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-4 rounded-xl w-fit mb-6 group-hover:scale-110 transition-transform">
                <Plane className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Private Jet Charter</h3>
              <p className="text-slate-400 mb-4">
                Luxury private jets for business and leisure travel. Fly on your schedule with maximum comfort and privacy.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-400" /> Flexible scheduling
                </li>
                <li className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-400" /> VIP ground handling
                </li>
                <li className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-400" /> In-flight catering
                </li>
              </ul>
            </div>

            {/* Service Card 2 */}
            <div className="group bg-slate-800/50 border border-slate-700 rounded-2xl p-8 hover:border-orange-500/50 transition-all hover:-translate-y-1">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-xl w-fit mb-6 group-hover:scale-110 transition-transform">
                <Globe className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Helicopter Services</h3>
              <p className="text-slate-400 mb-4">
                Quick city transfers, aerial tours, and emergency medical evacuations with our helicopter fleet.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-400" /> City-to-city transfers
                </li>
                <li className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-400" /> Scenic aerial tours
                </li>
                <li className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-400" /> Medical evacuation
                </li>
              </ul>
            </div>

            {/* Service Card 3 */}
            <div className="group bg-slate-800/50 border border-slate-700 rounded-2xl p-8 hover:border-orange-500/50 transition-all hover:-translate-y-1">
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-4 rounded-xl w-fit mb-6 group-hover:scale-110 transition-transform">
                <Building2 className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Corporate Solutions</h3>
              <p className="text-slate-400 mb-4">
                Dedicated aviation solutions for enterprises with volume discounts and priority booking.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-400" /> Corporate accounts
                </li>
                <li className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-400" /> Travel analytics
                </li>
                <li className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-400" /> Dedicated manager
                </li>
              </ul>
            </div>

            {/* Service Card 4 */}
            <div className="group bg-slate-800/50 border border-slate-700 rounded-2xl p-8 hover:border-orange-500/50 transition-all hover:-translate-y-1">
              <div className="bg-gradient-to-br from-green-500 to-green-600 p-4 rounded-xl w-fit mb-6 group-hover:scale-110 transition-transform">
                <FileCheck className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Aircraft Management</h3>
              <p className="text-slate-400 mb-4">
                Complete aircraft management including maintenance, crew, and charter revenue optimization.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-400" /> Maintenance scheduling
                </li>
                <li className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-400" /> Crew management
                </li>
                <li className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-400" /> Revenue optimization
                </li>
              </ul>
            </div>

            {/* Service Card 5 */}
            <div className="group bg-slate-800/50 border border-slate-700 rounded-2xl p-8 hover:border-orange-500/50 transition-all hover:-translate-y-1">
              <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 p-4 rounded-xl w-fit mb-6 group-hover:scale-110 transition-transform">
                <Zap className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Emergency Services</h3>
              <p className="text-slate-400 mb-4">
                24/7 emergency aviation support for medical, rescue, and urgent travel requirements.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-400" /> Air ambulance
                </li>
                <li className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-400" /> Organ transport
                </li>
                <li className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-400" /> Disaster relief
                </li>
              </ul>
            </div>

            {/* Service Card 6 */}
            <div className="group bg-slate-800/50 border border-slate-700 rounded-2xl p-8 hover:border-orange-500/50 transition-all hover:-translate-y-1">
              <div className="bg-gradient-to-br from-pink-500 to-pink-600 p-4 rounded-xl w-fit mb-6 group-hover:scale-110 transition-transform">
                <HeartHandshake className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Concierge Services</h3>
              <p className="text-slate-400 mb-4">
                End-to-end travel assistance including hotel bookings, ground transport, and event planning.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-400" /> Luxury hotel booking
                </li>
                <li className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-400" /> Limousine service
                </li>
                <li className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-400" /> Event coordination
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 px-6 bg-slate-950" data-testid="about-section">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* About Content */}
            <div>
              <span className="text-orange-500 font-semibold text-sm uppercase tracking-wider">About Us</span>
              <h2 className="text-4xl md:text-5xl font-bold text-white mt-3 mb-6">
                India&#39;s Trusted Aviation Partner Since 2020
              </h2>
              <p className="text-slate-400 text-lg mb-6">
                AirYatra is India&#39;s premier aviation operating system, connecting travelers with verified charter operators, 
                helicopter services, and luxury aviation experiences. We have revolutionized how India flies private.
              </p>
              <p className="text-slate-400 mb-8">
                Our platform combines cutting-edge technology with personalized service to deliver seamless 
                aviation experiences. From corporate executives to leisure travelers, we serve clients who 
                value time, comfort, and reliability.
              </p>
              
              {/* Stats */}
              <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="text-center">
                  <div className="text-4xl font-bold text-orange-500">500+</div>
                  <div className="text-slate-400 text-sm">Flights Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-orange-500">50+</div>
                  <div className="text-slate-400 text-sm">Aircraft Fleet</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-orange-500">100%</div>
                  <div className="text-slate-400 text-sm">Safety Record</div>
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-full">
                  <Award className="h-5 w-5 text-yellow-500" />
                  <span className="text-slate-300 text-sm">DGCA Approved</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-full">
                  <Shield className="h-5 w-5 text-green-500" />
                  <span className="text-slate-300 text-sm">ISO Certified</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-full">
                  <Star className="h-5 w-5 text-orange-500" />
                  <span className="text-slate-300 text-sm">5-Star Rated</span>
                </div>
              </div>
            </div>

            {/* About Image Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <img 
                  src="https://images.unsplash.com/photo-1619659085985-f51a00f0160a?crop=entropy&cs=srgb&fm=jpg&w=400&q=80" 
                  alt="Private Jet" 
                  className="rounded-2xl w-full h-48 object-cover"
                />
                <img 
                  src="https://images.unsplash.com/photo-1625513123245-fcb02d69ad12?crop=entropy&cs=srgb&fm=jpg&w=400&q=80" 
                  alt="Luxury Interior" 
                  className="rounded-2xl w-full h-64 object-cover"
                />
              </div>
              <div className="space-y-4 pt-8">
                <img 
                  src="https://images.unsplash.com/photo-1782865423531-27f6fab92fe8?crop=entropy&cs=srgb&fm=jpg&w=400&q=80" 
                  alt="Helicopter" 
                  className="rounded-2xl w-full h-64 object-cover"
                />
                <img 
                  src="https://images.unsplash.com/photo-1474302770737-173ee21bab63?crop=entropy&cs=srgb&fm=jpg&w=400&q=80" 
                  alt="Aircraft" 
                  className="rounded-2xl w-full h-48 object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-slate-900" data-testid="features-section">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-white text-center mb-12" data-testid="features-title">
            {t('landing.whyChoose')}
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="glass p-8 rounded-lg text-center hover:scale-105 transition-transform">
              <Shield className="h-12 w-12 text-orange-500 mb-4 mx-auto" />
              <h3 className="text-2xl font-bold text-white mb-3">{t('landing.verifiedOperators')}</h3>
              <p className="text-slate-400">
                {t('landing.verifiedOperatorsDesc')}
              </p>
            </div>
            <div className="glass p-8 rounded-lg text-center hover:scale-105 transition-transform">
              <Users className="h-12 w-12 text-orange-500 mb-4 mx-auto" />
              <h3 className="text-2xl font-bold text-white mb-3">{t('landing.multipleOptions')}</h3>
              <p className="text-slate-400">
                {t('landing.multipleOptionsDesc')}
              </p>
            </div>
            <div className="glass p-8 rounded-lg text-center hover:scale-105 transition-transform">
              <TrendingUp className="h-12 w-12 text-orange-500 mb-4 mx-auto" />
              <h3 className="text-2xl font-bold text-white mb-3">{t('landing.transparentPricing')}</h3>
              <p className="text-slate-400">
                {t('landing.transparentPricingDesc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section className="py-20 px-6 bg-slate-950" data-testid="products-section">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">{t('landing.products')}</h2>
            <p className="text-slate-400 text-lg">Complete aviation solutions for every stakeholder</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Aviation Exchange Card */}
            <div className="glass p-8 rounded-2xl border border-slate-700 hover:border-orange-500/50 transition-all group">
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-4 rounded-xl w-fit mb-6">
                <Sparkles className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">{t('landing.aviationExchange')}</h3>
              <p className="text-slate-400 mb-6">
                {t('landing.exchangeDesc')}
              </p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-400" /> {t('landing.liveTracking')}
                </li>
                <li className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-400" /> {t('landing.instantQuotes')}
                </li>
                <li className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-400" /> {t('landing.securePayments')}
                </li>
              </ul>
              <Link to="/exchange">
                <Button className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:opacity-90" data-testid="explore-exchange-btn">
                  {t('landing.exploreExchange')}
                </Button>
              </Link>
            </div>

            {/* Corporate Card */}
            <div className="glass p-8 rounded-2xl border border-slate-700 hover:border-orange-500/50 transition-all group">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-xl w-fit mb-6">
                <Building2 className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">{t('landing.corporateSolutions')}</h3>
              <p className="text-slate-400 mb-6">
                {t('landing.corporateDesc')}
              </p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-400" /> {t('landing.dedicatedManager')}
                </li>
                <li className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-400" /> {t('landing.volumeDiscounts')}
                </li>
                <li className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-400" /> {t('landing.travelAnalytics')}
                </li>
              </ul>
              <Link to="/corporate">
                <Button className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:opacity-90" data-testid="explore-corporate-btn">
                  {t('landing.corporateRegistration')}
                </Button>
              </Link>
            </div>

            {/* Document Vault Card */}
            <div className="glass p-8 rounded-2xl border border-slate-700 hover:border-orange-500/50 transition-all group">
              <div className="bg-gradient-to-br from-purple-600 to-purple-800 p-4 rounded-xl w-fit mb-6">
                <Lock className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">{t('landing.documentVault')}</h3>
              <p className="text-slate-400 mb-6">
                {t('landing.vaultDesc')}
              </p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-400" /> {t('landing.encryption')}
                </li>
                <li className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-400" /> {t('landing.expiryReminders')}
                </li>
                <li className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-400" /> {t('landing.secureSharing')}
                </li>
              </ul>
              <Link to={user ? "/vault" : "/login"}>
                <Button className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:opacity-90" data-testid="explore-vault-btn">
                  {user ? t('landing.openVault') : t('landing.loginToAccess')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <TestimonialsSlider />

      {/* Investor Interest Section */}
      <InvestorInterestSection />

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-orange-500 to-orange-600" data-testid="cta-section">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-5xl font-black text-white" data-testid="cta-title">
            {t('landing.readyTakeOff')}
          </h2>
          <p className="text-xl text-white/90">
            {t('landing.ctaSubtitle')}
          </p>
          <Link to="/booking">
            <Button size="lg" className="bg-slate-900 hover:bg-slate-800 text-white text-lg px-12 py-6 rounded-full" data-testid="cta-book-btn">
              {t('landing.startBooking')}
            </Button>
          </Link>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 px-6 bg-slate-900" data-testid="contact-section">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-orange-500 font-semibold text-sm uppercase tracking-wider">Contact Us</span>
            <h2 className="text-4xl font-bold text-white mt-3 mb-4">Get In Touch</h2>
            <p className="text-slate-400">We are here to help with all your aviation needs</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Address Card */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center hover:border-orange-500/50 transition-all">
              <div className="bg-orange-500/20 p-3 rounded-full w-fit mx-auto mb-4">
                <MapPin className="h-6 w-6 text-orange-500" />
              </div>
              <h3 className="text-white font-semibold mb-2">Head Office</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                {COMPANY_INFO.address}
              </p>
            </div>

            {/* Email Card */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center hover:border-orange-500/50 transition-all">
              <div className="bg-blue-500/20 p-3 rounded-full w-fit mx-auto mb-4">
                <Mail className="h-6 w-6 text-blue-500" />
              </div>
              <h3 className="text-white font-semibold mb-2">Email Us</h3>
              <a href={`mailto:${COMPANY_INFO.email}`} className="text-orange-400 hover:text-orange-300 text-sm">
                {COMPANY_INFO.email}
              </a>
            </div>

            {/* Phone Card */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center hover:border-orange-500/50 transition-all">
              <div className="bg-green-500/20 p-3 rounded-full w-fit mx-auto mb-4">
                <Phone className="h-6 w-6 text-green-500" />
              </div>
              <h3 className="text-white font-semibold mb-2">Call Us</h3>
              <a href={`tel:${COMPANY_INFO.phone}`} className="text-orange-400 hover:text-orange-300 text-sm">
                {COMPANY_INFO.phone}
              </a>
            </div>

            {/* Hours Card */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center hover:border-orange-500/50 transition-all">
              <div className="bg-purple-500/20 p-3 rounded-full w-fit mx-auto mb-4">
                <Clock className="h-6 w-6 text-purple-500" />
              </div>
              <h3 className="text-white font-semibold mb-2">Working Hours</h3>
              <p className="text-slate-400 text-sm">
                {COMPANY_INFO.hours}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Premium Footer */}
      <footer className="bg-slate-950 py-16 px-6 border-t border-slate-800">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center space-x-2 mb-4">
                <Plane className="h-8 w-8 text-orange-500" />
                <span className="text-2xl font-bold text-white">AirYatra</span>
              </div>
              <p className="text-slate-400 text-sm mb-4">
                India&#39;s Premier Aviation Operating System. Connecting travelers with verified charter operators.
              </p>
              <div className="flex gap-3">
                <a href="#" className="bg-slate-800 p-2 rounded-lg hover:bg-slate-700 transition-colors">
                  <svg className="h-5 w-5 text-slate-400" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
                </a>
                <a href="#" className="bg-slate-800 p-2 rounded-lg hover:bg-slate-700 transition-colors">
                  <svg className="h-5 w-5 text-slate-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                </a>
                <a href="#" className="bg-slate-800 p-2 rounded-lg hover:bg-slate-700 transition-colors">
                  <svg className="h-5 w-5 text-slate-400" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-white font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li><Link to="/booking" className="text-slate-400 hover:text-orange-500 text-sm transition-colors">Book a Flight</Link></li>
                <li><Link to="/exchange" className="text-slate-400 hover:text-orange-500 text-sm transition-colors">Aviation Exchange</Link></li>
                <li><Link to="/corporate" className="text-slate-400 hover:text-orange-500 text-sm transition-colors">Corporate Solutions</Link></li>
                <li><a href="#services" className="text-slate-400 hover:text-orange-500 text-sm transition-colors">Our Services</a></li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="text-white font-semibold mb-4">Support</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-slate-400 hover:text-orange-500 text-sm transition-colors">Help Center</a></li>
                <li><a href="#" className="text-slate-400 hover:text-orange-500 text-sm transition-colors">Safety Guidelines</a></li>
                <li><a href="#" className="text-slate-400 hover:text-orange-500 text-sm transition-colors">Terms of Service</a></li>
                <li><a href="#" className="text-slate-400 hover:text-orange-500 text-sm transition-colors">Privacy Policy</a></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-white font-semibold mb-4">Contact</h4>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-orange-500 mt-1 flex-shrink-0" />
                  <span className="text-slate-400 text-sm">{COMPANY_INFO.address}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-orange-500 flex-shrink-0" />
                  <a href={`mailto:${COMPANY_INFO.email}`} className="text-slate-400 hover:text-orange-500 text-sm transition-colors">
                    {COMPANY_INFO.email}
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-orange-500 flex-shrink-0" />
                  <a href={`tel:${COMPANY_INFO.phone}`} className="text-slate-400 hover:text-orange-500 text-sm transition-colors">
                    {COMPANY_INFO.phone}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-500 text-sm">
              © 2024 AirYatra. All rights reserved. India&#39;s Premier Aviation Platform.
            </p>
            <div className="flex items-center gap-4">
              <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Visa_Inc._logo.svg/100px-Visa_Inc._logo.svg.png" alt="Visa" className="h-6 opacity-60" />
              <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/100px-Mastercard-logo.svg.png" alt="Mastercard" className="h-6 opacity-60" />
              <span className="text-slate-600 text-xs">Secure Payments</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
