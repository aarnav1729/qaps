import React, { useMemo, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import BrandedLoadingScreen from "@/components/BrandedLoadingScreen";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  VENDOR_NAME_LOCKIN,
  RFID_LOCATION_LOCKIN,
} from "@/data/bomMaster";
import { Badge } from "@/components/ui/badge";
import InteractiveTutorialCard from "@/components/tutorial/InteractiveTutorialCard";
import { useTutorialMode } from "@/hooks/useTutorialMode";
import { cn } from "@/lib/utils";
import {
  getBomComponentNames,
  getBomOptionsFor,
  type BomMasterComponent,
  type BomMasterOption,
} from "@/lib/bomMasterData";

const API = window.location.origin;

type YesNo = "yes" | "no";
type Plant = "P2" | "P4" | "P5" | "P6";

// DCR/NDCR flag (keeps the same field name 'cellType' on the object)
type DcrCompliance = "DCR" | "NDCR";

// New sub-dropdowns under Module Order Type
type CellType = "M10" | "G12" | "G12R";
type CellTech = "PERC" | "TOPCon";
type CutCells = "60" | "66" | "72" | "78";
type QapType = "Customer" | "Premier Energies";
type Priority = "high" | "low";

// ── Product Category (dropdown) ─────────────────────────────────────────────
type ProductCategory =
  | "MonoPERC Monofacial-M10- 515-555Wp"
  | "MonoPERC Bifacial – TBS-M10-525-555Wp"
  | "MonoPERC Bifacial – G2G-M10-530-560Wp"
  | "TOPCON Bifacial -G2G-M10-10BB-560-590Wp"
  | "TOPCON Bifacial -G2G-M10-16BB-560-590Wp"
  | "TOPCON Bifacial -G2G-G12R-16BB-600-630Wp"
  | "TOPCON Bifacial -G2G-G12-18BB-680-710Wp";

const PRODUCT_CATEGORY_OPTIONS: ProductCategory[] = [
  "MonoPERC Monofacial-M10- 515-555Wp",
  "MonoPERC Bifacial – TBS-M10-525-555Wp",
  "MonoPERC Bifacial – G2G-M10-530-560Wp",
  "TOPCON Bifacial -G2G-M10-10BB-560-590Wp",
  "TOPCON Bifacial -G2G-M10-16BB-560-590Wp",
  "TOPCON Bifacial -G2G-G12R-16BB-600-630Wp",
  "TOPCON Bifacial -G2G-G12-18BB-680-710Wp",
];

// One record drives ALL 6 derived fields (no separate watt options).
const PRODUCT_CATEGORY_MATRIX: Record<
  ProductCategory,
  {
    // 6 derived fields
    cellTech: "PERC" | "TOPCon";
    moduleCellType: "M10" | "G12" | "G12R";
    cutCells: "60" | "66" | "72" | "78";
    model: string;
    dimOptions: string[]; // keep as array for future variability
    minWattPeak: number; // numeric (from CSV)
    // convenience for UI/BOM labels
    wattPeakLabel?: string; // computed "MIN {minWattPeak} WP"
  }
> = {
  "MonoPERC Monofacial-M10- 515-555Wp": {
    cellTech: "PERC",
    moduleCellType: "M10",
    cutCells: "72",
    model: "PE-XXX-HM",
    dimOptions: ["2278x1134x35x33/18 mm"],
    minWattPeak: 515,
  },
  "MonoPERC Bifacial – TBS-M10-525-555Wp": {
    cellTech: "PERC",
    moduleCellType: "M10",
    cutCells: "72",
    model: "PE-XXX-HB",
    dimOptions: ["2278x1134x35x33/18 mm"],
    minWattPeak: 525,
  },
  "MonoPERC Bifacial – G2G-M10-530-560Wp": {
    cellTech: "PERC",
    moduleCellType: "M10",
    cutCells: "72",
    model: "PEI-144-XXX-HGB-M10",
    dimOptions: ["2278x1134x35x33/18 mm"],
    minWattPeak: 530,
  },
  "TOPCON Bifacial -G2G-M10-10BB-560-590Wp": {
    cellTech: "TOPCon",
    moduleCellType: "M10",
    cutCells: "72",
    model: "PEI-144-XXX-THGB-M10",
    dimOptions: ["2278x1134x35x33/18 mm"],
    minWattPeak: 560,
  },
  "TOPCON Bifacial -G2G-M10-16BB-560-590Wp": {
    cellTech: "TOPCon",
    moduleCellType: "M10",
    cutCells: "72",
    model: "PEI-144-XXX-THGB-M10",
    dimOptions: ["2278x1134x35x33/18 mm"],
    minWattPeak: 560,
  },
  "TOPCON Bifacial -G2G-G12R-16BB-600-630Wp": {
    cellTech: "TOPCon",
    moduleCellType: "G12R",
    cutCells: "66",
    model: "PEI-132-XXX-THGB-G12R",
    dimOptions: ["2382x1134x35x35 mm"],
    minWattPeak: 600,
  },
  "TOPCON Bifacial -G2G-G12-18BB-680-710Wp": {
    cellTech: "TOPCon",
    moduleCellType: "G12",
    cutCells: "66",
    model: "PEI-132-XXX-THGB-G12",
    dimOptions: ["2382x1303x30x30/15 mm"],
    minWattPeak: 680,
  },
};

// helper for label
const labelForMin = (n: number) => (Number.isFinite(n) ? `MIN ${n} WP` : "");

// Use Model No. (preferred) or sanitized category as the Document-Ref tag
const categoryDocTag = (cat?: ProductCategory | "") => {
  if (!cat) return "";
  const row = PRODUCT_CATEGORY_MATRIX[cat as ProductCategory];
  const base = row?.model || String(cat);
  return base.replace(/\s+/g, "").replace(/[–—]/g, "-"); // keep hyphens in model codes
};

export interface SalesRequest {
  id: string;
  projectCode: string;
  customerName: string;

  moduleManufacturingPlant: Plant;

  // Existing field kept; now represents DCR/NDCR compliance (label changed in UI)
  cellType: DcrCompliance;
  // NEW: optional sub-fields (frontend-safe, optional until backend persists them)
  moduleCellType?: CellType | null; // M10/M10R/G12/G12R
  cellTech?: CellTech | null; // PERC/TOPCon
  cutCells?: string | null; // "60" | "66" | "72" | "78"
  // in interface SalesRequest
  certificationRequired?:
    | "BIS"
    | "IEC"
    | "BIS + IEC"
    | "BIS + IEC + 3xIEC"
    | "Not Required";

  wattageBinningDist?: { range: string; pct: number }[];
  rfqOrderQtyMW: number;
  premierBiddedOrderQtyMW?: number | null;
  deliveryStartDate: string; // YYYY-MM-DD
  deliveryEndDate: string; // YYYY-MM-DD
  projectLocation: string;
  cableLengthRequired: number;
  qapType: QapType;
  qapTypeAttachmentUrl?: string | null;
  bomFrom?: "Customer" | "Premier Energies";
  primaryBomAttachmentUrl?: string | null;
  inlineInspection: YesNo;
  pdi?: YesNo;
  cellProcuredBy: "Customer" | "Premier Energies" | "Financed By Customer";
  agreedCTM: number;
  factoryAuditTentativeDate?: string | null; // YYYY-MM-DD
  xPitchMm?: number | null;
  trackerDetails?: number | null;
  priority: Priority;
  remarks?: string | null;
  otherAttachments?: { title: string; url: string }[];
  createdBy: string;
  createdAt: string; // ISO
  bom?: BomPayload | null;
}

// Minimal QAP shape for linking to Sales Requests
type QapLite = {
  id: string;
  status?: string | null;
  currentLevel?: number | null;
  salesRequestId?: string | null;
  sales_request_id?: string | null;
  salesRequestID?: string | null;
  projectCode?: string | null;
  project_code?: string | null;
  submittedAt?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  salesRequest?: { id?: string | null; projectCode?: string | null } | null;
};

// Safe string coercion (same spirit as QAPTable)
const toStr = (v: any) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return String(v);
  } catch {
    return "";
  }
};

const qapTime = (q: any) => {
  const t =
    q?.updatedAt ??
    q?.submittedAt ??
    q?.createdAt ??
    q?.updated_at ??
    q?.submitted_at ??
    q?.created_at;
  const dt = t ? new Date(String(t)) : null;
  return dt && !Number.isNaN(dt.getTime()) ? dt.getTime() : 0;
};

const pickNewest = (a: any, b: any) => (qapTime(b) >= qapTime(a) ? b : a);

/* ────────────────────────────────────────────────────────────────────────── */
/*  BOM types                                                                */
/* ────────────────────────────────────────────────────────────────────────── */
type BomRow = {
  model: string;
  subVendor?: string | null;
  spec?: string | null;
};
type BomComponent = {
  name: string;
  rows: BomRow[];
};

type BomPayload = {
  vendorName: string; // lock-in
  rfidLocation: string; // lock-in
  vendorAddress: string;
  documentRef: string; // auto
  moduleDimensionsOption: string;
  moduleModelNumber: string;
  components: BomComponent[];
  wattPeakLabel?: string;
};

/* ────────────────────────────────────────────────────────────────────────── */
/*  History types                                                            */
/* ────────────────────────────────────────────────────────────────────────── */
type HistoryChange = { field: string; before: any; after: any };
type HistoryItem = {
  id: number;
  salesRequestId: string;
  action: string; // "create" | "update" | ...
  changedBy: string;
  changedAt: string; // ISO
  changes?: HistoryChange[] | null;
};

type GuidedFieldKey =
  | "customerName"
  | "plant"
  | "productCategory"
  | "moduleCellType"
  | "cellTech"
  | "cutCells"
  | "wattPeak"
  | "moduleModelNumber"
  | "vendorNameLockIn"
  | "rfidLocation"
  | "moduleDimensions"
  | "vendorAddress"
  | "documentRef"
  | "cellType"
  | "wattageBinning"
  | "deliveryTimeline"
  | "projectLocation"
  | "rfqOrderQtyMW"
  | "premierBiddedOrderQtyMW"
  | "qapType"
  | "qapAttachment"
  | "bomFrom"
  | "bomAttachment"
  | "inlineInspection"
  | "pdi"
  | "certificationRequired"
  | "cellProcuredBy"
  | "agreedCTM"
  | "factoryAuditDate"
  | "cableLengthRequired"
  | "xPitchMm"
  | "trackerDetails"
  | "priority"
  | "remarks"
  | "otherAttachments"
  | "bomReview";

type GuideStep = {
  key: GuidedFieldKey;
  label: string;
  hint: string;
  required: boolean;
  visible: boolean;
  complete: boolean;
};

// Link Module Manufacturing Plant => Solar Module Vendor Address
const PLANT_VENDOR_ADDRESS: Record<Plant, string> = {
  P2: "PEPPL",
  P4: "PEIPL",
  P5: "PEGEPL I",
  P6: "PEGEPL II",
};

const evaluateWattageBins = (rows: { range: string; pct: string }[]) => {
  const nonEmpty = rows.filter(
    (row) => row.range.trim() !== "" || row.pct.trim() !== ""
  );
  const sum = nonEmpty.reduce((acc, row) => acc + (Number(row.pct) || 0), 0);
  const valid = Math.abs(sum - 100) < 0.001 && nonEmpty.length >= 1;

  return {
    nonEmpty,
    sum,
    valid,
  };
};

const SalesRequestsPage: React.FC = () => {
  const location = useLocation();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [openCreate, setOpenCreate] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<SalesRequest | null>(null);

  const { data: list = [], isLoading } = useQuery<SalesRequest[]>({
    queryKey: ["sales-requests"],
    queryFn: async () => {
      const r = await fetch(`${API}/api/sales-requests`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to load sales requests");
      return r.json();
    },
  });

  // ---------------------------------------------------------------------------
  // Linked QAP status support (soft-fail if API not available)
  // ---------------------------------------------------------------------------
  const { data: qapList = [] } = useQuery<QapLite[]>({
    queryKey: ["qap-lite-for-sales-requests"],
    queryFn: async () => {
      const endpoints = [`${API}/api/qaps`, `${API}/api/qap`];

      for (const url of endpoints) {
        try {
          const r = await fetch(url, { credentials: "include" });
          if (!r.ok) continue;

          const json = await r.json();

          // Support common shapes: array or { data: [] }
          const arr = Array.isArray(json)
            ? json
            : Array.isArray((json as any)?.data)
            ? (json as any).data
            : [];

          if (!Array.isArray(arr)) continue;

          // normalize minimal needed fields
          return arr.map((q: any) => ({
            id: toStr(q?.id),
            status: toStr(q?.status) || null,
            currentLevel:
              q?.currentLevel != null ? Number(q.currentLevel) : null,
            salesRequestId:
              toStr(
                q?.salesRequestId ??
                  q?.sales_request_id ??
                  q?.salesRequestID ??
                  q?.salesRequest?.id ??
                  q?.requestId
              ) || null,
            projectCode:
              toStr(
                q?.projectCode ??
                  q?.project_code ??
                  q?.salesRequest?.projectCode
              ) || null,
            submittedAt: toStr(q?.submittedAt) || null,
            updatedAt: toStr(q?.updatedAt) || null,
            createdAt: toStr(q?.createdAt) || null,
          }));
        } catch {
          // ignore and try next endpoint
        }
      }

      return [];
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  const { data: bomMasterComponents = [] } = useQuery<BomMasterComponent[]>({
    queryKey: ["bom-master-components", "sales-request"],
    queryFn: async () => {
      const r = await fetch(`${API}/api/bom-components`, {
        credentials: "include",
      });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  const qapBySalesRequestId = useMemo(() => {
    const m = new Map<string, QapLite>();
    for (const q of qapList) {
      const srId = toStr(q?.salesRequestId).trim();
      if (!srId) continue;
      const prev = m.get(srId);
      m.set(srId, prev ? pickNewest(prev, q) : q);
    }
    return m;
  }, [qapList]);

  const qapByProjectCode = useMemo(() => {
    const m = new Map<string, QapLite>();
    for (const q of qapList) {
      const pc = toStr(q?.projectCode).trim();
      if (!pc) continue;
      const prev = m.get(pc);
      m.set(pc, prev ? pickNewest(prev, q) : q);
    }
    return m;
  }, [qapList]);

  const getLinkedQap = (sr: SalesRequest) => {
    if (sr?.id) {
      const byId = qapBySalesRequestId.get(sr.id);
      if (byId) return byId;
    }
    const pc = toStr(sr?.projectCode).trim();
    if (pc) {
      const byPc = qapByProjectCode.get(pc);
      if (byPc) return byPc;
    }
    return null;
  };

  const renderQapStatusBadge = (statusRaw?: string | null) => {
    const status = String(statusRaw || "").trim();

    const colors = {
      draft: "bg-gray-100 text-gray-800",
      submitted: "bg-yellow-100 text-yellow-800",
      "level-2": "bg-orange-100 text-orange-800",
      "level-3": "bg-purple-100 text-purple-800",
      "level-4": "bg-indigo-100 text-indigo-800",
      "final-comments": "bg-blue-100 text-blue-800",
      "level-5": "bg-green-100 text-green-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
      "edit-requested": "bg-orange-100 text-orange-800",
    } as const;

    if (!status) {
      return <span className="text-gray-400">No QAP</span>;
    }

    return (
      <Badge
        className={`${
          colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800"
        } capitalize`}
      >
        {status.replace("-", " ")}
      </Badge>
    );
  };

  // Optional client-side filter via ?customer=NAME
  const customerFilter = useMemo(() => {
    const qs = new URLSearchParams(location.search);
    const v = qs.get("customer");
    return v ? v.trim() : "";
  }, [location.search]);
  const rows = useMemo(
    () =>
      customerFilter
        ? list.filter((r) => (r.customerName || "").trim() === customerFilter)
        : list,
    [list, customerFilter]
  );

  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const r = await fetch(`${API}/api/sales-requests`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(t || "Failed to create sales request");
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales-requests"] });
      setOpenCreate(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      formData,
    }: {
      id: string;
      formData: FormData;
    }) => {
      const r = await fetch(`${API}/api/sales-requests/${id}`, {
        method: "PUT",
        credentials: "include",
        body: formData,
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(t || "Failed to update sales request");
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales-requests"] });
      setEditItem(null);
    },
  });

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Sales Requests</CardTitle>
          <Button
            onClick={() => setOpenCreate(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            + Create New
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <BrandedLoadingScreen
              message="Loading sales requests"
              subtitle="Pulling the latest request list and linked workflow status."
              className="min-h-[280px]"
            />
          ) : rows.length === 0 ? (
            <div className="text-gray-600">No sales requests yet.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full border divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left">
                    <Th>Actions</Th>
                    <Th>Customer Name</Th>
                    <Th>QAP Status</Th>
                    <Th>Project Code</Th>
                    <Th>Plant</Th>
                    <Th>DCR Compliance?</Th>
                    <Th>Tentative Wattage Binning</Th>
                    <Th>RFQ Qty (MW)</Th>
                    <Th>Premier Bidded Qty (MW)</Th>
                    <Th>Delivery Timeline</Th>
                    <Th>Project Location</Th>
                    <Th>JB Cable Length</Th>
                    <Th>QAP From</Th>
                    
                    <Th>BOM From</Th>
                    <Th>Inline Inspection</Th>
                    <Th>PDI</Th>
                    <Th>Cell Procured By</Th>
                    <Th>Agreed CTM</Th>
                    <Th>Audit Date</Th>
                    <Th>X Pitch (mm)</Th>
                    <Th>Tracker (790/1400mm)</Th>
                    <Th>Priority</Th>
                    <Th>Remarks</Th>
                    <Th>Attachments</Th>
                    <Th>Created By</Th>
                    <Th>Created At</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row) => (
                    <tr key={row.id} className="align-top">
                      <Td>
                        <div className="flex items-center gap-2">
                          <button
                            title="View"
                            className="px-2 py-1 rounded hover:bg-gray-100 border"
                            onClick={() => setViewId(row.id)}
                          >
                            👁️
                          </button>
                          <button
                            title="Edit"
                            className="px-2 py-1 rounded hover:bg-gray-100 border"
                            onClick={() => setEditItem(row)}
                          >
                            ✏️
                          </button>
                        </div>
                      </Td>
                      <Td>{row.customerName}</Td>
                      <Td>{renderQapStatusBadge(getLinkedQap(row)?.status)}</Td>
                      <Td className="font-mono text-xs">
                        {row.projectCode || "-"}
                      </Td>{" "}
                      <Td className="uppercase">
                        {row.moduleManufacturingPlant}
                      </Td>
                      <Td>{row.cellType}</Td>
                      <Td>
                        {row.wattageBinningDist?.length ? (
                          <ul className="list-disc pl-5 space-y-0.5">
                            {row.wattageBinningDist.map((b, i) => (
                              <li key={i}>
                                {b.range}: {fmtDec(b.pct)}%
                              </li>
                            ))}
                          </ul>
                        ) : (
                          "-"
                        )}
                      </Td>
                      <Td>{fmtNum(row.rfqOrderQtyMW)}</Td>
                      <Td>{row.premierBiddedOrderQtyMW ?? "-"}</Td>
                      <Td>
                        {row.deliveryStartDate} → {row.deliveryEndDate}
                      </Td>
                      <Td>{row.projectLocation}</Td>
                      <Td>{fmtNum(row.cableLengthRequired)}</Td>
                      <Td>
                        {row.qapType}
                        {row.qapTypeAttachmentUrl && (
                          <>
                            <br />
                            <a
                              href={row.qapTypeAttachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 underline"
                            >
                              View QAP From Attachment
                            </a>
                          </>
                        )}
                      </Td>
                      
                      <Td>
                        {row.bomFrom || "-"}
                        {row.primaryBomAttachmentUrl && (
                          <>
                            <br />
                            <a
                              href={row.primaryBomAttachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 underline"
                            >
                              View BOM file
                            </a>
                          </>
                        )}
                      </Td>
                      <Td className="capitalize">{row.inlineInspection}</Td>
                      <Td className="capitalize">{row.pdi ?? "-"}</Td>{" "}
                      <Td>{row.cellProcuredBy}</Td>
                      <Td>{fmtDec(row.agreedCTM)}</Td>
                      <Td>{row.factoryAuditTentativeDate || "-"}</Td>
                      <Td>{row.xPitchMm ?? "-"}</Td>
                      <Td>{row.trackerDetails ?? "-"}</Td>
                      <Td className="capitalize">{row.priority}</Td>
                      <Td
                        className="max-w-[18rem] truncate"
                        title={row.remarks || ""}
                      >
                        {row.remarks || "-"}
                      </Td>
                      <Td>
                        {row.otherAttachments?.length ? (
                          <ul className="list-disc pl-5 space-y-1">
                            {row.otherAttachments.map((a, i) => (
                              <li key={i}>
                                <a
                                  href={a.url}
                                  className="text-blue-600 underline"
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {a.title || `Attachment ${i + 1}`}
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          "-"
                        )}
                      </Td>
                      <Td>{row.createdBy}</Td>
                      <Td>{new Date(row.createdAt).toLocaleString()}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {openCreate && (
        <SalesRequestModal
          mode="create"
          onClose={() => setOpenCreate(false)}
          onCreate={(form) => createMutation.mutate(form)}
          creating={createMutation.isPending}
          currentUser={user?.username || "sales"}
          prefillCustomerName={customerFilter}
          bomMasterComponents={bomMasterComponents}
        />
      )}

      {editItem && (
        <SalesRequestModal
          mode="edit"
          initial={editItem}
          onClose={() => setEditItem(null)}
          onUpdate={(id, form) => updateMutation.mutate({ id, formData: form })}
          creating={updateMutation.isPending}
          currentUser={user?.username || "sales"}
          bomMasterComponents={bomMasterComponents}
        />
      )}

      {viewId && (
        <ViewSalesRequestModal
          id={viewId}
          onClose={() => setViewId(null)}
          onEdit={(data) => {
            setViewId(null);
            setEditItem(data);
          }}
        />
      )}
    </div>
  );
};

const Th: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
    {children}
  </th>
);
const Td: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <td className={`px-3 py-2 whitespace-nowrap ${className || ""}`}>
    {children}
  </td>
);

function fmtNum(n?: number | null) {
  if (n === null || n === undefined) return "-";
  return Number(n).toLocaleString();
}
function fmtDec(n?: number | null) {
  if (n === null || n === undefined) return "-";
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 4 });
}
function displayInt(s: any) {
  if (s === "" || s === null || s === undefined) return "-";
  const n = Number(s);
  return Number.isFinite(n) ? fmtNum(n) : "-";
}
function displayFloat(s: any) {
  if (s === "" || s === null || s === undefined) return "-";
  const n = Number(s);
  return Number.isFinite(n) ? fmtDec(n) : "-";
}

// Normalize anything like "2025-09-16T00:00:00.000Z" → "2025-09-16" for <input type="date">
function toYMD(d?: string | null) {
  if (!d) return "";
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
}

// Builds something like: SR-CUS-P5-G12R-20250916-0001
function genProjectCode({
  customerName,
  plant,
  orderTag,
  date,
}: {
  customerName: string;
  plant: string; // "P2" | "P5" | "P6"
  orderTag: string; // "M10" | "G12" | "G12R"
  date?: string; // YYYY-MM-DD (optional; falls back to today)
}) {
  const cus3 =
    (customerName || "CUS")
      .replace(/[^A-Za-z]/g, "")
      .toUpperCase()
      .slice(0, 3) || "CUS";
  const plantTag = (plant || "P?").toUpperCase();
  const ord = (orderTag || "M10").toUpperCase();
  const d = date ? new Date(date) : new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  const seq = "0001"; // FE placeholder; let BE replace with a real sequence if desired
  return `SR-${cus3}-${plantTag}-${ord}-${yyyy}${mm}${dd}-${seq}`;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Modal: Create + Edit (single component)                                  */
/* ────────────────────────────────────────────────────────────────────────── */
const SalesRequestModal: React.FC<{
  mode?: "create" | "edit";
  initial?: SalesRequest | null;
  onClose: () => void;
  onCreate?: (formData: FormData) => void;
  onUpdate?: (id: string, formData: FormData) => void;
  creating: boolean;
  currentUser: string;
  prefillCustomerName?: string;
  bomMasterComponents: BomMasterComponent[];
}> = ({
  mode = "create",
  initial,
  onClose,
  onCreate,
  onUpdate,
  creating,
  currentUser,
  prefillCustomerName = "",
  bomMasterComponents,
}) => {
  const [tutorialMode, setTutorialMode] = useTutorialMode(
    "sales-request-tutorial",
    true
  );
  const [skippedGuideSteps, setSkippedGuideSteps] = useState<
    Partial<Record<GuidedFieldKey, boolean>>
  >({});
  const [selectedGuideStep, setSelectedGuideStep] =
    useState<GuidedFieldKey | null>(null);
  const componentNames = useMemo(
    () => getBomComponentNames(bomMasterComponents),
    [bomMasterComponents]
  );
  const bomOptionsFor = (name: string) =>
    getBomOptionsFor(bomMasterComponents, name);

  // Core request fields (store numbers as strings for smooth typing)
  const [state, setState] = useState({
    customerName: prefillCustomerName || "",
    moduleManufacturingPlant: "P2" as Plant,

    cellType: "DCR" as DcrCompliance, // relabeled to "DCR Compliance?" in UI+    // NEW (all optional → empty string means "unset"; no save blocker)
    productCategory: "" as "" | ProductCategory,
    moduleCellType: "" as "" | CellType,
    cellTech: "" as "" | CellTech,
    cutCells: "" as "" | CutCells,
    // in useState for modal state (SalesRequestModal)
    certificationRequired: "Not Required" as
      | "BIS"
      | "IEC"
      | "BIS + IEC"
      | "BIS + IEC + 3xIEC"
      | "Not Required",

    rfqOrderQtyMW: "" as string,
    premierBiddedOrderQtyMW: "" as string,
    deliveryStartDate: "",
    deliveryEndDate: "",
    projectLocation: "",
    cableLengthRequired: "" as string,
    qapType: "Premier Energies" as QapType,
    bomFrom: "Premier Energies" as "Customer" | "Premier Energies",
    inlineInspection: "no" as YesNo,
    pdi: "no" as YesNo,
    cellProcuredBy: "Customer" as
      | "Customer"
      | "Premier Energies"
      | "Financed By Customer",
    agreedCTM: "" as string, // decimal string
    factoryAuditTentativeDate: "",
    xPitchMm: "" as string,
    trackerDetails: "" as string,
    priority: "low" as Priority,
    remarks: "",
  });

  // Attachments (when editing, leaving them empty keeps existing files)
  const [qapTypeFile, setQapTypeFile] = useState<File | null>(null);
  const [primaryBomFile, setPrimaryBomFile] = useState<File | null>(null);
  const [otherFiles, setOtherFiles] = useState<
    { title: string; file: File | null }[]
  >([]);

  // 🔗 Blob URLs for preview links
  const [qapPreviewUrl, setQapPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (qapTypeFile) {
      const u = URL.createObjectURL(qapTypeFile);
      setQapPreviewUrl(u);
      return () => URL.revokeObjectURL(u);
    }
    setQapPreviewUrl(null);
  }, [qapTypeFile]);

  const [bomPreviewUrl, setBomPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (primaryBomFile) {
      const u = URL.createObjectURL(primaryBomFile);
      setBomPreviewUrl(u);
      return () => URL.revokeObjectURL(u);
    }
    setBomPreviewUrl(null);
  }, [primaryBomFile]);

  const [otherPreviewUrls, setOtherPreviewUrls] = useState<(string | null)[]>(
    []
  );
  useEffect(() => {
    const urls = otherFiles.map((o) =>
      o.file ? URL.createObjectURL(o.file) : null
    );
    setOtherPreviewUrls(urls);
    return () => {
      urls.forEach((u) => u && URL.revokeObjectURL(u));
    };
  }, [otherFiles]);

  // Wattage binning/distribution rows (string form for smooth typing)
  const [wattBins, setWattBins] = useState<{ range: string; pct: string }[]>([
    { range: "", pct: "" },
    { range: "", pct: "" },
    { range: "", pct: "" },
  ]);

  const [vendorAddress, setVendorAddress] = useState("");

  const [moduleDimensionsOption, setModuleDimensionsOption] =
    useState<string>(""); // dimension string
  const [moduleModelNumber, setModuleModelNumber] = useState("");
  const [wattPeakLabel, setWattPeakLabel] = useState<string>(""); // "MIN 575 WP" / "MIN 700 WP" / etc
  const [components, setComponents] = useState<BomComponent[]>([]);
  const [docRef, setDocRef] = useState("");
  const [projectCode, setProjectCode] = useState("");

  // Model-picker modal state (scoped to SalesRequestModal)
  const [modelDialog, setModelDialog] = useState<
    { open: false } | { open: true; comp: string; idx: number }
  >({ open: false });

  const openModelDialog = (comp: string, idx: number) =>
    setModelDialog({ open: true, comp, idx });

  const closeModelDialog = () => setModelDialog({ open: false });

  // Preview toggle
  const [showPreview, setShowPreview] = useState(false);
  const [bomOpen, setBomOpen] = useState(false);

  // Pre-populate all components by default on create
  useEffect(() => {
    if (mode === "create") {
      const all = componentNames.map((name) => {
          const opts = bomOptionsFor(name);
          // default one row; if there is exactly one option (e.g., RFID Tag) preselect it
          const defaultRow: BomRow =
            opts.length === 1
              ? {
                  model: opts[0].model,
                  subVendor: opts[0].subVendor ?? null,
                  spec: opts[0].spec ?? null,
                }
              : { model: "", subVendor: null, spec: null };
          return { name, rows: [defaultRow] };
        });
      setComponents((prev) => (prev.length ? prev : all));
    }
  }, [mode, componentNames]);

  useEffect(() => {
    // If editing and the item already has a projectCode, keep it.
    if (mode === "edit" && initial?.projectCode) {
      setProjectCode(initial.projectCode);
      return;
    }
    // Use Cell Type (M10/G12/G12R) for order tag
    const orderTag = state.moduleCellType || "M10";

    // Use deliveryStartDate if present so it's stable across a session
    setProjectCode(
      genProjectCode({
        customerName: state.customerName,
        plant: state.moduleManufacturingPlant,
        orderTag,
        date: state.deliveryStartDate || undefined,
      })
    );
  }, [
    mode,
    initial?.projectCode,
    state.customerName,
    state.moduleManufacturingPlant,
    state.moduleCellType,
    state.deliveryStartDate,
  ]);

  // Pre-fill when editing
  useEffect(() => {
    if (mode === "edit" && initial) {
      setState({
        customerName: initial.customerName || "",
        moduleManufacturingPlant: String(
          initial.moduleManufacturingPlant
        ).toUpperCase() as Plant,
        cellType: initial.cellType || "DCR",
        productCategory: "",
        // NEW: hydrate if backend starts returning them; else stay ""
        moduleCellType:
          (initial as any).moduleCellType &&
          String((initial as any).moduleCellType)
            ? (String((initial as any).moduleCellType) as CellType)
            : "",
        cellTech:
          (initial as any).cellTech && String((initial as any).cellTech)
            ? (String((initial as any).cellTech) as CellTech)
            : "",
        cutCells:
          (initial as any).cutCells != null
            ? (String((initial as any).cutCells) as CutCells)
            : "",
        certificationRequired:
          (initial as any).certificationRequired &&
          String((initial as any).certificationRequired)
            ? (String((initial as any).certificationRequired) as
                | "BIS"
                | "IEC"
                | "BIS + IEC"
                | "BIS + IEC + 3xIEC"
                | "Not Required")
            : "Not Required",

        rfqOrderQtyMW:
          initial.rfqOrderQtyMW != null ? String(initial.rfqOrderQtyMW) : "",
        premierBiddedOrderQtyMW:
          initial.premierBiddedOrderQtyMW != null
            ? String(initial.premierBiddedOrderQtyMW)
            : "",
        deliveryStartDate: toYMD(initial.deliveryStartDate) || "",
        deliveryEndDate: toYMD(initial.deliveryEndDate) || "",
        projectLocation: initial.projectLocation || "",
        cableLengthRequired:
          initial.cableLengthRequired != null
            ? String(initial.cableLengthRequired)
            : "",
        qapType: initial.qapType || "Premier Energies",
        bomFrom: initial.bomFrom || "Premier Energies",
        inlineInspection: initial.inlineInspection || "no",
        pdi: (initial as any).pdi || "no",
        cellProcuredBy: initial.cellProcuredBy || "Customer",
        agreedCTM: initial.agreedCTM != null ? String(initial.agreedCTM) : "",
        factoryAuditTentativeDate:
          toYMD(initial.factoryAuditTentativeDate) || "",
        xPitchMm: initial.xPitchMm != null ? String(initial.xPitchMm) : "",
        trackerDetails:
          initial.trackerDetails != null ? String(initial.trackerDetails) : "",
        priority: initial.priority || "low",
        remarks: initial.remarks || "",
      });

      // Wattage distribution: prefer new array, else map legacy number -> one row @100%
      if (initial.wattageBinningDist && initial.wattageBinningDist.length) {
        setWattBins(
          initial.wattageBinningDist.map((r) => ({
            range: r.range || "",
            pct: r.pct != null ? String(r.pct) : "",
          }))
        );
      } else {
        setWattBins([{ range: "", pct: "" }]);
      }
    }
  }, [mode, initial]);

  // ✅ hydrate BOM editor when opening Edit
  useEffect(() => {
    if (mode !== "edit") return;

    if (!initial?.bom) {
      // keep a visible skeleton so the editor isn't blank
      setComponents((prev) =>
        prev.length
          ? prev
          : componentNames.map((name) => ({
              name,
              rows: [],
            }))
      );
      return;
    }

    const b = initial.bom;
    setVendorAddress(b.vendorAddress || "");
    setModuleDimensionsOption(b.moduleDimensionsOption || "");
    setModuleModelNumber(b.moduleModelNumber || "");
    setWattPeakLabel(b.wattPeakLabel || "");
    setDocRef(b.documentRef || "");
    setComponents(
      b.components && b.components.length
        ? b.components
        : componentNames.map((name) => ({
            name,
            rows: [],
          }))
    );
  }, [mode, initial, componentNames]);

  // Auto-generate Document Ref when customer/tech/date change (only if docRef not prefilled)
  useEffect(() => {
    // Preserve an existing docRef during edit
    if (mode === "edit" && initial?.bom?.documentRef) return;

    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    const dateStr = `${dd}-${mm}-${yyyy}`;

    const cus3 =
      (state.customerName || "CUS")
        .replace(/[^A-Za-z]/g, "")
        .slice(0, 3)
        .toUpperCase() || "CUS";

    const seq = "0001"; // FE placeholder; BE can override

    // ✅ derive from Product Category (use Model code if available)
    const catTag = categoryDocTag(state.productCategory) || "GEN";

    const ref = `BOM_${cus3}_${catTag} Rev.0, ${dateStr}: BOM-${cus3}-${seq}-${yyyy}${mm}${dd}`;
    setDocRef(ref);

    // depend on category & customer (no need for 'tech' anymore)
  }, [
    state.customerName,
    state.productCategory,
    mode,
    initial?.bom?.documentRef,
  ]);

  // When plant changes: set vendor address from matrix; keep dim behavior.
  // NOTE: Plant no longer influences Watt Peak or Module Model Number.
  // When plant changes: set vendor address only (do NOT override category-driven dims)
  useEffect(() => {
    const plant = state.moduleManufacturingPlant as Plant;
    setVendorAddress(PLANT_VENDOR_ADDRESS[plant] || "");
  }, [state.moduleManufacturingPlant]);

  const canSubmit = useMemo(() => {
    // In EDIT mode allow saving with minimal/partial data.
    if (mode === "edit") return true;

    // CREATE mode: keep stricter validation
    const basicsOk =
      state.customerName.trim() &&
      state.deliveryStartDate &&
      state.deliveryEndDate &&
      state.projectLocation.trim() &&
      Number(state.rfqOrderQtyMW) > 0;

    // Low-friction share: components may be empty/placeholder.
    const bomOk = !!moduleModelNumber.trim() && !!wattPeakLabel;

    const hasQapAttachment = state.qapType !== "Customer" || !!qapTypeFile;

    const nonEmptyRows = wattBins.filter(
      (r) => r.range.trim() !== "" || r.pct.trim() !== ""
    );
    const pctNums = nonEmptyRows.map((r) => Number(r.pct));
    const allPctsValid = pctNums.every((n) => Number.isFinite(n));
    const sum = pctNums.reduce((a, b) => a + b, 0);
    const distOk =
      nonEmptyRows.length >= 1 && allPctsValid && Math.abs(sum - 100) < 0.001;

    return !!(basicsOk && bomOk && hasQapAttachment && distOk);
  }, [
    mode,
    wattPeakLabel,
    qapTypeFile,
    state.qapType,
    state.customerName,
    state.deliveryStartDate,
    state.deliveryEndDate,
    state.projectLocation,
    state.rfqOrderQtyMW,
    moduleModelNumber,
    wattBins,
  ]);

  const addOtherFile = () =>
    setOtherFiles((p) => [...p, { title: "", file: null }]);
  const updateOther = (
    idx: number,
    patch: Partial<{ title: string; file: File | null }>
  ) =>
    setOtherFiles((p) => {
      const copy = [...p];
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  const removeOther = (idx: number) =>
    setOtherFiles((p) => p.filter((_, i) => i !== idx));

  // BOM handlers
  const addRow = (name: string) => {
    setComponents((prev) =>
      prev.map((c) =>
        c.name === name ? { ...c, rows: [...c.rows, { model: "" }] } : c
      )
    );
  };
  const removeRow = (name: string, idx: number) => {
    setComponents((prev) =>
      prev.map((c) =>
        c.name === name ? { ...c, rows: c.rows.filter((_, i) => i !== idx) } : c
      )
    );
  };
  const setRowModel = (name: string, idx: number, model: string) => {
    const options = bomOptionsFor(name);
    const picked = options.find((o) => o.model === model);
    setComponents((prev) =>
      prev.map((c) => {
        if (c.name !== name) return c;
        const rows = [...c.rows];
        rows[idx] = {
          model,
          subVendor: picked?.subVendor ?? null,
          spec: picked?.spec ?? null,
        };
        return { ...c, rows };
      })
    );
  };

  // Assemble BOM payload
  const bomPayload: BomPayload = useMemo(
    () => ({
      vendorName: VENDOR_NAME_LOCKIN,
      rfidLocation: RFID_LOCATION_LOCKIN,
      vendorAddress,
      documentRef: docRef,
      moduleDimensionsOption,
      moduleModelNumber: moduleModelNumber.trim(),
      components,
      wattPeakLabel: wattPeakLabel || undefined,
    }),
    [
      vendorAddress,
      docRef,
      moduleDimensionsOption,
      moduleModelNumber,
      components,
      wattPeakLabel,
    ]
  );

  const FieldDiff: React.FC<{
    change: { field: string; before: any; after: any };
  }> = ({ change }) => {
    const fmt = (v: any) =>
      typeof v === "object" ? (
        <pre className="text-xs bg-gray-50 p-2 rounded">
          {JSON.stringify(v, null, 2)}
        </pre>
      ) : (
        String(v ?? "—")
      );

    return (
      <tr className="align-top">
        <td className="px-2 py-1 font-medium">{change.field}</td>
        <td className="px-2 py-1">{fmt(change.before)}</td>
        <td className="px-2 py-1">{fmt(change.after)}</td>
      </tr>
    );
  };

  const HistoryList: React.FC<{ id: string }> = ({ id }) => {
    const { data = [], isLoading } = useQuery<HistoryItem[]>({
      queryKey: ["sr-history", id],
      queryFn: async () => {
        const r = await fetch(`${API}/api/sales-requests/${id}/history`, {
          credentials: "include",
        });
        if (!r.ok) throw new Error("Failed to load history");
        return r.json();
      },
    });

    if (isLoading)
      return (
        <BrandedLoadingScreen
          message="Loading history"
          subtitle="Gathering the change timeline for this sales request."
          className="min-h-[180px]"
        />
      );
    if (!data.length)
      return <div className="text-sm text-gray-600">No changes yet.</div>;

    return (
      <div className="space-y-4">
        {data.map((h) => (
          <div key={h.id} className="border rounded">
            <div className="px-3 py-2 bg-gray-50 text-sm flex items-center justify-between">
              <div>
                <span className="font-semibold">{h.action.toUpperCase()}</span>{" "}
                by <span className="font-mono">{h.changedBy}</span>
              </div>
              <div className="text-gray-600">
                {new Date(h.changedAt).toLocaleString()}
              </div>
            </div>
            {h.changes?.length ? (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left bg-gray-50">
                      <th className="px-2 py-1">Field</th>
                      <th className="px-2 py-1">Before</th>
                      <th className="px-2 py-1">After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {h.changes.map((c, i) => (
                      <FieldDiff key={i} change={c} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-3 py-2 text-sm text-gray-600">
                No field-level changes captured.
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const submit = () => {
    // Front-end guard: require QAP attachment when Customer
    if (
      state.qapType === "Customer" &&
      !qapTypeFile &&
      !(mode === "edit" && initial?.qapTypeAttachmentUrl)
    ) {
      return;
    }

    const fd = new FormData();

    // core fields
    // core fields
    if (mode === "create") {
      fd.append("customerName", state.customerName.trim());
    }
    fd.append("projectCode", projectCode); // ← add this

    fd.append("moduleManufacturingPlant", state.moduleManufacturingPlant);

    if (state.productCategory)
      fd.append("productCategory", state.productCategory);
    fd.append("cellType", state.cellType); // DCR/NDCR
    fd.append("certificationRequired", state.certificationRequired);
    // NEW optional sub-fields (server can ignore safely if not supported)
    if (state.moduleCellType) fd.append("moduleCellType", state.moduleCellType);
    if (state.cellTech) fd.append("cellTech", state.cellTech);
    if (state.cutCells) fd.append("cutCells", state.cutCells);

    fd.append("rfqOrderQtyMW", String(Number(state.rfqOrderQtyMW || 0)));
    if (state.premierBiddedOrderQtyMW !== "") {
      fd.append(
        "premierBiddedOrderQtyMW",
        String(Number(state.premierBiddedOrderQtyMW || 0))
      );
    }
    fd.append("deliveryStartDate", state.deliveryStartDate);
    fd.append("deliveryEndDate", state.deliveryEndDate);
    fd.append("projectLocation", state.projectLocation.trim());
    fd.append(
      "cableLengthRequired",
      String(Number(state.cableLengthRequired || 0))
    );
    fd.append("qapType", state.qapType);
    fd.append("bomFrom", state.bomFrom);
    fd.append("inlineInspection", state.inlineInspection);
    fd.append("pdi", state.pdi);
    fd.append("cellProcuredBy", state.cellProcuredBy);
    fd.append("agreedCTM", String(Number(state.agreedCTM || 0)));
    if (state.factoryAuditTentativeDate)
      fd.append("factoryAuditTentativeDate", state.factoryAuditTentativeDate);
    if (state.xPitchMm !== "")
      fd.append("xPitchMm", String(Number(state.xPitchMm || 0)));
    if (state.trackerDetails !== "")
      fd.append("trackerDetails", String(Number(state.trackerDetails || 0)));
    fd.append("priority", state.priority);
    if (state.remarks.trim()) fd.append("remarks", state.remarks.trim());
    fd.append("createdBy", currentUser);

    // NEW: wattage distribution JSON
    const distPayload = wattBins
      .filter((r) => r.range.trim() !== "" || r.pct.trim() !== "")
      .map((r) => ({ range: r.range.trim(), pct: Number(r.pct || 0) }));
    fd.append("wattageBinningDist", JSON.stringify(distPayload));

    // BOM JSON payload — ensure defaults are applied even if untouched (plant-independent for model/watt)
    {
      const finalComponents =
        components && components.length
          ? components
          : initial?.bom?.components || [];

      const bomForSave = {
        ...bomPayload,
        moduleModelNumber,
        moduleDimensionsOption,
        wattPeakLabel: wattPeakLabel || undefined,
        components: finalComponents, // <- preserve if local editor is empty
      };

      fd.append("bom", JSON.stringify(bomForSave));
    }

    // attachments: if provided, back-end will replace existing (for edit) or set new (for create)
    if (state.qapType === "Customer" && qapTypeFile) {
      fd.append("qapTypeAttachment", qapTypeFile);
    }
    if (state.bomFrom === "Customer" && primaryBomFile) {
      fd.append("primaryBomAttachment", primaryBomFile);
    }
    if (otherFiles.length) {
      fd.append(
        "otherAttachmentTitles",
        JSON.stringify(otherFiles.map((o) => (o.title || "").trim()))
      );
      otherFiles.forEach((o) => {
        if (o.file) fd.append("otherAttachments", o.file);
      });
    }

    if (mode === "edit" && initial?.id && onUpdate) {
      onUpdate(initial.id, fd);
    } else if (onCreate) {
      onCreate(fd);
    }
  };

  const catCfg = useMemo(
    () =>
      state.productCategory
        ? PRODUCT_CATEGORY_MATRIX[state.productCategory]
        : null,
    [state.productCategory]
  );
  const catDimOpts = catCfg?.dimOptions ?? [];
  const modelOptions = useMemo(() => {
    const base = catCfg?.model ? [catCfg.model] : [];
    return moduleModelNumber && !base.includes(moduleModelNumber)
      ? [...base, moduleModelNumber]
      : base;
  }, [catCfg, moduleModelNumber]);
  const wattageBinsState = useMemo(
    () => evaluateWattageBins(wattBins),
    [wattBins]
  );
  const allGuideSteps = useMemo<GuideStep[]>(
    () => [
      {
        key: "customerName",
        label: "Customer Name",
        hint: "Start here so project code and downstream references stay tied to the right customer.",
        required: true,
        visible: true,
        complete: !!state.customerName.trim(),
      },
      {
        key: "plant",
        label: "Module Manufacturing Plant",
        hint: "Pick the plant early because it drives vendor address and plant-specific context.",
        required: true,
        visible: true,
        complete: !!state.moduleManufacturingPlant,
      },
      {
        key: "productCategory",
        label: "Product Category",
        hint: "Choose the product category before the derived technical fields so the modal can auto-fill them correctly.",
        required: true,
        visible: true,
        complete: !!state.productCategory,
      },
      {
        key: "moduleCellType",
        label: "Cell Type",
        hint: "Review the module cell type that was auto-filled from the selected product category.",
        required: false,
        visible: true,
        complete: !!state.moduleCellType,
      },
      {
        key: "cellTech",
        label: "Cell Tech",
        hint: "Confirm the technology value after the product category auto-fills it.",
        required: false,
        visible: true,
        complete: !!state.cellTech,
      },
      {
        key: "cutCells",
        label: "No. of Cells",
        hint: "Verify the cut-cell count that came from the chosen product category.",
        required: false,
        visible: true,
        complete: !!state.cutCells,
      },
      {
        key: "wattPeak",
        label: "Min Watt Peak",
        hint: "Check the derived minimum watt peak before continuing to the commercial details.",
        required: true,
        visible: true,
        complete: !!wattPeakLabel,
      },
      {
        key: "moduleModelNumber",
        label: "Module Model Number",
        hint: "Confirm or adjust the model number after the category defaults are applied.",
        required: true,
        visible: true,
        complete: !!moduleModelNumber.trim(),
      },
      {
        key: "vendorNameLockIn",
        label: "Solar Module Vendor Name (lock-in)",
        hint: "This lock-in field is system-driven. Review it before proceeding.",
        required: false,
        visible: true,
        complete: !!VENDOR_NAME_LOCKIN,
      },
      {
        key: "rfidLocation",
        label: "Location of RFID in module (lock-in)",
        hint: "This lock-in field is fixed by the master setup. Review it before moving on.",
        required: false,
        visible: true,
        complete: !!RFID_LOCATION_LOCKIN,
      },
      {
        key: "moduleDimensions",
        label: "Module Dimensions",
        hint: "Keep the dimensions aligned with the selected category and model.",
        required: true,
        visible: true,
        complete: !!moduleDimensionsOption.trim(),
      },
      {
        key: "vendorAddress",
        label: "Solar Module Vendor Address",
        hint: "Confirm the vendor address that the plant selection has populated.",
        required: false,
        visible: true,
        complete: !!vendorAddress.trim(),
      },
      {
        key: "documentRef",
        label: "Document Ref (auto)",
        hint: "Review the auto-generated document reference before submission.",
        required: false,
        visible: true,
        complete: !!docRef.trim(),
      },
      {
        key: "cellType",
        label: "DCR Compliance?",
        hint: "Set the DCR/NDCR compliance explicitly for this request.",
        required: true,
        visible: true,
        complete: !!state.cellType,
      },
      {
        key: "wattageBinning",
        label: "Tentative Wattage Binning / Distribution",
        hint: "Add the expected wattage mix and make sure the total equals exactly 100%.",
        required: true,
        visible: true,
        complete: wattageBinsState.valid,
      },
      {
        key: "rfqOrderQtyMW",
        label: "RFQ Order Quantity (MW)",
        hint: "Enter the requested quantity before moving into inspection and procurement details.",
        required: true,
        visible: true,
        complete: Number(state.rfqOrderQtyMW) > 0,
      },
      {
        key: "premierBiddedOrderQtyMW",
        label: "Premier Bidded Actual Order Quantity in MW",
        hint: "Fill this if you already know the internal bidded quantity; otherwise you can skip it for now.",
        required: false,
        visible: true,
        complete: !!String(state.premierBiddedOrderQtyMW || "").trim(),
      },
      {
        key: "deliveryTimeline",
        label: "Delivery Timeline",
        hint: "Set both dates before the project and planning details are finalized.",
        required: true,
        visible: true,
        complete: !!state.deliveryStartDate && !!state.deliveryEndDate,
      },
      {
        key: "projectLocation",
        label: "Project Location",
        hint: "This anchors the project summary and remains visible in the linked QAP context.",
        required: true,
        visible: true,
        complete: !!state.projectLocation.trim(),
      },
      {
        key: "qapType",
        label: "QAP From",
        hint: "Choose whether the QAP comes from the customer or Premier before attachments are decided.",
        required: true,
        visible: true,
        complete: !!state.qapType,
      },
      {
        key: "qapAttachment",
        label: "QAP From Attachment",
        hint: "Upload the customer-supplied QAP when the source is Customer.",
        required: true,
        visible: state.qapType === "Customer",
        complete:
          state.qapType !== "Customer" ||
          !!qapTypeFile ||
          (mode === "edit" && !!initial?.qapTypeAttachmentUrl),
      },
      {
        key: "bomFrom",
        label: "BOM From",
        hint: "Choose the BOM source so the correct attachment path is applied.",
        required: true,
        visible: true,
        complete: !!state.bomFrom,
      },
      {
        key: "bomAttachment",
        label: "BOM From Attachment",
        hint: "Upload the customer BOM when the source is Customer.",
        required: true,
        visible: state.bomFrom === "Customer",
        complete:
          state.bomFrom !== "Customer" ||
          !!primaryBomFile ||
          (mode === "edit" && !!initial?.primaryBomAttachmentUrl),
      },
      {
        key: "inlineInspection",
        label: "Inline Inspection",
        hint: "Confirm whether inline inspection is required for this request.",
        required: true,
        visible: true,
        complete: !!state.inlineInspection,
      },
      {
        key: "pdi",
        label: "Pre-Dispatch Inspection (PDI)",
        hint: "Set whether a pre-dispatch inspection is expected.",
        required: true,
        visible: true,
        complete: !!state.pdi,
      },
      {
        key: "certificationRequired",
        label: "Certification Required?",
        hint: "Record the expected certification combination when relevant. This can be skipped if not needed.",
        required: false,
        visible: true,
        complete: !!state.certificationRequired,
      },
      {
        key: "cellProcuredBy",
        label: "Cell Procured By",
        hint: "Identify who is responsible for cell procurement before approval.",
        required: true,
        visible: true,
        complete: !!state.cellProcuredBy,
      },
      {
        key: "agreedCTM",
        label: "Agreed CTM",
        hint: "Enter the agreed CTM if commercial discussions have already locked it.",
        required: false,
        visible: true,
        complete: !!String(state.agreedCTM || "").trim(),
      },
      {
        key: "factoryAuditDate",
        label: "Factory Audit Tentative Date",
        hint: "Use this when a tentative audit date is already available; otherwise it can be skipped.",
        required: false,
        visible: true,
        complete: !!state.factoryAuditTentativeDate,
      },
      {
        key: "cableLengthRequired",
        label: "JB Cable Length (mm)",
        hint: "Set the cable length requirement before finalizing the request.",
        required: true,
        visible: true,
        complete: !!String(state.cableLengthRequired || "").trim(),
      },
      {
        key: "xPitchMm",
        label: "X Pitch (mm)",
        hint: "Capture this only when the project already has X-pitch constraints.",
        required: false,
        visible: true,
        complete: !!String(state.xPitchMm || "").trim(),
      },
      {
        key: "trackerDetails",
        label: "Tracker Details (790/1400mm)",
        hint: "Fill tracker details when that information is available; otherwise skip and return later.",
        required: false,
        visible: true,
        complete: !!String(state.trackerDetails || "").trim(),
      },
      {
        key: "priority",
        label: "Priority",
        hint: "Mark the request priority before submission.",
        required: true,
        visible: true,
        complete: !!state.priority,
      },
      {
        key: "remarks",
        label: "Remarks",
        hint: "Add any supporting notes that reviewers should see. This can be skipped when not needed.",
        required: false,
        visible: true,
        complete: !!state.remarks.trim(),
      },
      {
        key: "otherAttachments",
        label: "Any Other Attachments",
        hint: "Add any supporting files with titles if they help the reviewers. This is optional.",
        required: false,
        visible: true,
        complete: otherFiles.some(
          (file) => !!file.title.trim() || !!file.file
        ),
      },
      {
        key: "bomReview",
        label: "BOM (Bill of Materials) Review",
        hint: "Expand the BOM section to review or adjust component selections before you finish.",
        required: false,
        visible: true,
        complete: bomOpen,
      },
    ],
    [
      bomOpen,
      docRef,
      initial?.primaryBomAttachmentUrl,
      initial?.qapTypeAttachmentUrl,
      mode,
      moduleDimensionsOption,
      moduleModelNumber,
      otherFiles,
      primaryBomFile,
      qapTypeFile,
      state.agreedCTM,
      state.bomFrom,
      state.cableLengthRequired,
      state.cellProcuredBy,
      state.cellTech,
      state.cellType,
      state.certificationRequired,
      state.customerName,
      state.cutCells,
      state.deliveryEndDate,
      state.deliveryStartDate,
      state.factoryAuditTentativeDate,
      state.inlineInspection,
      state.moduleCellType,
      state.moduleManufacturingPlant,
      state.pdi,
      state.premierBiddedOrderQtyMW,
      state.priority,
      state.productCategory,
      state.projectLocation,
      state.qapType,
      state.remarks,
      state.rfqOrderQtyMW,
      state.trackerDetails,
      state.xPitchMm,
      vendorAddress,
      wattPeakLabel,
      wattageBinsState.valid,
    ]
  );

  const guidedSteps = useMemo(
    () => allGuideSteps.filter((step) => step.visible),
    [allGuideSteps]
  );

  const guideStepMap = useMemo(
    () =>
      Object.fromEntries(
        allGuideSteps.map((step) => [step.key, step])
      ) as Record<GuidedFieldKey, GuideStep>,
    [allGuideSteps]
  );

  useEffect(() => {
    setSkippedGuideSteps((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([key, skipped]) => {
          const step = guideStepMap[key as GuidedFieldKey];
          return !!skipped && !!step && step.visible && !step.required && !step.complete;
        })
      ) as Partial<Record<GuidedFieldKey, boolean>>;

      return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
    });
  }, [guideStepMap]);

  const currentGuideStep = useMemo(
    () =>
      tutorialMode
        ? guidedSteps.find(
            (step) =>
              !step.complete &&
              !(skippedGuideSteps[step.key] && !step.required)
          ) || null
        : null,
    [guidedSteps, skippedGuideSteps, tutorialMode]
  );

  useEffect(() => {
    if (!selectedGuideStep) return;
    const step = guideStepMap[selectedGuideStep];
    if (!step?.visible) {
      setSelectedGuideStep(null);
    }
  }, [guideStepMap, selectedGuideStep]);

  const activeGuideStep = useMemo(() => {
    if (!tutorialMode) return null;
    if (selectedGuideStep) {
      const step = guideStepMap[selectedGuideStep];
      if (step?.visible) return step;
    }
    return currentGuideStep;
  }, [currentGuideStep, guideStepMap, selectedGuideStep, tutorialMode]);

  const guideCardSteps = useMemo(
    () =>
      guidedSteps.map((step) => ({
        id: step.key,
        title: step.label,
        description: step.hint,
        required: step.required,
        complete: step.complete,
        skipped: !!skippedGuideSteps[step.key] && !step.complete,
      })),
    [guidedSteps, skippedGuideSteps]
  );

  const setGuideStepSkipped = (field: GuidedFieldKey, skipped: boolean) => {
    setSkippedGuideSteps((prev) => {
      const next = { ...prev };
      if (skipped) next[field] = true;
      else delete next[field];
      return next;
    });
    if (skipped && selectedGuideStep === field) {
      setSelectedGuideStep(null);
    }
  };

  const isGuided = (field: GuidedFieldKey) =>
    tutorialMode && activeGuideStep?.key === field;

  const guideHintFor = (field: GuidedFieldKey) =>
    isGuided(field) ? guideStepMap[field]?.hint : undefined;

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-h-[95vh] w-full max-w-[98vw] 2xl:max-w-[1700px] overflow-auto">
        <div className="sticky top-0 z-10 border-b bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                {mode === "edit" ? "Edit Sales Request" : "Create Sales Request"}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Start directly in the form. The integrated tutorial follows beside
                the fields and highlights the current focus step.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={showPreview ? "secondary" : "outline"}
                  onClick={() => setShowPreview((v) => !v)}
                >
                  {showPreview ? "Back to Edit" : "Preview"}
                </Button>
                <Button variant="ghost" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>

        {!showPreview ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0">
              {/* Core form */}
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Text
                label="Customer Name"
                required
                value={state.customerName}
                onChange={(v) => setState((s) => ({ ...s, customerName: v }))}
                readOnly={mode === "edit" || !!prefillCustomerName}
                highlighted={isGuided("customerName")}
                hint={guideHintFor("customerName")}
              />
              <Select
                label="Module Manufacturing Plant"
                required
                value={state.moduleManufacturingPlant}
                onChange={(v: any) =>
                  setState((s) => ({ ...s, moduleManufacturingPlant: v }))
                }
                options={["P2", "P4", "P5", "P6"]}
                highlighted={isGuided("plant")}
                hint={guideHintFor("plant")}
              />
              <Select
                label="Product Category"
                value={state.productCategory}
                onChange={(v: any) => {
                  const cat = v as ProductCategory;
                  const m = PRODUCT_CATEGORY_MATRIX[cat];

                  // 6 derived fields in one go
                  setState((s) => ({
                    ...s,
                    productCategory: cat,
                    moduleCellType: m.moduleCellType,
                    cellTech: m.cellTech,
                    cutCells: m.cutCells,
                  }));

                  setModuleModelNumber(m.model);

                  // technology proposed = cell type
                  const label = labelForMin(m.minWattPeak);
                  setWattPeakLabel(label);

                  // min watt (single value) now comes from matrix

                  // dimensions (single-option today, array ready for future)
                  setModuleDimensionsOption(m.dimOptions[0] || "");
                }}
                options={PRODUCT_CATEGORY_OPTIONS}
                highlighted={isGuided("productCategory")}
                hint={guideHintFor("productCategory")}
              />
              {/* NEW sub-dropdowns under "Module Order Type" */}
              <Select
                label="Cell Type"
                value={state.moduleCellType}
                onChange={(v: any) =>
                  setState((s) => ({ ...s, moduleCellType: v as CellType }))
                }
                // ⬇️ remove M10R here
                options={["M10", "G12", "G12R"]}
                highlighted={isGuided("moduleCellType")}
                hint={guideHintFor("moduleCellType")}
              />
              <Select
                label="Cell Tech"
                value={state.cellTech}
                onChange={(v: any) =>
                  setState((s) => ({ ...s, cellTech: v as CellTech }))
                }
                options={["PERC", "TOPCon"]}
                highlighted={isGuided("cellTech")}
                hint={guideHintFor("cellTech")}
              />
              <Select
                label="No. of Cells"
                value={state.cutCells}
                onChange={(v: any) =>
                  setState((s) => ({ ...s, cutCells: v as CutCells }))
                }
                options={["60", "66", "72", "78"]}
                highlighted={isGuided("cutCells")}
                hint={guideHintFor("cutCells")}
              />
              {/* NEW: Min Watt Peak (moved up from BOM) */}
              <ReadOnly
                label="Min Watt Peak"
                value={wattPeakLabel || "-"}
                highlighted={isGuided("wattPeak")}
                hint={guideHintFor("wattPeak")}
              />
              <Select
                label="Module Model Number"
                required
                value={moduleModelNumber}
                onChange={(v) => {
                  setModuleModelNumber(v);
                }}
                options={modelOptions}
                highlighted={isGuided("moduleModelNumber")}
                hint={guideHintFor("moduleModelNumber")}
              />
              <ReadOnly
                label="Solar Module Vendor Name (lock-in)"
                value={VENDOR_NAME_LOCKIN}
                highlighted={isGuided("vendorNameLockIn")}
                hint={guideHintFor("vendorNameLockIn")}
              />
              <ReadOnly
                label="Location of RFID in module (lock-in)"
                value={RFID_LOCATION_LOCKIN}
                highlighted={isGuided("rfidLocation")}
                hint={guideHintFor("rfidLocation")}
              />
              {/* 3) Module Dimensions (matrix-driven; M10 auto-picked) */}
              <Select
                label="Module Dimensions"
                required
                value={moduleDimensionsOption}
                onChange={(v: string) => setModuleDimensionsOption(v)}
                options={catDimOpts}
                highlighted={isGuided("moduleDimensions")}
                hint={guideHintFor("moduleDimensions")}
              />
              {/* 4) Module Model Number (auto-selected by Watt Peak) */}
              {/* Keep the rest as-is */}
              <Text
                label="Solar Module Vendor Address"
                value={vendorAddress}
                onChange={setVendorAddress}
                highlighted={isGuided("vendorAddress")}
                hint={guideHintFor("vendorAddress")}
              />
              <ReadOnly
                label="Document Ref (auto)"
                value={docRef}
                highlighted={isGuided("documentRef")}
                hint={guideHintFor("documentRef")}
              />{" "}
              <Select
                label="DCR Compliance?"
                required
                value={state.cellType}
                onChange={(v: any) => setState((s) => ({ ...s, cellType: v }))}
                options={["DCR", "NDCR"]}
                highlighted={isGuided("cellType")}
                hint={guideHintFor("cellType")}
              />
              <WattageDistTable
                rows={wattBins}
                onChange={setWattBins}
                highlighted={isGuided("wattageBinning")}
                hint={guideHintFor("wattageBinning")}
              />
              <IntField
                label="RFQ Order Quantity (MW)"
                required
                value={state.rfqOrderQtyMW}
                onChange={(v) => setState((s) => ({ ...s, rfqOrderQtyMW: v }))}
                placeholder="e.g., 20"
                highlighted={isGuided("rfqOrderQtyMW")}
                hint={guideHintFor("rfqOrderQtyMW")}
              />
              <IntField
                label="Premier Bidded Actual Order Quantity in MW"
                value={state.premierBiddedOrderQtyMW}
                onChange={(v) =>
                  setState((s) => ({ ...s, premierBiddedOrderQtyMW: v }))
                }
                placeholder="optional"
                highlighted={isGuided("premierBiddedOrderQtyMW")}
                hint={guideHintFor("premierBiddedOrderQtyMW")}
              />
              <DateRange
                label="Delivery Timeline"
                start={state.deliveryStartDate}
                end={state.deliveryEndDate}
                onChange={(start, end) =>
                  setState((s) => ({
                    ...s,
                    deliveryStartDate: start,
                    deliveryEndDate: end,
                  }))
                }
                highlighted={isGuided("deliveryTimeline")}
                hint={guideHintFor("deliveryTimeline")}
              />
              <Text
                label="Project Location"
                required
                value={state.projectLocation}
                onChange={(v) =>
                  setState((s) => ({ ...s, projectLocation: v }))
                }
                highlighted={isGuided("projectLocation")}
                hint={guideHintFor("projectLocation")}
              />
              {/* Right column */}
              <Select
                label="QAP From"
                required
                value={state.qapType}
                onChange={(v: any) => setState((s) => ({ ...s, qapType: v }))}
                options={["Customer", "Premier Energies"]}
                highlighted={isGuided("qapType")}
                hint={guideHintFor("qapType")}
              />
              {state.qapType === "Customer" && (
                <File
                  label="QAP From Attachment"
                  onChange={setQapTypeFile}
                  highlighted={isGuided("qapAttachment")}
                  hint={guideHintFor("qapAttachment")}
                />
              )}
              <Select
                label="BOM From"
                required
                value={state.bomFrom}
                onChange={(v: any) => setState((s) => ({ ...s, bomFrom: v }))}
                options={["Premier Energies", "Customer"]}
                highlighted={isGuided("bomFrom")}
                hint={guideHintFor("bomFrom")}
              />
              {state.bomFrom === "Customer" && (
                <File
                  label="BOM From Attachment"
                  onChange={setPrimaryBomFile}
                  highlighted={isGuided("bomAttachment")}
                  hint={guideHintFor("bomAttachment")}
                />
              )}
              <Select
                label="Inline Inspection"
                required
                value={state.inlineInspection}
                onChange={(v: any) =>
                  setState((s) => ({ ...s, inlineInspection: v }))
                }
                options={["yes", "no"]}
                highlighted={isGuided("inlineInspection")}
                hint={guideHintFor("inlineInspection")}
              />
              <Select
                label="Pre-Dispatch Inspection (PDI)"
                required
                value={state.pdi}
                onChange={(v: any) => setState((s) => ({ ...s, pdi: v }))}
                options={["yes", "no"]}
                highlighted={isGuided("pdi")}
                hint={guideHintFor("pdi")}
              />
              <Select
                label="Certification Required?"
                value={state.certificationRequired}
                onChange={(v: any) =>
                  setState((s) => ({
                    ...s,
                    certificationRequired: v as
                      | "BIS"
                      | "IEC"
                      | "BIS + IEC"
                      | "BIS + IEC + 3xIEC"
                      | "Not Required",
                  }))
                }
                options={[
                  "BIS",
                  "IEC",
                  "BIS + IEC",
                  "BIS + IEC + 3xIEC",
                  "Not Required",
                ]}
                highlighted={isGuided("certificationRequired")}
                hint={guideHintFor("certificationRequired")}
              />
              <Select
                label="Cell Procured By"
                required
                value={state.cellProcuredBy}
                onChange={(v: any) =>
                  setState((s) => ({ ...s, cellProcuredBy: v }))
                }
                options={[
                  "Customer",
                  "Premier Energies",
                  "Financed By Customer",
                ]}
                highlighted={isGuided("cellProcuredBy")}
                hint={guideHintFor("cellProcuredBy")}
              />
              <FloatField
                label="Agreed CTM"
                value={state.agreedCTM}
                onChange={(v) => setState((s) => ({ ...s, agreedCTM: v }))}
                placeholder="e.g., 0.9925"
                highlighted={isGuided("agreedCTM")}
                hint={guideHintFor("agreedCTM")}
              />
              <DateSingle
                label="Factory Audit Tentative Date"
                value={state.factoryAuditTentativeDate}
                onChange={(v) =>
                  setState((s) => ({ ...s, factoryAuditTentativeDate: v }))
                }
                highlighted={isGuided("factoryAuditDate")}
                hint={guideHintFor("factoryAuditDate")}
              />
              <IntField
                label="JB Cable Length (mm)"
                required
                value={state.cableLengthRequired}
                onChange={(v) =>
                  setState((s) => ({ ...s, cableLengthRequired: v }))
                }
                placeholder="in mm"
                highlighted={isGuided("cableLengthRequired")}
                hint={guideHintFor("cableLengthRequired")}
              />
              <IntField
                label="X Pitch (mm)"
                value={state.xPitchMm}
                onChange={(v) => setState((s) => ({ ...s, xPitchMm: v }))}
                placeholder="optional"
                highlighted={isGuided("xPitchMm")}
                hint={guideHintFor("xPitchMm")}
              />
              <IntField
                label="Tracker Details (790/1400mm)"
                value={state.trackerDetails}
                onChange={(v) => setState((s) => ({ ...s, trackerDetails: v }))}
                placeholder="optional"
                highlighted={isGuided("trackerDetails")}
                hint={guideHintFor("trackerDetails")}
              />
              <Select
                label="Priority"
                required
                value={state.priority}
                onChange={(v: any) => setState((s) => ({ ...s, priority: v }))}
                options={["high", "low"]}
                highlighted={isGuided("priority")}
                hint={guideHintFor("priority")}
              />
              <Textarea
                label="Remarks (optional)"
                value={state.remarks}
                onChange={(v) => setState((s) => ({ ...s, remarks: v }))}
                highlighted={isGuided("remarks")}
                hint={guideHintFor("remarks")}
              />
              {/* Multi file attachments with titles */}
              <div
                className={`md:col-span-2 ${fieldShellClasses(
                  isGuided("otherAttachments")
                )}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <label className="font-medium">
                    Any Other Attachments (optional)
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addOtherFile}
                  >
                    + Add
                  </Button>
                </div>
                {otherFiles.length === 0 ? (
                  <div className="text-sm text-gray-500">None.</div>
                ) : (
                  <div className="space-y-3">
                    {otherFiles.map((o, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end"
                      >
                        <div>
                          <label className="text-sm text-gray-700">Title</label>
                          <input
                            className="w-full border rounded px-3 py-2"
                            value={o.title}
                            onChange={(e) =>
                              updateOther(idx, { title: e.target.value })
                            }
                            placeholder={`Attachment ${idx + 1} title`}
                          />
                        </div>
                        <div>
                          <label className="text-sm text-gray-700">File</label>
                          <input
                            type="file"
                            className="w-full border rounded px-3 py-1.5"
                            onChange={(e) =>
                              updateOther(idx, {
                                file: e.target.files?.[0] || null,
                              })
                            }
                          />
                        </div>
                        <div className="flex md:justify-end">
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => removeOther(idx)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <FieldHint hint={guideHintFor("otherAttachments")} />
              </div>
              </div>

              {/* BOM section */}
              <div className="px-4 pb-4">
                <Card
                  className={
                    isGuided("bomReview")
                      ? "border-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.18)]"
                      : undefined
                  }
                >
                  <CardHeader className="flex items-center justify-between">
                    <CardTitle>BOM (Bill of Materials)</CardTitle>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setBomOpen((v) => !v)}
                      aria-expanded={bomOpen}
                      aria-controls="bom-editor"
                    >
                      {bomOpen ? "Collapse" : "Expand"}
                    </Button>
                  </CardHeader>
                  {!bomOpen && <FieldHint hint={guideHintFor("bomReview")} />}

                  {bomOpen && (
                    <CardContent id="bom-editor" className="space-y-6">
                      <FieldHint hint={guideHintFor("bomReview")} />
                      {/* Lock-ins & Header fields */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Module Model Number (dropdown by plant) */}
                      </div>

                      {/* Component tables */}
                      <div className="space-y-6">
                        {components.length === 0 ? (
                          <div className="text-sm text-gray-500 p-3 border rounded">
                            BOM has no components.
                            <Button
                              size="sm"
                              variant="outline"
                              className="ml-2"
                              onClick={() => {
                                const all = componentNames.map((name) => {
                                  const opts = bomOptionsFor(name);
                                  const defaultRow: BomRow =
                                    opts.length === 1
                                      ? {
                                          model: opts[0].model,
                                          subVendor: opts[0].subVendor ?? null,
                                          spec: opts[0].spec ?? null,
                                        }
                                      : {
                                          model: "",
                                          subVendor: null,
                                          spec: null,
                                        };
                                  return { name, rows: [defaultRow] };
                                });
                                setComponents(all);
                              }}
                            >
                              Reset to defaults
                            </Button>
                          </div>
                        ) : (
                          components.map((c) => (
                            <div key={c.name} className="border rounded-md">
                              <div className="px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b bg-gray-50">
                                <div className="font-medium">{c.name}</div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => addRow(c.name)}
                                  >
                                    + Add Row
                                  </Button>
                                </div>
                              </div>

                              <div className="overflow-auto">
                                <table className="min-w-full text-sm">
                                  <thead>
                                    <tr className="bg-gray-50 text-left">
                                      <Th>Part No / Type / Model</Th>
                                      <Th>Name of Sub-vendor / Manufacturer</Th>
                                      <Th>Specification</Th>
                                      <Th>Action</Th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y">
                                    {c.rows.length === 0 ? (
                                      <tr>
                                        <td
                                          colSpan={4}
                                          className="px-3 py-3 text-gray-500"
                                        >
                                          No rows yet. Click “Add Row”.
                                        </td>
                                      </tr>
                                    ) : (
                                      c.rows.map((r, idx) => {
                                        return (
                                          <tr key={idx} className="align-top">
                                            <td className="px-3 py-2 min-w-[28rem]">
                                              <div className="space-y-2">
                                                <input
                                                  className="w-full border rounded px-3 py-2 bg-gray-50 font-mono"
                                                  value={r.model || ""}
                                                  placeholder="No model chosen"
                                                  readOnly
                                                />
                                                <div className="flex items-center gap-2">
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                      openModelDialog(c.name, idx)
                                                    }
                                                  >
                                                    {r.model
                                                      ? "Change"
                                                      : "Choose"}
                                                  </Button>
                                                  {r.model && (
                                                    <Button
                                                      size="sm"
                                                      variant="destructive"
                                                      onClick={() =>
                                                        setRowModel(
                                                          c.name,
                                                          idx,
                                                          ""
                                                        )
                                                      }
                                                    >
                                                      Clear
                                                    </Button>
                                                  )}
                                                </div>
                                              </div>
                                            </td>

                                            <td className="px-3 py-2 min-w-[16rem]">
                                              <input
                                                className="w-full border rounded px-3 py-2 bg-gray-50"
                                                value={r.subVendor ?? ""}
                                                readOnly
                                              />
                                            </td>
                                            <td className="px-3 py-2 min-w-[24rem]">
                                              <div className="border rounded px-3 py-2 bg-gray-50 whitespace-pre-wrap">
                                                {r.spec || "—"}
                                              </div>
                                            </td>
                                            <td className="px-3 py-2">
                                              <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() =>
                                                  removeRow(c.name, idx)
                                                }
                                              >
                                                Remove
                                              </Button>
                                            </td>
                                          </tr>
                                        );
                                      })
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              </div>

              {/* Change history (edit only) */}
              {mode === "edit" && initial?.id && (
                <div className="p-4 border-t">
                  <h3 className="font-semibold mb-2">Change History</h3>
                  <HistoryList id={initial.id} />
                </div>
              )}

              <div className="p-4 border-t flex items-center justify-end gap-3">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  disabled={!canSubmit || creating}
                  onClick={submit}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {creating
                    ? mode === "edit"
                      ? "Saving…"
                      : "Saving…"
                    : mode === "edit"
                    ? "Save Changes"
                    : "Create"}
                </Button>
              </div>
            </div>
            {guidedSteps.length > 0 ? (
              <div className="px-4 pb-4 xl:pl-0">
                <InteractiveTutorialCard
                  storageKey="sales-request-tutorial"
                  title="Sales Request Walkthrough"
                  description="Work in the form first. Use this guide to move field-by-field, or jump to any step when you need help."
                  steps={guideCardSteps}
                  activeStepId={activeGuideStep?.key ?? null}
                  onSelectStep={(stepId) =>
                    setSelectedGuideStep(stepId as GuidedFieldKey)
                  }
                  enabled={tutorialMode}
                  onEnabledChange={setTutorialMode}
                  className="xl:sticky xl:top-24"
                  footer={
                    activeGuideStep ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Current Focus
                        </div>
                        <div className="mt-2 text-sm text-slate-700">
                          {activeGuideStep.hint}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="bg-white">
                            {activeGuideStep.required ? "Mandatory" : "Optional"}
                          </Badge>
                          {!activeGuideStep.required && !activeGuideStep.complete ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setGuideStepSkipped(
                                  activeGuideStep.key,
                                  !skippedGuideSteps[activeGuideStep.key]
                                )
                              }
                            >
                              {skippedGuideSteps[activeGuideStep.key]
                                ? "Revisit Step"
                                : "Skip for now"}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                        All visible mandatory steps are complete. You can still open any tutorial step to review optional fields before submitting.
                      </div>
                    )
                  }
                />
              </div>
            ) : null}
          </div>
        ) : (
          // Preview
          <div className="p-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Request Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <PreviewRow
                    label="Customer Name"
                    value={state.customerName}
                  />
                  <PreviewRow
                    label="Module Manufacturing Plant"
                    value={state.moduleManufacturingPlant.toUpperCase()}
                  />
                  <PreviewRow
                    label="Product Category"
                    value={state.productCategory || "-"}
                  />

                  <PreviewRow
                    label="Cell Type"
                    value={state.moduleCellType || "-"}
                  />
                  <PreviewRow label="Cell Tech" value={state.cellTech || "-"} />
                  <PreviewRow
                    label="No. of Cells"
                    value={state.cutCells || "-"}
                  />

                  <PreviewRow
                    label="Min Watt Peak"
                    value={wattPeakLabel || "-"}
                  />
                  <PreviewRow
                    label="Module Model Number"
                    value={moduleModelNumber}
                  />
                  <PreviewRow
                    label="Solar Module Vendor Name (lock-in)"
                    value={VENDOR_NAME_LOCKIN}
                  />
                  <PreviewRow
                    label="RFID Location (lock-in)"
                    value={RFID_LOCATION_LOCKIN}
                  />
                  <PreviewRow
                    label="Module Dimensions"
                    value={moduleDimensionsOption}
                  />
                  <PreviewRow
                    label="Solar Module Vendor Address"
                    value={vendorAddress || "-"}
                  />
                  <PreviewRow label="Document Ref" value={docRef} />

                  <PreviewRow label="DCR Compliance?" value={state.cellType} />

                  <div className="flex flex-col md:col-span-3">
                    <span className="text-gray-500">
                      Tentative Wattage Binning / Distribution
                    </span>
                    {wattBins.filter((r) => r.range.trim() || r.pct.trim())
                      .length ? (
                      <ul className="list-disc pl-5">
                        {wattBins
                          .filter((r) => r.range.trim() || r.pct.trim())
                          .map((r, i) => (
                            <li key={i}>
                              {r.range || "—"}: {r.pct || "0"}%
                            </li>
                          ))}
                      </ul>
                    ) : (
                      <span className="font-medium text-gray-900">-</span>
                    )}
                  </div>

                  <PreviewRow
                    label="RFQ Order Quantity (MW)"
                    value={displayInt(state.rfqOrderQtyMW)}
                  />
                  <PreviewRow
                    label="Premier Bidded Actual Order Quantity in MW"
                    value={
                      state.premierBiddedOrderQtyMW !== ""
                        ? displayInt(state.premierBiddedOrderQtyMW)
                        : "-"
                    }
                  />
                  <PreviewRow
                    label="Delivery Timeline"
                    value={`${state.deliveryStartDate || "—"} → ${
                      state.deliveryEndDate || "—"
                    }`}
                  />
                  <PreviewRow
                    label="Project Location"
                    value={state.projectLocation}
                  />
                  <PreviewRow label="QAP From" value={state.qapType} />
                  <PreviewRow label="BOM From" value={state.bomFrom} />
                  {/* QAP From attachment as a single-line field */}
                  {state.qapType === "Customer" &&
                    (qapPreviewUrl || initial?.qapTypeAttachmentUrl) && (
                      <PreviewRow
                        label="QAP From Attachment"
                        value={
                          <a
                            className="text-blue-600 underline"
                            href={
                              qapPreviewUrl ||
                              (initial?.qapTypeAttachmentUrl as string)
                            }
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open QAP file
                          </a>
                        }
                      />
                    )}

                  {/* BOM From attachment as a single-line field */}
                  {state.bomFrom === "Customer" &&
                    (bomPreviewUrl || initial?.primaryBomAttachmentUrl) && (
                      <PreviewRow
                        label="BOM From Attachment"
                        value={
                          <a
                            className="text-blue-600 underline"
                            href={
                              bomPreviewUrl ||
                              (initial?.primaryBomAttachmentUrl as string)
                            }
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open BOM file
                          </a>
                        }
                      />
                    )}

                  {/* Any Other Attachments as a single-line field with inline links */}
                  {(() => {
                    const links: { href: string; title: string }[] = [];

                    // Existing (edit mode)
                    if (initial?.otherAttachments?.length) {
                      initial.otherAttachments.forEach((a, i) => {
                        if (a?.url)
                          links.push({
                            href: a.url,
                            title: a.title || `Attachment ${i + 1}`,
                          });
                      });
                    }

                    // Newly picked (create/edit)
                    otherFiles.forEach((o, idx) => {
                      const href = otherPreviewUrls[idx];
                      if (href) {
                        links.push({
                          href,
                          title:
                            (o.title && o.title.trim()) ||
                            `Attachment ${idx + 1}`,
                        });
                      }
                    });

                    return (
                      <PreviewRow
                        label="Any Other Attachments"
                        value={
                          links.length ? (
                            <span className="flex flex-wrap gap-x-2">
                              {links.map((l, i) => (
                                <a
                                  key={`${l.href}-${i}`}
                                  className="text-blue-600 underline"
                                  href={l.href}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {l.title}
                                </a>
                              ))}
                            </span>
                          ) : (
                            "-"
                          )
                        }
                      />
                    );
                  })()}

                  <PreviewRow
                    label="Inline Inspection"
                    value={state.inlineInspection.toUpperCase()}
                  />
                  <PreviewRow
                    label="Pre-Dispatch Inspection (PDI)"
                    value={state.pdi.toUpperCase()}
                  />
                  <PreviewRow
                    label="Certification Required?"
                    value={state.certificationRequired}
                  />
                  <PreviewRow
                    label="Cell Procured By"
                    value={state.cellProcuredBy}
                  />
                  <PreviewRow
                    label="Agreed CTM"
                    value={displayFloat(state.agreedCTM)}
                  />
                  <PreviewRow
                    label="Factory Audit Tentative Date"
                    value={state.factoryAuditTentativeDate || "-"}
                  />
                  <PreviewRow
                    label="JB Cable Length (mm)"
                    value={displayInt(state.cableLengthRequired)}
                  />
                  <PreviewRow
                    label="X Pitch (mm)"
                    value={state.xPitchMm !== "" ? state.xPitchMm : "-"}
                  />
                  <PreviewRow
                    label="Tracker (790/1400mm)"
                    value={
                      state.trackerDetails !== "" ? state.trackerDetails : "-"
                    }
                  />
                  <PreviewRow label="Priority" value={state.priority} />

                  <div className="md:col-span-3">
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">Remarks:</span>{" "}
                      {state.remarks || "-"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>BOM Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm"></div>

                {components.length === 0 ? (
                  <div className="text-gray-500 text-sm">
                    No components added.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {components.map((c) => (
                      <div key={c.name} className="overflow-auto">
                        <div className="font-medium mb-2">{c.name}</div>
                        <table className="min-w-full text-sm border">
                          <thead className="bg-gray-50 text-left">
                            <tr>
                              <Th>Part No / Type / Model</Th>
                              <Th>Sub-vendor / Manufacturer</Th>
                              <Th>Specification</Th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {c.rows.map((r, idx) => (
                              <tr key={idx} className="align-top">
                                <Td>{r.model || "-"}</Td>
                                <Td>{r.subVendor || "-"}</Td>
                                <Td>
                                  <div className="whitespace-pre-wrap">
                                    {r.spec || "—"}
                                  </div>
                                </Td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="border-t pt-4 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                Back to Edit
              </Button>
              <Button
                disabled={!canSubmit || creating}
                onClick={submit}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {creating
                  ? mode === "edit"
                    ? "Saving…"
                    : "Saving…"
                  : mode === "edit"
                  ? "Save Changes"
                  : "Create"}
              </Button>
            </div>
          </div>
        )}
      </div>
      <ModelPickerModal
        open={modelDialog.open === true}
        title={
          modelDialog.open
            ? `${modelDialog.comp} – Select model`
            : "Select model"
        }
        options={modelDialog.open ? bomOptionsFor(modelDialog.comp) : []}
        onClose={closeModelDialog}
        onPick={(model) => {
          if (modelDialog.open) {
            setRowModel(modelDialog.comp, modelDialog.idx, model);
          }
          closeModelDialog();
        }}
      />
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────────── */
/*  View modal with BOM + full change history                                */
/* ────────────────────────────────────────────────────────────────────────── */

const ViewSalesRequestModal: React.FC<{
  id: string;
  onClose: () => void;
  onEdit: (data: SalesRequest) => void;
}> = ({ id, onClose, onEdit }) => {
  const [data, setData] = useState<SalesRequest | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [r1, r2] = await Promise.all([
          fetch(`${API}/api/sales-requests/${id}`, { credentials: "include" }),
          fetch(`${API}/api/sales-requests/${id}/history`, {
            credentials: "include",
          }),
        ]);
        if (!r1.ok) throw new Error(await r1.text());
        if (!r2.ok) throw new Error(await r2.text());
        const d = (await r1.json()) as SalesRequest;
        const h = (await r2.json()) as HistoryItem[];
        if (!mounted) return;
        setData(d);
        // sort newest first
        setHistory(
          h.sort(
            (a, b) =>
              new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
          )
        );
      } catch (e: any) {
        if (!mounted) return;
        setError(String(e?.message || e || "Failed to fetch"));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-h-[92vh] w-full max-w-6xl overflow-auto">
        <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold">Sales Request</h2>
          <div className="flex items-center gap-2">
            {data && (
              <Button variant="secondary" onClick={() => onEdit(data)}>
                Edit
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {loading ? (
            <BrandedLoadingScreen
              message="Loading sales request"
              subtitle="Bringing in the request details, attachments, and change history."
              className="min-h-[360px]"
            />
          ) : error ? (
            <div className="text-red-600">{error}</div>
          ) : data ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <PreviewRow
                      label="Customer Name"
                      value={data.customerName}
                    />
                    <PreviewRow
                      label="Module Manufacturing Plant"
                      value={data.moduleManufacturingPlant.toUpperCase()}
                    />
                    <PreviewRow
                      label="Product Category"
                      value={(data as any).productCategory || "-"}
                    />

                    <PreviewRow
                      label="Cell Type"
                      value={data.moduleCellType || "-"}
                    />
                    <PreviewRow
                      label="Cell Tech"
                      value={data.cellTech || "-"}
                    />
                    <PreviewRow
                      label="No. of Cells"
                      value={data.cutCells || "-"}
                    />

                    <PreviewRow
                      label="Min Watt Peak"
                      value={data.bom?.wattPeakLabel || "-"}
                    />
                    <PreviewRow
                      label="Module Model Number"
                      value={data.bom?.moduleModelNumber || "-"}
                    />
                    <PreviewRow
                      label="Solar Module Vendor Name (lock-in)"
                      value={data.bom?.vendorName || "-"}
                    />
                    <PreviewRow
                      label="RFID Location (lock-in)"
                      value={data.bom?.rfidLocation || "-"}
                    />
                    <PreviewRow
                      label="Module Dimensions"
                      value={data.bom?.moduleDimensionsOption || "-"}
                    />
                    <PreviewRow
                      label="Solar Module Vendor Address"
                      value={data.bom?.vendorAddress || "-"}
                    />
                    <PreviewRow
                      label="Document Ref"
                      value={data.bom?.documentRef || "-"}
                    />

                    <PreviewRow label="DCR Compliance?" value={data.cellType} />

                    {data.wattageBinningDist?.length ? (
                      <div className="flex flex-col md:col-span-3">
                        <span className="text-gray-500">
                          Tentative Wattage Binning / Distribution
                        </span>
                        <ul className="list-disc pl-5">
                          {data.wattageBinningDist.map((b, i) => (
                            <li key={i}>
                              {b.range}: {fmtDec(b.pct)}%
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <PreviewRow
                        label="Tentative Wattage Binning / Distribution"
                        value="-"
                      />
                    )}

                    <PreviewRow
                      label="RFQ Order Quantity (MW)"
                      value={fmtNum(data.rfqOrderQtyMW)}
                    />
                    <PreviewRow
                      label="Premier Bidded Actual Order Quantity in MW"
                      value={data.premierBiddedOrderQtyMW ?? "-"}
                    />
                    <PreviewRow
                      label="Delivery Timeline"
                      value={`${data.deliveryStartDate} → ${data.deliveryEndDate}`}
                    />
                    <PreviewRow
                      label="Project Location"
                      value={data.projectLocation}
                    />

                    <PreviewRow label="QAP From" value={data.qapType} />
                    <PreviewRow label="BOM From" value={data.bomFrom || "-"} />

                    {/* Single-line attachment links like Preview */}
                    {data.qapTypeAttachmentUrl && (
                      <PreviewRow
                        label="QAP From Attachment"
                        value={
                          <a
                            className="text-blue-600 underline"
                            href={data.qapTypeAttachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open QAP file
                          </a>
                        }
                      />
                    )}
                    {data.primaryBomAttachmentUrl && (
                      <PreviewRow
                        label="BOM From Attachment"
                        value={
                          <a
                            className="text-blue-600 underline"
                            href={data.primaryBomAttachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open BOM file
                          </a>
                        }
                      />
                    )}
                    <PreviewRow
                      label="Any Other Attachments"
                      value={
                        data.otherAttachments?.length ? (
                          <span className="flex flex-wrap gap-x-2">
                            {data.otherAttachments.map((a, i) => (
                              <a
                                key={i}
                                className="text-blue-600 underline"
                                href={a.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {a.title || `Attachment ${i + 1}`}
                              </a>
                            ))}
                          </span>
                        ) : (
                          "-"
                        )
                      }
                    />

                    <PreviewRow
                      label="Inline Inspection"
                      value={data.inlineInspection.toUpperCase()}
                    />
                    <PreviewRow
                      label="Pre-Dispatch Inspection (PDI)"
                      value={data.pdi ? data.pdi.toUpperCase() : "-"}
                    />
                    <PreviewRow
                      label="Certification Required?"
                      value={(data as any).certificationRequired || "-"}
                    />
                    <PreviewRow
                      label="Cell Procured By"
                      value={data.cellProcuredBy}
                    />
                    <PreviewRow
                      label="Agreed CTM"
                      value={fmtDec(data.agreedCTM)}
                    />
                    <PreviewRow
                      label="Factory Audit Tentative Date"
                      value={data.factoryAuditTentativeDate || "-"}
                    />
                    <PreviewRow
                      label="JB Cable Length (mm)"
                      value={fmtNum(data.cableLengthRequired)}
                    />
                    <PreviewRow
                      label="X Pitch (mm)"
                      value={data.xPitchMm ?? "-"}
                    />
                    <PreviewRow
                      label="Tracker (790/1400mm)"
                      value={data.trackerDetails ?? "-"}
                    />
                    <PreviewRow label="Priority" value={data.priority} />

                    <div className="md:col-span-3">
                      <div className="text-sm text-gray-700">
                        <span className="font-medium">Remarks:</span>{" "}
                        {data.remarks || "-"}
                      </div>
                    </div>

                    {/* (Optional meta; not shown in Preview, but handy to keep at the end) */}
                    <PreviewRow
                      label="Project Code"
                      value={data.projectCode || "-"}
                    />
                    <PreviewRow label="Created By" value={data.createdBy} />
                    <PreviewRow
                      label="Created At"
                      value={new Date(data.createdAt).toLocaleString()}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>BOM</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {data.bom && data.bom.components?.length ? (
                    <div className="space-y-6">
                      {data.bom.components.map((c, idx) => (
                        <div key={`${c.name}-${idx}`} className="overflow-auto">
                          <div className="font-medium mb-2">{c.name}</div>
                          <table className="min-w-full text-sm border">
                            <thead className="bg-gray-50 text-left">
                              <tr>
                                <Th>Part No / Type / Model</Th>
                                <Th>Sub-vendor / Manufacturer</Th>
                                <Th>Specification</Th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {c.rows.map((r, i) => (
                                <tr key={i} className="align-top">
                                  <Td>{r.model || "-"}</Td>
                                  <Td>{r.subVendor || "-"}</Td>
                                  <Td>
                                    <div className="whitespace-pre-wrap">
                                      {r.spec || "—"}
                                    </div>
                                  </Td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">
                      No BOM available.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Change History</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {history.length === 0 ? (
                    <div className="text-sm text-gray-500">No edits yet.</div>
                  ) : (
                    <div className="space-y-4">
                      {history.map((h) => (
                        <div key={h.id} className="border rounded">
                          <div className="px-3 py-2 bg-gray-50 text-sm flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <span className="font-medium capitalize">
                                {h.action}
                              </span>{" "}
                              by{" "}
                              <span className="font-medium">{h.changedBy}</span>
                            </div>
                            <div className="text-gray-600">
                              {new Date(h.changedAt).toLocaleString()}
                            </div>
                          </div>
                          <div className="p-3">
                            {!h.changes || h.changes.length === 0 ? (
                              <div className="text-sm text-gray-500">
                                No field-level changes recorded.
                              </div>
                            ) : (
                              <div className="overflow-auto">
                                <table className="min-w-full text-sm border">
                                  <thead className="bg-gray-50 text-left">
                                    <tr>
                                      <Th>Field</Th>
                                      <Th>Before</Th>
                                      <Th>After</Th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y">
                                    {h.changes.map((c, i) => (
                                      <tr key={i}>
                                        <Td className="font-medium">
                                          {c.field}
                                        </Td>
                                        <Td
                                          className="max-w-[24rem] truncate"
                                          title={stringifyForView(c.before)}
                                        >
                                          {stringifyForView(c.before)}
                                        </Td>
                                        <Td
                                          className="max-w-[24rem] truncate"
                                          title={stringifyForView(c.after)}
                                        >
                                          {stringifyForView(c.after)}
                                        </Td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

function stringifyForView(v: any) {
  if (v === null || v === undefined) return "-";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// ModelPickerModal: full-screen-ish modal for BOM "Model No." selection
// ────────────────────────────────────────────────────────────────────────────
const ModelPickerModal: React.FC<{
  open: boolean;
  title?: string;
  options: readonly BomMasterOption[];
  onClose: () => void;
  onPick: (model: string) => void;
}> = ({ open, title = "Select model", options, onClose, onPick }) => {
  const [q, setQ] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const filtered = q
    ? options.filter(
        (o) =>
          (o.model || "").toLowerCase().includes(q.toLowerCase()) ||
          (o.subVendor || "").toLowerCase().includes(q.toLowerCase()) ||
          (o.spec || "").toLowerCase().includes(q.toLowerCase())
      )
    : options;

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[85vh] flex flex-col">
        <div className="p-3 border-b flex items-center justify-between">
          <div className="font-semibold">{title}</div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="p-3 border-b">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type to filter by model / sub-vendor / spec"
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Model</th>
                <th className="px-3 py-2 font-medium">Sub-vendor</th>
                <th className="px-3 py-2 font-medium">Specification</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-3 text-gray-500">
                    No matches.
                  </td>
                </tr>
              ) : (
                filtered.map((o) => (
                  <tr
                    key={o.model}
                    className="cursor-pointer hover:bg-blue-50"
                    onClick={() => onPick(o.model)}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && onPick(o.model)}
                  >
                    <td className="px-3 py-2 font-mono">{o.model}</td>
                    <td className="px-3 py-2">{o.subVendor || "-"}</td>
                    <td className="px-3 py-2 whitespace-pre-wrap">
                      {o.spec || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/** Editable table for Wattage Distribution with sum==100 validation */
const WattageDistTable: React.FC<{
  rows: { range: string; pct: string }[];
  onChange: (rows: { range: string; pct: string }[]) => void;
  highlighted?: boolean;
  hint?: string;
}> = ({ rows, onChange, highlighted, hint }) => {
  const addRow = () => onChange([...rows, { range: "", pct: "" }]);
  const removeRow = (idx: number) =>
    onChange(rows.length > 1 ? rows.filter((_, i) => i !== idx) : rows);
  const setCell = (
    idx: number,
    patch: Partial<{ range: string; pct: string }>
  ) => {
    const copy = [...rows];
    copy[idx] = { ...copy[idx], ...patch };
    onChange(copy);
  };

  const { sum, valid } = evaluateWattageBins(rows);

  return (
    <div className={`md:col-span-2 ${fieldShellClasses(highlighted)}`}>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm text-gray-700">
          Tentative Wattage Binning / Distribution *
        </label>
        <Button type="button" variant="outline" onClick={addRow}>
          +
        </Button>
      </div>
      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Wattage Range</th>
              <th className="px-3 py-2 font-medium">% (decimals allowed)</th>
              <th className="px-3 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="px-3 py-2">
                  <input
                    className="w-full border rounded px-3 py-2"
                    value={r.range}
                    onChange={(e) => setCell(i, { range: e.target.value })}
                    placeholder="e.g., 540–545"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className="w-full border rounded px-3 py-2"
                    inputMode="decimal"
                    value={r.pct}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^([0-9]+(\.[0-9]*)?)$/.test(v)) {
                        setCell(i, { pct: v });
                      }
                    }}
                    placeholder="e.g., 33.3"
                  />
                </td>
                <td className="px-3 py-2">
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={rows.length <= 1}
                    onClick={() => removeRow(i)}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
            <tr>
              <td className="px-3 py-2 text-right font-medium">Total</td>
              <td className="px-3 py-2 font-medium">{sum.toFixed(2)}%</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <div
        className={`mt-1 text-xs ${valid ? "text-green-700" : "text-red-600"}`}
      >
        {valid
          ? "Looks good: total is 100%."
          : "Total must be exactly 100% and at least one row is required."}
      </div>
      <FieldHint hint={hint} />
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────────── */
/*  Small field + preview components                                         */
/* ────────────────────────────────────────────────────────────────────────── */

const fieldShellClasses = (highlighted?: boolean) =>
  highlighted
    ? "min-w-0 rounded-xl border-2 border-amber-400 bg-amber-50/70 p-3 shadow-[0_0_0_3px_rgba(251,191,36,0.18)]"
    : "min-w-0";

const FieldHint: React.FC<{ hint?: string }> = ({ hint }) =>
  hint ? <p className="mt-2 text-xs text-amber-900">{hint}</p> : null;

const Text: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  readOnly?: boolean;
  highlighted?: boolean;
  hint?: string;
}> = ({ label, value, onChange, required, readOnly, highlighted, hint }) => (
  <div className={fieldShellClasses(highlighted)}>
    <label className="block text-sm text-gray-700 mb-1">
      {label}
      {required && " *"}
    </label>
    <input
      className={`w-full border rounded px-3 py-2 ${
        readOnly ? "bg-gray-50" : ""
      }`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={!!readOnly}
    />
    <FieldHint hint={hint} />
  </div>
);

const ReadOnly: React.FC<{
  label: string;
  value: string;
  highlighted?: boolean;
  hint?: string;
}> = ({
  label,
  value,
  highlighted,
  hint,
}) => (
  <div className={fieldShellClasses(highlighted)}>
    <label className="block text-sm text-gray-700 mb-1">{label}</label>
    <input
      className="w-full border rounded px-3 py-2 bg-gray-50"
      value={value}
      readOnly
    />
    <FieldHint hint={hint} />
  </div>
);

const Textarea: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  highlighted?: boolean;
  hint?: string;
}> = ({ label, value, onChange, highlighted, hint }) => (
  <div className={`md:col-span-2 ${fieldShellClasses(highlighted)}`}>
    <label className="block text-sm text-gray-700 mb-1">{label}</label>
    <textarea
      className="w-full border rounded px-3 py-2 min-h-[96px]"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
    <FieldHint hint={hint} />
  </div>
);

const Select: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  required?: boolean;
  highlighted?: boolean;
  hint?: string;
}> = ({ label, value, onChange, options, required, highlighted, hint }) => {
  const opts =
    value && !options.includes(value) ? [...options, value] : options;
  return (
    <div className={fieldShellClasses(highlighted)}>
      <label className="block text-sm text-gray-700 mb-1">
        {label}
        {required && " *"}
      </label>
      <select
        className="w-full border rounded px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled={!!required} hidden>
          select {label}
        </option>
        {opts.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <FieldHint hint={hint} />
    </div>
  );
};

/** Integer input (string-based) that allows free typing and clearing. */
const IntField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  highlighted?: boolean;
  hint?: string;
}> = ({ label, value, onChange, required, placeholder, highlighted, hint }) => (
  <div className={fieldShellClasses(highlighted)}>
    <label className="block text-sm text-gray-700 mb-1">
      {label}
      {required && " *"}
    </label>
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      className="w-full border rounded px-3 py-2"
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "" || /^[0-9]+$/.test(v)) onChange(v);
      }}
      placeholder={placeholder}
    />
    <FieldHint hint={hint} />
  </div>
);

/** Decimal input (string-based) that allows digits and a single dot. */
const FloatField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  highlighted?: boolean;
  hint?: string;
}> = ({ label, value, onChange, required, placeholder, highlighted, hint }) => (
  <div className={fieldShellClasses(highlighted)}>
    <label className="block text-sm text-gray-700 mb-1">
      {label}
      {required && " *"}
    </label>
    <input
      type="text"
      inputMode="decimal"
      className="w-full border rounded px-3 py-2"
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "" || /^([0-9]+(\.[0-9]*)?)$/.test(v)) onChange(v);
      }}
      placeholder={placeholder}
    />
    <FieldHint hint={hint} />
  </div>
);

const DateSingle: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  highlighted?: boolean;
  hint?: string;
}> = ({ label, value, onChange, highlighted, hint }) => (
  <div className={fieldShellClasses(highlighted)}>
    <label className="block text-sm text-gray-700 mb-1">{label}</label>
    <input
      type="date"
      className="w-full border rounded px-3 py-2"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
    <FieldHint hint={hint} />
  </div>
);

const DateRange: React.FC<{
  label: string;
  start: string;
  end: string;
  onChange: (s: string, e: string) => void;
  highlighted?: boolean;
  hint?: string;
}> = ({ label, start, end, onChange, highlighted, hint }) => (
  <div className={fieldShellClasses(highlighted)}>
    <label className="block text-sm text-gray-700 mb-1">{label} *</label>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        type="date"
        className="w-full border rounded px-3 py-2"
        value={start}
        onChange={(e) => onChange(e.target.value, end)}
      />
      <span>→</span>
      <input
        type="date"
        className="w-full border rounded px-3 py-2"
        value={end}
        onChange={(e) => onChange(start, e.target.value)}
      />
    </div>
    <FieldHint hint={hint} />
  </div>
);

const File: React.FC<{
  label: string;
  onChange: (f: File | null) => void;
  highlighted?: boolean;
  hint?: string;
}> = ({ label, onChange, highlighted, hint }) => (
  <div className={fieldShellClasses(highlighted)}>
    <label className="block text-sm text-gray-700 mb-1">{label}</label>
    <input
      type="file"
      className="w-full border rounded px-3 py-1.5"
      onChange={(e) => onChange(e.target.files?.[0] || null)}
    />
    <FieldHint hint={hint} />
  </div>
);

const PreviewRow: React.FC<{ label: string; value: React.ReactNode }> = ({
  label,
  value,
}) => (
  <div className="flex flex-col">
    <span className="text-gray-500">{label}</span>
    <span className="font-medium text-gray-900">{value}</span>
  </div>
);

export default SalesRequestsPage;
