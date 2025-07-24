
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { QAPFormData } from '@/types/qap';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronDown, CheckCircle, Clock } from 'lucide-react';

interface Level2ReviewPageProps {
  qapData: QAPFormData[];
  onAcknowledge: (qapId: string, itemIndex: number, comments: string) => void;
  onNext: (qapId: string) => void;
}

const Level2ReviewPage: React.FC<Level2ReviewPageProps> = ({ qapData, onAcknowledge, onNext }) => {
  const { user } = useAuth();
  const [selectedQAP, setSelectedQAP] = useState<QAPFormData | null>(null);
  const [comments, setComments] = useState<{ [itemIndex: number]: string }>({});
  const [acknowledged, setAcknowledged] = useState<{ [itemIndex: number]: boolean }>({});
  const [showMatched, setShowMatched] = useState(false);

  const getAssignedQAPs = () => {
    return qapData.filter(qap => {
      if (qap.status !== 'level-2') return false;
      
      // Check if user's plant matches and role is assigned to review unmatched items
      const userPlants = user?.plant?.split(',') || [];
      const qapPlant = qap.plant.toLowerCase();
      
      if (!userPlants.some(plant => plant.trim() === qapPlant)) return false;
      
      // Check if any unmatched items are assigned to this role
      const unmatchedItems = qap.qaps.filter(item => item.match === 'no');
      return unmatchedItems.some(item => item.reviewBy?.includes(user?.role || ''));
    });
  };

  const getUnmatchedItems = (qap: QAPFormData) => {
    if (!qap) return [];
    return qap.qaps.filter(item => 
      item.match === 'no' && item.reviewBy?.includes(user?.role || '')
    );
  };

  const getMatchedItems = (qap: QAPFormData) => {
    if (!qap) return [];
    return qap.qaps.filter(item => item.match === 'yes');
  };

  const handleAcknowledgeItem = (itemIndex: number) => {
    if (!selectedQAP) return;
    
    const comment = comments[itemIndex] || '';
    onAcknowledge(selectedQAP.id, itemIndex, comment);
    
    setAcknowledged(prev => ({ ...prev, [itemIndex]: true }));
  };

  const handleNext = () => {
    if (!selectedQAP) return;
    
    const unmatchedItems = getUnmatchedItems(selectedQAP);
    const allAcknowledged = unmatchedItems.every((_, index) => acknowledged[index]);
    
    if (allAcknowledged) {
      onNext(selectedQAP.id);
      setSelectedQAP(null);
      setComments({});
      setAcknowledged({});
    }
  };

  const getTimeRemaining = (submittedAt: Date) => {
    const fourDaysMs = 4 * 24 * 60 * 60 * 1000;
    const timeLeft = fourDaysMs - (Date.now() - submittedAt.getTime());
    const daysLeft = Math.floor(timeLeft / (24 * 60 * 60 * 1000));
    const hoursLeft = Math.floor((timeLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    
    if (timeLeft <= 0) return 'Expired';
    return `${daysLeft}d ${hoursLeft}h remaining`;
  };

  const assignedQAPs = getAssignedQAPs();

  if (assignedQAPs.length === 0) {
    return (
      <div className="container mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold mb-6">Review Queue</h1>
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-gray-500">No QAPs assigned for review</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (selectedQAP) {
    const unmatchedItems = getUnmatchedItems(selectedQAP);
    const matchedItems = getMatchedItems(selectedQAP);
    
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="mb-6">
          <Button 
            variant="outline" 
            onClick={() => setSelectedQAP(null)}
            className="mb-4"
          >
            ← Back to List
          </Button>
          <h1 className="text-3xl font-bold">Review QAP</h1>
          <p className="text-gray-600">
            {selectedQAP.customerName} - {selectedQAP.projectName}
          </p>
        </div>

        <div className="space-y-6">
          {/* Unmatched Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">
                Unmatched Items Requiring Review ({unmatchedItems.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {unmatchedItems.map((item, index) => (
                  <div key={item.sno} className="border border-red-200 rounded-lg p-4 bg-red-50">
                    <div className="mb-3">
                      <Badge variant="destructive">Unmatched</Badge>
                      <h4 className="font-medium mt-2">{item.criteria} - {item.subCriteria}</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Premier Spec: {item.specification || item.criteriaLimits}
                      </p>
                      <p className="text-sm font-medium mt-1">
                        Customer Spec: {item.customerSpecification}
                      </p>
                    </div>
                    
                    <div className="space-y-3">
                      <Textarea
                        placeholder="Add your comments..."
                        value={comments[index] || ''}
                        onChange={(e) => setComments(prev => ({ ...prev, [index]: e.target.value }))}
                      />
                      
                      <Button
                        onClick={() => handleAcknowledgeItem(index)}
                        disabled={acknowledged[index]}
                        className={acknowledged[index] ? 'bg-green-600' : 'bg-blue-600'}
                      >
                        {acknowledged[index] ? (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Acknowledged
                          </>
                        ) : (
                          'Acknowledge'
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Matched Items (Collapsible) */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Card className="cursor-pointer hover:bg-gray-50">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-green-600">
                    <span>Matched Items for Reference ({matchedItems.length})</span>
                    <ChevronDown className="w-4 h-4" />
                  </CardTitle>
                </CardHeader>
              </Card>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    {matchedItems.map((item) => (
                      <div key={item.sno} className="border border-green-200 rounded-lg p-4 bg-green-50">
                        <Badge variant="default" className="bg-green-600 mb-2">Matched</Badge>
                        <h4 className="font-medium">{item.criteria} - {item.subCriteria}</h4>
                        <p className="text-sm text-gray-600">
                          Specification: {item.specification || item.criteriaLimits}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>

          {/* Next Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleNext}
              disabled={!unmatchedItems.every((_, index) => acknowledged[index])}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold mb-6">Review Queue - {user?.role?.toUpperCase()}</h1>
      
      <div className="grid gap-6">
        {assignedQAPs.map((qap) => {
          const timeRemaining = getTimeRemaining(qap.submittedAt || new Date());
          const unmatchedCount = getUnmatchedItems(qap).length;
          
          return (
            <Card key={qap.id} className="cursor-pointer hover:shadow-lg transition-shadow" 
                  onClick={() => setSelectedQAP(qap)}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">{qap.customerName} - {qap.projectName}</h3>
                    <p className="text-gray-600">Plant: {qap.plant.toUpperCase()} | {qap.productType}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary">{timeRemaining}</Badge>
                    <p className="text-sm text-red-600 mt-1">{unmatchedCount} items to review</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-500">
                    Submitted: {qap.submittedAt?.toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Level2ReviewPage;
