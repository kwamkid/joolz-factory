// src/app/(auth)/line-success/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { CheckCircle2, Loader2, UserPlus, Shield, UserCheck, Users } from 'lucide-react';

export default function LineSuccessPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [inviteInfo, setInviteInfo] = useState<{ invited: boolean; role?: string }>({ invited: false });

  useEffect(() => {
    const handleLogin = async () => {
      const token = searchParams.get('token');
      const invited = searchParams.get('invited') === 'true';
      const role = searchParams.get('role');
      
      if (invited && role) {
        setInviteInfo({ invited: true, role });
      }
      
      if (!token) {
        setStatus('error');
        setErrorMessage('ไม่พบ token การเข้าสู่ระบบ');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }

      try {
        await signInWithCustomToken(auth, token);
        
        // แสดง success animation ก่อน redirect
        setStatus('success');
        
        // รอสักครู่เพื่อให้เห็น animation
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, invited ? 3000 : 1500); // รอนานขึ้นถ้าเป็น invite เพื่อให้เห็นข้อความ
        
      } catch (error) {
        console.error('Sign in error:', error);
        setStatus('error');
        setErrorMessage('เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
        
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      }
    };

    handleLogin();
  }, [searchParams]);

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
      case 'admin': return <Shield className="h-8 w-8 text-red-400" />;
      case 'manager': return <UserCheck className="h-8 w-8 text-blue-400" />;
      case 'operation': return <Users className="h-8 w-8 text-gray-400" />;
      default: return <Users className="h-8 w-8 text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 text-center">
        {/* Logo */}
        <div className="inline-flex items-center justify-center w-24 h-24 bg-gray-800 rounded-2xl p-4 mb-8 animate-fade-in">
          <img 
            src="/logo.svg" 
            alt="Joolz Factory" 
            className="w-full h-full object-contain"
          />
        </div>

        {/* Status Icons & Messages */}
        {status === 'loading' && (
          <div className="animate-fade-in">
            <Loader2 className="h-16 w-16 text-primary animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">กำลังเข้าสู่ระบบ</h2>
            <p className="text-gray-400">กรุณารอสักครู่...</p>
            
            {/* Loading dots */}
            <div className="flex justify-center gap-2 mt-6">
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="animate-fade-in">
            {inviteInfo.invited ? (
              <>
                {/* Invite Success */}
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/20 rounded-full mb-4">
                  <UserPlus className="h-12 w-12 text-green-400 animate-scale-in" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">ยินดีต้อนรับสู่ทีม!</h2>
                
                {/* Role Display */}
                <div className="inline-flex items-center gap-3 bg-gray-800 rounded-lg px-6 py-3 mb-6">
                  {getRoleIcon(inviteInfo.role || 'operation')}
                  <div className="text-left">
                    <p className="text-sm text-gray-400">คุณได้รับสิทธิ์เป็น</p>
                    <p className="text-lg font-semibold text-white">
                      {getRoleName(inviteInfo.role || 'operation')}
                    </p>
                  </div>
                </div>
                
                <p className="text-gray-400">กำลังเข้าสู่ระบบจัดการ...</p>
              </>
            ) : (
              <>
                {/* Normal Success */}
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/20 rounded-full mb-4">
                  <CheckCircle2 className="h-12 w-12 text-green-400 animate-scale-in" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">เข้าสู่ระบบสำเร็จ!</h2>
                <p className="text-gray-400">กำลังเข้าสู่ระบบจัดการ...</p>
              </>
            )}
          </div>
        )}

        {status === 'error' && (
          <div className="animate-fade-in">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-red-500/20 rounded-full mb-4">
              <svg className="h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">เกิดข้อผิดพลาด</h2>
            <p className="text-gray-400 mb-4">{errorMessage}</p>
            <p className="text-sm text-gray-500">กำลังกลับไปหน้า Login...</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-16">
          <p className="text-xs text-gray-600">Joolz Factory Management System</p>
        </div>
      </div>
    </div>
  );
}