import { db } from '@/lib/db';
import { botAutoReply, produk, pelangganChatbot, aiKnowledgeBase, warungRetail } from '@/lib/schema';

async function seed() {
  console.log('🌱 Memulai seed...');

  // Auto Reply Rules
  await db.insert(botAutoReply).values([
    {
      keyword: 'halo,hai,hi,hey,pagi,siang,malam',
      response: 'Halo! Ada yang bisa kami bantu hari ini? 😊 Ketik *MENU* untuk lihat produk kami.',
      is_active: 1,
    },
    {
      keyword: 'menu,katalog,produk,mau beli,beli,pesan',
      response: '📋 *Menu Rumah Kripik:*\n1. Kripik Original — Rp8.000\n2. Kripik Pedas — Rp9.000\n3. Kripik Balado — Rp9.000\n4. Kripik BBQ — Rp10.000\n\nKetik *1-4* untuk lihat detail varian, atau ketik langsung nama produk untuk pesan!',
      is_active: 1,
    },
    {
      keyword: 'harga,berapa,price,cost,tarif',
      response: '💸 *Daftar Harga:*\n• Original: Rp8.000/pcs\n• Pedas: Rp9.000/pcs\n• Balado: Rp9.000/pcs\n• BBQ: Rp10.000/pcs\n\nMin. pembelian 2 pcs untuk pengiriman dalam kota.',
      is_active: 1,
    },
    {
      keyword: 'ongkir,pengiriman, sampai, kirim, delivery, kurir',
      response: '🚚 *Informasi Pengiriman:*\n• Dalam kota Makassar: Rp5.000 - Rp10.000 (1-3 jam)\n• Luar kota: via JNE/J&T (1-3 hari)\n• Min. pembelian luar kota: 5 pcs\n• Bisa COD area Makassar (+Rp2.000)',
      is_active: 1,
    },
    {
      keyword: 'bayar,pembayaran,transfer,bank,rekening,COD',
      response: '💳 *Pembayaran:*\n1. Transfer BCA: 1234567890 a.n. Rumah Kripik\n2. Transfer BRI: 9876543210 a.n. Rumah Kripik\n3. COD (dalam kota Makassar +Rp2.000)\n\nNomor rekening akan dikirim bersama invoice setelah pesanan dikonfirmasi.',
      is_active: 1,
    },
    {
      keyword: 'batal,cancel, refund, kembali',
      response: '❌ Untuk pembatalan pesanan, silakan hubungi admin langsung ya kak. Kami akan proses secepatnya! 🙏',
      is_active: 1,
    },
    {
      keyword: 'jam,operasional, buka, tutup, waktu',
      response: '⏰ *Jam Operasional:*\nSenin - Sabtu: 08.00 - 17.00 WITA\nMinggu & Hari Besar: Libur\n\nPesanan di luar jam kerja akan diproses di hari kerja berikutnya.',
      is_active: 1,
    },
    {
      keyword: 'keripik, original, pedas, balado, bbq, varian, rasa',
      response: '🍟 *Varian Keripik Rumah Kripik:*\n\n1. *Original* — Gurih renyah, cocok semua usia (Rp8.000)\n2. *Pedas* — Pedas segar, tidak pahit (Rp9.000)\n3. *Balado* — Autentik, favorit pelanggan! (Rp9.000)\n4. *BBQ* — Smoky premium, sensasi modern (Rp10.000)\n\nKetik *1-4* untuk pesan varian tertentu!',
      is_active: 1,
    },
    {
      keyword: 'terima kasih, makasih, thanks, thx, ok sip',
      response: 'Sama-sama kak! 😊 Senang bisa membantu. Jangan ragu hubungi kami lagi kalau butuh yang lain ya! 🍟',
      is_active: 1,
    },
    {
      keyword: 'admin, operator, orang, staff',
      response: 'Baik kak, akan saya hubungkan ke admin ya. Mohon tunggu sebentar 🙏',
      is_active: 1,
    },
  ]).onConflictDoNothing();

  console.log('✓ Auto-reply rules di-seed (10 rules)');
  console.log('🎉 Seed selesai!');
}

seed().catch(console.error);
