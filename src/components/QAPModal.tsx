
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { QAPSpecification, qapSpecifications } from '@/data/qapSpecifications';
import { X, Save, RotateCcw } from 'lucide-react';

interface QAPModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (qaps: QAPSpecification[]) => void;
  nextSno: number;
}

const QAPModal: React.FC<QAPModalProps> = ({ isOpen, onClose, onSave, nextSno }) => {
  const [formData, setFormData] = useState<QAPSpecification[]>(
    qapSpecifications.map((spec, index) => ({
      ...spec,
      sno: nextSno + index,
      match: undefined,
      customerSpecification: undefined
    }))
  );

  console.log('Modal form data:', formData);

  const handleMatchChange = (index: number, match: 'yes' | 'no') => {
    const newFormData = [...formData];
    newFormData[index] = {
      ...newFormData[index],
      match,
      customerSpecification: match === 'yes' ? newFormData[index].premierSpecification : ''
    };
    setFormData(newFormData);
    console.log('Updated item at index', index, ':', newFormData[index]);
  };

  const handleCustomerSpecChange = (index: number, value: string) => {
    const newFormData = [...formData];
    newFormData[index] = {
      ...newFormData[index],
      customerSpecification: value
    };
    setFormData(newFormData);
  };

  const handleSave = () => {
    console.log('Saving QAPs:', formData);
    onSave(formData);
    onClose();
  };

  const handleReset = () => {
    setFormData(
      qapSpecifications.map((spec, index) => ({
        ...spec,
        sno: nextSno + index,
        match: undefined,
        customerSpecification: undefined
      }))
    );
  };

  const getRowClassName = (item: QAPSpecification) => {
    if (item.match === 'yes') return 'bg-green-50 border-green-200';
    if (item.match === 'no') return 'bg-red-50 border-red-200';
    return 'bg-white border-gray-200';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                📋
              </div>
              New Customer QAP Processing
            </DialogTitle>
            <div className="flex gap-2">
              <Button onClick={handleReset} variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
              <Button onClick={onClose} variant="ghost" size="sm" className="text-white hover:bg-white/20">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto p-6">
          <div className="mb-4 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
            💡 <strong>Instructions:</strong> Select "Yes" if your customer specification matches the Premier Specification (it will auto-fill and highlight green). 
            Select "No" to enter a custom specification manually (will highlight red).
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gradient-to-r from-gray-100 to-gray-200">
                  <th className="border border-gray-300 p-3 text-left text-sm font-semibold text-gray-700 min-w-16">S.No</th>
                  <th className="border border-gray-300 p-3 text-left text-sm font-semibold text-gray-700 min-w-32">Category</th>
                  <th className="border border-gray-300 p-3 text-left text-sm font-semibold text-gray-700 min-w-48">Subcategory</th>
                  <th className="border border-gray-300 p-3 text-left text-sm font-semibold text-gray-700 min-w-48">Characteristic</th>
                  <th className="border border-gray-300 p-3 text-left text-sm font-semibold text-gray-700 min-w-64">Premier Specification</th>
                  <th className="border border-gray-300 p-3 text-left text-sm font-semibold text-gray-700 min-w-24">Match?</th>
                  <th className="border border-gray-300 p-3 text-left text-sm font-semibold text-gray-700 min-w-64">Customer Specification</th>
                </tr>
              </thead>
              <tbody>
                {formData.map((item, index) => (
                  <tr key={index} className={`border-b hover:bg-opacity-70 transition-colors ${getRowClassName(item)}`}>
                    <td className="border border-gray-300 p-3 text-sm font-medium text-gray-600">
                      {item.sno}
                    </td>
                    <td className="border border-gray-300 p-3 text-sm">
                      <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                        {item.category}
                      </Badge>
                    </td>
                    <td className="border border-gray-300 p-3 text-xs max-w-48">
                      <div className="break-words">
                        {item.subCategory}
                      </div>
                    </td>
                    <td className="border border-gray-300 p-3 text-xs max-w-48">
                      <div className="break-words">
                        {item.characteristic}
                      </div>
                    </td>
                    <td className="border border-gray-300 p-3 text-xs max-w-64">
                      <div className="break-words font-medium text-gray-700">
                        {item.premierSpecification}
                      </div>
                    </td>
                    <td className="border border-gray-300 p-3">
                      <Select
                        value={item.match || ''}
                        onValueChange={(value: 'yes' | 'no') => handleMatchChange(index, value)}
                      >
                        <SelectTrigger className="w-20 h-8 text-xs">
                          <SelectValue placeholder="?" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Yes</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="border border-gray-300 p-3">
                      <Input
                        value={item.customerSpecification || ''}
                        onChange={(e) => handleCustomerSpecChange(index, e.target.value)}
                        placeholder={item.match === 'no' ? 'Enter custom specification...' : 'Auto-filled from Premier Spec'}
                        disabled={item.match === 'yes'}
                        className={`text-xs ${
                          item.match === 'yes' 
                            ? 'bg-green-100 text-green-800 border-green-300' 
                            : item.match === 'no' 
                            ? 'bg-red-50 border-red-300' 
                            : 'bg-white'
                        }`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="p-6 pt-0 border-t bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Total Items: <strong>{formData.length}</strong> | 
              Processed: <strong>{formData.filter(item => item.match).length}</strong> | 
              Remaining: <strong>{formData.filter(item => !item.match).length}</strong>
            </div>
            <div className="flex gap-3">
              <Button onClick={onClose} variant="outline">
                Cancel
              </Button>
              <Button onClick={handleSave} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                <Save className="w-4 h-4 mr-2" />
                Save QAP Processing
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QAPModal;
