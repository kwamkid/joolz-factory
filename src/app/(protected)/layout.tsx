// src/app/(protected)/layout.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Layout from '@/components/layout/Layout';
import { Loader2 } from 'lucide-react';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // ถ้าโหลดเสร็จแล้วและไม่มี user ให้ไป login
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // แสดง loading ระหว่างเช็ค auth
  if (loading) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
          <p className="mt-4 text-gray-400">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    );
  }

  // ถ้าไม่มี user ให้ return null (จะ redirect ไป login อยู่แล้ว)
  if (!user) {
    return null;
  }

  // ถ้ามี user แล้ว แสดง Layout พร้อม children
  return (
    <Layout>
      {children}
    </Layout>
  );
}