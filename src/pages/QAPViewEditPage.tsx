
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { QAPFormData, QAPSpecification } from '@/types/qap';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Save, Search, Filter, Edit3, Eye, ArrowRight } from 'lucide-react';

interface QAPViewEditPageProps {
  qapData: QAPFormData[];
  onSave: (qapData: QAPFormData) => void;
  onSubmit?: (qapData: QAPFormData) => void;
}

const QAPViewEditPage: React.FC<QAPViewEditPageProps> = ({ qapData, onSave, onSubmit }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const qap = qapData.find(q => q.id === id);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, visual, mqp
  const [filterMatch, setFilterMatch] = useState('all'); // all, matched, unmatched
  const [editedQAP, setEditedQAP] = useState<QAPFormData | null>(null);

  // Move useMemo hook before any conditional returns
  const filteredItems = useMemo(() => {
    if (!editedQAP) return [];
    
    let filtered = editedQAP.qaps.filter(item => {
      // Filter by type
      if (filterType === 'visual') {
        const isVisual = item.criteria?.toLowerCase().includes('visual') || 
                         item.characteristics?.toLowerCase().includes('visual') ||
                         item.typeOfCheck?.toLowerCase().includes('visual');
        if (!isVisual) return false;
      }
      if (filterType === 'mqp') {
        const isMQP = item.criteria?.toLowerCase().includes('mqp') || 
                      item.characteristics?.toLowerCase().includes('mqp') ||
                      item.defect?.toLowerCase().includes('mqp');
        if (!isMQP) return false;
      }

      // Filter by match
      if (filterMatch === 'matched' && item.match !== 'yes') return false;
      if (filterMatch === 'unmatched' && item.match !== 'no') return false;

      // Filter by search term
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          item.criteria?.toLowerCase().includes(searchLower) ||
          item.subCriteria?.toLowerCase().includes(searchLower) ||
          item.componentOperation?.toLowerCase().includes(searchLower) ||
          item.characteristics?.toLowerCase().includes(searchLower) ||
          item.defect?.toLowerCase().includes(searchLower) ||
          item.description?.toLowerCase().includes(searchLower)
        );
      }
      
      return true;
    });

    return filtered.sort((a, b) => a.sno - b.sno);
  }, [editedQAP, searchTerm, filterType, filterMatch]);

  React.useEffect(() => {
    if (qap) {
      setEditedQAP({ ...qap });
    }
  }, [qap]);

  // Now handle the conditional returns after all hooks
  if (!qap || !editedQAP) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">QAP Not Found</h1>
          <Button onClick={() => navigate('/')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const canEdit = user?.username === qap.submittedBy && ['draft', 'edit-requested'].includes(qap.status);
  const canSubmit = user?.username === qap.submittedBy && qap.status === 'draft' && onSubmit;

  const handleSave = () => {
    if (editedQAP) {
      onSave(editedQAP);
      setIsEditing(false);
    }
  };

  const handleSubmit = () => {
    if (editedQAP && onSubmit) {
      onSubmit(editedQAP);
      navigate('/');
    }
  };

  const handleItemChange = (index: number, field: keyof QAPSpecification, value: any) => {
    if (!editedQAP) return;
    
    const updatedQAPs = [...editedQAP.qaps];
    const itemIndex = updatedQAPs.findIndex(item => item.sno === filteredItems[index].sno);
    
    if (itemIndex >= 0) {
      updatedQAPs[itemIndex] = { ...updatedQAPs[itemIndex], [field]: value };
      setEditedQAP({ ...editedQAP, qaps: updatedQAPs });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'submitted': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const getRowClassName = (item: QAPSpecification) => {
    if (item.match === 'yes') return 'bg-green-50 border-green-200';
    if (item.match === 'no') return 'bg-red-50 border-red-200';
    return 'bg-white border-gray-200';
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditing ? 'Edit QAP' : 'View QAP'} - {qap.customerName}
            </h1>
            <p className="text-gray-600">{qap.projectName}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <>
              {isEditing ? (
                <Button onClick={handleSave}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              ) : (
                <Button onClick={() => setIsEditing(true)}>
                  <Edit3 className="mr-2 h-4 w-4" />
                  Edit QAP
                </Button>
              )}
            </>
          )}
          {canSubmit && (
            <Button onClick={handleSubmit} className="bg-green-600 hover:bg-green-700">
              <ArrowRight className="mr-2 h-4 w-4" />
              Submit for Review
            </Button>
          )}
        </div>
      </div>

      {/* QAP Information */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>QAP Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600">Customer Name</label>
              <p className="text-lg font-semibold">{editedQAP.customerName}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Project Name</label>
              <p className="text-lg font-semibold">{editedQAP.projectName}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Order Quantity</label>
              <p className="text-lg font-semibold">{editedQAP.orderQuantity.toLocaleString()}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Product Type</label>
              <p className="text-lg font-semibold">{editedQAP.productType}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Plant</label>
              <p className="text-lg font-semibold">{editedQAP.plant.toUpperCase()}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Status</label>
              <Badge className={`${getStatusColor(editedQAP.status)} capitalize`}>
                {editedQAP.status.replace('-', ' ')}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="visual">Visual Only</SelectItem>
                <SelectItem value="mqp">MQP Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterMatch} onValueChange={setFilterMatch}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                <SelectItem value="matched">Matched Only</SelectItem>
                <SelectItem value="unmatched">Unmatched Only</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-sm text-gray-600 flex items-center">
              {filteredItems.length} of {editedQAP.qaps.length} items
            </div>
          </div>
        </CardContent>
      </Card>

      {/* QAP Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>QAP Specifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300 text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-gray-100 to-gray-200">
                  <th className="border border-gray-300 p-2 text-left font-semibold">S.No</th>
                  <th className="border border-gray-300 p-2 text-left font-semibold">Criteria</th>
                  <th className="border border-gray-300 p-2 text-left font-semibold">Sub Criteria</th>
                  <th className="border border-gray-300 p-2 text-left font-semibold">Component & Operation</th>
                  <th className="border border-gray-300 p-2 text-left font-semibold">Characteristics</th>
                  <th className="border border-gray-300 p-2 text-left font-semibold">Class</th>
                  <th className="border border-gray-300 p-2 text-left font-semibold">Type of Check</th>
                  <th className="border border-gray-300 p-2 text-left font-semibold">Sampling</th>
                  <th className="border border-gray-300 p-2 text-left font-semibold">Specification</th>
                  <th className="border border-gray-300 p-2 text-left font-semibold">Defect</th>
                  <th className="border border-gray-300 p-2 text-left font-semibold">Defect Class</th>
                  <th className="border border-gray-300 p-2 text-left font-semibold">Description</th>
                  <th className="border border-gray-300 p-2 text-left font-semibold">Match</th>
                  <th className="border border-gray-300 p-2 text-left font-semibold">Customer Specification</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, index) => (
                  <tr key={item.sno} className={`border-b ${getRowClassName(item)}`}>
                    <td className="border border-gray-300 p-2">{item.sno}</td>
                    <td className="border border-gray-300 p-2">
                      <Badge variant="outline" className="text-xs">
                        {item.criteria}
                      </Badge>
                    </td>
                    <td className="border border-gray-300 p-2">{item.subCriteria || '-'}</td>
                    <td className="border border-gray-300 p-2">{item.componentOperation || '-'}</td>
                    <td className="border border-gray-300 p-2">{item.characteristics || '-'}</td>
                    <td className="border border-gray-300 p-2">
                      <Badge variant={item.class === 'Critical' ? 'destructive' : 'default'} className="text-xs">
                        {item.class || '-'}
                      </Badge>
                    </td>
                    <td className="border border-gray-300 p-2">{item.typeOfCheck || '-'}</td>
                    <td className="border border-gray-300 p-2">{item.sampling || '-'}</td>
                    <td className="border border-gray-300 p-2">{item.specification || '-'}</td>
                    <td className="border border-gray-300 p-2">{item.defect || '-'}</td>
                    <td className="border border-gray-300 p-2">
                      <Badge variant={item.defectClass === 'Critical' ? 'destructive' : 'default'} className="text-xs">
                        {item.defectClass || '-'}
                      </Badge>
                    </td>
                    <td className="border border-gray-300 p-2">{item.description || '-'}</td>
                    <td className="border border-gray-300 p-2">
                      {isEditing && canEdit ? (
                        <Select 
                          value={item.match || ''} 
                          onValueChange={(value) => handleItemChange(index, 'match', value)}
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="yes">Yes</SelectItem>
                            <SelectItem value="no">No</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={item.match === 'yes' ? 'default' : item.match === 'no' ? 'destructive' : 'secondary'} className="text-xs">
                          {item.match || 'N/A'}
                        </Badge>
                      )}
                    </td>
                    <td className="border border-gray-300 p-2">
                      {isEditing && canEdit ? (
                        <Textarea
                          value={item.customerSpecification || ''}
                          onChange={(e) => handleItemChange(index, 'customerSpecification', e.target.value)}
                          className="min-h-[60px] text-xs"
                          placeholder="Enter customer specification..."
                        />
                      ) : (
                        <span>{item.customerSpecification || '-'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QAPViewEditPage;
