import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QAPSpecification, QAPFormData } from '@/types/qap';
import { mqpSpecifications, visualElSpecifications } from '@/data/qapSpecifications';
import { useAuth } from '@/contexts/AuthContext';
import { Save, RotateCcw, Send } from 'lucide-react';

interface QAPModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (qapData: QAPFormData) => void;
  nextSno: number;
  editingQAP?: QAPFormData | null;
}

const QAPModal: React.FC<QAPModalProps> = ({ isOpen, onClose, onSave, nextSno, editingQAP }) => {
  const { user } = useAuth();
  
  // Form fields
  const [customerName, setCustomerName] = useState(editingQAP?.customerName || '');
  const [projectName, setProjectName] = useState(editingQAP?.projectName || '');
  const [orderQuantity, setOrderQuantity] = useState(editingQAP?.orderQuantity || 0);
  const [productType, setProductType] = useState(editingQAP?.productType || '');
  const [plant, setPlant] = useState(editingQAP?.plant || '');
  
  // Custom dropdown options
  const [customerOptions, setCustomerOptions] = useState(['akanksha', 'praful', 'yamini', 'jmr', 'cmk']);
  const [productOptions, setProductOptions] = useState(['perc', 'monoperc', 'g12r']);
  const [plantOptions, setPlantOptions] = useState(['p2', 'p4']);
  
  // QAP data
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

  const addCustomOption = (type: 'customer' | 'product' | 'plant', value: string) => {
    if (type === 'customer' && !customerOptions.includes(value)) {
      setCustomerOptions([...customerOptions, value]);
    } else if (type === 'product' && !productOptions.includes(value)) {
      setProductOptions([...productOptions, value]);
    } else if (type === 'plant' && !plantOptions.includes(value)) {
      setPlantOptions([...plantOptions, value]);
    }
  };

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

  const handleSave = (status: 'draft' | 'submitted' = 'draft') => {
    if (!customerName.trim() || !projectName.trim() || !orderQuantity || !productType || !plant) {
      alert('Please fill all required fields');
      return;
    }
    
    const allData = [...mqpData, ...visualElData];
    const qapData: QAPFormData = {
      id: editingQAP?.id || Date.now().toString(),
      customerName,
      projectName,
      orderQuantity,
      productType,
      plant,
      status,
      submittedBy: user?.username,
      submittedAt: status === 'submitted' ? new Date() : editingQAP?.submittedAt,
      qaps: allData
    };
    
    onSave(qapData);
    onClose();
    resetForm();
  };

  const resetForm = () => {
    setCustomerName('');
    setProjectName('');
    setOrderQuantity(0);
    setProductType('');
    setPlant('');
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 sm:p-6 pb-4 border-b bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-lg">
                📋
              </div>
              <span>{editingQAP ? 'Edit QAP' : 'New QAP'}</span>
            </DialogTitle>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="space-y-2">
              <Label htmlFor="customerName" className="text-sm font-medium">Customer Name *</Label>
              <Select value={customerName} onValueChange={(value) => {
                if (value === 'other') {
                  const custom = prompt('Enter custom customer name:');
                  if (custom) {
                    addCustomOption('customer', custom);
                    setCustomerName(custom);
                  }
                } else {
                  setCustomerName(value);
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customerOptions.map(option => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                  <SelectItem value="other">Other (Custom)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="projectName" className="text-sm font-medium">Project Name *</Label>
              <Input
                id="projectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter project name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="orderQuantity" className="text-sm font-medium">Order Quantity *</Label>
              <Input
                id="orderQuantity"
                type="number"
                value={orderQuantity}
                onChange={(e) => setOrderQuantity(Number(e.target.value))}
                placeholder="Enter quantity"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="productType" className="text-sm font-medium">Product Type *</Label>
              <Select value={productType} onValueChange={(value) => {
                if (value === 'other') {
                  const custom = prompt('Enter custom product type:');
                  if (custom) {
                    addCustomOption('product', custom);
                    setProductType(custom);
                  }
                } else {
                  setProductType(value);
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product type" />
                </SelectTrigger>
                <SelectContent>
                  {productOptions.map(option => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                  <SelectItem value="other">Other (Custom)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="plant" className="text-sm font-medium">Plant *</Label>
              <Select value={plant} onValueChange={(value) => {
                if (value === 'other') {
                  const custom = prompt('Enter custom plant:');
                  if (custom) {
                    addCustomOption('plant', custom);
                    setPlant(custom);
                  }
                } else {
                  setPlant(value);
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select plant" />
                </SelectTrigger>
                <SelectContent>
                  {plantOptions.map(option => (
                    <SelectItem key={option} value={option}>{option.toUpperCase()}</SelectItem>
                  ))}
                  <SelectItem value="other">Other (Custom)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Instructions */}
          <div className="mb-4 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
            💡 <strong>Instructions:</strong> Select "Yes" if your customer specification matches the Premier Specification/Criteria Limits (it will auto-fill and highlight green). 
            Select "No" to enter a custom specification manually (will highlight red).
          </div>

          {/* Tabs for MQP and Visual/EL */}
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
              Status: <strong className="capitalize">{editingQAP?.status || 'draft'}</strong>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <Button onClick={onClose} variant="outline" className="flex-1 sm:flex-none">
                Cancel
              </Button>
              <Button onClick={() => handleSave('draft')} variant="outline" className="flex-1 sm:flex-none">
                <Save className="w-4 h-4 mr-2" />
                Save Draft
              </Button>
              {(!editingQAP || editingQAP.status === 'draft') && (
                <Button onClick={() => handleSave('submitted')} className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 flex-1 sm:flex-none">
                  <Send className="w-4 h-4 mr-2" />
                  Submit for Approval
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QAPModal;
