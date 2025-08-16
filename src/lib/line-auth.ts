// lib/line-auth.ts
import { signInWithCustomToken } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

const LINE_AUTH_URL = 'https://access.line.me/oauth2/v2.1/authorize';
const LINE_CALLBACK_URL = process.env.NEXT_PUBLIC_LINE_CALLBACK_URL || 'http://localhost:3000/api/auth/line/callback';

export interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export function getLineLoginUrl(): string {
  const clientId = process.env.NEXT_PUBLIC_LINE_CLIENT_ID;
  const callbackUrl = process.env.NEXT_PUBLIC_LINE_CALLBACK_URL || 'http://localhost:3000/api/auth/line/callback';
  
  if (!clientId) {
    console.error('LINE Client ID not found in environment variables');
    throw new Error('LINE Client ID is not configured');
  }
  
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: callbackUrl,
    state: 'joolz_factory_login',
    scope: 'profile openid'
  });

  console.log('LINE Login URL params:', {
    client_id: clientId,
    redirect_uri: callbackUrl
  });

  return `${LINE_AUTH_URL}?${params.toString()}`;
}

export async function handleLineCallback(code: string): Promise<LineProfile> {
  try {
    // Call backend API to exchange code for profile
    const response = await fetch('/api/auth/line/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });

    if (!response.ok) {
      throw new Error('Failed to authenticate with LINE');
    }

    const data = await response.json();
    return data.profile;
  } catch (error) {
    console.error('LINE callback error:', error);
    throw error;
  }
}

export async function signInWithLine(profile: LineProfile) {
  try {
    // Call backend to create custom token
    const response = await fetch('/api/auth/line/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile })
    });

    if (!response.ok) {
      throw new Error('Failed to create auth token');
    }

    const { customToken } = await response.json();
    
    // Sign in with custom token
    await signInWithCustomToken(auth, customToken);
    
    // Check if user exists in Firestore
    const userDoc = await getDoc(doc(db, 'users', profile.userId));
    
    if (!userDoc.exists()) {
      // Create new user with operation role by default
      await setDoc(doc(db, 'users', profile.userId), {
        email: `${profile.userId}@line.user`,
        name: profile.displayName,
        role: 'operation',
        lineId: profile.userId,
        pictureUrl: profile.pictureUrl,
        createdAt: new Date()
      });
    }
  } catch (error) {
    console.error('Sign in with LINE error:', error);
    throw error;
  }
}