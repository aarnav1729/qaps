import React, { useEffect, useState } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Save, Trash2, Pencil, X as CancelIcon,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
export interface Specification {
  id: string;
  criteria: 'Visual' | 'MQP';
  subCriteria: string;
  specification: string;
  class: 'Critical' | 'Major' | 'Minor';
  description?: string;
  sampling?: string;
  typeOfCheck?: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const api = async <T,>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<T> => {
  const res = await fetch(input, {
    credentials: 'include', // send JWT cookie
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */
const SpecificationBuilder: React.FC = () => {
  /* -----------------------------  state  -------------------------- */
  const [criteriaFilter, setCriteriaFilter] = useState<'Visual' | 'MQP'>('MQP');
  const [specs, setSpecs] = useState<Specification[]>([]);
  const [newOrEdit, setNewOrEdit] = useState<Partial<Specification>>({
    criteria: 'MQP',
    class: 'Major',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /* ------------------------  fetch existing specs ------------------ */
  useEffect(() => {
    (async () => {
      try {
        const data = await api<Specification[]>(
          `/api/specs?criteria=${criteriaFilter}`,
        );
        setSpecs(data);
      } catch (e) {
        // eslint‑disable‑next‑line no-console
        console.error(e);
        alert('Failed to load specifications');
      }
    })();
  }, [criteriaFilter]);

  /* ------------------------  CRUD handlers ------------------------- */
  const resetForm = () => {
    setEditingId(null);
    setNewOrEdit({ criteria: criteriaFilter, class: 'Major' });
  };

  /** CREATE or UPDATE depending on `editingId` */
  const handleSave = async () => {
    if (!newOrEdit.subCriteria || !newOrEdit.specification) {
      alert('Please fill in required fields');
      return;
    }
    setLoading(true);
    try {
      if (editingId) {
        // ------------ UPDATE ---------------
        const body = { ...newOrEdit };
        delete body.id;
        const updated = await api<Specification>(
          `/api/specs/${editingId}`,
          { method: 'PUT', body: JSON.stringify(body) },
        );
        setSpecs((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      } else {
        // ------------ CREATE ---------------
        const created = await api<Specification>(
          '/api/specs',
          { method: 'POST', body: JSON.stringify(newOrEdit) },
        );
        setSpecs((prev) => [...prev, created]);
      }
      resetForm();
    } catch (e: any) {
      console.error(e);
      alert(`Save failed: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  /** DELETE */
  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this specification permanently?')) return;
    try {
      await api(`/api/specs/${id}`, { method: 'DELETE' });
      setSpecs((prev) => prev.filter((s) => s.id !== id));
    } catch (e: any) {
      console.error(e);
      alert(`Delete failed: ${e.message || e}`);
    }
  };

  /** EDIT (populate form) */
  const startEdit = (spec: Specification) => {
    setEditingId(spec.id);
    setNewOrEdit(spec);
    setCriteriaFilter(spec.criteria);
  };

  const filteredSpecs = specs.filter((s) => s.criteria === criteriaFilter);

  /* ---------------------------  render  ---------------------------- */
  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Specification Builder
        </h1>
        <p className="text-gray-600">
          Create &amp; manage custom specification templates
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ────────────────  FORM  ──────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>
              {editingId ? 'Edit Specification' : 'Add New Specification'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Criteria */}
            <div className="space-y-2">
              <Label>Criteria Type *</Label>
              <Select
                value={newOrEdit.criteria as 'Visual' | 'MQP'}
                onValueChange={(v) => {
                  setCriteriaFilter(v);
                  setNewOrEdit((p) => ({ ...p, criteria: v }));
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MQP">MQP</SelectItem>
                  <SelectItem value="Visual">Visual / EL</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sub criteria */}
            <div className="space-y-2">
              <Label>Sub Criteria *</Label>
              <Input
                value={newOrEdit.subCriteria || ''}
                onChange={(e) =>
                  setNewOrEdit((p) => ({ ...p, subCriteria: e.target.value }))}
                placeholder="Enter sub‑criteria"
              />
            </div>

            {/* Specification */}
            <div className="space-y-2">
              <Label>Specification *</Label>
              <Textarea
                value={newOrEdit.specification || ''}
                onChange={(e) =>
                  setNewOrEdit((p) => ({ ...p, specification: e.target.value }))}
                placeholder="Enter specification details"
              />
            </div>

            {/* Class */}
            <div className="space-y-2">
              <Label>Class *</Label>
              <Select
                value={newOrEdit.class}
                onValueChange={(v) =>
                  setNewOrEdit((p) => ({ ...p, class: v as any }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Critical">Critical</SelectItem>
                  <SelectItem value="Major">Major</SelectItem>
                  <SelectItem value="Minor">Minor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Conditional fields */}
            {newOrEdit.criteria === 'MQP' && (
              <>
                <div className="space-y-2">
                  <Label>Type of Check</Label>
                  <Input
                    value={newOrEdit.typeOfCheck || ''}
                    onChange={(e) =>
                      setNewOrEdit((p) => ({ ...p, typeOfCheck: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sampling</Label>
                  <Input
                    value={newOrEdit.sampling || ''}
                    onChange={(e) =>
                      setNewOrEdit((p) => ({ ...p, sampling: e.target.value }))}
                  />
                </div>
              </>
            )}

            {newOrEdit.criteria === 'Visual' && (
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={newOrEdit.description || ''}
                  onChange={(e) =>
                    setNewOrEdit((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="flex gap-2">
              <Button
                disabled={loading}
                className="flex-1"
                onClick={handleSave}
              >
                {editingId ? (
                  <>
                    <Save className="w-4 h-4 mr-2" /> Update
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" /> Add
                  </>
                )}
              </Button>
              {editingId && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={resetForm}
                >
                  <CancelIcon className="w-4 h-4 mr-2" /> Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ────────────────  LIST  ──────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>
              {criteriaFilter} Specifications&nbsp;
              <span className="text-muted-foreground">
                ({filteredSpecs.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredSpecs.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No specifications yet
              </p>
            ) : (
              filteredSpecs.map((spec) => (
                <div
                  key={spec.id}
                  className="border rounded-lg p-4 bg-gray-50 space-y-1"
                >
                  <div className="flex justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{spec.criteria}</Badge>
                      <Badge
                        variant={
                          spec.class === 'Critical' ? 'destructive' : 'default'
                        }
                      >
                        {spec.class}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(spec)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(spec.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <h4 className="font-medium">{spec.subCriteria}</h4>
                  <p className="text-sm text-gray-600">
                    {spec.specification}
                  </p>
                  {spec.description && (
                    <p className="text-sm text-gray-500">{spec.description}</p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SpecificationBuilder;
