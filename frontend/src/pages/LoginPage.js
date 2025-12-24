import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plane, Mail, Lock, User, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authAPI } from '../services/api';
import { toast } from 'sonner';
import { GoogleLoginButton } from '../components/auth/GoogleLogin';

function LoginPage({ setUser }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    roles: ['customer'],
    user_type: 'customer' // Add user type selector
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Ensure roles array is properly set
      const submitData = {
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
        phone: formData.phone,
        roles: formData.roles // Use the roles array that's updated by user_type selector
      };

      const response = isLogin
        ? await authAPI.login({ email: formData.email, password: formData.password })
        : await authAPI.register(submitData);

      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      setUser(response.data.user);

      toast.success(isLogin ? 'Login successful!' : 'Registration successful!');
      
      // Navigate based on role
      const role = response.data.user.roles[0];
      navigate(`/${role}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6" data-testid="login-page">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center space-x-2 mb-4" data-testid="logo-link">
            <Plane className="h-10 w-10 text-orange-500" />
            <span className="text-3xl font-bold text-white">AirYatra</span>
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2" data-testid="auth-title">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-slate-400">
            {isLogin ? 'Login to access your account' : 'Sign up to start booking flights'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="glass p-8 rounded-lg space-y-6" data-testid="auth-form">
          {!isLogin && (
            <>
              <div className="space-y-2">
                <Label htmlFor="user_type" className="text-white">I am a *</Label>
                <select
                  id="user_type"
                  name="user_type"
                  value={formData.user_type}
                  onChange={(e) => {
                    const type = e.target.value;
                    setFormData({ ...formData, user_type: type, roles: [type] });
                  }}
                  className="w-full h-10 px-3 rounded-md bg-slate-900 border-slate-700 text-white"
                  data-testid="user-type-select"
                >
                  <option value="customer">Customer (Book Flights)</option>
                  <option value="operator">Operator (Provide Services)</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-white">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  <Input
                    id="full_name"
                    name="full_name"
                    placeholder="John Doe"
                    value={formData.full_name}
                    onChange={handleChange}
                    required
                    className="pl-10 bg-slate-900 border-slate-700 text-white"
                    data-testid="full-name-input"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-white">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  <Input
                    id="phone"
                    name="phone"
                    placeholder="+91 9876543210"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    className="pl-10 bg-slate-900 border-slate-700 text-white"
                    data-testid="phone-input"
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-white">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                className="pl-10 bg-slate-900 border-slate-700 text-white"
                data-testid="email-input"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-white">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
                className="pl-10 bg-slate-900 border-slate-700 text-white"
                data-testid="password-input"
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-6 text-lg"
            disabled={loading}
            data-testid="submit-btn"
          >
            {loading ? 'Please wait...' : (isLogin ? 'Login' : 'Create Account')}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-orange-500 hover:text-orange-400 text-sm"
              data-testid="toggle-auth-btn"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Login"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;