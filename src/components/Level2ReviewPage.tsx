
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QAPFormData } from '@/types/qap';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Filter, ChevronDown, ChevronUp, Clock, CheckCircle2, Send } from 'lucide-react';

interface Level2ReviewPageProps {
  qapData: QAPFormData[];
  onNext: (qapId: string) => void;
}

const Level2ReviewPage: React.FC<Level2ReviewPageProps> = ({ qapData, onNext }) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('submittedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [responses, setResponses] = useState<{[qapId: string]: {[itemIndex: number]: string}}>({});
  const [expandedMatched, setExpandedMatched] = useState<{[qapId: string]: boolean}>({});

  // Filter QAPs for current user's role and plant
  const availableQAPs = useMemo(() => {
    if (!user) return [];
    
    const userPlants = user.plant?.split(',').map(p => p.trim()) || [];
    
    return qapData.filter(qap => {
      // Must be at level 2
      if (qap.currentLevel !== 2) return false;
      
      // Must be for user's plant
      if (!userPlants.includes(qap.plant.toLowerCase())) return false;
      
      // Must have unmatched items that need this role's review
      const unmatchedItems = qap.qaps.filter(spec => 
        spec.match === 'no' && spec.reviewBy?.includes(user.role)
      );
      
      return unmatchedItems.length > 0;
    });
  }, [qapData, user]);

  // Apply search, filter, and sort
  const filteredAndSortedQAPs = useMemo(() => {
    let filtered = availableQAPs.filter(qap => {
      const matchesSearch = searchTerm === '' || 
        qap.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        qap.projectName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = filterStatus === 'all' || qap.status === filterStatus;
      
      return matchesSearch && matchesFilter;
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'customerName':
          aValue = a.customerName;
          bValue = b.customerName;
          break;
        case 'projectName':
          aValue = a.projectName;
          bValue = b.projectName;
          break;
        case 'submittedAt':
          aValue = a.submittedAt?.getTime() || 0;
          bValue = b.submittedAt?.getTime() || 0;
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [availableQAPs, searchTerm, filterStatus, sortBy, sortOrder]);

  const handleResponseChange = (qapId: string, itemIndex: number, value: string) => {
    setResponses(prev => ({
      ...prev,
      [qapId]: {
        ...prev[qapId],
        [itemIndex]: value
      }
    }));
  };

  const handleNext = (qapId: string) => {
    // Simple call matching the expected signature
    onNext(qapId);
  };

  const getTimeRemaining = (submittedAt?: Date) => {
    if (!submittedAt) return 'Unknown';
    
    const fourDays = 4 * 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - submittedAt.getTime();
    const remaining = fourDays - elapsed;
    
    if (remaining <= 0) return 'Expired';
    
    const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    
    return `${days}d ${hours}h remaining`;
  };

  const renderQAPCard = (qap: QAPFormData) => {
    const unmatchedItems = qap.qaps.filter(spec => 
      spec.match === 'no' && spec.reviewBy?.includes(user?.role || '')
    );
    const matchedItems = qap.qaps.filter(spec => spec.match === 'yes');
    
    const hasUserResponded = qap.levelResponses[2]?.[user?.role || ''];
    const qapResponses = responses[qap.id] || {};
    
    return (
      <Card key={qap.id} className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl">{qap.customerName} - {qap.projectName}</CardTitle>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline">{qap.plant.toUpperCase()}</Badge>
                <Badge variant="outline">{qap.productType}</Badge>
                <Badge>{qap.orderQuantity} MW</Badge>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="text-sm text-orange-600">
                  {getTimeRemaining(qap.submittedAt)}
                </span>
              </div>
              {hasUserResponded && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-600">Responded</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Unmatched Items for Review */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 text-red-600">
              Items Requiring {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)} Review ({unmatchedItems.length})
            </h3>
            
            {unmatchedItems.map((item, index) => (
              <div key={item.sno} className="border border-red-200 rounded-lg p-4 bg-red-50 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                  <div>
                    <p className="font-medium text-red-800">{item.criteria} - {item.subCriteria}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Premier Spec: {item.specification || item.criteriaLimits}
                    </p>
                    <p className="text-sm text-red-700 font-medium mt-1">
                      Customer Spec: {item.customerSpecification}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Your Comments:</label>
                    <Textarea
                      value={qapResponses[index] || ''}
                      onChange={(e) => handleResponseChange(qap.id, index, e.target.value)}
                      placeholder="Add your review comments..."
                      className="min-h-[80px]"
                      disabled={hasUserResponded}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Matched Items (Collapsible) */}
          {matchedItems.length > 0 && (
            <Collapsible 
              open={expandedMatched[qap.id] || false} 
              onOpenChange={(open) => setExpandedMatched(prev => ({...prev, [qap.id]: open}))}
            >
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="mb-4">
                  <span>Matched Items for Reference ({matchedItems.length})</span>
                  {expandedMatched[qap.id] ? 
                    <ChevronUp className="ml-2 h-4 w-4" /> : 
                    <ChevronDown className="ml-2 h-4 w-4" />
                  }
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-2 mb-4">
                  {matchedItems.map((item) => (
                    <div key={item.sno} className="border border-green-200 rounded-lg p-3 bg-green-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-green-800">{item.criteria} - {item.subCriteria}</p>
                          <p className="text-sm text-gray-600">
                            {item.specification || item.criteriaLimits}
                          </p>
                        </div>
                        <Badge className="bg-green-100 text-green-800">Matched</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Action Button */}
          <div className="flex justify-end">
            <Button 
              onClick={() => handleNext(qap.id)}
              disabled={hasUserResponded}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Send className="mr-2 h-4 w-4" />
              {hasUserResponded ? 'Already Responded' : 'Submit Review'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Level 2 Review - {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
        </h1>
        <p className="text-gray-600">Review and comment on unmatched specifications</p>
      </div>

      {/* Search and Filter Controls */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search QAPs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="level-2">Level 2</SelectItem>
                <SelectItem value="level-3">Level 3</SelectItem>
                <SelectItem value="level-4">Level 4</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="submittedAt">Date Submitted</SelectItem>
                <SelectItem value="customerName">Customer</SelectItem>
                <SelectItem value="projectName">Project</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortOrder} onValueChange={(value: 'asc' | 'desc') => setSortOrder(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Descending</SelectItem>
                <SelectItem value="asc">Ascending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* QAP Cards */}
      {filteredAndSortedQAPs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-gray-500 text-lg">
              No QAPs require your review at this time.
            </div>
          </CardContent>
        </Card>
      ) : (
        filteredAndSortedQAPs.map(renderQAPCard)
      )}
    </div>
  );
};

export default Level2ReviewPage;
