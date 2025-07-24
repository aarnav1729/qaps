
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { QAPFormData } from '@/types/qap';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, Search, CheckCircle, XCircle } from 'lucide-react';

interface Level5ApprovalPageProps {
  qapData: QAPFormData[];
  onApprove: (id: string, feedback?: string) => void;
  onReject: (id: string, feedback: string) => void;
}

const Level5ApprovalPage: React.FC<Level5ApprovalPageProps> = ({ qapData, onApprove, onReject }) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQAP, setSelectedQAP] = useState<QAPFormData | null>(null);
  const [feedback, setFeedback] = useState('');
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);

  const filteredQAPs = useMemo(() => {
    return qapData.filter(qap => {
      if (qap.status !== 'level-5') return false;
      
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          qap.customerName.toLowerCase().includes(searchLower) ||
          qap.projectName.toLowerCase().includes(searchLower) ||
          qap.submittedBy?.toLowerCase().includes(searchLower)
        );
      }
      
      return true;
    });
  }, [qapData, searchTerm]);

  const handleQAPSelect = (qap: QAPFormData) => {
    setSelectedQAP(qap);
    setFeedback('');
    setActionType(null);
  };

  const handleAction = (action: 'approve' | 'reject') => {
    setActionType(action);
  };

  const handleSubmit = () => {
    if (!selectedQAP || !actionType) return;
    
    if (actionType === 'approve') {
      onApprove(selectedQAP.id, feedback);
    } else {
      if (!feedback.trim()) {
        alert('Please provide feedback for rejection');
        return;
      }
      onReject(selectedQAP.id, feedback);
    }
    
    setSelectedQAP(null);
    setFeedback('');
    setActionType(null);
  };

  const getUnmatchedItems = () => {
    if (!selectedQAP) return [];
    return selectedQAP.qaps.filter(item => item.match === 'no');
  };

  if (selectedQAP) {
    const unmatchedItems = getUnmatchedItems();

    return (
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Plant Head Approval - Level 5</h1>
          <p className="text-gray-600">Final approval for QAP specifications</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>QAP Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Customer</label>
                <p className="font-semibold">{selectedQAP.customerName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Project</label>
                <p className="font-semibold">{selectedQAP.projectName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Plant</label>
                <Badge>{selectedQAP.plant.toUpperCase()}</Badge>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Submitted By</label>
                <p className="font-semibold">{selectedQAP.submittedBy}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Final Comments */}
        {selectedQAP.finalComments && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Final Comments from Requestor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-gray-800">{selectedQAP.finalComments}</p>
                <p className="text-sm text-gray-600 mt-2">
                  By: {selectedQAP.finalCommentsBy} at {selectedQAP.finalCommentsAt ? new Date(selectedQAP.finalCommentsAt).toLocaleString() : 'N/A'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Complete Review History */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Complete Review History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {unmatchedItems.map((item, index) => (
                <div key={item.sno} className="border border-gray-200 rounded-lg p-4">
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">S.No: {item.sno}</Badge>
                      <Badge variant="outline">{item.criteria}</Badge>
                    </div>
                    <h4 className="font-semibold">{item.subCriteria}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Premier Spec: {item.specification || item.criteriaLimits}
                    </p>
                    <p className="text-sm font-medium text-red-700 mt-1">
                      Customer Spec: {item.customerSpecification}
                    </p>
                  </div>

                  {/* All Review Comments */}
                  <div className="space-y-3">
                    {/* Level 2 Comments */}
                    {selectedQAP.levelResponses[2] && (
                      <div className="p-3 bg-blue-50 rounded border">
                        <h5 className="font-medium mb-2">Level 2 Comments:</h5>
                        {Object.entries(selectedQAP.levelResponses[2]).map(([role, response]) => (
                          <div key={role} className="mb-2">
                            <Badge variant="outline" className="mr-2">{role}</Badge>
                            <span className="text-sm">{response.comments[index] || 'No comment'}</span>
                            {response.respondedAt && (
                              <span className="text-xs text-gray-500 ml-2">
                                ({new Date(response.respondedAt).toLocaleString()})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Level 3 Comments */}
                    {selectedQAP.levelResponses[3] && (
                      <div className="p-3 bg-green-50 rounded border">
                        <h5 className="font-medium mb-2">Level 3 (Head) Comments:</h5>
                        {Object.entries(selectedQAP.levelResponses[3]).map(([role, response]) => (
                          <div key={role} className="mb-2">
                            <Badge variant="outline" className="mr-2">{role}</Badge>
                            <span className="text-sm">{response.comments[index] || 'No comment'}</span>
                            {response.respondedAt && (
                              <span className="text-xs text-gray-500 ml-2">
                                ({new Date(response.respondedAt).toLocaleString()})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Level 4 Comments */}
                    {selectedQAP.levelResponses[4] && (
                      <div className="p-3 bg-purple-50 rounded border">
                        <h5 className="font-medium mb-2">Level 4 (Technical Head) Comments:</h5>
                        {Object.entries(selectedQAP.levelResponses[4]).map(([role, response]) => (
                          <div key={role} className="mb-2">
                            <Badge variant="outline" className="mr-2">{role}</Badge>
                            <span className="text-sm">{response.comments[index] || 'No comment'}</span>
                            {response.respondedAt && (
                              <span className="text-xs text-gray-500 ml-2">
                                ({new Date(response.respondedAt).toLocaleString()})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Plant Head Decision */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Plant Head Decision</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4">
                <Button
                  onClick={() => handleAction('approve')}
                  variant={actionType === 'approve' ? 'default' : 'outline'}
                  className={actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve
                </Button>
                <Button
                  onClick={() => handleAction('reject')}
                  variant={actionType === 'reject' ? 'destructive' : 'outline'}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
              </div>

              {actionType && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {actionType === 'approve' ? 'Approval Comments (Optional)' : 'Rejection Reason (Required)'}
                  </label>
                  <Textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder={
                      actionType === 'approve' 
                        ? 'Add any final approval comments...' 
                        : 'Please provide reason for rejection...'
                    }
                    className="min-h-[100px]"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button onClick={() => setSelectedQAP(null)} variant="outline">
            Back to List
          </Button>
          {actionType && (
            <Button 
              onClick={handleSubmit}
              disabled={actionType === 'reject' && !feedback.trim()}
              className={
                actionType === 'approve' 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-red-600 hover:bg-red-700'
              }
            >
              {actionType === 'approve' ? 'Approve QAP' : 'Reject QAP'}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Plant Head Approval - Level 5</h1>
        <p className="text-gray-600">Final approval for QAP specifications</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>QAPs Pending Final Approval ({filteredQAPs.length})</CardTitle>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search QAPs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredQAPs.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No QAPs pending final approval</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 p-3 text-left">Customer</th>
                    <th className="border border-gray-300 p-3 text-left">Project</th>
                    <th className="border border-gray-300 p-3 text-left">Plant</th>
                    <th className="border border-gray-300 p-3 text-left">Submitted By</th>
                    <th className="border border-gray-300 p-3 text-left">Product Type</th>
                    <th className="border border-gray-300 p-3 text-left">Status</th>
                    <th className="border border-gray-300 p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQAPs.map(qap => (
                    <tr key={qap.id} className="hover:bg-gray-50">
                      <td className="border border-gray-300 p-3">{qap.customerName}</td>
                      <td className="border border-gray-300 p-3">{qap.projectName}</td>
                      <td className="border border-gray-300 p-3">
                        <Badge>{qap.plant.toUpperCase()}</Badge>
                      </td>
                      <td className="border border-gray-300 p-3">{qap.submittedBy}</td>
                      <td className="border border-gray-300 p-3">{qap.productType}</td>
                      <td className="border border-gray-300 p-3">
                        <Badge variant="secondary">{qap.status}</Badge>
                      </td>
                      <td className="border border-gray-300 p-3 text-center">
                        <Button
                          onClick={() => handleQAPSelect(qap)}
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Review & Approve
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Level5ApprovalPage;
