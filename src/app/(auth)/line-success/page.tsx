// Path: src/app/(auth)/line-success/page.tsx
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { Loader2 } from 'lucide-react';

// Component ที่ใช้ useSearchParams
function LineSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const signInWithToken = async () => {
      try {
        const token = searchParams.get('token');
        
        if (!token) {
          console.error('No token found in URL');
          setError('ไม่พบ token การยืนยันตัวตน');
          setLoading(false);
          return;
        }

        console.log('Found token, signing in...');
        
        // Sign in with custom token
        await signInWithCustomToken(auth, token);
        console.log('Signed in successfully');
        
        // Wait a bit for auth state to update
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);
        
      } catch (error) {
        console.error('Sign in error:', error);
        setError('เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
        setLoading(false);
      }
    };

    // Only run if not already signed in
    if (!user) {
      signInWithToken();
    } else {
      // Already signed in, redirect to dashboard
      router.push('/dashboard');
    }
  }, [router, searchParams, user]);

  if (loading && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-white">กำลังเข้าสู่ระบบ...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => router.push('/login')}
            className="btn btn-primary"
          >
            กลับไปหน้าเข้าสู่ระบบ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary">
      <div className="text-center">
        <p className="text-white mb-4">เข้าสู่ระบบสำเร็จ</p>
        <p className="text-gray-400">กำลังไปหน้าหลัก...</p>
      </div>
    </div>
  );
}

// Loading component สำหรับ Suspense
function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary">
      <Loader2 className="h-8 w-8 text-primary animate-spin" />
    </div>
  );
}

// Main component ที่ครอบด้วย Suspense
export default function LineSuccessPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LineSuccessContent />
    </Suspense>
  );
}