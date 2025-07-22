
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer } from 'recharts';
import { QAPFormData } from '@/types/qap';
import { useAuth } from '@/contexts/AuthContext';
import { TrendingUp, TrendingDown, Activity, Users, FileText, CheckCircle } from 'lucide-react';

interface AnalyticsPageProps {
  qapData: QAPFormData[];
}

const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ qapData }) => {
  const { user } = useAuth();
  const [selectedPlant, setSelectedPlant] = useState<string>('all');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Filter data based on user role and selections
  const filteredData = useMemo(() => {
    let filtered = qapData;

    // Filter by user role
    if (user?.role !== 'admin') {
      if (user?.plant) {
        filtered = filtered.filter(qap => qap.plant === user.plant?.toLowerCase());
      }
    }

    // Apply additional filters
    if (selectedPlant !== 'all') {
      filtered = filtered.filter(qap => qap.plant === selectedPlant);
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(qap => qap.status === selectedStatus);
    }

    // Filter by timeframe (simplified for demo)
    if (selectedTimeframe !== 'all') {
      const now = new Date();
      const days = selectedTimeframe === '7d' ? 7 : selectedTimeframe === '30d' ? 30 : 90;
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(qap => qap.submittedAt && new Date(qap.submittedAt) >= cutoff);
    }

    return filtered;
  }, [qapData, user, selectedPlant, selectedTimeframe, selectedStatus]);

  // Chart configurations
  const chartConfig = {
    submitted: { label: "Submitted", color: "#fbbf24" },
    approved: { label: "Approved", color: "#10b981" },
    rejected: { label: "Rejected", color: "#ef4444" },
    draft: { label: "Draft", color: "#6b7280" },
  };

  // Data transformations for charts
  const statusData = useMemo(() => {
    const statusCounts = filteredData.reduce((acc, qap) => {
      acc[qap.status] = (acc[qap.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(statusCounts).map(([status, count]) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1),
      count,
      fill: chartConfig[status as keyof typeof chartConfig]?.color || '#6b7280'
    }));
  }, [filteredData]);

  const plantData = useMemo(() => {
    const plantCounts = filteredData.reduce((acc, qap) => {
      const plant = qap.plant.toUpperCase();
      acc[plant] = (acc[plant] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(plantCounts).map(([plant, count]) => ({
      plant,
      count,
      approved: filteredData.filter(q => q.plant === plant.toLowerCase() && q.status === 'approved').length,
      rejected: filteredData.filter(q => q.plant === plant.toLowerCase() && q.status === 'rejected').length,
      submitted: filteredData.filter(q => q.plant === plant.toLowerCase() && q.status === 'submitted').length,
    }));
  }, [filteredData]);

  const trendData = useMemo(() => {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toISOString().split('T')[0];
    });

    return last30Days.map(date => {
      const dayQAPs = filteredData.filter(qap => 
        qap.submittedAt && new Date(qap.submittedAt).toISOString().split('T')[0] === date
      );

      return {
        date,
        submitted: dayQAPs.filter(q => q.status === 'submitted').length,
        approved: dayQAPs.filter(q => q.status === 'approved').length,
        rejected: dayQAPs.filter(q => q.status === 'rejected').length,
      };
    });
  }, [filteredData]);

  const qualityData = useMemo(() => {
    if (selectedPlant === 'all' && selectedStatus === 'all') {
      return filteredData.flatMap(qap => qap.qaps).reduce((acc, spec) => {
        if (spec.match) {
          acc[spec.match] = (acc[spec.match] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);
    }

    // Filtered quality data based on selections
    return filteredData
      .filter(qap => selectedPlant === 'all' || qap.plant === selectedPlant)
      .filter(qap => selectedStatus === 'all' || qap.status === selectedStatus)
      .flatMap(qap => qap.qaps)
      .reduce((acc, spec) => {
        if (spec.match) {
          acc[spec.match] = (acc[spec.match] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);
  }, [filteredData, selectedPlant, selectedStatus]);

  const qualityChartData = Object.entries(qualityData).map(([match, count]) => ({
    match: match === 'yes' ? 'Pass' : 'Fail',
    count,
    fill: match === 'yes' ? '#10b981' : '#ef4444'
  }));

  // Summary statistics
  const stats = {
    total: filteredData.length,
    approved: filteredData.filter(q => q.status === 'approved').length,
    rejected: filteredData.filter(q => q.status === 'rejected').length,
    pending: filteredData.filter(q => q.status === 'submitted').length,
    approvalRate: filteredData.length > 0 ? 
      Math.round((filteredData.filter(q => q.status === 'approved').length / filteredData.length) * 100) : 0,
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Analytics Dashboard</h1>
        <p className="text-gray-600">Quality Assurance Plan performance metrics and insights</p>
      </div>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        {user?.role === 'admin' && (
          <Select value={selectedPlant} onValueChange={setSelectedPlant}>
            <SelectTrigger>
              <SelectValue placeholder="Select Plant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Plants</SelectItem>
              <SelectItem value="p2">P2 Plant</SelectItem>
              <SelectItem value="p4">P4 Plant</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Select Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
          <SelectTrigger>
            <SelectValue placeholder="Select Timeframe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-gray-600 flex items-center">
          Showing {filteredData.length} QAPs
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total QAPs</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-2xl font-bold">{stats.approved}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Rejected</p>
                <p className="text-2xl font-bold">{stats.rejected}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Approval Rate</p>
                <p className="text-2xl font-bold">{stats.approvalRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>QAP Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-64">
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
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Plant Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Plant Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-64">
              <BarChart data={plantData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="plant" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="approved" fill="#10b981" name="Approved" />
                <Bar dataKey="rejected" fill="#ef4444" name="Rejected" />
                <Bar dataKey="submitted" fill="#fbbf24" name="Submitted" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trends */}
        <Card>
          <CardHeader>
            <CardTitle>30-Day Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-64">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="submitted" stroke="#fbbf24" name="Submitted" />
                <Line type="monotone" dataKey="approved" stroke="#10b981" name="Approved" />
                <Line type="monotone" dataKey="rejected" stroke="#ef4444" name="Rejected" />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Quality Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Quality Pass/Fail Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-64">
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
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticsPage;
