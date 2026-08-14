import { jwtVerify } from 'jose';
import type { RumahKeripikJWT } from '../auth-jwt';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'rumah-keripik-jwt-dev-secret'
);

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
    const { payload } = await jwtVerify(token, SECRET);
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
