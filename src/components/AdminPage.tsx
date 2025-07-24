
import { QAPFormData } from '@/types/qap';

interface AdminPageProps {
  qapData: QAPFormData[];
  users: any[];
  onAddUser: (user: any) => void;
  onEditUser: (user: any) => void;
  onDeleteUser: (id: string) => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ qapData, users, onAddUser, onEditUser, onDeleteUser }) => {
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">QAPs Overview</h2>
          <p>Total QAPs: {qapData.length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Users Overview</h2>
          <p>Total Users: {users.length}</p>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
