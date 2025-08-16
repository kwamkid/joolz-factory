// app/api/auth/line/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }),
  });
}

const adminAuth = getAdminAuth();
const adminDb = getAdminFirestore();

// LINE API URLs
const LINE_TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token';
const LINE_PROFILE_URL = 'https://api.line.me/v2/profile';

export async function GET(request: NextRequest) {
  console.log('LINE Callback started');
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    console.log('Callback params:', { code: code?.substring(0, 10) + '...', state, error });

    // Handle LINE OAuth errors
    if (error) {
      console.error('LINE OAuth error:', error);
      return NextResponse.redirect(new URL('/login?error=line_denied', request.url));
    }

    if (!code) {
      console.error('No code received');
      return NextResponse.redirect(new URL('/login?error=no_code', request.url));
    }

    // Log environment variables (without exposing secrets)
    console.log('Environment check:', {
      hasClientId: !!process.env.NEXT_PUBLIC_LINE_CLIENT_ID,
      hasClientSecret: !!process.env.LINE_CLIENT_SECRET,
      hasCallbackUrl: !!process.env.NEXT_PUBLIC_LINE_CALLBACK_URL,
      callbackUrl: process.env.NEXT_PUBLIC_LINE_CALLBACK_URL,
    });

    // Exchange code for access token
    const tokenResponse = await fetch(LINE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.NEXT_PUBLIC_LINE_CALLBACK_URL || '',
        client_id: process.env.NEXT_PUBLIC_LINE_CLIENT_ID || '',
        client_secret: process.env.LINE_CLIENT_SECRET || '',
      }),
    });

    const tokenText = await tokenResponse.text();
    console.log('Token response status:', tokenResponse.status);
    
    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenText);
      return NextResponse.redirect(new URL('/login?error=token_exchange_failed', request.url));
    }

    const tokenData = JSON.parse(tokenText);
    console.log('Token received successfully');
    const accessToken = tokenData.access_token;

    // Get user profile from LINE
    const profileResponse = await fetch(LINE_PROFILE_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!profileResponse.ok) {
      console.error('Profile fetch failed:', await profileResponse.text());
      return NextResponse.redirect(new URL('/login?error=profile_fetch_failed', request.url));
    }

    const profile = await profileResponse.json();

    // Create or update Firebase user
    let firebaseUser;
    try {
      // Try to get existing user
      firebaseUser = await adminAuth.getUser(profile.userId);
    } catch (error) {
      // User doesn't exist, create new one
      firebaseUser = await adminAuth.createUser({
        uid: profile.userId,
        displayName: profile.displayName,
        photoURL: profile.pictureUrl,
      });
    }

    // Create or update user document in Firestore
    const userRef = adminDb.collection('users').doc(profile.userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // New user - set as operation role by default
      await userRef.set({
        email: `${profile.userId}@line.user`,
        name: profile.displayName,
        role: 'operation',
        lineId: profile.userId,
        pictureUrl: profile.pictureUrl,
        createdAt: new Date(),
      });
    } else {
      // Existing user - update profile info
      await userRef.update({
        name: profile.displayName,
        pictureUrl: profile.pictureUrl,
        lastLogin: new Date(),
      });
    }

    // Create custom token for client-side authentication
    const customToken = await adminAuth.createCustomToken(profile.userId);

    // Redirect to client with custom token
    const redirectUrl = new URL('/line-success', request.url);
    redirectUrl.searchParams.set('token', customToken);
    
    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    console.error('LINE callback error details:', error);
    console.error('Error type:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.redirect(new URL('/login?error=callback_failed', request.url));
  }
}