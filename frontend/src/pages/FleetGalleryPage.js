import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plane, Filter, Users, Gauge, MapPin, Fuel, CheckCircle, 
  Phone, ChevronDown, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function FleetGalleryPage() {
  const [aircraft, setAircraft] = useState([]);
  const [types, setTypes] = useState([]);
  const [selectedType, setSelectedType] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedAircraft, setSelectedAircraft] = useState(null);

  useEffect(() => {
    fetchFleet();
  }, []);

  const fetchFleet = async () => {
    try {
      const response = await fetch(`${API_URL}/api/content/fleet`);
      const data = await response.json();
      setAircraft(data.aircraft || []);
      setTypes(data.types || []);
    } catch (err) {
      console.error('Error fetching fleet:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredAircraft = selectedType === 'all' 
    ? aircraft 
    : aircraft.filter(a => a.type === selectedType);

  const getTypeLabel = (type) => {
    const labels = {
      jet: 'Private Jets',
      helicopter: 'Helicopters',
      turboprop: 'Turboprops'
    };
    return labels[type] || type;
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'helicopter':
        return '🚁';
      case 'turboprop':
        return '✈️';
      default:
        return '🛩️';
    }
  };

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
      <section className="pt-32 pb-16 px-6 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-orange-500 font-semibold text-sm uppercase tracking-wider">Our Fleet</span>
          <h1 className="text-5xl md:text-6xl font-bold text-white mt-4 mb-6">
            World-Class Aircraft Fleet
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            From luxurious private jets to versatile helicopters, explore our carefully curated fleet of aircraft
          </p>
        </div>
      </section>

      {/* Filter Bar */}
      <section className="py-6 px-6 bg-slate-900 sticky top-[73px] z-40 border-b border-slate-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="h-5 w-5 text-slate-400" />
            <span className="text-slate-400 text-sm mr-2">Filter by:</span>
            
            <button
              onClick={() => setSelectedType('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedType === 'all'
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              All Aircraft ({aircraft.length})
            </button>
            
            {types.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedType === type
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {getTypeIcon(type)} {getTypeLabel(type)} ({aircraft.filter(a => a.type === type).length})
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Fleet Grid */}
      <section className="py-12 px-6">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="text-center py-20">
              <div className="animate-spin h-12 w-12 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-slate-400">Loading fleet...</p>
            </div>
          ) : filteredAircraft.length === 0 ? (
            <div className="text-center py-20">
              <Plane className="h-16 w-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No aircraft found in this category</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredAircraft.map((craft) => (
                <div
                  key={craft.id}
                  className="group bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden hover:border-orange-500/50 transition-all cursor-pointer"
                  onClick={() => setSelectedAircraft(craft)}
                >
                  {/* Image */}
                  <div className="relative h-56 overflow-hidden">
                    <img
                      src={craft.image_url}
                      alt={craft.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute top-4 left-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        craft.type === 'jet' ? 'bg-blue-500' :
                        craft.type === 'helicopter' ? 'bg-green-500' :
                        'bg-purple-500'
                      } text-white`}>
                        {getTypeIcon(craft.type)} {getTypeLabel(craft.type).slice(0, -1)}
                      </span>
                    </div>
                    {craft.is_available && (
                      <div className="absolute top-4 right-4">
                        <span className="px-2 py-1 bg-green-500/20 border border-green-500/30 rounded-full text-xs text-green-400">
                          Available
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-white mb-1">{craft.name}</h3>
                    <p className="text-slate-400 text-sm mb-4">{craft.model}</p>

                    {/* Specs */}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center">
                        <Users className="h-5 w-5 text-orange-500 mx-auto mb-1" />
                        <p className="text-white font-semibold">{craft.capacity}</p>
                        <p className="text-slate-500 text-xs">Passengers</p>
                      </div>
                      <div className="text-center">
                        <MapPin className="h-5 w-5 text-orange-500 mx-auto mb-1" />
                        <p className="text-white font-semibold">{craft.range_km}</p>
                        <p className="text-slate-500 text-xs">Range (km)</p>
                      </div>
                      <div className="text-center">
                        <Gauge className="h-5 w-5 text-orange-500 mx-auto mb-1" />
                        <p className="text-white font-semibold">{craft.speed_kmh}</p>
                        <p className="text-slate-500 text-xs">Speed (km/h)</p>
                      </div>
                    </div>

                    {/* Price & CTA */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                      <div>
                        <p className="text-slate-400 text-xs">Starting from</p>
                        <p className="text-orange-500 font-bold">{craft.hourly_rate}</p>
                      </div>
                      <Button size="sm" className="bg-orange-500 hover:bg-orange-600">
                        View Details
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Aircraft Detail Modal */}
      {selectedAircraft && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setSelectedAircraft(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="relative h-72">
              <img
                src={selectedAircraft.image_url}
                alt={selectedAircraft.name}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setSelectedAircraft(null)}
                className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="absolute bottom-4 left-4">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  selectedAircraft.type === 'jet' ? 'bg-blue-500' :
                  selectedAircraft.type === 'helicopter' ? 'bg-green-500' :
                  'bg-purple-500'
                } text-white`}>
                  {getTypeIcon(selectedAircraft.type)} {getTypeLabel(selectedAircraft.type).slice(0, -1)}
                </span>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-8">
              <h2 className="text-3xl font-bold text-white mb-2">{selectedAircraft.name}</h2>
              <p className="text-slate-400 mb-6">Model: {selectedAircraft.model}</p>

              {/* Specs Grid */}
              <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="bg-slate-800 rounded-xl p-4 text-center">
                  <Users className="h-6 w-6 text-orange-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">{selectedAircraft.capacity}</p>
                  <p className="text-slate-400 text-sm">Passengers</p>
                </div>
                <div className="bg-slate-800 rounded-xl p-4 text-center">
                  <MapPin className="h-6 w-6 text-orange-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">{selectedAircraft.range_km}</p>
                  <p className="text-slate-400 text-sm">Range (km)</p>
                </div>
                <div className="bg-slate-800 rounded-xl p-4 text-center">
                  <Gauge className="h-6 w-6 text-orange-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">{selectedAircraft.speed_kmh}</p>
                  <p className="text-slate-400 text-sm">Speed (km/h)</p>
                </div>
                <div className="bg-slate-800 rounded-xl p-4 text-center">
                  <Fuel className="h-6 w-6 text-orange-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">{selectedAircraft.hourly_rate?.split('/')[0] || 'On Request'}</p>
                  <p className="text-slate-400 text-sm">Per Hour</p>
                </div>
              </div>

              {/* Features */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-white mb-4">Features & Amenities</h3>
                <div className="grid grid-cols-2 gap-3">
                  {selectedAircraft.features?.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-slate-300">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="flex gap-4">
                <Link to="/booking" className="flex-1">
                  <Button className="w-full bg-orange-500 hover:bg-orange-600 h-12">
                    <Plane className="mr-2 h-5 w-5" />
                    Book This Aircraft
                  </Button>
                </Link>
                <a href="tel:+919876543210" className="flex-1">
                  <Button variant="outline" className="w-full border-slate-600 text-white hover:bg-slate-800 h-12">
                    <Phone className="mr-2 h-5 w-5" />
                    Call for Quote
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-orange-500 to-orange-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Ready to Fly?</h2>
          <p className="text-white/90 text-lg mb-8">
            Contact us for a personalized quote or book your flight directly
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/booking">
              <Button size="lg" className="bg-slate-900 hover:bg-slate-800 text-white">
                Book Now
              </Button>
            </Link>
            <a href="tel:+919876543210">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                <Phone className="mr-2 h-5 w-5" />
                Call Us
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
            © 2024 AirYatra. India Premier Aviation Platform.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default FleetGalleryPage;
