// src/app/(protected)/production/execute/[batchId]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ArrowLeft, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import ExecuteForm from '@/components/production/ExecuteForm';

export default function ProductionExecuteFormPage() {
  const router = useRouter();
  const params = useParams();
  const { user: currentUser } = useAuth();
  const batchId = params.batchId as string;

  const handleComplete = () => {
    toast.success('บันทึกการผลิตสำเร็จ!');
    router.push('/production');
  };

  const handleCancel = () => {
    router.push('/production');
  };

  return (
    <div className="page-content">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/production')}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับ
        </button>
        
        <h1 className="text-2xl font-bold text-white mb-2">บันทึกการผลิต</h1>
        <p className="text-gray-400">กรอกข้อมูลการผลิตจริงและผลการทดสอบคุณภาพ</p>
      </div>

      {/* Form */}
      <ExecuteForm
        batchId={batchId}
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    </div>
  );
}