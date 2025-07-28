
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, ArrowDown, User, Users, FileText, CheckCircle } from 'lucide-react';

const WorkflowPage: React.FC = () => {
  const workflowSteps = [
    {
      level: 1,
      title: 'Requestor',
      description: 'Creates and submits QAP',
      users: ['Requestor'],
      actions: ['Create QAP', 'Submit for Review'],
      icon: <User className="w-5 h-5" />
    },
    {
      level: 2,
      title: 'Level 2 Review',
      description: 'Technical, Production, and Quality review',
      users: ['Technical', 'Production', 'Quality'],
      actions: ['Review unmatched specifications', 'Add comments'],
      icon: <Users className="w-5 h-5" />
    },
    {
      level: 3,
      title: 'Head Review',
      description: 'Head review (P4 and P5 plants only)',
      users: ['Head'],
      actions: ['Review comments', 'Provide feedback'],
      icon: <User className="w-5 h-5" />,
      condition: 'P4 and P5 plants only'
    },
    {
      level: 4,
      title: 'Technical Head',
      description: 'Technical Head review',
      users: ['Technical Head'],
      actions: ['Final technical review', 'Approve/Send back'],
      icon: <User className="w-5 h-5" />
    },
    {
      level: 'final-comments',
      title: 'Final Comments',
      description: 'Requestor adds final comments',
      users: ['Requestor'],
      actions: ['Add final comments', 'Attach documents'],
      icon: <FileText className="w-5 h-5" />
    },
    {
      level: '3-final',
      title: 'Head Final Review',
      description: 'Head final review (P4 and P5 plants only)',
      users: ['Head'],
      actions: ['Final review', 'Approve/Send back'],
      icon: <User className="w-5 h-5" />,
      condition: 'P4 and P5 plants only'
    },
    {
      level: '4-final',
      title: 'Technical Head Final',
      description: 'Technical Head final review',
      users: ['Technical Head'],
      actions: ['Final technical approval'],
      icon: <User className="w-5 h-5" />
    },
    {
      level: 5,
      title: 'Plant Head Approval',
      description: 'Final approval by Plant Head',
      users: ['Plant Head (CMK)'],
      actions: ['Final approval', 'Reject with feedback'],
      icon: <CheckCircle className="w-5 h-5" />
    }
  ];

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">QAP Workflow</h1>
        <p className="text-gray-600">
          Complete workflow for Quality Assurance Plan (QAP) approval process
        </p>
      </div>

      <div className="grid gap-6">
        {workflowSteps.map((step, index) => (
          <div key={step.level} className="relative">
            <Card className="relative">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
                    {step.icon}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{step.title}</CardTitle>
                    <p className="text-sm text-gray-600">{step.description}</p>
                  </div>
                  {step.condition && (
                    <Badge variant="outline" className="ml-auto">
                      {step.condition}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Users Involved</h4>
                    <div className="flex flex-wrap gap-2">
                      {step.users.map(user => (
                        <Badge key={user} variant="secondary">
                          {user}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Actions</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {step.actions.map((action, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {index < workflowSteps.length - 1 && (
              <div className="flex justify-center py-4">
                <ArrowDown className="w-6 h-6 text-gray-400" />
              </div>
            )}
          </div>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Workflow Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
            <div>
              <p className="font-medium">Plant-specific routing</p>
              <p className="text-sm text-gray-600">
                P4 and P5 plants go through Head review (Level 3), while P2 plants skip directly to Technical Head (Level 4)
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
            <div>
              <p className="font-medium">Timeout handling</p>
              <p className="text-sm text-gray-600">
                Level 2 has a 4-day timeout. QAPs automatically expire if not reviewed within this timeframe
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
            <div>
              <p className="font-medium">Final approval loop</p>
              <p className="text-sm text-gray-600">
                After final comments, QAPs go through Head and Technical Head review again before Plant Head approval
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkflowPage;
