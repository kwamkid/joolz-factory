// Path: src/app/api/auth/line/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

// Disable caching for this route
export const dynamic = 'force-dynamic';

// Safe environment variable getter
function getEnvVar(key: string, required: boolean = true): string {
  const value = process.env[key];
  if (required && !value) {
    console.error(`Missing required environment variable: ${key}`);
    return '';
  }
  return value || '';
}

// Initialize Firebase Admin (only if all required env vars exist)
function initFirebaseAdmin() {
  if (getApps().length > 0) {
    return true;
  }

  const projectId = getEnvVar('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
  const clientEmail = getEnvVar('FIREBASE_ADMIN_CLIENT_EMAIL');
  const privateKeyRaw = getEnvVar('FIREBASE_ADMIN_PRIVATE_KEY');

  if (!projectId || !clientEmail || !privateKeyRaw) {
    console.error('Firebase Admin initialization skipped - missing credentials');
    return false;
  }

  try {
    // Safe replace operation
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
    
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    console.log('Firebase Admin initialized successfully');
    return true;
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    return false;
  }
}

// LINE API URLs
const LINE_TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token';
const LINE_PROFILE_URL = 'https://api.line.me/v2/profile';

export async function GET(request: NextRequest) {
  console.log('LINE Callback started');
  
  try {
    // Initialize Firebase Admin
    const adminInitialized = initFirebaseAdmin();
    if (!adminInitialized) {
      console.error('Firebase Admin not initialized');
      return NextResponse.redirect(new URL('/login?error=server_error', request.url));
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminFirestore();

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

    // Get environment variables
    const clientId = getEnvVar('NEXT_PUBLIC_LINE_CLIENT_ID');
    const clientSecret = getEnvVar('LINE_CLIENT_SECRET');
    const callbackUrl = getEnvVar('NEXT_PUBLIC_LINE_CALLBACK_URL');

    if (!clientId || !clientSecret || !callbackUrl) {
      console.error('Missing LINE OAuth configuration');
      return NextResponse.redirect(new URL('/login?error=server_config', request.url));
    }

    // Exchange code for access token
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const tokenResponse = await fetch(LINE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token exchange failed:', error);
      return NextResponse.redirect(new URL('/login?error=token_exchange_failed', request.url));
    }

    const tokenData = await tokenResponse.json();
    const { access_token } = tokenData;

    // Get LINE profile
    const profileResponse = await fetch(LINE_PROFILE_URL, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!profileResponse.ok) {
      const error = await profileResponse.text();
      console.error('Profile fetch failed:', error);
      return NextResponse.redirect(new URL('/login?error=profile_fetch_failed', request.url));
    }

    const profile = await profileResponse.json();
    console.log('LINE profile fetched:', { userId: profile.userId });

    // Check if user exists in our database
    let userDoc = await adminDb.collection('users').doc(profile.userId).get();
    
    if (!userDoc.exists) {
      console.log('New user, checking invitation...');
      
      // Check if there's a valid invitation using state parameter
      if (state && state !== 'normal_login' && state !== 'joolz_factory_login') {
        const inviteSnap = await adminDb.collection('invitations')
          .where('token', '==', state)
          .where('status', '==', 'pending')
          .limit(1)
          .get();

        if (!inviteSnap.empty) {
          const invite = inviteSnap.docs[0];
          const inviteData = invite.data();
          
          // Check if invitation is expired
          const expiresAt = inviteData.expiresAt?.toDate() || new Date();
          if (new Date() > expiresAt) {
            console.log('Invitation expired');
            return NextResponse.redirect(new URL('/login?error=invitation_expired', request.url));
          }
          
          console.log('Valid invitation found:', inviteData.role);

          // Create new user with invited role
          await adminDb.collection('users').doc(profile.userId).set({
            uid: profile.userId,
            email: `${profile.userId}@line.user`,
            name: profile.displayName,
            displayName: profile.displayName,
            photoURL: profile.pictureUrl || null,
            pictureUrl: profile.pictureUrl || null,
            role: inviteData.role,
            provider: 'line',
            lineId: profile.userId,
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true,
          });

          // Update invitation status
          await invite.ref.update({
            status: 'used',
            used: true,
            usedBy: profile.userId,
            usedAt: new Date(),
          });

          console.log('User created with role:', inviteData.role);
        } else {
          console.log('No valid invitation found for token:', state);
          return NextResponse.redirect(new URL('/login?error=invalid_invitation', request.url));
        }
      } else {
        console.log('No invitation token provided');
        return NextResponse.redirect(new URL('/login?error=no_invitation', request.url));
      }
    } else {
      console.log('Existing user found');
      
      // Update user info
      await userDoc.ref.update({
        displayName: profile.displayName,
        photoURL: profile.pictureUrl || null,
        pictureUrl: profile.pictureUrl || null,
        lastLogin: new Date(),
        updatedAt: new Date(),
      });
    }

    // Create custom token
    const customToken = await adminAuth.createCustomToken(profile.userId);
    console.log('Custom token created');

    // Create response with custom token - redirect to auth/line-success
    const redirectUrl = new URL('/line-success', request.url);
    redirectUrl.searchParams.set('token', customToken);
    
    console.log('Redirecting to /line-success with token');
    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    console.error('LINE callback error:', error);
    return NextResponse.redirect(new URL('/login?error=callback_failed', request.url));
  }
}