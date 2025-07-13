// src/lib/auth-context.tsx (แก้ไข Hydration issue)
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { User, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  hasRole: (role: UserRole) => boolean;
  canSeeFinancials: () => boolean;
  logout: () => Promise<void>;
  updateUserRoles: (roles: UserRole[]) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // เพิ่ม mounted state เพื่อหลีกเลี่ยง hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return; // รอให้ component mount ก่อน

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('🔄 Auth state changed:', firebaseUser?.uid || 'null');
      
      if (firebaseUser) {
        setFirebaseUser(firebaseUser);
        
        try {
          // Get user data from Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log('✅ User data found:', userData);
            
            setUser({
              id: firebaseUser.uid,
              lineId: userData.lineId || firebaseUser.uid,
              name: userData.name || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'ไม่ระบุชื่อ',
              ...(userData.pictureUrl || firebaseUser.photoURL ? { pictureUrl: userData.pictureUrl || firebaseUser.photoURL } : {}),
              roles: userData.roles || ['operation'],
              ...(userData.phone || firebaseUser.phoneNumber ? { phone: userData.phone || firebaseUser.phoneNumber } : {}),
              isActive: userData.isActive !== false,
              createdAt: userData.createdAt?.toDate() || new Date(),
              createdBy: userData.createdBy,
            });
          } else {
            console.log('📝 Creating new user document...');
            
            // Create user document if it doesn't exist
            const newUser: Omit<User, 'id'> = {
              lineId: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'ไม่ระบุชื่อ',
              ...(firebaseUser.photoURL && { pictureUrl: firebaseUser.photoURL }),
              roles: ['operation'],
              ...(firebaseUser.phoneNumber && { phone: firebaseUser.phoneNumber }),
              isActive: true,
              createdAt: new Date(),
            };

            await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
            
            setUser({
              id: firebaseUser.uid,
              ...newUser,
            });
            
            console.log('✅ New user created');
          }
        } catch (error) {
          console.error('❌ Error loading user data:', error);
          setUser(null);
        }
      } else {
        console.log('🚪 User signed out');
        setFirebaseUser(null);
        setUser(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, [mounted]);

  const hasRole = (role: UserRole): boolean => {
    return user?.roles.includes(role) ?? false;
  };

  const canSeeFinancials = (): boolean => {
    return hasRole('admin');
  };

  const logout = async () => {
    try {
      await signOut(auth);
      console.log('✅ User logged out');
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  };

  const updateUserRoles = async (roles: UserRole[]) => {
    if (!user) return;
    
    try {
      await setDoc(doc(db, 'users', user.id), { roles }, { merge: true });
      setUser({ ...user, roles });
      console.log('✅ User roles updated:', roles);
    } catch (error) {
      console.error('❌ Error updating roles:', error);
    }
  };

  const value: AuthContextType = {
    user,
    firebaseUser,
    loading,
    hasRole,
    canSeeFinancials,
    logout,
    updateUserRoles,
  };

  // แสดง loading state ขณะที่ component ยังไม่ mount
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#00231F' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-500 border-t-transparent mx-auto"></div>
          <p className="mt-6 text-white text-lg font-medium">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}