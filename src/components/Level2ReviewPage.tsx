import React, { useState, useMemo } from "react";
import { isEdited } from "@/lib/edited"; // or "./edited" depending on your path
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { QAPFormData, QAPSpecification } from "@/types/qap";
import {
  Clock,
  CheckCircle2,
  Send,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

interface Level2ReviewPageProps {
  qapData: QAPFormData[];
  onNext: (
    qapId: string,
    role: string,
    responses: { [sno: number]: string }
  ) => void;
}

/* ───────────────────────────────────────────────────────────── */
/* Local lightweight types just for rendering the BOM tab        */
/* (We avoid importing from the Sales page and keep it optional) */
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

type ReviewThreadEntry = {
  by: string;
  at: string; // ISO
  responses: Record<number, string>; // sno -> text
};

function getThreadForSpec(
  levelResponses: QAPFormData["levelResponses"],
  level: number,
  role: string,
  sno: number
): { by: string; at: string; text: string }[] {
  const lr = levelResponses?.[level]?.[role];
  if (!lr || !Array.isArray(lr.comments)) return [];
  const thread = lr.comments as ReviewThreadEntry[];
  return thread
    .map((e) => ({
      by: e.by,
      at: e.at,
      text: e.responses?.[sno],
    }))
    .filter((x) => x.text && x.text.trim().length > 0);
}

const FieldRow: React.FC<{ label: string; value: React.ReactNode }> = ({
  label,
  value,
}) => (
  <div className="flex flex-col">
    <span className="text-gray-500">{label}</span>
    <span className="font-medium text-gray-900">{value ?? "-"}</span>
  </div>
);

const Level2ReviewPage: React.FC<Level2ReviewPageProps> = ({
  qapData,
  onNext,
}) => {
  const { user } = useAuth();

  /* ───────────────────────── state ───────────────────────── */
  const [responses, setResponses] = useState<
    Record<string, Record<number, string>>
  >({});
  const [rowFilter, setRowFilter] = useState<
    "all" | "matched" | "unmatched" | "edited"
  >("all");

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  /* ───────────────────── derive reviewable ───────────────────── */
  const userPlants = (user?.plant || "")
    .split(",")
    .map((p) => p.trim().toLowerCase());

  const reviewable = useMemo(
    () =>
      qapData
        .filter(
          (q) =>
            q.currentLevel === 2 && userPlants.includes(q.plant.toLowerCase())
        )
        .map((q) => ({
          ...q,
          allSpecs: [
            ...(q.specs.mqp || []),
            ...(q.specs.visual || []),
          ] as QAPSpecification[],
        })),
    [qapData, userPlants]
  );

  /* ───────────────────────── helpers ───────────────────────── */
  const handleChange = (qapId: string, sno: number, val: string) =>
    setResponses((prev) => ({
      ...prev,
      [qapId]: { ...(prev[qapId] || {}), [sno]: val },
    }));

  const getTimeRemaining = (submittedAt?: string) => {
    if (!submittedAt) return "Unknown";
    const elapsed = Date.now() - new Date(submittedAt).getTime();
    const remaining = 4 * 86_400_000 - elapsed;
    if (remaining <= 0) return "Expired";
    const d = Math.floor(remaining / 86_400_000);
    const h = Math.floor((remaining % 86_400_000) / 3_600_000);
    return `${d}d ${h}h left`;
  };

  const submit = (qapId: string) => {
    onNext(qapId, user?.role || "", responses[qapId] || {});
  };

  const fmtNum = (n?: number | null) =>
    n === null || n === undefined ? "-" : Number(n).toLocaleString();

  const fmtDec = (n?: number | null) =>
    n === null || n === undefined
      ? "-"
      : Number(n).toLocaleString(undefined, { maximumFractionDigits: 4 });

  // >>> CHANGE_SUMMARY_HELPERS (ADD)
  // Surface edit history (qap.editMeta) so reviewers can see what changed.
  // editMeta is already attached to each QAP when the requestor edits/resubmits. :contentReference[oaicite:5]{index=5}
  const summarizeEditCounts = (em: any): string => {
    if (!em) return "";
    const parts: string[] = [];
    if (Array.isArray(em.header) && em.header.length > 0) {
      parts.push(`Header(${em.header.length})`);
    }
    if (Array.isArray(em.mqp) && em.mqp.length > 0) {
      parts.push(`MQP(${em.mqp.length})`);
    }
    if (Array.isArray(em.visual) && em.visual.length > 0) {
      parts.push(`Visual/EL(${em.visual.length})`);
    }
    const bomChangedCount =
      (em.bom?.changed?.length || 0) +
        (em.bom?.added?.length || 0) +
        (em.bom?.removed?.length || 0) || 0;
    if (bomChangedCount > 0) {
      parts.push(`BOM(${bomChangedCount})`);
    }
    return parts.join(", ");
  };

  const renderEditBadge = (qapLocal: any) => {
    const text = summarizeEditCounts(qapLocal?.editMeta);
    if (!text) return null;
    return (
      <Badge
        variant="outline"
        className="bg-red-50 text-red-700 border-red-300"
      >
        Edited: {text}
      </Badge>
    );
  };

  const renderChangeSummary = (qapLocal: any) => {
    const em = latestEditEvent(qapLocal) as any;
    if (!em) return null;
    return (
      <details className="mb-4 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm">
        <summary className="cursor-pointer font-medium text-yellow-800">
          Change Summary (click to expand)
        </summary>
        <div className="mt-3 space-y-4 text-gray-800">
          {/* Header field edits */}
          {Array.isArray(em.header) && em.header.length > 0 && (
            <div>
              <div className="font-semibold mb-1">Header Changes</div>
              <ul className="space-y-1 text-xs md:text-sm">
                {em.header.map((h: any, idx: number) => (
                  <li key={idx}>
                    <span className="font-medium">
                      {h.field || h.key || h.name}:
                    </span>{" "}
                    <span className="line-through text-red-600">
                      {String(h.before ?? "-")}
                    </span>{" "}
                    →{" "}
                    <span className="text-green-700 font-semibold">
                      {String(h.after ?? "-")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* MQP row edits */}
          {Array.isArray(em.mqp) && em.mqp.length > 0 && (
            <div>
              <div className="font-semibold mb-1">MQP Updates</div>
              <ul className="space-y-2 text-xs md:text-sm">
                {em.mqp.map((row: any, idx: number) => (
                  <li key={idx}>
                    <div className="font-medium">
                      Row {row.sno ?? row.rowSno ?? "?"}
                    </div>
                    {Array.isArray(row.deltas) && row.deltas.length > 0 && (
                      <ul className="ml-4 list-disc space-y-1">
                        {row.deltas.map((d: any, di: number) => (
                          <li key={di}>
                            {d.field || d.key || d.name}:{" "}
                            <span className="line-through text-red-600">
                              {String(d.before ?? "-")}
                            </span>{" "}
                            →{" "}
                            <span className="text-green-700 font-semibold">
                              {String(d.after ?? "-")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Visual / EL edits */}
          {Array.isArray(em.visual) && em.visual.length > 0 && (
            <div>
              <div className="font-semibold mb-1">Visual / EL Updates</div>
              <ul className="space-y-2 text-xs md:text-sm">
                {em.visual.map((row: any, idx: number) => (
                  <li key={idx}>
                    <div className="font-medium">
                      Row {row.sno ?? row.rowSno ?? "?"}
                    </div>
                    {Array.isArray(row.deltas) && row.deltas.length > 0 && (
                      <ul className="ml-4 list-disc space-y-1">
                        {row.deltas.map((d: any, di: number) => (
                          <li key={di}>
                            {d.field || d.key || d.name}:{" "}
                            <span className="line-through text-red-600">
                              {String(d.before ?? "-")}
                            </span>{" "}
                            →{" "}
                            <span className="text-green-700 font-semibold">
                              {String(d.after ?? "-")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* BOM edits */}
          {em.bom && (
            <div>
              <div className="font-semibold mb-1">BOM Updates</div>

              {Array.isArray(em.bom.changed) && em.bom.changed.length > 0 && (
                <div className="mb-2">
                  <div className="italic text-xs text-gray-600">
                    Modified rows
                  </div>
                  <ul className="ml-4 list-disc space-y-1 text-xs md:text-sm">
                    {em.bom.changed.map((c: any, idx: number) => (
                      <li key={idx}>
                        <span className="font-medium">
                          {c.part || c.model || c.name || `Row ${idx + 1}`}:
                        </span>{" "}
                        <span className="line-through text-red-600">
                          {String(c.before ?? "-")}
                        </span>{" "}
                        →{" "}
                        <span className="text-green-700 font-semibold">
                          {String(c.after ?? "-")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {Array.isArray(em.bom.added) && em.bom.added.length > 0 && (
                <div className="mb-2">
                  <div className="italic text-xs text-gray-600">Added rows</div>
                  <ul className="ml-4 list-disc space-y-1 text-xs md:text-sm">
                    {em.bom.added.map((c: any, idx: number) => (
                      <li key={idx}>
                        <span className="text-green-700 font-semibold">
                          + {c.part || c.model || c.name || `Row ${idx + 1}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {Array.isArray(em.bom.removed) && em.bom.removed.length > 0 && (
                <div className="mb-2">
                  <div className="italic text-xs text-gray-600">
                    Removed rows
                  </div>
                  <ul className="ml-4 list-disc space-y-1 text-xs md:text-sm">
                    {em.bom.removed.map((c: any, idx: number) => (
                      <li key={idx}>
                        <span className="line-through text-red-600">
                          − {c.part || c.model || c.name || `Row ${idx + 1}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </details>
    );
  };
  // <<< CHANGE_SUMMARY_HELPERS

  // >>> L2_EDIT_HL_HELPERS (ADD)
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

  /**
   * Return the edit history as an array of events (oldest → newest).
   * Accepts:
   *  - qap.editMeta (object OR array)
   *  - qap.editCommentsParsed (array)
   */
  const getEditHistory = (qapLocal: any): EditEvent[] => {
    const out: EditEvent[] = [];

    // FE-provided meta (object or array)
    const em = qapLocal?.editMeta;
    if (Array.isArray(em)) {
      for (const e of em) out.push(e as EditEvent);
    } else if (em && typeof em === "object") {
      out.push(em as EditEvent);
    }

    // BE-parsed history (authoritative)
    const hist = qapLocal?.editCommentsParsed;
    if (Array.isArray(hist) && hist.length) {
      // append in order (assume already oldest → newest)
      for (const e of hist) out.push(e as EditEvent);
    }

    return out;
  };

  /**
   * We want the **latest** event that actually has row-level deltas
   * (mqp/visual) so cells can be highlighted. If the very last event only
   * touched headers (no table deltas), look backward for the most recent
   * event that has mqp/visual deltas.
   */
  const latestEditEvent = (qapLocal: any): EditEvent | null => {
    const history = getEditHistory(qapLocal);
    if (!history.length) return null;

    // iterate from newest → oldest to find one with any row deltas
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

    // nothing with row deltas; return the newest event (likely header-only)
    return history[history.length - 1] as EditEvent;
  };

  /**
   * Build maps of { sno -> set(fieldsChanged) } for MQP & Visual using the
   * chosen latest event. Also normalize field names (e.g. 'limits' vs 'criteriaLimits').
   */
  const buildEditedIndex = (qapLocal: any) => {
    const ev = latestEditEvent(qapLocal);
    const mqp = new Map<number, Set<string>>();
    const visual = new Map<number, Set<string>>();

    const push = (idx: Map<number, Set<string>>, sno: number, raw: string) => {
      const set = idx.get(sno) || new Set<string>();
      // normalize common synonyms
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

  const cellEdited = (
    idx: Map<number, Set<string>>,
    sno: number,
    ...fields: string[]
  ) => {
    const set = idx.get(sno);
    if (!set) return false;
    return fields.some((f) => set.has(f));
  };

  // Slightly stronger visual for edited cells
  const HL_CELL =
    "bg-amber-50 border-amber-300 ring-1 ring-amber-300 shadow-inner transition-colors";
  // <<< L2_EDIT_HL_HELPERS

  /* ───────────────────────── render ───────────────────────── */
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold mb-4">
        Level 2 Review –{" "}
        {user?.role
          ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
          : ""}
      </h1>

      {/* row filter */}
      <div className="flex items-center gap-2 mb-6">
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
        <span className="text-sm text-gray-600 ml-auto">
          Pending QAPs: {reviewable.length}
        </span>
      </div>

      {reviewable.length === 0 ? (
        <div className="text-center text-gray-500 py-20">No QAPs to review</div>
      ) : (
        reviewable.map((qap) => {
          const hasRespondedOnce = Boolean(
            qap.levelResponses?.[2]?.[user?.role || ""]?.acknowledged
          );
          // Only lock if the QAP moved past Level 2 (this page already filters level 2,
          // but this keeps the intent explicit and future-proof):
          const respondDisabled = qap.currentLevel !== 2;

          // >>> L2_EDIT_INDEX (ADD)
          const editedIndex = buildEditedIndex(qap);
          // <<< L2_EDIT_INDEX

          const specs = qap.allSpecs.filter((s) => {
            if (rowFilter === "all") return true;
            if (rowFilter === "matched") return s.match === "yes";
            if (rowFilter === "unmatched") return s.match === "no";
            if (rowFilter === "edited") {
              // Pass if this S.No shows up in either MQP or Visual edit indices
              // (also fall back to qap.editedSnos via isEdited helper)
              return (
                editedIndex.mqp.has(s.sno) ||
                editedIndex.visual.has(s.sno) ||
                isEdited("mqp", s.sno, qap.editedSnos) ||
                isEdited("visual", s.sno, qap.editedSnos)
              );
            }
            return true;
          });
          const isOpen = expanded[qap.id] || false;

          // Try to pluck a linked Sales Request (optional)
          // Prefer server-joined Sales Request, else fall back to the snapshot embedded in QAP.
          const salesRequest: SalesRequestLite | undefined = (qap as any)
            ?.salesRequest;
          // 1) Requestor's snapshot (most accurate at submission time)
          // 2) QAP.bom (compat field we persist now)
          // 3) Joined SR's BOM (if BE provided it)
          const bomSource =
            (qap as any)?.bomSnapshot ??
            (qap as any)?.bom ??
            (salesRequest && salesRequest.bom);

          return (
            <Collapsible
              key={qap.id}
              open={isOpen}
              onOpenChange={(o) => setExpanded((p) => ({ ...p, [qap.id]: o }))}
              className="mb-4"
            >
              {/* ────────── header ────────── */}
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
                        <div className="flex gap-2 mt-1 flex-wrap">
                          <Badge variant="outline">
                            {qap.plant.toUpperCase()}
                          </Badge>
                          <Badge variant="outline">{qap.productType}</Badge>
                          <Badge>{qap.orderQuantity} MW</Badge>

                          {/* >>> CHANGE_SUMMARY_BADGE (ADD) */}
                          {renderEditBadge(qap)}
                          {/* <<< CHANGE_SUMMARY_BADGE */}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <Clock className="h-4 w-4 text-orange-500" />
                      <span>{getTimeRemaining(qap.submittedAt)}</span>
                      {hasRespondedOnce && (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-green-600">Responded</span>
                        </>
                      )}
                    </div>
                  </CardHeader>
                </Card>
              </CollapsibleTrigger>

              {/* ────────── detail ────────── */}
              <CollapsibleContent>
                <Card className="border-t-0">
                  <CardContent className="p-4">
                    {/* >>> CHANGE_SUMMARY_PANEL (ADD) */}
                    {renderChangeSummary(qap)}
                    {/* <<< CHANGE_SUMMARY_PANEL */}

                    {/* >>> L2_EDIT_LEGEND (ADD) */}
                    {(editedIndex.mqp.size || editedIndex.visual.size) && (
                      <div className="mb-3 text-xs text-gray-600">
                        <span className="inline-block h-3 w-3 rounded-sm align-middle mr-2 bg-amber-300 border border-amber-500"></span>
                        <span className="align-middle">
                          Edited since last submission
                        </span>
                      </div>
                    )}
                    {/* <<< L2_EDIT_LEGEND */}

                    <Tabs defaultValue="mqp">
                      <TabsList className="mb-4">
                        <TabsTrigger value="mqp">
                          MQP ({qap.specs.mqp.length})
                        </TabsTrigger>
                        <TabsTrigger value="visual">
                          Visual/EL ({qap.specs.visual.length})
                        </TabsTrigger>
                        <TabsTrigger value="bom">BOM</TabsTrigger>
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
                                <th className="p-2 border">Match</th>
                                <th className="p-2 border">Your Comment</th>
                              </tr>
                            </thead>
                            <tbody>
                              {specs
                                .filter((s) => qap.specs.mqp.includes(s as any))
                                .map((s) => (
                                  <tr
                                    key={s.sno}
                                    className={`border-b ${
                                      s.match === "yes"
                                        ? "bg-green-50"
                                        : "bg-red-50"
                                    } ${
                                      isEdited("mqp", s.sno, qap.editedSnos)
                                        ? "ring-1 ring-amber-300"
                                        : ""
                                    }`}
                                  >
                                    <td className="p-2 border">
                                      {s.sno}
                                      {editedIndex.mqp.has(s.sno) && (
                                        <Badge
                                          variant="outline"
                                          className="ml-2 bg-amber-50 border-amber-300 text-amber-800"
                                        >
                                          Edited
                                        </Badge>
                                      )}
                                    </td>

                                    <td className="p-2 border">{s.criteria}</td>
                                    <td className="p-2 border">
                                      {s.subCriteria}
                                    </td>
                                    <td
                                      className={`p-2 border ${
                                        cellEdited(
                                          editedIndex.mqp,
                                          s.sno,
                                          "specification"
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
                                          "customerSpecification"
                                        )
                                          ? HL_CELL
                                          : ""
                                      }`}
                                    >
                                      {s.customerSpecification}
                                    </td>

                                    <td
                                      className={`p-2 border ${
                                        cellEdited(
                                          editedIndex.mqp,
                                          s.sno,
                                          "match"
                                        )
                                          ? HL_CELL
                                          : ""
                                      }`}
                                    >
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
                                        value={responses[qap.id]?.[s.sno] || ""}
                                        onChange={(e) =>
                                          handleChange(
                                            qap.id,
                                            s.sno,
                                            e.target.value
                                          )
                                        }
                                        placeholder="Comments…"
                                        disabled={respondDisabled}
                                        className="min-h-[3rem]"
                                      />
                                      <div className="mt-2">
                                        <div className="text-xs font-medium mb-1">
                                          Previous comments
                                        </div>
                                        <div className="flex flex-col gap-2">
                                          {getThreadForSpec(
                                            qap.levelResponses,
                                            2,
                                            user.role,
                                            s.sno
                                          ).map((t, i) => (
                                            <div
                                              key={i}
                                              className="rounded-lg border p-2"
                                            >
                                              <div className="text-[10px] text-muted-foreground mb-1">
                                                {t.by} ·{" "}
                                                {new Date(
                                                  t.at
                                                ).toLocaleString()}
                                              </div>
                                              <div className="whitespace-pre-wrap text-xs">
                                                {t.text}
                                              </div>
                                            </div>
                                          ))}
                                          {getThreadForSpec(
                                            qap.levelResponses,
                                            2,
                                            user.role,
                                            s.sno
                                          ).length === 0 && (
                                            <div className="text-[11px] text-muted-foreground">
                                              No comments yet.
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
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
                                <th className="p-2 border">Match</th>
                                <th className="p-2 border">Your Comment</th>
                              </tr>
                            </thead>
                            <tbody>
                              {specs
                                .filter((s) =>
                                  qap.specs.visual.includes(s as any)
                                )
                                .map((s) => (
                                  <tr
                                    key={s.sno}
                                    className={`border-b ${
                                      s.match === "yes"
                                        ? "bg-green-50"
                                        : "bg-red-50"
                                    } ${
                                      qap?.editedSnos?.visual?.includes(s.sno)
                                        ? "ring-1 ring-amber-300"
                                        : ""
                                    }`}
                                  >
                                    <td className="p-2 border">
                                      {s.sno}
                                      {editedIndex.visual.has(s.sno) && (
                                        <Badge
                                          variant="outline"
                                          className="ml-2 bg-amber-50 border-amber-300 text-amber-800"
                                        >
                                          Edited
                                        </Badge>
                                      )}
                                    </td>

                                    <td className="p-2 border">{s.criteria}</td>
                                    <td className="p-2 border">
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
                                          "customerSpecification"
                                        )
                                          ? HL_CELL
                                          : ""
                                      }`}
                                    >
                                      {s.customerSpecification}
                                    </td>

                                    <td
                                      className={`p-2 border ${
                                        cellEdited(
                                          editedIndex.visual,
                                          s.sno,
                                          "match"
                                        )
                                          ? HL_CELL
                                          : ""
                                      }`}
                                    >
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
                                        value={responses[qap.id]?.[s.sno] || ""}
                                        onChange={(e) =>
                                          handleChange(
                                            qap.id,
                                            s.sno,
                                            e.target.value
                                          )
                                        }
                                        placeholder="Comments…"
                                        disabled={respondDisabled}
                                        className="min-h-[3rem]"
                                      />
                                      <div className="mt-2">
                                        <div className="text-xs font-medium mb-1">
                                          Previous comments
                                        </div>
                                        <div className="flex flex-col gap-2">
                                          {getThreadForSpec(
                                            qap.levelResponses,
                                            2,
                                            user.role,
                                            s.sno
                                          ).map((t, i) => (
                                            <div
                                              key={i}
                                              className="rounded-lg border p-2"
                                            >
                                              <div className="text-[10px] text-muted-foreground mb-1">
                                                {t.by} ·{" "}
                                                {new Date(
                                                  t.at
                                                ).toLocaleString()}
                                              </div>
                                              <div className="whitespace-pre-wrap text-xs">
                                                {t.text}
                                              </div>
                                            </div>
                                          ))}
                                          {getThreadForSpec(
                                            qap.levelResponses,
                                            2,
                                            user.role,
                                            s.sno
                                          ).length === 0 && (
                                            <div className="text-[11px] text-muted-foreground">
                                              No comments yet.
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </TabsContent>

                      {/* BOM TAB */}
                      <TabsContent value="bom">
                        {!salesRequest && !bomSource ? (
                          <div className="text-sm text-gray-600">
                            No linked Sales Request/BOM found on this QAP.
                          </div>
                        ) : (
                          <div className="space-y-6">
                            {/* Keep the SR summary only when a joined SR exists */}
                            {salesRequest && (
                              <Card>
                                <CardHeader>
                                  <CardTitle>Sales Request Summary</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  {/* existing Sales Request Summary block unchanged */}
                                </CardContent>
                              </Card>
                            )}

                            <Card>
                              <CardHeader>
                                <CardTitle>BOM</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                {!bomSource ? (
                                  <div className="text-sm text-gray-500">
                                    No BOM available.
                                  </div>
                                ) : (
                                  <>
                                    {/* Header fields: support both SR.bom and bomSnapshot keys */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                      <FieldRow
                                        label="Vendor (lock-in)"
                                        value={
                                          (bomSource as any).vendorName || "-"
                                        }
                                      />
                                      <FieldRow
                                        label="RFID Location (lock-in)"
                                        value={
                                          (bomSource as any).rfidLocation || "-"
                                        }
                                      />
                                      <FieldRow
                                        label="Technology Proposed"
                                        value={
                                          (bomSource as any)
                                            .technologyProposed || "-"
                                        }
                                      />
                                      <FieldRow
                                        label="Vendor Address"
                                        value={
                                          (bomSource as any).vendorAddress ||
                                          "-"
                                        }
                                      />
                                      <FieldRow
                                        label="Document Ref"
                                        value={
                                          (bomSource as any).documentRef || "-"
                                        }
                                      />
                                      <FieldRow
                                        label="Module Wattage (WP)"
                                        value={
                                          (bomSource as any).moduleWattageWp ??
                                          (bomSource as any).wattPeakLabel ??
                                          "-"
                                        }
                                      />
                                      <FieldRow
                                        label="Module Dimensions"
                                        value={
                                          (bomSource as any)
                                            .moduleDimensionsOption || "-"
                                        }
                                      />
                                      <FieldRow
                                        label="Module Model Number"
                                        value={
                                          (bomSource as any)
                                            .moduleModelNumber || "-"
                                        }
                                      />
                                    </div>
                                    {!!(bomSource as any).components?.length ? (
                                      <div className="space-y-6">
                                        {(bomSource as any).components.map(
                                          (c: any, idx: number) => {
                                            const selectedRows = Array.isArray(
                                              c.rows
                                            )
                                              ? c.rows.filter(
                                                  (r: any) =>
                                                    r &&
                                                    (r.isSelected === true ||
                                                      r.selected === true ||
                                                      r.model ||
                                                      r.subVendor ||
                                                      r.spec ||
                                                      (typeof r.qty !==
                                                        "undefined" &&
                                                        r.qty !== null))
                                                )
                                              : [];

                                            if (selectedRows.length === 0)
                                              return null;

                                            return (
                                              <div
                                                key={`${c.name}-${idx}`}
                                                className="overflow-auto"
                                              >
                                                <div className="font-medium mb-2">
                                                  {c.name}{" "}
                                                  <span className="text-xs text-gray-500">
                                                    ({selectedRows.length}{" "}
                                                    selected)
                                                  </span>
                                                </div>
                                                <table className="min-w-full text-sm border">
                                                  <thead className="bg-gray-50 text-left">
                                                    <tr>
                                                      <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                                                        Part No / Type / Model
                                                      </th>
                                                      <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                                                        Sub-vendor /
                                                        Manufacturer
                                                      </th>
                                                      <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                                                        Specification
                                                      </th>
                                                    </tr>
                                                  </thead>
                                                  <tbody className="divide-y">
                                                    {selectedRows.map(
                                                      (r: any, i: number) => (
                                                        <tr
                                                          key={i}
                                                          className="align-top"
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
                                                    )}
                                                  </tbody>
                                                </table>
                                              </div>
                                            );
                                          }
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

                    <div className="mt-4 flex justify-end">
                      <Button
                        onClick={() => submit(qap.id)}
                        disabled={respondDisabled}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {hasRespondedOnce ? "Add Follow-up" : "Submit Review"}
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

export default Level2ReviewPage;
