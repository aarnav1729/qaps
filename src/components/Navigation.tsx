
import React from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, User, FileText, UserCheck, Settings, BarChart3 } from 'lucide-react';

const Navigation: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const getNavItems = () => {
    const items = [];
    
    if (user?.role === 'requestor' || user?.role === 'admin') {
      items.push({ name: 'QAPs', icon: FileText, path: '/' });
    }
    
    if (user?.role === 'approver-p2' || user?.role === 'approver-p4' || user?.role === 'admin') {
      items.push({ name: 'Approvals', icon: UserCheck, path: '/approvals' });
    }
    
    if (user?.role === 'admin') {
      items.push({ name: 'Admin', icon: Settings, path: '/admin' });
    }
    
    return items;
  };

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const isActivePath = (path: string) => {
    return location.pathname === path;
  };

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-lg">
                📊
              </div>
              <h1 className="text-xl font-bold text-gray-900">QAP System</h1>
            </div>
            
            <div className="hidden md:flex items-center gap-4">
              {getNavItems().map(item => (
                <Button 
                  key={item.name} 
                  variant={isActivePath(item.path) ? "default" : "ghost"}
                  className="flex items-center gap-2"
                  onClick={() => handleNavigation(item.path)}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">{user?.username}</span>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                {user?.role?.replace('-', ' ').toUpperCase()}
              </span>
            </div>
            
            <Button variant="outline" onClick={logout} size="sm">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
