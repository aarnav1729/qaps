// src/components/LoginPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { LogIn, Users, Eye, EyeOff } from 'lucide-react';

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = login(username.trim(), password);
    if (success) {
      navigate('/', { replace: true });
    } else {
      setError('Invalid username or password');
    }
  };

  const demoUsers = [
    { category: 'Level 1 - Requestors', users: [
      { username: 'praful', password: 'praful', role: 'Requestor' },
      { username: 'yamini', password: 'yamini', role: 'Requestor' }
    ]},
    { category: 'Level 2 - Production', users: [
      { username: 'manoj', password: 'manoj', role: 'Production', plant: 'P2' },
      { username: 'malik', password: 'malik', role: 'Production', plant: 'P4' },
      { username: 'siva', password: 'siva', role: 'Production', plant: 'P5' }
    ]},
    { category: 'Level 2 - Quality', users: [
      { username: 'abbas', password: 'abbas', role: 'Quality', plant: 'P2' },
      { username: 'sriram', password: 'sriram', role: 'Quality', plant: 'P4,P5' }
    ]},
    { category: 'Level 2 - Technical', users: [
      { username: 'rahul', password: 'rahul', role: 'Technical', plant: 'P2' },
      { username: 'ramu', password: 'ramu', role: 'Technical', plant: 'P4,P5' }
    ]},
    { category: 'Level 3 - Head', users: [
      { username: 'nrao', password: 'nrao', role: 'Head', plant: 'P4,P5' }
    ]},
    { category: 'Level 4 - Technical Head', users: [
      { username: 'jmr', password: 'jmr', role: 'Technical Head' },
      { username: 'baskara', password: 'baskara', role: 'Technical Head' }
    ]},
    { category: 'Level 5 - Plant Head', users: [
      { username: 'cmk', password: 'cmk', role: 'Plant Head' }
    ]},
    { category: 'Admin', users: [
      { username: 'aarnav', password: 'aarnav', role: 'Admin' }
    ]}
  ];

  const quickLogin = (user: { username: string; password: string }) => {
    setError('');
    setUsername(user.username);
    setPassword(user.password);
    const success = login(user.username, user.password);
    if (success) {
      navigate('/', { replace: true });
    } else {
      setError('Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Login Form */}
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-900">
              QAP Management System
            </CardTitle>
            <p className="text-gray-600">Sign in to your account</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              {error && (
                <div className="text-red-600 text-sm text-center bg-red-50 p-2 rounded">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full">
                <LogIn className="mr-2 h-4 w-4" />
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Demo Credentials */}
        <Card className="w-full">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Demo User Credentials
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCredentials((v) => !v)}
              >
                {showCredentials ? 'Hide' : 'Show'} Credentials
              </Button>
            </div>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto">
            {showCredentials ? (
              demoUsers.map((category, idx) => (
                <div key={idx} className="space-y-4">
                  <h3 className="font-semibold text-gray-800 mb-2">{category.category}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                    {category.users.map((u, i) => (
                      <div
                        key={i}
                        className="p-3 bg-gray-50 rounded border cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => quickLogin(u)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-sm">{u.username}</div>
                            <div className="text-xs text-gray-600">Password: {u.password}</div>
                            <div className="flex items-center gap-1 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {u.role}
                              </Badge>
                              {u.plant && (
                                <Badge variant="secondary" className="text-xs">
                                  {u.plant}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button size="sm" variant="ghost" className="text-xs">
                            Quick Login
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-8">
                Click "Show Credentials" to view demo user accounts
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
