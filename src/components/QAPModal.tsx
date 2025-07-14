
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QAPSpecification, mqpSpecifications, visualElSpecifications } from '@/data/qapSpecifications';
import { Save, RotateCcw } from 'lucide-react';

interface QAPModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (qaps: QAPSpecification[], customerName: string) => void;
  nextSno: number;
  editingQAP?: { qaps: QAPSpecification[]; customerName: string } | null;
}

const QAPModal: React.FC<QAPModalProps> = ({ isOpen, onClose, onSave, nextSno, editingQAP }) => {
  const [customerName, setCustomerName] = useState(editingQAP?.customerName || '');
  const [mqpData, setMqpData] = useState<QAPSpecification[]>(
    editingQAP?.qaps.filter(q => q.criteria === 'MQP') || 
    mqpSpecifications.map((spec, index) => ({
      ...spec,
      sno: nextSno + index,
      match: undefined,
      customerSpecification: undefined
    }))
  );
  const [visualElData, setVisualElData] = useState<QAPSpecification[]>(
    editingQAP?.qaps.filter(q => q.criteria === 'Visual' || q.criteria === 'EL') || 
    visualElSpecifications.map((spec, index) => ({
      ...spec,
      sno: nextSno + mqpSpecifications.length + index,
      match: undefined,
      customerSpecification: undefined
    }))
  );

  const handleMatchChange = (section: 'mqp' | 'visual', index: number, match: 'yes' | 'no') => {
    const updateSection = section === 'mqp' ? setMqpData : setVisualElData;
    const currentData = section === 'mqp' ? mqpData : visualElData;
    
    const newData = [...currentData];
    const spec = newData[index];
    const premierSpec = spec.specification || spec.criteriaLimits || '';
    
    newData[index] = {
      ...spec,
      match,
      customerSpecification: match === 'yes' ? premierSpec : ''
    };
    updateSection(newData);
  };

  const handleCustomerSpecChange = (section: 'mqp' | 'visual', index: number, value: string) => {
    const updateSection = section === 'mqp' ? setMqpData : setVisualElData;
    const currentData = section === 'mqp' ? mqpData : visualElData;
    
    const newData = [...currentData];
    newData[index] = {
      ...newData[index],
      customerSpecification: value
    };
    updateSection(newData);
  };

  const handleSave = () => {
    if (!customerName.trim()) {
      alert('Please enter customer name');
      return;
    }
    
    const allData = [...mqpData, ...visualElData];
    onSave(allData, customerName);
    onClose();
    
    // Reset form
    setCustomerName('');
    setMqpData(mqpSpecifications.map((spec, index) => ({
      ...spec,
      sno: nextSno + index,
      match: undefined,
      customerSpecification: undefined
    })));
    setVisualElData(visualElSpecifications.map((spec, index) => ({
      ...spec,
      sno: nextSno + mqpSpecifications.length + index,
      match: undefined,
      customerSpecification: undefined
    })));
  };

  const handleReset = () => {
    setCustomerName(editingQAP?.customerName || '');
    setMqpData(
      editingQAP?.qaps.filter(q => q.criteria === 'MQP') || 
      mqpSpecifications.map((spec, index) => ({
        ...spec,
        sno: nextSno + index,
        match: undefined,
        customerSpecification: undefined
      }))
    );
    setVisualElData(
      editingQAP?.qaps.filter(q => q.criteria === 'Visual' || q.criteria === 'EL') || 
      visualElSpecifications.map((spec, index) => ({
        ...spec,
        sno: nextSno + mqpSpecifications.length + index,
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

  const renderMQPTable = () => {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300 text-xs sm:text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-gray-100 to-gray-200">
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-12">S.No</th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-20">Criteria</th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-24">Sub Criteria</th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-32">Component & Operation</th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-32">Characteristics</th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-20">Class</th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-24">Type of Check</th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-24">Sampling</th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-48">Specification</th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-20">Match?</th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-48">Customer Specification</th>
            </tr>
          </thead>
          <tbody>
            {mqpData.map((item, index) => (
              <tr key={index} className={`border-b hover:bg-opacity-70 transition-colors ${getRowClassName(item)}`}>
                <td className="border border-gray-300 p-2 sm:p-3 font-medium text-gray-600">{item.sno}</td>
                <td className="border border-gray-300 p-2 sm:p-3">
                  <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 text-xs">
                    {item.criteria}
                  </Badge>
                </td>
                <td className="border border-gray-300 p-2 sm:p-3 max-w-24 break-words">{item.subCriteria}</td>
                <td className="border border-gray-300 p-2 sm:p-3 max-w-32 break-words">{item.componentOperation}</td>
                <td className="border border-gray-300 p-2 sm:p-3 max-w-32 break-words">{item.characteristics}</td>
                <td className="border border-gray-300 p-2 sm:p-3">
                  <Badge variant={item.class === 'Critical' ? 'destructive' : item.class === 'Major' ? 'default' : 'secondary'} className="text-xs">
                    {item.class}
                  </Badge>
                </td>
                <td className="border border-gray-300 p-2 sm:p-3 max-w-24 break-words text-xs">{item.typeOfCheck}</td>
                <td className="border border-gray-300 p-2 sm:p-3 max-w-24 break-words text-xs">{item.sampling}</td>
                <td className="border border-gray-300 p-2 sm:p-3 max-w-48 break-words font-medium text-gray-700 text-xs">{item.specification}</td>
                <td className="border border-gray-300 p-2 sm:p-3">
                  <Select
                    value={item.match || ''}
                    onValueChange={(value: 'yes' | 'no') => handleMatchChange('mqp', index, value)}
                  >
                    <SelectTrigger className="w-16 sm:w-20 h-8">
                      <SelectValue placeholder="?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="border border-gray-300 p-2 sm:p-3">
                  <Input
                    value={item.customerSpecification || ''}
                    onChange={(e) => handleCustomerSpecChange('mqp', index, e.target.value)}
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
    );
  };

  const renderVisualElTable = () => {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300 text-xs sm:text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-gray-100 to-gray-200">
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-12">S.No</th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-20">Criteria</th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-24">Sub-Criteria</th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-32">Defect</th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-20">Defect Class</th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-48">Description</th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-48">Criteria Limits</th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-20">Match?</th>
              <th className="border border-gray-300 p-2 sm:p-3 text-left font-semibold text-gray-700 min-w-48">Customer Specification</th>
            </tr>
          </thead>
          <tbody>
            {visualElData.map((item, index) => (
              <tr key={index} className={`border-b hover:bg-opacity-70 transition-colors ${getRowClassName(item)}`}>
                <td className="border border-gray-300 p-2 sm:p-3 font-medium text-gray-600">{item.sno}</td>
                <td className="border border-gray-300 p-2 sm:p-3">
                  <Badge variant="outline" className={`text-xs ${item.criteria === 'Visual' ? 'bg-purple-100 text-purple-800 border-purple-300' : 'bg-orange-100 text-orange-800 border-orange-300'}`}>
                    {item.criteria}
                  </Badge>
                </td>
                <td className="border border-gray-300 p-2 sm:p-3 max-w-24 break-words">{item.subCriteria}</td>
                <td className="border border-gray-300 p-2 sm:p-3 max-w-32 break-words">{item.defect}</td>
                <td className="border border-gray-300 p-2 sm:p-3">
                  <Badge variant={item.defectClass === 'Critical' ? 'destructive' : item.defectClass === 'Major' ? 'default' : 'secondary'} className="text-xs">
                    {item.defectClass}
                  </Badge>
                </td>
                <td className="border border-gray-300 p-2 sm:p-3 max-w-48 break-words text-xs">{item.description}</td>
                <td className="border border-gray-300 p-2 sm:p-3 max-w-48 break-words font-medium text-gray-700 text-xs">{item.criteriaLimits}</td>
                <td className="border border-gray-300 p-2 sm:p-3">
                  <Select
                    value={item.match || ''}
                    onValueChange={(value: 'yes' | 'no') => handleMatchChange('visual', index, value)}
                  >
                    <SelectTrigger className="w-16 sm:w-20 h-8">
                      <SelectValue placeholder="?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="border border-gray-300 p-2 sm:p-3">
                  <Input
                    value={item.customerSpecification || ''}
                    onChange={(e) => handleCustomerSpecChange('visual', index, e.target.value)}
                    placeholder={item.match === 'no' ? 'Enter custom specification...' : 'Auto-filled from Criteria Limits'}
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
    );
  };

  const totalItems = mqpData.length + visualElData.length;
  const processedItems = [...mqpData, ...visualElData].filter(item => item.match).length;
  const remainingItems = totalItems - processedItems;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 sm:p-6 pb-4 border-b bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-lg">
                📋
              </div>
              <span className="hidden sm:inline">
                {editingQAP ? 'Edit Customer QAP' : 'New Customer QAP Processing'}
              </span>
              <span className="sm:hidden">
                {editingQAP ? 'Edit QAP' : 'New QAP'}
              </span>
            </DialogTitle>
            <Button 
              onClick={handleReset} 
              variant="outline" 
              size="sm" 
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <RotateCcw className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {/* Customer Name Input */}
          <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
            <Label htmlFor="customerName" className="text-sm font-medium text-gray-700 mb-2 block">
              Customer Name *
            </Label>
            <Input
              id="customerName"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter customer name..."
              className="w-full sm:max-w-md"
              required
            />
          </div>

          <div className="mb-4 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
            💡 <strong>Instructions:</strong> Select "Yes" if your customer specification matches the Premier Specification/Criteria Limits (it will auto-fill and highlight green). 
            Select "No" to enter a custom specification manually (will highlight red).
          </div>

          <Tabs defaultValue="mqp" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="mqp" className="flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-100 text-blue-800 text-xs">MQP</Badge>
                ({mqpData.length} items)
              </TabsTrigger>
              <TabsTrigger value="visual-el" className="flex items-center gap-2">
                <Badge variant="outline" className="bg-purple-100 text-purple-800 text-xs">Visual & EL</Badge>
                ({visualElData.length} items)
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="mqp" className="mt-0">
              {renderMQPTable()}
            </TabsContent>
            
            <TabsContent value="visual-el" className="mt-0">
              {renderVisualElTable()}
            </TabsContent>
          </Tabs>
        </div>
        
        <div className="p-4 sm:p-6 pt-0 border-t bg-gray-50">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="text-sm text-gray-600">
              Total Items: <strong>{totalItems}</strong> | 
              Processed: <strong>{processedItems}</strong> | 
              Remaining: <strong>{remainingItems}</strong>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <Button onClick={onClose} variant="outline" className="flex-1 sm:flex-none">
                Cancel
              </Button>
              <Button onClick={handleSave} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 flex-1 sm:flex-none">
                <Save className="w-4 h-4 mr-2" />
                {editingQAP ? 'Update QAP' : 'Save QAP'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QAPModal;
