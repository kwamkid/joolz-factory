// src/app/auth/signin/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import toast from 'react-hot-toast';

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (token) {
      signInWithCustomToken(auth, token)
        .then(() => {
          toast.success('เข้าสู่ระบบสำเร็จ!');
          router.push('/dashboard');
        })
        .catch((error) => {
          console.error('Sign in error:', error);
          toast.error('เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
          router.push('/login?error=signin_failed');
        });
    } else {
      router.push('/login?error=no_token');
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">กำลังเข้าสู่ระบบ...</p>
      </div>
    </div>
  );
}