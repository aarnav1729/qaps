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
import { QAPFormData, User as QAPUser } from './types/qap';

const AppContent: React.FC = () => {
  const { user: authUser, logout } = useAuth();
  const [qapData, setQapData] = useState<QAPFormData[]>([]);
  const [users, setUsers] = useState<QAPUser[]>([]);

  // Load all QAPs from backend
  useEffect(() => {
    fetch('/api/qaps')
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load QAPs: ${res.statusText}`);
        return res.json();
      })
      .then((data: QAPFormData[]) => setQapData(data))
      .catch(err => console.error(err));
  }, []);

  // Load all users if needed
  useEffect(() => {
    fetch('/api/users')
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load users: ${res.statusText}`);
        return res.json();
      })
      .then((data: QAPUser[]) => setUsers(data))
      .catch(err => console.error(err));
  }, []);

  const handleSaveQAP = (qap: QAPFormData) => {
    const now = new Date();
    const payload: QAPFormData = {
      ...qap,
      lastModifiedAt: now,
      createdAt: qap.createdAt || now
    };
    fetch(`/api/qaps/${qap.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (!res.ok) throw new Error(`Save failed: ${res.statusText}`);
        return res.json();
      })
      .then((saved: QAPFormData) => {
        setQapData(prev => {
          const idx = prev.findIndex(x => x.id === saved.id);
          if (idx >= 0) {
            const arr = [...prev];
            arr[idx] = saved;
            return arr;
          }
          return [...prev, saved];
        });
      })
      .catch(err => console.error(err));
  };

  const handleSubmitQAP = (qap: QAPFormData) => {
    const now = new Date();
    const payload = {
      status: 'level-2' as const,
      currentLevel: 2,
      submittedAt: now,
      lastModifiedAt: now,
      levelStartTimes: { ...qap.levelStartTimes, 2: now },
      timeline: [
        ...qap.timeline,
        { level: 2, action: 'Submitted for Level 2 review', user: qap.submittedBy, timestamp: now }
      ]
    };
    fetch(`/api/qaps/${qap.id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (!res.ok) throw new Error(`Submit failed: ${res.statusText}`);
        return res.json();
      })
      .then((updated: QAPFormData) => {
        setQapData(prev =>
          prev.map(x => (x.id === updated.id ? updated : x))
        );
      })
      .catch(err => console.error(err));
  };

  const handleLevel2Next = (
    qapId: string,
    role: string,
    responses: { [itemIndex: number]: string }
  ) => {
    const now = new Date();
    fetch(`/api/qaps/${qapId}/level2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, responses, timestamp: now })
    })
      .then(res => {
        if (!res.ok) throw new Error(`Level2 failed: ${res.statusText}`);
        return res.json();
      })
      .then((updated: QAPFormData) => {
        setQapData(prev => prev.map(x => (x.id === qapId ? updated : x)));
      })
      .catch(err => console.error(err));
  };

  const handleTransitionToLevel3 = (qapId: string) => {
    fetch(`/api/qaps/${qapId}/level3/transition`, {
      method: 'POST'
    })
      .then(res => {
        if (!res.ok) throw new Error(`Transition failed: ${res.statusText}`);
        return res.json();
      })
      .then((updated: QAPFormData) => {
        setQapData(prev => prev.map(x => (x.id === qapId ? updated : x)));
      })
      .catch(err => console.error(err));
  };

  const handleLevel3Next = (
    qapId: string,
    responses: { [itemIndex: number]: string }
  ) => {
    const now = new Date();
    fetch(`/api/qaps/${qapId}/level3`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ responses, timestamp: now })
    })
      .then(res => {
        if (!res.ok) throw new Error(`Level3 failed: ${res.statusText}`);
        return res.json();
      })
      .then((updated: QAPFormData) => {
        setQapData(prev => prev.map(x => (x.id === qapId ? updated : x)));
      })
      .catch(err => console.error(err));
  };

  const handleLevel4Next = (
    qapId: string,
    responses: { [itemIndex: number]: string }
  ) => {
    const now = new Date();
    fetch(`/api/qaps/${qapId}/level4`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ responses, timestamp: now })
    })
      .then(res => {
        if (!res.ok) throw new Error(`Level4 failed: ${res.statusText}`);
        return res.json();
      })
      .then((updated: QAPFormData) => {
        setQapData(prev => prev.map(x => (x.id === qapId ? updated : x)));
      })
      .catch(err => console.error(err));
  };

  const handleApproveQAP = (qapId: string, feedback: string) => {
    const now = new Date();
    fetch(`/api/qaps/${qapId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback, timestamp: now })
    })
      .then(res => {
        if (!res.ok) throw new Error(`Approve failed: ${res.statusText}`);
        return res.json();
      })
      .then((updated: QAPFormData) => {
        setQapData(prev => prev.map(x => (x.id === qapId ? updated : x)));
      })
      .catch(err => console.error(err));
  };

  const handleRejectQAP = (qapId: string, feedback: string) => {
    const now = new Date();
    fetch(`/api/qaps/${qapId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback, timestamp: now })
    })
      .then(res => {
        if (!res.ok) throw new Error(`Reject failed: ${res.statusText}`);
        return res.json();
      })
      .then((updated: QAPFormData) => {
        setQapData(prev => prev.map(x => (x.id === qapId ? updated : x)));
      })
      .catch(err => console.error(err));
  };

  const handleSubmitFinalComments = (
    qapId: string,
    finalComments: string,
    attachment?: File
  ) => {
    const now = new Date();
    const formData = new FormData();
    formData.append('finalComments', finalComments);
    formData.append('timestamp', now.toISOString());
    if (attachment) formData.append('attachment', attachment);

    fetch(`/api/qaps/${qapId}/final-comments`, {
      method: 'POST',
      body: formData
    })
      .then(res => {
        if (!res.ok) throw new Error(`Final comments failed: ${res.statusText}`);
        return res.json();
      })
      .then((updated: QAPFormData) => {
        setQapData(prev => prev.map(x => (x.id === qapId ? updated : x)));
      })
      .catch(err => console.error(err));
  };

  const handleDeleteQAP = (qapId: string) => {
    if (!window.confirm('Are you sure you want to delete this QAP?')) return;
    fetch(`/api/qaps/${qapId}`, { method: 'DELETE' })
      .then(res => {
        if (!res.ok) throw new Error(`Delete failed: ${res.statusText}`);
        setQapData(prev => prev.filter(x => x.id !== qapId));
      })
      .catch(err => console.error(err));
  };

  const convertToQAPUser = (u: ReturnType<typeof useAuth>['user']): QAPUser => ({
    id: u.username,
    username: u.username,
    role: u.role,
    plant: u.plant || ''
  });

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
            authUser ? <SpecificationBuilder /> : <Navigate to="/login" replace />
          }
        />

        <Route
          path="/final-comments"
          element={
            authUser ? (
              <FinalCommentsPage
                qapData={qapData}
                onSubmitFinalComments={handleSubmitFinalComments}
              />
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
                <Navigation user={convertToQAPUser(authUser)} onLogout={logout} />
                <Index
                  qapData={qapData}
                  user={convertToQAPUser(authUser)}
                  onSave={handleSaveQAP}
                  onSubmit={handleSubmitQAP}
                  onLevel2Next={handleLevel2Next}
                  onLevel3Next={handleLevel3Next}
                  onLevel4Next={handleLevel4Next}
                  onApprove={handleApproveQAP}
                  onReject={handleRejectQAP}
                  onSubmitFinalComments={handleSubmitFinalComments}
                  onDelete={handleDeleteQAP}
                  users={users}
                  setUsers={setUsers}
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
