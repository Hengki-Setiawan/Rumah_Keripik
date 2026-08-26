import { jwtVerify } from 'jose';
import type { RumahKeripikJWT } from '../auth-jwt';

function getSecret(): Uint8Array {
  const jwtSecret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET (atau NEXTAUTH_SECRET) wajib di-set untuk autentikasi kurir');
  }
  return new TextEncoder().encode(jwtSecret);
}

export interface AuthResult {
  courierId: number;
  sessionId: string;
  role: string;
}

export async function verifyCourierAuth(request: Request): Promise<AuthResult | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const jwt = payload as unknown as RumahKeripikJWT;
    if (jwt.role !== 'courier') return null;
    return {
      courierId: Number(jwt.sub),
      sessionId: jwt.sessionId,
      role: jwt.role,
    };
  } catch {
    return null;
  }
}
