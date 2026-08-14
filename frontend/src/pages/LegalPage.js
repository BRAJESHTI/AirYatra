import React, { useState, useEffect } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { Plane, ArrowLeft, FileText, Shield, AlertTriangle, Loader2, Calendar, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function LegalPage() {
  const { type } = useParams(); // terms, privacy, cancellation
  const location = useLocation();
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Determine which page to show based on URL
  const pageType = type || (location.pathname.includes('privacy') ? 'privacy' : location.pathname.includes('cancellation') ? 'cancellation' : 'terms');
  
  useEffect(() => {
    loadContent();
  }, [pageType]);
  
  const loadContent = async () => {
    setLoading(true);
    setError(null);
    try {
      let endpoint = '/api/legal/terms-and-conditions';
      if (pageType === 'privacy') {
        endpoint = '/api/legal/privacy-policy';
      } else if (pageType === 'cancellation') {
        endpoint = '/api/legal/cancellation-policy';
      }
      
      const response = await axios.get(`${API_URL}${endpoint}`);
      setContent(response.data);
    } catch (err) {
      console.error('Failed to load legal content:', err);
      setError('Failed to load content. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const getPageIcon = () => {
    switch (pageType) {
      case 'privacy':
        return <Shield className="h-8 w-8 text-blue-400" />;
      case 'cancellation':
        return <AlertTriangle className="h-8 w-8 text-yellow-400" />;
      default:
        return <FileText className="h-8 w-8 text-orange-400" />;
    }
  };
  
  const getPageTitle = () => {
    switch (pageType) {
      case 'privacy':
        return 'Privacy Policy';
      case 'cancellation':
        return 'Cancellation & Refund Policy';
      default:
        return 'Terms & Conditions';
    }
  };

  // Parse markdown-like content to HTML
  const renderContent = (text) => {
    if (!text) return null;
    
    // Split into sections
    const lines = text.split('\n');
    const elements = [];
    let currentSection = [];
    let inTable = false;
    let tableRows = [];
    
    lines.forEach((line, index) => {
      // Handle table start
      if (line.startsWith('|') && line.includes('|')) {
        if (!inTable) {
          inTable = true;
          tableRows = [];
        }
        // Skip separator rows (|---|---|)
        if (!line.match(/^\|[\s-|]+\|$/)) {
          tableRows.push(line);
        }
      } else if (inTable) {
        // End of table
        elements.push(
          <div key={`table-${index}`} className="overflow-x-auto my-4">
            <table className="min-w-full text-sm">
              <tbody>
                {tableRows.map((row, rowIdx) => (
                  <tr key={rowIdx} className={rowIdx === 0 ? 'bg-slate-700/50' : 'border-t border-slate-700'}>
                    {row.split('|').filter(cell => cell.trim()).map((cell, cellIdx) => (
                      <td key={cellIdx} className={`px-4 py-2 ${rowIdx === 0 ? 'font-semibold text-white' : 'text-slate-400'}`}>
                        {cell.trim()}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        inTable = false;
        tableRows = [];
      }
      
      // Major section headers (all caps with numbers)
      if (line.match(/^\d+\.\s+[A-Z\s&]+$/)) {
        elements.push(
          <h2 key={index} className="text-xl font-bold text-orange-400 mt-8 mb-4 border-b border-slate-700 pb-2">
            {line}
          </h2>
        );
      }
      // Sub-section headers (X.X format)
      else if (line.match(/^\d+\.\d+\s+/)) {
        elements.push(
          <h3 key={index} className="text-lg font-semibold text-white mt-4 mb-2">
            {line}
          </h3>
        );
      }
      // Bullet points
      else if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
        elements.push(
          <li key={index} className="text-slate-400 ml-4 list-disc">
            {line.replace(/^[-•]\s*/, '')}
          </li>
        );
      }
      // Lettered lists (a), (b), etc.
      else if (line.match(/^\([a-z]\)/)) {
        elements.push(
          <p key={index} className="text-slate-400 ml-6 my-1">
            {line}
          </p>
        );
      }
      // Regular paragraphs
      else if (line.trim() && !inTable) {
        elements.push(
          <p key={index} className="text-slate-400 my-2">
            {line}
          </p>
        );
      }
    });
    
    return elements;
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
              <Button variant="ghost" className="text-slate-300 hover:text-white">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            {getPageIcon()}
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white">{getPageTitle()}</h1>
              {content && (
                <p className="text-slate-400 text-sm mt-1">
                  Version: {content.version} | Effective: {content.effective_date}
                </p>
              )}
            </div>
          </div>
          
          {/* Company Info */}
          {content && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-8 flex items-center gap-4">
              <Building2 className="h-6 w-6 text-orange-400" />
              <div>
                <p className="text-white font-medium">{content.company}</p>
                <p className="text-slate-400 text-sm">Brand: {content.brand}</p>
              </div>
            </div>
          )}
          
          {/* Quick Nav */}
          <div className="flex gap-4 mb-8 flex-wrap">
            <Link 
              to="/legal/terms" 
              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                pageType === 'terms' 
                  ? 'bg-orange-500 text-white' 
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              Terms & Conditions
            </Link>
            <Link 
              to="/legal/privacy" 
              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                pageType === 'privacy' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              Privacy Policy
            </Link>
            <Link 
              to="/legal/cancellation" 
              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                pageType === 'cancellation' 
                  ? 'bg-yellow-500 text-white' 
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              Cancellation Policy
            </Link>
          </div>
          
          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
              <span className="ml-3 text-slate-400">Loading content...</span>
            </div>
          )}
          
          {/* Error State */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
              <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <p className="text-red-400">{error}</p>
              <Button onClick={loadContent} className="mt-4 bg-red-500 hover:bg-red-600">
                Try Again
              </Button>
            </div>
          )}
          
          {/* Content */}
          {content && !loading && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 md:p-8">
              <div className="prose prose-invert max-w-none">
                {renderContent(content.content)}
              </div>
            </div>
          )}
          
          {/* Footer */}
          <div className="mt-8 text-center text-slate-500 text-sm">
            <p>© 2026 Lucuma Corporation Pvt. Ltd. All Rights Reserved.</p>
            <p className="mt-2">
              Questions? Contact us at{' '}
              <a href="mailto:care@airyatra.co.in" className="text-orange-400 hover:text-orange-300">
                care@airyatra.co.in
              </a>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default LegalPage;
