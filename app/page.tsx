// Path: src/app/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to dashboard for testing
    router.push('/dashboard');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#00231F]">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-[#E9B308] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-white">กำลังโหลด...</p>
      </div>
    </div>
  );
}