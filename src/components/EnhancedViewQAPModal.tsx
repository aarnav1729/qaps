
import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QAPFormData, QAPSpecification } from '@/types/qap';
import { X, Printer, Download, Search, Filter } from 'lucide-react';

interface EnhancedViewQAPModalProps {
  isOpen: boolean;
  onClose: () => void;
  qap: QAPFormData | null;
}

const EnhancedViewQAPModal: React.FC<EnhancedViewQAPModalProps> = ({ isOpen, onClose, qap }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMatch, setFilterMatch] = useState('all');
  const [sortBy, setSortBy] = useState('sno');
  const [printType, setPrintType] = useState<'all' | 'green' | 'red'>('all');

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

  const getRowClassName = (item: QAPSpecification) => {
    if (item.match === 'yes') return 'bg-green-50 border-green-200';
    if (item.match === 'no') return 'bg-red-50 border-red-200';
    return 'bg-white border-gray-200';
  };

  const filteredAndSortedData = useMemo(() => {
    let filtered = qap.qaps.filter(item => {
      // Filter by match
      if (filterMatch === 'green' && item.match !== 'yes') return false;
      if (filterMatch === 'red' && item.match !== 'no') return false;
      
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

    // Sort data
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'sno':
          return a.sno - b.sno;
        case 'criteria':
          return (a.criteria || '').localeCompare(b.criteria || '');
        case 'match':
          return (a.match || '').localeCompare(b.match || '');
        default:
          return 0;
      }
    });

    return filtered;
  }, [qap.qaps, searchTerm, filterMatch, sortBy]);

  const handlePrint = (type: 'all' | 'green' | 'red') => {
    const printData = type === 'all' ? qap.qaps : 
                    type === 'green' ? qap.qaps.filter(item => item.match === 'yes') :
                    qap.qaps.filter(item => item.match === 'no');
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>QAP Report - ${qap.customerName}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
            .info-item { background: #f5f5f5; padding: 10px; border-radius: 4px; }
            .info-label { font-weight: bold; color: #666; font-size: 12px; }
            .info-value { font-size: 14px; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { border: 1px solid #333; padding: 4px; text-align: left; }
            th { background-color: #f0f0f0; font-weight: bold; }
            .green-row { background-color: #f0f8f0; }
            .red-row { background-color: #fff0f0; }
            .badge { padding: 2px 6px; border-radius: 4px; font-size: 8px; }
            .critical { background-color: #fee; color: #c00; }
            .major { background-color: #ffeaa7; color: #d63031; }
            .minor { background-color: #dff0d8; color: #5cb85c; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Quality Assurance Plan Report</h1>
            <h2>${qap.customerName} - ${qap.projectName}</h2>
            <p>Report Type: ${type === 'all' ? 'Complete Report' : type === 'green' ? 'Green Items Only' : 'Red Items Only'}</p>
          </div>
          
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Customer Name</div>
              <div class="info-value">${qap.customerName}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Project Name</div>
              <div class="info-value">${qap.projectName}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Order Quantity</div>
              <div class="info-value">${qap.orderQuantity}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Product Type</div>
              <div class="info-value">${qap.productType}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Plant</div>
              <div class="info-value">${qap.plant.toUpperCase()}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Status</div>
              <div class="info-value">${qap.status}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Criteria</th>
                <th>Sub Criteria</th>
                <th>Component & Operation</th>
                <th>Characteristics</th>
                <th>Class</th>
                <th>Type of Check</th>
                <th>Sampling</th>
                <th>Specification</th>
                <th>Defect</th>
                <th>Defect Class</th>
                <th>Description</th>
                <th>Match</th>
                <th>Customer Specification</th>
              </tr>
            </thead>
            <tbody>
              ${printData.map(item => `
                <tr class="${item.match === 'yes' ? 'green-row' : item.match === 'no' ? 'red-row' : ''}">
                  <td>${item.sno}</td>
                  <td><span class="badge">${item.criteria}</span></td>
                  <td>${item.subCriteria || '-'}</td>
                  <td>${item.componentOperation || '-'}</td>
                  <td>${item.characteristics || '-'}</td>
                  <td><span class="badge ${(item.class || '').toLowerCase()}">${item.class || '-'}</span></td>
                  <td>${item.typeOfCheck || '-'}</td>
                  <td>${item.sampling || '-'}</td>
                  <td>${item.specification || '-'}</td>
                  <td>${item.defect || '-'}</td>
                  <td><span class="badge ${(item.defectClass || '').toLowerCase()}">${item.defectClass || '-'}</span></td>
                  <td>${item.description || '-'}</td>
                  <td><span class="badge">${item.match || 'N/A'}</span></td>
                  <td>${item.customerSpecification || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const handleExport = (type: 'all' | 'green' | 'red') => {
    const exportData = type === 'all' ? qap.qaps : 
                      type === 'green' ? qap.qaps.filter(item => item.match === 'yes') :
                      qap.qaps.filter(item => item.match === 'no');
    
    const headers = [
      'S.No', 'Criteria', 'Sub Criteria', 'Component & Operation', 'Characteristics',
      'Class', 'Type of Check', 'Sampling', 'Specification', 'Defect', 'Defect Class',
      'Description', 'Match', 'Customer Specification'
    ];
    
    const csvContent = [
      headers.join(','),
      ...exportData.map(item => [
        item.sno,
        `"${item.criteria || ''}"`,
        `"${item.subCriteria || ''}"`,
        `"${item.componentOperation || ''}"`,
        `"${item.characteristics || ''}"`,
        `"${item.class || ''}"`,
        `"${item.typeOfCheck || ''}"`,
        `"${item.sampling || ''}"`,
        `"${item.specification || ''}"`,
        `"${item.defect || ''}"`,
        `"${item.defectClass || ''}"`,
        `"${item.description || ''}"`,
        `"${item.match || ''}"`,
        `"${item.customerSpecification || ''}"`
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `QAP_${qap.customerName}_${type}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderQAPTable = () => {
    if (filteredAndSortedData.length === 0) {
      return <p className="text-center text-gray-500 py-8">No items match the current filters</p>;
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300 text-xs">
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
            {filteredAndSortedData.map((item, index) => (
              <tr key={index} className={`border-b ${getRowClassName(item)}`}>
                <td className="border border-gray-300 p-2">{item.sno}</td>
                <td className="border border-gray-300 p-2">
                  <Badge variant="outline" className="text-xs">
                    {item.criteria}
                  </Badge>
                </td>
                <td className="border border-gray-300 p-2">{item.subCriteria}</td>
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
                <td className="border border-gray-300 p-2">{item.defect}</td>
                <td className="border border-gray-300 p-2">
                  <Badge variant={item.defectClass === 'Critical' ? 'destructive' : 'default'} className="text-xs">
                    {item.defectClass}
                  </Badge>
                </td>
                <td className="border border-gray-300 p-2">{item.description}</td>
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
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">
              View QAP - {qap.customerName}
            </DialogTitle>
            <div className="flex gap-2">
              <Select value={printType} onValueChange={(value: 'all' | 'green' | 'red') => setPrintType(value)}>
                <SelectTrigger className="w-32 bg-white/20 border-white/30 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items</SelectItem>
                  <SelectItem value="green">Green Only</SelectItem>
                  <SelectItem value="red">Red Only</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/20" onClick={() => handlePrint(printType)}>
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/20" onClick={() => handleExport(printType)}>
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

          {/* Filters and Search */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search criteria, defects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterMatch} onValueChange={setFilterMatch}>
                <SelectTrigger>
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items</SelectItem>
                  <SelectItem value="green">Green Only</SelectItem>
                  <SelectItem value="red">Red Only</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sno">Sort by S.No</SelectItem>
                  <SelectItem value="criteria">Sort by Criteria</SelectItem>
                  <SelectItem value="match">Sort by Match</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-sm text-gray-600 flex items-center">
                Showing {filteredAndSortedData.length} of {qap.qaps.length} items
              </div>
            </div>
          </div>

          {/* QAP Table */}
          {renderQAPTable()}
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

export default EnhancedViewQAPModal;
