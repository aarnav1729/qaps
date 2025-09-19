// src/pages/Customers.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  CalendarClock,
  FileText,
  Plus,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  ArrowUpDown,
  Search,
} from "lucide-react";

const API = window.location.origin;

/** Customer shape used by the API */
export interface Customer {
  id: string;
  name: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  /** Included when `includeCounts=1` on /api/customers */
  salesRequestCount?: number;
}

type SortKey =
  | "name-asc"
  | "name-desc"
  | "newest"
  | "oldest"
  | "most-requests"
  | "least-requests";

const CustomersPage: React.FC = () => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [openModal, setOpenModal] = useState<
    { mode: "create" } | { mode: "edit"; initial: Customer } | null
  >(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name-asc");

  const {
    data: customers = [],
    isLoading,
    error,
  } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      const r = await fetch(`${API}/api/customers?includeCounts=1`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { name: string }) => {
      const r = await fetch(`${API}/api/customers`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      setOpenModal(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (args: { id: string; name: string }) => {
      const r = await fetch(`${API}/api/customers/${args.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: args.name }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      setOpenModal(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${API}/api/customers/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error(await r.text());
      return r.text();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });

  const filtered = useMemo(() => {
    if (!query.trim()) return customers;
    const q = query.toLowerCase();
    return customers.filter((c) => c.name.toLowerCase().includes(q));
  }, [customers, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortKey) {
      case "name-asc":
        arr.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        );
        break;
      case "name-desc":
        arr.sort((a, b) =>
          b.name.localeCompare(a.name, undefined, { sensitivity: "base" })
        );
        break;
      case "newest":
        arr.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
        break;
      case "oldest":
        arr.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
        break;
      case "most-requests":
        arr.sort(
          (a, b) => (b.salesRequestCount ?? 0) - (a.salesRequestCount ?? 0)
        );
        break;
      case "least-requests":
        arr.sort(
          (a, b) => (a.salesRequestCount ?? 0) - (b.salesRequestCount ?? 0)
        );
        break;
      default:
        break;
    }
    return arr;
  }, [filtered, sortKey]);

  const totalRequests = useMemo(
    () => customers.reduce((sum, c) => sum + (c.salesRequestCount ?? 0), 0),
    [customers]
  );

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Page header with gradient and stats */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 p-6 sm:p-8 shadow-lg">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-black/10 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
              Customers
            </h1>
            <p className="text-emerald-50/90 mt-1">
              Manage customer records and jump into their Sales Requests.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setOpenModal({ mode: "create" })}
              className="bg-white text-emerald-700 hover:bg-emerald-50"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New Customer
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="relative z-10 mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="bg-white/10 text-white backdrop-blur-sm border-white/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-xl bg-white/20 p-2">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm text-white/80">Total Customers</div>
                <div className="text-lg font-semibold">{customers.length}</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/10 text-white backdrop-blur-sm border-white/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-xl bg-white/20 p-2">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm text-white/80">
                  Total Sales Requests
                </div>
                <div className="text-lg font-semibold">{totalRequests}</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/10 text-white backdrop-blur-sm border-white/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-xl bg-white/20 p-2">
                <CalendarClock className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm text-white/80">Last Updated</div>
                <div className="text-lg font-semibold">
                  {customers.length
                    ? new Date(
                        Math.max(
                          ...customers.map(
                            (c) => +new Date(c.updatedAt || c.createdAt)
                          )
                        )
                      ).toLocaleString()
                    : "—"}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 w-full sm:w-96">
          <div className="relative w-full">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customers..."
              className="pl-8"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <ArrowUpDown className="mr-2 h-4 w-4" />
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setSortKey("name-asc")}>
                Name (A → Z)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortKey("name-desc")}>
                Name (Z → A)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortKey("newest")}>
                Newest
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortKey("oldest")}>
                Oldest
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortKey("most-requests")}>
                Most Requests
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortKey("least-requests")}>
                Least Requests
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content */}
      <Card className="mt-4">
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-base sm:text-lg">All Customers</CardTitle>
          <Badge variant="secondary" className="rounded-full">
            {sorted.length} shown
          </Badge>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border p-0 overflow-hidden">
                  <div className="p-4 border-b">
                    <Skeleton className="h-5 w-2/3" />
                    <div className="mt-2">
                      <Skeleton className="h-4 w-1/3" />
                    </div>
                  </div>
                  <div className="p-4">
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <div className="p-3 border-t flex items-center justify-between">
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-red-600">
              {(error as any)?.message || "Failed to load customers"}
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14">
              <div className="mb-3 rounded-2xl bg-muted p-4">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No customers found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Try adjusting your search, or create a new customer.
              </p>
              <Button
                className="mt-4"
                onClick={() => setOpenModal({ mode: "create" })}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Customer
              </Button>
            </div>
          ) : (
            <TooltipProvider>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sorted.map((c) => (
                  <div
                    key={c.id}
                    className="group rounded-xl border shadow-sm overflow-hidden bg-card hover:shadow-md transition-shadow"
                  >
                    {/* Header */}
                    <div className="p-4 border-b bg-gradient-to-r from-emerald-50 to-teal-50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-base font-semibold truncate flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-emerald-700" />
                            <span className="truncate">{c.name}</span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5">
                            <CalendarClock className="h-3.5 w-3.5" />
                            Created {new Date(c.createdAt).toLocaleDateString()}
                          </div>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="shrink-0"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              onClick={() =>
                                navigate(
                                  `/sales-requests?customer=${encodeURIComponent(
                                    c.name
                                  )}`
                                )
                              }
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Requests
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                setOpenModal({ mode: "edit", initial: c })
                              }
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Delete customer "${c.name}"? This will not delete existing sales requests.`
                                  )
                                ) {
                                  deleteMutation.mutate(c.id);
                                }
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-4">
                      <div className="text-sm text-foreground flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-teal-700" />
                          Sales Requests
                        </span>
                        <Badge variant="outline" className="rounded-full">
                          {c.salesRequestCount ?? 0}
                        </Badge>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="p-3 border-t bg-muted/30 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                navigate(
                                  `/sales-requests?customer=${encodeURIComponent(
                                    c.name
                                  )}`
                                )
                              }
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Open Sales Requests</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                setOpenModal({ mode: "edit", initial: c })
                              }
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit customer name</TooltipContent>
                        </Tooltip>
                      </div>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete customer "${c.name}"? This will not delete existing sales requests.`
                                )
                              ) {
                                deleteMutation.mutate(c.id);
                              }
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete customer</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>

      {openModal && (
        <CustomerModal
          mode={openModal.mode}
          initial={openModal.mode === "edit" ? openModal.initial : undefined}
          onClose={() => setOpenModal(null)}
          onCreate={(name) => createMutation.mutate({ name })}
          onUpdate={(id, name) => updateMutation.mutate({ id, name })}
          busy={createMutation.isPending || updateMutation.isPending}
          errorMsg={
            (createMutation.error as any)?.message ||
            (updateMutation.error as any)?.message ||
            ""
          }
        />
      )}
    </div>
  );
};

const CustomerModal: React.FC<{
  mode: "create" | "edit";
  initial?: Customer;
  onClose: () => void;
  onCreate: (name: string) => void;
  onUpdate: (id: string, name: string) => void;
  busy: boolean;
  errorMsg?: string;
}> = ({ mode, initial, onClose, onCreate, onUpdate, busy, errorMsg }) => {
  const [name, setName] = useState(initial?.name ?? "");

  useEffect(() => {
    if (mode === "edit" && initial) setName(initial.name);
  }, [mode, initial]);

  const canSubmit = name.trim().length > 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create Customer" : "Edit Customer"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Add a new customer you can associate Sales Requests with."
              : "Update the customer name."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="customer-name">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <Input
              id="customer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., ACME Power Pvt Ltd"
              autoFocus
            />
          </div>
          {!!errorMsg && <div className="text-sm text-red-600">{errorMsg}</div>}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={!canSubmit || busy}
            onClick={() => {
              const trimmed = name.trim();
              if (!trimmed) return;
              if (mode === "create") onCreate(trimmed);
              else if (initial) onUpdate(initial.id, trimmed);
            }}
          >
            {busy ? "Saving…" : mode === "create" ? "Create" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CustomersPage;
