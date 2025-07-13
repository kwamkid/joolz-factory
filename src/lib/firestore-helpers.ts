// src/lib/firestore-helpers.ts
import { setDoc, doc, DocumentReference } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Safe setDoc ที่ลบ undefined values อัตโนมัติ
 */
export async function safeSetDoc(
  docRef: DocumentReference, 
  data: any, 
  options?: { merge?: boolean }
) {
  // ลบ undefined values
  const cleanData = removeUndefined(data);
  
  console.log('🧹 Cleaned data for Firestore:', cleanData);
  
  return setDoc(docRef, cleanData, options);
}

/**
 * ลบ undefined values จาก object
 */
function removeUndefined(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined).filter(item => item !== undefined);
  }
  
  if (typeof obj === 'object' && obj.constructor === Object) {
    const cleaned: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefined(value);
      }
    }
    
    return cleaned;
  }
  
  return obj;
}

/**
 * Helper สำหรับสร้าง User data ที่ปลอดภัย
 */
export function createSafeUserData(firebaseUser: any) {
  const userData: any = {
    lineId: firebaseUser.uid,
    name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'ไม่ระบุชื่อ',
    roles: ['operation'],
    isActive: true,
    createdAt: new Date(),
  };

  // เพิ่มเฉพาะ field ที่มีค่า
  if (firebaseUser.photoURL) {
    userData.pictureUrl = firebaseUser.photoURL;
  }
  
  if (firebaseUser.phoneNumber) {
    userData.phone = firebaseUser.phoneNumber;
  }

  return userData;
}