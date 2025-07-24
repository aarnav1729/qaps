
import React, { useState } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import LoginPage from './components/LoginPage';
import Navigation from './components/Navigation';
import Index from "./pages/Index";
import Level2ReviewPage from './components/Level2ReviewPage';
import AnalyticsPage from './components/AnalyticsPage';
import AdminPage from './components/AdminPage';
import NotFound from "./pages/NotFound";
import { QAPFormData, User, TimelineEntry } from '@/types/qap';
import { getNextLevelUsers, isQAPExpired } from '@/utils/workflowUtils';

const queryClient = new QueryClient();

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ 
  children, 
  allowedRoles 
}) => {
  const { isAuthenticated, user } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" />;
  }
  
  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const [qapData, setQapData] = useState<QAPFormData[]>(() => {
    const saved = localStorage.getItem('qapData');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [users, setUsers] = useState<User[]>([
    { id: '1', username: 'praful', password: 'praful', role: 'requestor' },
    { id: '2', username: 'yamini', password: 'yamini', role: 'requestor' },
    { id: '3', username: 'manoj', password: 'manoj', role: 'production', plant: 'p2' },
    { id: '4', username: 'malik', password: 'malik', role: 'production', plant: 'p4' },
    { id: '5', username: 'siva', password: 'siva', role: 'production', plant: 'p5' },
    { id: '6', username: 'abbas', password: 'abbas', role: 'quality', plant: 'p2' },
    { id: '7', username: 'sriram', password: 'sriram', role: 'quality', plant: 'p4,p5' },
    { id: '8', username: 'rahul', password: 'rahul', role: 'technical', plant: 'p2' },
    { id: '9', username: 'ramu', password: 'ramu', role: 'technical', plant: 'p4,p5' },
    { id: '10', username: 'nrao', password: 'nrao', role: 'head', plant: 'p4,p5' },
    { id: '11', username: 'jmr', password: 'jmr', role: 'technical-head' },
    { id: '12', username: 'baskara', password: 'baskara', role: 'technical-head' },
    { id: '13', username: 'cmk', password: 'cmk', role: 'plant-head' },
    { id: '14', username: 'aarnav', password: 'aarnav', role: 'admin' }
  ]);

  // Save to localStorage whenever qapData changes
  React.useEffect(() => {
    localStorage.setItem('qapData', JSON.stringify(qapData));
  }, [qapData]);

  const updateQAPTimeline = (qapId: string, entry: TimelineEntry) => {
    setQapData(prev => prev.map(qap => 
      qap.id === qapId 
        ? { ...qap, timeline: [...qap.timeline, entry] }
        : qap
    ));
  };

  const handleSaveQAP = (qapFormData: QAPFormData, status?: string) => {
    setQapData(prev => {
      const existingIndex = prev.findIndex(qap => qap.id === qapFormData.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = qapFormData;
        return updated;
      } else {
        return [...prev, qapFormData];
      }
    });
  };

  const handleLevel2Acknowledge = (qapId: string, itemIndex: number, comments: string) => {
    if (!user) return;
    
    setQapData(prev => prev.map(qap => {
      if (qap.id !== qapId) return qap;
      
      const levelResponses = { ...qap.levelResponses };
      if (!levelResponses[2]) levelResponses[2] = {};
      if (!levelResponses[2][user.role]) {
        levelResponses[2][user.role] = {
          username: user.username,
          acknowledged: false,
          comments: {}
        };
      }
      
      levelResponses[2][user.role].comments[itemIndex] = comments;
      levelResponses[2][user.role].acknowledged = true;
      levelResponses[2][user.role].respondedAt = new Date();
      
      return { ...qap, levelResponses };
    }));
  };

  const handleLevel2Next = (qapId: string) => {
    const qap = qapData.find(q => q.id === qapId);
    if (!qap || !user) return;
    
    // Check if all required roles have responded or if 4 days have passed
    const requiredRoles = ['production', 'quality', 'technical'];
    const responses = qap.levelResponses[2] || {};
    const allResponded = requiredRoles.every(role => responses[role]?.acknowledged);
    const expired = isQAPExpired(qap.submittedAt || new Date(), 2);
    
    if (allResponded || expired) {
      // Move to next level
      const nextUsers = getNextLevelUsers(qap, 2);
      
      setQapData(prev => prev.map(q => 
        q.id === qapId 
          ? { 
              ...q, 
              currentLevel: qap.plant === 'p2' ? 4 : 3,
              status: qap.plant === 'p2' ? 'level-4' : 'level-3'
            }
          : q
      ));
      
      updateQAPTimeline(qapId, {
        level: 2,
        action: 'Level 2 review completed',
        user: user.username,
        timestamp: new Date(),
        comments: 'Moved to next level'
      });
    }
  };

  const getDashboardRoute = () => {
    switch (user?.role) {
      case 'requestor':
        return '/';
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
        return '/';
    }
  };

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <Navigation />
      <Routes>
        <Route 
          path="/" 
          element={<Navigate to={getDashboardRoute()} />} 
        />
        
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute allowedRoles={['requestor']}>
              <Index 
                qapData={qapData} 
                onSaveQAP={handleSaveQAP} 
                onSubmitQAP={handleSaveQAP} 
              />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/level2-review" 
          element={
            <ProtectedRoute allowedRoles={['production', 'quality', 'technical']}>
              <Level2ReviewPage 
                qapData={qapData}
                onAcknowledge={handleLevel2Acknowledge}
                onNext={handleLevel2Next}
              />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/analytics" 
          element={
            <ProtectedRoute>
              <AnalyticsPage qapData={qapData} />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminPage 
                qapData={qapData}
                users={users}
                onAddUser={(user) => setUsers(prev => [...prev, user])}
                onEditUser={(user) => setUsers(prev => prev.map(u => u.id === user.id ? user : u))}
                onDeleteUser={(id) => setUsers(prev => prev.filter(u => u.id !== id))}
              />
            </ProtectedRoute>
          } 
        />
        
        <Route path="/login" element={<Navigate to={getDashboardRoute()} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
