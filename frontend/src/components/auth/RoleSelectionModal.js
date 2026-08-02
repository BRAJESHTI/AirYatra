import React, { useState } from 'react';
import { User, Briefcase, Plane, Building2, ArrowRight, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Role Selection Modal for new Google Sign-up users
 * Allows users to choose between Customer and Operator roles
 */
export const RoleSelectionModal = ({ 
  isOpen, 
  onClose, 
  user,
  onRoleSelected 
}) => {
  const [selectedRole, setSelectedRole] = useState(null);
  const [loading, setLoading] = useState(false);
  
  if (!isOpen) return null;
  
  const roles = [
    {
      id: 'customer',
      label: 'Customer',
      labelHi: 'ग्राहक',
      icon: User,
      color: 'blue',
      description: 'Book helicopter & jet flights for personal or business travel',
      descriptionHi: 'व्यक्तिगत या व्यावसायिक यात्रा के लिए हेलीकॉप्टर और जेट बुक करें',
      features: [
        'Search & compare aircraft',
        'Book instant or auction flights',
        'Track your bookings',
        'Loyalty rewards & referrals'
      ]
    },
    {
      id: 'operator',
      label: 'Operator',
      labelHi: 'ऑपरेटर',
      icon: Plane,
      color: 'orange',
      description: 'List your aircraft and receive booking requests from customers',
      descriptionHi: 'अपने विमान सूचीबद्ध करें और ग्राहकों से बुकिंग अनुरोध प्राप्त करें',
      features: [
        'List unlimited aircraft',
        'Set your own pricing',
        'Manage crew & documents',
        'Receive instant notifications'
      ],
      badge: 'Business Account'
    }
  ];
  
  const handleSubmit = async () => {
    if (!selectedRole) {
      toast.error('Please select a role');
      return;
    }
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      const response = await axios.post(
        `${API_URL}/api/auth/set-role`,
        { role: selectedRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data?.user) {
        toast.success(`Welcome as ${selectedRole}! / ${selectedRole} के रूप में स्वागत है!`);
        if (onRoleSelected) {
          onRoleSelected(response.data.user);
        }
        onClose();
      }
    } catch (error) {
      console.error('Failed to set role:', error);
      toast.error(error.response?.data?.detail || 'Failed to set role');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <Card className="bg-slate-900 border-slate-700 w-full max-w-2xl">
        <CardContent className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="h-16 w-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="h-8 w-8 text-orange-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">
              Welcome to AirYatra! 🎉
            </h2>
            <p className="text-slate-400 mt-2">
              Choose how you want to use the platform
            </p>
            <p className="text-slate-500 text-sm">
              आप प्लेटफ़ॉर्म का उपयोग कैसे करना चाहते हैं चुनें
            </p>
          </div>
          
          {/* User Info */}
          {user && (
            <div className="bg-slate-800/50 rounded-lg p-4 mb-6 flex items-center gap-4">
              {user.profile_picture ? (
                <img 
                  src={user.profile_picture} 
                  alt={user.full_name} 
                  className="h-12 w-12 rounded-full"
                />
              ) : (
                <div className="h-12 w-12 bg-slate-700 rounded-full flex items-center justify-center">
                  <User className="h-6 w-6 text-slate-400" />
                </div>
              )}
              <div>
                <p className="text-white font-medium">{user.full_name || user.email}</p>
                <p className="text-slate-400 text-sm">{user.email}</p>
              </div>
              <Badge className="ml-auto bg-green-500/20 text-green-400">
                <Check className="h-3 w-3 mr-1" /> Google Verified
              </Badge>
            </div>
          )}
          
          {/* Role Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {roles.map(role => {
              const Icon = role.icon;
              const isSelected = selectedRole === role.id;
              
              return (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  className={`relative text-left p-6 rounded-xl border-2 transition-all ${
                    isSelected
                      ? role.color === 'blue'
                        ? 'bg-blue-500/10 border-blue-500'
                        : 'bg-orange-500/10 border-orange-500'
                      : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  {/* Badge */}
                  {role.badge && (
                    <Badge className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs">
                      {role.badge}
                    </Badge>
                  )}
                  
                  {/* Icon */}
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center mb-4 ${
                    isSelected
                      ? role.color === 'blue' ? 'bg-blue-500/20' : 'bg-orange-500/20'
                      : 'bg-slate-700'
                  }`}>
                    <Icon className={`h-6 w-6 ${
                      isSelected
                        ? role.color === 'blue' ? 'text-blue-400' : 'text-orange-400'
                        : 'text-slate-400'
                    }`} />
                  </div>
                  
                  {/* Labels */}
                  <h3 className={`text-lg font-semibold ${
                    isSelected ? 'text-white' : 'text-slate-300'
                  }`}>
                    {role.label}
                    <span className="text-slate-500 text-sm ml-2">/ {role.labelHi}</span>
                  </h3>
                  
                  {/* Description */}
                  <p className="text-slate-400 text-sm mt-2">
                    {role.description}
                  </p>
                  
                  {/* Features */}
                  <ul className="mt-4 space-y-2">
                    {role.features.map((feature, idx) => (
                      <li key={idx} className="text-sm text-slate-400 flex items-center gap-2">
                        <Check className={`h-3 w-3 ${
                          isSelected
                            ? role.color === 'blue' ? 'text-blue-400' : 'text-orange-400'
                            : 'text-slate-500'
                        }`} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  
                  {/* Selection Indicator */}
                  {isSelected && (
                    <div className={`absolute top-4 right-4 h-6 w-6 rounded-full flex items-center justify-center ${
                      role.color === 'blue' ? 'bg-blue-500' : 'bg-orange-500'
                    }`}>
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          
          {/* Note */}
          <p className="text-slate-500 text-xs text-center mb-6">
            You can always change your role later from Settings. Operators can also book flights as customers.
            <br />
            आप बाद में सेटिंग्स से अपनी भूमिका बदल सकते हैं।
          </p>
          
          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!selectedRole || loading}
            className={`w-full py-6 text-lg ${
              selectedRole === 'operator'
                ? 'bg-orange-500 hover:bg-orange-600'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {loading ? (
              <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Setting up...</>
            ) : (
              <>
                Continue as {selectedRole ? roles.find(r => r.id === selectedRole)?.label : '...'} 
                <ArrowRight className="h-5 w-5 ml-2" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default RoleSelectionModal;
