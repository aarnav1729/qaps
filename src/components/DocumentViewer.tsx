
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Eye, X } from 'lucide-react';

interface DocumentViewerProps {
  attachment: {
    name: string;
    url: string;
    type: string;
    size: number;
    content?: string;
  };
  onClose?: () => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ attachment, onClose }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.includes('image')) return '🖼️';
    if (type.includes('pdf')) return '📄';
    if (type.includes('word')) return '📝';
    if (type.includes('excel')) return '📊';
    return '📎';
  };

  const isPreviewable = (type: string) => {
    return type.includes('image') || type.includes('text') || type.includes('pdf');
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Document Attachment
          </CardTitle>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <span className="text-2xl">{getFileIcon(attachment.type)}</span>
            <div className="flex-1">
              <p className="font-medium">{attachment.name}</p>
              <p className="text-sm text-gray-600">
                {formatFileSize(attachment.size)} • {attachment.type}
              </p>
            </div>
            <div className="flex gap-2">
              {isPreviewable(attachment.type) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  {isExpanded ? 'Hide' : 'Preview'}
                </Button>
              )}
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-1" />
                Download
              </Button>
            </div>
          </div>

          {isExpanded && isPreviewable(attachment.type) && (
            <div className="border rounded-lg p-4 bg-white">
              {attachment.type.includes('image') && (
                <img 
                  src={attachment.url} 
                  alt={attachment.name}
                  className="max-w-full h-auto rounded"
                />
              )}
              {attachment.type.includes('text') && attachment.content && (
                <pre className="whitespace-pre-wrap text-sm font-mono bg-gray-50 p-4 rounded max-h-96 overflow-y-auto">
                  {attachment.content}
                </pre>
              )}
              {attachment.type.includes('pdf') && (
                <div className="text-center py-8">
                  <Badge variant="outline">PDF Preview</Badge>
                  <p className="text-sm text-gray-600 mt-2">
                    PDF preview would be embedded here in a real application
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DocumentViewer;
