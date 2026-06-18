import { NextResponse } from 'next/server';
import { createSession, COOKIE_NAME } from '@/lib/auth';

export async function POST(request) {
  const { email, password } = await request.json();

  if (email !== process.env.APP_EMAIL || password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: 'Email ou mot de passe incorrect.' }, { status: 401 });
  }

  const token = await createSession();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  });
  return response;
}
