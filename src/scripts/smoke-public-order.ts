import { config } from 'dotenv';

config({ path: '.env.local' });

async function main() {
  const { db } = await import('@/lib/db');
  const { and, eq, sql } = await import('drizzle-orm');
  const { buildPaymentInstructionPayload, generatePaymentIntentId } = await import('@/lib/payments/payment-utils');
  const { resolveCustomerByPhone } = await import('@/lib/customer-resolver');
  const { generateAnonymousToken, generateIdPaymentProof, generateIdTransaksi, generateIdWebSession, generateKodePesanan, generateOrderStatusToken } = await import('@/lib/id-generator');
  const { canApproveCod, canApprovePaymentProof } = await import('@/lib/order-status-policy');
  const { customerAddress, detailTransaksi, orderStatusHistory, paymentIntent, paymentMethod, paymentProof, produk, produkVarian, transaksi, webOrderSession } = await import('@/lib/schema');

  async function createSmokeOrder(input: { variantId: string; paymentMethodId: string; name: string; phone: string }) {
    const [variant] = await db.select().from(produkVarian).where(eq(produkVarian.id_varian, input.variantId)).limit(1);
    if (!variant || variant.stok < 1) throw new Error(`Variant ${input.variantId} tidak tersedia`);
    const [product] = await db.select().from(produk).where(eq(produk.id_produk, variant.id_produk)).limit(1);
    if (!product) throw new Error(`Produk ${variant.id_produk} tidak ditemukan`);
    const [method] = await db.select().from(paymentMethod).where(eq(paymentMethod.id_payment_method, input.paymentMethodId)).limit(1);
    if (!method) throw new Error(`Payment method ${input.paymentMethodId} tidak ditemukan`);

    const idTransaksi = await generateIdTransaksi();
    const idSession = generateIdWebSession();
    const anonymousToken = generateAnonymousToken();
    const kodePesanan = generateKodePesanan();
    const statusToken = generateOrderStatusToken();
    const customer = await resolveCustomerByPhone(db, { name: input.name, phone: input.phone, source: 'web', tags: ['smoke-test'] });
    const [address] = await db.insert(customerAddress).values({ id_customer: customer.idCustomer, recipient_name: input.name, phone: customer.phone, address_text: 'Jl Smoke Test No 1, Kota Testing', is_default: 1, last_used_at: sql`(datetime('now', 'utc'))` }).returning({ id_address: customerAddress.id_address });
    await db.insert(webOrderSession).values({ id_session: idSession, anonymous_token: anonymousToken, id_customer: customer.idCustomer, current_state: 'ORDER_CREATED', cart_json: JSON.stringify({ items: [{ productId: product.id_produk, variantId: variant.id_varian, quantity: 1 }] }), status: 'completed' });

    const isCod = method.type === 'cod';
    await db.insert(transaksi).values({
      id_transaksi: idTransaksi,
      id_customer: customer.idCustomer,
      id_session: idSession,
      id_address: address.id_address,
      tipe_penjualan: 'Online_Web',
      total_bayar: variant.harga_jual,
      status_pembayaran: isCod ? 'Menunggu_Verifikasi' : 'Menunggu_Bayar',
      kode_pesanan: kodePesanan,
      status_token: statusToken,
      nama_penerima: input.name,
      alamat_penerima: 'Jl Smoke Test No 1, Kota Testing',
      no_hp_penerima: customer.phone,
      order_status: isCod ? 'awaiting_admin_confirmation' : 'awaiting_payment',
      payment_status: isCod ? 'cod_requested' : 'payment_instruction_shown',
      payment_method: method.type,
      shipping_address_snapshot: JSON.stringify({ recipientName: input.name, phone: customer.phone, addressText: 'Jl Smoke Test No 1, Kota Testing' }),
    });
    await db.insert(detailTransaksi).values({ id_transaksi: idTransaksi, id_produk: product.id_produk, id_varian: variant.id_varian, qty_terjual: 1, harga_snapshot: variant.harga_jual, nama_produk_snapshot: product.nama_produk, nama_varian_snapshot: variant.nama_varian, berat_gram_snapshot: variant.berat_gram, subtotal: variant.harga_jual });
    await db.insert(paymentIntent).values({ id_payment_intent: generatePaymentIntentId(), id_transaksi: idTransaksi, id_payment_method: method.id_payment_method, method_type: method.type, amount_due: variant.harga_jual, status: isCod ? 'awaiting_admin_verification' : 'instruction_shown', instruction_json: JSON.stringify(buildPaymentInstructionPayload(method)) });
    await db.insert(orderStatusHistory).values({ id_transaksi: idTransaksi, order_status: isCod ? 'awaiting_admin_confirmation' : 'awaiting_payment', payment_status: isCod ? 'cod_requested' : 'payment_instruction_shown', event_type: 'SMOKE_ORDER_CREATED', actor: 'smoke' });
    return { idTransaksi, variantId: variant.id_varian };
  }

  async function deductStockOnce(orderId: string, reason: string) {
    const [existing] = await db.select({ id: orderStatusHistory.id }).from(orderStatusHistory).where(and(eq(orderStatusHistory.id_transaksi, orderId), eq(orderStatusHistory.event_type, 'STOCK_DEDUCTED'))).limit(1);
    if (existing) return false;
    const details = await db.select().from(detailTransaksi).where(eq(detailTransaksi.id_transaksi, orderId));
    for (const detail of details) {
      if (!detail.id_varian) throw new Error('Smoke test membutuhkan varian');
      const result = await db.update(produkVarian).set({ stok: sql`${produkVarian.stok} - ${detail.qty_terjual}` }).where(and(eq(produkVarian.id_varian, detail.id_varian), sql`${produkVarian.stok} >= ${detail.qty_terjual}`));
      if (result.rowsAffected === 0) throw new Error(`Stok ${detail.id_varian} tidak cukup`);
    }
    await db.insert(orderStatusHistory).values({ id_transaksi: orderId, event_type: 'STOCK_DEDUCTED', actor: 'smoke', metadata_json: JSON.stringify({ reason }) });
    return true;
  }

  const beforeOriginal = await db.select({ stok: produkVarian.stok }).from(produkVarian).where(eq(produkVarian.id_varian, 'VAR-SMOKE-ORI-100')).limit(1);
  const transfer = await createSmokeOrder({ variantId: 'VAR-SMOKE-ORI-100', paymentMethodId: 'PM-SMOKE-BANK-BCA', name: 'Smoke Transfer', phone: `0812${Date.now().toString().slice(-8)}` });
  const [transferOrder] = await db.select().from(transaksi).where(eq(transaksi.id_transaksi, transfer.idTransaksi)).limit(1);
  const proofId = generateIdPaymentProof();
  await db.insert(paymentProof).values({ id_payment_proof: proofId, id_transaksi: transfer.idTransaksi, cloudinary_public_id: `rumah-keripik/payment-proofs/smoke/${proofId}`, secure_url: `https://res.cloudinary.com/smoke/image/upload/payment-proofs/${proofId}.jpg`, amount_claimed: transferOrder.total_bayar, status: 'pending' });
  const [proof] = await db.select().from(paymentProof).where(eq(paymentProof.id_payment_proof, proofId)).limit(1);
  if (!canApprovePaymentProof(transferOrder, proof)) throw new Error('Policy menolak approve proof smoke yang valid');
  await deductStockOnce(transfer.idTransaksi, 'payment_approved');
  await db.update(paymentProof).set({ status: 'accepted', verified_by: 'smoke', verified_at: sql`(datetime('now', 'utc'))` }).where(eq(paymentProof.id_payment_proof, proofId));
  await db.update(transaksi).set({ status_pembayaran: 'Lunas', payment_status: 'verified', order_status: 'processing', verified_by: 'smoke', verified_at: sql`(datetime('now', 'utc'))` }).where(eq(transaksi.id_transaksi, transfer.idTransaksi));
  const afterOriginal = await db.select({ stok: produkVarian.stok }).from(produkVarian).where(eq(produkVarian.id_varian, 'VAR-SMOKE-ORI-100')).limit(1);

  const cod = await createSmokeOrder({ variantId: 'VAR-SMOKE-PEDAS-100', paymentMethodId: 'PM-SMOKE-COD', name: 'Smoke COD', phone: `0821${Date.now().toString().slice(-8)}` });
  const [codOrderBefore] = await db.select().from(transaksi).where(eq(transaksi.id_transaksi, cod.idTransaksi)).limit(1);
  if (!canApproveCod(codOrderBefore)) throw new Error('Policy menolak approve COD smoke yang valid');
  await deductStockOnce(cod.idTransaksi, 'cod_approved');
  await db.update(transaksi).set({ payment_status: 'cod_approved', order_status: 'processing', status_pembayaran: 'Piutang' }).where(eq(transaksi.id_transaksi, cod.idTransaksi));
  await db.update(paymentIntent).set({ status: 'verified' }).where(eq(paymentIntent.id_transaksi, cod.idTransaksi));
  const [codOrderAfter] = await db.select().from(transaksi).where(eq(transaksi.id_transaksi, cod.idTransaksi)).limit(1);

  console.log(JSON.stringify({
    ok: true,
    transfer: { id: transfer.idTransaksi, stockBefore: beforeOriginal[0]?.stok, stockAfter: afterOriginal[0]?.stok, expectedStockDelta: 1 },
    cod: { id: cod.idTransaksi, paymentStatus: codOrderAfter.payment_status, orderStatus: codOrderAfter.order_status },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
