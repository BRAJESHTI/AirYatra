import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LanguageSwitcher from './LanguageSwitcher';

/**
 * Global Navigation Component - Shows on all internal pages
 * Provides Home button and Back navigation
 */
function GlobalNav({ user, showBack = true }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  
  // Don't show on landing page or login page
  const hiddenPaths = ['/', '/login', '/auth/google/success', '/auth/google/error', '/auth/google/callback'];
  if (hiddenPaths.includes(location.pathname)) {
    return null;
  }

  const goHome = () => {
    if (!user) {
      navigate('/');
      return;
    }
    
    // Navigate to role-specific dashboard
    const roles = user.roles || [];
    if (roles.includes('admin') || roles.includes('super_admin')) {
      navigate('/admin');
    } else if (roles.includes('operator')) {
      navigate('/operator');
    } else if (roles.includes('customer')) {
      navigate('/customer');
    } else if (roles.includes('finance')) {
      navigate('/finance');
    } else if (roles.includes('hr')) {
      navigate('/hr');
    } else if (roles.includes('sales')) {
      navigate('/sales');
    } else if (roles.includes('support')) {
      navigate('/support');
    } else if (roles.includes('helipad_owner')) {
      navigate('/helipad');
    } else if (roles.includes('regional_manager')) {
      navigate('/regional');
    } else {
      navigate('/');
    }
  };

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      goHome();
    }
  };

  return (
    <div className="fixed top-4 left-4 z-50 flex gap-2">
      {showBack && (
        <Button
          onClick={goBack}
          size="sm"
          variant="outline"
          className="bg-slate-800/80 backdrop-blur-sm border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white shadow-lg"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('nav.back')}
        </Button>
      )}
      <Button
        onClick={goHome}
        size="sm"
        className="bg-orange-500/90 backdrop-blur-sm hover:bg-orange-600 text-white shadow-lg"
      >
        <Home className="h-4 w-4 mr-1" />
        {t('nav.home')}
      </Button>
      <LanguageSwitcher />
    </div>
  );
}

export default GlobalNav;
