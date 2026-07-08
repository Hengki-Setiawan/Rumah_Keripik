import { createHash } from 'crypto';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatCarts, chatSessions, customerSessions } from '@/lib/schema';
import { generateIdChatCart, generateIdChatSession, generateIdCustomerSession, generateSecureSessionToken } from '@/lib/id-generator';
import { getClientIp } from '@/lib/rate-limit';

export const CUSTOMER_SESSION_COOKIE = 'rk_customer_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export function getCustomerSessionMaxAge() {
  return SESSION_MAX_AGE_SECONDS;
}

export function hashCustomerSessionToken(token: string) {
  const secret = process.env.CUSTOMER_SESSION_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'rumah-keripik-dev-secret';
  return createHash('sha256').update(`${token}:${secret}`).digest('hex');
}

function hashOptional(value: string | null | undefined) {
  if (!value) return null;
  return createHash('sha256').update(value).digest('hex');
}

function expiresAt() {
  return new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
}

export async function ensureCustomerSession(req: Request, token?: string) {
  const tokenToUse = token || generateSecureSessionToken();
  const tokenHash = hashCustomerSessionToken(tokenToUse);

  const [existing] = await db
    .select()
    .from(customerSessions)
    .where(and(eq(customerSessions.sessionTokenHash, tokenHash), isNull(customerSessions.revokedAt)))
    .limit(1);

  if (existing) {
    await db
      .update(customerSessions)
      .set({ lastSeenAt: sql`(datetime('now', 'utc'))` })
      .where(eq(customerSessions.id, existing.id));
    return { session: existing, token: tokenToUse, isNew: false };
  }

  const sessionId = generateIdCustomerSession();
  const userAgent = req.headers.get('user-agent');
  const ip = getClientIp(req);
  await db.insert(customerSessions).values({
    id: sessionId,
    sessionTokenHash: tokenHash,
    anonymousLabel: `Tamu ${sessionId.slice(-6).toUpperCase()}`,
    userAgentHash: hashOptional(userAgent),
    ipHash: hashOptional(ip),
    expiresAt: expiresAt(),
  });

  const [created] = await db.select().from(customerSessions).where(eq(customerSessions.id, sessionId)).limit(1);
  if (!created) throw new Error('Gagal membuat customer session');
  return { session: created, token: tokenToUse, isNew: true };
}

export async function ensureActiveChatSession(customerSessionId: string) {
  const [existing] = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.customerSessionId, customerSessionId), eq(chatSessions.status, 'active')))
    .orderBy(desc(chatSessions.updatedAt))
    .limit(1);

  if (existing) {
    await ensureActiveCart(existing.id, existing.customerId);
    return { chatSession: existing, isNew: false };
  }

  return createChatSession(customerSessionId);
}

export async function createChatSession(customerSessionId: string) {
  const chatSessionId = generateIdChatSession();
  await db
    .update(chatSessions)
    .set({
      status: 'archived',
      updatedAt: sql`(datetime('now', 'utc'))`,
    })
    .where(and(eq(chatSessions.customerSessionId, customerSessionId), eq(chatSessions.status, 'active')));
  await db.insert(chatSessions).values({
    id: chatSessionId,
    customerSessionId,
    title: 'Pesanan Baru',
    status: 'active',
    aiMode: 'enabled',
  });

  await ensureActiveCart(chatSessionId, null);
  const [created] = await db.select().from(chatSessions).where(eq(chatSessions.id, chatSessionId)).limit(1);
  if (!created) throw new Error('Gagal membuat chat session');
  return { chatSession: created, isNew: true };
}

export async function ensureActiveCart(chatSessionId: string, customerId?: string | null) {
  const [existing] = await db
    .select()
    .from(chatCarts)
    .where(and(eq(chatCarts.chatSessionId, chatSessionId), eq(chatCarts.status, 'active')))
    .limit(1);

  if (existing) return existing;

  const id = generateIdChatCart();
  await db.insert(chatCarts).values({
    id,
    chatSessionId,
    customerId: customerId || null,
    status: 'active',
  });
  const [created] = await db.select().from(chatCarts).where(eq(chatCarts.id, id)).limit(1);
  if (!created) throw new Error('Gagal membuat cart chat');
  return created;
}
