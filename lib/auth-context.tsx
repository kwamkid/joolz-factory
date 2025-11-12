// Path: src/lib/auth-context.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/types';

// Auth Context Interface
interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithLine: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

// Create Auth Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/auth/callback', '/line-callback'];

// Role-based route permissions
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  '/dashboard': ['admin', 'manager', 'operation', 'sales'],
  '/production': ['admin', 'manager', 'operation'],
  '/inventory': ['admin', 'manager'],
  '/suppliers': ['admin', 'manager'],
  '/raw-materials': ['admin', 'manager'],
  '/bottles': ['admin', 'manager'],
  '/customers': ['admin', 'sales'],
  '/orders': ['admin', 'sales'],
  '/sales': ['admin', 'sales'],
  '/reports': ['admin', 'manager', 'sales'],
  '/users': ['admin'],
};

// Auth Provider Component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Fetch user profile from database
  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      
      if (data) {
        setUserProfile(data as UserProfile);
        return data as UserProfile;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  };

  // Check route permission based on user role
  const checkRoutePermission = (path: string, role: string): boolean => {
    // Find matching route pattern
    const routeKey = Object.keys(ROUTE_PERMISSIONS).find(key => 
      path.startsWith(key)
    );
    
    if (!routeKey) return true; // Allow if no specific permission required
    
    return ROUTE_PERMISSIONS[routeKey].includes(role);
  };

  // Mock user profile for testing (ลบออกเมื่อใช้งานจริง)
  const mockUserProfile: UserProfile = {
    id: 'test-user',
    email: 'admin@joolz.factory',
    name: 'ผู้ดูแลระบบ',
    role: 'admin', // เปลี่ยนเป็น 'manager', 'operation', 'sales' เพื่อทดสอบ role อื่น
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        // FOR TESTING: ใช้ mock user
        setUserProfile(mockUserProfile);
        setLoading(false);
        return;
        
        // PRODUCTION CODE (uncomment เมื่อใช้งานจริง)
        /*
        // Get initial session
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          
          // Fetch user profile
          const profile = await fetchUserProfile(initialSession.user.id);
          
          // Check route permission
          if (profile && !PUBLIC_ROUTES.includes(pathname)) {
            if (!checkRoutePermission(pathname, profile.role)) {
              // Redirect to dashboard if no permission
              router.push('/dashboard');
            }
          }
        } else if (!PUBLIC_ROUTES.includes(pathname)) {
          // Redirect to login if not authenticated
          router.push('/login');
        }
        */
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        // setLoading(false); // comment out for testing
      }
    };

    initAuth();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: string, currentSession: Session | null) => {
        setSession(currentSession);
        setUser(currentSession?.user || null);
        
        if (event === 'SIGNED_IN' && currentSession) {
          // Fetch user profile on sign in
          await fetchUserProfile(currentSession.user.id);
          router.push('/dashboard');
        } else if (event === 'SIGNED_OUT') {
          setUserProfile(null);
          router.push('/login');
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  // Sign in with email/password
  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user) {
        await fetchUserProfile(data.user.id);
      }

      return { error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' };
    }
  };

  // Sign in with LINE
  const signInWithLine = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google', // เปลี่ยนเป็น LINE provider เมื่อ setup แล้ว
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        return { error: error.message };
      }

      return { error: null };
    } catch (error) {
      console.error('LINE sign in error:', error);
      return { error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย LINE' };
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setUserProfile(null);
      setSession(null);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Refresh user profile
  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfile(user.id);
    }
  };

  // Context value
  const value: AuthContextType = {
    user,
    userProfile,
    session,
    loading,
    signIn,
    signInWithLine,
    signOut,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// HOC for protecting routes
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  allowedRoles?: string[]
) {
  return function ProtectedComponent(props: P) {
    const { userProfile, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!loading) {
        if (!userProfile) {
          router.push('/login');
        } else if (allowedRoles && !allowedRoles.includes(userProfile.role)) {
          router.push('/dashboard');
        }
      }
    }, [userProfile, loading, router]);

    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-[#00231F]">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-[#E9B308] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white">กำลังโหลด...</p>
          </div>
        </div>
      );
    }

    if (!userProfile) {
      return null;
    }

    if (allowedRoles && !allowedRoles.includes(userProfile.role)) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-[#00231F]">
          <div className="text-center">
            <p className="text-white text-xl mb-4">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-[#E9B308] text-[#00231F] rounded-lg hover:bg-[#E9B308]/90"
            >
              กลับไปหน้า Dashboard
            </button>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
}