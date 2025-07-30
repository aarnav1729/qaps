/* --------------------------------------------------------------------------
 *  AnalyticsPage.tsx  –  Quality‑Assurance analytics dashboard
 * ------------------------------------------------------------------------ */
import React, { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  FileText,
  CheckCircle,
} from "lucide-react";
import { QAPFormData } from "@/types/qap";
import { useAuth } from "@/contexts/AuthContext";

/* ------------------------------------------------------------------ */
/* types & helpers                                                    */
/* ------------------------------------------------------------------ */
interface AnalyticsPageProps {
  qapData: QAPFormData[];
}

/** bring all spec rows (MQP + Visual) into a flat array */
const getAllSpecs = (qap: QAPFormData) => {
  if (Array.isArray(qap.qaps)) return qap.qaps; // legacy
  const mqp = qap.specs?.mqp || [];
  const visual = qap.specs?.visual || [];
  return [...mqp, ...visual];
};

/* colour palette for statuses */
const chartConfig = {
  submitted: { label: "Submitted", color: "#fbbf24" },
  approved: { label: "Approved", color: "#10b981" },
  rejected: { label: "Rejected", color: "#ef4444" },
  draft: { label: "Draft", color: "#6b7280" },
};

/* ------------------------------------------------------------------ */
/* component                                                          */
/* ------------------------------------------------------------------ */
const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ qapData }) => {
  const { user } = useAuth();

  /* UI state for filters */
  const [selectedPlant, setSelectedPlant] = useState<string>("all");
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  /* -------------------------------------------------------------- */
  /* filtered dataset                                               */
  /* -------------------------------------------------------------- */
  const filteredData = useMemo(() => {
    let data = [...qapData];

    // role‑based scoping (non‑admins can only see their plant)
    if (user?.role !== "admin" && user?.plant) {
      data = data.filter(
        (qap) => qap.plant.toLowerCase() === user.plant!.toLowerCase()
      );
    }

    // plant filter (admin only)
    if (selectedPlant !== "all") {
      data = data.filter(
        (q) => q.plant.toLowerCase() === selectedPlant.toLowerCase()
      );
    }

    // status filter
    if (selectedStatus !== "all") {
      data = data.filter((q) => q.status === selectedStatus);
    }

    // timeframe filter
    if (selectedTimeframe !== "all") {
      const now = Date.now();
      const days =
        selectedTimeframe === "7d"
          ? 7
          : selectedTimeframe === "30d"
          ? 30
          : 90;
      const cutoff = now - days * 24 * 60 * 60 * 1000;
      data = data.filter(
        (q) =>
          q.submittedAt && new Date(q.submittedAt).getTime() >= cutoff
      );
    }

    return data;
  }, [qapData, user, selectedPlant, selectedTimeframe, selectedStatus]);

  /* -------------------------------------------------------------- */
  /* dataset for charts                                             */
  /* -------------------------------------------------------------- */
  // Status distribution – pie
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach((q) => {
      counts[q.status] = (counts[q.status] || 0) + 1;
    });
    return Object.entries(counts).map(([status, count]) => ({
      status: status[0].toUpperCase() + status.slice(1),
      count,
      fill: chartConfig[status as keyof typeof chartConfig]?.color,
    }));
  }, [filteredData]);

  // Plant performance – stacked bars
  const plantData = useMemo(() => {
    const byPlant: Record<
      string,
      { approved: number; rejected: number; submitted: number }
    > = {};
    filteredData.forEach((q) => {
      const p = q.plant.toUpperCase();
      if (!byPlant[p])
        byPlant[p] = { approved: 0, rejected: 0, submitted: 0 };
      byPlant[p][q.status as keyof typeof byPlant[string]]++;
    });
    return Object.entries(byPlant).map(([plant, counts]) => ({
      plant,
      ...counts,
    }));
  }, [filteredData]);

  // 30‑day trend – lines
  const trendData = useMemo(() => {
    const today = new Date();
    const days = [...Array(30).keys()].map((i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (29 - i));
      return d.toISOString().slice(0, 10);
    });

    return days.map((d) => {
      const dayQAPs = filteredData.filter(
        (q) =>
          q.submittedAt &&
          new Date(q.submittedAt).toISOString().slice(0, 10) === d
      );
      return {
        date: d,
        submitted: dayQAPs.filter((q) => q.status === "submitted").length,
        approved: dayQAPs.filter((q) => q.status === "approved").length,
        rejected: dayQAPs.filter((q) => q.status === "rejected").length,
      };
    });
  }, [filteredData]);

  // Quality (pass/fail) – pie
  const qualityChartData = useMemo(() => {
    const counts = filteredData
      .flatMap(getAllSpecs)
      .reduce(
        (acc: Record<string, number>, spec: any) => {
          if (spec.match) acc[spec.match] = (acc[spec.match] || 0) + 1;
          return acc;
        },
        { yes: 0, no: 0 }
      );

    return [
      { match: "Pass", count: counts.yes, fill: "#10b981" },
      { match: "Fail", count: counts.no, fill: "#ef4444" },
    ];
  }, [filteredData]);

  /* -------------------------------------------------------------- */
  /* derived summary numbers                                        */
  /* -------------------------------------------------------------- */
  const stats = {
    total: filteredData.length,
    approved: filteredData.filter((q) => q.status === "approved").length,
    rejected: filteredData.filter((q) => q.status === "rejected").length,
    pending: filteredData.filter((q) => q.status === "submitted").length,
    approvalRate:
      filteredData.length === 0
        ? 0
        : Math.round(
            (filteredData.filter((q) => q.status === "approved").length /
              filteredData.length) *
              100
          ),
  };

  /* ------------------------------------------------------------------ */
  /* UI                                                                  */
  /* ------------------------------------------------------------------ */
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Analytics Dashboard
        </h1>
        <p className="text-gray-600">
          Quality‑Assurance Plan performance metrics &amp; insights
        </p>
      </div>

      {/* filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        {user?.role === "admin" && (
          <Select value={selectedPlant} onValueChange={setSelectedPlant}>
            <SelectTrigger>
              <SelectValue placeholder="Select Plant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Plants</SelectItem>
              <SelectItem value="p2">P2 Plant</SelectItem>
              <SelectItem value="p4">P4 Plant</SelectItem>
              <SelectItem value="p5">P5 Plant</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Select Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
          <SelectTrigger>
            <SelectValue placeholder="Select Timeframe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>

        <div className="text-sm text-gray-600 flex items-center">
          Showing&nbsp;
          <span className="font-medium text-gray-900">
            {filteredData.length}
          </span>
          &nbsp;QAPs
        </div>
      </div>

      {/* summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          {
            icon: <FileText className="h-5 w-5 text-blue-500" />,
            label: "Total QAPs",
            value: stats.total,
          },
          {
            icon: <CheckCircle className="h-5 w-5 text-green-500" />,
            label: "Approved",
            value: stats.approved,
          },
          {
            icon: <TrendingDown className="h-5 w-5 text-red-500" />,
            label: "Rejected",
            value: stats.rejected,
          },
          {
            icon: <Activity className="h-5 w-5 text-yellow-500" />,
            label: "Pending",
            value: stats.pending,
          },
          {
            icon: <TrendingUp className="h-5 w-5 text-green-500" />,
            label: "Approval Rate",
            value: `${stats.approvalRate}%`,
          },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                {c.icon}
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {c.label}
                  </p>
                  <p className="text-2xl font-bold">{c.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Status distribution */}
        <Card>
          <CardHeader>
            <CardTitle>QAP Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ status, count }) => `${status}: ${count}`}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Plant performance */}
        <Card>
          <CardHeader>
            <CardTitle>Plant Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-64">
              <ResponsiveContainer>
                <BarChart data={plantData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="plant" />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="approved" fill="#10b981" name="Approved" />
                  <Bar dataKey="rejected" fill="#ef4444" name="Rejected" />
                  <Bar dataKey="submitted" fill="#fbbf24" name="Submitted" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 30‑day trend */}
        <Card>
          <CardHeader>
            <CardTitle>30‑Day Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-64">
              <ResponsiveContainer>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) =>
                      new Date(d).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    }
                  />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="submitted"
                    stroke="#fbbf24"
                    name="Submitted"
                  />
                  <Line
                    type="monotone"
                    dataKey="approved"
                    stroke="#10b981"
                    name="Approved"
                  />
                  <Line
                    type="monotone"
                    dataKey="rejected"
                    stroke="#ef4444"
                    name="Rejected"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* quality pie */}
        <Card>
          <CardHeader>
            <CardTitle>Quality Pass / Fail Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={qualityChartData}
                    dataKey="count"
                    nameKey="match"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ match, count }) => `${match}: ${count}`}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticsPage;
