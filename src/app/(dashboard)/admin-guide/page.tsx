const sections = [
  {
    title: 'Setup Katalog Awal',
    steps: [
      'Buka Kategori Produk, buat kategori seperti Singkong, Pisang, Tempe, atau Paket Hemat.',
      'Buka Produk, tambah produk utama dan upload gambar produk.',
      'Buka Varian Produk, pilih produk dari dropdown lalu tambah varian rasa/ukuran/stok/harga.',
      'Cek /pesan untuk memastikan kategori, produk, gambar, dan varian tampil benar.',
    ],
  },
  {
    title: 'Setup Pembayaran',
    steps: [
      'Buka Metode Pembayaran.',
      'Tambahkan transfer bank, QRIS statis, e-wallet, dan COD sesuai kebutuhan.',
      'Untuk QRIS, upload gambar QRIS asli milik merchant.',
      'Gunakan min/max order untuk membatasi COD atau metode tertentu.',
    ],
  },
  {
    title: 'Proses Order Harian',
    steps: [
      'Pelanggan order dari /pesan.',
      'Jika pelanggan upload bukti, buka Verifikasi Pembayaran.',
      'Cek nominal, gambar bukti, OCR assist, dan duplicate warning.',
      'Approve jika valid, reject jika salah lalu pelanggan bisa upload ulang.',
      'Cetak packing label untuk proses pengemasan.',
    ],
  },
  {
    title: 'COD',
    steps: [
      'Order COD masuk ke halaman COD Control.',
      'Approve COD hanya jika alamat/nomor jelas dan order layak diproses.',
      'Reject COD jika area tidak didukung atau data tidak valid.',
    ],
  },
  {
    title: 'Sebelum Deploy / Backup',
    steps: [
      'Jalankan backup: npm run db:backup.',
      'Jalankan migration v3, v4, v5 jika DB target baru.',
      'Buka Deployment Health dan pastikan semua env penting OK.',
      'Jalankan checklist /ops-smoke sebelum produksi.',
    ],
  },
];

export default function AdminGuidePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Panduan Admin Rumah Keripik</h1>
        <p className="text-on-surface-variant">Panduan singkat operasional harian untuk owner/admin non-teknis.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <section key={section.title} className="rounded-2xl border border-outline-variant bg-white p-5">
            <h2 className="text-xl font-semibold tracking-[-0.02em]">{section.title}</h2>
            <ol className="mt-4 space-y-3 text-sm text-on-surface-variant">
              {section.steps.map((step, index) => <li key={step} className="rounded-xl bg-neutral-50 p-3"><b>{index + 1}.</b> {step}</li>)}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
