
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { QAPSpecification } from '@/data/qapSpecifications';
import { Eye, Edit, Trash2 } from 'lucide-react';

interface QAPGroup {
  customerName: string;
  qaps: QAPSpecification[];
  id: string;
}

interface QAPTableProps {
  qapGroups: QAPGroup[];
  onView: (group: QAPGroup) => void;
  onEdit: (group: QAPGroup) => void;
  onDelete: (group: QAPGroup) => void;
}

const QAPTable: React.FC<QAPTableProps> = ({ qapGroups, onView, onEdit, onDelete }) => {
  console.log('QAP Groups in table:', qapGroups);

  if (qapGroups.length === 0) {
    return (
      <Card className="mt-6">
        <CardContent className="p-12 text-center">
          <div className="text-gray-500 text-lg">
            No QAPs processed yet. Click "+ New QAP" to get started!
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-gray-800">
          Customer QAPs ({qapGroups.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200">
                <th className="p-3 text-left text-sm font-semibold text-gray-700 border-r border-blue-200">Customer Name</th>
                <th className="p-3 text-left text-sm font-semibold text-gray-700 border-r border-blue-200">Total QAPs</th>
                <th className="p-3 text-left text-sm font-semibold text-gray-700 border-r border-blue-200">Matched</th>
                <th className="p-3 text-left text-sm font-semibold text-gray-700 border-r border-blue-200">Custom</th>
                <th className="p-3 text-left text-sm font-semibold text-gray-700 border-r border-blue-200">Match Rate</th>
                <th className="p-3 text-center text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {qapGroups.map((group) => {
                const matched = group.qaps.filter(qap => qap.match === 'yes').length;
                const custom = group.qaps.filter(qap => qap.match === 'no').length;
                const matchRate = group.qaps.length > 0 ? Math.round((matched / group.qaps.length) * 100) : 0;
                
                return (
                  <tr 
                    key={group.id} 
                    className="border-b hover:bg-gray-50 transition-colors duration-200"
                  >
                    <td className="p-3 text-sm border-r border-gray-200 font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs">
                          {group.customerName.charAt(0).toUpperCase()}
                        </div>
                        {group.customerName}
                      </div>
                    </td>
                    <td className="p-3 text-sm border-r border-gray-200">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                        {group.qaps.length}
                      </Badge>
                    </td>
                    <td className="p-3 text-sm border-r border-gray-200">
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        {matched}
                      </Badge>
                    </td>
                    <td className="p-3 text-sm border-r border-gray-200">
                      <Badge variant="outline" className="bg-red-50 text-red-700">
                        {custom}
                      </Badge>
                    </td>
                    <td className="p-3 text-sm border-r border-gray-200">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${matchRate >= 80 ? 'bg-green-500' : matchRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${matchRate}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-medium">{matchRate}%</span>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onView(group)}
                          className="h-8 w-8 p-0 hover:bg-blue-100 hover:text-blue-600"
                          title="View QAPs"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(group)}
                          className="h-8 w-8 p-0 hover:bg-green-100 hover:text-green-600"
                          title="Edit QAPs"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(group)}
                          className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
                          title="Delete QAPs"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
  );
};

export default QAPTable;
