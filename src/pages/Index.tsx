
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import QAPTable from '@/components/QAPTable';
import QAPModal from '@/components/QAPModal';
import { QAPSpecification } from '@/data/qapSpecifications';
import { Plus, BarChart3, CheckCircle, XCircle, FileText } from 'lucide-react';

const Index = () => {
  const [qaps, setQaps] = useState<QAPSpecification[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  console.log('Current QAPs state:', qaps);

  const handleSaveQAPs = (newQaps: QAPSpecification[]) => {
    console.log('Saving new QAPs:', newQaps);
    setQaps(prevQaps => [...prevQaps, ...newQaps]);
  };

  const nextSno = qaps.length > 0 ? Math.max(...qaps.map(q => q.sno)) + 1 : 1;

  const stats = {
    total: qaps.length,
    matched: qaps.filter(q => q.match === 'yes').length,
    custom: qaps.filter(q => q.match === 'no').length,
    pending: qaps.filter(q => !q.match).length
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

          <Card className="border-l-4 border-l-yellow-500 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Match Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">
                {stats.total > 0 ? Math.round((stats.matched / stats.total) * 100) : 0}%
              </div>
              <p className="text-xs text-gray-500 mt-1">Premier spec compliance</p>
            </CardContent>
          </Card>
        </div>

        {/* QAP Table */}
        <QAPTable qaps={qaps} />

        {/* QAP Modal */}
        <QAPModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveQAPs}
          nextSno={nextSno}
        />
      </div>
    </div>
  );
};

export default Index;
