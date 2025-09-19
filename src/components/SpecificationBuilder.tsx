// src/pages/SpecificationBuilder.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Save,
  Trash2,
  Pencil,
  ArrowUp,
  ArrowDown,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { BOM_COMPONENTS, BomComponentName } from "@/data/components";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
export type CriteriaType = "MQP" | "Visual";
export type SpecClass = "Critical" | "Major" | "Minor";

export interface Specification {
  id: string;
  criteria: CriteriaType;
  subCriteria: string;
  specification: string;
  class: SpecClass;
  description?: string;
  sampling?: string;
  typeOfCheck?: string;
}

export interface BomComponentOption {
  model: string;
  subVendor?: string | null;
  spec?: string | null;
}

export interface BomComponent {
  id: string;
  name: BomComponentName;
  options: BomComponentOption[];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
const API = window.location.origin;

/** Simple API wrapper with cookie creds + JSON */
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function uuid() {
  // good enough for UI. Server persists its own ids too.
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

/* ------------------------------------------------------------------ */
/* Main Page                                                          */
/* ------------------------------------------------------------------ */
const SpecificationBuilder: React.FC = () => {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"specs" | "bom">("specs");
  const [criteriaFilter, setCriteriaFilter] = useState<CriteriaType>("MQP");

  // Specs: search / filter / sort
  const [specSearch, setSpecSearch] = useState("");
  const [specClassFilter, setSpecClassFilter] = useState<"All" | SpecClass>(
    "All"
  );
  const [specSort, setSpecSort] = useState<
    "subCriteria-asc" | "subCriteria-desc" | "class-asc" | "class-desc"
  >("subCriteria-asc");

  // Specs state
  const [specs, setSpecs] = useState<Specification[]>([]);
  const [specsLoading, setSpecsLoading] = useState(false);
  const [specsError, setSpecsError] = useState<string | null>(null);

  // Spec Modal
  const [specModalOpen, setSpecModalOpen] = useState(false);
  const [editingSpec, setEditingSpec] = useState<Specification | null>(null);
  const emptySpec: Specification = {
    id: "",
    criteria: criteriaFilter,
    subCriteria: "",
    specification: "",
    class: "Major",
    description: "",
    sampling: "",
    typeOfCheck: "",
  };
  const [draftSpec, setDraftSpec] = useState<Specification>(emptySpec);

  // BOM state
  const [bom, setBom] = useState<BomComponent[]>([]);
  const [bomLoading, setBomLoading] = useState(false);
  const [bomError, setBomError] = useState<string | null>(null);

  // BOM Modal
  const [bomModalOpen, setBomModalOpen] = useState(false);
  const [editingBom, setEditingBom] = useState<BomComponent | null>(null);
  const emptyBom: BomComponent = {
    id: "",
    name: "Solar Cell",
    options: [{ model: "", subVendor: "", spec: "" }],
  };
  const [draftBom, setDraftBom] = useState<BomComponent>(emptyBom);
  const [bomSearch, setBomSearch] = useState("");
  const [bomSort, setBomSort] = useState<
    "name-asc" | "name-desc" | "opts-asc" | "opts-desc"
  >("name-asc");

  const safeName: BomComponentName = (
    BOM_COMPONENTS as readonly string[]
  ).includes(draftBom.name)
    ? (draftBom.name as BomComponentName)
    : (BOM_COMPONENTS[0] as BomComponentName);

  /* ------------------------------ Loaders ------------------------------ */
  const loadSpecs = async () => {
    setSpecsLoading(true);
    setSpecsError(null);
    try {
      const data = await api<Specification[]>(
        `/api/specs?criteria=${criteriaFilter}`
      );
      setSpecs(data);
    } catch (e: any) {
      setSpecsError(e.message || "Failed to load specs");
    } finally {
      setSpecsLoading(false);
    }
  };

  const loadBom = async () => {
    setBomLoading(true);
    setBomError(null);
    try {
      const data = await api<BomComponent[]>(`/api/bom-components`);
      setBom(data);
    } catch (e: any) {
      setBomError(e.message || "Failed to load BOM");
    } finally {
      setBomLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "specs") loadSpecs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteriaFilter, activeTab]);

  useEffect(() => {
    if (activeTab === "bom") loadBom();
  }, [activeTab]);

  /* ------------------------------ Spec CRUD ------------------------------ */
  const openCreateSpec = () => {
    setEditingSpec(null);
    setDraftSpec({ ...emptySpec, id: "", criteria: criteriaFilter });
    setSpecModalOpen(true);
  };

  const openEditSpec = (s: Specification) => {
    setEditingSpec(s);
    setDraftSpec({ ...s });
    setSpecModalOpen(true);
  };

  const saveSpec = async () => {
    if (!draftSpec.subCriteria.trim() || !draftSpec.specification.trim()) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Sub Criteria and Specification are required.",
      });
      return;
    }
    try {
      if (editingSpec) {
        const updated = await api<Specification>(
          `/api/specs/${editingSpec.id}`,
          {
            method: "PUT",
            body: JSON.stringify(draftSpec),
          }
        );
        setSpecs((prev) =>
          prev.map((x) => (x.id === updated.id ? updated : x))
        );
        toast({ title: "Updated", description: "Specification updated." });
      } else {
        const created = await api<Specification>(`/api/specs`, {
          method: "POST",
          body: JSON.stringify({ ...draftSpec, id: undefined }),
        });
        setSpecs((prev) => [...prev, created]);
        toast({ title: "Created", description: "Specification added." });
      }
      setSpecModalOpen(false);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: e.message || String(e),
      });
    }
  };

  const deleteSpec = async (id: string) => {
    if (!confirm("Delete this specification?")) return;
    try {
      await api(`/api/specs/${id}`, { method: "DELETE" });
      setSpecs((prev) => prev.filter((s) => s.id !== id));
      toast({ title: "Deleted", description: "Specification removed." });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: e.message || String(e),
      });
    }
  };

  const moveSpec = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= specs.length) return;
    const newOrder = [...specs];
    const tmp = newOrder[index];
    newOrder[index] = newOrder[target];
    newOrder[target] = tmp;
    setSpecs(newOrder);
    try {
      await api(`/api/specs/reorder`, {
        method: "POST",
        body: JSON.stringify({
          criteria: criteriaFilter,
          ids: newOrder.map((s) => s.id),
        }),
      });
      toast({ title: "Order saved", description: "New order applied." });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Reorder failed",
        description: e.message || String(e),
      });
      // reload to be safe
      loadSpecs();
    }
  };

  /* ------------------------------ BOM CRUD ------------------------------ */
  const openCreateBom = () => {
    setEditingBom(null);
    setDraftBom({ ...emptyBom, id: "" });
    setBomModalOpen(true);
  };

  const openEditBom = (b: BomComponent) => {
    setEditingBom(b);
    setDraftBom(JSON.parse(JSON.stringify(b)));
    setBomModalOpen(true);
  };

  const saveBom = async () => {
    if (!draftBom.name) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Component name is required.",
      });
      return;
    }
    // sanitize options
    const clean = {
      ...draftBom,
      options: (draftBom.options || [])
        .filter((o) => (o.model || "").trim())
        .map((o) => ({
          model: o.model.trim(),
          subVendor: (o.subVendor ?? "").toString().trim() || null,
          spec: (o.spec ?? "").toString().trim() || null,
        })),
    };
    if (!clean.options.length) {
      toast({
        variant: "destructive",
        title: "Options empty",
        description: "Add at least one option with a model.",
      });
      return;
    }

    try {
      if (editingBom) {
        const updated = await api<BomComponent>(
          `/api/bom-components/${editingBom.id}`,
          {
            method: "PUT",
            body: JSON.stringify(clean),
          }
        );
        setBom((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        toast({ title: "Updated", description: "BOM component updated." });
      } else {
        const created = await api<BomComponent>(`/api/bom-components`, {
          method: "POST",
          body: JSON.stringify({ ...clean, id: undefined }),
        });
        setBom((prev) => [...prev, created]);
        toast({ title: "Created", description: "BOM component added." });
      }
      setBomModalOpen(false);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: e.message || String(e),
      });
    }
  };

  const deleteBom = async (id: string) => {
    if (!confirm("Delete this BOM component?")) return;
    try {
      await api(`/api/bom-components/${id}`, { method: "DELETE" });
      setBom((prev) => prev.filter((b) => b.id !== id));
      toast({ title: "Deleted", description: "BOM component removed." });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: e.message || String(e),
      });
    }
  };

  const moveBom = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= bom.length) return;
    const newOrder = [...bom];
    const tmp = newOrder[index];
    newOrder[index] = newOrder[target];
    newOrder[target] = tmp;
    setBom(newOrder);
    try {
      await api(`/api/bom-components/reorder`, {
        method: "POST",
        body: JSON.stringify({
          ids: newOrder.map((b) => b.id),
        }),
      });
      toast({ title: "Order saved", description: "New order applied." });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Reorder failed",
        description: e.message || String(e),
      });
      loadBom();
    }
  };

  const filteredBom = useMemo(() => {
    const q = bomSearch.trim().toLowerCase();
    const list = bom.filter((b) => {
      if (!q) return true;
      if (b.name.toLowerCase().includes(q)) return true;
      return (b.options || []).some(
        (o) =>
          (o.model || "").toLowerCase().includes(q) ||
          (o.subVendor || "").toLowerCase().includes(q) ||
          (o.spec || "").toLowerCase().includes(q)
      );
    });
    const count = (b: BomComponent) => (b.options ? b.options.length : 0);
    return [...list].sort((a, b) => {
      switch (bomSort) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "opts-asc":
          return count(a) - count(b);
        case "opts-desc":
          return count(b) - count(a);
        default:
          return 0;
      }
    });
  }, [bom, bomSearch, bomSort]);

  const filteredSpecs = useMemo(() => {
    const q = specSearch.trim().toLowerCase();
    const list = specs.filter((s) => {
      if (s.criteria !== criteriaFilter) return false;
      if (specClassFilter !== "All" && s.class !== specClassFilter)
        return false;
      if (!q) return true;
      const hay = `${s.subCriteria} ${s.specification} ${
        s.description ?? ""
      }`.toLowerCase();
      return hay.includes(q);
    });
    const cmp = (a: Specification, b: Specification) => {
      switch (specSort) {
        case "subCriteria-asc":
          return a.subCriteria.localeCompare(b.subCriteria);
        case "subCriteria-desc":
          return b.subCriteria.localeCompare(a.subCriteria);
        case "class-asc":
          return a.class.localeCompare(b.class);
        case "class-desc":
          return b.class.localeCompare(a.class);
        default:
          return 0;
      }
    };
    return [...list].sort(cmp);
  }, [specs, criteriaFilter, specClassFilter, specSearch, specSort]);
  /* ------------------------------ UI ------------------------------ */
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-indigo-600 via-violet-500 to-fuchsia-500 p-6 sm:p-8 shadow-lg">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-black/10 blur-3xl" />
        <div className="relative z-10 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
              Spec & BOM Builder
            </h1>
            <p className="text-white/90 mt-1">
              Create, edit, reorder, and delete Specifications and BOM building
              blocks.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => (activeTab === "specs" ? loadSpecs() : loadBom())}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as any)}
        className="mt-6"
      >
        <TabsList>
          <TabsTrigger value="specs">Specification Builder</TabsTrigger>
          <TabsTrigger value="bom">BOM Builder</TabsTrigger>
        </TabsList>

        {/* ================== SPEC BUILDER ================== */}
        <TabsContent value="specs" className="mt-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <CardTitle className="text-lg">Specifications</CardTitle>+{" "}
              <div className="flex gap-2 flex-col sm:flex-row sm:items-center">
                {/* Criteria */}
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Criteria</Label>
                  <Select
                    value={criteriaFilter}
                    onValueChange={(v) => setCriteriaFilter(v as CriteriaType)}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MQP">MQP</SelectItem>
                      <SelectItem value="Visual">Visual / EL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Class filter */}
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Class</Label>
                  <Select
                    value={specClassFilter}
                    onValueChange={(v) => setSpecClassFilter(v as any)}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All</SelectItem>
                      <SelectItem value="Critical">Critical</SelectItem>
                      <SelectItem value="Major">Major</SelectItem>
                      <SelectItem value="Minor">Minor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Sort */}
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Sort</Label>
                  <Select
                    value={specSort}
                    onValueChange={(v) => setSpecSort(v as any)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="subCriteria-asc">
                        Sub-criteria ↑
                      </SelectItem>
                      <SelectItem value="subCriteria-desc">
                        Sub-criteria ↓
                      </SelectItem>
                      <SelectItem value="class-asc">Class ↑</SelectItem>
                      <SelectItem value="class-desc">Class ↓</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Search */}
                <div className="w-full sm:w-[240px]">
                  <Input
                    placeholder="Search sub-criteria, spec, description…"
                    value={specSearch}
                    onChange={(e) => setSpecSearch(e.target.value)}
                  />
                </div>
                <Button onClick={openCreateSpec}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Specification
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              {specsLoading ? (
                <div className="grid gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-xl border p-4">
                      <Skeleton className="h-4 w-1/3" />
                      <div className="mt-2 space-y-2">
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-3 w-4/5" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : specsError ? (
                <div className="text-red-600">{specsError}</div>
              ) : filteredSpecs.length === 0 ? (
                <div className="text-muted-foreground text-center py-10">
                  No specs yet for {criteriaFilter}.
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredSpecs.map((s, idx) => (
                    <div
                      key={s.id}
                      className="rounded-xl border p-4 bg-gradient-to-r from-slate-50 to-white"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline">{s.criteria}</Badge>
                            <Badge
                              variant={
                                s.class === "Critical"
                                  ? "destructive"
                                  : "default"
                              }
                            >
                              {s.class}
                            </Badge>
                          </div>
                          <div className="font-medium truncate">
                            {s.subCriteria}
                          </div>
                          <div className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
                            {s.specification}
                          </div>
                          {s.description && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {s.description}
                            </div>
                          )}
                          {s.criteria === "MQP" &&
                            (s.typeOfCheck || s.sampling) && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {!!s.typeOfCheck && (
                                  <span>Type of Check: {s.typeOfCheck} </span>
                                )}
                                {!!s.sampling && (
                                  <span>• Sampling: {s.sampling}</span>
                                )}
                              </div>
                            )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => moveSpec(idx, -1)}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => moveSpec(idx, +1)}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="secondary"
                            size="icon"
                            onClick={() => openEditSpec(s)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => deleteSpec(s.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================== BOM BUILDER ================== */}
        <TabsContent value="bom" className="mt-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <CardTitle className="text-lg">BOM Components</CardTitle>
              <div className="flex gap-2 flex-col sm:flex-row sm:items-center">
                <Input
                  className="w-[220px]"
                  placeholder="Search name/model/vendor/spec…"
                  value={bomSearch}
                  onChange={(e) => setBomSearch(e.target.value)}
                />
                <Select
                  value={bomSort}
                  onValueChange={(v) => setBomSort(v as any)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name-asc">Name ↑</SelectItem>
                    <SelectItem value="name-desc">Name ↓</SelectItem>
                    <SelectItem value="opts-asc"># Options ↑</SelectItem>
                    <SelectItem value="opts-desc"># Options ↓</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={openCreateBom}>
                  <Plus className="h-4 w-4 mr-2" /> Add Component
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              {filteredBom.map ? (
                <div className="grid gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-xl border p-4">
                      <Skeleton className="h-4 w-1/3" />
                      <div className="mt-2 space-y-2">
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-3 w-4/5" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : bomError ? (
                <div className="text-red-600">{bomError}</div>
              ) : bom.length === 0 ? (
                <div className="text-muted-foreground text-center py-10">
                  No BOM components yet.
                </div>
              ) : (
                <div className="grid gap-3">
                  {bom.map((b, idx) => (
                    <div
                      key={b.id}
                      className="rounded-xl border p-4 bg-gradient-to-r from-emerald-50 to-teal-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline">{b.name}</Badge>
                          </div>
                          <div className="text-sm text-foreground">
                            {b.options.length} option
                            {b.options.length > 1 ? "s" : ""}
                          </div>
                          <ul className="mt-1 pl-4 list-disc text-sm text-muted-foreground space-y-1">
                            {b.options.map((o, i) => (
                              <li key={i}>
                                <span className="font-medium">{o.model}</span>
                                {o.subVendor ? (
                                  <>
                                    {" "}
                                    — <span>{o.subVendor}</span>
                                  </>
                                ) : null}
                                {o.spec ? (
                                  <>
                                    {" "}
                                    — <span className="text-xs">{o.spec}</span>
                                  </>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => moveBom(idx, -1)}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => moveBom(idx, +1)}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="secondary"
                            size="icon"
                            onClick={() => openEditBom(b)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => deleteBom(b.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* --------- Spec Modal --------- */}
      <Dialog
        open={specModalOpen}
        onOpenChange={(open) => !open && setSpecModalOpen(false)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingSpec ? "Edit Specification" : "Add Specification"}
            </DialogTitle>
            <DialogDescription>
              Save updates to regenerate{" "}
              <code>src/data/qapSpecifications.ts</code>.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Criteria *</Label>
              <Select
                value={draftSpec.criteria}
                onValueChange={(v) =>
                  setDraftSpec((p) => ({ ...p, criteria: v as CriteriaType }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MQP">MQP</SelectItem>
                  <SelectItem value="Visual">Visual / EL</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Class *</Label>
              <Select
                value={draftSpec.class}
                onValueChange={(v) =>
                  setDraftSpec((p) => ({ ...p, class: v as SpecClass }))
                }
              >
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

            <div className="space-y-2 sm:col-span-2">
              <Label>Sub Criteria *</Label>
              <Input
                value={draftSpec.subCriteria}
                onChange={(e) =>
                  setDraftSpec((p) => ({ ...p, subCriteria: e.target.value }))
                }
                placeholder="E.g., Cell Cracks / Visual Defect / ..."
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Specification *</Label>
              <Textarea
                value={draftSpec.specification}
                onChange={(e) =>
                  setDraftSpec((p) => ({ ...p, specification: e.target.value }))
                }
                rows={4}
                placeholder="Enter specification details, acceptance criteria, limits..."
              />
            </div>

            {draftSpec.criteria === "MQP" && (
              <>
                <div className="space-y-2">
                  <Label>Type of Check</Label>
                  <Input
                    value={draftSpec.typeOfCheck || ""}
                    onChange={(e) =>
                      setDraftSpec((p) => ({
                        ...p,
                        typeOfCheck: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sampling</Label>
                  <Input
                    value={draftSpec.sampling || ""}
                    onChange={(e) =>
                      setDraftSpec((p) => ({ ...p, sampling: e.target.value }))
                    }
                  />
                </div>
              </>
            )}

            {draftSpec.criteria === "Visual" && (
              <div className="space-y-2 sm:col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={draftSpec.description || ""}
                  onChange={(e) =>
                    setDraftSpec((p) => ({ ...p, description: e.target.value }))
                  }
                />
              </div>
            )}
          </div>

          <DialogFooter className="mt-2">
            <Button variant="secondary" onClick={() => setSpecModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveSpec}>
              <Save className="h-4 w-4 mr-2" />
              {editingSpec ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --------- BOM Modal --------- */}
      <Dialog
        open={bomModalOpen}
        onOpenChange={(open) => !open && setBomModalOpen(false)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingBom ? "Edit Component" : "Add Component"}
            </DialogTitle>
            <DialogDescription>
              Save updates to regenerate <code>src/data/bomMaster.ts</code>.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Component *</Label>
              <Select
                value={safeName}
                onValueChange={(v) =>
                  setDraftBom((p) => ({ ...p, name: v as BomComponentName }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BOM_COMPONENTS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm">Options *</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setDraftBom((p) => ({
                      ...p,
                      options: [
                        ...(p.options || []),
                        { model: "", subVendor: "", spec: "" },
                      ],
                    }))
                  }
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Option
                </Button>
              </div>

              <div className="grid gap-3">
                {draftBom.options.map((opt, i) => (
                  <div
                    key={i}
                    className="rounded-lg border p-3 grid grid-cols-1 sm:grid-cols-3 gap-2"
                  >
                    <Input
                      placeholder="Model *"
                      value={opt.model}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDraftBom((p) => {
                          const copy = { ...p };
                          copy.options[i] = { ...copy.options[i], model: v };
                          return copy;
                        });
                      }}
                    />
                    <Input
                      placeholder="Sub Vendor"
                      value={opt.subVendor || ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDraftBom((p) => {
                          const copy = { ...p };
                          copy.options[i] = {
                            ...copy.options[i],
                            subVendor: v,
                          };
                          return copy;
                        });
                      }}
                    />
                    <Input
                      placeholder="Spec"
                      value={opt.spec || ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDraftBom((p) => {
                          const copy = { ...p };
                          copy.options[i] = { ...copy.options[i], spec: v };
                          return copy;
                        });
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="secondary" onClick={() => setBomModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveBom}>
              <Save className="h-4 w-4 mr-2" />
              {editingBom ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SpecificationBuilder;
