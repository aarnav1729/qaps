
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QAPFormData } from '@/types/qap';
import { X, Printer, Download } from 'lucide-react';

interface ViewQAPModalProps {
  isOpen: boolean;
  onClose: () => void;
  qap: QAPFormData | null;
}

const ViewQAPModal: React.FC<ViewQAPModalProps> = ({ isOpen, onClose, qap }) => {
  // Don't render if qap is null
  if (!qap) {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'submitted': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'edit-requested': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRowClassName = (item: any) => {
    if (item.match === 'yes') return 'bg-green-50 border-green-200';
    if (item.match === 'no') return 'bg-red-50 border-red-200';
    return 'bg-white border-gray-200';
  };

  const renderQAPTable = (data: any[], title: string) => {
    if (data.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3 text-gray-800">{title}</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300 text-xs">
            <thead>
              <tr className="bg-gradient-to-r from-gray-100 to-gray-200">
                <th className="border border-gray-300 p-2 text-left font-semibold">S.No</th>
                <th className="border border-gray-300 p-2 text-left font-semibold">Criteria</th>
                <th className="border border-gray-300 p-2 text-left font-semibold">Sub Criteria</th>
                {title === 'MQP Specifications' ? (
                  <>
                    <th className="border border-gray-300 p-2 text-left font-semibold">Component & Operation</th>
                    <th className="border border-gray-300 p-2 text-left font-semibold">Characteristics</th>
                    <th className="border border-gray-300 p-2 text-left font-semibold">Class</th>
                    <th className="border border-gray-300 p-2 text-left font-semibold">Type of Check</th>
                    <th className="border border-gray-300 p-2 text-left font-semibold">Sampling</th>
                    <th className="border border-gray-300 p-2 text-left font-semibold">Specification</th>
                  </>
                ) : (
                  <>
                    <th className="border border-gray-300 p-2 text-left font-semibold">Defect</th>
                    <th className="border border-gray-300 p-2 text-left font-semibold">Defect Class</th>
                    <th className="border border-gray-300 p-2 text-left font-semibold">Description</th>
                    <th className="border border-gray-300 p-2 text-left font-semibold">Criteria Limits</th>
                  </>
                )}
                <th className="border border-gray-300 p-2 text-left font-semibold">Match</th>
                <th className="border border-gray-300 p-2 text-left font-semibold">Customer Specification</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => (
                <tr key={index} className={`border-b ${getRowClassName(item)}`}>
                  <td className="border border-gray-300 p-2">{item.sno}</td>
                  <td className="border border-gray-300 p-2">
                    <Badge variant="outline" className="text-xs">
                      {item.criteria}
                    </Badge>
                  </td>
                  <td className="border border-gray-300 p-2">{item.subCriteria}</td>
                  {title === 'MQP Specifications' ? (
                    <>
                      <td className="border border-gray-300 p-2">{item.componentOperation}</td>
                      <td className="border border-gray-300 p-2">{item.characteristics}</td>
                      <td className="border border-gray-300 p-2">
                        <Badge variant={item.class === 'Critical' ? 'destructive' : 'default'} className="text-xs">
                          {item.class}
                        </Badge>
                      </td>
                      <td className="border border-gray-300 p-2">{item.typeOfCheck}</td>
                      <td className="border border-gray-300 p-2">{item.sampling}</td>
                      <td className="border border-gray-300 p-2">{item.specification}</td>
                    </>
                  ) : (
                    <>
                      <td className="border border-gray-300 p-2">{item.defect}</td>
                      <td className="border border-gray-300 p-2">
                        <Badge variant={item.defectClass === 'Critical' ? 'destructive' : 'default'} className="text-xs">
                          {item.defectClass}
                        </Badge>
                      </td>
                      <td className="border border-gray-300 p-2">{item.description}</td>
                      <td className="border border-gray-300 p-2">{item.criteriaLimits}</td>
                    </>
                  )}
                  <td className="border border-gray-300 p-2">
                    <Badge variant={item.match === 'yes' ? 'default' : item.match === 'no' ? 'destructive' : 'secondary'} className="text-xs">
                      {item.match || 'N/A'}
                    </Badge>
                  </td>
                  <td className="border border-gray-300 p-2">{item.customerSpecification || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const mqpData = qap.qaps.filter(q => q.criteria === 'MQP');
  const visualElData = qap.qaps.filter(q => q.criteria === 'Visual' || q.criteria === 'EL');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">
              View QAP - {qap.customerName}
            </DialogTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto p-6">
          {/* QAP Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 bg-blue-50 p-4 rounded-lg">
            <div>
              <label className="text-sm font-medium text-gray-600">Customer Name</label>
              <p className="text-lg font-semibold">{qap.customerName}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Project Name</label>
              <p className="text-lg font-semibold">{qap.projectName}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Order Quantity</label>
              <p className="text-lg font-semibold">{qap.orderQuantity}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Product Type</label>
              <p className="text-lg font-semibold">{qap.productType}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Plant</label>
              <p className="text-lg font-semibold">{qap.plant.toUpperCase()}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Status</label>
              <Badge className={`${getStatusColor(qap.status)} capitalize`}>
                {qap.status}
              </Badge>
            </div>
          </div>

          {qap.feedback && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="text-lg font-semibold mb-2 text-yellow-800">Feedback</h3>
              <p className="text-yellow-700">{qap.feedback}</p>
            </div>
          )}

          {/* QAP Tables */}
          {renderQAPTable(mqpData, 'MQP Specifications')}
          {renderQAPTable(visualElData, 'Visual & EL Specifications')}
        </div>
        
        <div className="p-6 pt-0 border-t">
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ViewQAPModal;
