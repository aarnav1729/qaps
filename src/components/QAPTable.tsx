
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { QAPFormData } from '@/types/qap';
import { Eye, Edit, Trash2, Share, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface QAPTableProps {
  qapData: QAPFormData[];
  onView?: (qap: QAPFormData) => void;
  onEdit?: (qap: QAPFormData) => void;
  onDelete: (qap: QAPFormData) => void;
  onShare: (qap: QAPFormData) => void;
  showActions?: boolean;
}

const QAPTable: React.FC<QAPTableProps> = ({ 
  qapData, 
  onView, 
  onEdit, 
  onDelete, 
  onShare, 
  showActions = true 
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [qapToDelete, setQapToDelete] = useState<QAPFormData | null>(null);

  console.log('QAP Data in table:', qapData);

  if (qapData.length === 0) {
    return (
      <Card className="mt-6">
        <CardContent className="p-12 text-center">
          <div className="text-gray-500 text-lg">
            {user?.role === 'requestor' 
              ? 'No QAPs found. Click "+ New QAP" to get started!'
              : 'No QAPs available for review at this time.'
            }
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleView = (qap: QAPFormData) => {
    navigate(`/qap/${qap.id}`);
  };

  const handleEdit = (qap: QAPFormData) => {
    navigate(`/qap/${qap.id}`);
  };

  const handleDelete = (qap: QAPFormData) => {
    onDelete(qap);
    setQapToDelete(null);
  };

  const canEdit = (qap: QAPFormData) => {
    return user?.username === qap.submittedBy && ['draft', 'edit-requested'].includes(qap.status);
  };

  const canDelete = (qap: QAPFormData) => {
    return user?.username === qap.submittedBy && qap.status === 'draft';
  };

  const getActionButton = (qap: QAPFormData) => {
    // Check if user has pending action on this QAP
    const userPlants = user?.plant?.split(',').map(p => p.trim()) || [];
    const qapPlant = qap.plant.toLowerCase();
    
    switch (user?.role) {
      case 'production':
      case 'quality':
      case 'technical':
        if (qap.currentLevel === 2 && userPlants.includes(qapPlant)) {
          return (
            <Button
              onClick={() => navigate('/level2-review')}
              size="sm"
              className="bg-orange-600 hover:bg-orange-700"
            >
              <ArrowRight className="h-4 w-4 mr-1" />
              Review
            </Button>
          );
        }
        break;
      case 'head':
        if (qap.currentLevel === 3 && userPlants.includes(qapPlant)) {
          return (
            <Button
              onClick={() => navigate('/level3-review')}
              size="sm"
              className="bg-purple-600 hover:bg-purple-700"
            >
              <ArrowRight className="h-4 w-4 mr-1" />
              Review
            </Button>
          );
        }
        break;
      case 'technical-head':
        if (qap.currentLevel === 4) {
          return (
            <Button
              onClick={() => navigate('/level4-review')}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <ArrowRight className="h-4 w-4 mr-1" />
              Review
            </Button>
          );
        }
        break;
      case 'plant-head':
        if (qap.currentLevel === 5) {
          return (
            <Button
              onClick={() => navigate('/level5-approval')}
              size="sm"
              className="bg-green-600 hover:bg-green-700"
            >
              <ArrowRight className="h-4 w-4 mr-1" />
              Approve
            </Button>
          );
        }
        break;
      case 'requestor':
        if (qap.status === 'final-comments' && qap.submittedBy === user.username) {
          return (
            <Button
              onClick={() => navigate('/final-comments')}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <ArrowRight className="h-4 w-4 mr-1" />
              Add Comments
            </Button>
          );
        }
        break;
    }
    return null;
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      submitted: 'bg-yellow-100 text-yellow-800',
      'level-2': 'bg-orange-100 text-orange-800',
      'level-3': 'bg-purple-100 text-purple-800',
      'level-4': 'bg-indigo-100 text-indigo-800',
      'final-comments': 'bg-blue-100 text-blue-800',
      'level-5': 'bg-green-100 text-green-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      'edit-requested': 'bg-orange-100 text-orange-800'
    } as const;

    return (
      <Badge 
        className={`${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'} capitalize`}
      >
        {status.replace('-', ' ')}
      </Badge>
    );
  };

  return (
    <>
      <Card className="mt-6 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-800">
            QAPs ({qapData.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200">
                  <th className="p-3 text-left text-sm font-semibold text-gray-700 border-r border-blue-200">Customer</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700 border-r border-blue-200">Project</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700 border-r border-blue-200">Plant</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700 border-r border-blue-200">Product Type</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700 border-r border-blue-200">Quantity</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700 border-r border-blue-200">Items</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700 border-r border-blue-200">Status</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700 border-r border-blue-200">Submitted</th>
                  <th className="p-3 text-center text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {qapData.map((qap) => {
                  const matchedItems = qap.qaps.filter(q => q.match === 'yes').length;
                  const unmatchedItems = qap.qaps.filter(q => q.match === 'no').length;
                  const totalItems = qap.qaps.length;
                  
                  return (
                    <tr 
                      key={qap.id} 
                      className="border-b hover:bg-gray-50 transition-colors duration-200"
                    >
                      <td className="p-3 text-sm border-r border-gray-200 font-medium">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs">
                            {qap.customerName.charAt(0).toUpperCase()}
                          </div>
                          {qap.customerName}
                        </div>
                      </td>
                      <td className="p-3 text-sm border-r border-gray-200 font-medium">
                        {qap.projectName}
                      </td>
                      <td className="p-3 text-sm border-r border-gray-200">
                        <Badge variant="outline" className="bg-purple-50 text-purple-700">
                          {qap.plant.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm border-r border-gray-200">
                        <Badge variant="outline" className="bg-indigo-50 text-indigo-700">
                          {qap.productType}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm border-r border-gray-200">
                        {qap.orderQuantity.toLocaleString()}
                      </td>
                      <td className="p-3 text-sm border-r border-gray-200">
                        <div className="flex flex-col text-xs">
                          <span className="text-green-600">✓ {matchedItems} matched</span>
                          <span className="text-red-600">✗ {unmatchedItems} unmatched</span>
                          <span className="text-gray-500">Total: {totalItems}</span>
                        </div>
                      </td>
                      <td className="p-3 text-sm border-r border-gray-200">
                        {getStatusBadge(qap.status)}
                      </td>
                      <td className="p-3 text-sm border-r border-gray-200 text-gray-600">
                        {qap.submittedAt ? new Date(qap.submittedAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Priority action button */}
                          {getActionButton(qap)}
                          
                          {/* View button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleView(qap)}
                            className="h-8 w-8 p-0 hover:bg-blue-100 hover:text-blue-600"
                            title="View QAP"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {/* Edit button - only for owners */}
                          {canEdit(qap) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(qap)}
                              className="h-8 w-8 p-0 hover:bg-green-100 hover:text-green-600"
                              title="Edit QAP"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}

                          {/* Delete button - only for draft QAPs by owner */}
                          {canDelete(qap) && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
                                  title="Delete QAP"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete QAP</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this QAP for "{qap.customerName} - {qap.projectName}"? 
                                    This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(qap)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}

                          {/* Share button - only for submitted QAPs by owner */}
                          {qap.status !== 'draft' && qap.submittedBy === user?.username && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onShare(qap)}
                              className="h-8 w-8 p-0 hover:bg-purple-100 hover:text-purple-600"
                              title="Share QAP"
                            >
                              <Share className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default QAPTable;
