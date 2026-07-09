import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('@/lib/db');
  const { paymentMethod } = await import('@/lib/schema');

  console.log('⏳ Ensuring active BCA and COD payment methods exist in database...');

  try {
    await db.insert(paymentMethod).values([
      {
        id_payment_method: 'PM-BCA-TRANSFER',
        type: 'bank_transfer',
        label: 'Transfer Bank BCA',
        bank_name: 'BCA',
        account_number: '123-456-7890',
        account_name: 'Rumah Keripik',
        note: 'Silakan transfer ke rekening BCA di atas, lalu upload bukti pembayaran.',
        min_order_total: 0,
        max_order_total: null,
        sort_order: 1,
        is_active: 1,
      },
      {
        id_payment_method: 'PM-COD-PERMANENT',
        type: 'cod',
        label: 'COD (Bayar di Tempat)',
        note: 'Bayar tunai ke kurir saat pesanan Anda sampai.',
        min_order_total: 0,
        max_order_total: 1000000,
        sort_order: 2,
        is_active: 1,
      },
    ]).onConflictDoUpdate({
      target: paymentMethod.id_payment_method,
      set: { is_active: 1 }
    });

    console.log('✅ Active payment methods verified.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error ensuring payment methods:', error);
    process.exit(1);
  }
}

main();
