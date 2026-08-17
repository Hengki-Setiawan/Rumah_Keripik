import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { stockWatch, produk, produkVarian, chatSessions, adminNotifications } from '@/lib/schema';
import { createChatMessage } from '@/lib/chat-v3/messages';
import { generateSecureSessionToken } from '@/lib/id-generator';
import { createAdminNotification } from '@/lib/admin-notifications';

function generateStockWatchId(): string {
  return `sw_${generateSecureSessionToken().slice(0, 16)}`;
}

export interface SubscribeStockWatchInput {
  chatSessionId: string;
  idProduk: string;
  idVarian?: string | null;
}

/** Daftarkan sesi chat ke daftar tunggu stok suatu produk. Idempotent. */
export async function subscribeStockWatch({ chatSessionId, idProduk, idVarian = null }: SubscribeStockWatchInput) {
  const existing = await db
    .select({ id: stockWatch.id })
    .from(stockWatch)
    .where(and(
      eq(stockWatch.chatSessionId, chatSessionId),
      eq(stockWatch.idProduk, idProduk),
      idVarian ? eq(stockWatch.idVarian, idVarian) : sql`${stockWatch.idVarian} IS NULL`,
      eq(stockWatch.status, 'watching')
    ))
    .limit(1);

  if (existing.length > 0) return { ok: true, alreadyWatching: true };

  await db.insert(stockWatch).values({
    id: generateStockWatchId(),
    chatSessionId,
    idProduk,
    idVarian,
    status: 'watching',
  });
  return { ok: true, alreadyWatching: false };
}

/** Batalkan watch. Idempotent. */
export async function cancelStockWatch(chatSessionId: string, idProduk: string, idVarian?: string | null) {
  await db
    .update(stockWatch)
    .set({ status: 'cancelled', notifiedAt: sql`(datetime('now', 'utc'))` })
    .where(and(
      eq(stockWatch.chatSessionId, chatSessionId),
      eq(stockWatch.idProduk, idProduk),
      idVarian ? eq(stockWatch.idVarian, idVarian) : sql`${stockWatch.idVarian} IS NULL`,
      eq(stockWatch.status, 'watching')
    ));
  return { ok: true };
}

/** Cron: cari watch aktif yang produk/variannya sudah punya stok > 0, kirim notifikasi chat, tandai notified. */
export async function processBackInStockNotifications(): Promise<{ notified: number }> {
  const activeWatches = await db
    .select({
      id: stockWatch.id,
      chatSessionId: stockWatch.chatSessionId,
      idProduk: stockWatch.idProduk,
      idVarian: stockWatch.idVarian,
    })
    .from(stockWatch)
    .where(eq(stockWatch.status, 'watching'))
    .limit(200);

  let notified = 0;

  for (const watch of activeWatches) {
    let hasStock = false;

    if (watch.idVarian) {
      const [varian] = await db
        .select({ stok: produkVarian.stok, isActive: produkVarian.is_active })
        .from(produkVarian)
        .where(and(eq(produkVarian.id_varian, watch.idVarian), eq(produkVarian.is_active, 1)))
        .limit(1);
      hasStock = varian ? varian.stok > 0 : false;
    } else {
      const [p] = await db
        .select({ stok: produk.stok_gudang_utama, isActive: produk.is_active })
        .from(produk)
        .where(and(eq(produk.id_produk, watch.idProduk), eq(produk.is_active, 1)))
        .limit(1);
      hasStock = p ? p.stok > 0 : false;
    }

    if (!hasStock) continue;

    const [prod] = await db
      .select({ nama: produk.nama_produk })
      .from(produk)
      .where(eq(produk.id_produk, watch.idProduk))
      .limit(1);
    const productName = prod?.nama ?? 'Produk yang ditunggu';

    const session = await db
      .select({ aiMode: chatSessions.aiMode })
      .from(chatSessions)
      .where(eq(chatSessions.id, watch.chatSessionId))
      .limit(1);
    if (!session) continue;

    await createChatMessage({
      chatSessionId: watch.chatSessionId,
      role: 'system',
      content: `Kabar baik kak! ${productName} sudah tersedia lagi di Rumah Keripik 🎉`,
      components: [{
        type: 'quick_replies',
        options: [
          { id: 'bis-ke-produk', label: 'Pesan Sekarang', value: watch.idVarian ? `pesan ${productName}` : `pesan ${productName}`, action: 'send_message' },
          { id: 'bis-lihat', label: 'Lihat Produk', value: 'lihat produk', action: 'send_message' },
        ],
      }],
      metadata: { intent: 'back_in_stock', nextAction: 'ask_add_to_cart' },
    });

    await db
      .update(stockWatch)
      .set({ status: 'notified', notifiedAt: sql`(datetime('now', 'utc'))` })
      .where(eq(stockWatch.id, watch.id));

    notified += 1;
  }

  return { notified };
}

/** Guard kecil: cek stok saat ini untuk re-check cepat (dipakai oleh quick reply "cek lagi"). */
export async function getStockStatus(idProduk: string, idVarian?: string | null) {
  if (idVarian) {
    const [v] = await db
      .select({ stok: produkVarian.stok, nama: produkVarian.nama_varian })
      .from(produkVarian)
      .where(and(eq(produkVarian.id_varian, idVarian), gte(produkVarian.stok, 1)))
      .limit(1);
    return v ? { available: true, name: v.nama } : { available: false };
  }
  const [p] = await db
    .select({ stok: produk.stok_gudang_utama })
    .from(produk)
    .where(and(eq(produk.id_produk, idProduk), gte(produk.stok_gudang_utama, 1)))
    .limit(1);
  return p ? { available: true } : { available: false };
}

// Ambang stok menipis: produk utama <=5 unit, varian <=5 unit.
const LOW_STOCK_THRESHOLD = 5;

/** Cron: cari produk/varian aktif yang stoknya menipis, buat notifikasi inbox admin.
 *  Dedup: satu notifikasi per (produk, varian) selama masih belum dibaca admin. */
export async function processLowStockAdminAlerts(): Promise<{ alerted: number }> {
  const [lowProducts, lowVariants, readNotifs] = await Promise.all([
    db
      .select({ id_produk: produk.id_produk, nama_produk: produk.nama_produk, stok: produk.stok_gudang_utama })
      .from(produk)
      .where(and(eq(produk.is_active, 1), lte(produk.stok_gudang_utama, LOW_STOCK_THRESHOLD))),
    db
      .select({ id_varian: produkVarian.id_varian, id_produk: produkVarian.id_produk, nama_varian: produkVarian.nama_varian, stok: produkVarian.stok })
      .from(produkVarian)
      .where(and(eq(produkVarian.is_active, 1), lte(produkVarian.stok, LOW_STOCK_THRESHOLD))),
    db
      .select({ metaJson: adminNotifications.metaJson })
      .from(adminNotifications)
      .where(and(eq(adminNotifications.category, 'stock'), eq(adminNotifications.isRead, false))),
  ]);

  const existingKeys = new Set<string>();
  for (const n of readNotifs) {
    if (!n.metaJson) continue;
    try {
      const parsed = JSON.parse(n.metaJson) as { productId?: string; variantId?: string | null };
      if (parsed.productId) existingKeys.add(`${parsed.productId}::${parsed.variantId || ''}`);
    } catch {
      // ignore
    }
  }

  let alerted = 0;

  for (const p of lowProducts) {
    const key = `${p.id_produk}::`;
    if (existingKeys.has(key)) continue;
    const ok = await createAdminNotification({
      category: 'stock',
      title: `Stok menipis: ${p.nama_produk}`,
      body: `Sisa ${p.stok} unit. Segera restock untuk menghindari kehabisan.`,
      metaJson: { productId: p.id_produk, href: '/master-data/produk' },
    });
    if (ok) { existingKeys.add(key); alerted++; }
  }

  for (const v of lowVariants) {
    const key = `${v.id_produk}::${v.id_varian}`;
    if (existingKeys.has(key)) continue;
    const [prod] = await db
      .select({ nama_produk: produk.nama_produk })
      .from(produk)
      .where(eq(produk.id_produk, v.id_produk))
      .limit(1);
    const ok = await createAdminNotification({
      category: 'stock',
      title: `Varian menipis: ${v.nama_varian}${prod?.nama_produk ? ` (${prod.nama_produk})` : ''}`,
      body: `Sisa ${v.stok} unit. Segera restock untuk menghindari kehabisan.`,
      metaJson: { productId: v.id_produk, variantId: v.id_varian, href: '/master-data/produk' },
    });
    if (ok) { existingKeys.add(key); alerted++; }
  }

  return { alerted };
}
