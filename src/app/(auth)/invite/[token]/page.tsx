// src/app/(auth)/invite/[token]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getLineLoginUrl } from '@/lib/line-auth';
import { 
  MessageCircle, Loader2, AlertCircle, CheckCircle2,
  Shield, UserCheck, Users, Clock, XCircle
} from 'lucide-react';

interface InviteData {
  id: string;
  role: 'admin' | 'manager' | 'operation';
  createdByName: string;
  expiresAt: Date;
  used: boolean;
}

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  
  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (token) {
      checkInviteToken();
    }
  }, [token]);

  const checkInviteToken = async () => {
    try {
      setLoading(true);
      
      // Query for the invite token
      const inviteQuery = query(
        collection(db, 'invitations'),
        where('token', '==', token)
      );
      
      const inviteSnapshot = await getDocs(inviteQuery);
      
      if (inviteSnapshot.empty) {
        setError('ลิงก์เชิญไม่ถูกต้องหรือไม่มีในระบบ');
        return;
      }

      const inviteDoc = inviteSnapshot.docs[0];
      const data = inviteDoc.data();
      
      // Check if already used
      if (data.used) {
        setError('ลิงก์นี้ถูกใช้งานแล้ว');
        return;
      }

      // Check if expired
      const expiresAt = data.expiresAt?.toDate() || new Date();
      if (new Date() > expiresAt) {
        setError('ลิงก์หมดอายุแล้ว');
        return;
      }

      setInviteData({
        id: inviteDoc.id,
        role: data.role,
        createdByName: data.createdByName,
        expiresAt,
        used: false
      });

      // Store invite ID in sessionStorage for after LINE login
      sessionStorage.setItem('pendingInviteId', inviteDoc.id);
      sessionStorage.setItem('pendingInviteRole', data.role);

    } catch (error) {
      console.error('Error checking invite:', error);
      setError('เกิดข้อผิดพลาดในการตรวจสอบลิงก์');
    } finally {
      setLoading(false);
    }
  };

  const handleLineLogin = () => {
    // Redirect to LINE OAuth with invite state
    const lineUrl = getLineLoginUrl();
    window.location.href = `${lineUrl}&state=invite_${token}`;
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
      case 'admin': return <Shield className="h-12 w-12 text-red-400" />;
      case 'manager': return <UserCheck className="h-12 w-12 text-blue-400" />;
      case 'operation': return <Users className="h-12 w-12 text-gray-400" />;
      default: return <Users className="h-12 w-12 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
          <p className="mt-4 text-gray-400">กำลังตรวจสอบลิงก์เชิญ...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="card text-center">
            <XCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">ไม่สามารถใช้ลิงก์นี้ได้</h2>
            <p className="text-gray-400 mb-6">{error}</p>
            <button
              onClick={() => router.push('/login')}
              className="btn btn-primary"
            >
              ไปหน้า Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gray-800 rounded-2xl p-4 mb-4">
            <img 
              src="/logo.svg" 
              alt="Joolz Factory" 
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Joolz Factory</h1>
          <p className="text-gray-400">ระบบจัดการโรงงานน้ำผลไม้และสมุนไพร</p>
        </div>

        {/* Invite Card */}
        <div className="card">
          <div className="text-center mb-6">
            <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">คุณได้รับเชิญ!</h2>
            <p className="text-gray-400">
              คุณ {inviteData?.createdByName} ได้เชิญคุณเข้าร่วมทีมในตำแหน่ง
            </p>
          </div>

          {/* Role Display */}
          <div className="bg-gray-800 rounded-lg p-6 mb-6 text-center">
            {getRoleIcon(inviteData?.role || 'operation')}
            <h3 className="text-lg font-bold text-white mt-3">
              {getRoleName(inviteData?.role || 'operation')}
            </h3>
          </div>

          {/* Expire Info */}
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400 mb-6">
            <Clock className="h-4 w-4" />
            <span>
              ลิงก์หมดอายุ: {inviteData?.expiresAt.toLocaleDateString('th-TH')}
            </span>
          </div>

          {/* LINE Login Button */}
          <button
            onClick={handleLineLogin}
            className="w-full bg-[#00C300] hover:bg-[#00B300] text-white font-medium py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-3 group"
          >
            <MessageCircle className="h-5 w-5 group-hover:scale-110 transition-transform" />
            <span>เข้าร่วมด้วย LINE</span>
          </button>

          {/* Info */}
          <div className="mt-6 p-4 bg-gray-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-xs text-gray-400">
                <p className="mb-1">หลังจาก Login ด้วย LINE:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>ระบบจะสร้างบัญชีให้อัตโนมัติ</li>
                  <li>คุณจะได้สิทธิ์ตามที่กำหนด</li>
                  <li>ใช้ LINE Login ทุกครั้งที่เข้าระบบ</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            มีบัญชีอยู่แล้ว?{' '}
            <a href="/login" className="text-primary hover:text-primary-light transition-colors">
              เข้าสู่ระบบ
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}