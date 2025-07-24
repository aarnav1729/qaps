
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, FileText, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import EnhancedQAPModal from '../components/EnhancedQAPModal';
import QAPTable from '../components/QAPTable';
import EnhancedViewQAPModal from '../components/EnhancedViewQAPModal';
import { QAPFormData } from '@/types/qap';
import { useAuth } from '@/contexts/AuthContext';
import { getUserAccessibleQAPs } from '@/utils/workflowUtils';

interface IndexProps {
  qapData: QAPFormData[];
  onSave: (qapData: QAPFormData, status?: string) => void;
  onDelete: (id: string) => void;
}

const Index: React.FC<IndexProps> = ({ qapData, onSave, onDelete }) => {
  const { user } = useAuth();
  const [isQAPModalOpen, setIsQAPModalOpen] = useState(false);
  const [selectedQAP, setSelectedQAP] = useState<QAPFormData | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [nextSno, setNextSno] = useState(1);
  
  // Get QAPs accessible to current user
  const accessibleQAPs = user ? getUserAccessibleQAPs(user, qapData) : [];
  const userQAPs = qapData.filter(qap => qap.submittedBy === user?.username);
  
  const handleCreateNew = () => {
    setSelectedQAP(null);
    setIsQAPModalOpen(true);
  };

  const handleEdit = (qap: QAPFormData) => {
    setSelectedQAP(qap);
    setIsQAPModalOpen(true);
  };

  const handleView = (qap: QAPFormData) => {
    setSelectedQAP(qap);
    setIsViewModalOpen(true);
  };

  const handleShare = (qap: QAPFormData) => {
    console.log('Sharing QAP:', qap.id);
  };

  const handleSave = (qapData: QAPFormData, status?: string) => {
    onSave(qapData, status);
    setIsQAPModalOpen(false);
  };

  const handleDelete = (qap: QAPFormData) => {
    onDelete(qap.id);
  };

  // Stats for dashboard based on accessible QAPs
  const stats = {
    total: accessibleQAPs.length,
    draft: accessibleQAPs.filter(q => q.status === 'draft').length,
    submitted: accessibleQAPs.filter(q => !['draft', 'approved'].includes(q.status)).length,
    approved: accessibleQAPs.filter(q => q.status === 'approved').length,
    inReview: accessibleQAPs.filter(q => ['level-2', 'level-3', 'level-4', 'level-5'].includes(q.status)).length,
    myQAPs: userQAPs.length,
  };

  const getDashboardTitle = () => {
    switch (user?.role) {
      case 'admin':
        return 'Admin Dashboard - All QAPs';
      case 'plant-head':
        return 'Plant Head Dashboard - All QAPs';
      case 'technical-head':
        return 'Technical Head Dashboard - All QAPs';
      case 'head':
        return 'Head Dashboard - Plant QAPs';
      case 'production':
      case 'quality':
      case 'technical':
        return 'Review Dashboard - Plant QAPs';
      default:
        return 'QAP Management Dashboard';
    }
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          {getDashboardTitle()}
        </h1>
        <p className="text-gray-600">
          {user?.role === 'requestor' 
            ? 'Create and manage Quality Assurance Plans'
            : 'Review and approve Quality Assurance Plans'
          }
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Draft</p>
                <p className="text-2xl font-bold">{stats.draft}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">In Review</p>
                <p className="text-2xl font-bold">{stats.inReview}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-2xl font-bold">{stats.approved}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Submitted</p>
                <p className="text-2xl font-bold">{stats.submitted}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {user?.role === 'requestor' && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm font-medium text-gray-600">My QAPs</p>
                  <p className="text-2xl font-bold">{stats.myQAPs}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Action Button - Only show for requestors */}
      {user?.role === 'requestor' && (
        <div className="mb-6">
          <Button onClick={handleCreateNew} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" />
            Create New QAP
          </Button>
        </div>
      )}

      {/* QAP Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {user?.role === 'requestor' ? 'Your QAPs' : 'QAPs for Review'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <QAPTable 
            qapData={accessibleQAPs} 
            onEdit={handleEdit}
            onView={handleView}
            onShare={handleShare}
            onDelete={handleDelete}
            showActions={user?.role === 'requestor'}
          />
        </CardContent>
      </Card>

      {/* Modals */}
      <EnhancedQAPModal
        isOpen={isQAPModalOpen}
        onClose={() => setIsQAPModalOpen(false)}
        editingQAP={selectedQAP}
        onSave={handleSave}
        nextSno={nextSno}
      />

      <EnhancedViewQAPModal
        qap={selectedQAP}
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
      />
    </div>
  );
};

export default Index;
