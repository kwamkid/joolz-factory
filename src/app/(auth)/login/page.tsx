// src/app/(auth)/login/page.tsx (Hydration Safe)
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { initiateLineLogin } from '@/lib/line-auth';
import { loginAsMasterUser, autoSetupMasterUser, MASTER_CREDENTIALS } from '@/lib/master-user';
import { Eye, EyeOff, User, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [showMasterLogin, setShowMasterLogin] = useState(false);
  const [masterCredentials, setMasterCredentials] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const inviteToken = searchParams.get('token');

  // เพิ่ม mounted state เพื่อหลีกเลี่ยง hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && user && mounted) {
      router.push('/dashboard');
    }
  }, [user, loading, router, mounted]);

  // Auto-setup master user on first load
  useEffect(() => {
    if (mounted) {
      autoSetupMasterUser().catch(console.error);
    }
  }, [mounted]);

  const handleLineLogin = () => {
    setIsLoading(true);
    initiateLineLogin(inviteToken || undefined);
  };

  const handleMasterLogin = async () => {
    if (!masterCredentials.email || !masterCredentials.password) {
      toast.error('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }

    setIsLoading(true);
    try {
      await loginAsMasterUser();
      toast.success('เข้าสู่ระบบสำเร็จ!');
      router.push('/dashboard');
    } catch (error) {
      toast.error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    } finally {
      setIsLoading(false);
    }
  };

  const fillMasterCredentials = () => {
    setMasterCredentials(MASTER_CREDENTIALS);
    toast.success('กรอกข้อมูล Master User แล้ว');
  };

  // แสดง loading state จนกว่า component จะ mount
  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#00231F' }}>
        <div className="text-center animate-fade-in">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-500 border-t-transparent mx-auto"></div>
          <p className="mt-6 text-white text-lg font-medium">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: '#00231F' }}>
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary-500 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary-300 rounded-full blur-3xl"></div>
      </div>
      
      <div className="max-w-md w-full space-y-8 relative z-10">
        <div className="text-center animate-fade-in">
          {/* Logo Container */}
          <div className="mx-auto h-32 w-32 flex items-center justify-center mb-8">
            <img 
              src="/logo.svg" 
              alt="Joolz Factory Logo" 
              className="w-full h-full object-contain"
              style={{ maxWidth: '100%', maxHeight: '100%' }}
            />
          </div>
          
          <h1 className="text-5xl font-bold text-white mb-3 text-balance" style={{ fontFamily: 'IBM Plex Sans Thai, system-ui, sans-serif' }}>
            Joolz Factory
          </h1>
          <p className="text-xl text-white/90 mb-2 font-medium">
            ระบบจัดการโรงงาน
          </p>
          <p className="text-lg text-primary-300 font-medium mb-10">
            น้ำผลไม้และสมุนไพร
          </p>
          
          {inviteToken && (
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 mb-8 animate-slide-up">
              <p className="text-white font-semibold text-lg">
                🎉 คุณได้รับการเชิญเข้าใช้ระบบ
              </p>
              <p className="text-white/80 text-base mt-2">
                กรุณา Login ด้วย LINE เพื่อเข้าใช้งาน
              </p>
            </div>
          )}
        </div>

        {/* Login Options */}
        <div className="space-y-4">
          {/* LINE Login */}
          <div className="card bg-white/95 backdrop-blur-sm border-white/20 shadow-2xl animate-slide-up">
            <div className="flex items-center space-x-3 mb-4">
              <Smartphone className="h-6 w-6 text-green-600" />
              <h3 className="text-lg font-bold text-dark-900">เข้าสู่ระบบด้วย LINE</h3>
            </div>
            
            <button
              onClick={handleLineLogin}
              disabled={isLoading}
              className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-semibold py-5 px-8 rounded-2xl transition-all duration-200 flex items-center justify-center space-x-4 shadow-xl hover:shadow-2xl"
            >
              {isLoading && !showMasterLogin ? (
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
              ) : (
                <>
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.28-.63.626-.63.352 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.628-.629.628M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                  </svg>
                  <span>เข้าสู่ระบบด้วย LINE</span>
                </>
              )}
            </button>
            
            <p className="text-center text-base text-gray-500 mt-4 font-medium">
              แนะนำสำหรับพนักงาน
            </p>
          </div>

          {/* Toggle Master Login */}
          <div className="text-center">
            <button
              onClick={() => setShowMasterLogin(!showMasterLogin)}
              className="text-white/80 hover:text-white font-medium underline text-sm transition-colors"
            >
              {showMasterLogin ? 'ซ่อนการเข้าสู่ระบบแอดมิน' : 'เข้าสู่ระบบแอดมิน'}
            </button>
          </div>

          {/* Master User Login */}
          {showMasterLogin && (
            <div className="card bg-white/95 backdrop-blur-sm border-white/20 shadow-2xl animate-slide-up">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <User className="h-6 w-6 text-dark-900" />
                  <h3 className="text-lg font-bold text-dark-900">เข้าสู่ระบบแอดมิน</h3>
                </div>
                <button
                  onClick={fillMasterCredentials}
                  className="text-xs bg-primary-100 text-primary-800 px-3 py-1 rounded-lg font-medium hover:bg-primary-200 transition-colors"
                >
                  Auto Fill
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    อีเมล
                  </label>
                  <input
                    type="email"
                    value={masterCredentials.email}
                    onChange={(e) => setMasterCredentials({ ...masterCredentials, email: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 font-medium text-dark-900"
                    placeholder="admin@joolzfactory.com"
                    disabled={isLoading}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    รหัสผ่าน
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={masterCredentials.password}
                      onChange={(e) => setMasterCredentials({ ...masterCredentials, password: e.target.value })}
                      className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 font-medium text-dark-900"
                      placeholder="รหัสผ่าน"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                
                <button
                  onClick={handleMasterLogin}
                  disabled={isLoading}
                  className="w-full bg-dark-900 hover:bg-dark-800 disabled:opacity-50 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200 shadow-md"
                >
                  {isLoading && showMasterLogin ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent mx-auto"></div>
                  ) : (
                    'เข้าสู่ระบบ'
                  )}
                </button>
              </div>
              
              <div className="mt-4 p-3 bg-primary-50 rounded-xl">
                <p className="text-xs text-primary-800 font-medium">
                  💡 สำหรับเจ้าของกิจการและผู้ดูแลระบบเท่านั้น
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="text-center text-sm text-white/60">
          <p><strong>Joolz Factory</strong> v1.0</p>
          <p>Mobile First Design</p>
          <p>สำหรับการใช้งานบนมือถือ</p>
        </div>
      </div>
    </div>
  );
}