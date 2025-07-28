
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QAPFormData } from '@/types/qap';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Clock, TrendingUp, Users, FileText, CheckCircle, AlertCircle, Building, User } from 'lucide-react';

interface AdminAnalyticsProps {
  qapData: QAPFormData[];
}

const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ qapData }) => {
  const [selectedPlant, setSelectedPlant] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('30');

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    return `${hours}h`;
  };

  const analytics = useMemo(() => {
    const now = new Date();
    const timeRangeMs = parseInt(timeRange) * 24 * 60 * 60 * 1000;
    const filteredData = qapData.filter(qap => {
      const createdAt = qap.createdAt || new Date();
      const isInTimeRange = (now.getTime() - createdAt.getTime()) <= timeRangeMs;
      
      const matchesPlant = selectedPlant === 'all' || qap.plant.toLowerCase() === selectedPlant;
      
      return isInTimeRange && matchesPlant;
    });

    // Status distribution
    const statusCounts = filteredData.reduce((acc, qap) => {
      acc[qap.status] = (acc[qap.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Plant distribution
    const plantCounts = filteredData.reduce((acc, qap) => {
      const plant = qap.plant.toUpperCase();
      acc[plant] = (acc[plant] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Turnaround time by plant
    const turnaroundByPlant = Object.keys(plantCounts).map(plant => {
      const plantQAPs = filteredData.filter(qap => qap.plant.toUpperCase() === plant && qap.status === 'approved');
      const totalTime = plantQAPs.reduce((sum, qap) => {
        if (qap.submittedAt && qap.approvedAt) {
          return sum + (qap.approvedAt.getTime() - qap.submittedAt.getTime());
        }
        return sum;
      }, 0);
      
      return {
        plant,
        averageTime: plantQAPs.length > 0 ? totalTime / plantQAPs.length : 0,
        count: plantQAPs.length
      };
    });

    // Level-wise turnaround time
    const levelTurnaround = [1, 2, 3, 4, 5].map(level => {
      const levelQAPs = filteredData.filter(qap => qap.levelStartTimes?.[level] && qap.levelEndTimes?.[level]);
      const totalTime = levelQAPs.reduce((sum, qap) => {
        const start = qap.levelStartTimes?.[level];
        const end = qap.levelEndTimes?.[level];
        if (start && end) {
          return sum + (end.getTime() - start.getTime());
        }
        return sum;
      }, 0);
      
      return {
        level: `Level ${level}`,
        averageTime: levelQAPs.length > 0 ? totalTime / levelQAPs.length : 0,
        count: levelQAPs.length
      };
    });

    // User performance (for approved QAPs)
    const userPerformance = filteredData
      .filter(qap => qap.status === 'approved' && qap.submittedBy)
      .reduce((acc, qap) => {
        const user = qap.submittedBy!;
        if (!acc[user]) {
          acc[user] = { count: 0, totalTime: 0 };
        }
        acc[user].count++;
        if (qap.submittedAt && qap.approvedAt) {
          acc[user].totalTime += (qap.approvedAt.getTime() - qap.submittedAt.getTime());
        }
        return acc;
      }, {} as Record<string, { count: number; totalTime: number }>);

    // Expired QAPs
    const expiredQAPs = filteredData.filter(qap => {
      if (qap.currentLevel === 2 && qap.submittedAt) {
        const fourDaysMs = 4 * 24 * 60 * 60 * 1000;
        return (Date.now() - qap.submittedAt.getTime()) > fourDaysMs;
      }
      return false;
    });

    return {
      statusCounts,
      plantCounts,
      turnaroundByPlant,
      levelTurnaround,
      userPerformance,
      expiredQAPs,
      totalQAPs: filteredData.length,
      approvedQAPs: filteredData.filter(qap => qap.status === 'approved').length,
      pendingQAPs: filteredData.filter(qap => !['approved', 'rejected'].includes(qap.status)).length
    };
  }, [qapData, selectedPlant, selectedLevel, timeRange]);

  const statusColors = {
    draft: '#6B7280',
    submitted: '#F59E0B',
    'level-2': '#3B82F6',
    'level-3': '#8B5CF6',
    'level-4': '#EC4899',
    'final-comments': '#F97316',
    'level-3-final': '#8B5CF6',
    'level-4-final': '#EC4899',
    'level-5': '#10B981',
    approved: '#059669',
    rejected: '#EF4444'
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Analytics</h1>
        <p className="text-gray-600">Comprehensive QAP performance analytics and insights</p>
      </div>

      {/* Filter Controls */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select value={selectedPlant} onValueChange={setSelectedPlant}>
              <SelectTrigger>
                <Building className="mr-2 h-4 w-4" />
                <SelectValue placeholder="All Plants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plants</SelectItem>
                <SelectItem value="p2">P2</SelectItem>
                <SelectItem value="p4">P4</SelectItem>
                <SelectItem value="p5">P5</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={selectedLevel} onValueChange={setSelectedLevel}>
              <SelectTrigger>
                <SelectValue placeholder="All Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="2">Level 2</SelectItem>
                <SelectItem value="3">Level 3</SelectItem>
                <SelectItem value="4">Level 4</SelectItem>
                <SelectItem value="5">Level 5</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger>
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total QAPs</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.totalQAPs}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.approvedQAPs}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-12 h-12 bg-orange-100 rounded-full">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.pendingQAPs}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Expired</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.expiredQAPs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={Object.entries(analytics.statusCounts).map(([status, count]) => ({
                    name: status.replace('-', ' '),
                    value: count,
                    fill: statusColors[status as keyof typeof statusColors]
                  }))}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {Object.entries(analytics.statusCounts).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Plant Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Plant Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={Object.entries(analytics.plantCounts).map(([plant, count]) => ({ plant, count }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="plant" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Turnaround Time Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Turnaround Time by Plant</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.turnaroundByPlant}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="plant" />
                <YAxis tickFormatter={formatDuration} />
                <Tooltip formatter={(value) => [formatDuration(value as number), 'Average Time']} />
                <Bar dataKey="averageTime" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Level-wise Turnaround Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.levelTurnaround}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="level" />
                <YAxis tickFormatter={formatDuration} />
                <Tooltip formatter={(value) => [formatDuration(value as number), 'Average Time']} />
                <Line type="monotone" dataKey="averageTime" stroke="#8B5CF6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* User Performance */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>User Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-3 text-left">User</th>
                  <th className="border border-gray-300 p-3 text-left">QAPs Submitted</th>
                  <th className="border border-gray-300 p-3 text-left">Avg. Processing Time</th>
                  <th className="border border-gray-300 p-3 text-left">Performance</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(analytics.userPerformance).map(([user, data]) => (
                  <tr key={user} className="hover:bg-gray-50">
                    <td className="border border-gray-300 p-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-500" />
                        {user}
                      </div>
                    </td>
                    <td className="border border-gray-300 p-3">{data.count}</td>
                    <td className="border border-gray-300 p-3">
                      {data.count > 0 ? formatDuration(data.totalTime / data.count) : 'N/A'}
                    </td>
                    <td className="border border-gray-300 p-3">
                      <Badge variant={data.count > 5 ? 'default' : 'secondary'}>
                        {data.count > 5 ? 'High' : 'Medium'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Expired QAPs */}
      {analytics.expiredQAPs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Expired QAPs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-red-50">
                    <th className="border border-gray-300 p-3 text-left">Customer</th>
                    <th className="border border-gray-300 p-3 text-left">Project</th>
                    <th className="border border-gray-300 p-3 text-left">Plant</th>
                    <th className="border border-gray-300 p-3 text-left">Submitted</th>
                    <th className="border border-gray-300 p-3 text-left">Days Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.expiredQAPs.map(qap => (
                    <tr key={qap.id} className="hover:bg-red-50">
                      <td className="border border-gray-300 p-3">{qap.customerName}</td>
                      <td className="border border-gray-300 p-3">{qap.projectName}</td>
                      <td className="border border-gray-300 p-3">
                        <Badge variant="outline">{qap.plant.toUpperCase()}</Badge>
                      </td>
                      <td className="border border-gray-300 p-3">
                        {qap.submittedAt?.toLocaleDateString()}
                      </td>
                      <td className="border border-gray-300 p-3 text-red-600">
                        {qap.submittedAt ? Math.floor((Date.now() - qap.submittedAt.getTime()) / (1000 * 60 * 60 * 24)) - 4 : 'N/A'} days
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminAnalytics;
