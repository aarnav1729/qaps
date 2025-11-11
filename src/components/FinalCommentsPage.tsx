import React, { useMemo, useState } from "react";
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
  Send,
  Search,
  ChevronDown,
  ChevronUp,
  Paperclip,
  X,
} from "lucide-react";
import { QAPFormData, QAPSpecification } from "@/types/qap";
import { useAuth } from "@/contexts/AuthContext";

/* ───────────────────────────────────────────────────────────── */
/* Local lightweight types just for rendering the BOM tab        */
/* (Keeps this page decoupled from Sales types/modules)          */
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

const FieldRow: React.FC<{ label: string; value: React.ReactNode }> = ({
  label,
  value,
}) => (
  <div className="flex flex-col">
    <span className="text-gray-500">{label}</span>
    <span className="font-medium text-gray-900">{value ?? "-"}</span>
  </div>
);

/* ─────────────────────────────────────────────── */
/* props                                           */
/* ─────────────────────────────────────────────── */
interface FinalCommentsPageProps {
  qapData: QAPFormData[];
  onSubmitFinalComments: (
    id: string,
    comments: Record<number, string> | string, // allow stringified payload too
    attachment?: File
  ) => Promise<void>;
}

/* ─────────────────────────────────────────────── */
/* component                                       */
/* ─────────────────────────────────────────────── */
const FinalCommentsPage: React.FC<FinalCommentsPageProps> = ({
  qapData,
  onSubmitFinalComments,
}) => {
  const { user } = useAuth();

  /* ───────── state ───────── */
  const [searchTerm, setSearchTerm] = useState("");
  const [rowFilter, setRowFilter] = useState<"all" | "matched" | "unmatched">(
    "all"
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<
    Record<string, Record<number, string>>
  >({});
  const [attachments, setAttachments] = useState<Record<string, File | null>>(
    {}
  );
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});

  /* helpers */
  const fmtNum = (n?: number | null) =>
    n === null || n === undefined ? "-" : Number(n).toLocaleString();
  const fmtDec = (n?: number | null) =>
    n === null || n === undefined
      ? "-"
      : Number(n).toLocaleString(undefined, { maximumFractionDigits: 4 });

  /* ───────── reviewable list ───────── */
  const reviewable = useMemo(() => {
    return qapData
      .filter(
        (q) => q.status === "final-comments" && q.submittedBy === user?.username
      )
      .filter((q) => {
        if (!searchTerm) return true;
        const s = searchTerm.toLowerCase();
        return (
          q.customerName.toLowerCase().includes(s) ||
          q.projectName.toLowerCase().includes(s)
        );
      })
      .map((q) => ({
        ...q,
        allSpecs: [
          ...(q.specs.mqp || []),
          ...(q.specs.visual || []),
        ] as QAPSpecification[],
      }));
  }, [qapData, user, searchTerm]);

  /* ───────── handlers ───────── */
  const handleCommentChange = (qapId: string, sno: number, value: string) => {
    setComments((p) => ({
      ...p,
      [qapId]: { ...(p[qapId] || {}), [sno]: value },
    }));
  };

  const handleFileChange = (qapId: string, file: File | null) => {
    if (file && file.size > 10 * 1024 * 1024) {
      alert("File size must be < 10 MB");
      return;
    }
    setAttachments((p) => ({ ...p, [qapId]: file }));
  };

  /** All unmatched specs require a non-empty comment */
  const readyToSubmit = (qapId: string, unmatched: QAPSpecification[]) => {
    if (unmatched.length === 0) return true; // nothing mandatory
    const c = comments[qapId] || {};
    return unmatched.every((item) => (c[item.sno] || "").trim().length > 0);
  };

  const submit = async (qapId: string) => {
    const qap = reviewable.find((q) => q.id === qapId);
    if (!qap) return;
    const unmatched = qap.allSpecs.filter((s) => s.match === "no");
    if (!readyToSubmit(qapId, unmatched)) {
      alert("Please enter comments for every unmatched item.");
      return;
    }

    // only send non-empty comments
    const payload = Object.fromEntries(
      Object.entries(comments[qapId] || {}).filter(
        ([, v]) => v.trim().length > 0
      )
    );

    setSubmitting((p) => ({ ...p, [qapId]: true }));
    try {
      await onSubmitFinalComments(
        qapId,
        JSON.stringify(payload), // stringify for FormData usage upstream
        attachments[qapId]
      );
      // collapse & clear local state
      setExpanded((p) => ({ ...p, [qapId]: false }));
      setComments((p) => ({ ...p, [qapId]: {} }));
      setAttachments((p) => ({ ...p, [qapId]: null }));
    } catch (e: any) {
      alert(e?.message || "Failed to submit comments");
    } finally {
      setSubmitting((p) => ({ ...p, [qapId]: false }));
    }
  };

  /* ───────── render ───────── */
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold mb-4">Final Comments</h1>

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
          </select>
        </div>
        <span className="text-sm text-gray-600">
          Pending QAPs: {reviewable.length}
        </span>
      </div>

      {reviewable.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          No QAPs awaiting final comments
        </div>
      ) : (
        reviewable.map((qap) => {
          /* filter specs for current table view */
          const specs = qap.allSpecs.filter((s) =>
            rowFilter === "all"
              ? true
              : rowFilter === "matched"
              ? s.match === "yes"
              : s.match === "no"
          );

          /* IMPORTANT: unmatched across *all* specs for validation */
          const unmatchedAll = qap.allSpecs.filter((s) => s.match === "no");

          /* prior comments */
          const L2 = qap.levelResponses?.[2] || {};
          const L3 = qap.levelResponses?.[3] || {};
          const L4 = qap.levelResponses?.[4] || {};
          const l3Roles = Object.keys(L3);
          const l4Roles = Object.keys(L4);

          const isOpen = expanded[qap.id] || false;

          // Optional embedded Sales Request (server embeds this on /api/qaps)
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
                          Visual ({qap.specs.visual.length})
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
                                <th className="p-2 border">Prod L2</th>
                                <th className="p-2 border">Qual L2</th>
                                <th className="p-2 border">Tech L2</th>
                                {l3Roles.map((r) => (
                                  <th
                                    key={`mqp-l3-h-${r}`}
                                    className="p-2 border capitalize"
                                  >
                                    {r} L3
                                  </th>
                                ))}
                                {l4Roles.map((r) => (
                                  <th
                                    key={`mqp-l4-h-${r}`}
                                    className="p-2 border capitalize"
                                  >
                                    {r} L4
                                  </th>
                                ))}
                                <th className="p-2 border">Final Comment</th>
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
                                    }`}
                                  >
                                    <td className="p-2 border">{s.sno}</td>
                                    <td className="p-2 border">{s.criteria}</td>
                                    <td className="p-2 border">
                                      {s.subCriteria}
                                    </td>
                                    <td className="p-2 border">
                                      {s.specification}
                                    </td>
                                    <td className="p-2 border">
                                      {s.customerSpecification}
                                    </td>
                                    <td className="p-2 border">
                                      {L2.production?.comments?.[s.sno] || "—"}
                                    </td>
                                    <td className="p-2 border">
                                      {L2.quality?.comments?.[s.sno] || "—"}
                                    </td>
                                    <td className="p-2 border">
                                      {L2.technical?.comments?.[s.sno] || "—"}
                                    </td>
                                    {l3Roles.map((r) => (
                                      <td
                                        key={`mqp-l3-${r}-${s.sno}`}
                                        className="p-2 border"
                                      >
                                        {L3[r]?.comments?.[s.sno] || "—"}
                                      </td>
                                    ))}
                                    {l4Roles.map((r) => (
                                      <td
                                        key={`mqp-l4-${r}-${s.sno}`}
                                        className="p-2 border"
                                      >
                                        {L4[r]?.comments?.[s.sno] || "—"}
                                      </td>
                                    ))}
                                    <td className="p-2 border">
                                      <Textarea
                                        value={comments[qap.id]?.[s.sno] || ""}
                                        onChange={(e) =>
                                          handleCommentChange(
                                            qap.id,
                                            s.sno,
                                            e.target.value
                                          )
                                        }
                                        placeholder="Your comment…"
                                        className="min-h-[3rem]"
                                      />
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
                                <th className="p-2 border">Prod L2</th>
                                <th className="p-2 border">Qual L2</th>
                                <th className="p-2 border">Tech L2</th>
                                {l3Roles.map((r) => (
                                  <th
                                    key={`vis-l3-h-${r}`}
                                    className="p-2 border capitalize"
                                  >
                                    {r} L3
                                  </th>
                                ))}
                                {l4Roles.map((r) => (
                                  <th
                                    key={`vis-l4-h-${r}`}
                                    className="p-2 border capitalize"
                                  >
                                    {r} L4
                                  </th>
                                ))}
                                <th className="p-2 border">Final Comment</th>
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
                                    }`}
                                  >
                                    <td className="p-2 border">{s.sno}</td>
                                    <td className="p-2 border">{s.criteria}</td>
                                    <td className="p-2 border">
                                      {s.subCriteria}
                                    </td>
                                    <td className="p-2 border">
                                      {s.criteriaLimits}
                                    </td>
                                    <td className="p-2 border">
                                      {s.customerSpecification}
                                    </td>
                                    <td className="p-2 border">
                                      {L2.production?.comments?.[s.sno] || "—"}
                                    </td>
                                    <td className="p-2 border">
                                      {L2.quality?.comments?.[s.sno] || "—"}
                                    </td>
                                    <td className="p-2 border">
                                      {L2.technical?.comments?.[s.sno] || "—"}
                                    </td>
                                    {l3Roles.map((r) => (
                                      <td
                                        key={`vis-l3-${r}-${s.sno}`}
                                        className="p-2 border"
                                      >
                                        {L3[r]?.comments?.[s.sno] || "—"}
                                      </td>
                                    ))}
                                    {l4Roles.map((r) => (
                                      <td
                                        key={`vis-l4-${r}-${s.sno}`}
                                        className="p-2 border"
                                      >
                                        {L4[r]?.comments?.[s.sno] || "—"}
                                      </td>
                                    ))}
                                    <td className="p-2 border">
                                      <Textarea
                                        value={comments[qap.id]?.[s.sno] || ""}
                                        onChange={(e) =>
                                          handleCommentChange(
                                            qap.id,
                                            s.sno,
                                            e.target.value
                                          )
                                        }
                                        placeholder="Your comment…"
                                        className="min-h-[3rem]"
                                      />
                                    </td>
                                  </tr>
                                ))}
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
                                  <div className="md:col-span-3">
                                    <div className="text-sm text-gray-700">
                                      <span className="font-medium">
                                        Remarks:
                                      </span>{" "}
                                      {salesRequest.remarks || "-"}
                                    </div>
                                  </div>

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
                                                  {c.rows.map((r, i) => (
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
                                                  ))}
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

                    {/* attachment */}
                    <div className="mt-4 space-y-2">
                      <label className="text-sm font-medium text-gray-600">
                        Optional Attachment (max 10 MB)
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                          onChange={(e) =>
                            handleFileChange(
                              qap.id,
                              e.target.files?.[0] || null
                            )
                          }
                          className="flex-1"
                        />
                        {attachments[qap.id] && (
                          <div className="flex items-center gap-2 p-2 bg-gray-50 border rounded">
                            <Paperclip className="h-4 w-4 text-gray-500" />
                            <span className="text-sm">
                              {attachments[qap.id]!.name}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleFileChange(qap.id, null)}
                              className="h-6 w-6 p-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* actions */}
                    <div className="mt-6 flex justify-end">
                      <Button
                        onClick={() => submit(qap.id)}
                        disabled={
                          submitting[qap.id] ||
                          !readyToSubmit(qap.id, unmatchedAll)
                        }
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {submitting[qap.id]
                          ? "Submitting…"
                          : "Submit for Approval"}
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

export default FinalCommentsPage;