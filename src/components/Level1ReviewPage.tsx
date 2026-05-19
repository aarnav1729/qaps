import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { QAPFormData, QAPSpecification } from "@/types/qap";
import {
  ChevronDown,
  ChevronUp,
  Send,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  getLevel1OutcomeText,
  getLevel1Summary,
  getMatchBadgeClasses,
  getMatchLabel,
  getSpecRowClassName,
  isAgreed,
  isUnmatched,
  matchesReviewerMatchFilter,
  ReviewerRowFilter,
} from "@/lib/qapLevel1";

interface Level1ReviewPageProps {
  qapData: QAPFormData[];
  onSubmit: (
    qapId: string,
    specs: { mqp: QAPSpecification[]; visual: QAPSpecification[] },
    comments: Record<number, string>
  ) => void;
}

const cloneSpecs = (specs: QAPSpecification[]) =>
  JSON.parse(JSON.stringify(specs || [])) as QAPSpecification[];

const Level1ReviewPage: React.FC<Level1ReviewPageProps> = ({
  qapData,
  onSubmit,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [rowFilter, setRowFilter] = useState<
    Exclude<ReviewerRowFilter, "edited">
  >("all");
  const [drafts, setDrafts] = useState<
    Record<string, { mqp: QAPSpecification[]; visual: QAPSpecification[] }>
  >({});
  const [comments, setComments] = useState<Record<string, Record<number, string>>>(
    {}
  );

  const reviewable = useMemo(
    () =>
      qapData.filter(
        (qap) => qap.currentLevel === 1 && String(qap.status) === "level-1"
      ),
    [qapData]
  );

  const getDraft = (qap: QAPFormData) =>
    drafts[qap.id] || {
      mqp: cloneSpecs(qap.specs?.mqp || []),
      visual: cloneSpecs(qap.specs?.visual || []),
    };

  const updateDraft = (
    qap: QAPFormData,
    section: "mqp" | "visual",
    sno: number,
    updater: (spec: QAPSpecification) => QAPSpecification
  ) => {
    setDrafts((prev) => {
      const current = prev[qap.id] || getDraft(qap);
      return {
        ...prev,
        [qap.id]: {
          ...current,
          [section]: current[section].map((spec) =>
            spec.sno === sno ? updater(spec) : spec
          ),
        },
      };
    });
  };

  const applyDecision = (
    qap: QAPFormData,
    section: "mqp" | "visual",
    spec: QAPSpecification,
    decision: "matched" | "agreed" | "reset"
  ) => {
    updateDraft(qap, section, spec.sno, (current) => {
      const originalCustomerSpec =
        current.initialCustomerSpecification ?? current.customerSpecification ?? "";
      const originalMatch =
        current.initialMatch ??
        (isAgreed(current.match) ? "no" : (current.match as "yes" | "no" | undefined));
      const premierSpec = current.specification || current.criteriaLimits || "";
      const base = {
        ...current,
        initialMatch: originalMatch,
        initialCustomerSpecification: originalCustomerSpec,
      };

      if (decision === "matched") {
        return {
          ...base,
          match: "yes",
          customerSpecification: premierSpec,
          level1Resolution: "matched",
          level1ResolutionText: null,
          level1ResolvedBy: user?.username || null,
          level1ResolvedAt: new Date().toISOString(),
          level1Closed: true,
        };
      }

      if (decision === "agreed") {
        return {
          ...base,
          match: "agreed",
          customerSpecification:
            current.customerSpecification || originalCustomerSpec || "",
          level1Resolution: "agreed",
          level1ResolutionText:
            current.customerSpecification || originalCustomerSpec || "",
          level1ResolvedBy: user?.username || null,
          level1ResolvedAt: new Date().toISOString(),
          level1Closed: true,
        };
      }

      return {
        ...base,
        match: originalMatch || "no",
        customerSpecification: originalCustomerSpec,
        level1Resolution: null,
        level1ResolutionText: null,
        level1ResolvedBy: null,
        level1ResolvedAt: null,
        level1Closed: false,
      };
    });
  };

  const updateAgreedValue = (
    qap: QAPFormData,
    section: "mqp" | "visual",
    spec: QAPSpecification,
    value: string
  ) => {
    updateDraft(qap, section, spec.sno, (current) => ({
      ...current,
      initialMatch:
        current.initialMatch ??
        (isAgreed(current.match) ? "no" : (current.match as "yes" | "no" | undefined)),
      initialCustomerSpecification:
        current.initialCustomerSpecification ??
        current.customerSpecification ??
        "",
      match: "agreed",
      customerSpecification: value,
      level1Resolution: "agreed",
      level1ResolutionText: value,
      level1ResolvedBy: user?.username || null,
      level1ResolvedAt: new Date().toISOString(),
      level1Closed: true,
    }));
  };

  const updateComment = (qapId: string, sno: number, value: string) => {
    setComments((prev) => ({
      ...prev,
      [qapId]: {
        ...(prev[qapId] || {}),
        [sno]: value,
      },
    }));
  };

  const submit = (qap: QAPFormData) => {
    const draft = getDraft(qap);
    const allSpecs = [...draft.mqp, ...draft.visual];
    const invalidAgreed = allSpecs.some(
      (spec) => isAgreed(spec.match) && !String(spec.customerSpecification || "").trim()
    );
    if (invalidAgreed) {
      toast({
        variant: "destructive",
        title: "Agreed measure required",
        description:
          "Enter the agreed measure for every yellow item before submitting.",
      });
      return;
    }
    onSubmit(qap.id, draft, comments[qap.id] || {});
  };
  const renderSpecsTable = (
    qap: QAPFormData,
    section: "mqp" | "visual",
    specs: QAPSpecification[]
  ) => {
    const isMqp = section === "mqp";
    const visibleSpecs = specs.filter((spec) =>
      matchesReviewerMatchFilter(rowFilter, spec.match)
    );

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border">S.No</th>
              <th className="p-2 border">Criteria</th>
              <th className="p-2 border">Sub-Criteria</th>
              <th className="p-2 border">
                {isMqp ? "Premier Spec" : "Criteria Limits"}
              </th>
              <th className="p-2 border">Requestor Spec</th>
              <th className="p-2 border">Current Status</th>
              <th className="p-2 border">Level 1 Action</th>
              <th className="p-2 border">Comment</th>
            </tr>
          </thead>
          <tbody>
            {visibleSpecs.map((spec) => {
              const requestorSpec =
                spec.initialCustomerSpecification ?? spec.customerSpecification ?? "—";
              const needsAction =
                spec.initialMatch === "no" ||
                isUnmatched(spec.match) ||
                spec.level1Closed ||
                !!spec.level1Resolution;

              return (
                <tr
                  key={`${section}-${spec.sno}`}
                  className={`border-b ${getSpecRowClassName(spec)}`}
                >
                  <td className="p-2 border font-medium">{spec.sno}</td>
                  <td className="p-2 border">{spec.criteria}</td>
                  <td className="p-2 border">{spec.subCriteria || "—"}</td>
                  <td className="p-2 border">
                    {spec.specification || spec.criteriaLimits || "—"}
                  </td>
                  <td className="p-2 border">{requestorSpec || "—"}</td>
                  <td className="p-2 border">
                    <Badge
                      variant="outline"
                      className={getMatchBadgeClasses(spec.match)}
                    >
                      {getMatchLabel(spec.match)}
                    </Badge>
                    {getLevel1OutcomeText(spec) && (
                      <div className="mt-2 text-xs text-amber-900">
                        {getLevel1OutcomeText(spec)}
                      </div>
                    )}
                  </td>
                  <td className="p-2 border min-w-[18rem]">
                    {needsAction ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={spec.level1Resolution === "matched" ? "default" : "outline"}
                            onClick={() => applyDecision(qap, section, spec, "matched")}
                          >
                            Mark Match
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={spec.level1Resolution === "agreed" ? "default" : "outline"}
                            onClick={() => applyDecision(qap, section, spec, "agreed")}
                          >
                            Agree Measure
                          </Button>
                          {(spec.level1Closed || spec.level1Resolution) && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => applyDecision(qap, section, spec, "reset")}
                            >
                              Reset
                            </Button>
                          )}
                        </div>
                        {isAgreed(spec.match) && (
                          <Input
                            value={spec.customerSpecification || ""}
                            onChange={(e) =>
                              updateAgreedValue(qap, section, spec, e.target.value)
                            }
                            placeholder="Enter the agreed measure"
                          />
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-500">No action needed</span>
                    )}
                  </td>
                  <td className="p-2 border min-w-[16rem]">
                    <Textarea
                      value={comments[qap.id]?.[spec.sno] || ""}
                      onChange={(e) =>
                        updateComment(qap.id, spec.sno, e.target.value)
                      }
                      placeholder="Optional note for downstream reviewers"
                      className="min-h-[4rem]"
                    />
                  </td>
                </tr>
              );
            })}
            {visibleSpecs.length === 0 && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-sm text-gray-500">
                  No rows match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div>
        <div className="min-w-0">
          <div className="mb-4">
            <h1 className="text-3xl font-bold">Level 1 Review</h1>
          </div>

          <div className="mb-6 flex items-center gap-2">
            <label htmlFor="level1-row-filter" className="font-medium">
              Show Rows:
            </label>
            <select
              id="level1-row-filter"
              value={rowFilter}
              onChange={(e) =>
                setRowFilter(e.target.value as Exclude<ReviewerRowFilter, "edited">)
              }
              className="border rounded px-2 py-1"
            >
              <option value="all">All</option>
              <option value="matched">Matched (Green)</option>
              <option value="unmatched">Unmatched (Red)</option>
              <option value="agreed">Agreed (Yellow)</option>
            </select>
            <span className="ml-auto text-sm text-gray-600">
              Pending QAPs: {reviewable.length}
            </span>
          </div>

          <div>
            {reviewable.length === 0 ? (
              <div className="text-center text-gray-500 py-20">
                No QAPs awaiting Level 1 review
              </div>
            ) : (
              reviewable.map((qap) => {
          const draft = getDraft(qap);
          const summary = getLevel1Summary([
            ...draft.mqp,
            ...draft.visual,
          ]);
          const isOpen = expanded[qap.id] || false;

          return (
            <Collapsible
              key={qap.id}
              open={isOpen}
              onOpenChange={(open) =>
                setExpanded((prev) => ({ ...prev, [qap.id]: open }))
              }
              className="mb-4"
            >
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
                          <Badge variant="outline">{qap.plant.toUpperCase()}</Badge>
                          <Badge variant="outline">{qap.productType}</Badge>
                          <Badge>{qap.orderQuantity} MW</Badge>
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-900 border-amber-300"
                          >
                            L1 Closed {summary.closed}/{summary.totalReviewed || 0}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {summary.pending > 0 ? (
                        <Badge className="bg-red-100 text-red-800">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {summary.pending} still red
                        </Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Ready for Level 2
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                </Card>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <Card className="border-t-0">
                  <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="rounded-lg border bg-slate-50 p-3">
                        <div className="text-xs text-slate-500">Reviewed</div>
                        <div className="text-2xl font-semibold">
                          {summary.totalReviewed}
                        </div>
                      </div>
                      <div className="rounded-lg border bg-green-50 p-3">
                        <div className="text-xs text-green-700">Red to Green</div>
                        <div className="text-2xl font-semibold text-green-800">
                          {summary.matched}
                        </div>
                      </div>
                      <div className="rounded-lg border bg-amber-50 p-3">
                        <div className="text-xs text-amber-700">Red to Yellow</div>
                        <div className="text-2xl font-semibold text-amber-900">
                          {summary.agreed}
                        </div>
                      </div>
                      <div className="rounded-lg border bg-red-50 p-3">
                        <div className="text-xs text-red-700">Still Open</div>
                        <div className="text-2xl font-semibold text-red-800">
                          {summary.pending}
                        </div>
                      </div>
                    </div>

                    <Tabs defaultValue="mqp">
                      <TabsList className="mb-4">
                        <TabsTrigger value="mqp">
                          MQP ({draft.mqp.length})
                        </TabsTrigger>
                        <TabsTrigger value="visual">
                          Visual/EL ({draft.visual.length})
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="mqp">
                        {renderSpecsTable(qap, "mqp", draft.mqp)}
                      </TabsContent>
                      <TabsContent value="visual">
                        {renderSpecsTable(qap, "visual", draft.visual)}
                      </TabsContent>
                    </Tabs>

                    <div className="flex justify-end">
                      <Button
                        onClick={() => submit(qap)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Send to Level 2
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
        </div>

      </div>
    </div>
  );
};

export default Level1ReviewPage;
