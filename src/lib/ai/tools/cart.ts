import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatCartItems, chatCarts, produk, produkVarian } from '@/lib/schema';
import { generateIdChatCartItem } from '@/lib/id-generator';
import { getProductImageUrl } from '@/lib/cloudinary-url';
import { ensureActiveCart } from '@/lib/chat-v3/session';
import type { ChatCartDto } from '@/lib/chat-v3/types';

export async function getChatCart(chatSessionId: string): Promise<ChatCartDto> {
  const cart = await ensureActiveCart(chatSessionId, null);
  const rows = await db
    .select({
      id: chatCartItems.id,
      productId: chatCartItems.productId,
      variantId: chatCartItems.variantId,
      quantity: chatCartItems.quantity,
      priceSnapshot: chatCartItems.priceSnapshot,
      productName: produk.nama_produk,
      productImage: produk.image_url,
      productCloudinaryId: produk.cloudinary_public_id,
      productStock: produk.stok_gudang_utama,
      variantName: produkVarian.nama_varian,
      variantStock: produkVarian.stok,
      variantImage: produkVarian.image_url,
      variantCloudinaryId: produkVarian.cloudinary_public_id,
    })
    .from(chatCartItems)
    .innerJoin(produk, eq(chatCartItems.productId, produk.id_produk))
    .leftJoin(produkVarian, eq(chatCartItems.variantId, produkVarian.id_varian))
    .where(eq(chatCartItems.cartId, cart.id));

  const items = rows.map((row) => {
    const imageUrl = row.variantCloudinaryId
      ? getProductImageUrl(row.variantCloudinaryId)
      : row.productCloudinaryId
        ? getProductImageUrl(row.productCloudinaryId)
        : row.variantImage || row.productImage;
    return {
      id: row.id,
      productId: row.productId,
      variantId: row.variantId,
      productName: row.productName,
      variantName: row.variantName,
      quantity: row.quantity,
      unitPrice: row.priceSnapshot,
      subtotal: row.priceSnapshot * row.quantity,
      stock: row.variantId ? (row.variantStock || 0) : row.productStock,
      imageUrl,
    };
  });

  return {
    id: cart.id,
    items,
    total: items.reduce((sum, item) => sum + item.subtotal, 0),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

export async function addToChatCart(chatSessionId: string, productId: string, variantId: string | undefined, quantity = 1) {
  const cart = await ensureActiveCart(chatSessionId, null);
  const [product] = await db.select().from(produk).where(and(eq(produk.id_produk, productId), eq(produk.is_active, 1))).limit(1);
  if (!product) throw new Error('Produk tidak tersedia');

  const [variant] = variantId
    ? await db.select().from(produkVarian).where(and(eq(produkVarian.id_varian, variantId), eq(produkVarian.is_active, 1))).limit(1)
    : [];
  if (variantId && (!variant || variant.id_produk !== productId)) throw new Error('Varian tidak tersedia');

  const stock = variant ? variant.stok : product.stok_gudang_utama;
  if (stock <= 0) throw new Error('Stok produk habis');
  const qty = Math.max(1, Math.min(quantity, stock));
  const unitPrice = variant ? variant.harga_jual : product.harga_jual;

  const [existing] = await db
    .select()
    .from(chatCartItems)
    .where(and(eq(chatCartItems.cartId, cart.id), eq(chatCartItems.productId, productId), variantId ? eq(chatCartItems.variantId, variantId) : sql`${chatCartItems.variantId} IS NULL`))
    .limit(1);

  if (existing) {
    await db
      .update(chatCartItems)
      .set({ quantity: Math.min(stock, existing.quantity + qty), priceSnapshot: unitPrice, updatedAt: sql`(datetime('now', 'utc'))` })
      .where(eq(chatCartItems.id, existing.id));
  } else {
    await db.insert(chatCartItems).values({
      id: generateIdChatCartItem(),
      cartId: cart.id,
      productId,
      variantId: variantId || null,
      quantity: qty,
      priceSnapshot: unitPrice,
    });
  }

  await db.update(chatCarts).set({ updatedAt: sql`(datetime('now', 'utc'))` }).where(eq(chatCarts.id, cart.id));
  return getChatCart(chatSessionId);
}

export async function updateChatCartItem(chatSessionId: string, itemId: string, quantity: number) {
  const cart = await ensureActiveCart(chatSessionId, null);
  if (quantity <= 0) {
    await db.delete(chatCartItems).where(and(eq(chatCartItems.id, itemId), eq(chatCartItems.cartId, cart.id)));
    return getChatCart(chatSessionId);
  }
  await db.update(chatCartItems).set({ quantity, updatedAt: sql`(datetime('now', 'utc'))` }).where(and(eq(chatCartItems.id, itemId), eq(chatCartItems.cartId, cart.id)));
  return getChatCart(chatSessionId);
}
