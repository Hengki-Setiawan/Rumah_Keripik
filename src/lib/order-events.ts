import { eq, sql } from 'drizzle-orm';
import { db } from './db';
import { orderDraft, orderEvents } from './schema';
import type { OrderContext } from './order-types';

export async function logOrderEvent(params: {
  no_wa: string;
  event: string;
  id_transaksi?: string | null;
  payload?: unknown;
}) {
  try {
    await db.insert(orderEvents).values({
      no_wa_pelanggan: params.no_wa,
      id_transaksi: params.id_transaksi || null,
      event_type: params.event,
      event_payload: params.payload ? JSON.stringify(params.payload) : null,
    });
  } catch (error) {
    console.warn('[OrderEvents] log failed:', error);
  }
}

export async function syncOrderDraft(no_wa: string, ctx: OrderContext) {
  try {
    const status = getDraftStatus(ctx);
    const channel = no_wa.startsWith('tg_') ? 'telegram' : 'wa';

    const [existing] = await db
      .select()
      .from(orderDraft)
      .where(eq(orderDraft.no_wa_pelanggan, no_wa))
      .orderBy(sql`${orderDraft.updated_at} DESC`)
      .limit(1);

    const contextJson = JSON.stringify(ctx);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    if (!existing || existing.status === 'Completed' || existing.status === 'Cancelled') {
      if (status === 'Cancelled' || status === 'Completed') return;
      await db.insert(orderDraft).values({
        no_wa_pelanggan: no_wa,
        channel,
        status,
        id_transaksi: ctx.id_transaksi || null,
        context_json: contextJson,
        expires_at: expiresAt,
      });
      return;
    }

    await db
      .update(orderDraft)
      .set({
        status,
        id_transaksi: ctx.id_transaksi || existing.id_transaksi,
        context_json: contextJson,
        expires_at: expiresAt,
        updated_at: sql`(datetime('now', 'utc'))`,
      })
      .where(eq(orderDraft.id, existing.id));
  } catch (error) {
    console.warn('[OrderEvents] draft sync failed:', error);
  }
}

export async function closeOrderDraft(no_wa: string, status: 'Completed' | 'Cancelled') {
  try {
    const [existing] = await db
      .select()
      .from(orderDraft)
      .where(eq(orderDraft.no_wa_pelanggan, no_wa))
      .orderBy(sql`${orderDraft.updated_at} DESC`)
      .limit(1);

    if (!existing) return;

    await db
      .update(orderDraft)
      .set({ status, updated_at: sql`(datetime('now', 'utc'))` })
      .where(eq(orderDraft.id, existing.id));
  } catch (error) {
    console.warn('[OrderEvents] draft close failed:', error);
  }
}

function getDraftStatus(ctx: OrderContext): 'Profil_Pending' | 'Cart_Pending' | 'Menunggu_Bayar' | 'Menunggu_Verifikasi' | 'Completed' | 'Cancelled' {
  if (ctx.step === 'DIBATALKAN') return 'Cancelled';
  if (ctx.step === 'SELESAI' || ctx.step === 'TERVERIFIKASI') return 'Completed';
  if (ctx.step === 'BUKTI_DITERIMA') return 'Menunggu_Verifikasi';
  if (ctx.step === 'DRAFT_TERSIMPAN') return 'Menunggu_Bayar';
  if (ctx.step === 'FORM_NAMA' || ctx.step === 'FORM_ALAMAT' || ctx.step === 'FORM_NOHP' || ctx.step === 'CONFIRM_ALAMAT' || ctx.step === 'REKAP_ORDER') {
    return 'Profil_Pending';
  }
  return 'Cart_Pending';
}
