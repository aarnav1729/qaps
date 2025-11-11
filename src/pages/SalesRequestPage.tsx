import React, { useMemo, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BOM_MASTER,
  getOptionsFor,
  VENDOR_NAME_LOCKIN,
  RFID_LOCATION_LOCKIN,
  BomComponentName,
  BomComponentOption,
} from "@/data/bomMaster";

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

/* ────────────────────────────────────────────────────────────────────────── */
/*  BOM types                                                                */
/* ────────────────────────────────────────────────────────────────────────── */
type BomRow = {
  model: string;
  subVendor?: string | null;
  spec?: string | null;
};
type BomComponent = {
  name: BomComponentName;
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

// Link Module Manufacturing Plant => Solar Module Vendor Address
const PLANT_VENDOR_ADDRESS: Record<Plant, string> = {
  P2: "PEPPL",
  P4: "PEIPL",
  P5: "PEGEPL I",
  P6: "PEGEPL II",
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
            <div>Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-gray-600">No sales requests yet.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full border divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left">
                    <Th>Actions</Th>
                    <Th>Customer Name</Th>
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
}> = ({
  mode = "create",
  initial,
  onClose,
  onCreate,
  onUpdate,
  creating,
  currentUser,
  prefillCustomerName = "",
}) => {
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
    { open: false } | { open: true; comp: BomComponentName; idx: number }
  >({ open: false });

  const openModelDialog = (comp: BomComponentName, idx: number) =>
    setModelDialog({ open: true, comp, idx });

  const closeModelDialog = () => setModelDialog({ open: false });

  // Preview toggle
  const [showPreview, setShowPreview] = useState(false);
  const [bomOpen, setBomOpen] = useState(false);

  // Pre-populate all components by default on create
  useEffect(() => {
    if (mode === "create") {
      const all = (Object.keys(BOM_MASTER) as BomComponentName[]).map(
        (name) => {
          const opts = getOptionsFor(name) as readonly BomComponentOption[];
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
        }
      );
      setComponents((prev) => (prev.length ? prev : all));
    }
  }, [mode]);

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
          : (Object.keys(BOM_MASTER) as BomComponentName[]).map((name) => ({
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
        : (Object.keys(BOM_MASTER) as BomComponentName[]).map((name) => ({
            name,
            rows: [],
          }))
    );
  }, [mode, initial]);

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
  const addRow = (name: BomComponentName) => {
    setComponents((prev) =>
      prev.map((c) =>
        c.name === name ? { ...c, rows: [...c.rows, { model: "" }] } : c
      )
    );
  };
  const removeRow = (name: BomComponentName, idx: number) => {
    setComponents((prev) =>
      prev.map((c) =>
        c.name === name ? { ...c, rows: c.rows.filter((_, i) => i !== idx) } : c
      )
    );
  };
  const setRowModel = (name: BomComponentName, idx: number, model: string) => {
    const options = getOptionsFor(name) as readonly BomComponentOption[];
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
      return <div className="text-sm text-gray-600">Loading history…</div>;
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

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-h-[92vh] w-full max-w-[95vw] md:max-w-screen-2xl overflow-auto">
        <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold">
            {mode === "edit" ? "Edit Sales Request" : "Create Sales Request"}
          </h2>
          <div className="flex items-center gap-2">
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

        {!showPreview ? (
          <>
            {/* Core form */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Text
                label="Customer Name"
                required
                value={state.customerName}
                onChange={(v) => setState((s) => ({ ...s, customerName: v }))}
                readOnly={mode === "edit" || !!prefillCustomerName}
              />
              <Select
                label="Module Manufacturing Plant"
                required
                value={state.moduleManufacturingPlant}
                onChange={(v: any) =>
                  setState((s) => ({ ...s, moduleManufacturingPlant: v }))
                }
                options={["P2", "P4", "P5", "P6"]}
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
              />
              <Select
                label="Cell Tech"
                value={state.cellTech}
                onChange={(v: any) =>
                  setState((s) => ({ ...s, cellTech: v as CellTech }))
                }
                options={["PERC", "TOPCon"]}
              />
              <Select
                label="No. of Cells"
                value={state.cutCells}
                onChange={(v: any) =>
                  setState((s) => ({ ...s, cutCells: v as CutCells }))
                }
                options={["60", "66", "72", "78"]}
              />
              {/* NEW: Min Watt Peak (moved up from BOM) */}
              <ReadOnly label="Min Watt Peak" value={wattPeakLabel || "-"} />
              <Select
                label="Module Model Number"
                required
                value={moduleModelNumber}
                onChange={(v) => {
                  setModuleModelNumber(v);
                }}
                options={modelOptions}
              />
              <ReadOnly
                label="Solar Module Vendor Name (lock-in)"
                value={VENDOR_NAME_LOCKIN}
              />
              <ReadOnly
                label="Location of RFID in module (lock-in)"
                value={RFID_LOCATION_LOCKIN}
              />
              {/* 3) Module Dimensions (matrix-driven; M10 auto-picked) */}
              <Select
                label="Module Dimensions"
                required
                value={moduleDimensionsOption}
                onChange={(v: string) => setModuleDimensionsOption(v)}
                options={catDimOpts}
              />
              {/* 4) Module Model Number (auto-selected by Watt Peak) */}
              {/* Keep the rest as-is */}
              <Text
                label="Solar Module Vendor Address"
                value={vendorAddress}
                onChange={setVendorAddress}
              />
              <ReadOnly label="Document Ref (auto)" value={docRef} />{" "}
              <Select
                label="DCR Compliance?"
                required
                value={state.cellType}
                onChange={(v: any) => setState((s) => ({ ...s, cellType: v }))}
                options={["DCR", "NDCR"]}
              />
              <WattageDistTable rows={wattBins} onChange={setWattBins} />
              <IntField
                label="RFQ Order Quantity (MW)"
                required
                value={state.rfqOrderQtyMW}
                onChange={(v) => setState((s) => ({ ...s, rfqOrderQtyMW: v }))}
                placeholder="e.g., 20"
              />
              <IntField
                label="Premier Bidded Actual Order Quantity in MW"
                value={state.premierBiddedOrderQtyMW}
                onChange={(v) =>
                  setState((s) => ({ ...s, premierBiddedOrderQtyMW: v }))
                }
                placeholder="optional"
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
              />
              <Text
                label="Project Location"
                required
                value={state.projectLocation}
                onChange={(v) =>
                  setState((s) => ({ ...s, projectLocation: v }))
                }
              />
              {/* Right column */}
              <Select
                label="QAP From"
                required
                value={state.qapType}
                onChange={(v: any) => setState((s) => ({ ...s, qapType: v }))}
                options={["Customer", "Premier Energies"]}
              />
              {state.qapType === "Customer" && (
                <File label="QAP From Attachment" onChange={setQapTypeFile} />
              )}
              <Select
                label="BOM From"
                required
                value={state.bomFrom}
                onChange={(v: any) => setState((s) => ({ ...s, bomFrom: v }))}
                options={["Premier Energies", "Customer"]}
              />
              {state.bomFrom === "Customer" && (
                <File
                  label="BOM From Attachment"
                  onChange={setPrimaryBomFile}
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
              />
              <Select
                label="Pre-Dispatch Inspection (PDI)"
                required
                value={state.pdi}
                onChange={(v: any) => setState((s) => ({ ...s, pdi: v }))}
                options={["yes", "no"]}
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
              />
              <FloatField
                label="Agreed CTM"
                value={state.agreedCTM}
                onChange={(v) => setState((s) => ({ ...s, agreedCTM: v }))}
                placeholder="e.g., 0.9925"
              />
              <DateSingle
                label="Factory Audit Tentative Date"
                value={state.factoryAuditTentativeDate}
                onChange={(v) =>
                  setState((s) => ({ ...s, factoryAuditTentativeDate: v }))
                }
              />
              <IntField
                label="JB Cable Length (mm)"
                required
                value={state.cableLengthRequired}
                onChange={(v) =>
                  setState((s) => ({ ...s, cableLengthRequired: v }))
                }
                placeholder="in mm"
              />
              <IntField
                label="X Pitch (mm)"
                value={state.xPitchMm}
                onChange={(v) => setState((s) => ({ ...s, xPitchMm: v }))}
                placeholder="optional"
              />
              <IntField
                label="Tracker Details (790/1400mm)"
                value={state.trackerDetails}
                onChange={(v) => setState((s) => ({ ...s, trackerDetails: v }))}
                placeholder="optional"
              />
              <Select
                label="Priority"
                required
                value={state.priority}
                onChange={(v: any) => setState((s) => ({ ...s, priority: v }))}
                options={["high", "low"]}
              />
              <Textarea
                label="Remarks (optional)"
                value={state.remarks}
                onChange={(v) => setState((s) => ({ ...s, remarks: v }))}
              />
              {/* Multi file attachments with titles */}
              <div className="md:col-span-2">
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
              </div>
            </div>

            {/* BOM section */}
            <div className="px-4 pb-4">
              <Card>
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

                {bomOpen && (
                  <CardContent id="bom-editor" className="space-y-6">
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
                              const all = (
                                Object.keys(BOM_MASTER) as BomComponentName[]
                              ).map((name) => {
                                const opts = getOptionsFor(
                                  name
                                ) as readonly BomComponentOption[];
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
          </>
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
        options={modelDialog.open ? getOptionsFor(modelDialog.comp) : []}
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
            <div>Loading…</div>
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
  options: readonly BomComponentOption[];
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
}> = ({ rows, onChange }) => {
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

  const nonEmpty = rows.filter(
    (r) => r.range.trim() !== "" || r.pct.trim() !== ""
  );
  const sum = nonEmpty.reduce((a, r) => a + (Number(r.pct) || 0), 0);
  const valid = Math.abs(sum - 100) < 0.001 && nonEmpty.length >= 1;

  return (
    <div className="md:col-span-2">
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
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────────── */
/*  Small field + preview components                                         */
/* ────────────────────────────────────────────────────────────────────────── */

const Text: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;

  readOnly?: boolean;
}> = ({ label, value, onChange, required, readOnly }) => (
  <div>
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
  </div>
);

const ReadOnly: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div>
    <label className="block text-sm text-gray-700 mb-1">{label}</label>
    <input
      className="w-full border rounded px-3 py-2 bg-gray-50"
      value={value}
      readOnly
    />
  </div>
);

const Textarea: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, value, onChange }) => (
  <div className="md:col-span-2">
    <label className="block text-sm text-gray-700 mb-1">{label}</label>
    <textarea
      className="w-full border rounded px-3 py-2 min-h-[96px]"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

const Select: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  required?: boolean;
}> = ({ label, value, onChange, options, required }) => {
  const opts =
    value && !options.includes(value) ? [...options, value] : options;
  return (
    <div>
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
}> = ({ label, value, onChange, required, placeholder }) => (
  <div>
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
  </div>
);

/** Decimal input (string-based) that allows digits and a single dot. */
const FloatField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}> = ({ label, value, onChange, required, placeholder }) => (
  <div>
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
  </div>
);

const DateSingle: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, value, onChange }) => (
  <div>
    <label className="block text-sm text-gray-700 mb-1">{label}</label>
    <input
      type="date"
      className="w-full border rounded px-3 py-2"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

const DateRange: React.FC<{
  label: string;
  start: string;
  end: string;
  onChange: (s: string, e: string) => void;
}> = ({ label, start, end, onChange }) => (
  <div>
    <label className="block text-sm text-gray-700 mb-1">{label} *</label>
    <div className="flex items-center gap-2">
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
  </div>
);

const File: React.FC<{ label: string; onChange: (f: File | null) => void }> = ({
  label,
  onChange,
}) => (
  <div>
    <label className="block text-sm text-gray-700 mb-1">{label}</label>
    <input
      type="file"
      className="w-full border rounded px-3 py-1.5"
      onChange={(e) => onChange(e.target.files?.[0] || null)}
    />
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
