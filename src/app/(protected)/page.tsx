// Path: src/app/(protected)/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProtectedIndexPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to dashboard when accessing root protected route
    router.push('/dashboard');
  }, [router]);

  // Return null while redirecting
  return null;
}