import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatIdentityFlows, type ChatIdentityFlow } from '@/lib/schema';
import { randomUUID } from 'crypto';

export type IdentityStep =
  | 'ask_prior_order'
  | 'ask_phone_login'
  | 'ask_phone_mismatch'
  | 'ask_name'
  | 'ask_address'
  | 'ask_phone_register'
  | 'ask_use_existing'
  | 'otp_pending'
  | 'complete'
  | 'cancelled';

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

export async function resetIdentityFlow(chatSessionId: string) {
  await updateIdentityFlow(chatSessionId, { step: 'ask_prior_order', purpose: 'checkout_verification', phoneNumber: null, displayName: null, addressText: null, addressNote: null, addressLat: null, addressLng: null, mapsLink: null, otpRequestId: null });
}

export function flowPhoneMask(phone?: string | null) {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length <= 4) return '****';
  return `•••• ${cleaned.slice(-4)}`;
}