// src/app/(protected)/settings/password/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ตรวจสอบว่าเป็น LINE User หรือไม่
  const isLineUser = user?.lineId ? true : false;

  useEffect(() => {
    // ถ้าเป็น LINE User ให้ redirect กลับ
    if (isLineUser) {
      toast.error('ผู้ใช้ LINE ไม่สามารถเปลี่ยนรหัสผ่านได้');
      router.push('/dashboard');
    }
  }, [isLineUser, router]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.currentPassword) {
      newErrors.currentPassword = 'กรุณากรอกรหัสผ่านปัจจุบัน';
    }

    if (!formData.newPassword) {
      newErrors.newPassword = 'กรุณากรอกรหัสผ่านใหม่';
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.newPassword)) {
      newErrors.newPassword = 'รหัสผ่านต้องมีตัวพิมพ์เล็ก ตัวพิมพ์ใหญ่ และตัวเลข';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'กรุณายืนยันรหัสผ่านใหม่';
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'รหัสผ่านไม่ตรงกัน';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);

    try {
      // Re-authenticate user
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        throw new Error('ไม่พบข้อมูลผู้ใช้');
      }

      const credential = EmailAuthProvider.credential(
        currentUser.email,
        formData.currentPassword
      );

      await reauthenticateWithCredential(currentUser, credential);
      
      // Update password
      await updatePassword(currentUser, formData.newPassword);
      
      toast.success('เปลี่ยนรหัสผ่านสำเร็จ!');
      
      // Clear form
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      // Redirect to dashboard
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
      
    } catch (error: any) {
      console.error('Change password error:', error);
      
      if (error.code === 'auth/wrong-password') {
        setErrors({ currentPassword: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
      } else if (error.code === 'auth/weak-password') {
        setErrors({ newPassword: 'รหัสผ่านใหม่ไม่ปลอดภัยพอ' });
      } else {
        toast.error('เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ถ้าเป็น LINE User แสดงข้อความแทน
  if (isLineUser) {
    return (
      <div className="page-content">
        <div className="max-w-2xl mx-auto">
          <div className="card text-center py-12">
            <MessageCircle className="h-16 w-16 text-[#00C300] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">ผู้ใช้ LINE</h2>
            <p className="text-gray-400 mb-6">
              คุณ Login ด้วย LINE ซึ่งไม่ต้องใช้รหัสผ่านในระบบ
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="btn btn-primary"
            >
              กลับหน้าหลัก
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">เปลี่ยนรหัสผ่าน</h1>
          <p className="text-gray-400">เพื่อความปลอดภัย กรุณาใช้รหัสผ่านที่มีความซับซ้อน</p>
        </div>

        {/* Form */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Current Password */}
            <div>
              <label className="label">รหัสผ่านปัจจุบัน</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type={showPasswords.current ? 'text' : 'password'}
                  value={formData.currentPassword}
                  onChange={(e) => setFormData({...formData, currentPassword: e.target.value})}
                  className={`input pl-10 pr-10 ${errors.currentPassword ? 'input-error' : ''}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({...showPasswords, current: !showPasswords.current})}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPasswords.current ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.currentPassword && (
                <p className="mt-1 text-sm text-red-400">{errors.currentPassword}</p>
              )}
            </div>

            {/* New Password */}
            <div>
              <label className="label">รหัสผ่านใหม่</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  value={formData.newPassword}
                  onChange={(e) => setFormData({...formData, newPassword: e.target.value})}
                  className={`input pl-10 pr-10 ${errors.newPassword ? 'input-error' : ''}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({...showPasswords, new: !showPasswords.new})}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPasswords.new ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.newPassword && (
                <p className="mt-1 text-sm text-red-400">{errors.newPassword}</p>
              )}
              
              {/* Password Requirements */}
              <div className="mt-2 space-y-1">
                <p className="text-xs text-gray-500">รหัสผ่านต้องมี:</p>
                <ul className="text-xs text-gray-500 list-disc list-inside">
                  <li>อย่างน้อย 8 ตัวอักษร</li>
                  <li>ตัวพิมพ์เล็กและตัวพิมพ์ใหญ่</li>
                  <li>ตัวเลขอย่างน้อย 1 ตัว</li>
                </ul>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="label">ยืนยันรหัสผ่านใหม่</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  className={`input pl-10 pr-10 ${errors.confirmPassword ? 'input-error' : ''}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({...showPasswords, confirm: !showPasswords.confirm})}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPasswords.confirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-400">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Admin Warning */}
            {user?.email === 'admin@joolzfactory.com' && (
              <div className="p-4 bg-yellow-900/20 border border-yellow-600 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-400">คำเตือนสำหรับ Admin</p>
                    <p className="text-sm text-yellow-400/80 mt-1">
                      คุณกำลังเปลี่ยนรหัสผ่านของ Admin หลัก กรุณาจดจำรหัสผ่านใหม่ให้ดี
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary flex-1"
              >
                {isLoading ? 'กำลังเปลี่ยนรหัสผ่าน...' : 'เปลี่ยนรหัสผ่าน'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="btn btn-ghost"
              >
                ยกเลิก
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}