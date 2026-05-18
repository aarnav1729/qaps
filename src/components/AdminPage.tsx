import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { QAPFormData, User } from "@/types/qap";
import { derivePersonTatRecords } from "@/lib/qapAnalytics";
import { formatDurationMs } from "@/lib/qapAudit";
import { ADMIN_ASSIGNABLE_ROLES, formatRoleLabel } from "@/lib/roles";
import {
  Plus,
  Edit,
  Trash2,
  Users,
  FileText,
  CheckCircle,
  Clock,
  Download,
} from "lucide-react";

const API = window.location.origin;

interface AdminPageProps {
  qapData: QAPFormData[];
  users: User[];
  onAddUser: (user: User) => void;
  onEditUser: (user: User) => void;
  onDeleteUser: (id: string) => void;
}

const AdminPage: React.FC<AdminPageProps> = ({
  qapData,
  users,
  onAddUser,
  onEditUser,
  onDeleteUser,
}) => {
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState<Partial<User>>({
    username: "",
    password: "",
    role: "level-1-reviewer",
    plant: "",
  });

  const { data: apiUsers = [] } = useQuery<User[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const r = await fetch(`${API}/api/users`, { credentials: "include" });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 1000 * 60,
  });

  const visibleUsers = apiUsers.length ? apiUsers : Array.isArray(users) ? users : [];
  const safeQaps = Array.isArray(qapData) ? qapData : [];
  const tatRecords = useMemo(
    () => safeQaps.flatMap((qap) => derivePersonTatRecords(qap)),
    [safeQaps]
  );
  const handleAddUser = () => {
    if (newUser.username && newUser.password && newUser.role) {
      const user: User = {
        id: Date.now().toString(),
        username: newUser.username,
        password: newUser.password,
        role: newUser.role as User["role"],
        plant: newUser.plant,
      };
      onAddUser(user);
      setNewUser({
        username: "",
        password: "",
        role: "level-1-reviewer",
        plant: "",
      });
      setIsUserModalOpen(false);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setNewUser(user);
    setIsUserModalOpen(true);
  };

  const handleUpdateUser = () => {
    if (editingUser && newUser.username && newUser.password && newUser.role) {
      const updatedUser: User = {
        ...editingUser,
        username: newUser.username,
        password: newUser.password,
        role: newUser.role as User["role"],
        plant: newUser.plant,
      };
      onEditUser(updatedUser);
      setEditingUser(null);
      setNewUser({
        username: "",
        password: "",
        role: "level-1-reviewer",
        plant: "",
      });
      setIsUserModalOpen(false);
    }
  };

  const closeModal = () => {
    setIsUserModalOpen(false);
    setEditingUser(null);
    setNewUser({
      username: "",
      password: "",
      role: "level-1-reviewer",
      plant: "",
    });
  };

  const qapStats = {
    total: safeQaps.length,
    draft: safeQaps.filter((q) => q.status === "draft").length,
    submitted: safeQaps.filter(
      (q) => !["draft", "approved", "rejected"].includes(q.status)
    ).length,
    approved: safeQaps.filter((q) => q.status === "approved").length,
    rejected: safeQaps.filter((q) => q.status === "rejected").length,
  };

  const userStats = {
    total: visibleUsers.length,
    requestors: visibleUsers.filter((u) => u.role === "requestor").length,
    reviewers: visibleUsers.filter((u) =>
      ["level-1-reviewer", "production", "quality", "technical"].includes(
        u.role
      )
    ).length,
    heads: visibleUsers.filter((u) =>
      ["head", "technical-head", "plant-head"].includes(u.role)
    ).length,
    admins: visibleUsers.filter((u) => u.role === "admin").length,
  };

  const downloadCsv = (filename: string, rows: Record<string, unknown>[]) => {
    const columns = Object.keys(rows[0] || { message: "No data" });
    const escape = (value: unknown) => {
      const text = value === null || value === undefined ? "" : String(value);
      return `"${text.replace(/"/g, '""')}"`;
    };
    const csv = [
      columns.join(","),
      ...(rows.length ? rows : [{ message: "No data" }]).map((row) =>
        columns.map((column) => escape(row[column])).join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadTatAverages = () => {
    const grouped = new Map<string, typeof tatRecords>();
    tatRecords.forEach((record) => {
      const key = `${record.stageLabel}||${record.person}||${record.role}`;
      grouped.set(key, [...(grouped.get(key) || []), record]);
    });

    const rows = Array.from(grouped.entries()).map(([key, records]) => {
      const [stage, user, role] = key.split("||");
      const values = records.map((record) => record.tatMs).filter((v) => v >= 0);
      const averageMs = values.length
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : 0;
      return {
        stage,
        user,
        role,
        qap_count: new Set(records.map((record) => record.qapId)).size,
        response_count: records.length,
        average_tat_days: (averageMs / 86400000).toFixed(2),
        average_tat: formatDurationMs(averageMs),
      };
    });

    downloadCsv("qap-tat-averages-by-stage-user.csv", rows);
  };

  const downloadTatDetails = () => {
    const rows = tatRecords.map((record) => ({
      qap_ref: record.ref,
      customer: record.customerName,
      project: record.projectName,
      plant: record.plant,
      stage: record.stageLabel,
      user: record.person,
      role: record.role,
      started_at: record.startedAt ? new Date(record.startedAt).toLocaleString() : "",
      responded_at: record.respondedAt
        ? new Date(record.respondedAt).toLocaleString()
        : "",
      tat_days: (record.tatMs / 86400000).toFixed(2),
      tat: record.tatLabel,
      comments_count: record.commentCount,
      current_qap_status: record.status,
    }));

    downloadCsv("qap-tat-detail-by-qap-stage-user.csv", rows);
  };
  return (
    <div className="container mx-auto px-4 py-6">
      <div>
        <div className="min-w-0">
          <div className="mb-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Admin Dashboard
                </h1>
                <p className="text-gray-600">Manage users and monitor QAP system</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={downloadTatAverages}>
                  <Download className="mr-2 h-4 w-4" />
                  TAT Averages
                </Button>
                <Button variant="outline" onClick={downloadTatDetails}>
                  <Download className="mr-2 h-4 w-4" />
                  TAT Details
                </Button>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total QAPs</p>
                    <p className="text-2xl font-bold">{qapStats.total}</p>
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
                    <p className="text-2xl font-bold">{qapStats.approved}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">In Review</p>
                    <p className="text-2xl font-bold">{qapStats.submitted}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Users</p>
                    <p className="text-2xl font-bold">{userStats.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* User Management */}
          <div className="mb-6">
            <Card>
              <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>User Management</CardTitle>
            <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setIsUserModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingUser ? "Edit User" : "Add New User"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Username
                    </label>
                    <Input
                      value={newUser.username || ""}
                      onChange={(e) =>
                        setNewUser((prev) => ({
                          ...prev,
                          username: e.target.value,
                        }))
                      }
                      placeholder="Enter username"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Password
                    </label>
                    <Input
                      type="password"
                      value={newUser.password || ""}
                      onChange={(e) =>
                        setNewUser((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                      placeholder="Enter password"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Role
                    </label>
                    <Select
                      value={newUser.role || "level-1-reviewer"}
                      onValueChange={(value) =>
                        setNewUser((prev) => ({
                          ...prev,
                          role: value as User["role"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ADMIN_ASSIGNABLE_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {formatRoleLabel(role)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Plant (optional)
                    </label>
                    <Input
                      value={newUser.plant || ""}
                      onChange={(e) =>
                        setNewUser((prev) => ({
                          ...prev,
                          plant: e.target.value,
                        }))
                      }
                      placeholder="e.g., p2, p4, p5"
                    />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={editingUser ? handleUpdateUser : handleAddUser}
                      className="flex-1"
                    >
                      {editingUser ? "Update User" : "Add User"}
                    </Button>
                    <Button variant="outline" onClick={closeModal}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
              </CardHeader>
              <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="p-3 text-left font-semibold">Username</th>
                  <th className="p-3 text-left font-semibold">Role</th>
                  <th className="p-3 text-left font-semibold">Plant</th>
                  <th className="p-3 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{user.username}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="capitalize">
                        {formatRoleLabel(user.role)}
                      </Badge>
                    </td>
                    <td className="p-3">{user.plant || "-"}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteUser(user.id)}
                          className="h-8 w-8 p-0 text-red-600 hover:bg-red-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent QAPs */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Recent QAPs</CardTitle>
              </CardHeader>
              <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="p-3 text-left font-semibold">Customer</th>
                  <th className="p-3 text-left font-semibold">Project</th>
                  <th className="p-3 text-left font-semibold">Plant</th>
                  <th className="p-3 text-left font-semibold">Status</th>
                  <th className="p-3 text-left font-semibold">Items</th>
                  <th className="p-3 text-left font-semibold">Submitted By</th>
                  <th className="p-3 text-left font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {safeQaps.slice(0, 10).map((qap) => {
                  const status = String(qap.status || "draft");
                  const specs = Array.isArray((qap as any).qaps) ? (qap as any).qaps : [];
                  const plant = String((qap as any).plant || "-");
                  return (
                  <tr key={qap.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{qap.customerName}</td>
                    <td className="p-3">{qap.projectName}</td>
                    <td className="p-3">
                      <Badge variant="outline">{plant.toUpperCase()}</Badge>
                    </td>
                    <td className="p-3">
                      <Badge
                        className={`capitalize ${
                          status === "approved"
                            ? "bg-green-100 text-green-800"
                            : status === "rejected"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {status.replace("-", " ")}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="text-xs">
                        <span className="text-green-600">
                          ✓ {specs.filter((q: any) => q.match === "yes").length}
                        </span>
                        {" / "}
                        <span className="text-red-600">
                          ✗ {specs.filter((q: any) => q.match === "no").length}
                        </span>
                      </div>
                    </td>
                    <td className="p-3">{qap.submittedBy || "-"}</td>
                    <td className="p-3 text-sm text-gray-600">
                      {qap.submittedAt
                        ? new Date(qap.submittedAt).toLocaleDateString()
                        : "-"}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
              </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminPage;
