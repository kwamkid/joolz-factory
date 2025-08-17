// app/(auth)/login/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Loader2, ShieldCheck, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getLineLoginUrl } from '@/lib/line-auth';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [adminForm, setAdminForm] = useState({
    email: '',
    password: ''
  });

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  const handleLineLogin = () => {
    setIsLoading(true);
    // Redirect to LINE OAuth
    window.location.href = getLineLoginUrl();
  };

  const handleAdminLogin = async (e: React.MouseEvent) => {
    e.preventDefault();
    setError('');
    
    if (!adminForm.email || !adminForm.password) {
      setError('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }

    setIsLoading(true);
    
    try {
      await signIn(adminForm.email, adminForm.password);
      router.push('/'); // ไปหน้าหลักที่ root
    } catch (error: any) {
      console.error('Login error:', error);
      
       // Handle specific error cases
      if (error.code === 'auth/user-not-found') {
        setError('ไม่พบผู้ใช้นี้ในระบบ');
      } else if (error.code === 'auth/wrong-password') {
        setError('รหัสผ่านไม่ถูกต้อง');
      } else if (error.code === 'auth/invalid-email') {
        setError('รูปแบบอีเมลไม่ถูกต้อง');
      } else if (error.code === 'auth/too-many-requests') {
        setError('ลองเข้าสู่ระบบมากเกินไป กรุณารอสักครู่');
      } else if (error.code === 'auth/invalid-credential') {
        setError('ข้อมูลการเข้าสู่ระบบไม่ถูกต้อง กรุณาตรวจสอบอีเมลและรหัสผ่าน');
      } else if (error.code === 'auth/user-disabled') {
        setError('บัญชีผู้ใช้นี้ถูกระงับ');
      } else {
        setError(`เกิดข้อผิดพลาด: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl"></div>
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gray-800 rounded-2xl p-4 mb-4">
            <img 
              src="/logo.svg" 
              alt="Joolz Factory" 
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Joolz Factory</h1>
          <p className="text-gray-400">ระบบจัดการโรงงานน้ำผลไม้และสมุนไพร</p>
        </div>

        {/* Login Form */}
        <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700">
          <h2 className="text-xl font-bold text-white mb-6 text-center">เข้าสู่ระบบ</h2>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-600 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {!showAdminLogin ? (
            <>
              {/* LINE Login Button */}
              <button
                onClick={handleLineLogin}
                disabled={isLoading}
                className="w-full bg-[#00C300] hover:bg-[#00B300] disabled:opacity-50 text-white font-medium py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-3 group"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>กำลังเข้าสู่ระบบ...</span>
                  </>
                ) : (
                  <>
                    <MessageCircle className="h-5 w-5 group-hover:scale-110 transition-transform" />
                    <span>เข้าสู่ระบบด้วย LINE</span>
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-gray-800 text-gray-400">หรือ</span>
                </div>
              </div>

              {/* Admin Login Button */}
              <button
                onClick={() => setShowAdminLogin(true)}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-3"
              >
                <ShieldCheck className="h-5 w-5" />
                <span>เข้าสู่ระบบสำหรับผู้ดูแลระบบ</span>
              </button>
            </>
          ) : (
            <>
              {/* Admin Login Form */}
              <div className="space-y-4">
                <div>
                  <label className="label">อีเมล</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                      type="email"
                      value={adminForm.email}
                      onChange={(e) => setAdminForm({...adminForm, email: e.target.value})}
                      className="input pl-10"
                      placeholder="admin@joolzfactory.com"
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">รหัสผ่าน</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={adminForm.password}
                      onChange={(e) => setAdminForm({...adminForm, password: e.target.value})}
                      className="input pl-10 pr-10"
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleAdminLogin}
                  disabled={isLoading}
                  className="w-full btn btn-primary"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>กำลังเข้าสู่ระบบ...</span>
                    </>
                  ) : (
                    'เข้าสู่ระบบ'
                  )}
                </button>
              </div>

              {/* Back to LINE Login */}
              <button
                onClick={() => {
                  setShowAdminLogin(false);
                  setError('');
                  setAdminForm({ email: '', password: '' });
                }}
                className="w-full mt-4 text-gray-400 hover:text-white text-sm transition-colors"
              >
                ← กลับไปเข้าสู่ระบบด้วย LINE
              </button>
            </>
          )}
        </div>

        {/* Admin Setup Info */}
        {!showAdminLogin && (
          <div className="mt-6 bg-gray-800/50 rounded-lg p-4 text-center border border-gray-700">
            <p className="text-xs text-gray-400 mb-2">
              <strong className="text-primary">สำหรับการติดตั้งครั้งแรก:</strong>
            </p>
            <p className="text-xs text-gray-500">
              Admin คนแรกใช้ email: <code className="text-primary">admin@joolzfactory.com</code>
            </p>
            <p className="text-xs text-gray-500">
              รหัสผ่านเริ่มต้น: <code className="text-primary">JoolzAdmin2024!</code>
            </p>
            <p className="text-xs text-red-400 mt-2">
              * กรุณาเปลี่ยนรหัสผ่านหลังเข้าสู่ระบบครั้งแรก
            </p>
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-8 text-center space-y-2">
          <p className="text-sm text-gray-500">
            การเข้าสู่ระบบแสดงว่าคุณยอมรับ
          </p>
          <p className="text-sm text-gray-400">
            <a href="#" className="text-primary hover:text-primary-light transition-colors">
              เงื่อนไขการใช้งาน
            </a>
            {' และ '}
            <a href="#" className="text-primary hover:text-primary-light transition-colors">
              นโยบายความเป็นส่วนตัว
            </a>
          </p>
        </div>

        {/* Version */}
        <div className="mt-12 text-center">
          <p className="text-xs text-gray-600">Version 1.0.0</p>
        </div>
      </div>
    </div>
  );
}