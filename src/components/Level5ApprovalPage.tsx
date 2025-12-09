import React, { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { QAPFormData, QAPSpecification } from "@/types/qap";

import ExtraAdditions from "@/components/ExtraAdditions";
import { isEdited } from "@/lib/edited";
import { downloadQapAsPDF } from "@/utils/qapPdfGenerator";

/* ───────────────────────────────────────────────────────────── */
/* Local lightweight types just for rendering the BOM tab        */
/* (Avoids coupling to Sales page; server embeds this on QAP)    */
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

const splitPhaseRoles = (obj: Record<string, any> | undefined) => {
  const r1: string[] = [],
    r2: string[] = [];
  if (!obj) return [r1, r2] as const;
  for (const k of Object.keys(obj)) (/^-?\w.*-2$/.test(k) ? r2 : r1).push(k);
  return [r1.sort(), r2.sort()] as const;
};
const prettyRole = (r: string) => r.replace(/-2$/, "");

const FieldRow: React.FC<{ label: string; value: React.ReactNode }> = ({
  label,
  value,
}) => (
  <div className="flex flex-col">
    <span className="text-gray-500">{label}</span>
    <span className="font-medium text-gray-900">{value ?? "-"}</span>
  </div>
);

// ── Thread helpers (robust to multiple shapes) ───────────────────────────────
type ThreadEntry = {
  by: string;
  at: string;
  responses: Record<number, string>;
};
type ThreadBubble = { by: string; at: string; text: string };

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
  // Legacy: { [sno]: string|obj } → wrap as a synthetic entry
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

const threadForSno = (comments: CommentPayload, sno: number): ThreadBubble[] =>
  normalizeToEntries(comments)
    .map((e) => ({
      by: e.by,
      at: e.at,
      text: toText((e.responses as any)?.[sno]),
    }))
    .filter((e) => e.text.trim().length > 0)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()); // newest first

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

/* ─────────────────────────────────────────────── */
/* EDIT HIGHLIGHT HELPERS (same as Final Comments) */
/* ─────────────────────────────────────────────── */

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

const HL_BOM_ROW =
  "bg-amber-50 ring-1 ring-amber-300 shadow-sm transition-colors";

const rowEdited = (
  scope: "mqp" | "visual",
  sno: number,
  qapLocal: any,
  idx: { mqp: Map<number, Set<string>>; visual: Map<number, Set<string>> }
) =>
  (scope === "mqp" ? idx.mqp.has(sno) : idx.visual.has(sno)) ||
  isEdited(scope, sno, qapLocal.editedSnos);

/* ─────────────────────────────────────────────── */
/* props                                           */
/* ─────────────────────────────────────────────── */
interface Level5ApprovalPageProps {
  qapData: QAPFormData[];
  onApprove: (id: string, feedback?: string) => void;
  onReject: (id: string, feedback: string) => void;
}

const Level5ApprovalPage: React.FC<Level5ApprovalPageProps> = ({
  qapData,
  onApprove,
  onReject,
}) => {
  const { user } = useAuth();

  /* ───────── state ───────── */
  const [searchTerm, setSearchTerm] = useState("");
  const [rowFilter, setRowFilter] = useState<
    "all" | "matched" | "unmatched" | "edited"
  >("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [decision, setDecision] = useState<{
    [qapId: string]: "approve" | "reject" | null;
  }>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  /* ───────── helpers ───────── */
  const fmtNum = (n?: number | null) =>
    n === null || n === undefined ? "-" : Number(n).toLocaleString();
  const fmtDec = (n?: number | null) =>
    n === null || n === undefined
      ? "-"
      : Number(n).toLocaleString(undefined, { maximumFractionDigits: 4 });

  /* ───────── reviewable list ───────── */
  const plantRaw = user?.plant || "";
  const userPlants = plantRaw
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);

  const reviewable = useMemo(() => {
    return qapData
      .filter((q) => {
        if (q.status !== "level-5") return false;
        const allowed =
          plantRaw === "" || userPlants.includes(q.plant.toLowerCase());
        if (!allowed) return false;
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

  const submitDecision = (qap: QAPFormData) => {
    const action = decision[qap.id];
    const note = feedback[qap.id]?.trim();
    if (!action) return;

    if (action === "approve") {
      // ✅ Generate the final QAP PDF before status transition
      // so the document captures MQP + Visual + BOM + edits + approvals + threads
      // along with the optional L5 approval note.
      try {
        downloadQapAsPDF(qap as any, {
          approvedLevel: 5,
          approvedBy: user?.email || user?.name || "Level 5 Approver",
          approvalNote: note || undefined,
          approvedAt: new Date().toISOString(),
        });
      } catch (err) {
        // Non-blocking: approval should not fail if printing is blocked by browser
        console.error("[QAP PDF] Level 5 print failed:", err);
      }

      onApprove(qap.id, note || undefined);
    } else {
      if (!note) {
        alert("Please provide reason for rejection.");
        return;
      }
      onReject(qap.id, note);
    }

    setExpanded((p) => ({ ...p, [qap.id]: false }));
    setDecision((p) => ({ ...p, [qap.id]: null }));
    setFeedback((p) => ({ ...p, [qap.id]: "" }));
  };

  /* ───────── render ───────── */
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold mb-4">Plant Head Approval – Level 5</h1>

      {/* top bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search QAPs…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64"
          />
          <label className="font-medium">Show Rows:</label>
          <select
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
        <div className="text-center text-gray-500 py-20">
          No QAPs pending final approval
        </div>
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

          const L2 = qap.levelResponses?.[2] || {};
          const L3 = qap.levelResponses?.[3] || {};
          const L4 = qap.levelResponses?.[4] || {};
          const [l3R1, l3R2] = splitPhaseRoles(L3);
          const [l4R1, l4R2] = splitPhaseRoles(L4);

          const isOpen = expanded[qap.id] || false;

          // Optional Sales Request with BOM (embedded by backend)
          const salesRequest: SalesRequestLite | undefined = (qap as any)
            ?.salesRequest;

          return (
            <Collapsible
              key={qap.id}
              open={isOpen}
              onOpenChange={(o) => setExpanded((p) => ({ ...p, [qap.id]: o }))}
              className="mb-4"
            >
              {/* header */}
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
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline">
                            {qap.plant.toUpperCase()}
                          </Badge>
                          <Badge variant="outline">{qap.productType}</Badge>
                          <Badge>{qap.orderQuantity} MW</Badge>
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary">{qap.status}</Badge>
                  </CardHeader>
                </Card>
              </CollapsibleTrigger>

              {/* detail */}
              <CollapsibleContent>
                <Card className="border-t-0">
                  <CardContent className="p-4">
                    <Tabs defaultValue="mqp">
                      <TabsList className="mb-4">
                        <TabsTrigger value="mqp">
                          MQP ({qap.specs.mqp.length})
                        </TabsTrigger>
                        <TabsTrigger value="visual">
                          Visual/EL ({qap.specs.visual.length})
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
                                <th className="p-2 border">Prod L2</th>
                                <th className="p-2 border">Qual L2</th>
                                <th className="p-2 border">Tech L2</th>
                                {l3R1.map((r) => (
                                  <th
                                    key={`mqp-l3-h-${r}`}
                                    className="p-2 border capitalize"
                                  >
                                    {prettyRole(r)} L3
                                  </th>
                                ))}
                                {l4R1.map((r) => (
                                  <th
                                    key={`mqp-l4-h-${r}`}
                                    className="p-2 border capitalize"
                                  >
                                    {prettyRole(r)} L4
                                  </th>
                                ))}
                                <th className="p-2 border">Final Comment</th>
                                {l3R2.map((r) => (
                                  <th
                                    key={`mqp-l3b-h-${r}`}
                                    className="p-2 border capitalize"
                                  >
                                    {prettyRole(r)} L3 (2nd)
                                  </th>
                                ))}
                                {l4R2.map((r) => (
                                  <th
                                    key={`mqp-l4b-h-${r}`}
                                    className="p-2 border capitalize"
                                  >
                                    {prettyRole(r)} L4 (2nd)
                                  </th>
                                ))}
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
                                      <td className="p-2 border">
                                        {s.criteria}
                                      </td>
                                      <td className="p-2 border">
                                        {s.subCriteria}
                                      </td>
                                      <td className="p-2 border">
                                        {s.specification}
                                      </td>
                                      <td className="p-2 border">
                                        {s.customerSpecification}
                                      </td>
                                      <td className="p-2 border align-top">
                                        <ThreadCell
                                          comments={
                                            L2.production?.comments as any
                                          }
                                          sno={s.sno}
                                        />
                                      </td>
                                      <td className="p-2 border align-top">
                                        <ThreadCell
                                          comments={L2.quality?.comments as any}
                                          sno={s.sno}
                                        />
                                      </td>
                                      <td className="p-2 border align-top">
                                        <ThreadCell
                                          comments={
                                            L2.technical?.comments as any
                                          }
                                          sno={s.sno}
                                        />
                                      </td>

                                      {l3R1.map((r) => (
                                        <td
                                          key={`mqp-l3-${r}-${s.sno}`}
                                          className="p-2 border align-top"
                                        >
                                          <ThreadCell
                                            comments={L3?.[r]?.comments as any}
                                            sno={s.sno}
                                          />
                                        </td>
                                      ))}

                                      {l4R1.map((r) => (
                                        <td
                                          key={`mqp-l4-${r}-${s.sno}`}
                                          className="p-2 border align-top"
                                        >
                                          <ThreadCell
                                            comments={L4?.[r]?.comments as any}
                                            sno={s.sno}
                                          />
                                        </td>
                                      ))}

                                      <td className="p-2 border">
                                        {qap.finalCommentsPerItem?.[s.sno] ||
                                          "—"}
                                      </td>

                                      {/* L3 2nd */}
                                      {l3R2.map((r) => (
                                        <td
                                          key={`mqp-l3b-${r}-${s.sno}`}
                                          className="p-2 border align-top"
                                        >
                                          <ThreadCell
                                            comments={L3?.[r]?.comments as any}
                                            sno={s.sno}
                                          />
                                        </td>
                                      ))}

                                      {/* L4 2nd */}
                                      {l4R2.map((r) => (
                                        <td
                                          key={`mqp-l4b-${r}-${s.sno}`}
                                          className="p-2 border align-top"
                                        >
                                          <ThreadCell
                                            comments={L4?.[r]?.comments as any}
                                            sno={s.sno}
                                          />
                                        </td>
                                      ))}
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
                                <th className="p-2 border">Prod L2</th>
                                <th className="p-2 border">Qual L2</th>
                                <th className="p-2 border">Tech L2</th>
                                {l3R1.map((r) => (
                                  <th
                                    key={`vis-l3-h-${r}`}
                                    className="p-2 border capitalize"
                                  >
                                    {prettyRole(r)} L3
                                  </th>
                                ))}
                                {l4R1.map((r) => (
                                  <th
                                    key={`vis-l4-h-${r}`}
                                    className="p-2 border capitalize"
                                  >
                                    {prettyRole(r)} L4
                                  </th>
                                ))}
                                <th className="p-2 border">Final Comment</th>
                                {l3R2.map((r) => (
                                  <th
                                    key={`vis-l3b-h-${r}`}
                                    className="p-2 border capitalize"
                                  >
                                    {prettyRole(r)} L3 (2nd)
                                  </th>
                                ))}
                                {l4R2.map((r) => (
                                  <th
                                    key={`vis-l4b-h-${r}`}
                                    className="p-2 border capitalize"
                                  >
                                    {prettyRole(r)} L4 (2nd)
                                  </th>
                                ))}
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
                                      <td className="p-2 border">
                                        {s.criteria}
                                      </td>
                                      <td className="p-2 border">
                                        {s.subCriteria}
                                      </td>
                                      <td className="p-2 border">
                                        {s.criteriaLimits}
                                      </td>
                                      <td className="p-2 border">
                                        {s.customerSpecification}
                                      </td>
                                      <td className="p-2 border align-top">
                                        <ThreadCell
                                          comments={
                                            L2.production?.comments as any
                                          }
                                          sno={s.sno}
                                        />
                                      </td>
                                      <td className="p-2 border align-top">
                                        <ThreadCell
                                          comments={L2.quality?.comments as any}
                                          sno={s.sno}
                                        />
                                      </td>
                                      <td className="p-2 border align-top">
                                        <ThreadCell
                                          comments={
                                            L2.technical?.comments as any
                                          }
                                          sno={s.sno}
                                        />
                                      </td>

                                      {l3R1.map((r) => (
                                        <td
                                          key={`vis-l3-${r}-${s.sno}`}
                                          className="p-2 border align-top"
                                        >
                                          <ThreadCell
                                            comments={L3?.[r]?.comments as any}
                                            sno={s.sno}
                                          />
                                        </td>
                                      ))}
                                      {l4R1.map((r) => (
                                        <td
                                          key={`vis-l4-${r}-${s.sno}`}
                                          className="p-2 border align-top"
                                        >
                                          <ThreadCell
                                            comments={L4?.[r]?.comments as any}
                                            sno={s.sno}
                                          />
                                        </td>
                                      ))}

                                      <td className="p-2 border">
                                        {qap.finalCommentsPerItem?.[s.sno] ||
                                          "—"}
                                      </td>
                                      {l3R2.map((r) => (
                                        <td
                                          key={`vis-l3b-${r}-${s.sno}`}
                                          className="p-2 border align-top"
                                        >
                                          <ThreadCell
                                            comments={L3?.[r]?.comments as any}
                                            sno={s.sno}
                                          />
                                        </td>
                                      ))}
                                      {l4R2.map((r) => (
                                        <td
                                          key={`vis-l4b-${r}-${s.sno}`}
                                          className="p-2 border align-top"
                                        >
                                          <ThreadCell
                                            comments={L4?.[r]?.comments as any}
                                            sno={s.sno}
                                          />
                                        </td>
                                      ))}
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      </TabsContent>

                      {/* BOM TAB */}
                      <TabsContent value="bom">
                        {!salesRequest ? (
                          <div className="text-sm text-gray-600">
                            No linked Sales Request/BOM found on this QAP.
                          </div>
                        ) : (
                          <div className="space-y-6">
                            <Card>
                              <CardHeader>
                                <CardTitle>Sales Request Summary</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                  <FieldRow
                                    label="Customer Name"
                                    value={salesRequest.customerName}
                                  />
                                  <FieldRow
                                    label="Project Code"
                                    value={salesRequest.projectCode || "-"}
                                  />
                                  <FieldRow
                                    label="New Customer?"
                                    value={salesRequest.isNewCustomer}
                                  />
                                  <FieldRow
                                    label="Manufacturing Plant"
                                    value={salesRequest.moduleManufacturingPlant?.toUpperCase()}
                                  />
                                  <FieldRow
                                    label="Order Type"
                                    value={salesRequest.moduleOrderType?.toUpperCase()}
                                  />
                                  <FieldRow
                                    label="Cell Type"
                                    value={salesRequest.cellType}
                                  />
                                  <FieldRow
                                    label="Wattage Binning"
                                    value={fmtNum(salesRequest.wattageBinning)}
                                  />
                                  <FieldRow
                                    label="RFQ Qty (MW)"
                                    value={fmtNum(salesRequest.rfqOrderQtyMW)}
                                  />
                                  <FieldRow
                                    label="Premier Bidded Qty (MW)"
                                    value={
                                      salesRequest.premierBiddedOrderQtyMW ??
                                      "-"
                                    }
                                  />
                                  <FieldRow
                                    label="Delivery Timeline"
                                    value={`${salesRequest.deliveryStartDate} → ${salesRequest.deliveryEndDate}`}
                                  />
                                  <FieldRow
                                    label="Project Location"
                                    value={salesRequest.projectLocation}
                                  />
                                  <FieldRow
                                    label="Cable Length"
                                    value={fmtNum(
                                      salesRequest.cableLengthRequired
                                    )}
                                  />
                                  <FieldRow
                                    label="QAP Type"
                                    value={salesRequest.qapType}
                                  />
                                  <FieldRow
                                    label="Primary BOM?"
                                    value={salesRequest.primaryBom?.toUpperCase()}
                                  />
                                  <FieldRow
                                    label="Inline Inspection?"
                                    value={salesRequest.inlineInspection?.toUpperCase()}
                                  />
                                  <FieldRow
                                    label="Cell Procured By"
                                    value={salesRequest.cellProcuredBy}
                                  />
                                  <FieldRow
                                    label="Agreed CTM"
                                    value={fmtDec(salesRequest.agreedCTM)}
                                  />
                                  <FieldRow
                                    label="Factory Audit Date"
                                    value={
                                      salesRequest.factoryAuditTentativeDate ||
                                      "-"
                                    }
                                  />
                                  <FieldRow
                                    label="X Pitch (mm)"
                                    value={salesRequest.xPitchMm ?? "-"}
                                  />
                                  <FieldRow
                                    label="Tracker @790/1400"
                                    value={salesRequest.trackerDetails ?? "-"}
                                  />
                                  <FieldRow
                                    label="Priority"
                                    value={salesRequest.priority}
                                  />
                                  <FieldRow
                                    label="Created By"
                                    value={salesRequest.createdBy}
                                  />
                                  <FieldRow
                                    label="Created At"
                                    value={new Date(
                                      salesRequest.createdAt
                                    ).toLocaleString()}
                                  />

                                  {salesRequest.remarks && (
                                    <div className="md:col-span-3">
                                      <div className="text-sm text-gray-700">
                                        <span className="font-medium">
                                          Remarks:
                                        </span>{" "}
                                        {salesRequest.remarks}
                                      </div>
                                    </div>
                                  )}

                                  {/* Attachments */}
                                  {salesRequest.qapTypeAttachmentUrl && (
                                    <div className="md:col-span-3">
                                      <a
                                        className="text-blue-600 underline"
                                        href={salesRequest.qapTypeAttachmentUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        View QAP Type Attachment
                                      </a>
                                    </div>
                                  )}
                                  {salesRequest.primaryBomAttachmentUrl && (
                                    <div className="md:col-span-3">
                                      <a
                                        className="text-blue-600 underline"
                                        href={
                                          salesRequest.primaryBomAttachmentUrl
                                        }
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        View Primary BOM Attachment
                                      </a>
                                    </div>
                                  )}
                                  {!!salesRequest.otherAttachments?.length && (
                                    <div className="md:col-span-3">
                                      <div className="font-medium">
                                        Other Attachments
                                      </div>
                                      <ul className="list-disc pl-5 space-y-1">
                                        {salesRequest.otherAttachments.map(
                                          (a, i) => (
                                            <li key={i}>
                                              <a
                                                className="text-blue-600 underline"
                                                target="_blank"
                                                rel="noreferrer"
                                                href={a.url}
                                              >
                                                {a.title ||
                                                  `Attachment ${i + 1}`}
                                              </a>
                                            </li>
                                          )
                                        )}
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
                                {!salesRequest.bom ? (
                                  <div className="text-sm text-gray-500">
                                    No BOM available.
                                  </div>
                                ) : (
                                  <>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                      <FieldRow
                                        label="Vendor (lock-in)"
                                        value={salesRequest.bom.vendorName}
                                      />
                                      <FieldRow
                                        label="RFID Location (lock-in)"
                                        value={salesRequest.bom.rfidLocation}
                                      />
                                      <FieldRow
                                        label="Technology Proposed"
                                        value={
                                          salesRequest.bom.technologyProposed
                                        }
                                      />
                                      <FieldRow
                                        label="Vendor Address"
                                        value={
                                          salesRequest.bom.vendorAddress || "-"
                                        }
                                      />
                                      <FieldRow
                                        label="Document Ref"
                                        value={salesRequest.bom.documentRef}
                                      />
                                      <FieldRow
                                        label="Module Wattage (WP)"
                                        value={fmtNum(
                                          salesRequest.bom.moduleWattageWp
                                        )}
                                      />
                                      <FieldRow
                                        label="Module Dimensions"
                                        value={
                                          salesRequest.bom
                                            .moduleDimensionsOption
                                        }
                                      />
                                      <FieldRow
                                        label="Module Model Number"
                                        value={
                                          salesRequest.bom.moduleModelNumber
                                        }
                                      />
                                    </div>

                                    {!!salesRequest.bom.components?.length ? (
                                      <div className="space-y-6">
                                        {salesRequest.bom.components.map(
                                          (c, idx) => (
                                            <div
                                              key={`${c.name}-${idx}`}
                                              className="overflow-auto"
                                            >
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
                                                    const rowsWithIndex =
                                                      Array.isArray(c.rows)
                                                        ? c.rows.map(
                                                            (r, rowIndex) => ({
                                                              r,
                                                              rowIndex,
                                                            })
                                                          )
                                                        : [];

                                                    const filteredRows =
                                                      rowFilter === "edited"
                                                        ? rowsWithIndex.filter(
                                                            ({ r, rowIndex }) =>
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

                                                    return filteredRows.map(
                                                      ({ r, rowIndex }, i) => (
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
                                                      )
                                                    );
                                                  })()}
                                                </tbody>
                                              </table>
                                            </div>
                                          )
                                        )}
                                      </div>
                                    ) : (
                                      <div className="text-sm text-gray-500">
                                        No BOM components.
                                      </div>
                                    )}
                                  </>
                                )}
                              </CardContent>
                            </Card>
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>

                    {/* Decision area */}
                    <div className="mt-6 space-y-4">
                      <div className="flex gap-4">
                        <Button
                          onClick={() =>
                            setDecision((p) => ({
                              ...p,
                              [qap.id]:
                                p[qap.id] === "approve" ? null : "approve",
                            }))
                          }
                          variant={
                            decision[qap.id] === "approve"
                              ? "default"
                              : "outline"
                          }
                          className={
                            decision[qap.id] === "approve"
                              ? "bg-green-600 hover:bg-green-700"
                              : ""
                          }
                        >
                          <CheckCircle className="w-4 h-4 mr-2" /> Approve
                        </Button>
                        <Button
                          onClick={() =>
                            setDecision((p) => ({
                              ...p,
                              [qap.id]:
                                p[qap.id] === "reject" ? null : "reject",
                            }))
                          }
                          variant={
                            decision[qap.id] === "reject"
                              ? "destructive"
                              : "outline"
                          }
                        >
                          <XCircle className="w-4 h-4 mr-2" /> Reject
                        </Button>
                      </div>

                      {decision[qap.id] && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            {decision[qap.id] === "approve"
                              ? "Approval comments (optional)"
                              : "Rejection reason (required)"}
                          </label>
                          <Textarea
                            value={feedback[qap.id] || ""}
                            onChange={(e) =>
                              setFeedback((p) => ({
                                ...p,
                                [qap.id]: e.target.value,
                              }))
                            }
                            placeholder={
                              decision[qap.id] === "approve"
                                ? "Add approval comments…"
                                : "State reason for rejection…"
                            }
                            className="min-h-[100px]"
                          />
                        </div>
                      )}

                      {decision[qap.id] && (
                        <div className="flex justify-end">
                          <Button
                            onClick={() => submitDecision(qap)}
                            disabled={
                              decision[qap.id] === "reject" &&
                              !feedback[qap.id]?.trim()
                            }
                            className={
                              decision[qap.id] === "approve"
                                ? "bg-green-600 hover:bg-green-700"
                                : "bg-red-600 hover:bg-red-700"
                            }
                          >
                            {decision[qap.id] === "approve"
                              ? "Confirm Approval"
                              : "Confirm Rejection"}
                          </Button>
                        </div>
                      )}
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

export default Level5ApprovalPage;
