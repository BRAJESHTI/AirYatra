import React from 'react';
import { Link } from 'react-router-dom';
import { Plane, Home, ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <Plane className="h-10 w-10 text-orange-500" />
        <span className="text-3xl font-bold text-white">AirYatra</span>
      </div>

      {/* 404 Animation */}
      <div className="relative mb-8">
        <h1 className="text-[150px] font-black text-slate-800 leading-none">404</h1>
        <div className="absolute inset-0 flex items-center justify-center">
          <Plane className="h-20 w-20 text-orange-500 animate-bounce" />
        </div>
      </div>

      {/* Message */}
      <h2 className="text-3xl font-bold text-white mb-4 text-center">
        Page Not Found</h2>
      <p className="text-slate-400 text-center max-w-md mb-8">
        The page you&#39;re looking for doesn&#39;t exist or has been moved. 
        Let&#39;s get you back on track!
      </p>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Link to="/">
          <Button className="bg-orange-500 hover:bg-orange-600 min-w-[180px]" data-testid="home-btn">
            <Home className="mr-2 h-5 w-5" />
            Go Home
          </Button>
        </Link>
        <Link to="/booking">
          <Button variant="outline" className="border-slate-600 text-white hover:bg-slate-800 min-w-[180px]" data-testid="book-flight-btn">
            <Plane className="mr-2 h-5 w-5" />
            Book a Flight
          </Button>
        </Link>
      </div>

      {/* Quick Links */}
      <div className="mt-12 text-center">
        <p className="text-slate-500 text-sm mb-4">Quick Links</p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/services" className="text-orange-400 hover:text-orange-300 text-sm">
            Services
          </Link>
          <Link to="/fleet" className="text-orange-400 hover:text-orange-300 text-sm">
            Fleet
          </Link>
          <Link to="/exchange" className="text-orange-400 hover:text-orange-300 text-sm">
            Aviation Exchange
          </Link>
          <Link to="/blog" className="text-orange-400 hover:text-orange-300 text-sm">
            Blog
          </Link>
          <Link to="/about" className="text-orange-400 hover:text-orange-300 text-sm">
            About Us
          </Link>
        </div>
      </div>
    </div>
  );
}

export default NotFoundPage;
