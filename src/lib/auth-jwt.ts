import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { randomBytes } from 'crypto';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'rumah-keripik-jwt-dev-secret'
);

export interface RumahKeripikJWT extends JWTPayload {
  sub: string;
  role: 'courier' | 'mobile_customer' | 'admin';
  sessionId: string;
  name?: string;
}

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '30d';

export async function signAccessToken(payload: Omit<RumahKeripikJWT, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(SECRET);
}

export async function signRefreshToken(payload: Omit<RumahKeripikJWT, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_TTL)
    .sign(SECRET);
}

export async function verifyAccessToken(token: string): Promise<RumahKeripikJWT | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as RumahKeripikJWT;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<RumahKeripikJWT | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as RumahKeripikJWT;
  } catch {
    return null;
  }
}

export function generateRefreshTokenId(): string {
  return `RFT-${randomBytes(16).toString('hex')}`;
}

export interface AuthResult {
  authenticated: boolean;
  payload: RumahKeripikJWT | null;
  error?: string;
}

export async function verifyBearerAuth(req: Request): Promise<AuthResult> {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    return { authenticated: false, payload: null, error: 'Authorization header tidak ditemukan' };
  }
  const token = header.slice(7);
  const payload = await verifyAccessToken(token);
  if (!payload) {
    return { authenticated: false, payload: null, error: 'Token tidak valid atau kadaluarsa' };
  }
  return { authenticated: true, payload };
}
