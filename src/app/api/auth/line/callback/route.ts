// src/app/api/auth/line/callback/route.ts
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
    console.log('LINE Profile received:', { userId: profile.userId, displayName: profile.displayName });

    // Check if this is an invite flow
    let inviteToken = null;
    let inviteData = null;
    
    if (state && state.startsWith('invite_')) {
      inviteToken = state.replace('invite_', '');
      console.log('Processing invite token:', inviteToken);
      
      // Find the invitation
      const inviteQuery = await adminDb.collection('invitations')
        .where('token', '==', inviteToken)
        .limit(1)
        .get();
      
      if (!inviteQuery.empty) {
        const inviteDoc = inviteQuery.docs[0];
        inviteData = inviteDoc.data();
        
        // Check if invite is valid
        if (inviteData.used) {
          console.log('Invite already used');
          return NextResponse.redirect(new URL('/login?error=invite_used', request.url));
        }
        
        // Check if expired
        const expiresAt = inviteData.expiresAt.toDate();
        if (new Date() > expiresAt) {
          console.log('Invite expired');
          return NextResponse.redirect(new URL('/login?error=invite_expired', request.url));
        }
        
        console.log('Valid invite found, role:', inviteData.role);
      } else {
        console.log('Invite token not found');
        return NextResponse.redirect(new URL('/login?error=invite_not_found', request.url));
      }
    }

    // Create or update Firebase user
    let firebaseUser;
    try {
      // Try to get existing user
      firebaseUser = await adminAuth.getUser(profile.userId);
      console.log('Existing user found');
    } catch (error) {
      // User doesn't exist, create new one
      firebaseUser = await adminAuth.createUser({
        uid: profile.userId,
        displayName: profile.displayName,
        photoURL: profile.pictureUrl,
      });
      console.log('New user created');
    }

    // Create or update user document in Firestore
    const userRef = adminDb.collection('users').doc(profile.userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // New user
      const role = inviteData ? inviteData.role : 'operation'; // Use invite role or default to operation
      
      await userRef.set({
        email: `${profile.userId}@line.user`,
        name: profile.displayName,
        role: role,
        lineId: profile.userId,
        pictureUrl: profile.pictureUrl,
        createdAt: new Date(),
        lastLogin: new Date(),
        invitedBy: inviteData ? inviteData.createdBy : null,
        inviteToken: inviteToken,
      });
      
      console.log('New user created with role:', role);
      
      // Mark invitation as used
      if (inviteData && inviteToken) {
        const inviteQuery = await adminDb.collection('invitations')
          .where('token', '==', inviteToken)
          .limit(1)
          .get();
        
        if (!inviteQuery.empty) {
          await inviteQuery.docs[0].ref.update({
            used: true,
            usedBy: profile.displayName,
            usedAt: new Date(),
          });
          console.log('Invitation marked as used');
        }
      }
    } else {
      // Existing user - update profile info
      await userRef.update({
        name: profile.displayName,
        pictureUrl: profile.pictureUrl,
        lastLogin: new Date(),
      });
      console.log('Existing user updated');
    }

    // Create custom token for client-side authentication
    const customToken = await adminAuth.createCustomToken(profile.userId);

    // Redirect to client with custom token
    const redirectUrl = new URL('/line-success', request.url);
    redirectUrl.searchParams.set('token', customToken);
    
    // Add invite success flag if this was an invite flow
    if (inviteData) {
      redirectUrl.searchParams.set('invited', 'true');
      redirectUrl.searchParams.set('role', inviteData.role);
    }
    
    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    console.error('LINE callback error details:', error);
    console.error('Error type:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.redirect(new URL('/login?error=callback_failed', request.url));
  }
}