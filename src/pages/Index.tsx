
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import QAPTable from '@/components/QAPTable';
import QAPModal from '@/components/QAPModal';
import ViewQAPModal from '@/components/ViewQAPModal';
import { QAPFormData } from '@/types/qap';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, BarChart3, CheckCircle, XCircle, FileText, Users, Search, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const Index = () => {
  const { user } = useAuth();
  const [qapData, setQapData] = useState<QAPFormData[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [editingQAP, setEditingQAP] = useState<QAPFormData | null>(null);
  const [viewingQAP, setViewingQAP] = useState<QAPFormData | null>(null);
  
  // Filtering and search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  
  console.log('Current QAP Data state:', qapData);

  const handleSaveQAP = (newQAPData: QAPFormData) => {
    console.log('Saving new QAP:', newQAPData);
    
    if (editingQAP) {
      setQapData(prev => prev.map(qap => 
        qap.id === editingQAP.id ? newQAPData : qap
      ));
      setEditingQAP(null);
    } else {
      setQapData(prevData => [...prevData, newQAPData]);
    }
  };

  const handleView = (qap: QAPFormData) => {
    setViewingQAP(qap);
    setIsViewModalOpen(true);
  };

  const handleEdit = (qap: QAPFormData) => {
    if (qap.status === 'submitted' || qap.status === 'approved') {
      const reason = prompt('This QAP has been submitted/approved. Please provide a reason for editing:');
      if (!reason) return;
      
      const updatedQAP = { ...qap, status: 'edit-requested' as const, editReason: reason };
      setQapData(prev => prev.map(q => q.id === qap.id ? updatedQAP : q));
    }
    setEditingQAP(qap);
    setIsModalOpen(true);
  };

  const handleDelete = (qap: QAPFormData) => {
    if (qap.status !== 'draft') {
      alert('Only draft QAPs can be deleted');
      return;
    }
    
    if (confirm(`Are you sure you want to delete QAP for ${qap.customerName} - ${qap.projectName}?`)) {
      setQapData(prev => prev.filter(q => q.id !== qap.id));
    }
  };

  const handleShare = (qap: QAPFormData) => {
    if (qap.status !== 'submitted') {
      alert('Only submitted QAPs can be shared');
      return;
    }
    
    // Implementation for sharing QAP to approvers
    console.log('Sharing QAP to approvers:', qap);
    alert(`QAP shared with ${qap.plant.toUpperCase()} plant approvers`);
  };

  const nextSno = qapData.length > 0 
    ? Math.max(...qapData.flatMap(q => q.qaps.map(spec => spec.sno))) + 1 
    : 1;

  // Filter QAPs based on search and filters
  const filteredQAPs = qapData.filter(qap => {
    const matchesSearch = !searchTerm || 
      qap.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      qap.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      qap.productType.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || qap.status === statusFilter;
    const matchesCustomer = customerFilter === 'all' || qap.customerName === customerFilter;
    
    return matchesSearch && matchesStatus && matchesCustomer;
  });

  // Get unique customer names for filter
  const uniqueCustomers = Array.from(new Set(qapData.map(qap => qap.customerName)));

  // Calculate overall stats
  const stats = {
    total: qapData.length,
    draft: qapData.filter(q => q.status === 'draft').length,
    submitted: qapData.filter(q => q.status === 'submitted').length,
    approved: qapData.filter(q => q.status === 'approved').length,
    rejected: qapData.filter(q => q.status === 'rejected').length
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            My QAPs
          </h1>
          <p className="text-gray-600">
            Manage your Quality Assurance Process specifications
          </p>
        </div>
        
        {(user?.role === 'requestor' || user?.role === 'admin') && (
          <Button 
            onClick={() => setIsModalOpen(true)}
            size="lg"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            <Plus className="w-4 sm:w-5 h-4 sm:h-5 mr-2" />
            New QAP
          </Button>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 mb-6">
        <Card className="border-l-4 border-l-blue-500 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600 flex items-center gap-2">
              <FileText className="w-3 sm:w-4 h-3 sm:h-4" />
              <span className="hidden sm:inline">Total QAPs</span>
              <span className="sm:hidden">Total</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-blue-600">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-gray-500 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">Draft</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-gray-600">{stats.draft}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">Submitted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-yellow-600">{stats.submitted}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-green-600">{stats.approved}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-red-600">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by customer, project, or product..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Customer</label>
              <Select value={customerFilter} onValueChange={setCustomerFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {uniqueCustomers.map(customer => (
                    <SelectItem key={customer} value={customer}>{customer}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* QAP Table */}
      <QAPTable 
        qapData={filteredQAPs}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onShare={handleShare}
      />

      {/* QAP Modal */}
      <QAPModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingQAP(null);
        }}
        onSave={handleSaveQAP}
        nextSno={nextSno}
        editingQAP={editingQAP}
      />

      {/* View QAP Modal */}
      {viewingQAP && (
        <ViewQAPModal
          isOpen={isViewModalOpen}
          onClose={() => {
            setIsViewModalOpen(false);
            setViewingQAP(null);
          }}
          qap={viewingQAP}
        />
      )}
    </div>
  );
};

export default Index;
