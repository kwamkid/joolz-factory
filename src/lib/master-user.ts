// src/lib/master-user.ts
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { User } from '@/types';

// Master User Configuration
const MASTER_USER = {
  email: 'admin@joolzfactory.com',
  password: 'JoolzFactory2024!',
  name: 'Admin Joolz Factory',
  lineId: 'master-admin-joolz',
  roles: ['operation', 'manager', 'admin'] as const,
};

/**
 * สร้าง Master User ครั้งแรก (เรียกตอน setup)
 */
export async function createMasterUser() {
  try {
    console.log('🔧 Creating master user...');
    
    // สร้าง Firebase Auth account
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      MASTER_USER.email,
      MASTER_USER.password
    );
    
    const firebaseUser = userCredential.user;
    
    // สร้าง User document ใน Firestore
    const masterUserData: Omit<User, 'id'> = {
      lineId: MASTER_USER.lineId,
      name: MASTER_USER.name,
      roles: [...MASTER_USER.roles],
      isActive: true,
      createdAt: new Date(),
      pictureUrl: undefined,
      phone: undefined,
    };
    
    await setDoc(doc(db, 'users', firebaseUser.uid), masterUserData);
    
    console.log('✅ Master user created successfully!');
    console.log('📧 Email:', MASTER_USER.email);
    console.log('🔑 Password:', MASTER_USER.password);
    
    return firebaseUser;
    
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      console.log('ℹ️ Master user already exists');
      return await signInWithEmailAndPassword(auth, MASTER_USER.email, MASTER_USER.password);
    }
    console.error('❌ Error creating master user:', error);
    throw error;
  }
}

/**
 * ตรวจสอบว่า Master User มีอยู่หรือไม่
 */
export async function checkMasterUserExists(): Promise<boolean> {
  try {
    await signInWithEmailAndPassword(auth, MASTER_USER.email, MASTER_USER.password);
    return true;
  } catch {
    return false;
  }
}

/**
 * Login เป็น Master User
 */
export async function loginAsMasterUser() {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      MASTER_USER.email,
      MASTER_USER.password
    );
    
    return userCredential.user;
  } catch (error) {
    console.error('❌ Master user login failed:', error);
    throw new Error('Master user login failed');
  }
}

/**
 * Auto-setup Master User เมื่อเปิดแอพครั้งแรก
 */
export async function autoSetupMasterUser() {
  const exists = await checkMasterUserExists();
  
  if (!exists) {
    console.log('🚀 Setting up master user for first time...');
    await createMasterUser();
  }
  
  return exists;
}

// Export master user credentials for development
export const MASTER_CREDENTIALS = {
  email: MASTER_USER.email,
  password: MASTER_USER.password,
};