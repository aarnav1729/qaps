
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navigation from './components/Navigation';
import LoginPage from './components/LoginPage';
import Index from './pages/Index';
import QAPViewEditPage from './pages/QAPViewEditPage';
import Level2ReviewPage from './components/Level2ReviewPage';
import Level3ReviewPage from './components/Level3ReviewPage';
import Level4ReviewPage from './components/Level4ReviewPage';
import FinalCommentsPage from './components/FinalCommentsPage';
import Level5ApprovalPage from './components/Level5ApprovalPage';
import SpecificationBuilder from './components/SpecificationBuilder';
import ApprovalsPage from './components/ApprovalsPage';
import AnalyticsPage from './components/AnalyticsPage';
import AdminPage from './components/AdminPage';
import AdminAnalytics from './components/AdminAnalytics';
import { QAPFormData } from './types/qap';
import { processWorkflowTransition } from './utils/workflowUtils';

const queryClient = new QueryClient();

// Main App Content Component
const AppContent: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [qapData, setQapData] = useState<QAPFormData[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  // Track action timestamps
  const addTimestampToQAP = (qap: QAPFormData, action: string, level?: number): QAPFormData => {
    const now = new Date();
    const updatedQAP = { 
      ...qap, 
      lastModifiedAt: now,
      timeline: [
        ...qap.timeline,
        {
          level: level || qap.currentLevel,
          action,
          user: user?.username,
          timestamp: now
        }
      ]
    };

    // Track level start/end times
    if (action.includes('Sent to') && level) {
      updatedQAP.levelStartTimes = { ...qap.levelStartTimes, [level]: now };
    } else if (action.includes('Reviewed') || action.includes('Approved')) {
      updatedQAP.levelEndTimes = { ...qap.levelEndTimes, [qap.currentLevel]: now };
    }

    return updatedQAP;
  };

  // Load data from localStorage on component mount
  useEffect(() => {
    const savedData = localStorage.getItem('qapData');
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        setQapData(parsedData.map((qap: any) => ({
          ...qap,
          submittedAt: qap.submittedAt ? new Date(qap.submittedAt) : undefined,
          approvedAt: qap.approvedAt ? new Date(qap.approvedAt) : undefined,
          finalCommentsAt: qap.finalCommentsAt ? new Date(qap.finalCommentsAt) : undefined,
          createdAt: qap.createdAt ? new Date(qap.createdAt) : new Date(),
          lastModifiedAt: qap.lastModifiedAt ? new Date(qap.lastModifiedAt) : new Date(),
          levelStartTimes: qap.levelStartTimes ? Object.fromEntries(
            Object.entries(qap.levelStartTimes).map(([k, v]) => [k, new Date(v as string)])
          ) : {},
          levelEndTimes: qap.levelEndTimes ? Object.fromEntries(
            Object.entries(qap.levelEndTimes).map(([k, v]) => [k, new Date(v as string)])
          ) : {},
          timeline: qap.timeline?.map((entry: any) => ({
            ...entry,
            timestamp: new Date(entry.timestamp)
          })) || []
        })));
      } catch (error) {
        console.error('Error loading QAP data:', error);
      }
    }
  }, []);

  // Save data to localStorage whenever qapData changes
  useEffect(() => {
    localStorage.setItem('qapData', JSON.stringify(qapData));
  }, [qapData]);

  const handleSaveQAP = (qapFormData: QAPFormData, status?: string) => {
    const now = new Date();
    setQapData(prev => {
      const existingIndex = prev.findIndex(q => q.id === qapFormData.id);
      let updatedQAP = {
        ...qapFormData,
        lastModifiedAt: now,
        createdAt: qapFormData.createdAt || now
      };

      // Add submission timestamp if status changed to submitted
      if (status === 'submitted' || (qapFormData.status !== 'draft' && !qapFormData.submittedAt)) {
        updatedQAP.submittedAt = now;
        updatedQAP = addTimestampToQAP(updatedQAP, 'Submitted for review', 2);
      }

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = updatedQAP;
        return updated;
      } else {
        return [...prev, updatedQAP];
      }
    });
  };

  const handleDeleteQAP = (id: string) => {
    setQapData(prev => prev.filter(q => q.id !== id));
  };

  const handleLevel2Next = (qapId: string) => {
    setQapData(prev => prev.map(qap => {
      if (qap.id === qapId) {
        let updatedQAP = { ...qap };
        
        // Initialize level responses if not exists
        if (!updatedQAP.levelResponses[2]) {
          updatedQAP.levelResponses[2] = {};
        }
        
        // Add response for this role
        updatedQAP.levelResponses[2][user?.role || ''] = {
          username: user?.username || '',
          acknowledged: true,
          comments: {},
          respondedAt: new Date()
        };
        
        // Add timestamp
        updatedQAP = addTimestampToQAP(updatedQAP, `Level 2 reviewed by ${user?.role}`, 2);
        
        // Check if all required roles have responded
        const requiredRoles = qap.qaps
          .filter(spec => spec.match === 'no')
          .flatMap(spec => spec.reviewBy || []);
        
        const uniqueRoles = [...new Set(requiredRoles)];
        const respondedRoles = Object.keys(updatedQAP.levelResponses[2]);
        
        // If all roles responded, move to next level
        const allResponded = uniqueRoles.every(role => respondedRoles.includes(role));
        
        if (allResponded) {
          updatedQAP = addTimestampToQAP(updatedQAP, 'Level 2 completed, moving to next level', 2);
          return processWorkflowTransition(updatedQAP, 3);
        }
        
        return updatedQAP;
      }
      return qap;
    }));
  };

  const handleLevel3Next = (id: string, responses: { [itemIndex: number]: string }) => {
    setQapData(prev => prev.map(qap => {
      if (qap.id === id) {
        let updatedQAP = { ...qap };
        
        if (!updatedQAP.levelResponses[3]) {
          updatedQAP.levelResponses[3] = {};
        }
        
        updatedQAP.levelResponses[3]['head'] = {
          username: user?.username || '',
          acknowledged: true,
          comments: responses,
          respondedAt: new Date()
        };
        
        updatedQAP = addTimestampToQAP(updatedQAP, 'Level 3 reviewed by Head', 3);
        return processWorkflowTransition(updatedQAP, 4);
      }
      return qap;
    }));
  };

  const handleLevel4Next = (id: string, responses: { [itemIndex: number]: string }) => {
    setQapData(prev => prev.map(qap => {
      if (qap.id === id) {
        let updatedQAP = { ...qap };
        
        if (!updatedQAP.levelResponses[4]) {
          updatedQAP.levelResponses[4] = {};
        }
        
        updatedQAP.levelResponses[4]['technical-head'] = {
          username: user?.username || '',
          acknowledged: true,
          comments: responses,
          respondedAt: new Date()
        };
        
        // Move to final comments stage
        updatedQAP.status = 'final-comments';
        updatedQAP.currentLevel = 5;
        updatedQAP = addTimestampToQAP(updatedQAP, 'Level 4 reviewed by Technical Head, sent for final comments', 4);
        
        return updatedQAP;
      }
      return qap;
    }));
  };

  const handleSubmitFinalComments = (id: string, finalComments: string, attachment?: File) => {
    setQapData(prev => prev.map(qap => {
      if (qap.id === id) {
        let updatedQAP = { ...qap };
        updatedQAP.finalComments = finalComments;
        updatedQAP.finalCommentsBy = user?.username;
        updatedQAP.finalCommentsAt = new Date();
        
        // Handle attachment (in a real app, you'd upload to a server)
        if (attachment) {
          updatedQAP.finalCommentsAttachment = {
            name: attachment.name,
            url: URL.createObjectURL(attachment), // In production, this would be a server URL
            type: attachment.type,
            size: attachment.size
          };
        }
        
        updatedQAP = addTimestampToQAP(updatedQAP, 'Final comments added', 4);
        return processWorkflowTransition(updatedQAP, 5);
      }
      return qap;
    }));
  };

  const handleLevel5Approve = (id: string, feedback?: string) => {
    setQapData(prev => prev.map(qap => {
      if (qap.id === id) {
        let updatedQAP = {
          ...qap,
          status: 'approved' as const,
          approver: user?.username,
          approvedAt: new Date(),
          feedback
        };
        
        updatedQAP = addTimestampToQAP(updatedQAP, 'Approved by Plant Head', 5);
        return updatedQAP;
      }
      return qap;
    }));
  };

  const handleLevel5Reject = (id: string, feedback: string) => {
    setQapData(prev => prev.map(qap => {
      if (qap.id === id) {
        let updatedQAP = {
          ...qap,
          status: 'rejected' as const,
          feedback
        };
        
        updatedQAP = addTimestampToQAP(updatedQAP, 'Rejected by Plant Head', 5);
        return updatedQAP;
      }
      return qap;
    }));
  };

  const handleViewQAP = (qap: QAPFormData) => {
    console.log('Viewing QAP:', qap);
  };

  // User management functions for AdminPage
  const handleAddUser = (user: any) => {
    setUsers(prev => [...prev, { ...user, id: user.id || Date.now().toString() }]);
  };

  const handleEditUser = (user: any) => {
    setUsers(prev => prev.map(u => u.id === user.id ? user : u));
  };

  const handleDeleteUser = (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="pt-4">
        <Routes>
          <Route path="/" element={<Index qapData={qapData} onSave={handleSaveQAP} onDelete={handleDeleteQAP} />} />
          
          {/* QAP View/Edit Page */}
          <Route path="/qap/:id" element={<QAPViewEditPage qapData={qapData} onSave={handleSaveQAP} />} />
          
          {/* Level 2 Routes */}
          {(user?.role === 'production' || user?.role === 'quality' || user?.role === 'technical' || user?.role === 'admin') && (
            <Route 
              path="/level2-review" 
              element={<Level2ReviewPage qapData={qapData} onNext={handleLevel2Next} />} 
            />
          )}
          
          {/* Level 3 Routes */}
          {(user?.role === 'head' || user?.role === 'admin') && (
            <Route 
              path="/level3-review" 
              element={<Level3ReviewPage qapData={qapData} onNext={handleLevel3Next} />} 
            />
          )}
          
          {/* Level 4 Routes */}
          {(user?.role === 'technical-head' || user?.role === 'admin') && (
            <Route 
              path="/level4-review" 
              element={<Level4ReviewPage qapData={qapData} onNext={handleLevel4Next} />} 
            />
          )}
          
          {/* Final Comments Routes */}
          {(user?.role === 'requestor' || user?.role === 'admin') && (
            <Route 
              path="/final-comments" 
              element={<FinalCommentsPage qapData={qapData} onSubmitFinalComments={handleSubmitFinalComments} />} 
            />
          )}
          
          {/* Level 5 Routes */}
          {(user?.role === 'plant-head' || user?.role === 'admin') && (
            <Route 
              path="/level5-approval" 
              element={<Level5ApprovalPage qapData={qapData} onApprove={handleLevel5Approve} onReject={handleLevel5Reject} />} 
            />
          )}
          
          {/* Specification Builder */}
          {(user?.role === 'requestor' || user?.role === 'admin') && (
            <Route path="/spec-builder" element={<SpecificationBuilder />} />
          )}
          
          {/* Analytics */}
          <Route path="/analytics" element={<AnalyticsPage qapData={qapData} />} />
          
          {/* Admin Analytics */}
          {user?.role === 'admin' && (
            <Route path="/admin-analytics" element={<AdminAnalytics qapData={qapData} />} />
          )}
          
          {/* Approvals */}
          {(user?.role === 'plant-head' || user?.role === 'admin') && (
            <Route 
              path="/approvals" 
              element={<ApprovalsPage qapData={qapData} onApprove={handleLevel5Approve} onReject={handleLevel5Reject} onView={handleViewQAP} />} 
            />
          )}
          
          {/* Admin */}
          {user?.role === 'admin' && (
            <Route 
              path="/admin" 
              element={
                <AdminPage 
                  qapData={qapData} 
                  users={users} 
                  onAddUser={handleAddUser} 
                  onEditUser={handleEditUser} 
                  onDeleteUser={handleDeleteUser} 
                />
              } 
            />
          )}
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
};

// Main App Component
const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
