import { SignJWT, jwtVerify } from 'jose';

export const COOKIE_NAME = 'atelier_session';

function secret() {
  return new TextEncoder().encode(process.env.SESSION_SECRET || 'fallback-secret-change-me');
}

export async function createSession() {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(secret());
}

export async function verifySession(token) {
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}
