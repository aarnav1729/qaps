
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { QAPSpecification } from '@/data/qapSpecifications';

interface QAPTableProps {
  qaps: QAPSpecification[];
}

const QAPTable: React.FC<QAPTableProps> = ({ qaps }) => {
  console.log('QAPs in table:', qaps);

  if (qaps.length === 0) {
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
          Processed Customer QAPs ({qaps.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200">
                <th className="p-3 text-left text-sm font-semibold text-gray-700 border-r border-blue-200">S.No</th>
                <th className="p-3 text-left text-sm font-semibold text-gray-700 border-r border-blue-200">Category</th>
                <th className="p-3 text-left text-sm font-semibold text-gray-700 border-r border-blue-200">Subcategory</th>
                <th className="p-3 text-left text-sm font-semibold text-gray-700 border-r border-blue-200">Characteristic</th>
                <th className="p-3 text-left text-sm font-semibold text-gray-700 border-r border-blue-200">Premier Spec</th>
                <th className="p-3 text-left text-sm font-semibold text-gray-700 border-r border-blue-200">Match</th>
                <th className="p-3 text-left text-sm font-semibold text-gray-700">Customer Spec</th>
              </tr>
            </thead>
            <tbody>
              {qaps.map((qap, index) => (
                <tr 
                  key={`${qap.sno}-${index}`} 
                  className="border-b hover:bg-gray-50 transition-colors duration-200"
                >
                  <td className="p-3 text-sm border-r border-gray-200 font-medium">{qap.sno}</td>
                  <td className="p-3 text-sm border-r border-gray-200">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      {qap.category}
                    </Badge>
                  </td>
                  <td className="p-3 text-sm border-r border-gray-200 max-w-xs">
                    <div className="truncate" title={qap.subCategory}>
                      {qap.subCategory}
                    </div>
                  </td>
                  <td className="p-3 text-sm border-r border-gray-200 max-w-xs">
                    <div className="truncate" title={qap.characteristic}>
                      {qap.characteristic}
                    </div>
                  </td>
                  <td className="p-3 text-sm border-r border-gray-200 max-w-sm">
                    <div className="truncate" title={qap.premierSpecification}>
                      {qap.premierSpecification}
                    </div>
                  </td>
                  <td className="p-3 text-sm border-r border-gray-200">
                    {qap.match && (
                      <Badge 
                        variant={qap.match === 'yes' ? 'default' : 'destructive'}
                        className={qap.match === 'yes' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                      >
                        {qap.match.toUpperCase()}
                      </Badge>
                    )}
                  </td>
                  <td className="p-3 text-sm max-w-sm">
                    <div 
                      className={`p-2 rounded text-sm truncate ${
                        qap.match === 'yes' 
                          ? 'bg-green-50 text-green-800 border border-green-200' 
                          : qap.match === 'no' 
                          ? 'bg-red-50 text-red-800 border border-red-200' 
                          : 'bg-gray-50'
                      }`}
                      title={qap.customerSpecification}
                    >
                      {qap.customerSpecification || '-'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default QAPTable;
