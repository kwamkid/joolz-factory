// Path: lib/auth-context.tsx
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

// Auth Provider Component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Fetch user profile from database
  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      
      if (data) {
        const profile: UserProfile = {
          ...data,
          isActive: data.is_active,
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at)
        };
        return profile;
      }
      return null;
    } catch (error) {
      console.error('Unexpected error:', error);
      return null;
    }
  };

  // Initialize auth
  useEffect(() => {
    if (initialized) return;
    
    const initAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (initialSession?.user) {
          setSession(initialSession);
          setUser(initialSession.user);
          
          const profile = await fetchUserProfile(initialSession.user.id);
          if (profile) {
            setUserProfile(profile);
          }
        }
      } catch (error) {
        console.error('Init error:', error);
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    };

    initAuth();
  }, [initialized]);

  // Handle auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('Auth event:', event);
        
        if (event === 'SIGNED_IN' && currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);
          
          const profile = await fetchUserProfile(currentSession.user.id);
          if (profile) {
            setUserProfile(profile);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setUserProfile(null);
          setSession(null);
        }
        
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Handle routing based on auth state
  useEffect(() => {
    // ถ้ายังโหลดอยู่ ไม่ต้อง redirect
    if (loading || !initialized) return;

    // ถ้า login แล้วและอยู่หน้า login ให้ไป dashboard
    if (user && userProfile && pathname === '/login') {
      router.push('/dashboard');
      return;
    }

    // ถ้าไม่ได้ login และอยู่หน้า protected ให้ไป login
    if (!user && !PUBLIC_ROUTES.includes(pathname) && pathname !== '/') {
      router.push('/login');
      return;
    }
  }, [user, userProfile, pathname, loading, initialized, router]);

  // Sign in with email/password
  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          return { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
        }
        return { error: error.message };
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
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        return { error: error.message };
      }

      return { error: null };
    } catch (error) {
      return { error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย LINE' };
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Refresh user profile
  const refreshProfile = async () => {
    if (user) {
      const profile = await fetchUserProfile(user.id);
      if (profile) {
        setUserProfile(profile);
      }
    }
  };

  // Context value
  const value: AuthContextType = {
    user,
    userProfile,
    session,
    loading: loading || !initialized,
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