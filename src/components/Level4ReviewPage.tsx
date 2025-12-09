import React, { useEffect, useMemo, useRef, useState } from "react";
import { isEdited } from "@/lib/edited";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { QAPFormData, QAPSpecification } from "@/types/qap";
import { Clock, Send, ChevronDown, ChevronUp } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

/* ───────────────────────────────────────────────────────────── */
/* Local lightweight types + helpers for rendering Sales/BOM     */
/* (kept local to avoid tight coupling with Sales components)    */
/* ───────────────────────────────────────────────────────────── */
type YesNo = "yes" | "no";
type SalesRequestLite = {
  id: string;
  projectCode?: string;
  customerName: string;
  isNewCustomer: YesNo;
  moduleManufacturingPlant: string;
  moduleOrderType: string;
  cellType: string;
  wattageBinning: number;
  rfqOrderQtyMW: number;
  premierBiddedOrderQtyMW?: number | null;
  deliveryStartDate: string;
  deliveryEndDate: string;
  projectLocation: string;
  cableLengthRequired: number;
  qapType: "Customer" | "Premier Energies";
  qapTypeAttachmentUrl?: string | null;
  primaryBom: YesNo;
  primaryBomAttachmentUrl?: string | null;
  inlineInspection: YesNo;
  cellProcuredBy: "Customer" | "Premier Energies";
  agreedCTM: number;
  factoryAuditTentativeDate?: string | null;
  xPitchMm?: number | null;
  trackerDetails?: number | null;
  priority: "high" | "low";
  remarks?: string | null;
  otherAttachments?: { title: string; url: string }[];
  createdBy: string;
  createdAt: string;
  bom?: {
    vendorName: string;
    rfidLocation: string;
    technologyProposed: string;
    vendorAddress?: string;
    documentRef: string;
    moduleWattageWp: number;
    moduleDimensionsOption: string;
    moduleModelNumber: string;
    components?: {
      name: string;
      rows: {
        model: string;
        subVendor?: string | null;
        spec?: string | null;
      }[];
    }[];
  } | null;
};

/* ───────────────────────────────────────────────────────────── */
/* Thread helpers (robust to multiple shapes)                    */
/* ───────────────────────────────────────────────────────────── */
type ThreadEntry = {
  by: string;
  at: string;
  responses: Record<number, string>;
};
type ThreadBubble = { by: string; at: string; text: string };

// Accept arrays, a single entry, or a legacy per-sno map with mixed values.
type CommentPayload =
  | ThreadEntry[]
  | ThreadEntry
  | Record<number, unknown>
  | undefined;

const isThreadEntry = (v: any): v is ThreadEntry =>
  !!v && typeof v === "object" && "by" in v && "at" in v && "responses" in v;

const toText = (v: any): string => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    if ("text" in v && typeof (v as any).text === "string")
      return (v as any).text;
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
};

const normalizeToEntries = (comments: CommentPayload): ThreadEntry[] => {
  if (!comments) return [];
  if (Array.isArray(comments)) return comments.filter(isThreadEntry);
  if (isThreadEntry(comments)) return [comments];

  const rec = comments as Record<number, unknown>;
  return [
    {
      by: "unknown",
      at: new Date().toISOString(),
      responses: Object.fromEntries(
        Object.entries(rec).map(([k, v]) => [Number(k), toText(v)])
      ),
    },
  ];
};

const threadForSno = (
  comments: CommentPayload,
  sno: number
): ThreadBubble[] => {
  const arr = normalizeToEntries(comments);
  return arr
    .map((e) => ({
      by: e.by,
      at: e.at,
      text: toText((e.responses as any)?.[sno]),
    }))
    .filter((e) => e.text.trim().length > 0)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
};

const ThreadCell: React.FC<{ comments: CommentPayload; sno: number }> = ({
  comments,
  sno,
}) => {
  const entries = threadForSno(comments, sno);
  if (!entries.length) return <span>—</span>;
  return (
    <div className="min-w-0 w-full space-y-1 max-h-28 overflow-y-auto overflow-x-hidden pr-1">
      {entries.map((e, i) => (
        <div key={i} className="rounded-md border bg-white/60 p-1">
          <div className="flex items-center justify-between gap-2 text-[10px] text-gray-500">
            <span className="font-medium truncate">{e.by}</span>
            <time className="shrink-0">{new Date(e.at).toLocaleString()}</time>
          </div>
          <div className="text-xs whitespace-pre-wrap break-words">
            {e.text}
          </div>
        </div>
      ))}
    </div>
  );
};

/* ───────────────────────────────────────────────────────────── */
/* Small display helper rows                                     */
/* ───────────────────────────────────────────────────────────── */
const FieldRow: React.FC<{ label: string; value: React.ReactNode }> = ({
  label,
  value,
}) => (
  <div className="flex flex-col">
    <span className="text-gray-500">{label}</span>
    <span className="font-medium text-gray-900">{value ?? "-"}</span>
  </div>
);

const fmtNum = (n?: number | null) =>
  n === null || n === undefined ? "-" : Number(n).toLocaleString();
const fmtDec = (n?: number | null) =>
  n === null || n === undefined
    ? "-"
    : Number(n).toLocaleString(undefined, { maximumFractionDigits: 4 });

/* ───────────────────────────────────────────────────────────── */
/* Edited-highlight helpers (mirrors Level3 logic)               */
/* ───────────────────────────────────────────────────────────── */
type EditRowDelta = {
  field?: string;
  key?: string;
  name?: string;
  before?: any;
  after?: any;
};
type EditRow = { sno: number; deltas?: EditRowDelta[] };
type EditEvent = {
  by?: string;
  at?: string;
  header?: any[];
  mqp?: EditRow[];
  visual?: EditRow[];
  bom?: { changed?: any[]; added?: any[]; removed?: any[] };
  scope?: string;
};

const _pickField = (d: any) =>
  (d?.field || d?.key || d?.name || "").toString().trim();

const getEditHistory = (qapLocal: any): EditEvent[] => {
  const out: EditEvent[] = [];

  const em = qapLocal?.editMeta;
  if (Array.isArray(em)) {
    for (const e of em) out.push(e as EditEvent);
  } else if (em && typeof em === "object") {
    out.push(em as EditEvent);
  }

  const hist = qapLocal?.editCommentsParsed;
  if (Array.isArray(hist) && hist.length) {
    for (const e of hist) out.push(e as EditEvent);
  }

  return out;
};

const latestEditEvent = (qapLocal: any): EditEvent | null => {
  const history = getEditHistory(qapLocal);
  if (!history.length) return null;

  for (let i = history.length - 1; i >= 0; i--) {
    const e = history[i] as EditEvent;
    const hasMq =
      Array.isArray(e.mqp) &&
      e.mqp.some((r) => Array.isArray(r.deltas) && r.deltas.length > 0);
    const hasVi =
      Array.isArray(e.visual) &&
      e.visual.some((r) => Array.isArray(r.deltas) && r.deltas.length > 0);

    if (hasMq || hasVi) return e;
  }

  return history[history.length - 1] as EditEvent;
};

const buildEditedIndex = (qapLocal: any) => {
  const ev = latestEditEvent(qapLocal);
  const mqp = new Map<number, Set<string>>();
  const visual = new Map<number, Set<string>>();

  const push = (idx: Map<number, Set<string>>, sno: number, raw: string) => {
    const set = idx.get(sno) || new Set<string>();
    const f = raw.trim();
    const norm =
      f === "limits"
        ? "criteriaLimits"
        : f === "premierSpec"
        ? "specification"
        : f;
    set.add(norm);
    idx.set(sno, set);
  };

  if (ev?.mqp) {
    for (const row of ev.mqp) {
      for (const d of row.deltas || [])
        push(mqp, Number(row.sno), _pickField(d));
    }
  }
  if (ev?.visual) {
    for (const row of ev.visual) {
      for (const d of row.deltas || [])
        push(visual, Number(row.sno), _pickField(d));
    }
  }

  return { mqp, visual };
};

const latestBomEditEvent = (qapLocal: any): EditEvent | null => {
  const history = getEditHistory(qapLocal);
  if (!history.length) return null;

  for (let i = history.length - 1; i >= 0; i--) {
    const e = history[i] as any;
    const b = e?.bom;
    const count =
      (b?.changed?.length || 0) +
      (b?.added?.length || 0) +
      (b?.removed?.length || 0);

    if (count > 0) return e as EditEvent;
  }

  return null;
};

const buildBomEditedIndex = (qapLocal: any) => {
  const ev = (latestBomEditEvent(qapLocal) ?? latestEditEvent(qapLocal)) as any;

  const changedPos = new Set<string>();
  const addedPos = new Set<string>();
  const removedPos = new Set<string>();

  const changed = new Set<string>();
  const added = new Set<string>();
  const removed = new Set<string>();

  const norm = (s: any) =>
    String(s || "")
      .trim()
      .toLowerCase();
  const posKey = (comp: string, index: number) =>
    `${norm(comp)}::${Number(index)}`;

  const pickNameFromEditItem = (x: any) =>
    norm(x?.row?.model || x?.model || x?.part || x?.name);

  const pushAll = (
    arr: any[] | undefined,
    posSet: Set<string>,
    nameSet: Set<string>
  ) => {
    if (!Array.isArray(arr)) return;

    for (const x of arr) {
      if (typeof x?.comp === "string" && typeof x?.index === "number") {
        posSet.add(posKey(x.comp, x.index));
      }

      const n = pickNameFromEditItem(x);
      if (n) nameSet.add(n);
    }
  };

  if (ev?.bom) {
    pushAll(ev.bom.changed, changedPos, changed);
    pushAll(ev.bom.added, addedPos, added);
    pushAll(ev.bom.removed, removedPos, removed);
  }

  return { changedPos, addedPos, removedPos, changed, added, removed };
};

const bomRowEdited = (
  idx: {
    changedPos: Set<string>;
    addedPos: Set<string>;
    removedPos: Set<string>;
    changed: Set<string>;
    added: Set<string>;
    removed: Set<string>;
  },
  compName: string,
  rowIndex: number,
  row: any
) => {
  const norm = (s: any) =>
    String(s || "")
      .trim()
      .toLowerCase();
  const keyPos = `${norm(compName)}::${Number(rowIndex)}`;

  if (idx.changedPos.has(keyPos) || idx.addedPos.has(keyPos)) return true;

  const keyName = norm(row?.model || row?.part || row?.name);
  if (!keyName) return false;

  return idx.changed.has(keyName) || idx.added.has(keyName);
};

const cellEdited = (
  idx: Map<number, Set<string>>,
  sno: number,
  ...fields: string[]
) => {
  const set = idx.get(sno);
  if (!set) return false;
  return fields.some((f) => set.has(f));
};

const rowEdited = (
  scope: "mqp" | "visual",
  sno: number,
  qapLocal: any,
  idx: { mqp: Map<number, Set<string>>; visual: Map<number, Set<string>> }
) =>
  (scope === "mqp" ? idx.mqp.has(sno) : idx.visual.has(sno)) ||
  isEdited(scope, sno, qapLocal.editedSnos);

const HL_CELL =
  "bg-amber-50 border-amber-300 ring-1 ring-amber-300 shadow-inner transition-colors";

const HL_BOM_ROW =
  "bg-amber-50 ring-1 ring-amber-300 shadow-sm transition-colors";

/* ───────────────────────────────────────────────────────────── */
/* Small isolated panel that lazily fetches Sales Request + BOM  */
/* if not already embedded on the QAP payload                    */
/* ───────────────────────────────────────────────────────────── */
const SalesBOMPanel: React.FC<{
  initial?: SalesRequestLite | undefined;
  salesRequestId?: string | undefined;
  rowFilter: "all" | "matched" | "unmatched" | "edited";
  bomEditedIndex: ReturnType<typeof buildBomEditedIndex>;
}> = ({ initial, salesRequestId, rowFilter, bomEditedIndex }) => {
  const [sr, setSr] = useState<SalesRequestLite | undefined>(initial);
  const [loading, setLoading] = useState<boolean>(!initial && !!salesRequestId);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (sr || !salesRequestId || fetchedRef.current) return;
    fetchedRef.current = true;
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/sales-requests/${salesRequestId}`, {
      method: "GET",
      credentials: "include",
      signal: ac.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as SalesRequestLite;
        setSr(data);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError("Failed to load Sales Request.");
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [salesRequestId, sr]);

  if (!sr && !salesRequestId) {
    return (
      <div className="text-sm text-gray-600">
        No linked Sales Request/BOM found on this QAP.
      </div>
    );
  }
  if (loading) {
    return <div className="text-sm text-gray-500">Loading BOM…</div>;
  }
  if (error) {
    return (
      <div className="text-sm text-red-600">
        {error} Please refresh or open the Sales Request directly.
      </div>
    );
  }
  if (!sr) {
    return <div className="text-sm text-gray-500">No BOM available.</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sales Request Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <FieldRow label="Customer Name" value={sr.customerName} />
            <FieldRow label="Project Code" value={sr.projectCode || "-"} />
            <FieldRow label="New Customer?" value={sr.isNewCustomer} />
            <FieldRow
              label="Manufacturing Plant"
              value={sr.moduleManufacturingPlant?.toUpperCase()}
            />
            <FieldRow
              label="Order Type"
              value={sr.moduleOrderType?.toUpperCase()}
            />
            <FieldRow label="Cell Type" value={sr.cellType} />
            <FieldRow
              label="Wattage Binning"
              value={fmtNum(sr.wattageBinning)}
            />
            <FieldRow label="RFQ Qty (MW)" value={fmtNum(sr.rfqOrderQtyMW)} />
            <FieldRow
              label="Premier Bidded Qty (MW)"
              value={sr.premierBiddedOrderQtyMW ?? "-"}
            />
            <FieldRow
              label="Delivery Timeline"
              value={`${sr.deliveryStartDate} → ${sr.deliveryEndDate}`}
            />
            <FieldRow label="Project Location" value={sr.projectLocation} />
            <FieldRow
              label="Cable Length"
              value={fmtNum(sr.cableLengthRequired)}
            />
            <FieldRow label="QAP Type" value={sr.qapType} />
            <FieldRow
              label="Primary BOM?"
              value={sr.primaryBom?.toUpperCase()}
            />
            <FieldRow
              label="Inline Inspection?"
              value={sr.inlineInspection?.toUpperCase()}
            />
            <FieldRow label="Cell Procured By" value={sr.cellProcuredBy} />
            <FieldRow label="Agreed CTM" value={fmtDec(sr.agreedCTM)} />
            <FieldRow
              label="Factory Audit Date"
              value={sr.factoryAuditTentativeDate || "-"}
            />
            <FieldRow label="X Pitch (mm)" value={sr.xPitchMm ?? "-"} />
            <FieldRow
              label="Tracker @790/1400"
              value={sr.trackerDetails ?? "-"}
            />
            <FieldRow label="Priority" value={sr.priority} />
            <FieldRow label="Created By" value={sr.createdBy} />
            <FieldRow
              label="Created At"
              value={new Date(sr.createdAt).toLocaleString()}
            />
            <div className="md:col-span-3">
              <div className="text-sm text-gray-700">
                <span className="font-medium">Remarks:</span>{" "}
                {sr.remarks || "-"}
              </div>
            </div>

            {sr.qapTypeAttachmentUrl && (
              <div className="md:col-span-3">
                <a
                  className="text-blue-600 underline"
                  href={sr.qapTypeAttachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  View QAP Type Attachment
                </a>
              </div>
            )}
            {sr.primaryBomAttachmentUrl && (
              <div className="md:col-span-3">
                <a
                  className="text-blue-600 underline"
                  href={sr.primaryBomAttachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  View Primary BOM Attachment
                </a>
              </div>
            )}
            {!!sr.otherAttachments?.length && (
              <div className="md:col-span-3">
                <div className="font-medium">Other Attachments</div>
                <ul className="list-disc pl-5 space-y-1">
                  {sr.otherAttachments.map((a, i) => (
                    <li key={i}>
                      <a
                        className="text-blue-600 underline"
                        target="_blank"
                        rel="noreferrer"
                        href={a.url}
                      >
                        {a.title || `Attachment ${i + 1}`}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>BOM</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!sr.bom ? (
            <div className="text-sm text-gray-500">No BOM available.</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <FieldRow label="Vendor (lock-in)" value={sr.bom.vendorName} />
                <FieldRow
                  label="RFID Location (lock-in)"
                  value={sr.bom.rfidLocation}
                />
                <FieldRow
                  label="Technology Proposed"
                  value={sr.bom.technologyProposed}
                />
                <FieldRow
                  label="Vendor Address"
                  value={sr.bom.vendorAddress || "-"}
                />
                <FieldRow label="Document Ref" value={sr.bom.documentRef} />
                <FieldRow
                  label="Module Wattage (WP)"
                  value={fmtNum(sr.bom.moduleWattageWp)}
                />
                <FieldRow
                  label="Module Dimensions"
                  value={sr.bom.moduleDimensionsOption}
                />
                <FieldRow
                  label="Module Model Number"
                  value={sr.bom.moduleModelNumber}
                />
              </div>

              {!!sr.bom.components?.length ? (
                <div className="space-y-6">
                  {sr.bom.components.map((c, idx) => (
                    <div key={`${c.name}-${idx}`} className="overflow-auto">
                      <div className="font-medium mb-2">
                        {c.name}
                        {rowFilter === "edited" && (
                          <span className="text-xs text-gray-500 ml-2">
                            (edited rows only)
                          </span>
                        )}
                      </div>

                      <table className="min-w-full text-sm border">
                        <thead className="bg-gray-50 text-left">
                          <tr>
                            <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                              Part No / Type / Model
                            </th>
                            <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                              Sub-vendor / Manufacturer
                            </th>
                            <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                              Specification
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(() => {
                            const rowsWithIndex = Array.isArray(c.rows)
                              ? c.rows.map((r, rowIndex) => ({ r, rowIndex }))
                              : [];

                            const filteredRows =
                              rowFilter === "edited"
                                ? rowsWithIndex.filter(({ r, rowIndex }) =>
                                    bomRowEdited(
                                      bomEditedIndex,
                                      c.name,
                                      rowIndex,
                                      r
                                    )
                                  )
                                : rowsWithIndex;

                            if (
                              rowFilter === "edited" &&
                              filteredRows.length === 0
                            ) {
                              return null;
                            }

                            return filteredRows.map(({ r, rowIndex }, i) => (
                              <tr
                                key={i}
                                className={`align-top ${
                                  bomRowEdited(
                                    bomEditedIndex,
                                    c.name,
                                    rowIndex,
                                    r
                                  )
                                    ? HL_BOM_ROW
                                    : ""
                                }`}
                              >
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {r.model || "-"}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {r.subVendor || "-"}
                                </td>
                                <td className="px-3 py-2">
                                  <div className="whitespace-pre-wrap">
                                    {r.spec || "—"}
                                  </div>
                                </td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No BOM components.</div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

/* ───────────────────────────────────────────────────────────── */
/* Main Level4ReviewPage                                         */
/* ───────────────────────────────────────────────────────────── */
interface Level4ReviewPageProps {
  qapData: QAPFormData[];
  onNext: (qapId: string, comments: Record<number, string>) => void;
}

const Level4ReviewPage: React.FC<Level4ReviewPageProps> = ({
  qapData,
  onNext,
}) => {
  const { user } = useAuth();

  /* ───────────────────────── state ───────────────────────── */
  const [searchTerm, setSearchTerm] = useState("");
  const [rowFilter, setRowFilter] = useState<
    "all" | "matched" | "unmatched" | "edited"
  >("all");

  const [responses, setResponses] = useState<{
    [qapId: string]: Record<number, string>;
  }>({});

  const [expanded, setExpanded] = useState<{ [qapId: string]: boolean }>({});

  /* ────────────────────── derive QAP list ────────────────── */
  const plantRaw = user?.plant || "";
  const userPlants = plantRaw
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);

  const reviewable = useMemo(() => {
    return qapData
      .filter((q) => {
        if (q.currentLevel !== 4) return false;
        const allow =
          plantRaw === "" || userPlants.includes(q.plant.toLowerCase());
        if (!allow) return false;
        if (!searchTerm) return true;
        const s = searchTerm.toLowerCase();
        return (
          q.customerName.toLowerCase().includes(s) ||
          q.projectName.toLowerCase().includes(s) ||
          (q.submittedBy || "").toLowerCase().includes(s)
        );
      })
      .map((q) => ({
        ...q,
        allSpecs: [
          ...(q.specs.mqp || []),
          ...(q.specs.visual || []),
        ] as QAPSpecification[],
      }));
  }, [qapData, plantRaw, userPlants, searchTerm]);

  /* ────────────────────── helpers ────────────────────────── */
  const handleResponseChange = (qapId: string, sno: number, val: string) =>
    setResponses((p) => ({
      ...p,
      [qapId]: { ...(p[qapId] || {}), [sno]: val },
    }));

  const submit = (qapId: string) => onNext(qapId, responses[qapId] || {});

  const timeRemaining = (submittedAt?: string) => {
    if (!submittedAt) return "Unknown";
    const elapsed = Date.now() - new Date(submittedAt).getTime();
    const remaining = 4 * 86_400_000 - elapsed;
    if (remaining <= 0) return "Expired";
    const d = Math.floor(remaining / 86_400_000);
    const h = Math.floor((remaining % 86_400_000) / 3_600_000);
    return `${d}d ${h}h left`;
  };

  /* ─────────────────────── render ────────────────────────── */
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold mb-4">
        Level 4 Review –{" "}
        {user?.role
          ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
          : ""}
      </h1>

      {/* Top controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 space-y-4 md:space-y-0">
        <div className="flex items-center space-x-2">
          <Input
            placeholder="Search QAPs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64"
          />
          <label htmlFor="rowFilter" className="font-medium">
            Show Rows:
          </label>
          <select
            id="rowFilter"
            value={rowFilter}
            onChange={(e) => setRowFilter(e.target.value as any)}
            className="border rounded px-2 py-1"
          >
            <option value="all">All</option>
            <option value="matched">Matched (Green)</option>
            <option value="unmatched">Unmatched (Red)</option>
            <option value="edited">Edited (since last submission)</option>
          </select>
        </div>
        <span className="text-sm text-gray-600">
          Pending QAPs: {reviewable.length}
        </span>
      </div>

      {reviewable.length === 0 ? (
        <div className="py-20 text-center text-gray-500">No QAPs to review</div>
      ) : (
        reviewable.map((qap) => {
          const editedIndex = buildEditedIndex(qap);
          const bomEditedIndex = buildBomEditedIndex(qap);

          const specs = qap.allSpecs.filter((s) => {
            if (rowFilter === "all") return true;
            if (rowFilter === "matched") return s.match === "yes";
            if (rowFilter === "unmatched") return s.match === "no";

            if (rowFilter === "edited") {
              return (
                editedIndex.mqp.has(s.sno) ||
                editedIndex.visual.has(s.sno) ||
                isEdited("mqp", s.sno, (qap as any).editedSnos) ||
                isEdited("visual", s.sno, (qap as any).editedSnos)
              );
            }
            return true;
          });

          /* Pull L2 & L3 comments */
          const l2 = qap.levelResponses?.[2] || {};
          const l3 = qap.levelResponses?.[3] || {};
          const prodL2 = l2.production?.comments || {};
          const qualL2 = l2.quality?.comments || {};
          const techL2 = l2.technical?.comments || {};

          const l3FirstKeys = Object.keys(l3).filter((k) => !k.endsWith("-2"));
          const l3bKeys = Object.keys(l3).filter((k) => k.endsWith("-2"));

          const isPostFinal = (qap as any).status === "level-4b";

          const finalPerItem = ((qap as any).finalCommentsPerItem ||
            {}) as Record<number, string>;
          const finalAll = (qap as any).finalComments as string | undefined;

          const isOpen = expanded[qap.id] || false;

          const salesRequestEmbedded: SalesRequestLite | undefined = (
            qap as any
          )?.salesRequest;
          const salesRequestId: string | undefined = (qap as any)
            ?.salesRequestId;

          return (
            <Collapsible
              key={qap.id}
              open={isOpen}
              onOpenChange={(o) => setExpanded((p) => ({ ...p, [qap.id]: o }))}
              className="mb-4"
            >
              {/* ────────── Trigger / Header row ────────── */}
              <CollapsibleTrigger asChild>
                <Card className="cursor-pointer hover:bg-gray-50">
                  <CardHeader className="flex justify-between items-center p-4">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 p-0"
                        tabIndex={-1}
                      >
                        {isOpen ? (
                          <ChevronUp className="h-5 w-5" />
                        ) : (
                          <ChevronDown className="h-5 w-5" />
                        )}
                      </Button>
                      <div>
                        <CardTitle className="text-lg">
                          {qap.customerName} – {qap.projectName}
                        </CardTitle>
                        <div className="flex space-x-2 mt-1">
                          <Badge variant="outline">
                            {qap.plant.toUpperCase()}
                          </Badge>
                          <Badge variant="outline">{qap.productType}</Badge>
                          <Badge>{qap.orderQuantity} MW</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Clock className="h-4 w-4 text-orange-500" />
                      <span>{timeRemaining(qap.submittedAt)}</span>
                    </div>
                  </CardHeader>
                </Card>
              </CollapsibleTrigger>

              {/* ────────── Content ────────── */}
              <CollapsibleContent>
                <Card className="border-t-0">
                  <CardContent className="p-4">
                    <Tabs defaultValue="mqp">
                      <TabsList className="mb-4">
                        <TabsTrigger value="mqp">
                          MQP ({qap.specs.mqp.length})
                        </TabsTrigger>
                        <TabsTrigger value="visual">
                          Visual ({qap.specs.visual.length})
                        </TabsTrigger>
                        <TabsTrigger value="bom">
                          BOM
                          {(() => {
                            const ev = latestBomEditEvent(qap) as any;
                            const hasBomEdits =
                              (ev?.bom?.changed?.length || 0) +
                                (ev?.bom?.added?.length || 0) +
                                (ev?.bom?.removed?.length || 0) >
                              0;

                            return hasBomEdits ? (
                              <Badge
                                variant="outline"
                                className="ml-2 bg-amber-50 border-amber-300 text-amber-800"
                              >
                                Edited
                              </Badge>
                            ) : null;
                          })()}
                        </TabsTrigger>
                      </TabsList>

                      {/* MQP TAB */}
                      <TabsContent value="mqp">
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-sm">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="p-2 border">S.No</th>
                                <th className="p-2 border">Criteria</th>
                                <th className="p-2 border">Sub-Criteria</th>
                                <th className="p-2 border">Premier Spec</th>
                                <th className="p-2 border">Customer Spec</th>
                                <th className="p-2 border">Prod&nbsp;L2</th>
                                <th className="p-2 border">Qual&nbsp;L2</th>
                                <th className="p-2 border">Tech&nbsp;L2</th>

                                {l3FirstKeys.map((r) => (
                                  <th
                                    key={`mqp-head-l3-${r}`}
                                    className="p-2 border capitalize"
                                  >
                                    {r.replace(/-2$/, "")}&nbsp;L3
                                  </th>
                                ))}

                                {isPostFinal && (
                                  <th className="p-2 border">Final</th>
                                )}

                                {isPostFinal &&
                                  l3bKeys.map((r) => (
                                    <th
                                      key={`mqp-head-l3b-${r}`}
                                      className="p-2 border capitalize"
                                    >
                                      {r.replace(/-2$/, "")}&nbsp;L3b
                                    </th>
                                  ))}

                                <th className="p-2 border">Match</th>
                                <th className="p-2 border">Your Comment</th>
                              </tr>
                            </thead>
                            <tbody>
                              {specs
                                .filter((s) => qap.specs.mqp.includes(s as any))
                                .map((s) => {
                                  const mqEdited = rowEdited(
                                    "mqp",
                                    s.sno,
                                    qap,
                                    editedIndex
                                  );

                                  return (
                                    <tr
                                      key={s.sno}
                                      className={`border-b ${
                                        mqEdited
                                          ? "bg-amber-50 ring-1 ring-amber-300"
                                          : s.match === "yes"
                                          ? "bg-green-50"
                                          : "bg-red-50"
                                      }`}
                                    >
                                      <td className="p-2 border">
                                        {s.sno}
                                        {mqEdited && (
                                          <Badge
                                            variant="outline"
                                            className="ml-2 bg-amber-50 border-amber-300 text-amber-800"
                                          >
                                            Edited
                                          </Badge>
                                        )}
                                      </td>

                                      <td
                                        className={`p-2 border ${
                                          cellEdited(
                                            editedIndex.mqp,
                                            s.sno,
                                            "criteria"
                                          )
                                            ? HL_CELL
                                            : ""
                                        }`}
                                      >
                                        {s.criteria}
                                      </td>
                                      <td
                                        className={`p-2 border ${
                                          cellEdited(
                                            editedIndex.mqp,
                                            s.sno,
                                            "subCriteria"
                                          )
                                            ? HL_CELL
                                            : ""
                                        }`}
                                      >
                                        {s.subCriteria}
                                      </td>
                                      <td
                                        className={`p-2 border ${
                                          cellEdited(
                                            editedIndex.mqp,
                                            s.sno,
                                            "specification",
                                            "premierSpec"
                                          )
                                            ? HL_CELL
                                            : ""
                                        }`}
                                      >
                                        {s.specification}
                                      </td>
                                      <td
                                        className={`p-2 border ${
                                          cellEdited(
                                            editedIndex.mqp,
                                            s.sno,
                                            "customerSpecification",
                                            "customerSpec"
                                          )
                                            ? HL_CELL
                                            : ""
                                        }`}
                                      >
                                        {s.customerSpecification}
                                      </td>

                                      <td className="p-2 border align-top">
                                        <ThreadCell
                                          comments={prodL2}
                                          sno={s.sno}
                                        />
                                      </td>
                                      <td className="p-2 border align-top">
                                        <ThreadCell
                                          comments={qualL2}
                                          sno={s.sno}
                                        />
                                      </td>
                                      <td className="p-2 border align-top">
                                        <ThreadCell
                                          comments={techL2}
                                          sno={s.sno}
                                        />
                                      </td>

                                      {l3FirstKeys.map((k) => (
                                        <td
                                          key={`mqp-l3-${k}-${s.sno}`}
                                          className="p-2 border align-top"
                                        >
                                          <ThreadCell
                                            comments={l3[k]?.comments as any}
                                            sno={s.sno}
                                          />
                                        </td>
                                      ))}

                                      {isPostFinal && (
                                        <td className="p-2 border align-top">
                                          <div className="text-xs whitespace-pre-wrap break-words">
                                            {finalPerItem[s.sno] ??
                                              finalAll ??
                                              "—"}
                                          </div>
                                        </td>
                                      )}

                                      {isPostFinal &&
                                        l3bKeys.map((k) => (
                                          <td
                                            key={`mqp-l3b-${k}-${s.sno}`}
                                            className="p-2 border align-top"
                                          >
                                            <ThreadCell
                                              comments={l3[k]?.comments as any}
                                              sno={s.sno}
                                            />
                                          </td>
                                        ))}

                                      <td className="p-2 border">
                                        <Badge
                                          variant={
                                            s.match === "yes"
                                              ? "success"
                                              : "destructive"
                                          }
                                        >
                                          {s.match?.toUpperCase()}
                                        </Badge>
                                      </td>

                                      <td className="p-2 border">
                                        <Textarea
                                          value={
                                            responses[qap.id]?.[s.sno] || ""
                                          }
                                          onChange={(e) =>
                                            handleResponseChange(
                                              qap.id,
                                              s.sno,
                                              e.target.value
                                            )
                                          }
                                          placeholder="Comments…"
                                          className="min-h-[3rem]"
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      </TabsContent>

                      {/* VISUAL TAB */}
                      <TabsContent value="visual">
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-sm">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="p-2 border">S.No</th>
                                <th className="p-2 border">Criteria</th>
                                <th className="p-2 border">Sub-Criteria</th>
                                <th className="p-2 border">Limits</th>
                                <th className="p-2 border">Customer Spec</th>
                                <th className="p-2 border">Prod&nbsp;L2</th>
                                <th className="p-2 border">Qual&nbsp;L2</th>
                                <th className="p-2 border">Tech&nbsp;L2</th>

                                {l3FirstKeys.map((r) => (
                                  <th
                                    key={`vis-head-l3-${r}`}
                                    className="p-2 border capitalize"
                                  >
                                    {r.replace(/-2$/, "")}&nbsp;L3
                                  </th>
                                ))}

                                {isPostFinal && (
                                  <th className="p-2 border">Final</th>
                                )}

                                {isPostFinal &&
                                  l3bKeys.map((r) => (
                                    <th
                                      key={`vis-head-l3b-${r}`}
                                      className="p-2 border capitalize"
                                    >
                                      {r.replace(/-2$/, "")}&nbsp;L3b
                                    </th>
                                  ))}

                                <th className="p-2 border">Match</th>
                                <th className="p-2 border">Your Comment</th>
                              </tr>
                            </thead>
                            <tbody>
                              {specs
                                .filter((s) =>
                                  qap.specs.visual.includes(s as any)
                                )
                                .map((s) => {
                                  const vEdited = rowEdited(
                                    "visual",
                                    s.sno,
                                    qap,
                                    editedIndex
                                  );

                                  return (
                                    <tr
                                      key={s.sno}
                                      className={`border-b ${
                                        vEdited
                                          ? "bg-amber-50 ring-1 ring-amber-300"
                                          : s.match === "yes"
                                          ? "bg-green-50"
                                          : "bg-red-50"
                                      }`}
                                    >
                                      <td className="p-2 border">
                                        {s.sno}
                                        {vEdited && (
                                          <Badge
                                            variant="outline"
                                            className="ml-2 bg-amber-50 border-amber-300 text-amber-800"
                                          >
                                            Edited
                                          </Badge>
                                        )}
                                      </td>

                                      <td
                                        className={`p-2 border ${
                                          cellEdited(
                                            editedIndex.visual,
                                            s.sno,
                                            "criteria"
                                          )
                                            ? HL_CELL
                                            : ""
                                        }`}
                                      >
                                        {s.criteria}
                                      </td>
                                      <td
                                        className={`p-2 border ${
                                          cellEdited(
                                            editedIndex.visual,
                                            s.sno,
                                            "subCriteria"
                                          )
                                            ? HL_CELL
                                            : ""
                                        }`}
                                      >
                                        {s.subCriteria}
                                      </td>
                                      <td
                                        className={`p-2 border ${
                                          cellEdited(
                                            editedIndex.visual,
                                            s.sno,
                                            "criteriaLimits",
                                            "limits"
                                          )
                                            ? HL_CELL
                                            : ""
                                        }`}
                                      >
                                        {s.criteriaLimits}
                                      </td>
                                      <td
                                        className={`p-2 border ${
                                          cellEdited(
                                            editedIndex.visual,
                                            s.sno,
                                            "customerSpecification",
                                            "customerSpec"
                                          )
                                            ? HL_CELL
                                            : ""
                                        }`}
                                      >
                                        {s.customerSpecification}
                                      </td>

                                      <td className="p-2 border align-top">
                                        <ThreadCell
                                          comments={prodL2}
                                          sno={s.sno}
                                        />
                                      </td>
                                      <td className="p-2 border align-top">
                                        <ThreadCell
                                          comments={qualL2}
                                          sno={s.sno}
                                        />
                                      </td>
                                      <td className="p-2 border align-top">
                                        <ThreadCell
                                          comments={techL2}
                                          sno={s.sno}
                                        />
                                      </td>

                                      {l3FirstKeys.map((k) => (
                                        <td
                                          key={`vis-l3-${k}-${s.sno}`}
                                          className="p-2 border align-top"
                                        >
                                          <ThreadCell
                                            comments={l3[k]?.comments as any}
                                            sno={s.sno}
                                          />
                                        </td>
                                      ))}

                                      {isPostFinal && (
                                        <td className="p-2 border align-top">
                                          <div className="text-xs whitespace-pre-wrap break-words">
                                            {finalPerItem[s.sno] ??
                                              finalAll ??
                                              "—"}
                                          </div>
                                        </td>
                                      )}

                                      {isPostFinal &&
                                        l3bKeys.map((k) => (
                                          <td
                                            key={`vis-l3b-${k}-${s.sno}`}
                                            className="p-2 border align-top"
                                          >
                                            <ThreadCell
                                              comments={l3[k]?.comments as any}
                                              sno={s.sno}
                                            />
                                          </td>
                                        ))}

                                      <td className="p-2 border">
                                        <Badge
                                          variant={
                                            s.match === "yes"
                                              ? "success"
                                              : "destructive"
                                          }
                                        >
                                          {s.match?.toUpperCase()}
                                        </Badge>
                                      </td>

                                      <td className="p-2 border">
                                        <Textarea
                                          value={
                                            responses[qap.id]?.[s.sno] || ""
                                          }
                                          onChange={(e) =>
                                            handleResponseChange(
                                              qap.id,
                                              s.sno,
                                              e.target.value
                                            )
                                          }
                                          placeholder="Comments…"
                                          className="min-h-[3rem]"
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      </TabsContent>

                      {/* BOM TAB (with lazy fetch fallback + edited filter) */}
                      <TabsContent value="bom">
                        <SalesBOMPanel
                          initial={salesRequestEmbedded}
                          salesRequestId={salesRequestId}
                          rowFilter={rowFilter}
                          bomEditedIndex={bomEditedIndex}
                        />
                      </TabsContent>
                    </Tabs>

                    <div className="mt-4 flex justify-end">
                      <Button
                        onClick={() => submit(qap.id)}
                        disabled={
                          Object.keys(responses[qap.id] || {}).length === 0
                        }
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Submit Review
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          );
        })
      )}
    </div>
  );
};

export default Level4ReviewPage;
