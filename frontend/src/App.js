import React, { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

// Critical pages - loaded immediately
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';

// Global Navigation Component
import GlobalNav from './components/shared/GlobalNav';

// Lazy loaded pages - loaded on demand for faster initial load
const CustomerDashboard = lazy(() => import('./pages/CustomerDashboard'));
const OperatorDashboard = lazy(() => import('./pages/OperatorDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const RegionalManagerDashboard = lazy(() => import('./pages/RegionalManagerDashboard'));
const HelipadOwnerDashboard = lazy(() => import('./pages/HelipadOwnerDashboard'));
const BookingPage = lazy(() => import('./pages/BookingPage'));
const PaymentPage = lazy(() => import('./pages/PaymentPage'));
const PaymentSuccessPage = lazy(() => import('./pages/PaymentSuccessPage'));
// New Role-based Dashboards - lazy loaded
const HRDashboard = lazy(() => import('./pages/HRDashboard'));
const EmployeePortal = lazy(() => import('./pages/EmployeePortal'));
const SalesDashboard = lazy(() => import('./pages/SalesDashboard'));
const SupportDashboard = lazy(() => import('./pages/SupportDashboard'));
const FinanceDashboard = lazy(() => import('./pages/FinanceDashboard'));
// Phase 1: Premium Services - lazy loaded
const MembershipPage = lazy(() => import('./pages/MembershipPage'));
const AviationExchangePage = lazy(() => import('./pages/AviationExchangePage'));
const ListingDetailPage = lazy(() => import('./pages/ListingDetailPage'));
const CorporateDashboard = lazy(() => import('./pages/CorporateDashboard'));
const DocumentVault = lazy(() => import('./pages/DocumentVault'));
const PaymentLinkPage = lazy(() => import('./pages/PaymentLinkPage'));

// Import shared components
import AIChatbot from './components/shared/AIChatbot';

// Import Google Auth components
import { GoogleAuthSuccess, GoogleAuthError, EmergentAuthCallback } from './components/auth/GoogleLogin';

// Lazy load customer components
const InquiryStatus = lazy(() => import('./components/customer/InquiryStatus'));

// Loading spinner component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-900">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500 mx-auto mb-4"></div>
      <p className="text-white">Loading...</p>
    </div>
  </div>
);

function App() {
  const [user, setUser] = useState(() => {
    // Initialize user from localStorage synchronously
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  });
  const [loading, setLoading] = useState(false);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      {/* Global Navigation - Home Button */}
      <GlobalNav user={user} />
      
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage user={user} />} />
          <Route path="/login" element={<LoginPage setUser={setUser} />} />
          
          {/* Google Auth Callback Routes */}
          <Route path="/auth/google/success" element={<GoogleAuthSuccess onLogin={setUser} />} />
          <Route path="/auth/google/error" element={<GoogleAuthError />} />
          <Route path="/auth/google/callback" element={<EmergentAuthCallback onLogin={setUser} />} />
          
          {/* Public Payment Link Page (no auth required) */}
          <Route path="/pay/:token" element={<PaymentLinkPage />} />
          
          <Route
            path="/customer"
            element={user && user.roles.includes('customer') ? <CustomerDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
          />
          <Route
            path="/customer/trips"
            element={user && user.roles.includes('customer') ? <CustomerDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
          />
          <Route
            path="/customer/refer"
            element={user && user.roles.includes('customer') ? <CustomerDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
          />
          <Route
            path="/customer/loyalty"
            element={user && user.roles.includes('customer') ? <CustomerDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
          />
          <Route
            path="/customer/profile"
            element={user && user.roles.includes('customer') ? <CustomerDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
          />
          <Route
            path="/customer/messages"
            element={user && user.roles.includes('customer') ? <CustomerDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
          />
          <Route
            path="/customer/listings"
            element={user && user.roles.includes('customer') ? <CustomerDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
          />
          <Route
            path="/customer/investments"
            element={user && user.roles.includes('customer') ? <CustomerDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
          />
          <Route
            path="/customer/watchlist"
            element={user && user.roles.includes('customer') ? <CustomerDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
          />
          <Route
            path="/customer/payments"
            element={user && user.roles.includes('customer') ? <CustomerDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
          />
          <Route
            path="/customer/stats"
            element={user && user.roles.includes('customer') ? <CustomerDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
          />
          <Route
            path="/customer/price-trends"
            element={user && user.roles.includes('customer') ? <CustomerDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
          />
          <Route
            path="/customer/route-suggestions"
            element={user && user.roles.includes('customer') ? <CustomerDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
          />
        <Route
          path="/customer/inquiry/:inquiryId"
          element={user && user.roles.includes('customer') ? <InquiryStatus user={user} /> : <Navigate to="/login" />}
        />
        <Route
          path="/customer/payment/:inquiryId"
          element={user && user.roles.includes('customer') ? <PaymentPage user={user} /> : <Navigate to="/login" />}
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
        <Route
          path="/helipad-owner/*"
          element={user && (user.roles.includes('helipad_owner') || user.roles.includes('admin')) ? <HelipadOwnerDashboard user={user} setUser={setUser} /> : <Navigate to="/login" />}
        />
        {/* New Role-based Dashboards */}
        <Route
          path="/employee/*"
          element={user && (user.roles.includes('employee') || user.roles.includes('hr') || user.roles.includes('sales') || user.roles.includes('finance') || user.roles.includes('support') || user.roles.includes('marketing') || user.roles.includes('operations') || user.roles.includes('admin')) ? <EmployeePortal user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
        />
        <Route
          path="/hr/*"
          element={user && (user.roles.includes('hr') || user.roles.includes('admin')) ? <HRDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
        />
        <Route
          path="/sales/*"
          element={user && (user.roles.includes('sales') || user.roles.includes('marketing') || user.roles.includes('admin')) ? <SalesDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
        />
        <Route
          path="/support/*"
          element={user && (user.roles.includes('support') || user.roles.includes('admin')) ? <SupportDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
        />
        <Route
          path="/finance/*"
          element={user && (user.roles.includes('finance') || user.roles.includes('admin')) ? <FinanceDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
        />
        <Route path="/booking" element={<BookingPage user={user} />} />
        {/* Phase 1: Premium Services Routes */}
        <Route path="/membership" element={<MembershipPage user={user} />} />
        <Route path="/exchange" element={<AviationExchangePage user={user} />} />
        <Route path="/exchange/listing/:listingId" element={<ListingDetailPage user={user} />} />
        <Route path="/payment/success" element={<PaymentSuccessPage />} />
        <Route 
          path="/corporate/*" 
          element={user ? <CorporateDashboard user={user} /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/vault" 
          element={user ? <DocumentVault user={user} /> : <Navigate to="/login" />} 
        />
        </Routes>
      </Suspense>
      
      {/* AI Chatbot - Available on all pages */}
      <AIChatbot user={user} />
    </BrowserRouter>
  );
}

export default App;