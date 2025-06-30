
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QAPSpecification } from '@/data/qapSpecifications';
import { User } from 'lucide-react';

interface ViewQAPModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  qaps: QAPSpecification[];
}

const ViewQAPModal: React.FC<ViewQAPModalProps> = ({ isOpen, onClose, customerName, qaps }) => {
  const stats = {
    total: qaps.length,
    matched: qaps.filter(q => q.match === 'yes').length,
    custom: qaps.filter(q => q.match === 'no').length,
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 sm:p-6 pb-4 border-b bg-gradient-to-r from-green-600 to-emerald-600 text-white">
          <DialogTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2 sm:gap-3">
            <div className="w-8 sm:w-10 h-8 sm:h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <User className="w-4 sm:w-6 h-4 sm:h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate">{customerName} - QAP Details</div>
              <div className="text-xs sm:text-sm font-normal text-green-100 mt-1">
                {stats.total} specs • {stats.matched} matched • {stats.custom} custom
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300 text-xs sm:text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-gray-100 to-gray-200">
                  <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700">S.No</th>
                  <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700">Category</th>
                  <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700">Subcategory</th>
                  <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700">Characteristic</th>
                  <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700">Premier Specification</th>
                  <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700">Match</th>
                  <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700">Customer Specification</th>
                </tr>
              </thead>
              <tbody>
                {qaps.map((qap, index) => (
                  <tr 
                    key={`${qap.sno}-${index}`} 
                    className={`border-b transition-colors ${
                      qap.match === 'yes' ? 'bg-green-50' : qap.match === 'no' ? 'bg-red-50' : 'bg-white'
                    }`}
                  >
                    <td className="border border-gray-300 p-2 sm:p-3 font-medium">{qap.sno}</td>
                    <td className="border border-gray-300 p-2 sm:p-3">
                      <Badge variant="outline" className="bg-blue-100 text-blue-800 text-xs">
                        {qap.category}
                      </Badge>
                    </td>
                    <td className="border border-gray-300 p-2 sm:p-3 max-w-32 sm:max-w-48">
                      <div className="break-words">{qap.subCategory}</div>
                    </td>
                    <td className="border border-gray-300 p-2 sm:p-3 max-w-32 sm:max-w-48">
                      <div className="break-words">{qap.characteristic}</div>
                    </td>
                    <td className="border border-gray-300 p-2 sm:p-3 max-w-48 sm:max-w-64">
                      <div className="break-words font-medium text-gray-700">
                        {qap.premierSpecification}
                      </div>
                    </td>
                    <td className="border border-gray-300 p-2 sm:p-3">
                      {qap.match && (
                        <Badge 
                          variant={qap.match === 'yes' ? 'default' : 'destructive'}
                          className={`text-xs ${qap.match === 'yes' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                        >
                          {qap.match.toUpperCase()}
                        </Badge>
                      )}
                    </td>
                    <td className="border border-gray-300 p-2 sm:p-3 max-w-48 sm:max-w-sm">
                      <div 
                        className={`p-2 rounded break-words text-xs ${
                          qap.match === 'yes' 
                            ? 'bg-green-50 text-green-800 border border-green-200' 
                            : qap.match === 'no' 
                            ? 'bg-red-50 text-red-800 border border-red-200' 
                            : 'bg-gray-50'
                        }`}
                      >
                        {qap.customerSpecification || '-'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="p-4 sm:p-6 pt-0 border-t bg-gray-50">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="text-sm text-gray-600">
              <strong>{customerName}</strong> | 
              Total: <strong>{stats.total}</strong> | 
              Matched: <strong className="text-green-600">{stats.matched}</strong> | 
              Custom: <strong className="text-red-600">{stats.custom}</strong> |
              Match Rate: <strong>{stats.total > 0 ? Math.round((stats.matched / stats.total) * 100) : 0}%</strong>
            </div>
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ViewQAPModal;
