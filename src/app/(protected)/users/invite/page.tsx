// src/app/(protected)/users/invite/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { collection, addDoc, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  UserPlus, Copy, Check, ArrowLeft, Clock, Link2, 
  Shield, UserCheck, Users, Trash2, Send, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

interface InviteLink {
  id: string;
  token: string;
  role: 'admin' | 'manager' | 'operation';
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
  usedBy?: string;
  usedAt?: Date;
}

export default function InviteUserPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'manager' | 'operation'>('operation');
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Check admin permission
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      toast.error('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
      router.push('/dashboard');
    }
  }, [currentUser, router]);

  // Fetch existing invite links
  useEffect(() => {
    fetchInviteLinks();
  }, []);

  const fetchInviteLinks = async () => {
    try {
      const invitesQuery = query(collection(db, 'invitations'));
      const invitesSnapshot = await getDocs(invitesQuery);
      const links: InviteLink[] = [];

      invitesSnapshot.forEach((doc) => {
        const data = doc.data();
        links.push({
          id: doc.id,
          token: data.token,
          role: data.role,
          createdBy: data.createdBy,
          createdByName: data.createdByName,
          createdAt: data.createdAt?.toDate() || new Date(),
          expiresAt: data.expiresAt?.toDate() || new Date(),
          used: data.used || false,
          usedBy: data.usedBy,
          usedAt: data.usedAt?.toDate()
        });
      });

      // Sort by created date (newest first)
      links.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setInviteLinks(links);
    } catch (error) {
      console.error('Error fetching invite links:', error);
    }
  };

  const generateInviteLink = async () => {
    try {
      setLoading(true);

      // Generate unique token
      const token = generateToken();
      
      // Set expiration to 7 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Create invitation document
      const inviteData = {
        token,
        role: selectedRole,
        createdBy: currentUser?.uid,
        createdByName: currentUser?.name || 'Admin',
        createdAt: new Date(),
        expiresAt,
        used: false
      };

      await addDoc(collection(db, 'invitations'), inviteData);

      toast.success('สร้างลิงก์เชิญสำเร็จ');
      fetchInviteLinks();
    } catch (error) {
      console.error('Error creating invite link:', error);
      toast.error('เกิดข้อผิดพลาดในการสร้างลิงก์');
    } finally {
      setLoading(false);
    }
  };

  const generateToken = () => {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  };

  const getInviteUrl = (token: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/invite/${token}`;
  };

  const copyToClipboard = async (token: string, id: string) => {
    try {
      await navigator.clipboard.writeText(getInviteUrl(token));
      setCopiedId(id);
      toast.success('คัดลอกลิงก์แล้ว');
      
      setTimeout(() => {
        setCopiedId(null);
      }, 2000);
    } catch (error) {
      toast.error('ไม่สามารถคัดลอกลิงก์ได้');
    }
  };

  const deleteInviteLink = async (linkId: string) => {
    if (!confirm('ยืนยันการลบลิงก์เชิญนี้?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'invitations', linkId));
      toast.success('ลบลิงก์เชิญสำเร็จ');
      fetchInviteLinks();
    } catch (error) {
      console.error('Error deleting invite link:', error);
      toast.error('เกิดข้อผิดพลาดในการลบลิงก์');
    }
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case 'admin': return 'ผู้ดูแลระบบ';
      case 'manager': return 'ผู้จัดการ';
      case 'operation': return 'พนักงาน';
      default: return role;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="h-4 w-4" />;
      case 'manager': return <UserCheck className="h-4 w-4" />;
      case 'operation': return <Users className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  const isExpired = (expiresAt: Date) => {
    return new Date() > expiresAt;
  };

  // Filter links into active and history
  const activeLinks = inviteLinks.filter(link => !link.used && !isExpired(link.expiresAt));
  const historyLinks = inviteLinks.filter(link => link.used || isExpired(link.expiresAt));

  return (
    <div className="page-content">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/users')}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับ
        </button>
        
        <h1 className="text-2xl font-bold text-white mb-2">เชิญผู้ใช้ใหม่</h1>
        <p className="text-gray-400">สร้างลิงก์เชิญสำหรับผู้ใช้ใหม่เข้าสู่ระบบด้วย LINE</p>
      </div>

      {/* Create New Invite */}
      <div className="card mb-8">
        <h3 className="text-lg font-semibold text-white mb-4">สร้างลิงก์เชิญใหม่</h3>
        
        <div className="space-y-4">
          {/* Role Selection */}
          <div>
            <label className="label">เลือก Role สำหรับผู้ใช้ใหม่</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => setSelectedRole('operation')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedRole === 'operation'
                    ? 'border-primary bg-primary/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="font-medium text-white">พนักงาน</p>
                <p className="text-xs text-gray-400 mt-1">ผลิตสินค้า, QC</p>
              </button>

              <button
                onClick={() => setSelectedRole('manager')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedRole === 'manager'
                    ? 'border-primary bg-primary/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <UserCheck className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                <p className="font-medium text-white">ผู้จัดการ</p>
                <p className="text-xs text-gray-400 mt-1">วางแผน, รายงาน</p>
              </button>

              <button
                onClick={() => setSelectedRole('admin')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedRole === 'admin'
                    ? 'border-primary bg-primary/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <Shield className="h-8 w-8 text-red-400 mx-auto mb-2" />
                <p className="font-medium text-white">ผู้ดูแลระบบ</p>
                <p className="text-xs text-gray-400 mt-1">จัดการระบบ</p>
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-400">
                <p>• ลิงก์จะหมดอายุใน 7 วัน</p>
                <p>• ใช้ได้เพียงครั้งเดียว</p>
                <p>• ผู้ใช้ต้อง Login ด้วย LINE</p>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={generateInviteLink}
            disabled={loading}
            className="btn btn-primary w-full"
          >
            {loading ? (
              <>กำลังสร้างลิงก์...</>
            ) : (
              <>
                <Send className="h-4 w-4" />
                สร้างลิงก์เชิญ
              </>
            )}
          </button>
        </div>
      </div>

      {/* Active Links */}
      {activeLinks.length > 0 && (
        <div className="card mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">ลิงก์ที่ใช้งานได้</h3>
          
          <div className="space-y-3">
            {activeLinks.map((link) => (
              <div key={link.id} className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getRoleIcon(link.role)}
                      <span className="font-medium text-white">
                        {getRoleName(link.role)}
                      </span>
                      <span className="text-xs text-gray-500">
                        • สร้างโดย {link.createdByName}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        หมดอายุ {new Date(link.expiresAt).toLocaleDateString('th-TH')}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <code className="bg-gray-900 px-3 py-1 rounded text-xs text-gray-400 flex-1">
                        {getInviteUrl(link.token)}
                      </code>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => copyToClipboard(link.token, link.id)}
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      {copiedId === link.id ? (
                        <Check className="h-4 w-4 text-green-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                    
                    <button
                      onClick={() => deleteInviteLink(link.id)}
                      className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {historyLinks.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">ประวัติการใช้งาน</h3>
          
          <div className="space-y-3">
            {historyLinks.map((link) => (
              <div key={link.id} className="bg-gray-800/50 rounded-lg p-4 opacity-60">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {getRoleIcon(link.role)}
                      <span className="font-medium text-white">
                        {getRoleName(link.role)}
                      </span>
                      {link.used ? (
                        <span className="text-xs text-green-400">• ใช้แล้ว</span>
                      ) : (
                        <span className="text-xs text-red-400">• หมดอายุ</span>
                      )}
                    </div>
                    
                    <div className="text-sm text-gray-400">
                      {link.used && link.usedBy && (
                        <p>ใช้โดย: {link.usedBy}</p>
                      )}
                      <p>สร้างเมื่อ: {new Date(link.createdAt).toLocaleDateString('th-TH')}</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => deleteInviteLink(link.id)}
                    className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}