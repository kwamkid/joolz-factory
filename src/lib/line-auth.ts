// src/lib/line-auth.ts
const LINE_LOGIN_URL = 'https://access.line.me/oauth2/v2.1/authorize';
const LINE_TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token';
const LINE_PROFILE_URL = 'https://api.line.me/v2/profile';

export interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export function getLineLoginUrl(state?: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.NEXT_PUBLIC_LINE_LOGIN_CLIENT_ID!,
    redirect_uri: process.env.NEXT_PUBLIC_LINE_LOGIN_REDIRECT_URI!,
    state: state || 'default',
    scope: 'profile openid'
  });

  return `${LINE_LOGIN_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const response = await fetch(LINE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.NEXT_PUBLIC_LINE_LOGIN_REDIRECT_URI!,
      client_id: process.env.NEXT_PUBLIC_LINE_LOGIN_CLIENT_ID!,
      client_secret: process.env.LINE_LOGIN_CLIENT_SECRET!,
    }),
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error('Failed to exchange code for token');
  }

  return data.access_token;
}

export async function getLineProfile(accessToken: string): Promise<LineProfile> {
  const response = await fetch(LINE_PROFILE_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get LINE profile');
  }

  return response.json();
}

// Client-side function to initiate LINE login
export function initiateLineLogin(inviteToken?: string) {
  const state = inviteToken ? `invite:${inviteToken}` : 'login';
  const loginUrl = getLineLoginUrl(state);
  window.location.href = loginUrl;
}