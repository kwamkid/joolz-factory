// Path: app/(auth)/line-success/page.tsx
'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Loader2 } from 'lucide-react';

function LineSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const displayName = searchParams.get('name') || 'ผู้ใช้';

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/dashboard');
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
      <div className="card max-w-md w-full text-center space-y-6 p-8">
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center">
            <CheckCircle className="h-12 w-12 text-white" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">
            เข้าสู่ระบบสำเร็จ!
          </h1>
          <p className="text-gray-400">
            ยินดีต้อนรับ, {displayName}
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            กำลังนำคุณไปยังหน้าหลัก...
          </p>
          
          <div className="flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        </div>

        <button
          onClick={() => router.push('/dashboard')}
          className="btn btn-primary w-full"
        >
          ไปยังหน้าหลักเลย
        </button>
      </div>
    </div>
  );
}

// Loading component
function LineSuccessLoading() {
  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
      <div className="card max-w-md w-full text-center space-y-6 p-8">
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <p className="text-gray-400">กำลังโหลด...</p>
      </div>
    </div>
  );
}

export default function LineSuccessPage() {
  return (
    <Suspense fallback={<LineSuccessLoading />}>
      <LineSuccessContent />
    </Suspense>
  );
}