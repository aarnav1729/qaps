import React, { useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate
} from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './components/LoginPage';
import Index from './pages/Index';
import NotFound from './pages/NotFound';
import Navigation from './components/Navigation';
import QAPViewEditPage from './pages/QAPViewEditPage';
import AdminAnalytics from './components/AdminAnalytics';
import WorkflowPage from './pages/WorkflowPage';
import FinalCommentsPage from './components/FinalCommentsPage';
import SpecificationBuilder from './components/SpecificationBuilder';
import { QAPFormData } from './types/qap';
import { User } from './contexts/AuthContext';

const AppContent: React.FC = () => {
  const { user: authUser, logout } = useAuth();
  const [qapData, setQapData] = useState<QAPFormData[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Load data from localStorage
  useEffect(() => {
    const savedQAPs = localStorage.getItem('qapData');
    if (savedQAPs) {
      try {
        const parsedQAPs = JSON.parse(savedQAPs).map((qap: any) => ({
          ...qap,
          submittedAt: qap.submittedAt ? new Date(qap.submittedAt) : undefined,
          createdAt: new Date(qap.createdAt),
          lastModifiedAt: new Date(qap.lastModifiedAt),
          approvedAt: qap.approvedAt ? new Date(qap.approvedAt) : undefined,
          finalCommentsAt: qap.finalCommentsAt ? new Date(qap.finalCommentsAt) : undefined,
          timeline: qap.timeline?.map((entry: any) => ({
            ...entry,
            timestamp: new Date(entry.timestamp)
          })) || [],
          levelStartTimes: qap.levelStartTimes ? Object.keys(qap.levelStartTimes).reduce((acc: any, key) => {
            acc[key] = new Date(qap.levelStartTimes[key]);
            return acc;
          }, {}) : {},
          levelEndTimes: qap.levelEndTimes ? Object.keys(qap.levelEndTimes).reduce((acc: any, key) => {
            acc[key] = new Date(qap.levelEndTimes[key]);
            return acc;
          }, {}) : {}
        }));
        setQapData(parsedQAPs);
      } catch (error) {
        console.error('Error parsing QAP data:', error);
        setQapData([]);
      }
    }
  }, []);

  const saveToLocalStorage = (data: QAPFormData[]) => {
    localStorage.setItem('qapData', JSON.stringify(data));
  };

  const handleSaveQAP = (qap: QAPFormData) => {
    const now = new Date();
    const payload: QAPFormData = {
      ...qap,
      lastModifiedAt: now,
      createdAt: qap.createdAt || now
    };
    
    setQapData(prev => {
      const idx = prev.findIndex(x => x.id === payload.id);
      let newData;
      if (idx >= 0) {
        newData = [...prev];
        newData[idx] = payload;
      } else {
        newData = [...prev, payload];
      }
      saveToLocalStorage(newData);
      return newData;
    });
  };

  const handleSubmitQAP = (qap: QAPFormData) => {
    const now = new Date();
    const updatedQAP = {
      ...qap,
      status: 'level-2' as const,
      currentLevel: 2 as const,
      submittedAt: now,
      lastModifiedAt: now,
      levelStartTimes: { ...qap.levelStartTimes, 2: now },
      timeline: [
        ...qap.timeline,
        { level: 2, action: 'Submitted for Level 2 review', user: qap.submittedBy, timestamp: now }
      ]
    };
    
    setQapData(prev => {
      const newData = prev.map(x => (x.id === qap.id ? updatedQAP : x));
      saveToLocalStorage(newData);
      return newData;
    });
  };

  const handleLevel2Next = (
    qapId: string,
    role: string,
    responses: { [itemIndex: number]: string }
  ) => {
    const now = new Date();
    setQapData(prev => {
      const newData = prev.map(qap => {
        if (qap.id === qapId) {
          return {
            ...qap,
            levelResponses: {
              ...qap.levelResponses,
              2: {
                ...qap.levelResponses[2],
                [role]: {
                  username: authUser?.username || '',
                  acknowledged: true,
                  comments: responses,
                  respondedAt: now
                }
              }
            },
            lastModifiedAt: now
          };
        }
        return qap;
      });
      saveToLocalStorage(newData);
      return newData;
    });
  };

  const handleTransitionToLevel3 = (qapId: string) => {
    const now = new Date();
    setQapData(prev => {
      const newData = prev.map(qap => {
        if (qap.id === qapId) {
          const plant = qap.plant.toLowerCase();
          if (['p4', 'p5'].includes(plant)) {
            return {
              ...qap,
              status: 'level-3' as const,
              currentLevel: 3 as const,
              lastModifiedAt: now,
              timeline: [
                ...qap.timeline,
                { level: 3, action: 'Transitioned to Head review', user: 'system', timestamp: now }
              ]
            };
          } else {
            return {
              ...qap,
              status: 'level-4' as const,
              currentLevel: 4 as const,
              lastModifiedAt: now,
              timeline: [
                ...qap.timeline,
                { level: 4, action: 'Transitioned to Technical Head (P2)', user: 'system', timestamp: now }
              ]
            };
          }
        }
        return qap;
      });
      saveToLocalStorage(newData);
      return newData;
    });
  };

  const handleLevel3Next = (
    qapId: string,
    responses: { [itemIndex: number]: string }
  ) => {
    const now = new Date();
    setQapData(prev => {
      const newData = prev.map(qap => {
        if (qap.id === qapId) {
          return {
            ...qap,
            status: 'level-4' as const,
            currentLevel: 4 as const,
            levelResponses: {
              ...qap.levelResponses,
              3: {
                ...qap.levelResponses[3],
                head: {
                  username: authUser?.username || '',
                  acknowledged: true,
                  comments: responses,
                  respondedAt: now
                }
              }
            },
            lastModifiedAt: now,
            timeline: [
              ...qap.timeline,
              { level: 4, action: 'Sent to Technical Head', user: authUser?.username, timestamp: now }
            ]
          };
        }
        return qap;
      });
      saveToLocalStorage(newData);
      return newData;
    });
  };

  const handleLevel4Next = (
    qapId: string,
    responses: { [itemIndex: number]: string }
  ) => {
    const now = new Date();
    setQapData(prev => {
      const newData = prev.map(qap => {
        if (qap.id === qapId) {
          return {
            ...qap,
            status: 'final-comments' as const,
            currentLevel: 1 as const,
            levelResponses: {
              ...qap.levelResponses,
              4: {
                ...qap.levelResponses[4],
                'technical-head': {
                  username: authUser?.username || '',
                  acknowledged: true,
                  comments: responses,
                  respondedAt: now
                }
              }
            },
            lastModifiedAt: now,
            timeline: [
              ...qap.timeline,
              { level: 1, action: 'Sent to Requestor for final comments', user: authUser?.username, timestamp: now }
            ]
          };
        }
        return qap;
      });
      saveToLocalStorage(newData);
      return newData;
    });
  };

  const handleApproveQAP = (qapId: string, feedback: string) => {
    const now = new Date();
    setQapData(prev => {
      const newData = prev.map(qap => {
        if (qap.id === qapId) {
          return {
            ...qap,
            status: 'approved' as const,
            approver: authUser?.username,
            approvedAt: now,
            feedback,
            lastModifiedAt: now,
            timeline: [
              ...qap.timeline,
              { level: 5, action: 'Approved', user: authUser?.username, timestamp: now }
            ]
          };
        }
        return qap;
      });
      saveToLocalStorage(newData);
      return newData;
    });
  };

  const handleRejectQAP = (qapId: string, feedback: string) => {
    const now = new Date();
    setQapData(prev => {
      const newData = prev.map(qap => {
        if (qap.id === qapId) {
          return {
            ...qap,
            status: 'rejected' as const,
            feedback,
            lastModifiedAt: now,
            timeline: [
              ...qap.timeline,
              { level: 5, action: 'Rejected', user: authUser?.username, timestamp: now }
            ]
          };
        }
        return qap;
      });
      saveToLocalStorage(newData);
      return newData;
    });
  };

  const handleSubmitFinalComments = (
    qapId: string,
    finalComments: string,
    attachment?: File
  ) => {
    const now = new Date();
    setQapData(prev => {
      const newData = prev.map(qap => {
        if (qap.id === qapId) {
          const plant = qap.plant.toLowerCase();
          const nextStatus: QAPFormData['status'] = ['p4', 'p5'].includes(plant) ? 'level-3-final' : 'level-4-final';
          
          return {
            ...qap,
            status: nextStatus,
            currentLevel: (['p4', 'p5'].includes(plant) ? 3 : 4) as QAPFormData['currentLevel'],
            finalComments,
            finalCommentsBy: authUser?.username,
            finalCommentsAt: now,
            finalCommentsAttachment: attachment ? {
              name: attachment.name,
              url: URL.createObjectURL(attachment),
              type: attachment.type,
              size: attachment.size
            } : undefined,
            lastModifiedAt: now,
            timeline: [
              ...qap.timeline,
              { level: 1, action: 'Final comments submitted', user: authUser?.username, timestamp: now }
            ]
          };
        }
        return qap;
      });
      saveToLocalStorage(newData);
      return newData;
    });
  };

  const handleDeleteQAP = (qapId: string) => {
    if (!window.confirm('Are you sure you want to delete this QAP?')) return;
    setQapData(prev => {
      const newData = prev.filter(x => x.id !== qapId);
      saveToLocalStorage(newData);
      return newData;
    });
  };


  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/workflow"
          element={authUser ? <WorkflowPage /> : <Navigate to="/login" replace />}
        />

        <Route
          path="/analytics"
          element={
            authUser ? <AdminAnalytics qapData={qapData} /> : <Navigate to="/login" replace />
          }
        />

        <Route
          path="/qap/:id"
          element={
            authUser ? (
              <QAPViewEditPage
                qapData={qapData}
                onSave={handleSaveQAP}
                onSubmit={handleSubmitQAP}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/spec-builder"
          element={
            authUser ? (
              <>
                <Navigation />
                <SpecificationBuilder />
              </>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/final-comments"
          element={
            authUser ? (
              <>
                <Navigation />
                <FinalCommentsPage
                  qapData={qapData}
                  onSubmitFinalComments={handleSubmitFinalComments}
                />
              </>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/"
          element={
            authUser ? (
              <>
                <Navigation />
                <Index
                  qapData={qapData}
                  onSave={handleSaveQAP}
                  onDelete={handleDeleteQAP}
                />
              </>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
};

const App: React.FC = () => (
  <Router>
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  </Router>
);

export default App;
