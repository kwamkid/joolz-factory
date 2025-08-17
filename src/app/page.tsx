// src/app/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // ถ้า login แล้ว ไปหน้า dashboard
        router.push('/dashboard');
      } else {
        // ถ้ายังไม่ login ไปหน้า login
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  // แสดง loading ระหว่างเช็ค auth
  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center">
      <Loader2 className="h-8 w-8 text-primary animate-spin" />
    </div>
  );
}