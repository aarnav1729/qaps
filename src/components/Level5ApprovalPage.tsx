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
  const [rowFilter, setRowFilter] = useState<"all" | "matched" | "unmatched">(
    "all"
  );
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
          const specs = qap.allSpecs.filter((s) =>
            rowFilter === "all"
              ? true
              : rowFilter === "matched"
              ? s.match === "yes"
              : s.match === "no"
          );

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
                                    {l3R1.map((r) => (
                                      <td
                                        key={`mqp-l3-${r}-${s.sno}`}
                                        className="p-2 border"
                                      >
                                        {L3?.[r]?.comments?.[s.sno] || "—"}
                                      </td>
                                    ))}
                                    {l4R1.map((r) => (
                                      <td
                                        key={`mqp-l4-${r}-${s.sno}`}
                                        className="p-2 border"
                                      >
                                        {L4?.[r]?.comments?.[s.sno] || "—"}
                                      </td>
                                    ))}
                                    <td className="p-2 border">
                                      {qap.finalCommentsPerItem?.[s.sno] || "—"}
                                    </td>

                                    {/* L3 2nd */}
                                    {l3R2.map((r) => (
                                      <td
                                        key={`mqp-l3b-${r}-${s.sno}`}
                                        className="p-2 border"
                                      >
                                        {L3?.[r]?.comments?.[s.sno] || "—"}
                                      </td>
                                    ))}

                                    {/* L4 2nd */}
                                    {l4R2.map((r) => (
                                      <td
                                        key={`mqp-l4b-${r}-${s.sno}`}
                                        className="p-2 border"
                                      >
                                        {L4?.[r]?.comments?.[s.sno] || "—"}
                                      </td>
                                    ))}
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
                                    {l3R1.map((r) => (
                                      <td
                                        key={`vis-l3-${r}-${s.sno}`}
                                        className="p-2 border"
                                      >
                                        {L3?.[r]?.comments?.[s.sno] || "—"}
                                      </td>
                                    ))}
                                    {l4R1.map((r) => (
                                      <td
                                        key={`vis-l4-${r}-${s.sno}`}
                                        className="p-2 border"
                                      >
                                        {L4?.[r]?.comments?.[s.sno] || "—"}
                                      </td>
                                    ))}
                                    <td className="p-2 border">
                                      {qap.finalCommentsPerItem?.[s.sno] || "—"}
                                    </td>
                                    {l3R2.map((r) => (
                                      <td
                                        key={`vis-l3b-${r}-${s.sno}`}
                                        className="p-2 border"
                                      >
                                        {L3?.[r]?.comments?.[s.sno] || "—"}
                                      </td>
                                    ))}
                                    {l4R2.map((r) => (
                                      <td
                                        key={`vis-l4b-${r}-${s.sno}`}
                                        className="p-2 border"
                                      >
                                        {L4?.[r]?.comments?.[s.sno] || "—"}
                                      </td>
                                    ))}
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
