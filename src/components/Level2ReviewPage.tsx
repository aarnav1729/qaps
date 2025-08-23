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

  /* ───────────────────────── render ───────────────────────── */
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold mb-4">
        Level 2 Review –{" "}
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
                          <Badge>{qap.orderQuantity} MW</Badge>
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
                                <th className="p-2 border">Sub‑Criteria</th>
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
