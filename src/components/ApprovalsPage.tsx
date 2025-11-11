import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { QAPFormData } from "@/types/qap";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, CheckCircle, XCircle, Search, Filter } from "lucide-react";

interface ApprovalsPageProps {
  qapData: QAPFormData[];
  onApprove: (id: string, feedback?: string) => void;
  onReject: (id: string, feedback: string) => void;
  onView: (qap: QAPFormData) => void;
}

const ApprovalsPage: React.FC<ApprovalsPageProps> = ({
  qapData,
  onApprove,
  onReject,
  onView,
}) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [feedback, setFeedback] = useState<string>("");

  const filteredQAPs = useMemo(() => {
    return qapData.filter((qap) => {
      // Filter by search term
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch =
          qap.customerName.toLowerCase().includes(searchLower) ||
          qap.projectName.toLowerCase().includes(searchLower) ||
          qap.productType.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }
      // Filter by status
      if (filterStatus === "approved") return qap.status === "approved";
      if (filterStatus === "pending") return qap.status === "level-5";
      if (filterStatus === "rejected") return qap.status === "rejected";
      return ["approved", "rejected", "level-5"].includes(qap.status);
    });
  }, [qapData, searchTerm, filterStatus]);

  const getStatusBadge = (status: string) => {
    const classes = {
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
      "level-5": "bg-yellow-100 text-yellow-800",
    } as const;
    const label = status === "level-5" ? "Pending Approval" : status;
    return (
      <Badge
        className={`${
          classes[status as keyof typeof classes] ?? "bg-gray-100 text-gray-800"
        } capitalize`}
      >
        {label}
      </Badge>
    );
  };

  const stats = {
    total: filteredQAPs.length,
    approved: filteredQAPs.filter((q) => q.status === "approved").length,
    pending: filteredQAPs.filter((q) => q.status === "level-5").length,
    rejected: filteredQAPs.filter((q) => q.status === "rejected").length,
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Approvals Dashboard
        </h1>
        <p className="text-gray-600">Review and manage QAP approvals</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
              <XCircle className="h-5 w-5 text-red-500" />
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
              <Eye className="h-5 w-5 text-yellow-500" />
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
              <Filter className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search customer, project..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={filterStatus}
            onValueChange={(value) => setFilterStatus(value)}
          >
            <SelectTrigger className="w-full flex items-center">
              <Filter className="w-4 h-4 mr-2 text-gray-600" />
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-sm text-gray-600 flex items-center">
            Showing {filteredQAPs.length} QAPs
          </div>
        </div>
      </div>

      {/* QAPs Table */}
      <Card>
        <CardHeader>
          <CardTitle>QAP Approvals</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredQAPs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No QAPs found matching your criteria
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="p-3 text-left font-semibold">Customer</th>
                    <th className="p-3 text-left font-semibold">Project</th>
                    <th className="p-3 text-left font-semibold">Plant</th>
                    <th className="p-3 text-left font-semibold">
                      Product Type
                    </th>
                    <th className="p-3 text-left font-semibold">Quantity</th>
                    <th className="p-3 text-left font-semibold">Items</th>
                    <th className="p-3 text-left font-semibold">Status</th>
                    <th className="p-3 text-left font-semibold">Submitted</th>
                    <th className="p-3 text-center font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQAPs.map((qap) => {
                    const allSpecs = [...qap.specs.mqp, ...qap.specs.visual];
                    const matchedCount = allSpecs.filter(
                      (item) => item.match === "yes"
                    ).length;
                    const unmatchedCount = allSpecs.filter(
                      (item) => item.match === "no"
                    ).length;
                    return (
                      <tr key={qap.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{qap.customerName}</td>
                        <td className="p-3">{qap.projectName}</td>
                        <td className="p-3">
                          <Badge variant="outline">
                            {qap.plant.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="p-3">{qap.productType}</td>
                        <td className="p-3">
                          {qap.orderQuantity.toLocaleString()}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col text-xs">
                            <span className="text-green-600">
                              ✓ {matchedCount} matched
                            </span>
                            <span className="text-red-600">
                              ✗ {unmatchedCount} unmatched
                            </span>
                            <span className="text-gray-500">
                              Total: {allSpecs.length}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">{getStatusBadge(qap.status)}</td>
                        <td className="p-3 text-sm text-gray-600">
                          {qap.submittedAt
                            ? new Date(qap.submittedAt).toLocaleDateString()
                            : "-"}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onView(qap)}
                              className="h-8 w-8 p-0"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {qap.status === "level-5" &&
                              user?.role === "plant-head" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onApprove(qap.id)}
                                    className="h-8 w-8 p-0 text-green-600 hover:bg-green-100"
                                    title="Approve"
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      onReject(
                                        qap.id,
                                        feedback || "Rejected by Plant Head"
                                      )
                                    }
                                    className="h-8 w-8 p-0 text-red-600 hover:bg-red-100"
                                    title="Reject"
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ApprovalsPage;
