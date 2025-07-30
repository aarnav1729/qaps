// src/components/Level4ReviewPage.tsx
import React, { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  const [rowFilter, setRowFilter] = useState<"all" | "matched" | "unmatched">(
    "all"
  );
  const [responses, setResponses] = useState<{
    [qapId: string]: Record<number, string>;
  }>({});
  const [acknowledged, setAcknowledged] = useState<{
    [qapId: string]: Record<number, boolean>;
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

  const handleAck = (qapId: string, sno: number) =>
    setAcknowledged((p) => ({
      ...p,
      [qapId]: { ...(p[qapId] || {}), [sno]: !(p[qapId]?.[sno] || false) },
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
        Level 4 Review –{" "}
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
          const specs = qap.allSpecs.filter((s) =>
            rowFilter === "all"
              ? true
              : rowFilter === "matched"
              ? s.match === "yes"
              : s.match === "no"
          );

          const allAck = Object.values(acknowledged[qap.id] || {}).every(Boolean);

          /* Pull L2 & L3 comments */
          const l2 = qap.levelResponses?.[2] || {};
          const l3 = qap.levelResponses?.[3] || {};
          const prodL2 = l2.production?.comments || {};
          const qualL2 = l2.quality?.comments || {};
          const techL2 = l2.technical?.comments || {};
          const l3Roles = Object.keys(l3);

          const isOpen = expanded[qap.id] || false;

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
                          <Badge variant="outline">{qap.plant.toUpperCase()}</Badge>
                          <Badge variant="outline">{qap.productType}</Badge>
                          <Badge>{qap.orderQuantity} MW</Badge>
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
                                    key={`mqp-head-${r}`}
                                    className="p-2 border capitalize"
                                  >
                                    {r} L3
                                  </th>
                                ))}
                                <th className="p-2 border">Match</th>
                                <th className="p-2 border">Your Comment</th>
                                <th className="p-2 border">Ack</th>
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
                                    <td className="p-2 border">{s.subCriteria}</td>
                                    <td className="p-2 border">{s.specification}</td>
                                    <td className="p-2 border">
                                      {s.customerSpecification}
                                    </td>
                                    <td className="p-2 border">
                                      {prodL2[s.sno] || "—"}
                                    </td>
                                    <td className="p-2 border">
                                      {qualL2[s.sno] || "—"}
                                    </td>
                                    <td className="p-2 border">
                                      {techL2[s.sno] || "—"}
                                    </td>
                                    {l3Roles.map((r) => (
                                      <td
                                        key={`mqp-l3-${r}-${s.sno}`}
                                        className="p-2 border"
                                      >
                                        {l3[r]?.comments?.[s.sno] || "—"}
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
                                        value={responses[qap.id]?.[s.sno] || ""}
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
                                    <td className="p-2 border text-center">
                                      <input
                                        type="checkbox"
                                        checked={
                                          acknowledged[qap.id]?.[s.sno] || false
                                        }
                                        onChange={() => handleAck(qap.id, s.sno)}
                                        className="rounded"
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
                                <th className="p-2 border">Sub‑Criteria</th>
                                <th className="p-2 border">Limits</th>
                                <th className="p-2 border">Customer Spec</th>
                                <th className="p-2 border">Prod L2</th>
                                <th className="p-2 border">Qual L2</th>
                                <th className="p-2 border">Tech L2</th>
                                {l3Roles.map((r) => (
                                  <th
                                    key={`vis-head-${r}`}
                                    className="p-2 border capitalize"
                                  >
                                    {r} L3
                                  </th>
                                ))}
                                <th className="p-2 border">Match</th>
                                <th className="p-2 border">Your Comment</th>
                                <th className="p-2 border">Ack</th>
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
                                    <td className="p-2 border">{s.subCriteria}</td>
                                    <td className="p-2 border">
                                      {s.criteriaLimits}
                                    </td>
                                    <td className="p-2 border">
                                      {s.customerSpecification}
                                    </td>
                                    <td className="p-2 border">
                                      {prodL2[s.sno] || "—"}
                                    </td>
                                    <td className="p-2 border">
                                      {qualL2[s.sno] || "—"}
                                    </td>
                                    <td className="p-2 border">
                                      {techL2[s.sno] || "—"}
                                    </td>
                                    {l3Roles.map((r) => (
                                      <td
                                        key={`vis-l3-${r}-${s.sno}`}
                                        className="p-2 border"
                                      >
                                        {l3[r]?.comments?.[s.sno] || "—"}
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
                                        value={responses[qap.id]?.[s.sno] || ""}
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
                                    <td className="p-2 border text-center">
                                      <input
                                        type="checkbox"
                                        checked={
                                          acknowledged[qap.id]?.[s.sno] || false
                                        }
                                        onChange={() => handleAck(qap.id, s.sno)}
                                        className="rounded"
                                      />
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </TabsContent>
                    </Tabs>

                    <div className="mt-4 flex justify-end">
                      <Button
                        onClick={() => submit(qap.id)}
                        disabled={
                          !allAck ||
                          Object.keys(responses[qap.id] || {}).length === 0
                        }
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {allAck ? "Submit Review" : "Acknowledge All"}
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
