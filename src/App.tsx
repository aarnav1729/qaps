
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
import ApprovalsPage from './components/ApprovalsPage';
import AdminPage from './components/AdminPage';
import NotFound from "./pages/NotFound";
import { QAPFormData, User } from '@/types/qap';

const queryClient = new QueryClient();

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ 
  children, 
  allowedRoles 
}) => {
  const { isAuthenticated, user } = useAuth();
  
  console.log('ProtectedRoute check:', { isAuthenticated, user, allowedRoles });
  
  if (!isAuthenticated) {
    console.log('User not authenticated, redirecting to login');
    return <Navigate to="/login" />;
  }
  
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    console.log('User role not allowed:', user.role, 'Required:', allowedRoles);
    return <Navigate to="/" />;
  }
  
  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const [qapData, setQapData] = useState<QAPFormData[]>([]);
  const [users, setUsers] = useState<User[]>([
    { id: '1', username: 'praful', password: 'praful', role: 'requestor' },
    { id: '2', username: 'yamini', password: 'yamini', role: 'requestor' },
    { id: '3', username: 'baskara', password: 'baskara', role: 'approver-p4', plant: 'p4' },
    { id: '4', username: 'nrao', password: 'nrao', role: 'approver-p2', plant: 'p2' },
    { id: '5', username: 'aarnav', password: 'aarnav', role: 'admin' }
  ]);
  
  console.log('AppContent render:', { isAuthenticated, user, qapDataLength: qapData.length });
  
  const handleSaveQAP = (qapFormData: QAPFormData) => {
    console.log('Saving QAP:', qapFormData);
    setQapData(prev => {
      const existingIndex = prev.findIndex(qap => qap.id === qapFormData.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = qapFormData;
        console.log('Updated existing QAP at index:', existingIndex);
        return updated;
      } else {
        console.log('Adding new QAP to list');
        return [...prev, qapFormData];
      }
    });
  };

  const handleSubmitQAP = (qapFormData: QAPFormData) => {
    console.log('Submitting QAP for approval:', qapFormData);
    const submittedQAP = {
      ...qapFormData,
      status: 'submitted' as const,
      submittedBy: user?.username,
      submittedAt: new Date()
    };
    
    setQapData(prev => {
      const existingIndex = prev.findIndex(qap => qap.id === qapFormData.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = submittedQAP;
        console.log('Submitted existing QAP at index:', existingIndex);
        return updated;
      } else {
        console.log('Adding new submitted QAP to list');
        return [...prev, submittedQAP];
      }
    });
  };
  
  const handleApprove = (id: string, feedback?: string) => {
    console.log('Approving QAP:', id, 'with feedback:', feedback);
    setQapData(prev => prev.map(qap => 
      qap.id === id 
        ? { ...qap, status: 'approved' as const, feedback, approver: user?.username, approvedAt: new Date() }
        : qap
    ));
  };

  const handleReject = (id: string, feedback: string) => {
    console.log('Rejecting QAP:', id, 'with feedback:', feedback);
    setQapData(prev => prev.map(qap => 
      qap.id === id 
        ? { ...qap, status: 'rejected' as const, feedback, approver: user?.username, approvedAt: new Date() }
        : qap
    ));
  };

  const handleView = (qap: QAPFormData) => {
    console.log('Viewing QAP:', qap);
  };

  const handleAddUser = (newUser: User) => {
    console.log('Adding new user:', newUser);
    setUsers(prev => [...prev, newUser]);
  };

  const handleEditUser = (updatedUser: User) => {
    console.log('Editing user:', updatedUser);
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      console.log('Deleting user:', userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
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
          element={
            <ProtectedRoute allowedRoles={['requestor', 'admin']}>
              <Index 
                qapData={qapData} 
                onSaveQAP={handleSaveQAP} 
                onSubmitQAP={handleSubmitQAP} 
              />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/approvals" 
          element={
            <ProtectedRoute allowedRoles={['approver-p2', 'approver-p4', 'admin']}>
              <ApprovalsPage 
                qapData={qapData} 
                onApprove={handleApprove} 
                onReject={handleReject} 
                onView={handleView}
              />
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
                onAddUser={handleAddUser}
                onEditUser={handleEditUser}
                onDeleteUser={handleDeleteUser}
              />
            </ProtectedRoute>
          } 
        />
        <Route path="/login" element={<Navigate to="/" />} />
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
