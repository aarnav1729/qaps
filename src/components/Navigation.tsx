
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { Home, ClipboardCheck, BarChart3, Users, LogOut, FileText, Settings } from 'lucide-react';

const Navigation: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const getDashboardPath = () => {
    switch (user?.role) {
      case 'requestor':
        return '/dashboard';
      case 'production':
      case 'quality':
      case 'technical':
        return '/level2-review';
      case 'head':
        return '/level3-review';
      case 'technical-head':
        return '/level4-review';
      case 'plant-head':
        return '/level5-review';
      case 'admin':
        return '/admin';
      default:
        return '/dashboard';
    }
  };

  const navItems = [
    {
      path: getDashboardPath(),
      label: user?.role === 'admin' ? 'Admin Panel' : 
             user?.role === 'requestor' ? 'Dashboard' : 
             'Review Queue',
      icon: user?.role === 'admin' ? Users : 
            user?.role === 'requestor' ? Home : 
            ClipboardCheck
    },
    { path: '/analytics', label: 'Analytics', icon: BarChart3 }
  ];

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'requestor': return 'Requestor';
      case 'production': return 'Production';
      case 'quality': return 'Quality';
      case 'technical': return 'Technical';
      case 'head': return 'Head';
      case 'technical-head': return 'Technical Head';
      case 'plant-head': return 'Plant Head';
      case 'admin': return 'Admin';
      default: return role;
    }
  };

  return (
    <nav className="bg-white shadow-md border-b">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">QAP System</h1>
              <p className="text-xs text-gray-500">Quality Assurance Platform</p>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map(({ path, label, icon: Icon }) => (
              <Button
                key={path}
                variant={isActive(path) ? "default" : "ghost"}
                onClick={() => navigate(path)}
                className={`flex items-center space-x-2 px-4 py-2 ${
                  isActive(path) 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </Button>
            ))}
          </div>

          {/* User Info & Logout */}
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-2">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.username}</p>
                <div className="flex items-center space-x-1">
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      user?.role === 'admin' ? 'bg-red-50 text-red-700 border-red-200' :
                      user?.role === 'plant-head' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                      user?.role === 'technical-head' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                      user?.role === 'head' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                      ['production', 'quality', 'technical'].includes(user?.role || '') ? 'bg-green-50 text-green-700 border-green-200' :
                      'bg-blue-50 text-blue-700 border-blue-200'
                    }`}
                  >
                    {getRoleDisplayName(user?.role || '')}
                  </Badge>
                  {user?.plant && (
                    <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700 border-gray-200">
                      {user.plant.toUpperCase()}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-gray-600 hover:text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:ml-2 sm:inline">Logout</span>
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden flex items-center justify-between py-3 border-t">
          <div className="flex space-x-1 overflow-x-auto">
            {navItems.map(({ path, label, icon: Icon }) => (
              <Button
                key={path}
                variant={isActive(path) ? "default" : "ghost"}
                size="sm"
                onClick={() => navigate(path)}
                className={`flex items-center space-x-1 px-3 py-2 whitespace-nowrap ${
                  isActive(path) 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-xs">{label}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
