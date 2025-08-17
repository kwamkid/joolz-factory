// src/app/(protected)/users/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  Users, UserPlus, Search, MoreVertical, Edit, Trash2, 
  Shield, UserCheck, UserX, MessageCircle, Mail,
  ChevronDown, Filter
} from 'lucide-react';
import toast from 'react-hot-toast';

interface UserData {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'operation';
  lineId?: string;
  pictureUrl?: string;
  createdAt: Date;
  lastLogin?: Date;
  status?: 'active' | 'inactive';
}

export default function UsersPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showDropdown, setShowDropdown] = useState<string | null>(null);

  // Check admin permission
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      toast.error('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
      router.push('/dashboard');
    }
  }, [currentUser, router]);

  // Fetch users
  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter users
  useEffect(() => {
    let filtered = users;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(user => 
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    setFilteredUsers(filtered);
  }, [searchQuery, roleFilter, users]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData: UserData[] = [];
      
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        usersData.push({
          id: doc.id,
          email: data.email || `${doc.id}@line.user`,
          name: data.name,
          role: data.role,
          lineId: data.lineId,
          pictureUrl: data.pictureUrl,
          createdAt: data.createdAt?.toDate() || new Date(),
          lastLogin: data.lastLogin?.toDate(),
          status: data.status || 'active'
        });
      });

      // Sort by created date
      usersData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'manager' | 'operation') => {
    try {
      // ป้องกันการเปลี่ยน role ตัวเอง
      if (userId === currentUser?.uid) {
        toast.error('ไม่สามารถเปลี่ยน role ของตัวเองได้');
        return;
      }

      await updateDoc(doc(db, 'users', userId), {
        role: newRole,
        updatedAt: new Date()
      });

      toast.success('อัพเดท role สำเร็จ');
      fetchUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('เกิดข้อผิดพลาดในการอัพเดท role');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    // ป้องกันการลบตัวเอง
    if (userId === currentUser?.uid) {
      toast.error('ไม่สามารถลบบัญชีของตัวเองได้');
      return;
    }

    if (!confirm('ยืนยันการลบผู้ใช้งานนี้?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', userId));
      toast.success('ลบผู้ใช้งานสำเร็จ');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('เกิดข้อผิดพลาดในการลบผู้ใช้งาน');
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-900/30 text-red-400 rounded-full">
            <Shield className="h-3 w-3" />
            ผู้ดูแลระบบ
          </span>
        );
      case 'manager':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-900/30 text-blue-400 rounded-full">
            <UserCheck className="h-3 w-3" />
            ผู้จัดการ
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-900/30 text-gray-400 rounded-full">
            <Users className="h-3 w-3" />
            พนักงาน
          </span>
        );
    }
  };

  const getLoginTypeBadge = (user: UserData) => {
    // ตรวจสอบว่าเป็น LINE User หรือไม่
    // LINE User จะมี lineId และ email ที่ลงท้ายด้วย @line.user
    const isLineUser = user.lineId && user.email.endsWith('@line.user');
    
    if (isLineUser) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-900/30 text-green-400 rounded-full">
          <MessageCircle className="h-3 w-3" />
          LINE
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-900/30 text-gray-400 rounded-full">
        <Mail className="h-3 w-3" />
        Email
      </span>
    );
  };

  if (loading) {
    return (
      <div className="page-content">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-gray-400">กำลังโหลดข้อมูล...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-white">จัดการผู้ใช้งาน</h1>
          <button
            onClick={() => router.push('/users/invite')}
            className="btn btn-primary"
          >
            <UserPlus className="h-4 w-4" />
            เชิญผู้ใช้ใหม่
          </button>
        </div>
        <p className="text-gray-400">จัดการผู้ใช้งานและกำหนดสิทธิ์การเข้าถึงระบบ</p>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อหรืออีเมล..."
              className="input pl-10"
            />
          </div>
          
          {/* Role Filter */}
          <div className="relative">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="input pr-10 appearance-none cursor-pointer"
            >
              <option value="all">ทุก Role</option>
              <option value="admin">ผู้ดูแลระบบ</option>
              <option value="manager">ผู้จัดการ</option>
              <option value="operation">พนักงาน</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="card text-center">
          <p className="text-2xl font-bold text-white">{users.length}</p>
          <p className="text-sm text-gray-400">ผู้ใช้ทั้งหมด</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-red-400">
            {users.filter(u => u.role === 'admin').length}
          </p>
          <p className="text-sm text-gray-400">ผู้ดูแลระบบ</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-blue-400">
            {users.filter(u => u.role === 'manager').length}
          </p>
          <p className="text-sm text-gray-400">ผู้จัดการ</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-gray-400">
            {users.filter(u => u.role === 'operation').length}
          </p>
          <p className="text-sm text-gray-400">พนักงาน</p>
        </div>
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left p-4 text-sm font-medium text-gray-400">ผู้ใช้</th>
                <th className="text-left p-4 text-sm font-medium text-gray-400">Role</th>
                <th className="text-left p-4 text-sm font-medium text-gray-400">ประเภท</th>
                <th className="text-left p-4 text-sm font-medium text-gray-400">เข้าใช้ล่าสุด</th>
                <th className="text-left p-4 text-sm font-medium text-gray-400">สร้างเมื่อ</th>
                <th className="text-center p-4 text-sm font-medium text-gray-400">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-gray-700 hover:bg-gray-800/50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-gradient-to-br from-primary to-primary-dark rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-secondary font-bold">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-white">{user.name}</p>
                        <p className="text-sm text-gray-400">
                          {/* แสดง email จริงสำหรับ Email User, แสดง LINE ID สำหรับ LINE User */}
                          {user.email.endsWith('@line.user') ? `LINE: ${user.lineId}` : user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    {getRoleBadge(user.role)}
                  </td>
                  <td className="p-4">
                    {getLoginTypeBadge(user)}
                  </td>
                  <td className="p-4">
                    <p className="text-sm text-gray-400">
                      {user.lastLogin 
                        ? new Date(user.lastLogin).toLocaleDateString('th-TH')
                        : 'ยังไม่เคยเข้าใช้'}
                    </p>
                  </td>
                  <td className="p-4">
                    <p className="text-sm text-gray-400">
                      {new Date(user.createdAt).toLocaleDateString('th-TH')}
                    </p>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                      {/* Role Dropdown */}
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value as any)}
                        disabled={user.id === currentUser?.uid}
                        className="input input-sm text-sm"
                      >
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="operation">Operation</option>
                      </select>
                      
                      {/* Delete Button */}
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={user.id === currentUser?.uid}
                        className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">ไม่พบผู้ใช้งาน</p>
          </div>
        )}
      </div>
    </div>
  );
}