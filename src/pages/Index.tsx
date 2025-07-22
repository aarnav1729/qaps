import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, FileText, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import QAPModal from '../components/QAPModal';
import QAPTable from '../components/QAPTable';
import ViewQAPModal from '../components/ViewQAPModal';
import { QAPFormData } from '@/types/qap';
import { useAuth } from '@/contexts/AuthContext';

interface IndexProps {
  qapData: QAPFormData[];
  onSaveQAP: (qap: QAPFormData) => void;
  onSubmitQAP: (qap: QAPFormData) => void;
}

const Index: React.FC<IndexProps> = ({ qapData, onSaveQAP, onSubmitQAP }) => {
  const { user } = useAuth();
  const [isQAPModalOpen, setIsQAPModalOpen] = useState(false);
  const [selectedQAP, setSelectedQAP] = useState<QAPFormData | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [nextSno, setNextSno] = useState(1);
  const [draftData, setDraftData] = useState<Partial<QAPFormData>>({});
  
  // Filter QAPs for current user
  const userQAPs = qapData.filter(qap => qap.submittedBy === user?.username || qap.status === 'draft');
  
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
    // Submit QAP for approval
    onSubmitQAP(qap);
  };

  const handleSave = (qapData: QAPFormData) => {
    console.log('Handling save in Index:', qapData);
    onSaveQAP(qapData);
    setIsQAPModalOpen(false);
    // Clear draft data after successful save
    localStorage.removeItem('qapDraft');
    setDraftData({});
  };

  const handleSubmit = (qapData: QAPFormData) => {
    console.log('Handling submit in Index:', qapData);
    onSubmitQAP(qapData);
    setIsQAPModalOpen(false);
    // Clear draft data after successful submit
    localStorage.removeItem('qapDraft');
    setDraftData({});
  };

  // Stats for dashboard
  const stats = {
    total: userQAPs.length,
    draft: userQAPs.filter(q => q.status === 'draft').length,
    submitted: userQAPs.filter(q => q.status === 'submitted').length,
    approved: userQAPs.filter(q => q.status === 'approved').length,
    rejected: userQAPs.filter(q => q.status === 'rejected').length,
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          QAP Management System
        </h1>
        <p className="text-gray-600">Create and manage Quality Assurance Plans</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
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
                <p className="text-sm font-medium text-gray-600">Submitted</p>
                <p className="text-2xl font-bold">{stats.submitted}</p>
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
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Rejected</p>
                <p className="text-2xl font-bold">{stats.rejected}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Button */}
      <div className="mb-6">
        <Button onClick={handleCreateNew} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" />
          Create New QAP
        </Button>
      </div>

      {/* QAP Table */}
      <Card>
        <CardHeader>
          <CardTitle>Your QAPs</CardTitle>
        </CardHeader>
        <CardContent>
          <QAPTable 
            qapData={userQAPs} 
            onEdit={handleEdit}
            onView={handleView}
            onShare={handleShare}
            onDelete={() => {}} // Add empty function for now
          />
        </CardContent>
      </Card>

      {/* Modals */}
      <QAPModal
        isOpen={isQAPModalOpen}
        onClose={() => setIsQAPModalOpen(false)}
        editingQAP={selectedQAP}
        onSave={handleSave}
        onSubmit={handleSubmit}
        nextSno={nextSno}
        draftData={draftData}
      />

      <ViewQAPModal
        qap={selectedQAP}
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
      />
    </div>
  );
};

export default Index;
