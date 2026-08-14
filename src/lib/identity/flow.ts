import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatIdentityFlows, type ChatIdentityFlow } from '@/lib/schema';
import { randomUUID } from 'crypto';

export type IdentityPurpose = 'login' | 'register' | 'checkout_verification';

export async function getOrCreateIdentityFlow(chatSessionId: string): Promise<ChatIdentityFlow | null> {
  const [existing] = await db.select().from(chatIdentityFlows).where(eq(chatIdentityFlows.chatSessionId, chatSessionId)).limit(1);
  if (existing) return existing;
  try {
    const id = `IDF-${randomUUID()}`;
    const [row] = await db
      .insert(chatIdentityFlows)
      .values({ id, chatSessionId, purpose: 'checkout_verification', step: 'ask_prior_order' })
      .returning();
    return row ?? null;
  } catch {
    const [retry] = await db.select().from(chatIdentityFlows).where(eq(chatIdentityFlows.chatSessionId, chatSessionId)).limit(1);
    return retry ?? null;
  }
}

export async function updateIdentityFlow(chatSessionId: string, patch: Partial<Omit<ChatIdentityFlow, 'id' | 'chatSessionId' | 'createdAt' | 'updatedAt'>>) {
  await db
    .update(chatIdentityFlows)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(chatIdentityFlows.chatSessionId, chatSessionId));
}