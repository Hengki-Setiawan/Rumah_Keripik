import { NextResponse } from 'next/server';
import { eq, lt, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { idempotencyKeys } from '@/lib/schema';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export async function getIdempotentResponse(key: string): Promise<{ response: NextResponse; isNew: boolean } | null> {
  const existing = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, key)).limit(1);
  if (existing.length === 0) return null;

  const expiresAt = new Date(existing[0].expiresAt).getTime();
  if (Date.now() > expiresAt) {
    await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, key));
    return null;
  }

  const data = JSON.parse(existing[0].responseJson);
  return { response: NextResponse.json(data.body, { status: existing[0].status }), isNew: false };
}

export async function saveIdempotentResponse(key: string, response: NextResponse): Promise<void> {
  const clone = response.clone();
  const body = await clone.json().catch(() => ({}));
  const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_MS).toISOString();

  await db.insert(idempotencyKeys).values({
    key,
    responseJson: JSON.stringify({ body, status: response.status }),
    status: response.status,
    expiresAt,
  }).onConflictDoUpdate({
    target: idempotencyKeys.key,
    set: { responseJson: JSON.stringify({ body, status: response.status }), status: response.status, expiresAt },
  });
}

export function extractIdempotencyKey(request: Request): string | null {
  return request.headers.get('Idempotency-Key') || request.headers.get('idempotency-key');
}

export async function withIdempotency(request: Request, handler: () => Promise<NextResponse>): Promise<NextResponse> {
  const key = extractIdempotencyKey(request);
  if (!key) return handler();

  const existing = await getIdempotentResponse(key);
  if (existing) return existing.response;

  const response = await handler();
  if (response.status < 500) await saveIdempotentResponse(key, response);
  return response;
}

export async function cleanupExpiredIdempotencyKeys() {
  const cutoff = new Date(Date.now() - IDEMPOTENCY_TTL_MS).toISOString();
  await db.delete(idempotencyKeys).where(lt(idempotencyKeys.expiresAt, cutoff));
}
