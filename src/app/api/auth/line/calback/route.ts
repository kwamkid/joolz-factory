// src/app/api/auth/line/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { signInWithCustomToken } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { exchangeCodeForToken, getLineProfile } from '@/lib/line-auth';
import { User, UserRole } from '@/types';

// Import Firebase Admin SDK for custom token creation
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(new URL('/login?error=access_denied', request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/login?error=no_code', request.url));
    }

    // Exchange code for access token
    const accessToken = await exchangeCodeForToken(code);
    
    // Get LINE profile
    const lineProfile = await getLineProfile(accessToken);

    // Check if this is an invitation
    let inviteToken: string | null = null;
    let assignedRoles: UserRole[] = ['operation'];

    if (state && state.startsWith('invite:')) {
      inviteToken = state.replace('invite:', '');
      
      // Get invitation details from Firestore
      const inviteDoc = await getDoc(doc(db, 'invitations', inviteToken));
      
      if (inviteDoc.exists()) {
        const inviteData = inviteDoc.data();
        
        if (inviteData.isUsed) {
          return NextResponse.redirect(new URL('/login?error=invite_used', request.url));
        }
        
        if (inviteData.expiresAt.toDate() < new Date()) {
          return NextResponse.redirect(new URL('/login?error=invite_expired', request.url));
        }
        
        assignedRoles = inviteData.roles || ['operation'];
        
        // Mark invitation as used
        await updateDoc(doc(db, 'invitations', inviteToken), {
          isUsed: true,
          usedAt: new Date(),
          usedBy: lineProfile.userId,
        });
      }
    }

    // Create or update user in Firestore
    const userRef = doc(db, 'users', lineProfile.userId);
    const userDoc = await getDoc(userRef);

    const userData: Omit<User, 'id'> = {
      lineId: lineProfile.userId,
      name: lineProfile.displayName,
      pictureUrl: lineProfile.pictureUrl,
      roles: assignedRoles,
      isActive: true,
      createdAt: new Date(),
    };

    if (!userDoc.exists()) {
      // New user
      await setDoc(userRef, userData);
    } else {
      // Existing user - update profile but keep existing roles unless it's an invitation
      const existingData = userDoc.data();
      await updateDoc(userRef, {
        name: lineProfile.displayName,
        pictureUrl: lineProfile.pictureUrl,
        ...(inviteToken && { roles: assignedRoles }), // Only update roles if it's an invitation
      });
    }

    // Create custom token for Firebase Auth
    const adminAuth = getAdminAuth();
    const customToken = await adminAuth.createCustomToken(lineProfile.userId);

    // Redirect to a page that will handle the sign-in
    const redirectUrl = new URL('/auth/signin', request.url);
    redirectUrl.searchParams.set('token', customToken);
    
    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    console.error('LINE callback error:', error);
    return NextResponse.redirect(new URL('/login?error=callback_failed', request.url));
  }
}

// src/app/auth/signin/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import toast from 'react-hot-toast';

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (token) {
      signInWithCustomToken(auth, token)
        .then(() => {
          toast.success('เข้าสู่ระบบสำเร็จ!');
          router.push('/dashboard');
        })
        .catch((error) => {
          console.error('Sign in error:', error);
          toast.error('เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
          router.push('/login?error=signin_failed');
        });
    } else {
      router.push('/login?error=no_token');
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">กำลังเข้าสู่ระบบ...</p>
      </div>
    </div>
  );
}