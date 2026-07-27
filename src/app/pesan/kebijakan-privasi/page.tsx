export const metadata = {
  title: 'Kebijakan Privasi | Rumah Keripik',
  description: 'Kebijakan privasi dan perlindungan data pengguna Rumah Keripik.',
};

export default function KebijakanPrivasiPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-sm leading-6 text-[#2f241c]">
      <h1 className="mb-2 text-2xl font-bold">Kebijakan Privasi</h1>
      <p className="mb-8 text-xs text-[#6f5d4f]">Terakhir diperbarui: 26 Juli 2026</p>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-semibold">Data yang Kami Kumpulkan</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Nama & nomor kontak</strong> — diperlukan untuk memproses pesanan</li>
          <li><strong>Alamat & koordinat lokasi</strong> — untuk pengiriman</li>
          <li><strong>Riwayat pesanan</strong> — untuk layanan pelanggan dan rekomendasi</li>
          <li><strong>Data chat</strong> — teks percakapan dengan asisten AI</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-semibold">Penggunaan AI Pihak Ketiga</h2>
        <p className="mb-2">
          Chat ini menggunakan layanan AI dari Groq, Google Gemini, dan Cerebras untuk memproses pesan Anda.
          Sebelum dikirim ke penyedia AI, data pribadi Anda (nomor HP, alamat, koordinat) secara otomatis
          diredaksi oleh sistem kami.
        </p>
        <p className="text-xs text-[#6f5d4f]">
          Groq tidak melatih model dari data pengguna. Google Gemini (tier gratis) berpotensi menggunakan
          data untuk peningkatan model — karenanya data pribadi tidak pernah dikirim ke Gemini.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-semibold">Retensi Data</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Pesan chat: 90 hari sejak percakapan terakhir</li>
          <li>Data pesanan: disimpan selama akun aktif</li>
          <li>Log AI: 30 hari (untuk audit biaya & debugging)</li>
          <li>Percakapan gagal: 7 hari</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-semibold">Hak Anda</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Meminta akses ke data pribadi yang kami simpan</li>
          <li>Meminta penghapusan data pribadi</li>
          <li>Meminta perbaikan data yang tidak akurat</li>
        </ul>
        <p className="mt-2">Hubungi admin melalui chat untuk menggunakan hak-hak di atas.</p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-semibold">Keamanan</h2>
        <p>
          Semua koneksi menggunakan HTTPS. Token autentikasi disimpan di perangkat Anda (Secure Storage).
          Kami tidak membagikan data pribadi Anda ke pihak ketiga di luar penyedia AI yang disebutkan di atas.
        </p>
      </section>
    </main>
  );
}
