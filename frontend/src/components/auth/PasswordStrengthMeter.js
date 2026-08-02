import React, { useMemo } from 'react';
import { Check, X, Shield, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';

/**
 * Password Strength Meter Component
 * Shows real-time password strength with visual indicator and requirements checklist
 */
function PasswordStrengthMeter({ password = '', showRequirements = true }) {
  // Password requirements
  const requirements = useMemo(() => [
    {
      id: 'length',
      label: 'At least 8 characters',
      labelHi: 'कम से कम 8 अक्षर',
      test: (pwd) => pwd.length >= 8,
    },
    {
      id: 'uppercase',
      label: 'One uppercase letter (A-Z)',
      labelHi: 'एक बड़ा अक्षर (A-Z)',
      test: (pwd) => /[A-Z]/.test(pwd),
    },
    {
      id: 'lowercase',
      label: 'One lowercase letter (a-z)',
      labelHi: 'एक छोटा अक्षर (a-z)',
      test: (pwd) => /[a-z]/.test(pwd),
    },
    {
      id: 'number',
      label: 'One number (0-9)',
      labelHi: 'एक नंबर (0-9)',
      test: (pwd) => /[0-9]/.test(pwd),
    },
    {
      id: 'special',
      label: 'One special character (!@#$%^&*)',
      labelHi: 'एक स्पेशल character (!@#$%^&*)',
      test: (pwd) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd),
    },
  ], []);

  // Calculate strength
  const strength = useMemo(() => {
    if (!password) return { score: 0, level: 'none', label: '', color: '' };
    
    const passed = requirements.filter(req => req.test(password)).length;
    const totalReqs = requirements.length;
    const percentage = (passed / totalReqs) * 100;
    
    // Additional entropy checks
    const hasSequence = /(.)\1{2,}|012|123|234|345|456|567|678|789|890|abc|bcd|cde/i.test(password);
    const isCommon = ['password', '123456', 'qwerty', 'admin', 'letmein', 'welcome'].some(
      common => password.toLowerCase().includes(common)
    );
    
    let bonus = 0;
    if (password.length >= 12) bonus += 10;
    if (password.length >= 16) bonus += 10;
    if (!hasSequence) bonus += 10;
    if (!isCommon) bonus += 10;
    
    const finalScore = Math.min(100, percentage + bonus);
    
    if (finalScore < 30) {
      return { score: finalScore, level: 'weak', label: 'Weak / कमज़ोर', color: 'bg-red-500' };
    } else if (finalScore < 50) {
      return { score: finalScore, level: 'fair', label: 'Fair / ठीक', color: 'bg-orange-500' };
    } else if (finalScore < 80) {
      return { score: finalScore, level: 'good', label: 'Good / अच्छा', color: 'bg-yellow-500' };
    } else {
      return { score: finalScore, level: 'strong', label: 'Strong / मज़बूत', color: 'bg-green-500' };
    }
  }, [password, requirements]);

  // Get shield icon based on strength
  const ShieldIcon = useMemo(() => {
    switch (strength.level) {
      case 'weak': return ShieldX;
      case 'fair': return ShieldAlert;
      case 'good': return Shield;
      case 'strong': return ShieldCheck;
      default: return Shield;
    }
  }, [strength.level]);

  if (!password && !showRequirements) return null;

  return (
    <div className="space-y-3 mt-2" data-testid="password-strength-meter">
      {/* Strength Bar */}
      {password && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <ShieldIcon className={`h-3.5 w-3.5 ${
                strength.level === 'weak' ? 'text-red-400' :
                strength.level === 'fair' ? 'text-orange-400' :
                strength.level === 'good' ? 'text-yellow-400' :
                strength.level === 'strong' ? 'text-green-400' : 'text-slate-400'
              }`} />
              <span className="text-slate-400">Password Strength:</span>
            </div>
            <span className={`font-medium ${
              strength.level === 'weak' ? 'text-red-400' :
              strength.level === 'fair' ? 'text-orange-400' :
              strength.level === 'good' ? 'text-yellow-400' :
              strength.level === 'strong' ? 'text-green-400' : 'text-slate-400'
            }`}>
              {strength.label}
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ease-out ${strength.color}`}
              style={{ width: `${strength.score}%` }}
            />
          </div>
        </div>
      )}

      {/* Requirements Checklist */}
      {showRequirements && (
        <div className="space-y-1.5">
          <p className="text-xs text-slate-500 font-medium">Password Requirements:</p>
          <div className="grid grid-cols-1 gap-1">
            {requirements.map((req) => {
              const passed = password ? req.test(password) : false;
              return (
                <div 
                  key={req.id}
                  className={`flex items-center gap-2 text-xs transition-colors ${
                    passed ? 'text-green-400' : 'text-slate-500'
                  }`}
                >
                  {passed ? (
                    <Check className="h-3 w-3 text-green-400" />
                  ) : (
                    <X className="h-3 w-3 text-slate-600" />
                  )}
                  <span>{req.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default PasswordStrengthMeter;
