import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navigation from './components/Navigation';
import LoginPage from './components/LoginPage';
import Index from './pages/Index';
import Level2ReviewPage from './components/Level2ReviewPage';
import Level3ReviewPage from './components/Level3ReviewPage';
import Level4ReviewPage from './components/Level4ReviewPage';
import FinalCommentsPage from './components/FinalCommentsPage';
import Level5ApprovalPage from './components/Level5ApprovalPage';
import SpecificationBuilder from './components/SpecificationBuilder';
import ApprovalsPage from './components/ApprovalsPage';
import AnalyticsPage from './components/AnalyticsPage';
import AdminPage from './components/AdminPage';
import { QAPFormData } from './types/qap';
import { processWorkflowTransition } from './utils/workflowUtils';

const queryClient = new QueryClient();

// Main App Content Component
const AppContent: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [qapData, setQapData] = useState<QAPFormData[]>([]);

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

  const handleSaveQAP = (qapFormData: QAPFormData) => {
    setQapData(prev => {
      const existingIndex = prev.findIndex(q => q.id === qapFormData.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = qapFormData;
        return updated;
      } else {
        return [...prev, qapFormData];
      }
    });
  };

  const handleDeleteQAP = (id: string) => {
    setQapData(prev => prev.filter(q => q.id !== id));
  };

  const handleLevel2Next = (id: string, role: string, responses: { [itemIndex: number]: string }) => {
    setQapData(prev => prev.map(qap => {
      if (qap.id === id) {
        const updatedQAP = { ...qap };
        
        // Initialize level responses if not exists
        if (!updatedQAP.levelResponses[2]) {
          updatedQAP.levelResponses[2] = {};
        }
        
        // Add response for this role
        updatedQAP.levelResponses[2][role] = {
          username: user?.username || '',
          acknowledged: true,
          comments: responses,
          respondedAt: new Date()
        };
        
        // Check if all required roles have responded
        const requiredRoles = qap.qaps
          .filter(spec => spec.match === 'no')
          .flatMap(spec => spec.reviewBy || []);
        
        const uniqueRoles = [...new Set(requiredRoles)];
        const respondedRoles = Object.keys(updatedQAP.levelResponses[2]);
        
        // If all roles responded or 4 days passed, move to next level
        const allResponded = uniqueRoles.every(role => respondedRoles.includes(role));
        
        if (allResponded) {
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
        const updatedQAP = { ...qap };
        
        if (!updatedQAP.levelResponses[3]) {
          updatedQAP.levelResponses[3] = {};
        }
        
        updatedQAP.levelResponses[3]['head'] = {
          username: user?.username || '',
          acknowledged: true,
          comments: responses,
          respondedAt: new Date()
        };
        
        return processWorkflowTransition(updatedQAP, 4);
      }
      return qap;
    }));
  };

  const handleLevel4Next = (id: string, responses: { [itemIndex: number]: string }) => {
    setQapData(prev => prev.map(qap => {
      if (qap.id === id) {
        const updatedQAP = { ...qap };
        
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
        updatedQAP.timeline.push({
          level: 4,
          action: 'Reviewed by Technical Head, sent for final comments',
          user: user?.username,
          timestamp: new Date()
        });
        
        return updatedQAP;
      }
      return qap;
    }));
  };

  const handleSubmitFinalComments = (id: string, finalComments: string) => {
    setQapData(prev => prev.map(qap => {
      if (qap.id === id) {
        const updatedQAP = { ...qap };
        updatedQAP.finalComments = finalComments;
        updatedQAP.finalCommentsBy = user?.username;
        updatedQAP.finalCommentsAt = new Date();
        
        return processWorkflowTransition(updatedQAP, 5);
      }
      return qap;
    }));
  };

  const handleLevel5Approve = (id: string, feedback?: string) => {
    setQapData(prev => prev.map(qap => {
      if (qap.id === id) {
        return {
          ...qap,
          status: 'approved' as const,
          approver: user?.username,
          approvedAt: new Date(),
          feedback,
          timeline: [
            ...qap.timeline,
            {
              level: 5,
              action: 'Approved by Plant Head',
              user: user?.username,
              timestamp: new Date(),
              comments: feedback
            }
          ]
        };
      }
      return qap;
    }));
  };

  const handleLevel5Reject = (id: string, feedback: string) => {
    setQapData(prev => prev.map(qap => {
      if (qap.id === id) {
        return {
          ...qap,
          status: 'rejected' as const,
          feedback,
          timeline: [
            ...qap.timeline,
            {
              level: 5,
              action: 'Rejected by Plant Head',
              user: user?.username,
              timestamp: new Date(),
              comments: feedback
            }
          ]
        };
      }
      return qap;
    }));
  };

  const handleViewQAP = (qap: QAPFormData) => {
    console.log('Viewing QAP:', qap);
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
          
          {/* Approvals (keeping for compatibility) */}
          {(user?.role === 'plant-head' || user?.role === 'admin') && (
            <Route 
              path="/approvals" 
              element={<ApprovalsPage qapData={qapData} onApprove={handleLevel5Approve} onReject={handleLevel5Reject} onView={handleViewQAP} />} 
            />
          )}
          
          {/* Admin */}
          {user?.role === 'admin' && (
            <Route path="/admin" element={<AdminPage />} />
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
