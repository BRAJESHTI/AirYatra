import React, { useState, useEffect } from 'react';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function TestimonialsSlider() {
  const [testimonials, setTestimonials] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTestimonials();
  }, []);

  useEffect(() => {
    if (testimonials.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 6000);
    
    return () => clearInterval(interval);
  }, [testimonials.length]);

  const fetchTestimonials = async () => {
    try {
      const response = await fetch(`${API_URL}/api/content/testimonials?featured_only=true`);
      const data = await response.json();
      setTestimonials(data.testimonials || []);
    } catch (err) {
      console.error('Error fetching testimonials:', err);
    } finally {
      setLoading(false);
    }
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  if (loading || testimonials.length === 0) {
    return null;
  }

  const currentTestimonial = testimonials[currentIndex];

  return (
    <section className="py-20 px-6 bg-slate-950" data-testid="testimonials-section">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="text-orange-500 font-semibold text-sm uppercase tracking-wider">Testimonials</span>
          <h2 className="text-4xl md:text-5xl font-bold text-white mt-3 mb-4">
            What Our Clients Say
          </h2>
          <p className="text-slate-400">Trusted by business leaders, celebrities, and discerning travelers</p>
        </div>

        {/* Testimonial Card */}
        <div className="relative">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-3xl p-8 md:p-12 relative overflow-hidden">
            {/* Quote Icon */}
            <Quote className="absolute top-8 right-8 h-24 w-24 text-orange-500/10" />
            
            {/* Content */}
            <div className="relative z-10">
              {/* Stars */}
              <div className="flex gap-1 mb-6">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-6 w-6 ${
                      i < currentTestimonial.rating
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-slate-600'
                    }`}
                  />
                ))}
              </div>

              {/* Review Text */}
              <p className="text-xl md:text-2xl text-white leading-relaxed mb-8 font-light italic">
                &ldquo;{currentTestimonial.review}&rdquo;
              </p>

              {/* Customer Info */}
              <div className="flex items-center gap-4">
                <img
                  src={currentTestimonial.photo_url || `https://ui-avatars.com/api/?name=${currentTestimonial.customer_name}&background=f97316&color=fff`}
                  alt={currentTestimonial.customer_name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-orange-500"
                />
                <div>
                  <h4 className="text-white font-semibold text-lg">{currentTestimonial.customer_name}</h4>
                  <p className="text-orange-400 text-sm">
                    {currentTestimonial.designation}
                    {currentTestimonial.company && `, ${currentTestimonial.company}`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Arrows */}
          <button
            onClick={prevSlide}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-6 p-3 bg-orange-500 hover:bg-orange-600 rounded-full text-white transition-all shadow-lg"
            aria-label="Previous testimonial"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-6 p-3 bg-orange-500 hover:bg-orange-600 rounded-full text-white transition-all shadow-lg"
            aria-label="Next testimonial"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Dots Indicator */}
        <div className="flex justify-center gap-2 mt-8">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                index === currentIndex
                  ? 'bg-orange-500 w-8'
                  : 'bg-slate-600 hover:bg-slate-500'
              }`}
              aria-label={`Go to testimonial ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default TestimonialsSlider;
