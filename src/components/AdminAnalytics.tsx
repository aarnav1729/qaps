import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { QAPFormData, TurnaroundAnalytics } from "@/types/qap";
//import { calculateAverageTurnaroundTime, calculateTurnaroundTime } from '@/utils/workflowUtils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface AdminAnalyticsProps {
  qapData: QAPFormData[];
}

const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ qapData }) => {
  const [selectedPlant, setSelectedPlant] = useState<string>("all");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<string>("all");

  // Get unique plants, levels, and users from data
  const plants = useMemo(() => {
    const plantSet = new Set(qapData.map((qap) => qap.plant.toLowerCase()));
    return Array.from(plantSet).sort();
  }, [qapData]);

  const users = useMemo(() => {
    const userSet = new Set();
    qapData.forEach((qap) => {
      if (qap.submittedBy) userSet.add(qap.submittedBy);
      qap.timeline.forEach((entry) => {
        if (entry.user) userSet.add(entry.user);
      });
    });
    return Array.from(userSet).sort() as string[];
  }, [qapData]);

  // Calculate turnaround analytics
  const analytics = useMemo(() => {
    const results: TurnaroundAnalytics[] = [];

    // Overall turnaround time
    //  const overallStats = calculateAverageTurnaroundTime(qapData, {
    //  plant: selectedPlant !== 'all' ? selectedPlant : undefined,
    //  user: selectedUser !== 'all' ? selectedUser : undefined,
    // });

    //   if (overallStats.count > 0) {
    //   results.push({
    //   plant: selectedPlant !== 'all' ? selectedPlant : 'All Plants',
    // level: 0,
    // user: selectedUser !== 'all' ? selectedUser : 'All Users',
    // averageTime: overallStats.average,
    // count: overallStats.count,
    // role: 'Overall'
    //});
    //}

    // Level-specific turnaround times
    //for (let level = 2; level <= 5; level++) {
    //const levelStats = calculateAverageTurnaroundTime(qapData, {
    //plant: selectedPlant !== 'all' ? selectedPlant : undefined,
    //level: level,
    //user: selectedUser !== 'all' ? selectedUser : undefined,
    //});

    //if (levelStats.count > 0) {
    //results.push({
    //plant: selectedPlant !== 'all' ? selectedPlant : 'All Plants',
    //level: level,
    //user: selectedUser !== 'all' ? selectedUser : 'All Users',
    //averageTime: levelStats.average,
    //count: levelStats.count,
    //role: `Level ${level}`
    //});
    // }
    //}

    return results;
  }, [qapData, selectedPlant, selectedLevel, selectedUser]);

  const formatTime = (milliseconds: number): string => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    if (days > 0) {
      return `${days}d ${remainingHours}h`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      const minutes = Math.floor(milliseconds / (1000 * 60));
      return `${minutes}m`;
    }
  };

  const chartData = analytics.map((item) => ({
    name: item.role === "Overall" ? "Overall" : `Level ${item.level}`,
    averageHours: Math.round((item.averageTime / (1000 * 60 * 60)) * 100) / 100,
    count: item.count,
  }));

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Turnaround Time Analytics
        </h2>
        <p className="text-gray-600">
          Average processing times by plant, level, and user
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600 mb-2 block">
                Plant
              </label>
              <Select value={selectedPlant} onValueChange={setSelectedPlant}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plants</SelectItem>
                  {plants.map((plant) => (
                    <SelectItem key={plant} value={plant}>
                      {plant.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600 mb-2 block">
                Level
              </label>
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="2">Level 2</SelectItem>
                  <SelectItem value="3">Level 3</SelectItem>
                  <SelectItem value="4">Level 4</SelectItem>
                  <SelectItem value="5">Level 5</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600 mb-2 block">
                User
              </label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user} value={user}>
                      {user}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Average Turnaround Time by Level</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis
                  label={{ value: "Hours", angle: -90, position: "insideLeft" }}
                />
                <Tooltip
                  formatter={(value, name) => [
                    `${value} hours`,
                    "Average Time",
                  ]}
                />
                <Legend />
                <Bar dataKey="averageHours" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Analytics Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-3 text-left">
                    Plant
                  </th>
                  <th className="border border-gray-300 p-3 text-left">
                    Level/Role
                  </th>
                  <th className="border border-gray-300 p-3 text-left">User</th>
                  <th className="border border-gray-300 p-3 text-right">
                    Avg Time
                  </th>
                  <th className="border border-gray-300 p-3 text-right">
                    Count
                  </th>
                </tr>
              </thead>
              <tbody>
                {analytics.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="border border-gray-300 p-8 text-center text-gray-500"
                    >
                      No data available for the selected filters
                    </td>
                  </tr>
                ) : (
                  analytics.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="border border-gray-300 p-3">
                        <Badge variant="outline">
                          {item.plant.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="border border-gray-300 p-3">
                        <Badge
                          variant={
                            item.role === "Overall" ? "default" : "secondary"
                          }
                        >
                          {item.role}
                        </Badge>
                      </td>
                      <td className="border border-gray-300 p-3">
                        {item.user}
                      </td>
                      <td className="border border-gray-300 p-3 text-right font-mono">
                        {formatTime(item.averageTime)}
                      </td>
                      <td className="border border-gray-300 p-3 text-right">
                        {item.count}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAnalytics;
