import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import Index from './pages/Index';
import NotFound from './pages/NotFound';
import Navigation from './components/Navigation';
import QAPViewEditPage from './pages/QAPViewEditPage';
import AdminAnalytics from './components/AdminAnalytics';
import WorkflowPage from './pages/WorkflowPage';
import { QAPFormData, User, QAPSpecification } from './types/qap';

const mockQAPData: QAPSpecification[] = [
  {
    sno: 1,
    criteria: 'Visual',
    subCriteria: 'Surface Finish',
    componentOperation: 'Casing',
    characteristics: 'Smoothness',
    class: 'Critical',
    typeOfCheck: 'Visual Inspection',
    sampling: '100%',
    specification: 'No scratches',
    defect: 'Scratches',
    defectClass: 'Major',
    description: 'Check for surface defects',
    criteriaLimits: 'N/A',
    match: 'yes',
    customerSpecification: 'As per drawing',
    selectedForReview: true,
    reviewBy: ['technical', 'quality']
  },
  {
    sno: 2,
    criteria: 'MQP',
    subCriteria: 'Tensile Strength',
    componentOperation: 'Blade',
    characteristics: 'Strength',
    class: 'Critical',
    typeOfCheck: 'Tensile Test',
    sampling: '10%',
    specification: '> 200 MPa',
    defect: '< 200 MPa',
    defectClass: 'Critical',
    description: 'Verify tensile strength',
    criteriaLimits: '> 200 MPa',
    match: 'no',
    customerSpecification: 'As per customer spec',
    selectedForReview: true,
    reviewBy: ['production']
  }
];

const App: React.FC = () => {
  const [qapData, setQapData] = useState<QAPFormData[]>([
    {
      id: '1',
      customerName: 'ABC Corp',
      projectName: 'Wind Farm Alpha',
      orderQuantity: 50,
      productType: 'Wind Turbine',
      plant: 'P4',
      status: 'draft',
      submittedBy: 'john_doe',
      submittedAt: new Date('2024-01-10'),
      currentLevel: 1,
      levelResponses: {},
      timeline: [],
      qaps: mockQAPData,
      createdAt: new Date('2024-01-01'),
      lastModifiedAt: new Date('2024-01-10'),
      levelStartTimes: { 1: new Date('2024-01-01') },
      levelEndTimes: {}
    },
    {
      id: '2',
      customerName: 'XYZ Energy',
      projectName: 'Solar Plant Beta',
      orderQuantity: 100,
      productType: 'Solar Panel',
      plant: 'P2',
      status: 'approved',
      submittedBy: 'jane_smith',
      submittedAt: new Date('2024-01-05'),
      currentLevel: 5,
      levelResponses: {},
      timeline: [],
      qaps: mockQAPData,
      approver: 'cmk',
      approvedAt: new Date('2024-01-15'),
      feedback: 'Approved with minor adjustments',
      createdAt: new Date('2024-01-01'),
      lastModifiedAt: new Date('2024-01-15'),
      levelStartTimes: { 1: new Date('2024-01-01'), 5: new Date('2024-01-14') },
      levelEndTimes: { 1: new Date('2024-01-02'), 5: new Date('2024-01-15') }
    }
  ]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([
    {
      id: '1',
      username: 'john_doe',
      password: 'password',
      role: 'requestor',
      plant: 'P4'
    },
    {
      id: '2',
      username: 'jane_smith',
      password: 'password',
      role: 'requestor',
      plant: 'P2'
    },
    {
      id: '3',
      username: 'mike_tech',
      password: 'password',
      role: 'technical',
      plant: 'P4'
    },
    {
      id: '4',
      username: 'nrao',
      password: 'password',
      role: 'head',
      plant: 'P4, P5'
    },
    {
      id: '5',
      username: 'jmr',
      password: 'password',
      role: 'technical-head',
      plant: 'P2, P4, P5'
    },
    {
      id: '6',
      username: 'cmk',
      password: 'password',
      role: 'plant-head',
      plant: 'P2, P4, P5'
    },
    {
      id: '7',
      username: 'baskara',
      password: 'password',
      role: 'technical',
      plant: 'P2'
    },
    {
      id: '8',
      username: 'production_p4',
      password: 'password',
      role: 'production',
      plant: 'P4'
    },
    {
      id: '9',
      username: 'quality_p4',
      password: 'password',
      role: 'quality',
      plant: 'P4'
    }
  ]);

  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
  };

  const handleSaveQAP = (qap: QAPFormData) => {
    const now = new Date();
    const updatedQAP = { 
      ...qap, 
      lastModifiedAt: now,
      createdAt: qap.createdAt || now
    };
    
    setQapData(prev => {
      const existingIndex = prev.findIndex(q => q.id === qap.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = updatedQAP;
        return updated;
      }
      return [...prev, updatedQAP];
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
      createdAt: qap.createdAt || now,
      levelStartTimes: { ...qap.levelStartTimes, 2: now },
      timeline: [
        ...qap.timeline,
        {
          level: 2,
          action: 'Submitted for Level 2 review',
          user: qap.submittedBy,
          timestamp: now
        }
      ]
    };
    
    setQapData(prev => {
      const existingIndex = prev.findIndex(q => q.id === qap.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = updatedQAP;
        return updated;
      }
      return [...prev, updatedQAP];
    });
  };

  const handleLevel2Next = (qapId: string, role: string, responses: { [itemIndex: number]: string }) => {
    const now = new Date();
    setQapData(prev => prev.map(qap => {
      if (qap.id === qapId) {
        const updatedResponses = { ...qap.levelResponses };
        if (!updatedResponses[2]) updatedResponses[2] = {};
        updatedResponses[2][role] = {
          username: currentUser?.username || 'system',
          acknowledged: true,
          comments: responses,
          respondedAt: now
        };

        return {
          ...qap,
          levelResponses: updatedResponses,
          lastModifiedAt: now
        };
      }
      return qap;
    }));

    // Transition to next level after all level 2 reviews are done
    const qap = qapData.find(q => q.id === qapId);
    if (qap) {
      const allLevel2Roles = ['technical', 'production', 'quality'];
      const allReviewed = allLevel2Roles.every(role => qap.qaps.every((item, index) => {
        if (item.match === 'no' && item.reviewBy?.includes(role)) {
          return qap.levelResponses[2]?.[role]?.acknowledged === true;
        }
        return true;
      }));

      if (allReviewed) {
        handleTransitionToLevel3(qapId);
      }
    }
  };

  const handleTransitionToLevel3 = (qapId: string) => {
    setQapData(prev => prev.map(qap => {
      if (qap.id === qapId) {
        const now = new Date();
        const updatedQAP = { ...qap };
        const plant = updatedQAP.plant.toLowerCase();

        // End Level 2 timing
        if (updatedQAP.levelEndTimes) {
          updatedQAP.levelEndTimes[2] = now;
        } else {
          updatedQAP.levelEndTimes = { 2: now };
        }

        if (['p4', 'p5'].includes(plant)) {
          updatedQAP.status = 'level-3';
          updatedQAP.currentLevel = 3;
          updatedQAP.timeline.push({
            level: 3,
            action: 'Sent to Head for review',
            user: 'system',
            timestamp: now
          });
        } else {
          updatedQAP.status = 'level-4';
          updatedQAP.currentLevel = 4;
          updatedQAP.timeline.push({
            level: 3,
            action: 'Auto-bypassed (P2 plant)',
            user: 'system',
            timestamp: now
          });
          updatedQAP.timeline.push({
            level: 4,
            action: 'Sent to Technical Head',
            user: 'system',
            timestamp: now
          });
        }

        // Start new level timing
        if (updatedQAP.levelStartTimes) {
          updatedQAP.levelStartTimes[updatedQAP.currentLevel] = now;
        } else {
          updatedQAP.levelStartTimes = { [updatedQAP.currentLevel]: now };
        }

        updatedQAP.lastModifiedAt = now;
        return updatedQAP;
      }
      return qap;
    }));
  };

  const handleLevel3Next = (id: string, responses: { [itemIndex: number]: string }) => {
    const now = new Date();
    setQapData(prev => prev.map(qap => {
      if (qap.id === id) {
        const updatedResponses = { ...qap.levelResponses };
        if (!updatedResponses[3]) updatedResponses[3] = {};
        updatedResponses[3]['head'] = {
          username: currentUser?.username || 'system',
          acknowledged: true,
          comments: responses,
          respondedAt: now
        };

        // End Level 3 timing
        if (qap.levelEndTimes) {
          qap.levelEndTimes[3] = now;
        } else {
          qap.levelEndTimes = { 3: now };
        }

        return {
          ...qap,
          levelResponses: updatedResponses,
          status: 'level-4',
          currentLevel: 4,
          lastModifiedAt: now,
          levelStartTimes: { ...qap.levelStartTimes, 4: now },
          timeline: [
            ...qap.timeline,
            {
              level: 4,
              action: 'Sent to Technical Head',
              user: currentUser?.username,
              timestamp: now,
              comments: Object.values(responses).join('\n')
            }
          ]
        };
      }
      return qap;
    }));
  };

  const handleLevel4Next = (id: string, responses: { [itemIndex: number]: string }) => {
    const now = new Date();
    setQapData(prev => prev.map(qap => {
      if (qap.id === id) {
        const updatedResponses = { ...qap.levelResponses };
        if (!updatedResponses[4]) updatedResponses[4] = {};
        updatedResponses[4]['technical-head'] = {
          username: currentUser?.username || 'system',
          acknowledged: true,
          comments: responses,
          respondedAt: now
        };

        // End Level 4 timing
        if (qap.levelEndTimes) {
          qap.levelEndTimes[4] = now;
        } else {
          qap.levelEndTimes = { 4: now };
        }

        return {
          ...qap,
          levelResponses: updatedResponses,
          status: 'final-comments',
          currentLevel: 1,
          lastModifiedAt: now,
          levelStartTimes: { ...qap.levelStartTimes, 1: now },
          timeline: [
            ...qap.timeline,
            {
              level: 1,
              action: 'Sent to Requestor for final comments',
              user: currentUser?.username,
              timestamp: now,
              comments: Object.values(responses).join('\n')
            }
          ]
        };
      }
      return qap;
    }));
  };

  const handleApproveQAP = (id: string, feedback: string) => {
    const now = new Date();
    setQapData(prev => prev.map(qap => 
      qap.id === id 
        ? { 
            ...qap, 
            status: 'approved' as const,
            approver: currentUser?.username || '',
            approvedAt: now,
            feedback,
            lastModifiedAt: now,
            levelEndTimes: { ...qap.levelEndTimes, 5: now },
            timeline: [
              ...qap.timeline,
              {
                level: 5,
                action: 'Approved by Plant Head',
                user: currentUser?.username,
                timestamp: now,
                comments: feedback
              }
            ]
          }
        : qap
    ));
  };

  const handleRejectQAP = (id: string, feedback: string) => {
    const now = new Date();
    setQapData(prev => prev.map(qap => 
      qap.id === id 
        ? { 
            ...qap, 
            status: 'rejected' as const,
            feedback,
            lastModifiedAt: now,
            levelEndTimes: { ...qap.levelEndTimes, 5: now },
            timeline: [
              ...qap.timeline,
              {
                level: 5,
                action: 'Rejected by Plant Head',
                user: currentUser?.username,
                timestamp: now,
                comments: feedback
              }
            ]
          }
        : qap
    ));
  };

  const handleSubmitFinalComments = (id: string, finalComments: string, attachment?: File) => {
    const now = new Date();
    setQapData(prev => prev.map(qap => {
      if (qap.id === id) {
        const updatedQAP = { ...qap };
        updatedQAP.finalComments = finalComments;
        updatedQAP.finalCommentsBy = currentUser?.username;
        updatedQAP.finalCommentsAt = now;
        updatedQAP.lastModifiedAt = now;

        if (attachment) {
          updatedQAP.finalCommentsAttachment = {
            name: attachment.name,
            url: URL.createObjectURL(attachment),
            type: attachment.type,
            size: attachment.size
          };
        }

        // End Final Comments (Level 1) timing
        if (updatedQAP.levelEndTimes) {
          updatedQAP.levelEndTimes[1] = now;
        } else {
          updatedQAP.levelEndTimes = { 1: now };
        }

        const plant = updatedQAP.plant.toLowerCase();
        if (['p4', 'p5'].includes(plant)) {
          updatedQAP.status = 'level-3-final';
          updatedQAP.currentLevel = 3;
          updatedQAP.timeline.push({
            level: 3,
            action: 'Sent to Head for final review',
            user: 'system',
            timestamp: now,
            comments: finalComments
          });
        } else {
          updatedQAP.status = 'level-4-final';
          updatedQAP.currentLevel = 4;
          updatedQAP.timeline.push({
            level: 4,
            action: 'Sent to Technical Head for final review',
            user: 'system',
            timestamp: now,
            comments: finalComments
          });
        }

        // Start new level timing
        if (updatedQAP.levelStartTimes) {
          updatedQAP.levelStartTimes[updatedQAP.currentLevel] = now;
        } else {
          updatedQAP.levelStartTimes = { [updatedQAP.currentLevel]: now };
        }

        return updatedQAP;
      }
      return qap;
    }));
  };

  const handleDeleteQAP = (id: string) => {
    if (window.confirm('Are you sure you want to delete this QAP?')) {
      setQapData(prev => prev.filter(qap => qap.id !== id));
    }
  };

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
          <Route path="/workflow" element={<WorkflowPage />} />
          <Route path="/analytics" element={<AdminAnalytics qapData={qapData} />} />
          <Route path="/qap/:id" element={<QAPViewEditPage qapData={qapData} onSave={handleSaveQAP} />} />
          <Route 
            path="/" 
            element={
              currentUser ? (
                <div>
                  <Navigation user={currentUser} onLogout={handleLogout} />
                  <Index 
                    qapData={qapData} 
                    user={currentUser}
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
                </div>
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
