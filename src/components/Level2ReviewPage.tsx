// src/components/Level2ReviewPage.tsx
import React, { useState, useMemo } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
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
      rows: { model: string; subVendor?: string | null; spec?: string | null }[];
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

const Level2ReviewPage: React.FC<Level2ReviewPageProps> = ({
  qapData,
  onNext,
}) => {
  const { user } = useAuth();

  /* ───────────────────────── state ───────────────────────── */
  const [responses, setResponses] = useState<
    Record<string, Record<number, string>>
  >({});
  const [rowFilter, setRowFilter] =
    useState<"all" | "matched" | "unmatched">("all");
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
            q.currentLevel === 2 &&
            userPlants.includes(q.plant.toLowerCase())
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
        </select>
        <span className="text-sm text-gray-600 ml-auto">
          Pending QAPs: {reviewable.length}
        </span>
      </div>

      {reviewable.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          No QAPs to review
        </div>
      ) : (
        reviewable.map((qap) => {
          const hasResponded = Boolean(
            qap.levelResponses?.[2]?.[user?.role || ""]?.acknowledged
          );

          const specs = qap.allSpecs.filter((s) =>
            rowFilter === "all"
              ? true
              : rowFilter === "matched"
              ? s.match === "yes"
              : s.match === "no"
          );

          const isOpen = expanded[qap.id] || false;

          // Try to pluck a linked Sales Request (optional)
          const salesRequest: SalesRequestLite | undefined =
            (qap as any)?.salesRequest;

          return (
            <Collapsible
              key={qap.id}
              open={isOpen}
              onOpenChange={(o) =>
                setExpanded((p) => ({ ...p, [qap.id]: o }))
              }
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
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline">
                            {qap.plant.toUpperCase()}
                          </Badge>
                          <Badge variant="outline">{qap.productType}</Badge>
                          <Badge>{qap.orderQuantity} MW</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <Clock className="h-4 w-4 text-orange-500" />
                      <span>{getTimeRemaining(qap.submittedAt)}</span>
                      {hasResponded && (
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
                                          handleChange(
                                            qap.id,
                                            s.sno,
                                            e.target.value
                                          )
                                        }
                                        placeholder="Comments…"
                                        disabled={hasResponded}
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
                                          handleChange(
                                            qap.id,
                                            s.sno,
                                            e.target.value
                                          )
                                        }
                                        placeholder="Comments…"
                                        disabled={hasResponded}
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
                                      salesRequest.premierBiddedOrderQtyMW ?? "-"
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
                                    value={
                                      salesRequest.xPitchMm ?? "-"
                                    }
                                  />
                                  <FieldRow
                                    label="Tracker @790/1400"
                                    value={
                                      salesRequest.trackerDetails ?? "-"
                                    }
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
                                                    <tr key={i} className="align-top">
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

                    <div className="mt-4 flex justify-end">
                      <Button
                        onClick={() => submit(qap.id)}
                        disabled={hasResponded}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {hasResponded ? "Already Responded" : "Submit Review"}
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