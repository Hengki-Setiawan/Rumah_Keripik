/**
 * Memory Engine — 3 Layer Memory System
 *
 * Layer 1: Session Memory (Short-term) — context_sesi in pelanggan_chatbot
 * Layer 2: Episodic Memory (Mid-term) — memory_pelanggan table
 * Layer 3: Semantic Memory (Long-term) — ai_knowledge_base + skill_library
 */

import { db } from './db';
import * as schema from './schema';
import { eq, sql } from 'drizzle-orm';
import type { OrderContext } from './order-types';

// ─── LAYER 2: EPISODIC MEMORY ─────────────────────────────────────────

/**
 * Get atau create memory untuk pelanggan
 */
export async function getOrCreateMemory(no_wa: string) {
  let memory = await db
    .select()
    .from(schema.memoryPelanggan)
    .where(eq(schema.memoryPelanggan.no_wa_pelanggan, no_wa))
    .limit(1)
    .then((r) => r[0]);

  if (!memory) {
    await db.insert(schema.memoryPelanggan).values({
      no_wa_pelanggan: no_wa,
    });
    memory = await db
      .select()
      .from(schema.memoryPelanggan)
      .where(eq(schema.memoryPelanggan.no_wa_pelanggan, no_wa))
      .limit(1)
      .then((r) => r[0]);
  }

  return memory;
}

/**
 * After successful order — update episodic memory
 */
export async function updateMemoryAfterOrder(
  no_wa: string,
  ctx: OrderContext,
  rating?: number,
) {
  try {
    const memory = await getOrCreateMemory(no_wa);
    const cart = ctx.cart || [];
    const produkFavorit: string[] = JSON.parse(memory.produk_favorit || '[]') || [];
    const waitlist: string[] = JSON.parse(memory.waitlist_produk || '[]') || [];

    for (const item of cart) {
      if (!produkFavorit.includes(item.id_produk)) {
        produkFavorit.push(item.id_produk);
      }
    }

    const totalOrder = (memory.total_order || 0) + 1;
    const avgOrderValue = memory.avg_order_value || 0;
    const newAvgOrderValue = Math.round(
      ((avgOrderValue * (totalOrder - 1)) + (ctx.total_bayar || 0)) / totalOrder,
    );

    const avgRating = memory.avg_rating || 0;
    const newAvgRating = rating
      ? Math.round(((avgRating * (totalOrder - 1)) + (rating * 10)) / totalOrder)
      : avgRating;

    await db
      .update(schema.memoryPelanggan)
      .set({
        produk_favorit: JSON.stringify(produkFavorit.slice(0, 10)),
        total_order: totalOrder,
        avg_order_value: newAvgOrderValue,
        avg_rating: newAvgRating,
        last_order_id: ctx.id_transaksi || memory.last_order_id,
        last_order_date: new Date().toISOString(),
        alamat_tersimpan: ctx.alamat_pengiriman
          ? JSON.stringify([{
              label: 'Alamat Terakhir',
              alamat: ctx.alamat_pengiriman,
              lat: ctx.lat_pengiriman,
              lng: ctx.lng_pengiriman,
            }])
          : memory.alamat_tersimpan,
      })
      .where(eq(schema.memoryPelanggan.no_wa_pelanggan, no_wa));
  } catch (err) {
    console.warn('[MemoryEngine] updateMemoryAfterOrder error:', err);
  }
}

/**
 * Save rating from customer
 */
export async function saveRating(
  no_wa: string,
  rating: number,
  feedbackText?: string,
  id_transaksi?: string,
) {
  try {
    await db.insert(schema.ratingPelanggan).values({
      no_wa_pelanggan: no_wa,
      id_transaksi: id_transaksi || null,
      rating,
      feedback_text: feedbackText || null,
    });
  } catch (err) {
    console.warn('[MemoryEngine] saveRating error:', err);
  }
}

/**
 * Build personalized greeting from memory
 */
export async function buildPersonalizedGreeting(no_wa: string): Promise<string | null> {
  try {
    const memory = await getOrCreateMemory(no_wa);
    if (!memory || !memory.total_order || memory.total_order === 0) return null;

    const produkFavorit: string[] = JSON.parse(memory.produk_favorit || '[]');
    const [favProduct] = await db
      .select({ nama: sql<string>`nama_produk` })
      .from(schema.produk)
      .where(eq(schema.produk.id_produk, produkFavorit[0]))
      .limit(1)
      .then((r) => r);

    if (favProduct) {
      return `Senang bertemu lagi! Biasanya Kakak pesan *${favProduct.nama}* — mau pesan yang sama lagi? 😊`;
    }

    return `Senang bertemu lagi kak! Ada yang bisa kami bantu hari ini? 😊`;
  } catch {
    return null;
  }
}

// ─── LAYER 3: SEMANTIC / SELF-LEARNING ─────────────────────────────────

/**
 * Learn from successful interaction — add to skill library
 */
export async function learnFromInteraction(
  triggerPattern: string,
  responseTemplate: string,
  rating?: number,
) {
  try {
    const existing = await db
      .select()
      .from(schema.skillLibrary)
      .where(eq(schema.skillLibrary.trigger_pattern, triggerPattern))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.skillLibrary)
        .set({
          success_count: sql`success_count + 1`,
          avg_rating: rating ? sql`${(rating * 10)}` : undefined,
        })
        .where(eq(schema.skillLibrary.id, existing[0].id));
    } else {
      await db.insert(schema.skillLibrary).values({
        judul: `Auto-learned: ${triggerPattern.slice(0, 50)}`,
        trigger_pattern: triggerPattern,
        response_template: responseTemplate,
        success_count: 1,
        avg_rating: rating ? rating * 10 : 0,
      });
    }
  } catch (err) {
    console.warn('[MemoryEngine] learnFromInteraction error:', err);
  }
}
