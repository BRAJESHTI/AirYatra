import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

// Import pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import CustomerDashboard from './pages/CustomerDashboard';
import OperatorDashboard from './pages/OperatorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import RegionalManagerDashboard from './pages/RegionalManagerDashboard';
import BookingPage from './pages/BookingPage';

// Import shared components
import AIChatbot from './components/shared/AIChatbot';

// Import Google Auth components
import { GoogleAuthSuccess, GoogleAuthError, EmergentAuthCallback } from './components/auth/GoogleLogin';

// Import Customer components
import InquiryStatus from './components/customer/InquiryStatus';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored auth token
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage user={user} />} />
        <Route path="/login" element={<LoginPage setUser={setUser} />} />
        
        {/* Google Auth Callback Routes */}
        <Route path="/auth/google/success" element={<GoogleAuthSuccess onLogin={setUser} />} />
        <Route path="/auth/google/error" element={<GoogleAuthError />} />
        <Route path="/auth/google/callback" element={<EmergentAuthCallback onLogin={setUser} />} />
        
        <Route
          path="/customer"
          element={user && user.roles.includes('customer') ? <CustomerDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
        />
        <Route
          path="/customer/trips"
          element={user && user.roles.includes('customer') ? <CustomerDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
        />
        <Route
          path="/customer/messages"
          element={user && user.roles.includes('customer') ? <CustomerDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
        />
        <Route
          path="/operator/*"
          element={user && user.roles.includes('operator') ? <OperatorDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
        />
        <Route
          path="/admin/*"
          element={user && (user.roles.includes('admin') || user.roles.includes('super_admin')) ? <AdminDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
        />
        <Route
          path="/regional/*"
          element={user && (user.roles.includes('regional_manager') || user.roles.includes('admin')) ? <RegionalManagerDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
        />
        <Route path="/booking" element={<BookingPage user={user} />} />
      </Routes>
      
      {/* AI Chatbot - Available on all pages */}
      <AIChatbot user={user} />
    </BrowserRouter>
  );
}

export default App;