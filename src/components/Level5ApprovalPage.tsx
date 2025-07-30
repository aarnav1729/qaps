// src/components/Level5ApprovalPage.tsx
import React, { useState, useMemo } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Eye,
  Search,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { QAPFormData, QAPSpecification } from "@/types/qap";

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
  const [rowFilter, setRowFilter] =
    useState<"all" | "matched" | "unmatched">("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [decision, setDecision] = useState<{
    [qapId: string]: "approve" | "reject" | null;
  }>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});

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

  /* ───────── helpers ───────── */
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

    // reset collapsed state
    setExpanded((p) => ({ ...p, [qap.id]: false }));
    setDecision((p) => ({ ...p, [qap.id]: null }));
    setFeedback((p) => ({ ...p, [qap.id]: "" }));
  };

  /* ───────── render ───────── */
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold mb-4">Plant Head Approval – Level 5</h1>

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

          /* previous level comments */
          const L2 = qap.levelResponses?.[2] || {};
          const L3 = qap.levelResponses?.[3] || {};
          const L4 = qap.levelResponses?.[4] || {};
          const l3Roles = Object.keys(L3);
          const l4Roles = Object.keys(L4);

          const isOpen = expanded[qap.id] || false;
          const unmatched = specs.filter((s) => s.match === "no");

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
                          <Badge>{qap.orderQuantity} MW</Badge>
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
                      </TabsList>

                      {/* MQP TAB */}
                      <TabsContent value="mqp">
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-sm">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="p-2 border">S.No</th>
                                <th className="p-2 border">Criteria</th>
                                <th className="p-2 border">Sub‑Criteria</th>
                                <th className="p-2 border">Premier Spec</th>
                                <th className="p-2 border">Customer Spec</th>
                                <th className="p-2 border">Prod L2</th>
                                <th className="p-2 border">Qual L2</th>
                                <th className="p-2 border">Tech L2</th>
                                {l3Roles.map((r) => (
                                  <th
                                    key={`mqp-l3-h-${r}`}
                                    className="p-2 border capitalize"
                                  >
                                    {r} L3
                                  </th>
                                ))}
                                {l4Roles.map((r) => (
                                  <th
                                    key={`mqp-l4-h-${r}`}
                                    className="p-2 border capitalize"
                                  >
                                    {r} L4
                                  </th>
                                ))}
                                <th className="p-2 border">Final Comment</th>
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
                                      {qap.finalCommentsPerItem?.[s.sno] || "—"}
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
                                <th className="p-2 border">Sub‑Criteria</th>
                                <th className="p-2 border">Limits</th>
                                <th className="p-2 border">Customer Spec</th>
                                <th className="p-2 border">Prod L2</th>
                                <th className="p-2 border">Qual L2</th>
                                <th className="p-2 border">Tech L2</th>
                                {l3Roles.map((r) => (
                                  <th
                                    key={`vis-l3-h-${r}`}
                                    className="p-2 border capitalize"
                                  >
                                    {r} L3
                                  </th>
                                ))}
                                {l4Roles.map((r) => (
                                  <th
                                    key={`vis-l4-h-${r}`}
                                    className="p-2 border capitalize"
                                  >
                                    {r} L4
                                  </th>
                                ))}
                                <th className="p-2 border">Final Comment</th>
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
                                      {qap.finalCommentsPerItem?.[s.sno] || "—"}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
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
                            decision[qap.id] === "approve" ? "default" : "outline"
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