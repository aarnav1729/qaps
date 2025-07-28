import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit, Plus, Save, X } from 'lucide-react';
import { User } from '@/contexts/AuthContext';

interface AdminPageProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
}

const AdminPage: React.FC<AdminPageProps> = ({ users, setUsers }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User>>({
    username: '',
    role: 'requestor',
    plant: ''
  });

  const handleSaveUser = () => {
    if (!editingUser.username?.trim()) {
      alert('Username is required');
      return;
    }

    const newUser: User = {
      username: editingUser.username!,
      role: editingUser.role as User['role'],
      plant: editingUser.plant
    };

    setUsers([...users, newUser]);
    setEditingUser({
      username: '',
      role: 'requestor',
      plant: ''
    });
    setIsEditing(false);
  };

  const handleEditUser = (user: User) => {
    setEditingUser({
      username: user.username,
      role: user.role,
      plant: user.plant
    });
    setIsEditing(true);
  };

  const handleDeleteUser = (userToDelete: User) => {
    if (window.confirm(`Are you sure you want to delete user ${userToDelete.username}?`)) {
      setUsers(users.filter(u => u.username !== userToDelete.username));
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingUser({
      username: '',
      role: 'requestor',
      plant: ''
    });
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Manage system users and monitor QAPs</p>
      </div>

      {isEditing && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Add User</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={editingUser.username || ''}
                  onChange={(e) => setEditingUser(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Enter username"
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select
                  value={editingUser.role || 'requestor'}
                  onValueChange={(value) => setEditingUser(prev => ({ ...prev, role: value as User['role'] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="requestor">Requestor</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="quality">Quality</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="head">Head</SelectItem>
                    <SelectItem value="technical-head">Technical Head</SelectItem>
                    <SelectItem value="plant-head">Plant Head</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="plant">Plant</Label>
                <Input
                  id="plant"
                  value={editingUser.plant || ''}
                  onChange={(e) => setEditingUser(prev => ({ ...prev, plant: e.target.value }))}
                  placeholder="e.g., P2, P4,P5"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleSaveUser}>
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>System Users ({users.length})</CardTitle>
            {!isEditing && (
              <Button onClick={() => setIsEditing(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            )}
          </div>
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
                {users.map((user) => (
                  <tr key={user.username} className="hover:bg-gray-50">
                    <td className="border border-gray-300 p-3 font-medium">
                      {user.username}
                    </td>
                    <td className="border border-gray-300 p-3">
                      <Badge variant="outline" className="capitalize">
                        {user.role.replace('-', ' ')}
                      </Badge>
                    </td>
                    <td className="border border-gray-300 p-3">
                      {user.plant ? (
                        <Badge variant="secondary">{user.plant.toUpperCase()}</Badge>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="border border-gray-300 p-3 text-center">
                      <div className="flex gap-2 justify-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditUser(user)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteUser(user)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
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
  );
};

export default AdminPage;