import React, { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
  FileText,
  Filter,
  Layers3,
  RefreshCcw,
  Sparkles,
  TrendingUp,
  Users2,
  X,
  AlertTriangle,
  Eye,
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

const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ReactNode;
  color: string;
  onClick?: () => void;
  active?: boolean;
}> = ({ label, value, sub, icon, color, onClick, active }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "text-left w-full rounded-2xl border p-4 transition-all",
      onClick ? "cursor-pointer hover:shadow-md" : "cursor-default",
      active
        ? "ring-2 ring-slate-900 border-slate-900 shadow-md bg-white"
        : "border-slate-200 bg-white hover:border-slate-300"
    )}
  >
    <div className="flex items-start justify-between">
      <div className={cn("rounded-xl p-2", color)}>{icon}</div>
      <div className="text-right">
        <div className="text-2xl font-bold text-slate-900">{value}</div>
      </div>
    </div>
    <div className="mt-3">
      <div className="text-sm font-medium text-slate-600">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  </button>
);

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  qapData,
  forceAdminInsights = false,
}) => {
  const { user } = useAuth();
  const adminInsights = forceAdminInsights || user?.role === "admin";
  const [filters, setFilters] = useState<AnalyticsFilters>({
    plant: "all",
    status: "all",
    timeframe: "all",
  });
  const [activeTab, setActiveTab] = useState<string>("overview");
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
        label: "All visible data",
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

  const hasActiveFilters =
    filters.plant !== "all" ||
    filters.status !== "all" ||
    filters.timeframe !== "all";

  const resetAll = () => {
    setFilters({ plant: "all", timeframe: "all", status: "all" });
    setDrilldown(null);
  };

  return (
    <div className="container mx-auto px-4 py-6 sm:px-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Analytics
          </h1>
          <p className="text-slate-500 mt-1">
            Workflow visibility, quality health, and drill-down analytics
            {adminInsights && (
              <Badge className="ml-2 bg-slate-900 text-white hover:bg-slate-900">
                MD View
              </Badge>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Eye className="h-4 w-4" />
          {snapshot.datasetVisibility.qaps} QAPs &middot;{" "}
          {snapshot.datasetVisibility.specs} specs &middot;{" "}
          {snapshot.datasetVisibility.tatSamples} TAT samples
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <Filter className="h-4 w-4 text-slate-400" />

        {adminInsights && (
          <Select
            value={filters.plant}
            onValueChange={(v) => setFilters((f) => ({ ...f, plant: v }))}
          >
            <SelectTrigger className="w-[140px] bg-white">
              <SelectValue placeholder="All plants" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All plants</SelectItem>
              {plants.map((p) => (
                <SelectItem key={p} value={p}>
                  {p.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={filters.status}
          onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}
        >
          <SelectTrigger className="w-[150px] bg-white">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {snapshot.statusData.map((s) => (
              <SelectItem key={s.key} value={s.key}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.timeframe}
          onValueChange={(v) => setFilters((f) => ({ ...f, timeframe: v }))}
        >
          <SelectTrigger className="w-[150px] bg-white">
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

        {drilldown && (
          <Badge
            variant="secondary"
            className="gap-1 cursor-pointer"
            onClick={() => setDrilldown(null)}
          >
            {drilldownState.label}
            <X className="h-3 w-3" />
          </Badge>
        )}

        {(hasActiveFilters || drilldown) && (
          <Button variant="ghost" size="sm" onClick={resetAll} className="ml-auto">
            <RefreshCcw className="h-3.5 w-3.5 mr-1" />
            Reset
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <StatCard
          label="Total QAPs"
          value={snapshot.totals.qaps}
          sub={`${snapshot.totals.open} in progress`}
          icon={<Layers3 className="h-4 w-4 text-blue-600" />}
          color="bg-blue-50"
        />
        <StatCard
          label="Approved"
          value={snapshot.totals.approved}
          sub={`${snapshot.totals.approvalRate}% approval rate`}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          color="bg-emerald-50"
          onClick={() => {
            setDrilldown({ type: "status", value: "Approved" });
            setActiveTab("dataset");
          }}
          active={drilldown?.type === "status" && drilldown.value === "Approved"}
        />
        <StatCard
          label="Rejected"
          value={snapshot.totals.rejected}
          sub="sent back for revision"
          icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
          color="bg-red-50"
          onClick={() => {
            setDrilldown({ type: "status", value: "Rejected" });
            setActiveTab("dataset");
          }}
          active={drilldown?.type === "status" && drilldown.value === "Rejected"}
        />
        <StatCard
          label="Avg Cycle Time"
          value={snapshot.totals.averageCycleTimeLabel}
          sub="submission to close"
          icon={<Clock3 className="h-4 w-4 text-violet-600" />}
          color="bg-violet-50"
        />
        <StatCard
          label="Reopened"
          value={snapshot.totals.reopenedCount}
          sub="routed back for re-review"
          icon={<Activity className="h-4 w-4 text-amber-600" />}
          color="bg-amber-50"
        />
        <StatCard
          label="Spec Health"
          value={`${snapshot.totals.matchedSpecs}/${snapshot.totals.totalSpecs}`}
          sub={`${snapshot.totals.mismatchedSpecs} mismatched`}
          icon={<FileText className="h-4 w-4 text-teal-600" />}
          color="bg-teal-50"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 h-auto flex-wrap justify-start gap-1 rounded-xl bg-slate-100 p-1.5">
          <TabsTrigger value="overview" className="rounded-lg text-sm">
            Overview
          </TabsTrigger>
          <TabsTrigger value="workflow" className="rounded-lg text-sm">
            Workflow
          </TabsTrigger>
          {adminInsights && (
            <TabsTrigger value="tat" className="rounded-lg text-sm">
              Individual TAT
            </TabsTrigger>
          )}
          <TabsTrigger value="dataset" className="rounded-lg text-sm">
            Dataset
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════ OVERVIEW TAB ═══════════════ */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Status Distribution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Status Distribution</CardTitle>
                <p className="text-sm text-slate-500">Click a slice to drill down</p>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                  <PieChart>
                    <Pie
                      data={snapshot.statusData}
                      dataKey="count"
                      nameKey="label"
                      innerRadius={64}
                      outerRadius={100}
                      paddingAngle={2}
                      onClick={(entry: { label?: string }) => {
                        if (entry?.label) {
                          setDrilldown({ type: "status", value: entry.label });
                          setActiveTab("dataset");
                        }
                      }}
                    >
                      {snapshot.statusData.map((_entry, index) => (
                        <Cell
                          key={_entry.key}
                          fill={STATUS_COLORS[index % STATUS_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent hideIndicator />} />
                  </PieChart>
                </ChartContainer>
                <div className="flex flex-wrap gap-2 mt-2">
                  {snapshot.statusData.map((item, index) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setDrilldown({ type: "status", value: item.label });
                        setActiveTab("dataset");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: STATUS_COLORS[index % STATUS_COLORS.length],
                        }}
                      />
                      {item.label}
                      <span className="font-semibold">{item.count}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Plant Throughput */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Plant Throughput</CardTitle>
                <p className="text-sm text-slate-500">
                  Approved / rejected / open by plant — click a bar to drill down
                </p>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                  <BarChart data={snapshot.plantData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="plant" />
                    <YAxis allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Bar
                      dataKey="approved"
                      fill="#0f766e"
                      radius={[4, 4, 0, 0]}
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
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* 14-Day Movement */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">14-Day Activity</CardTitle>
                <p className="text-sm text-slate-500">
                  Submissions, approvals, and reopened QAPs
                </p>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                  <ComposedChart data={snapshot.trendData}>
                    <defs>
                      <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
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
                          labelFormatter={(v) =>
                            formatDateTime(`${v as string}T00:00:00`)
                          }
                        />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="submitted"
                      stroke="#2563eb"
                      fill="url(#sg)"
                    />
                    <Area
                      type="monotone"
                      dataKey="approved"
                      stroke="#0f766e"
                      fill="url(#ag)"
                    />
                    <Bar dataKey="reopened" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </ComposedChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Spec Health */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Specification Health</CardTitle>
                <p className="text-sm text-slate-500">
                  MQP vs Visual EL — matched, agreed, mismatched
                </p>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
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
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════ WORKFLOW TAB ═══════════════ */}
        <TabsContent value="workflow" className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Comment Entries"
              value={snapshot.datasetVisibility.comments}
              sub="timestamped responses"
              icon={<Sparkles className="h-4 w-4 text-amber-600" />}
              color="bg-amber-50"
              onClick={() => setActiveTab("dataset")}
            />
            <StatCard
              label="Spec Agreements"
              value={snapshot.totals.agreedSpecs}
              sub={`${snapshot.totals.mismatchedSpecs} still red`}
              icon={<ArrowRight className="h-4 w-4 text-blue-600" />}
              color="bg-blue-50"
            />
            <StatCard
              label="Turned Green (L1)"
              value={snapshot.level1ResolutionData[0]?.count || 0}
              sub="resolved to match at Level 1"
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              color="bg-emerald-50"
            />
            <StatCard
              label="Turned Yellow (L1)"
              value={snapshot.level1ResolutionData[1]?.count || 0}
              sub="converted to agreed"
              icon={<Users2 className="h-4 w-4 text-violet-600" />}
              color="bg-violet-50"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Level 1 Closure Impact</CardTitle>
                <p className="text-sm text-slate-500">
                  Red points closed before wider review loop
                </p>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                  <BarChart data={snapshot.level1ResolutionData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" />
                    <YAxis allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]}>
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Stage Turnaround</CardTitle>
                <p className="text-sm text-slate-500">
                  Avg TAT by workflow stage — click a bar to inspect samples
                </p>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                  <BarChart data={snapshot.stageTatData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="stageLabel"
                      interval={0}
                      angle={-20}
                      height={72}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickFormatter={(v) => `${v}h`}
                    />
                    <ChartTooltip
                      content={<ChartTooltipContent nameKey="stageLabel" />}
                    />
                    <Bar
                      dataKey="averageTatHours"
                      fill="#7c3aed"
                      radius={[8, 8, 0, 0]}
                      onClick={(entry: { stageLabel?: string }) => {
                        if (entry?.stageLabel) {
                          setDrilldown({
                            type: "stage",
                            value: entry.stageLabel,
                          });
                          setActiveTab("dataset");
                        }
                      }}
                    />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          {/* Reviewer Touchpoints */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Reviewer Touchpoints</CardTitle>
              <p className="text-sm text-slate-500">
                How much of the visible dataset touched each role
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <ChartContainer config={chartConfig} className="h-[260px] w-full">
                  <BarChart data={reviewerRoleData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="role" interval={0} angle={-12} height={64} />
                    <YAxis allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="#334155" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartContainer>
                <div className="grid gap-2 content-start">
                  {reviewerRoleData.map((item) => (
                    <div
                      key={item.role}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5"
                    >
                      <span className="text-sm text-slate-700">{item.role}</span>
                      <span className="text-lg font-bold text-slate-900">
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════ INDIVIDUAL TAT TAB ═══════════════ */}
        {adminInsights && (
          <TabsContent value="tat" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <StatCard
                label="Slowest Average"
                value={slowestPerson?.averageTatLabel || "—"}
                sub={slowestPerson?.person || "No data"}
                icon={<Clock3 className="h-4 w-4 text-amber-600" />}
                color="bg-amber-50"
                onClick={() =>
                  slowestPerson &&
                  setDrilldown({ type: "person", value: slowestPerson.person })
                }
              />
              <StatCard
                label="Fastest Average"
                value={fastestPerson?.averageTatLabel || "—"}
                sub={fastestPerson?.person || "No data"}
                icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
                color="bg-emerald-50"
                onClick={() =>
                  fastestPerson &&
                  setDrilldown({ type: "person", value: fastestPerson.person })
                }
              />
              <StatCard
                label="People Tracked"
                value={snapshot.tatSummary.length}
                sub={`${snapshot.datasetVisibility.tatSamples} total samples`}
                icon={<Users2 className="h-4 w-4 text-violet-600" />}
                color="bg-violet-50"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    Average TAT By Person
                  </CardTitle>
                  <p className="text-sm text-slate-500">
                    Click a bar to drill into their QAP samples
                  </p>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={chartConfig}
                    className="h-[360px] w-full"
                  >
                    <BarChart data={tatChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="person"
                        interval={0}
                        angle={-16}
                        height={80}
                      />
                      <YAxis
                        allowDecimals={false}
                        tickFormatter={(v) => `${v}h`}
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
                        radius={[8, 8, 0, 0]}
                        onClick={(entry: { person?: string }) => {
                          if (entry?.person) {
                            setDrilldown({
                              type: "person",
                              value: entry.person,
                            });
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
                </CardContent>
              </Card>

              {/* Leaderboard */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    Leadership Snapshot
                  </CardTitle>
                  <p className="text-sm text-slate-500">
                    Top 5 by average loop time
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {snapshot.tatSummary.slice(0, 5).map((item, index) => (
                    <button
                      type="button"
                      key={item.person}
                      onClick={() => {
                        setDrilldown({
                          type: "person",
                          value: item.person,
                        });
                        setActiveTab("dataset");
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-xs text-slate-400">
                          #{index + 1}
                        </div>
                        <div className="text-sm font-semibold text-slate-900 truncate">
                          {item.person}
                        </div>
                        <div className="text-xs text-slate-500">
                          {item.roles.join(", ")}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-base font-bold text-slate-900">
                          {item.averageTatLabel}
                        </div>
                        <div className="text-xs text-slate-400">
                          med {item.medianTatLabel}
                        </div>
                      </div>
                    </button>
                  ))}
                  {!snapshot.tatSummary.length && (
                    <p className="py-8 text-center text-sm text-slate-400">
                      No TAT data for current filters
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Full TAT Table */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Individual TAT Table
                </CardTitle>
                <p className="text-sm text-slate-500">
                  Average, median, and max turnaround per person
                </p>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] rounded-lg border">
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
                          <TableRow
                            key={row.person}
                            className="cursor-pointer hover:bg-slate-50"
                            onClick={() => {
                              setDrilldown({
                                type: "person",
                                value: row.person,
                              });
                              setActiveTab("dataset");
                            }}
                          >
                            <TableCell className="font-medium">
                              {row.person}
                            </TableCell>
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
                          <TableCell
                            colSpan={7}
                            className="py-12 text-center text-slate-400"
                          >
                            No turnaround samples for current filters.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ═══════════════ DATASET TAB ═══════════════ */}
        <TabsContent value="dataset" className="space-y-6">
          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-2">
                <Layers3 className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <div className="text-xs text-slate-500">QAP rows</div>
                <div className="text-xl font-bold text-slate-900">
                  {drilldownState.qapRows.length}
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3">
              <div className="rounded-lg bg-amber-50 p-2">
                <Sparkles className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <div className="text-xs text-slate-500">Comments</div>
                <div className="text-xl font-bold text-slate-900">
                  {drilldownState.comments.length}
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3">
              <div className="rounded-lg bg-violet-50 p-2">
                <BarChart3 className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <div className="text-xs text-slate-500">TAT samples</div>
                <div className="text-xl font-bold text-slate-900">
                  {drilldownState.tatRows.length}
                </div>
              </div>
            </div>
          </div>

          {/* QAP Dataset */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">QAP Dataset</CardTitle>
                  <p className="text-sm text-slate-500">
                    Raw rows for current scope
                  </p>
                </div>
                {drilldown && (
                  <Badge variant="outline">{drilldownState.label}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[380px] rounded-lg border">
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
                    {drilldownState.qapRows.length ? (
                      drilldownState.qapRows
                        .sort(
                          (a, b) =>
                            getTimestampMs(b.submittedAt || null) -
                            getTimestampMs(a.submittedAt || null)
                        )
                        .map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">
                              {row.ref}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-slate-900">
                                {row.customerName}
                              </div>
                              <div className="text-xs text-slate-500">
                                {row.projectName}
                              </div>
                            </TableCell>
                            <TableCell>{row.plant}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{row.status}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{row.totalSpecs} total</div>
                              <div className="text-xs text-slate-500">
                                {row.matchedSpecs}G / {row.agreedSpecs}Y /{" "}
                                {row.mismatchedSpecs}R
                              </div>
                            </TableCell>
                            <TableCell>{row.commentCount}</TableCell>
                            <TableCell>{row.cycleTimeLabel}</TableCell>
                            <TableCell>{row.reopenedCount}</TableCell>
                          </TableRow>
                        ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="py-12 text-center text-slate-400"
                        >
                          No QAPs match current selection.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Comment Feed */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Comment Feed</CardTitle>
                <p className="text-sm text-slate-500">
                  Timestamped review/approval comments
                </p>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[340px] rounded-lg border">
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
                              <TableCell className="whitespace-nowrap">
                                {formatDateTime(row.timestamp)}
                              </TableCell>
                              <TableCell className="font-medium">
                                {row.actor}
                              </TableCell>
                              <TableCell>{row.stage}</TableCell>
                              <TableCell className="max-w-[400px] whitespace-pre-wrap break-words">
                                {row.comment}
                              </TableCell>
                            </TableRow>
                          ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="py-10 text-center text-slate-400"
                          >
                            No comments in current scope.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* TAT Samples */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {adminInsights ? "TAT Sample Dataset" : "Workflow Samples"}
                </CardTitle>
                <p className="text-sm text-slate-500">
                  Individual response/approval samples
                </p>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[340px] rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Person</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>TAT</TableHead>
                        <TableHead>Responded</TableHead>
                        <TableHead>QAP</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drilldownState.tatRows.length ? (
                        drilldownState.tatRows
                          .sort(
                            (a, b) =>
                              getTimestampMs(b.respondedAt || null) -
                              getTimestampMs(a.respondedAt || null)
                          )
                          .map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="font-medium">
                                {row.person}
                              </TableCell>
                              <TableCell>{row.role}</TableCell>
                              <TableCell>{row.stageLabel}</TableCell>
                              <TableCell>
                                {row.tatLabel || formatDurationMs(row.tatMs)}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {formatDateTime(row.respondedAt)}
                              </TableCell>
                              <TableCell>
                                <div className="font-medium">{row.ref}</div>
                                <div className="text-xs text-slate-500">
                                  {row.customerName}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="py-10 text-center text-slate-400"
                          >
                            No workflow samples in current scope.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalyticsDashboard;
