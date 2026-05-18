import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { Customer } from "@/pages/Customers";
import type { SalesRequest } from "@/pages/SalesRequestPage";
import BrandedLoadingScreen from "@/components/BrandedLoadingScreen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart3,
  Building2,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  Filter,
  Gauge,
  Layers3,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API = window.location.origin;

type SalesRequestAnalyticsRow = SalesRequest & {
  productCategory?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type Drilldown =
  | { type: "customer"; value: string; label: string }
  | { type: "plant"; value: string; label: string }
  | { type: "priority"; value: string; label: string }
  | { type: "dcr"; value: string; label: string }
  | { type: "source"; value: string; label: string }
  | null;

const PLANT_COLORS = ["#0f766e", "#2563eb", "#7c3aed", "#ea580c", "#0891b2"];
const PRIORITY_COLORS: Record<string, string> = {
  high: "#dc2626",
  low: "#0f766e",
};

const fmtNumber = (value: number) =>
  Number.isFinite(value)
    ? value.toLocaleString("en-IN", { maximumFractionDigits: 2 })
    : "0";

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const ymd = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const groupCount = <T,>(rows: T[], getKey: (row: T) => string) => {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    const key = getKey(row) || "Not set";
    map.set(key, (map.get(key) || 0) + 1);
  });
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

const SalesAnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [customer, setCustomer] = useState("all");
  const [plant, setPlant] = useState("all");
  const [priority, setPriority] = useState("all");
  const [dcr, setDcr] = useState("all");
  const [source, setSource] = useState("all");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [deliveryFrom, setDeliveryFrom] = useState("");
  const [deliveryTo, setDeliveryTo] = useState("");
  const [minMw, setMinMw] = useState("");
  const [maxMw, setMaxMw] = useState("");
  const [drilldown, setDrilldown] = useState<Drilldown>(null);

  const {
    data: customers = [],
    isLoading: customersLoading,
    refetch: refetchCustomers,
  } = useQuery<Customer[]>({
    queryKey: ["customers", "sales-analytics"],
    queryFn: async () => {
      const r = await fetch(`${API}/api/customers?includeCounts=1`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const {
    data: salesRequests = [],
    isLoading: requestsLoading,
    refetch: refetchRequests,
  } = useQuery<SalesRequestAnalyticsRow[]>({
    queryKey: ["sales-requests", "sales-analytics"],
    queryFn: async () => {
      const r = await fetch(`${API}/api/sales-requests`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const customerNames = useMemo(
    () =>
      [...new Set(customers.map((c) => c.name).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [customers]
  );

  const plantOptions = useMemo(
    () =>
      [...new Set(salesRequests.map((r) => r.moduleManufacturingPlant).filter(Boolean))].sort(),
    [salesRequests]
  );

  const filteredRequests = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = minMw === "" ? null : Number(minMw);
    const max = maxMw === "" ? null : Number(maxMw);

    return salesRequests.filter((request) => {
      const created = ymd(request.createdAt);
      const deliveryStart = ymd(request.deliveryStartDate);
      const searchable = [
        request.customerName,
        request.projectCode,
        request.projectLocation,
        request.productCategory,
        request.moduleCellType,
        request.cellTech,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (q && !searchable.includes(q)) return false;
      if (customer !== "all" && request.customerName !== customer) return false;
      if (plant !== "all" && request.moduleManufacturingPlant !== plant) return false;
      if (priority !== "all" && request.priority !== priority) return false;
      if (dcr !== "all" && request.cellType !== dcr) return false;
      if (source !== "all" && request.qapType !== source && request.bomFrom !== source) return false;
      if (createdFrom && created && created < createdFrom) return false;
      if (createdTo && created && created > createdTo) return false;
      if (deliveryFrom && deliveryStart && deliveryStart < deliveryFrom) return false;
      if (deliveryTo && deliveryStart && deliveryStart > deliveryTo) return false;
      if (min !== null && Number(request.rfqOrderQtyMW || 0) < min) return false;
      if (max !== null && Number(request.rfqOrderQtyMW || 0) > max) return false;
      return true;
    });
  }, [
    customer,
    createdFrom,
    createdTo,
    dcr,
    deliveryFrom,
    deliveryTo,
    maxMw,
    minMw,
    plant,
    priority,
    query,
    salesRequests,
    source,
  ]);

  const drilldownRows = useMemo(() => {
    if (!drilldown) return filteredRequests;
    return filteredRequests.filter((request) => {
      if (drilldown.type === "customer") return request.customerName === drilldown.value;
      if (drilldown.type === "plant") return request.moduleManufacturingPlant === drilldown.value;
      if (drilldown.type === "priority") return request.priority === drilldown.value;
      if (drilldown.type === "dcr") return request.cellType === drilldown.value;
      if (drilldown.type === "source") {
        return request.qapType === drilldown.value || request.bomFrom === drilldown.value;
      }
      return true;
    });
  }, [drilldown, filteredRequests]);

  const stats = useMemo(() => {
    const totalMw = filteredRequests.reduce(
      (sum, request) => sum + Number(request.rfqOrderQtyMW || 0),
      0
    );
    const biddedMw = filteredRequests.reduce(
      (sum, request) => sum + Number(request.premierBiddedOrderQtyMW || 0),
      0
    );
    const activeCustomers = new Set(filteredRequests.map((r) => r.customerName)).size;
    const attachmentHeavy = filteredRequests.filter(
      (request) =>
        request.qapTypeAttachmentUrl ||
        request.primaryBomAttachmentUrl ||
        request.otherAttachments?.length
    ).length;

    return {
      customers: customers.length,
      activeCustomers,
      requests: filteredRequests.length,
      totalMw,
      biddedMw,
      attachmentHeavy,
      avgMw: filteredRequests.length ? totalMw / filteredRequests.length : 0,
    };
  }, [customers.length, filteredRequests]);

  const topCustomers = useMemo(() => {
    const counts = groupCount(filteredRequests, (request) => request.customerName);
    return counts.slice(0, 8);
  }, [filteredRequests]);

  const plantBreakdown = useMemo(
    () => groupCount(filteredRequests, (request) => request.moduleManufacturingPlant),
    [filteredRequests]
  );

  const priorityBreakdown = useMemo(
    () => groupCount(filteredRequests, (request) => request.priority),
    [filteredRequests]
  );

  const dcrBreakdown = useMemo(
    () => groupCount(filteredRequests, (request) => request.cellType),
    [filteredRequests]
  );

  const sourceBreakdown = useMemo(
    () => groupCount(filteredRequests, (request) => request.qapType || request.bomFrom || "Not set"),
    [filteredRequests]
  );

  const monthlyTrend = useMemo(() => {
    const map = new Map<string, { month: string; requests: number; mw: number }>();
    filteredRequests.forEach((request) => {
      const date = new Date(request.createdAt || request.deliveryStartDate || "");
      if (Number.isNaN(date.getTime())) return;
      const month = date.toLocaleDateString("en-IN", {
        month: "short",
        year: "2-digit",
      });
      const current = map.get(month) || { month, requests: 0, mw: 0 };
      current.requests += 1;
      current.mw += Number(request.rfqOrderQtyMW || 0);
      map.set(month, current);
    });
    return [...map.values()].slice(-8);
  }, [filteredRequests]);

  const resetFilters = () => {
    setQuery("");
    setCustomer("all");
    setPlant("all");
    setPriority("all");
    setDcr("all");
    setSource("all");
    setCreatedFrom("");
    setCreatedTo("");
    setDeliveryFrom("");
    setDeliveryTo("");
    setMinMw("");
    setMaxMw("");
    setDrilldown(null);
  };

  const refresh = () => {
    refetchCustomers();
    refetchRequests();
  };

  if (customersLoading || requestsLoading) {
    return (
      <BrandedLoadingScreen
        message="Loading sales analytics"
        subtitle="Preparing customer and sales request insights."
        className="min-h-[420px]"
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs font-medium text-emerald-700">
            <BarChart3 className="h-3.5 w-3.5" />
            Sales Analytics
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            Customers and Sales Requests
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Drill into customer demand, request mix, plants, priorities, and document sources.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={resetFilters}>
            <X className="mr-2 h-4 w-4" />
            Clear Filters
          </Button>
          <Button variant="outline" onClick={refresh}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard icon={Users} label="Total Customers" value={fmtNumber(stats.customers)} />
        <MetricCard icon={Building2} label="Active Customers" value={fmtNumber(stats.activeCustomers)} />
        <MetricCard icon={ClipboardList} label="Sales Requests" value={fmtNumber(stats.requests)} />
        <MetricCard icon={TrendingUp} label="RFQ MW" value={fmtNumber(stats.totalMw)} />
        <MetricCard icon={Gauge} label="Avg MW / Request" value={fmtNumber(stats.avgMw)} />
        <MetricCard icon={Layers3} label="With Attachments" value={fmtNumber(stats.attachmentHeavy)} />
      </div>

      <Card className="mt-6 border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="h-4 w-4 text-emerald-700" />
            Advanced Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="relative xl:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-9"
                placeholder="Search customer, project, location, product"
              />
            </div>
            <NativeSelect value={customer} onChange={setCustomer}>
              <option value="all">All customers</option>
              {customerNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect value={plant} onChange={setPlant}>
              <option value="all">All plants</option>
              {plantOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect value={priority} onChange={setPriority}>
              <option value="all">All priorities</option>
              <option value="high">High</option>
              <option value="low">Low</option>
            </NativeSelect>
            <NativeSelect value={dcr} onChange={setDcr}>
              <option value="all">All DCR</option>
              <option value="DCR">DCR</option>
              <option value="NDCR">NDCR</option>
            </NativeSelect>
            <NativeSelect value={source} onChange={setSource}>
              <option value="all">All document sources</option>
              <option value="Customer">Customer</option>
              <option value="Premier Energies">Premier Energies</option>
            </NativeSelect>
            <DateInput label="Created from" value={createdFrom} onChange={setCreatedFrom} />
            <DateInput label="Created to" value={createdTo} onChange={setCreatedTo} />
            <DateInput label="Delivery from" value={deliveryFrom} onChange={setDeliveryFrom} />
            <DateInput label="Delivery to" value={deliveryTo} onChange={setDeliveryTo} />
            <Input value={minMw} onChange={(e) => setMinMw(e.target.value)} inputMode="decimal" placeholder="Min MW" />
            <Input value={maxMw} onChange={(e) => setMaxMw(e.target.value)} inputMode="decimal" placeholder="Max MW" />
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard title="Top Customers" subtitle="Click a bar to drill into requests" className="xl:col-span-2">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topCustomers} margin={{ top: 10, right: 20, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-8} height={52} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#0f766e">
                {topCustomers.map((entry) => (
                  <Cell
                    key={entry.name}
                    cursor="pointer"
                    onClick={() => setDrilldown({ type: "customer", value: entry.name, label: entry.name })}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Priority Mix" subtitle="Click a segment to drill down">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={priorityBreakdown}
                dataKey="count"
                nameKey="name"
                outerRadius={105}
                innerRadius={58}
                paddingAngle={3}
              >
                {priorityBreakdown.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={PRIORITY_COLORS[entry.name] || "#64748b"}
                    cursor="pointer"
                    onClick={() => setDrilldown({ type: "priority", value: entry.name, label: `${entry.name} priority` })}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <LegendList rows={priorityBreakdown} />
        </ChartCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard title="Plant Breakdown" subtitle="Manufacturing plant split">
          <BreakdownList
            rows={plantBreakdown}
            colors={PLANT_COLORS}
            onClick={(name) => setDrilldown({ type: "plant", value: name, label: `Plant ${name}` })}
          />
        </ChartCard>
        <ChartCard title="DCR Split" subtitle="Domestic content requirement">
          <BreakdownList
            rows={dcrBreakdown}
            colors={["#2563eb", "#f59e0b", "#64748b"]}
            onClick={(name) => setDrilldown({ type: "dcr", value: name, label: name })}
          />
        </ChartCard>
        <ChartCard title="Monthly Request Trend" subtitle="Created requests and RFQ MW">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Bar yAxisId="left" dataKey="requests" fill="#0f766e" radius={[5, 5, 0, 0]} />
              <Bar yAxisId="right" dataKey="mw" fill="#2563eb" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-col gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4 text-emerald-700" />
              Drilldown
            </CardTitle>
            <p className="mt-1 text-sm text-slate-600">
              {drilldown ? drilldown.label : "All filtered sales requests"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{drilldownRows.length} requests</Badge>
            {drilldown && (
              <Button variant="ghost" size="sm" onClick={() => setDrilldown(null)}>
                <X className="mr-2 h-4 w-4" />
                Clear Drilldown
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Plant</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>DCR</TableHead>
                  <TableHead>RFQ MW</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>QAP/BOM Source</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {drilldownRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-slate-500">
                      No sales requests match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  drilldownRows.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">{request.customerName}</TableCell>
                      <TableCell>
                        <div className="font-mono text-xs">{request.projectCode || "-"}</div>
                        <div className="text-xs text-slate-500">{request.projectLocation || "-"}</div>
                      </TableCell>
                      <TableCell>{request.moduleManufacturingPlant}</TableCell>
                      <TableCell>
                        <Badge variant={request.priority === "high" ? "destructive" : "secondary"}>
                          {request.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>{request.cellType}</TableCell>
                      <TableCell>{fmtNumber(Number(request.rfqOrderQtyMW || 0))}</TableCell>
                      <TableCell>
                        <div className="text-xs">{formatDate(request.deliveryStartDate)}</div>
                        <div className="text-xs text-slate-500">{formatDate(request.deliveryEndDate)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">QAP: {request.qapType || "-"}</div>
                        <div className="text-xs text-slate-500">BOM: {request.bomFrom || "-"}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/sales-requests?customer=${encodeURIComponent(request.customerName)}`)}
                        >
                          Open
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Document Source Drilldown" subtitle="QAP/BOM ownership">
          <BreakdownList
            rows={sourceBreakdown}
            colors={["#0f766e", "#2563eb", "#f59e0b"]}
            onClick={(name) => setDrilldown({ type: "source", value: name, label: `${name} source` })}
          />
        </ChartCard>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-emerald-700" />
              Filter Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <SummaryItem label="Customers" value={`${stats.activeCustomers}/${stats.customers}`} />
            <SummaryItem label="Requests" value={fmtNumber(stats.requests)} />
            <SummaryItem label="RFQ MW" value={fmtNumber(stats.totalMw)} />
            <SummaryItem label="Bidded MW" value={fmtNumber(stats.biddedMw)} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}> = ({ icon: Icon, label, value }) => (
  <Card className="border-slate-200 bg-white">
    <CardContent className="flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <div className="truncate text-xl font-semibold text-slate-950">{value}</div>
      </div>
    </CardContent>
  </Card>
);

const ChartCard: React.FC<{
  title: string;
  subtitle: string;
  className?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, className, children }) => (
  <Card className={className}>
    <CardHeader className="pb-2">
      <CardTitle className="text-base">{title}</CardTitle>
      <p className="text-sm text-slate-600">{subtitle}</p>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

const NativeSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}> = ({ value, onChange, children }) => (
  <select
    value={value}
    onChange={(event) => onChange(event.target.value)}
    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
  >
    {children}
  </select>
);

const DateInput: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
}> = ({ label, value, onChange }) => (
  <label className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-500">
    <span className="shrink-0">{label}</span>
    <input
      type="date"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-w-0 flex-1 bg-transparent text-slate-900 outline-none"
    />
  </label>
);

const BreakdownList: React.FC<{
  rows: { name: string; count: number }[];
  colors: string[];
  onClick: (name: string) => void;
}> = ({ rows, colors, onClick }) => {
  const total = rows.reduce((sum, row) => sum + row.count, 0) || 1;
  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-slate-500">
          No data for the current filters.
        </div>
      ) : (
        rows.map((row, index) => {
          const pct = (row.count / total) * 100;
          return (
            <button
              key={row.name}
              type="button"
              onClick={() => onClick(row.name)}
              className="w-full rounded-md border p-3 text-left transition hover:border-emerald-400 hover:bg-emerald-50/50"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-900">{row.name}</span>
                <span className="text-sm text-slate-600">{row.count}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: colors[index % colors.length] }}
                />
              </div>
            </button>
          );
        })
      )}
    </div>
  );
};

const LegendList: React.FC<{ rows: { name: string; count: number }[] }> = ({ rows }) => (
  <div className="flex flex-wrap justify-center gap-2">
    {rows.map((row) => (
      <Badge key={row.name} variant="outline" className="capitalize">
        {row.name}: {row.count}
      </Badge>
    ))}
  </div>
);

const SummaryItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-md border bg-slate-50 p-3">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="mt-1 text-lg font-semibold text-slate-950">{value}</div>
  </div>
);

export default SalesAnalyticsPage;
