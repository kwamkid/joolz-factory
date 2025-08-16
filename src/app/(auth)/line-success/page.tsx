// app/(auth)/line-success/page.tsx
'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function LineSuccessPage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleLogin = async () => {
      const token = searchParams.get('token');
      
      if (!token) {
        window.location.href = '/login';
        return;
      }

      try {
        await signInWithCustomToken(auth, token);
        // หลัง sign in สำเร็จ ให้ไปหน้า home
        window.location.href = '/';
      } catch (error) {
        console.error('Sign in error:', error);
        window.location.href = '/login';
      }
    };

    handleLogin();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center">
      <div className="text-center text-white">
        <p className="text-xl">กำลังเข้าสู่ระบบ...</p>
      </div>
    </div>
  );
}