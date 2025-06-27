
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import QAPTable from '@/components/QAPTable';
import QAPModal from '@/components/QAPModal';
import ViewQAPModal from '@/components/ViewQAPModal';
import { QAPSpecification } from '@/data/qapSpecifications';
import { Plus, BarChart3, CheckCircle, XCircle, FileText, Users } from 'lucide-react';

interface QAPGroup {
  customerName: string;
  qaps: QAPSpecification[];
  id: string;
}

const Index = () => {
  const [qapGroups, setQapGroups] = useState<QAPGroup[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<QAPGroup | null>(null);
  const [viewingGroup, setViewingGroup] = useState<QAPGroup | null>(null);

  console.log('Current QAP Groups state:', qapGroups);

  const handleSaveQAPs = (newQaps: QAPSpecification[], customerName: string) => {
    console.log('Saving new QAPs:', newQaps, 'Customer:', customerName);
    
    if (editingGroup) {
      // Update existing group
      setQapGroups(prev => prev.map(group => 
        group.id === editingGroup.id 
          ? { ...group, customerName, qaps: newQaps }
          : group
      ));
      setEditingGroup(null);
    } else {
      // Add new group
      const newGroup: QAPGroup = {
        id: Date.now().toString(),
        customerName,
        qaps: newQaps
      };
      setQapGroups(prevGroups => [...prevGroups, newGroup]);
    }
  };

  const handleView = (group: QAPGroup) => {
    setViewingGroup(group);
    setIsViewModalOpen(true);
  };

  const handleEdit = (group: QAPGroup) => {
    setEditingGroup(group);
    setIsModalOpen(true);
  };

  const handleDelete = (group: QAPGroup) => {
    if (confirm(`Are you sure you want to delete QAPs for ${group.customerName}?`)) {
      setQapGroups(prev => prev.filter(g => g.id !== group.id));
    }
  };

  const nextSno = qapGroups.length > 0 
    ? Math.max(...qapGroups.flatMap(g => g.qaps.map(q => q.sno))) + 1 
    : 1;

  // Calculate overall stats
  const allQaps = qapGroups.flatMap(g => g.qaps);
  const stats = {
    customers: qapGroups.length,
    total: allQaps.length,
    matched: allQaps.filter(q => q.match === 'yes').length,
    custom: allQaps.filter(q => q.match === 'no').length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  📊
                </div>
                QAP Management System
              </h1>
              <p className="text-blue-100 text-lg">
                Streamline your Quality Assurance Process with intelligent specification matching
              </p>
            </div>
            <Button 
              onClick={() => setIsModalOpen(true)}
              size="lg"
              className="bg-white text-blue-600 hover:bg-blue-50 font-semibold px-6 py-3 shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Plus className="w-5 h-5 mr-2" />
              + New QAP
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-l-4 border-l-purple-500 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Total Customers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">{stats.customers}</div>
              <p className="text-xs text-gray-500 mt-1">Active customers</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Total QAPs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
              <p className="text-xs text-gray-500 mt-1">Processed specifications</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Matched Specs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats.matched}</div>
              <p className="text-xs text-gray-500 mt-1">Auto-matched to Premier</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                Custom Specs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{stats.custom}</div>
              <p className="text-xs text-gray-500 mt-1">Custom specifications</p>
            </CardContent>
          </Card>
        </div>

        {/* QAP Table */}
        <QAPTable 
          qapGroups={qapGroups} 
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />

        {/* QAP Modal */}
        <QAPModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingGroup(null);
          }}
          onSave={handleSaveQAPs}
          nextSno={nextSno}
          editingQAP={editingGroup ? { qaps: editingGroup.qaps, customerName: editingGroup.customerName } : null}
        />

        {/* View QAP Modal */}
        {viewingGroup && (
          <ViewQAPModal
            isOpen={isViewModalOpen}
            onClose={() => {
              setIsViewModalOpen(false);
              setViewingGroup(null);
            }}
            customerName={viewingGroup.customerName}
            qaps={viewingGroup.qaps}
          />
        )}
      </div>
    </div>
  );
};

export default Index;
