import React, { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTutorialMode } from "@/hooks/useTutorialMode";
import { cn } from "@/lib/utils";
import {
  buildAnalyticsSnapshot,
  filterQapData,
  getVisiblePlants,
  type AnalyticsDatasetRow,
  type AnalyticsFilters,
  type PersonTatRecord,
} from "@/lib/qapAnalytics";
import { formatDurationMs, getTimestampMs } from "@/lib/qapAudit";
import { QAPFormData } from "@/types/qap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Filter,
  Layers3,
  RefreshCcw,
  Sparkles,
  Users2,
} from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

interface AnalyticsDashboardProps {
  qapData: QAPFormData[];
  forceAdminInsights?: boolean;
  title?: string;
  description?: string;
  defaultTab?: "overview" | "workflow" | "tat" | "dataset";
}

type Drilldown =
  | { type: "status"; value: string }
  | { type: "plant"; value: string }
  | { type: "person"; value: string }
  | { type: "stage"; value: string }
  | null;

const STATUS_COLORS = [
  "#0f766e",
  "#2563eb",
  "#f59e0b",
  "#dc2626",
  "#8b5cf6",
  "#64748b",
  "#14b8a6",
];

const chartConfig = {
  approved: { label: "Approved", color: "#0f766e" },
  rejected: { label: "Rejected", color: "#dc2626" },
  open: { label: "Open", color: "#2563eb" },
  submitted: { label: "Submitted", color: "#2563eb" },
  reopened: { label: "Reopened", color: "#f59e0b" },
  matched: { label: "Matched", color: "#0f766e" },
  agreed: { label: "Agreed", color: "#f59e0b" },
  mismatched: { label: "Mismatched", color: "#dc2626" },
  averageTatHours: { label: "Average TAT", color: "#7c3aed" },
} as const;

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatShortDate = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });

const MetricCard: React.FC<{
  title: string;
  value: React.ReactNode;
  subtext: string;
  icon: React.ReactNode;
  tone?: "teal" | "blue" | "amber" | "violet";
  onClick?: () => void;
  active?: boolean;
}> = ({ title, value, subtext, icon, tone = "blue", onClick, active }) => {
  const tones: Record<string, string> = {
    teal: "from-teal-600/10 via-teal-500/5 to-white border-teal-200",
    blue: "from-blue-600/10 via-sky-500/5 to-white border-blue-200",
    amber: "from-amber-500/12 via-orange-400/5 to-white border-amber-200",
    violet: "from-violet-600/10 via-fuchsia-500/5 to-white border-violet-200",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left",
        onClick ? "cursor-pointer" : "cursor-default",
        "rounded-2xl"
      )}
    >
      <Card
        className={cn(
          "h-full rounded-2xl border bg-gradient-to-br transition-all duration-200",
          tones[tone],
          active && "ring-2 ring-offset-2 ring-slate-900/10 shadow-lg"
        )}
      >
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-600">{title}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                {value}
              </p>
              <p className="mt-2 text-sm text-slate-600">{subtext}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-3 shadow-sm">{icon}</div>
          </div>
        </CardContent>
      </Card>
    </button>
  );
};

const SectionCard: React.FC<{
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, description, action, children }) => (
  <Card className="rounded-3xl border-slate-200 shadow-sm">
    <CardHeader className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <CardTitle className="text-lg text-slate-950">{title}</CardTitle>
        {description ? (
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        ) : null}
      </div>
      {action}
    </CardHeader>
    <CardContent className="p-4 sm:p-6">{children}</CardContent>
  </Card>
);

const TutorialPanel: React.FC<{ adminInsights: boolean }> = ({
  adminInsights,
}) => (
  <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-5">
    <div className="flex flex-wrap items-center gap-2">
      <Badge className="bg-amber-900 text-white hover:bg-amber-900">
        Tutorial Mode
      </Badge>
      <span className="text-sm font-medium text-amber-900">
        Follow the flow to filter, drill into a chart, and inspect the raw dataset.
      </span>
    </div>
    <div className="mt-5 grid gap-3 lg:grid-cols-4">
      {[
        {
          title: "1. Set the scope",
          body: "Start with plant, status, and timeframe. Every chart and table below immediately follows those filters.",
        },
        {
          title: "2. Click a visual",
          body: "Use any status slice, plant bar, stage bar, or TAT bar as a drill-down entry point.",
        },
        {
          title: "3. Validate the dataset",
          body: "Open the Dataset tab to see the exact QAP rows, comment history, and workflow samples behind the chart.",
        },
        {
          title: adminInsights ? "4. Review MD TAT" : "4. Review workflow health",
          body: adminInsights
            ? "The TAT tab shows average, median, and maximum turnaround for each person in the approval loop."
            : "The Workflow tab shows stage-wise turnaround and Level 1 closure impact.",
        },
      ].map((step) => (
        <div
          key={step.title}
          className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm"
        >
          <div className="text-sm font-semibold text-slate-950">{step.title}</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
        </div>
      ))}
    </div>
  </div>
);

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  qapData,
  forceAdminInsights = false,
  title = "Analytics Dashboard",
  description = "Workflow visibility, quality health, and decision-ready drill-down analytics.",
  defaultTab = "overview",
}) => {
  const { user } = useAuth();
  const adminInsights = forceAdminInsights || user?.role === "admin";
  const [tutorialMode, setTutorialMode] = useTutorialMode(
    adminInsights ? "analytics-tutorial-admin" : "analytics-tutorial",
    true
  );
  const [filters, setFilters] = useState<AnalyticsFilters>({
    plant: "all",
    status: "all",
    timeframe: "all",
  });
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [drilldown, setDrilldown] = useState<Drilldown>(null);

  const plants = useMemo(() => getVisiblePlants(qapData), [qapData]);
  const filteredData = useMemo(
    () => filterQapData(qapData, filters, user || null),
    [filters, qapData, user]
  );
  const snapshot = useMemo(
    () => buildAnalyticsSnapshot(filteredData),
    [filteredData]
  );

  const reviewerRoleData = useMemo(() => {
    return Object.entries(
      snapshot.tatRecords.reduce<Record<string, number>>((acc, row) => {
        acc[row.role] = (acc[row.role] || 0) + 1;
        return acc;
      }, {})
    ).map(([role, count]) => ({ role, count }));
  }, [snapshot.tatRecords]);

  const tatChartData = useMemo(
    () =>
      snapshot.tatSummary.map((row) => ({
        ...row,
        averageTatHours:
          Math.round((row.averageTatMs / (1000 * 60 * 60)) * 10) / 10,
      })),
    [snapshot.tatSummary]
  );

  const drilldownState = useMemo(() => {
    const allRows = snapshot.datasetRows;
    const allTatRows = snapshot.tatRecords;
    const allComments = snapshot.commentFeed;

    if (!drilldown) {
      return {
        label: "Visible dataset",
        qapRows: allRows,
        tatRows: allTatRows,
        comments: allComments,
      };
    }

    if (drilldown.type === "status") {
      const qapRows = allRows.filter((row) => row.status === drilldown.value);
      const qapIds = new Set(qapRows.map((row) => row.id));
      return {
        label: `Status: ${drilldown.value}`,
        qapRows,
        tatRows: allTatRows.filter((row) => qapIds.has(row.qapId)),
        comments: allComments.filter((row) => qapIds.has(row.qapId)),
      };
    }

    if (drilldown.type === "plant") {
      const qapRows = allRows.filter((row) => row.plant === drilldown.value);
      const qapIds = new Set(qapRows.map((row) => row.id));
      return {
        label: `Plant: ${drilldown.value}`,
        qapRows,
        tatRows: allTatRows.filter((row) => qapIds.has(row.qapId)),
        comments: allComments.filter((row) => qapIds.has(row.qapId)),
      };
    }

    if (drilldown.type === "person") {
      const tatRows = allTatRows.filter((row) => row.person === drilldown.value);
      const qapIds = new Set(tatRows.map((row) => row.qapId));
      return {
        label: `Person: ${drilldown.value}`,
        qapRows: allRows.filter((row) => qapIds.has(row.id)),
        tatRows,
        comments: allComments.filter((row) => qapIds.has(row.qapId)),
      };
    }

    const tatRows = allTatRows.filter((row) => row.stageLabel === drilldown.value);
    const qapIds = new Set(tatRows.map((row) => row.qapId));
    return {
      label: `Stage: ${drilldown.value}`,
      qapRows: allRows.filter((row) => qapIds.has(row.id)),
      tatRows,
      comments: allComments.filter((row) => qapIds.has(row.qapId)),
    };
  }, [drilldown, snapshot.commentFeed, snapshot.datasetRows, snapshot.tatRecords]);

  const fastestPerson = useMemo(() => {
    const ordered = [...snapshot.tatSummary].sort(
      (a, b) => a.averageTatMs - b.averageTatMs
    );
    return ordered[0] || null;
  }, [snapshot.tatSummary]);

  const slowestPerson = snapshot.tatSummary[0] || null;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.12),_transparent_32%),linear-gradient(135deg,#f8fafc_0%,#ffffff_55%,#f8fafc_100%)] p-5 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-slate-300 bg-white">
                Live Visibility
              </Badge>
              {adminInsights ? (
                <Badge className="bg-slate-950 text-white hover:bg-slate-950">
                  Managing Director View
                </Badge>
              ) : null}
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              {description}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px] xl:max-w-[420px]">
            <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Visible Dataset
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <DatasetPill label="QAPs" value={snapshot.datasetVisibility.qaps} />
                <DatasetPill label="Specs" value={snapshot.datasetVisibility.specs} />
                <DatasetPill
                  label="Comments"
                  value={snapshot.datasetVisibility.comments}
                />
                <DatasetPill
                  label="TAT Samples"
                  value={snapshot.datasetVisibility.tatSamples}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Tutorial
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    Enable guided instructions and drill-down tips.
                  </p>
                </div>
                <Switch
                  checked={tutorialMode}
                  onCheckedChange={setTutorialMode}
                  aria-label="Toggle analytics tutorial mode"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Filters"
          description="Every chart, metric, and table below respects the selected scope."
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters({ plant: "all", timeframe: "all", status: "all" });
                setDrilldown(null);
              }}
            >
              <RefreshCcw className="h-4 w-4" />
              Reset
            </Button>
          }
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {adminInsights ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Plant</label>
                <Select
                  value={filters.plant}
                  onValueChange={(value) =>
                    setFilters((current) => ({ ...current, plant: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All plants" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All plants</SelectItem>
                    {plants.map((plant) => (
                      <SelectItem key={plant} value={plant}>
                        {plant.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Status</label>
              <Select
                value={filters.status}
                onValueChange={(value) =>
                  setFilters((current) => ({ ...current, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {snapshot.statusData.map((status) => (
                    <SelectItem key={status.key} value={status.key}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Timeframe
              </label>
              <Select
                value={filters.timeframe}
                onValueChange={(value) =>
                  setFilters((current) => ({ ...current, timeframe: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="365d">Last 12 months</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Filter className="h-4 w-4 text-slate-500" />
                Current drill-down
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="bg-white">
                  {drilldownState.label}
                </Badge>
                {drilldown ? (
                  <Button variant="ghost" size="sm" onClick={() => setDrilldown(null)}>
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </SectionCard>

        {tutorialMode ? <TutorialPanel adminInsights={adminInsights} /> : null}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Visible QAPs"
          value={snapshot.totals.qaps}
          subtext={`${snapshot.totals.open} still in motion`}
          icon={<Layers3 className="h-5 w-5 text-blue-600" />}
          tone="blue"
        />
        <MetricCard
          title="Approval Rate"
          value={`${snapshot.totals.approvalRate}%`}
          subtext={`${snapshot.totals.approved} approved / ${snapshot.totals.rejected} rejected`}
          icon={<CheckCircle2 className="h-5 w-5 text-teal-600" />}
          tone="teal"
          onClick={() => setDrilldown({ type: "status", value: "Approved" })}
          active={drilldown?.type === "status" && drilldown.value === "Approved"}
        />
        <MetricCard
          title="Average Cycle Time"
          value={snapshot.totals.averageCycleTimeLabel}
          subtext="Submission to latest close/update"
          icon={<Clock3 className="h-5 w-5 text-violet-600" />}
          tone="violet"
        />
        <MetricCard
          title="Reopened Loops"
          value={snapshot.totals.reopenedCount}
          subtext="Requests routed back for edits or re-review"
          icon={<Activity className="h-5 w-5 text-amber-600" />}
          tone="amber"
        />
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="mt-8 space-y-6"
      >
        <TabsList className="h-auto flex-wrap justify-start gap-2 rounded-2xl bg-slate-100 p-2">
          <TabsTrigger value="overview" className="rounded-xl">
            Overview
          </TabsTrigger>
          <TabsTrigger value="workflow" className="rounded-xl">
            Workflow
          </TabsTrigger>
          {adminInsights ? (
            <TabsTrigger value="tat" className="rounded-xl">
              Individual TAT
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="dataset" className="rounded-xl">
            Dataset
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              title="Status Distribution"
              description="Click a slice to focus every downstream table on that status."
            >
              <ChartContainer config={chartConfig} className="h-[320px] w-full">
                <PieChart>
                  <Pie
                    data={snapshot.statusData}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={72}
                    outerRadius={108}
                    paddingAngle={2}
                    onClick={(entry: { label?: string }) => {
                      if (entry?.label) {
                        setDrilldown({ type: "status", value: entry.label });
                        setActiveTab("dataset");
                      }
                    }}
                  >
                    {snapshot.statusData.map((entry, index) => (
                      <Cell
                        key={entry.key}
                        fill={STATUS_COLORS[index % STATUS_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <ChartTooltip
                    content={<ChartTooltipContent hideIndicator />}
                  />
                </PieChart>
              </ChartContainer>
              <div className="mt-4 flex flex-wrap gap-2">
                {snapshot.statusData.map((item, index) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setDrilldown({ type: "status", value: item.label });
                      setActiveTab("dataset");
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: STATUS_COLORS[index % STATUS_COLORS.length] }}
                    />
                    {item.label}
                    <span className="font-semibold text-slate-950">{item.count}</span>
                  </button>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="Plant Throughput"
              description="Stacked view of approved, rejected, and still-open QAPs by plant."
            >
              <ChartContainer config={chartConfig} className="h-[320px] w-full">
                <BarChart data={snapshot.plantData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="plant" />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar
                    dataKey="approved"
                    fill="#0f766e"
                    radius={[6, 6, 0, 0]}
                    onClick={(entry: { plant?: string }) => {
                      if (entry?.plant) {
                        setDrilldown({ type: "plant", value: entry.plant });
                        setActiveTab("dataset");
                      }
                    }}
                  />
                  <Bar dataKey="rejected" fill="#dc2626" />
                  <Bar dataKey="open" fill="#2563eb" />
                </BarChart>
              </ChartContainer>
            </SectionCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              title="14-Day Movement"
              description="Submitted, approved, and reopened activity over the last two weeks."
            >
              <ChartContainer config={chartConfig} className="h-[320px] w-full">
                <ComposedChart data={snapshot.trendData}>
                  <defs>
                    <linearGradient id="submittedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="approvedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f766e" stopOpacity={0.38} />
                      <stop offset="95%" stopColor="#0f766e" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatShortDate} />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(value) =>
                          formatDateTime(`${value as string}T00:00:00`)
                        }
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="submitted"
                    stroke="#2563eb"
                    fill="url(#submittedGradient)"
                  />
                  <Area
                    type="monotone"
                    dataKey="approved"
                    stroke="#0f766e"
                    fill="url(#approvedGradient)"
                  />
                  <Bar dataKey="reopened" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </ComposedChart>
              </ChartContainer>
            </SectionCard>

            <SectionCard
              title="Specification Health"
              description="Matched, agreed, and mismatched specifications split by MQP and Visual EL."
            >
              <ChartContainer config={chartConfig} className="h-[320px] w-full">
                <BarChart data={snapshot.specHealthData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="family" />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="matched" stackId="spec" fill="#0f766e" />
                  <Bar dataKey="agreed" stackId="spec" fill="#f59e0b" />
                  <Bar dataKey="mismatched" stackId="spec" fill="#dc2626" />
                </BarChart>
              </ChartContainer>
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="workflow" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Comment Entries"
              value={snapshot.datasetVisibility.comments}
              subtext="Timestamped responses captured across the workflow"
              icon={<Sparkles className="h-5 w-5 text-amber-600" />}
              tone="amber"
              onClick={() => setActiveTab("dataset")}
            />
            <MetricCard
              title="Spec Agreements"
              value={snapshot.totals.agreedSpecs}
              subtext={`${snapshot.totals.mismatchedSpecs} still red`}
              icon={<ArrowRight className="h-5 w-5 text-blue-600" />}
              tone="blue"
            />
            <MetricCard
              title="Turned Green"
              value={snapshot.level1ResolutionData[0]?.count || 0}
              subtext="Level 1 reviewer resolved directly to match"
              icon={<CheckCircle2 className="h-5 w-5 text-teal-600" />}
              tone="teal"
            />
            <MetricCard
              title="Turned Yellow"
              value={snapshot.level1ResolutionData[1]?.count || 0}
              subtext="Level 1 reviewer converted to agreed measure"
              icon={<Users2 className="h-5 w-5 text-violet-600" />}
              tone="violet"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              title="Level 1 Closure Impact"
              description="How many original red points were closed before entering the wider review loop."
            >
              <ChartContainer config={chartConfig} className="h-[320px] w-full">
                <BarChart data={snapshot.level1ResolutionData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={[10, 10, 0, 0]}>
                    {snapshot.level1ResolutionData.map((entry) => (
                      <Cell
                        key={entry.key}
                        fill={
                          entry.key === "matched"
                            ? "#0f766e"
                            : entry.key === "agreed"
                            ? "#f59e0b"
                            : "#dc2626"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </SectionCard>

            <SectionCard
              title="Stage Turnaround"
              description="Average TAT by workflow stage. Click a bar to inspect the underlying samples."
            >
              <ChartContainer config={chartConfig} className="h-[320px] w-full">
                <BarChart data={snapshot.stageTatData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="stageLabel" interval={0} angle={-20} height={72} />
                  <YAxis
                    allowDecimals={false}
                    tickFormatter={(value) => `${value}h`}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent nameKey="stageLabel" />}
                  />
                  <Bar
                    dataKey="averageTatHours"
                    fill="#7c3aed"
                    radius={[10, 10, 0, 0]}
                    onClick={(entry: { stageLabel?: string }) => {
                      if (entry?.stageLabel) {
                        setDrilldown({ type: "stage", value: entry.stageLabel });
                        setActiveTab("dataset");
                      }
                    }}
                  />
                </BarChart>
              </ChartContainer>
            </SectionCard>
          </div>

          <SectionCard
            title="Reviewer Touchpoints"
            description="How much of the visible dataset touched each role in the workflow."
          >
            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <ChartContainer config={chartConfig} className="h-[280px] w-full">
                <BarChart data={reviewerRoleData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="role" interval={0} angle={-12} height={64} />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="#334155" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ChartContainer>

              <div className="grid gap-3">
                {reviewerRoleData.map((item) => (
                  <div
                    key={item.role}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="text-sm font-medium text-slate-600">{item.role}</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-950">
                      {item.count}
                    </div>
                    <div className="mt-2 text-sm text-slate-500">
                      workflow touches in the current visible dataset
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        {adminInsights ? (
          <TabsContent value="tat" className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-3">
              <MetricCard
                title="Slowest Average"
                value={slowestPerson?.averageTatLabel || "0m"}
                subtext={slowestPerson ? `${slowestPerson.person}` : "No data"}
                icon={<Clock3 className="h-5 w-5 text-amber-600" />}
                tone="amber"
                onClick={() =>
                  slowestPerson
                    ? setDrilldown({ type: "person", value: slowestPerson.person })
                    : undefined
                }
              />
              <MetricCard
                title="Fastest Average"
                value={fastestPerson?.averageTatLabel || "0m"}
                subtext={fastestPerson ? `${fastestPerson.person}` : "No data"}
                icon={<CheckCircle2 className="h-5 w-5 text-teal-600" />}
                tone="teal"
                onClick={() =>
                  fastestPerson
                    ? setDrilldown({ type: "person", value: fastestPerson.person })
                    : undefined
                }
              />
              <MetricCard
                title="People Tracked"
                value={snapshot.tatSummary.length}
                subtext={`${snapshot.datasetVisibility.tatSamples} total samples`}
                icon={<Users2 className="h-5 w-5 text-violet-600" />}
                tone="violet"
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <SectionCard
                title="Average TAT By Person"
                description="Click a bar to drill down into the selected person’s exact QAP samples."
              >
                <ChartContainer config={chartConfig} className="h-[380px] w-full">
                  <BarChart data={tatChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="person" interval={0} angle={-16} height={90} />
                    <YAxis
                      allowDecimals={false}
                      tickFormatter={(value) => `${value}h`}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name, item, index, payload) => [
                            `${payload.averageTatLabel} avg`,
                            payload.person,
                          ]}
                        />
                      }
                    />
                    <Bar
                      dataKey="averageTatHours"
                      fill="#111827"
                      radius={[10, 10, 0, 0]}
                      onClick={(entry: { person?: string }) => {
                        if (entry?.person) {
                          setDrilldown({ type: "person", value: entry.person });
                          setActiveTab("dataset");
                        }
                      }}
                    >
                      {tatChartData.map((item, index) => (
                        <Cell
                          key={item.person}
                          fill={STATUS_COLORS[index % STATUS_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </SectionCard>

              <SectionCard
                title="Leadership Snapshot"
                description="At-a-glance MD summary of who is carrying the longest loop time."
              >
                <div className="space-y-4">
                  {snapshot.tatSummary.slice(0, 5).map((item, index) => (
                    <button
                      type="button"
                      key={item.person}
                      onClick={() => {
                        setDrilldown({ type: "person", value: item.person });
                        setActiveTab("dataset");
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left"
                    >
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                          Rank {index + 1}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-950">
                          {item.person}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          {item.roles.join(", ")}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-semibold text-slate-950">
                          {item.averageTatLabel}
                        </div>
                        <div className="text-xs text-slate-500">
                          median {item.medianTatLabel}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </SectionCard>
            </div>

            <SectionCard
              title="Individual TAT Table"
              description="Average, median, and max turnaround for every visible person in the loop."
            >
              <ScrollArea className="h-[420px] rounded-2xl border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Person</TableHead>
                      <TableHead>Role(s)</TableHead>
                      <TableHead>Avg</TableHead>
                      <TableHead>Median</TableHead>
                      <TableHead>Max</TableHead>
                      <TableHead>Samples</TableHead>
                      <TableHead>QAPs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshot.tatSummary.length ? (
                      snapshot.tatSummary.map((row) => (
                        <TableRow key={row.person}>
                          <TableCell className="font-medium">{row.person}</TableCell>
                          <TableCell>{row.roles.join(", ")}</TableCell>
                          <TableCell>{row.averageTatLabel}</TableCell>
                          <TableCell>{row.medianTatLabel}</TableCell>
                          <TableCell>{row.maxTatLabel}</TableCell>
                          <TableCell>{row.count}</TableCell>
                          <TableCell>{row.qapCount}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="py-12 text-center text-slate-500">
                          No turnaround samples are visible for the selected filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </SectionCard>
          </TabsContent>
        ) : null}

        <TabsContent value="dataset" className="space-y-6">
          <SectionCard
            title="Dataset Visibility"
            description="This is the exact subset feeding the current drill-down and all active filters."
            action={
              <Badge variant="outline" className="bg-white">
                {drilldownState.label}
              </Badge>
            }
          >
            <div className="grid gap-4 md:grid-cols-3">
              <DatasetSummaryCard
                title="QAP rows"
                value={drilldownState.qapRows.length}
                icon={<Layers3 className="h-5 w-5 text-blue-600" />}
              />
              <DatasetSummaryCard
                title="Comment rows"
                value={drilldownState.comments.length}
                icon={<Sparkles className="h-5 w-5 text-amber-600" />}
              />
              <DatasetSummaryCard
                title="TAT rows"
                value={drilldownState.tatRows.length}
                icon={<BarChart3 className="h-5 w-5 text-violet-600" />}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Visible QAP Dataset"
            description="Raw dataset view for the currently selected scope."
          >
            <ScrollArea className="h-[380px] rounded-2xl border border-slate-200">
              <QapDatasetTable rows={drilldownState.qapRows} />
            </ScrollArea>
          </SectionCard>

          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              title="Timestamped Comment Feed"
              description="Every stored review/final/approval comment in the current scope."
            >
              <ScrollArea className="h-[340px] rounded-2xl border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Comment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drilldownState.comments.length ? (
                      drilldownState.comments
                        .sort((a, b) => b.timeMs - a.timeMs)
                        .map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>{formatDateTime(row.timestamp)}</TableCell>
                            <TableCell className="font-medium">{row.actor}</TableCell>
                            <TableCell>{row.stage}</TableCell>
                            <TableCell className="max-w-[420px] whitespace-pre-wrap break-words">
                              {row.comment}
                            </TableCell>
                          </TableRow>
                        ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="py-10 text-center text-slate-500">
                          No comments fall under the current drill-down.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </SectionCard>

            <SectionCard
              title={adminInsights ? "TAT Sample Dataset" : "Workflow Samples"}
              description="Each row is one recorded response/approval sample used in turnaround calculations."
            >
              <ScrollArea className="h-[340px] rounded-2xl border border-slate-200">
                <TatDatasetTable rows={drilldownState.tatRows} />
              </ScrollArea>
            </SectionCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const DatasetPill: React.FC<{ label: string; value: React.ReactNode }> = ({
  label,
  value,
}) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</div>
    <div className="mt-1 text-xl font-semibold text-slate-950">{value}</div>
  </div>
);

const DatasetSummaryCard: React.FC<{
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
}> = ({ title, value, icon }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <div className="flex items-center gap-3">
      <div className="rounded-2xl bg-white p-3 shadow-sm">{icon}</div>
      <div>
        <div className="text-sm text-slate-600">{title}</div>
        <div className="text-2xl font-semibold text-slate-950">{value}</div>
      </div>
    </div>
  </div>
);

const QapDatasetTable: React.FC<{ rows: AnalyticsDatasetRow[] }> = ({ rows }) => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Ref</TableHead>
        <TableHead>Customer / Project</TableHead>
        <TableHead>Plant</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Specs</TableHead>
        <TableHead>Comments</TableHead>
        <TableHead>Cycle Time</TableHead>
        <TableHead>Reopened</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {rows.length ? (
        rows
          .sort(
            (a, b) =>
              getTimestampMs(b.submittedAt || null) - getTimestampMs(a.submittedAt || null)
          )
          .map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.ref}</TableCell>
              <TableCell>
                <div className="font-medium text-slate-950">{row.customerName}</div>
                <div className="text-sm text-slate-500">{row.projectName}</div>
              </TableCell>
              <TableCell>{row.plant}</TableCell>
              <TableCell>
                <Badge variant="outline" className="bg-white">
                  {row.status}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="text-sm text-slate-700">
                  {row.totalSpecs} total
                </div>
                <div className="text-xs text-slate-500">
                  {row.matchedSpecs} green / {row.agreedSpecs} yellow /{" "}
                  {row.mismatchedSpecs} red
                </div>
              </TableCell>
              <TableCell>{row.commentCount}</TableCell>
              <TableCell>{row.cycleTimeLabel}</TableCell>
              <TableCell>{row.reopenedCount}</TableCell>
            </TableRow>
          ))
      ) : (
        <TableRow>
          <TableCell colSpan={8} className="py-12 text-center text-slate-500">
            No QAPs are visible for the current selection.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  </Table>
);

const TatDatasetTable: React.FC<{ rows: PersonTatRecord[] }> = ({ rows }) => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Person</TableHead>
        <TableHead>Role</TableHead>
        <TableHead>Stage</TableHead>
        <TableHead>Round</TableHead>
        <TableHead>TAT</TableHead>
        <TableHead>Responded At</TableHead>
        <TableHead>QAP</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {rows.length ? (
        rows
          .sort(
            (a, b) =>
              getTimestampMs(b.respondedAt || null) - getTimestampMs(a.respondedAt || null)
          )
          .map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.person}</TableCell>
              <TableCell>{row.role}</TableCell>
              <TableCell>{row.stageLabel}</TableCell>
              <TableCell>{row.round}</TableCell>
              <TableCell>{row.tatLabel || formatDurationMs(row.tatMs)}</TableCell>
              <TableCell>{formatDateTime(row.respondedAt)}</TableCell>
              <TableCell>
                <div className="font-medium text-slate-950">{row.ref}</div>
                <div className="text-xs text-slate-500">{row.customerName}</div>
              </TableCell>
            </TableRow>
          ))
      ) : (
        <TableRow>
          <TableCell colSpan={7} className="py-12 text-center text-slate-500">
            No workflow samples match the current drill-down.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  </Table>
);

export default AnalyticsDashboard;
