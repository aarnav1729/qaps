import React, { useState } from 'react';
import Navigation from '@/components/Navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Save, Trash2 } from 'lucide-react';

interface Specification {
  id: string;
  criteria: 'Visual' | 'MQP';
  subCriteria: string;
  specification: string;
  class: 'Critical' | 'Major' | 'Minor';
  description?: string;
  sampling?: string;
  typeOfCheck?: string;
}

const SpecificationBuilder: React.FC = () => {
  const { user, logout } = useAuth();
  const [selectedCriteria, setSelectedCriteria] = useState<'Visual' | 'MQP'>('MQP');
  const [specifications, setSpecifications] = useState<Specification[]>([]);
  const [newSpec, setNewSpec] = useState<Partial<Specification>>({
    criteria: 'MQP',
    class: 'Major'
  });

  const handleAddSpecification = () => {
    if (!newSpec.subCriteria || !newSpec.specification) {
      alert('Please fill in required fields');
      return;
    }

    const spec: Specification = {
      id: Date.now().toString(),
      criteria: selectedCriteria,
      subCriteria: newSpec.subCriteria || '',
      specification: newSpec.specification || '',
      class: newSpec.class || 'Major',
      description: newSpec.description || '',
      sampling: newSpec.sampling || '',
      typeOfCheck: newSpec.typeOfCheck || ''
    };

    setSpecifications(prev => [...prev, spec]);
    setNewSpec({ criteria: selectedCriteria, class: 'Major' });
  };

  const handleDeleteSpecification = (id: string) => {
    setSpecifications(prev => prev.filter(spec => spec.id !== id));
  };

  const handleSaveAll = () => {
    const saved = localStorage.getItem('customSpecifications') || '[]';
    const existing = JSON.parse(saved);
    const updated = [...existing, ...specifications];
    localStorage.setItem('customSpecifications', JSON.stringify(updated));
    alert('Specifications saved successfully!');
    setSpecifications([]);
  };

  const filteredSpecs = specifications.filter(spec => spec.criteria === selectedCriteria);

  return (
    <>
      <Navigation />
      <div className="container mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Specification Builder</h1>
          <p className="text-gray-600">Create custom specifications for QAP</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Add New Specification */}
          <Card>
            <CardHeader>
              <CardTitle>Add New Specification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Criteria Type *</Label>
                <Select value={selectedCriteria} onValueChange={(value: 'Visual' | 'MQP') => {
                  setSelectedCriteria(value);
                  setNewSpec(prev => ({ ...prev, criteria: value }));
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MQP">MQP</SelectItem>
                    <SelectItem value="Visual">Visual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sub Criteria *</Label>
                <Input
                  value={newSpec.subCriteria || ''}
                  onChange={e => setNewSpec(prev => ({ ...prev, subCriteria: e.target.value }))}
                  placeholder="Enter sub criteria"
                />
              </div>

              <div className="space-y-2">
                <Label>Specification *</Label>
                <Textarea
                  value={newSpec.specification || ''}
                  onChange={e => setNewSpec(prev => ({ ...prev, specification: e.target.value }))}
                  placeholder="Enter specification details"
                />
              </div>

              <div className="space-y-2">
                <Label>Class *</Label>
                <Select value={newSpec.class} onValueChange={(value: 'Critical' | 'Major' | 'Minor') => 
                  setNewSpec(prev => ({ ...prev, class: value }))
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Critical">Critical</SelectItem>
                    <SelectItem value="Major">Major</SelectItem>
                    <SelectItem value="Minor">Minor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedCriteria === 'MQP' && (
                <>
                  <div className="space-y-2">
                    <Label>Type of Check</Label>
                    <Input
                      value={newSpec.typeOfCheck || ''}
                      onChange={e => setNewSpec(prev => ({ ...prev, typeOfCheck: e.target.value }))}
                      placeholder="Enter type of check"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Sampling</Label>
                    <Input
                      value={newSpec.sampling || ''}
                      onChange={e => setNewSpec(prev => ({ ...prev, sampling: e.target.value }))}
                      placeholder="Enter sampling details"
                    />
                  </div>
                </>
              )}

              {selectedCriteria === 'Visual' && (
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={newSpec.description || ''}
                    onChange={e => setNewSpec(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter description"
                  />
                </div>
              )}

              <Button onClick={handleAddSpecification} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Specification
              </Button>
            </CardContent>
          </Card>

          {/* Current Specifications */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>
                  Current {selectedCriteria} Specifications ({filteredSpecs.length})
                </CardTitle>
                {specifications.length > 0 && (
                  <Button onClick={handleSaveAll} className="bg-green-600 hover:bg-green-700">
                    <Save className="w-4 h-4 mr-2" />
                    Save All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {filteredSpecs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No specifications added yet</p>
              ) : (
                <div className="space-y-4">
                  {filteredSpecs.map(spec => (
                    <div key={spec.id} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{spec.criteria}</Badge>
                          <Badge variant={spec.class === 'Critical' ? 'destructive' : 'default'}>
                            {spec.class}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSpecification(spec.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <h4 className="font-medium mb-1">{spec.subCriteria}</h4>
                      <p className="text-sm text-gray-600">{spec.specification}</p>
                      {spec.description && (
                        <p className="text-sm text-gray-500 mt-1">{spec.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default SpecificationBuilder;
