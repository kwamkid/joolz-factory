'use client';

import { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Settings as SettingsIcon, Trash2, AlertTriangle } from 'lucide-react';

export default function SettingsPage() {
  const { userProfile } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleDeleteAllData = async () => {
    if (confirmText !== 'CONFIRM') {
      setError('กรุณาพิมพ์ "CONFIRM" เพื่อยืนยัน');
      return;
    }

    setDeleting(true);
    setError('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      const response = await fetch('/api/settings/delete-all-data', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sessionData?.session?.access_token || ''}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'ไม่สามารถลบข้อมูลได้');
      }

      setSuccess('ลบข้อมูลทั้งหมดสำเร็จ');
      setShowDeleteModal(false);
      setConfirmText('');

      // Reload page after 2 seconds
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Error deleting all data:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('ไม่สามารถลบข้อมูลได้');
      }
    } finally {
      setDeleting(false);
    }
  };

  // Only allow admin to access this page
  if (userProfile?.role !== 'admin') {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <SettingsIcon className="w-8 h-8 text-[#E9B308]" />
          <h1 className="text-3xl font-bold text-[#00231F]">ตั้งค่าระบบ</h1>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
            {success}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Danger Zone */}
        <div className="bg-white rounded-lg shadow-md p-6 border-2 border-red-200">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <h2 className="text-xl font-bold text-red-600">Danger Zone</h2>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  ลบข้อมูลทั้งหมด
                </h3>
                <p className="text-gray-600 mb-2">
                  ลบข้อมูลทั้งหมดในระบบ ยกเว้นข้อมูลผู้ใช้ (Users)
                </p>
                <p className="text-sm text-red-600 font-semibold">
                  ⚠️ การดำเนินการนี้ไม่สามารถย้อนกลับได้!
                </p>
                <ul className="mt-3 text-sm text-gray-700 list-disc list-inside space-y-1">
                  <li>คำสั่งซื้อทั้งหมด (Orders)</li>
                  <li>สินค้าพร้อมขายทั้งหมด (Sellable Products)</li>
                  <li>สินค้าหลักทั้งหมด (Products)</li>
                  <li>วัตถุดิบทั้งหมด (Raw Materials)</li>
                  <li>ขวดทั้งหมด (Bottles)</li>
                  <li>ลูกค้าทั้งหมด (Customers)</li>
                  <li>ซัพพลายเออร์ทั้งหมด (Suppliers)</li>
                  <li>การผลิตทั้งหมด (Production)</li>
                  <li>สต็อคทั้งหมด (Stock Transactions)</li>
                </ul>
              </div>
              <button
                onClick={() => {
                  setShowDeleteModal(true);
                  setError('');
                  setConfirmText('');
                }}
                className="ml-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 font-semibold"
              >
                <Trash2 className="w-5 h-5" />
                ลบข้อมูลทั้งหมด
              </button>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
                <h3 className="text-xl font-bold text-gray-900">ยืนยันการลบข้อมูล</h3>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 mb-4">
                  คุณกำลังจะลบข้อมูลทั้งหมดในระบบ ยกเว้นข้อมูลผู้ใช้
                </p>
                <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                  <p className="text-red-600 font-semibold text-sm">
                    ⚠️ การดำเนินการนี้ไม่สามารถย้อนกลับได้!
                  </p>
                </div>
                <p className="text-gray-700 font-semibold mb-2">
                  พิมพ์ <span className="text-red-600 font-mono">CONFIRM</span> เพื่อยืนยัน:
                </p>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="พิมพ์ CONFIRM"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  disabled={deleting}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setConfirmText('');
                    setError('');
                  }}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleDeleteAllData}
                  disabled={deleting || confirmText !== 'CONFIRM'}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  {deleting ? 'กำลังลบ...' : 'ยืนยันการลบ'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
