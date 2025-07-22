
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QAPFormData, User } from '@/types/qap';
import { useAuth } from '@/contexts/AuthContext';
import { Users, BarChart3, History, Plus, Edit, Trash2, Eye, TrendingUp, PieChart } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AdminPageProps {
  qapData: QAPFormData[];
  users: User[];
  onAddUser: (user: User) => void;
  onEditUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ qapData, users, onAddUser, onEditUser, onDeleteUser }) => {
  const { user } = useAuth();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedQAPHistory, setSelectedQAPHistory] = useState<QAPFormData | null>(null);
  const [newUser, setNewUser] = useState<Partial<User>>({
    username: '',
    password: '',
    role: 'requestor',
    plant: 'p2'
  });

  // Analytics calculations
  const totalQAPs = qapData.length;
  const approvalRate = totalQAPs > 0 ? (qapData.filter(q => q.status === 'approved').length / totalQAPs * 100).toFixed(1) : '0';
  const avgProcessingTime = '2.5'; // Mock data
  const rejectionRate = totalQAPs > 0 ? (qapData.filter(q => q.status === 'rejected').length / totalQAPs * 100).toFixed(1) : '0';

  // Status distribution for pie chart
  const statusDistribution = {
    draft: qapData.filter(q => q.status === 'draft').length,
    submitted: qapData.filter(q => q.status === 'submitted').length,
    approved: qapData.filter(q => q.status === 'approved').length,
    rejected: qapData.filter(q => q.status === 'rejected').length
  };

  // Plant distribution
  const plantDistribution = {
    p2: qapData.filter(q => q.plant === 'p2').length,
    p4: qapData.filter(q => q.plant === 'p4').length
  };

  const handleAddUser = () => {
    if (newUser.username && newUser.password && newUser.role) {
      const user: User = {
        id: Date.now().toString(),
        username: newUser.username,
        password: newUser.password,
        role: newUser.role as any,
        plant: newUser.plant
      };
      onAddUser(user);
      setNewUser({ username: '', password: '', role: 'requestor', plant: 'p2' });
      setIsUserModalOpen(false);
    }
  };

  const handleEditUser = () => {
    if (selectedUser) {
      onEditUser(selectedUser);
      setSelectedUser(null);
      setIsUserModalOpen(false);
    }
  };

  const openUserModal = (user?: User) => {
    if (user) {
      setSelectedUser(user);
    } else {
      setSelectedUser(null);
      setNewUser({ username: '', password: '', role: 'requestor', plant: 'p2' });
    }
    setIsUserModalOpen(true);
  };

  const viewQAPHistory = (qap: QAPFormData) => {
    setSelectedQAPHistory(qap);
    setIsHistoryModalOpen(true);
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Manage users, view analytics, and monitor QAP processes</p>
      </div>

      <Tabs defaultValue="analytics" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            User Management
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            QAP History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Total QAPs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{totalQAPs}</div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Approval Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{approvalRate}%</div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Avg Processing Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">{avgProcessingTime} days</div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Rejection Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">{rejectionRate}%</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5" />
                  Status Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(statusDistribution).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          status === 'approved' ? 'default' : 
                          status === 'rejected' ? 'destructive' : 
                          status === 'submitted' ? 'secondary' : 'outline'
                        } className="capitalize">
                          {status}
                        </Badge>
                      </div>
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Plant Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(plantDistribution).map(([plant, count]) => (
                    <div key={plant} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-blue-100 text-blue-800">
                          {plant.toUpperCase()}
                        </Badge>
                      </div>
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <div className="mb-4">
            <Button onClick={() => openUserModal()} className="bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4 mr-2" />
              Add New User
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 p-3 text-left">Username</th>
                      <th className="border border-gray-300 p-3 text-left">Role</th>
                      <th className="border border-gray-300 p-3 text-left">Plant</th>
                      <th className="border border-gray-300 p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((userItem) => (
                      <tr key={userItem.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-3">{userItem.username}</td>
                        <td className="border border-gray-300 p-3">
                          <Badge variant="outline" className="capitalize">
                            {userItem.role}
                          </Badge>
                        </td>
                        <td className="border border-gray-300 p-3">
                          {userItem.plant ? (
                            <Badge variant="outline" className="bg-blue-100 text-blue-800">
                              {userItem.plant.toUpperCase()}
                            </Badge>
                          ) : '-'}
                        </td>
                        <td className="border border-gray-300 p-3">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openUserModal(userItem)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDeleteUser(userItem.id)}
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
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>QAP History & Audit Trail</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 p-3 text-left">Customer</th>
                      <th className="border border-gray-300 p-3 text-left">Project</th>
                      <th className="border border-gray-300 p-3 text-left">Plant</th>
                      <th className="border border-gray-300 p-3 text-left">Status</th>
                      <th className="border border-gray-300 p-3 text-left">Submitted By</th>
                      <th className="border border-gray-300 p-3 text-left">Submitted At</th>
                      <th className="border border-gray-300 p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qapData.map((qap) => (
                      <tr key={qap.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-3">{qap.customerName}</td>
                        <td className="border border-gray-300 p-3">{qap.projectName}</td>
                        <td className="border border-gray-300 p-3">
                          <Badge variant="outline" className="bg-blue-100 text-blue-800">
                            {qap.plant.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="border border-gray-300 p-3">
                          <Badge variant={
                            qap.status === 'approved' ? 'default' : 
                            qap.status === 'rejected' ? 'destructive' : 
                            qap.status === 'submitted' ? 'secondary' : 'outline'
                          } className="capitalize">
                            {qap.status}
                          </Badge>
                        </td>
                        <td className="border border-gray-300 p-3">{qap.submittedBy || '-'}</td>
                        <td className="border border-gray-300 p-3">
                          {qap.submittedAt ? new Date(qap.submittedAt).toLocaleDateString() : '-'}
                        </td>
                        <td className="border border-gray-300 p-3">
                          <div className="flex items-center justify-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => viewQAPHistory(qap)}
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="h-4 w-4" />
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
        </TabsContent>
      </Tabs>

      {/* User Modal */}
      <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedUser ? 'Edit User' : 'Add New User'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Username</label>
              <Input
                value={selectedUser ? selectedUser.username : newUser.username}
                onChange={(e) => {
                  if (selectedUser) {
                    setSelectedUser({ ...selectedUser, username: e.target.value });
                  } else {
                    setNewUser({ ...newUser, username: e.target.value });
                  }
                }}
                placeholder="Enter username"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <Input
                type="password"
                value={selectedUser ? selectedUser.password : newUser.password}
                onChange={(e) => {
                  if (selectedUser) {
                    setSelectedUser({ ...selectedUser, password: e.target.value });
                  } else {
                    setNewUser({ ...newUser, password: e.target.value });
                  }
                }}
                placeholder="Enter password"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <Select
                value={selectedUser ? selectedUser.role : newUser.role}
                onValueChange={(value) => {
                  if (selectedUser) {
                    setSelectedUser({ ...selectedUser, role: value as any });
                  } else {
                    setNewUser({ ...newUser, role: value as any });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="requestor">Requestor</SelectItem>
                  <SelectItem value="approver-p2">Approver P2</SelectItem>
                  <SelectItem value="approver-p4">Approver P4</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Plant</label>
              <Select
                value={selectedUser ? selectedUser.plant : newUser.plant}
                onValueChange={(value) => {
                  if (selectedUser) {
                    setSelectedUser({ ...selectedUser, plant: value });
                  } else {
                    setNewUser({ ...newUser, plant: value });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="p2">P2</SelectItem>
                  <SelectItem value="p4">P4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setIsUserModalOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={selectedUser ? handleEditUser : handleAddUser} className="flex-1">
                {selectedUser ? 'Update' : 'Add'} User
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      {selectedQAPHistory && (
        <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>QAP History - {selectedQAPHistory.customerName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Project Name</label>
                  <p className="font-semibold">{selectedQAPHistory.projectName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Status</label>
                  <Badge variant="outline" className="capitalize">
                    {selectedQAPHistory.status}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Submitted By</label>
                  <p className="font-semibold">{selectedQAPHistory.submittedBy || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Submitted At</label>
                  <p className="font-semibold">
                    {selectedQAPHistory.submittedAt ? new Date(selectedQAPHistory.submittedAt).toLocaleString() : '-'}
                  </p>
                </div>
              </div>
              {selectedQAPHistory.feedback && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Feedback</label>
                  <p className="mt-1 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    {selectedQAPHistory.feedback}
                  </p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-600">QAP Items</label>
                <p className="font-semibold">{selectedQAPHistory.qaps.length} specifications</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default AdminPage;
