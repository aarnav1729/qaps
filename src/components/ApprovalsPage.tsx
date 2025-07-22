
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QAPFormData } from '@/types/qap';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, Printer, MessageSquare, CheckCircle, XCircle, Search } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ApprovalsPageProps {
  qapData: QAPFormData[];
  onApprove: (id: string, feedback?: string) => void;
  onReject: (id: string, feedback: string) => void;
  onView: (qap: QAPFormData) => void;
}

const ApprovalsPage: React.FC<ApprovalsPageProps> = ({ qapData, onApprove, onReject, onView }) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQAP, setSelectedQAP] = useState<QAPFormData | null>(null);
  const [feedback, setFeedback] = useState('');
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');

  const getQAPsForApproval = () => {
    let filteredQAPs = qapData.filter(qap => 
      qap.status === 'submitted' && 
      (user?.role === 'admin' || qap.plant === user?.plant?.toLowerCase())
    );

    if (searchTerm) {
      filteredQAPs = filteredQAPs.filter(qap =>
        qap.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        qap.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        qap.submittedBy?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filteredQAPs;
  };

  const getApprovedQAPs = () => {
    return qapData.filter(qap => 
      qap.status === 'approved' && 
      (user?.role === 'admin' || qap.plant === user?.plant?.toLowerCase())
    );
  };

  const getRejectedQAPs = () => {
    return qapData.filter(qap => 
      qap.status === 'rejected' && 
      (user?.role === 'admin' || qap.plant === user?.plant?.toLowerCase())
    );
  };

  const handleReview = (qap: QAPFormData, action: 'approve' | 'reject') => {
    setSelectedQAP(qap);
    setReviewAction(action);
    setFeedback('');
    setIsReviewModalOpen(true);
  };

  const submitReview = () => {
    if (!selectedQAP) return;

    if (reviewAction === 'approve') {
      onApprove(selectedQAP.id, feedback);
    } else {
      if (!feedback.trim()) {
        alert('Please provide feedback for rejection');
        return;
      }
      onReject(selectedQAP.id, feedback);
    }

    setIsReviewModalOpen(false);
    setSelectedQAP(null);
    setFeedback('');
  };

  const printQAP = (qap: QAPFormData, type: 'all' | 'green' | 'red') => {
    console.log(`Printing QAP ${qap.id} with type: ${type}`);
    // Implementation for printing logic
  };

  const renderQAPTable = (qaps: QAPFormData[], showActions: boolean = true) => {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300 text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-gray-100 to-gray-200">
              <th className="border border-gray-300 p-3 text-left font-semibold">Customer</th>
              <th className="border border-gray-300 p-3 text-left font-semibold">Project</th>
              <th className="border border-gray-300 p-3 text-left font-semibold">Plant</th>
              <th className="border border-gray-300 p-3 text-left font-semibold">Quantity</th>
              <th className="border border-gray-300 p-3 text-left font-semibold">Product Type</th>
              <th className="border border-gray-300 p-3 text-left font-semibold">Submitted By</th>
              <th className="border border-gray-300 p-3 text-left font-semibold">Status</th>
              {showActions && <th className="border border-gray-300 p-3 text-center font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {qaps.map((qap) => (
              <tr key={qap.id} className="border-b hover:bg-gray-50">
                <td className="border border-gray-300 p-3">{qap.customerName}</td>
                <td className="border border-gray-300 p-3">{qap.projectName}</td>
                <td className="border border-gray-300 p-3">
                  <Badge variant="outline" className="bg-blue-100 text-blue-800">
                    {qap.plant.toUpperCase()}
                  </Badge>
                </td>
                <td className="border border-gray-300 p-3">{qap.orderQuantity}</td>
                <td className="border border-gray-300 p-3">{qap.productType}</td>
                <td className="border border-gray-300 p-3">{qap.submittedBy}</td>
                <td className="border border-gray-300 p-3">
                  <Badge 
                    variant={qap.status === 'approved' ? 'default' : qap.status === 'rejected' ? 'destructive' : 'secondary'}
                    className="capitalize"
                  >
                    {qap.status}
                  </Badge>
                </td>
                {showActions && (
                  <td className="border border-gray-300 p-3">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onView(qap)}
                        className="h-8 w-8 p-0 hover:bg-blue-100"
                        title="View QAP"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => printQAP(qap, 'all')}
                        className="h-8 w-8 p-0 hover:bg-gray-100"
                        title="Print All"
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      {qap.status === 'submitted' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReview(qap, 'approve')}
                            className="h-8 w-8 p-0 hover:bg-green-100 text-green-600"
                            title="Approve"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReview(qap, 'reject')}
                            className="h-8 w-8 p-0 hover:bg-red-100 text-red-600"
                            title="Reject"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">QAP Approvals</h1>
        <p className="text-gray-600">Review and approve QAP submissions</p>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by customer, project, or submitter..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending">
            Pending Approval ({getQAPsForApproval().length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({getApprovedQAPs().length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected ({getRejectedQAPs().length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Pending Approvals</CardTitle>
            </CardHeader>
            <CardContent>
              {getQAPsForApproval().length > 0 ? (
                renderQAPTable(getQAPsForApproval())
              ) : (
                <p className="text-center text-gray-500 py-8">No QAPs pending approval</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approved" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Approved QAPs</CardTitle>
            </CardHeader>
            <CardContent>
              {getApprovedQAPs().length > 0 ? (
                renderQAPTable(getApprovedQAPs(), false)
              ) : (
                <p className="text-center text-gray-500 py-8">No approved QAPs</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rejected" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Rejected QAPs</CardTitle>
            </CardHeader>
            <CardContent>
              {getRejectedQAPs().length > 0 ? (
                renderQAPTable(getRejectedQAPs(), false)
              ) : (
                <p className="text-center text-gray-500 py-8">No rejected QAPs</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Review Modal */}
      <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? 'Approve QAP' : 'Reject QAP'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">
                QAP for: <strong>{selectedQAP?.customerName}</strong> - <strong>{selectedQAP?.projectName}</strong>
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {reviewAction === 'approve' ? 'Feedback (Optional)' : 'Rejection Reason *'}
              </label>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={reviewAction === 'approve' ? 'Add any comments...' : 'Please provide reason for rejection...'}
                className="min-h-[100px]"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setIsReviewModalOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={submitReview}
                className={reviewAction === 'approve' ? 'bg-green-600 hover:bg-green-700 flex-1' : 'bg-red-600 hover:bg-red-700 flex-1'}
              >
                {reviewAction === 'approve' ? 'Approve' : 'Reject'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApprovalsPage;
