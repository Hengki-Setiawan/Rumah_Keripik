import { db } from '../lib/db';
import { produk, warungRetail, pelangganChatbot, aiKnowledgeBase } from '../lib/schema';

async function seed() {
  console.log('🌱 Memulai seed data...');

  try {
    // ─── SEED PRODUK ────────────────────────────────────────────────────────
    console.log('📦 Menambah data produk...');
    await db
      .insert(produk)
      .values([
        {
          id_produk: 'KRP-001',
          nama_produk: 'Kripik Original',
          deskripsi:
            'Kripik singkong renyah original tanpa bumbu tambahan. Gurih alami dan tahan lama.',
          harga_jual: 15000, // Rp15.000 per bungkus
          stok_gudang_utama: 100,
          is_active: 1,
        },
        {
          id_produk: 'KRP-002',
          nama_produk: 'Kripik Pedas',
          deskripsi: 'Kripik singkong dengan bumbu pedas yang menggigit. Pas buat yang suka pedas!',
          harga_jual: 18000,
          stok_gudang_utama: 80,
          is_active: 1,
        },
        {
          id_produk: 'KRP-003',
          nama_produk: 'Kripik Bawang',
          deskripsi:
            'Kripik singkong dengan aroma bawang putih yang wangi. Cocok untuk jajan ringan.',
          harga_jual: 17000,
          stok_gudang_utama: 75,
          is_active: 1,
        },
        {
          id_produk: 'KRP-004',
          nama_produk: 'Kripik Mix Bumbu',
          deskripsi: 'Kombinasi kripik dengan berbagai bumbu pilihan. Paket hemat untuk keluarga.',
          harga_jual: 20000,
          stok_gudang_utama: 50,
          is_active: 1,
        },
      ])
      .onConflictDoNothing();

    console.log('✓ Produk berhasil di-seed (4 varian)');

    // ─── SEED WARUNG RETAIL ─────────────────────────────────────────────────
    console.log('🏪 Menambah data warung retail...');
    await db
      .insert(warungRetail)
      .values([
        {
          id_warung: 'WRG-001',
          nama_warung: 'Warung Bu Siti',
          pemilik: 'Siti Nurhaliza',
          no_wa_warung: '6281234567890',
          alamat: 'Jl. Raya Depok No. 123, Depok, Jawa Barat',
          tipe_kemitraan: 'Reseller',
          min_order_grosir: 10,
          is_active: 1,
        },
        {
          id_warung: 'WRG-002',
          nama_warung: 'Toko Berkah',
          pemilik: 'Muhammad Rifki',
          no_wa_warung: '6289876543210',
          alamat: 'Jl. Ahmad Yani No. 45, Bogor, Jawa Barat',
          tipe_kemitraan: 'Agent',
          min_order_grosir: 20,
          is_active: 1,
        },
      ])
      .onConflictDoNothing();

    console.log('✓ Warung retail berhasil di-seed (2 entri)');

    // ─── SEED PELANGGAN CHATBOT (Opsional — contoh data) ────────────────────
    console.log('👤 Menambah data pelanggan chatbot...');
    await db
      .insert(pelangganChatbot)
      .values([
        {
          no_wa_pelanggan: '6281234567890',
          nama_pelanggan: 'Budi Santoso',
          alamat_pengiriman: 'Jl. Merdeka 10, Jakarta',
          status_handle: 'AI_Bot',
          context_sesi: JSON.stringify({}),
        },
        {
          no_wa_pelanggan: '6289876543210',
          nama_pelanggan: 'Ani Wijaya',
          alamat_pengiriman: 'Jl. Sudirman 25, Bandung',
          status_handle: 'AI_Bot',
          context_sesi: JSON.stringify({}),
        },
      ])
      .onConflictDoNothing();

    console.log('✓ Pelanggan chatbot berhasil di-seed (2 contoh)');

    // ─── SEED AI KNOWLEDGE BASE ──────────────────────────────────────────────
    console.log('📚 Menambah data knowledge base...');
    const kbEntries = [
      {
        judul: 'Tentang Rumah Kripik',
        potongan_teks:
          'Rumah Kripik adalah usaha keripik singkong rumahan yang telah melayani pelanggan selama 5 tahun. Kami menjual berbagai varian kripik berkualitas tinggi dengan bahan pilihan.',
        kategori: 'FAQ',
        vector_embedding: null, // Will be filled later with embedding script
      },
      {
        judul: 'Cara Pemesanan',
        potongan_teks:
          'Untuk memesan, cukup ketik jenis kripik yang ingin dibeli, jumlah bungkus, dan alamat pengiriman. Tim kami akan memproses pesanan Anda dalam 1x24 jam.',
        kategori: 'FAQ',
        vector_embedding: null,
      },
      {
        judul: 'Ongkos Kirim',
        potongan_teks:
          'Ongkos kirim dihitung berdasarkan lokasi pengiriman. Untuk area Jakarta dan sekitarnya, ongkir mulai dari Rp10.000. Gratis ongkir untuk pembelian minimal Rp100.000.',
        kategori: 'Pengiriman',
        vector_embedding: null,
      },
      {
        judul: 'Kebijakan Return',
        potongan_teks:
          'Produk yang rusak atau tidak sesuai pesanan dapat dikembalikan dalam 7 hari setelah pengiriman. Silakan hubungi customer service kami untuk proses return.',
        kategori: 'Kebijakan',
        vector_embedding: null,
      },
      {
        judul: 'Informasi Produk Kripik Original',
        potongan_teks:
          'Kripik Original adalah produk unggulan kami. Terbuat dari singkong pilihan yang digoreng hingga renyah sempurna. Tersedia dalam kemasan 100g dengan rasa yang gurih alami tanpa pengawet.',
        kategori: 'Produk',
        vector_embedding: null,
      },
    ];

    await db.insert(aiKnowledgeBase).values(kbEntries).onConflictDoNothing();

    console.log('✓ Knowledge base berhasil di-seed (5 entri)');
    console.log(
      '\n💡 CATATAN: Vector embedding masih kosong. Jalankan script reembed untuk mengisi embedding data KB.'
    );
    console.log('   Perintah: npm run db:seed:embed\n');

    console.log('🎉 Seed selesai!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error saat seed:', error);
    process.exit(1);
  }
}

seed();
