// Path: app/api/auth/line/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

// Get environment variables with fallback
const LINE_LOGIN_CHANNEL_ID = process.env.NEXT_PUBLIC_LINE_LOGIN_CHANNEL_ID || '';
const LINE_LOGIN_CHANNEL_SECRET = process.env.LINE_LOGIN_CHANNEL_SECRET || '';
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle LINE login errors
    if (error) {
      console.error('LINE login error:', error, errorDescription);
      return NextResponse.redirect(
        `${NEXT_PUBLIC_APP_URL}/login?error=${encodeURIComponent(errorDescription || error)}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${NEXT_PUBLIC_APP_URL}/login?error=${encodeURIComponent('No authorization code received')}`
      );
    }

    // Validate environment variables
    if (!LINE_LOGIN_CHANNEL_ID || !LINE_LOGIN_CHANNEL_SECRET) {
      console.error('Missing LINE Login credentials in environment variables');
      return NextResponse.redirect(
        `${NEXT_PUBLIC_APP_URL}/login?error=${encodeURIComponent('Server configuration error')}`
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${NEXT_PUBLIC_APP_URL}/api/auth/line/callback`,
        client_id: LINE_LOGIN_CHANNEL_ID,
        client_secret: LINE_LOGIN_CHANNEL_SECRET,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange error:', errorData);
      return NextResponse.redirect(
        `${NEXT_PUBLIC_APP_URL}/login?error=${encodeURIComponent('Failed to authenticate with LINE')}`
      );
    }

    const tokenData = await tokenResponse.json();

    // Get user profile from LINE
    const profileResponse = await fetch('https://api.line.me/v2/profile', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!profileResponse.ok) {
      const errorData = await profileResponse.json();
      console.error('Profile fetch error:', errorData);
      return NextResponse.redirect(
        `${NEXT_PUBLIC_APP_URL}/login?error=${encodeURIComponent('Failed to get user profile')}`
      );
    }

    const profile = await profileResponse.json();

    // Check if user exists in Firestore
    const userRef = doc(db, 'users', profile.userId);
    const userSnap = await getDoc(userRef);

    let userRole = 'operation'; // Default role
    let inviteId = null;

    if (!userSnap.exists()) {
      // New user - check if they have an invitation
      if (state) {
        // State contains the invitation ID
        inviteId = state;
        const inviteRef = doc(db, 'invitations', state);
        const inviteSnap = await getDoc(inviteRef);

        if (inviteSnap.exists() && inviteSnap.data().status === 'pending') {
          userRole = inviteSnap.data().role || 'operation';
          
          // Update invitation status
          await updateDoc(inviteRef, {
            status: 'accepted',
            acceptedAt: new Date(),
            acceptedBy: profile.userId,
          });
        }
      }

      // Create new user
      await setDoc(userRef, {
        uid: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl || null,
        statusMessage: profile.statusMessage || null,
        role: userRole,
        inviteId: inviteId,
        createdAt: new Date(),
        lastLogin: new Date(),
        isActive: true,
      });
    } else {
      // Existing user - update last login
      await updateDoc(userRef, {
        lastLogin: new Date(),
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl || null,
      });
      userRole = userSnap.data().role || 'operation';
    }

    // Create response with auth cookie
    const response = NextResponse.redirect(`${NEXT_PUBLIC_APP_URL}/dashboard`);
    
    // Set secure HTTP-only cookie with user session
    response.cookies.set('auth-token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokenData.expires_in || 2592000, // Default 30 days
      path: '/',
    });

    response.cookies.set('user-id', profile.userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokenData.expires_in || 2592000,
      path: '/',
    });

    response.cookies.set('user-role', userRole, {
      httpOnly: false, // Allow client-side access for role checking
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokenData.expires_in || 2592000,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('LINE callback error:', error);
    return NextResponse.redirect(
      `${NEXT_PUBLIC_APP_URL}/login?error=${encodeURIComponent('An unexpected error occurred')}`
    );
  }
}