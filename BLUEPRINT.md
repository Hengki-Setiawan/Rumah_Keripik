# Blueprint Web Pemesanan Rumah Keripik

## Ringkasan Keputusan

Web pemesanan akan menjadi jalur utama pelanggan untuk membeli produk Rumah Keripik. Chatbot Telegram tetap dipakai sebagai pintu masuk, FAQ, rekomendasi produk, dan pengarah pelanggan ke halaman pemesanan. WhatsApp resmi bisa ditambahkan belakangan, tetapi tidak menjadi syarat agar bisnis berjalan online.

Tujuan utama blueprint ini adalah membuat pemesanan yang:

- Mudah dipakai pelanggan tanpa login.
- Cepat di mobile.
- Terhubung ke dashboard admin.
- Tersimpan rapi di Turso.
- Tetap memakai AI secara maksimal, tetapi hemat token.
- Bisa memproses alamat, link Google Maps, koordinat, pembayaran, status transaksi, dan verifikasi admin.

## Prinsip Dari Riset

Riset checkout modern menunjukkan masalah terbesar bukan hanya desain, tetapi terlalu banyak langkah, terlalu banyak input, dan rasa tidak percaya saat pelanggan hendak membayar. Karena itu web pemesanan Rumah Keripik harus pendek, jelas, dan progresif.

Prinsip yang dipakai:

- Guest checkout wajib: pelanggan tidak perlu membuat akun.
- Satu keputusan per langkah: pilih produk, isi alamat, pilih bayar, konfirmasi.
- Input seminimal mungkin: nama, nomor kontak, alamat, catatan opsional.
- Harga, ongkir, stok, dan status harus selalu berasal dari database, bukan karangan AI.
- AI membantu memilih, menjelaskan, merapikan alamat, dan menjawab FAQ.
- Admin dashboard menjadi sumber kebenaran untuk verifikasi pembayaran dan status akhir.

Referensi riset:

- Baymard Institute: checkout yang panjang dan tidak jelas meningkatkan risiko abandonment.
- Nielsen Norman Group: form harus jelas, label mudah dipahami, validasi langsung, dan tidak meminta data yang tidak perlu.
- Google Places Autocomplete: autocomplete alamat dapat mengurangi salah input dan mempercepat pengisian alamat.
- Stripe Checkout: alur pembayaran yang baik memisahkan review pesanan, metode pembayaran, dan konfirmasi akhir.

## Arsitektur Produk

### Halaman Pelanggan

Rute utama:

- `/pesan`: halaman pemesanan utama.
- `/pesan/lacak`: halaman lacak pesanan dengan kode transaksi atau nomor HP.
- `/pesan/sukses/[kode]`: halaman sukses setelah order dibuat.

Komponen utama:

- Hero singkat dengan CTA: "Pesan Keripik Sekarang".
- Katalog produk dengan kartu produk.
- Keranjang sticky di bawah layar mobile.
- Stepper checkout 4 langkah.
- Form alamat dengan dukungan teks manual, link Google Maps, dan koordinat.
- Pilihan pembayaran: transfer, COD, atau opsi gateway jika nanti dipakai.
- Ringkasan pesanan sebelum submit.
- Status pesanan setelah submit.

### Dashboard Admin

Dashboard tetap menjadi pusat operasional:

- Transaksi: daftar transaksi realtime dengan status.
- Pelanggan & Mitra: data pelanggan, alamat, koordinat, histori pesanan.
- Zona Pengiriman & Transaksi: zona ongkir, area layanan, dan status pengiriman.
- Knowledge Base & Pengaturan AI: sumber jawaban chatbot dan konfigurasi AI.
- Beranda & Analitik: ringkasan omzet, order, performa AI, dan pertanyaan tidak terjawab.

## Alur Pemesanan Ideal

### 1. Masuk Ke Web Pemesanan

Pelanggan datang dari:

- Link di bio sosial media.
- Tombol dari Telegram bot.
- QR code di kemasan.
- Link yang dibagikan admin.

Jika datang dari Telegram, URL bisa membawa parameter:

```text
/pesan?source=telegram&chatId=123456
```

Parameter ini membantu menghubungkan order dengan `pelanggan_chatbot` dan `chat_log`.

### 2. Pilih Produk

Pelanggan melihat produk dari tabel `produk`.

Yang ditampilkan:

- Nama produk.
- Foto produk.
- Harga.
- Stok tersedia.
- Varian rasa.
- Badge rekomendasi.
- Tombol tambah/kurang qty.

Aturan:

- Produk stok 0 tetap bisa terlihat, tetapi tombol beli nonaktif.
- Harga final selalu dari database.
- AI boleh memberi rekomendasi, tetapi tidak boleh mengubah harga.

### 3. AI Product Advisor

Di halaman produk disediakan asisten kecil:

Contoh prompt pelanggan:

- "Yang pedas tapi tidak terlalu pedas apa?"
- "Rekomendasi buat oleh-oleh keluarga."
- "Budget 50 ribu dapat apa?"

Cara kerja hemat token:

- Pertama cari dari data produk dan knowledge base.
- Jika ada cache di `ai_response_cache`, pakai cache.
- Jika pertanyaan umum, jawab pakai rule/template.
- LLM hanya dipakai kalau pertanyaan tidak cocok rule dan butuh bahasa natural.

Output AI harus berupa:

- Rekomendasi 1 sampai 3 produk.
- Alasan singkat.
- Tombol "Tambah ke Keranjang".

## Checkout 4 Langkah

### Langkah 1: Keranjang

Data:

- Produk.
- Qty.
- Subtotal.
- Estimasi berat jika tersedia.

Validasi:

- Qty tidak boleh melebihi stok.
- Produk nonaktif tidak bisa dibeli.
- Jika stok berubah, pelanggan diberi pesan ramah.

Tabel terkait:

- `produk`
- `order_draft`
- `order_events`

### Langkah 2: Data Pelanggan

Input minimal:

- Nama.
- Nomor WhatsApp atau Telegram.
- Tipe pelanggan: konsumen, reseller, warung, mitra.

Opsional:

- Catatan pelanggan.
- Nama toko jika mitra/warung.

Tabel terkait:

- `pelanggan_chatbot`
- `memory_pelanggan`
- `order_draft`

### Langkah 3: Alamat Dan Lokasi

Input alamat dibuat fleksibel:

- Ketik alamat manual.
- Tempel link Google Maps.
- Share lokasi dari browser jika pelanggan mengizinkan.
- Pilih titik di peta jika nanti map UI sudah aktif.

Data yang perlu disimpan:

- Alamat mentah dari pelanggan.
- Alamat hasil normalisasi.
- Latitude.
- Longitude.
- Link Google Maps.
- Catatan patokan.
- Zona pengiriman.

Tabel terkait:

- `lokasi_pelanggan`
- `geocode_cache`
- `zona_pengiriman`
- `order_draft`

AI boleh membantu:

- Merapikan alamat.
- Menebak kecamatan/kelurahan dari teks.
- Mengingatkan jika alamat kurang lengkap.

AI tidak boleh:

- Mengarang koordinat jika tidak ada data.
- Menentukan ongkir final tanpa database zona.

### Langkah 4: Pembayaran Dan Konfirmasi

Metode awal yang paling praktis:

- Transfer bank atau QRIS manual.
- COD jika area mendukung.

Untuk transfer:

- Tampilkan nomor rekening atau QRIS.
- Pelanggan upload bukti pembayaran.
- File masuk ke Cloudinary.
- URL bukti masuk ke `bukti_pembayaran`.
- Status transaksi menjadi `Menunggu_Verifikasi_Admin`.

Untuk COD:

- Status transaksi menjadi `Menunggu_Konfirmasi_Admin`.
- Admin dapat menerima atau menolak dari dashboard.

Tabel terkait:

- `transaksi`
- `detail_transaksi`
- `bukti_pembayaran`
- `order_events`
- `outbound_message_queue`

## Status Transaksi

Status harus dibuat jelas agar admin dan pelanggan tidak bingung.

Status rekomendasi:

- `Draft`: pelanggan sedang mengisi order.
- `Profil_Pending`: data pelanggan belum lengkap.
- `Alamat_Pending`: alamat atau lokasi belum lengkap.
- `Menunggu_Pembayaran`: pelanggan memilih transfer tetapi belum upload bukti.
- `Menunggu_Verifikasi_Admin`: bukti sudah masuk dan menunggu admin.
- `Menunggu_Konfirmasi_Admin`: COD atau order perlu dicek admin.
- `Dikonfirmasi`: admin menerima order.
- `Diproses`: stok sudah dipotong dan pesanan disiapkan.
- `Dikirim`: pesanan sedang dikirim.
- `Selesai`: pesanan selesai.
- `Dibatalkan`: pesanan batal.

Event penting disimpan ke `order_events` agar timeline bisa ditampilkan di dashboard dan halaman lacak pesanan.

## Integrasi AI

### AI Untuk Pelanggan

Fitur:

- Rekomendasi produk.
- FAQ berbasis knowledge base.
- Bantuan memilih paket.
- Bantuan membaca link Google Maps.
- Bantuan melengkapi alamat.

Prioritas hemat token:

- Rule-based untuk sapaan, harga, stok, dan status.
- Database query untuk produk, transaksi, dan pelanggan.
- RAG dari `ai_knowledge_base` untuk FAQ.
- Cache jawaban di `ai_response_cache`.
- LLM hanya untuk pertanyaan bebas dan perapihan bahasa.

### AI Untuk Admin

Fitur:

- Ringkasan pelanggan.
- Ringkasan histori chat.
- Rekomendasi balasan.
- Deteksi pertanyaan tidak terjawab.
- Saran item knowledge base baru.
- Deteksi order yang perlu perhatian.

Halaman dashboard yang paling cocok:

- Live Chat.
- Transaksi.
- Knowledge Base & Pengaturan AI.
- Analitik.

### Guardrail AI

AI tidak boleh menjadi sumber kebenaran untuk:

- Harga.
- Stok.
- Status pembayaran.
- Status transaksi.
- Ongkir final.
- Keputusan verifikasi pembayaran.

Sumber kebenaran tetap:

- Turso database.
- Admin dashboard.
- Cloudinary untuk bukti pembayaran.
- Payment gateway resmi jika nanti dipakai.

## Integrasi Telegram

Telegram bot tetap dipakai, tetapi tidak perlu menanggung semua checkout.

Fungsi Telegram:

- Menjawab sapaan.
- Menampilkan katalog singkat.
- Menjawab FAQ.
- Mengirim link `/pesan`.
- Mengirim link lacak pesanan.
- Memberi notifikasi status order.

Contoh pesan:

```text
Mau pesan lebih mudah lewat form singkat ini ya:
https://rumah-keripik.vercel.app/pesan?source=telegram&chatId={{chatId}}
```

Jika pelanggan tetap chat bebas, bot bisa:

- Jawab dari knowledge base.
- Arahkan ke form jika ingin pesan.
- Eskalasi ke admin jika pertanyaan tidak terjawab.

## Integrasi WhatsApp

WhatsApp tidak wajib untuk MVP karena integrasi resmi lebih kompleks dan membutuhkan setup Meta Cloud API.

Pilihan terbaik:

- MVP: gunakan web pemesanan + Telegram.
- Setelah stabil: tambahkan WhatsApp Cloud API resmi.
- Hindari Evolution API untuk produksi jika nomor berisiko diblokir.

WhatsApp resmi nanti dipakai untuk:

- Notifikasi order.
- Konfirmasi pembayaran.
- Broadcast template yang disetujui Meta.
- Customer support manual.

## Integrasi Turso

Turso menjadi database utama.

Mapping tabel:

- `produk`: katalog produk dan stok.
- `pelanggan_chatbot`: profil pelanggan.
- `memory_pelanggan`: preferensi pelanggan.
- `lokasi_pelanggan`: alamat dan koordinat.
- `zona_pengiriman`: area layanan dan ongkir.
- `order_draft`: checkout yang belum selesai.
- `order_events`: timeline order.
- `transaksi`: header transaksi.
- `detail_transaksi`: item transaksi.
- `bukti_pembayaran`: bukti transfer/QRIS.
- `chat_log`: histori chat.
- `ai_knowledge_base`: sumber FAQ.
- `ai_response_cache`: cache jawaban AI.
- `ai_learning_review`: review pertanyaan tidak terjawab.
- `worker_job`: pekerjaan background lokal.
- `outbound_message_queue`: antrean notifikasi.
- `geocode_cache`: cache geocoding alamat.
- `delivery_assignment`: penugasan pengiriman.
- `delivery_route_point`: titik rute pengiriman.

## Integrasi Cloudinary

Cloudinary dipakai untuk:

- Foto produk.
- Bukti pembayaran.
- Lampiran dari pelanggan jika diperlukan.

Aturan:

- Upload bukti pembayaran dari web masuk ke folder `rumah-keripik/payment-proof`.
- Simpan `secure_url`, `public_id`, ukuran file, dan tipe file.
- Admin melihat preview bukti dari dashboard.
- Admin bisa verifikasi atau tolak bukti.

## Integrasi Worker Lokal

Railway tidak wajib jika strategi kita memakai Vercel + Turso + worker lokal opsional.

Worker lokal dipakai untuk:

- Pekerjaan AI berat.
- Re-geocode alamat.
- Broadcast antrean.
- Analisis pertanyaan tidak terjawab.
- Sinkronisasi notifikasi.

Jika worker lokal mati:

- Order tetap masuk ke Turso.
- Status tetap aman.
- Job menunggu di `worker_job`.
- Admin tetap bisa memproses transaksi manual.

Ini membuat biaya rendah dan tetap tahan gangguan.

## UX Web Pemesanan

### Gaya Visual

Arah desain:

- Hangat, makanan rumahan, bukan dashboard kaku.
- Warna utama coklat karamel, krem, hijau daun, aksen cabai.
- Foto produk besar dan menggugah.
- Tombol besar untuk mobile.
- Bahasa santai dan jelas.

Contoh tone:

- "Pilih keripik favoritmu."
- "Alamatnya sudah pas?"
- "Pesananmu hampir siap diproses."
- "Upload bukti transfer agar admin bisa cek ya."

### Mobile First

Prioritas mobile:

- Sticky cart bawah layar.
- Card produk 1 kolom.
- Step checkout pendek.
- Tombol qty mudah ditekan.
- Form field besar.
- Error message langsung di bawah input.

### Form Minimal

Field wajib:

- Nama.
- Nomor kontak.
- Alamat atau lokasi.
- Metode pembayaran.

Field opsional:

- Catatan alamat.
- Catatan pesanan.
- Nama toko.

## API Yang Perlu Dibuat

Rekomendasi endpoint:

- `GET /api/order/products`: ambil produk aktif.
- `POST /api/order/draft`: buat atau update draft.
- `POST /api/order/confirm`: ubah draft menjadi transaksi.
- `POST /api/order/payment-proof`: upload bukti pembayaran.
- `GET /api/order/track?code=...`: lacak status pesanan.
- `POST /api/ai/order-helper`: rekomendasi produk dan bantuan alamat.
- `POST /api/location/parse`: parse link maps dan alamat.
- `POST /api/location/geocode`: geocode alamat.

Endpoint harus server-side agar token API, Turso token, dan Cloudinary secret tidak bocor ke client.

## Roadmap Implementasi

### Fase 1: MVP Web Pemesanan

Target:

- Halaman `/pesan`.
- Katalog produk dari Turso.
- Keranjang.
- Form pelanggan.
- Form alamat manual.
- Pilihan transfer/COD.
- Buat transaksi dan detail transaksi.
- Status masuk dashboard.

Selesai jika:

- Pelanggan bisa membuat order dari web.
- Admin melihat order di dashboard transaksi.
- Produk dan stok berasal dari Turso.

### Fase 2: Bukti Pembayaran Dan Tracking

Target:

- Upload bukti ke Cloudinary.
- Simpan bukti ke database.
- Halaman sukses.
- Halaman lacak pesanan.
- Timeline dari `order_events`.

Selesai jika:

- Admin bisa verifikasi bukti.
- Pelanggan bisa melihat status.

### Fase 3: AI Helper

Target:

- Rekomendasi produk.
- FAQ dari knowledge base.
- Bantuan melengkapi alamat.
- Cache jawaban AI.

Selesai jika:

- AI membantu tanpa mengarang harga/stok.
- Pertanyaan gagal masuk ke `ai_learning_review`.

### Fase 4: Lokasi Dan Peta

Target:

- Terima link Google Maps.
- Ambil koordinat jika tersedia.
- Geocode alamat manual.
- Visualisasi pelanggan di peta dashboard.
- Hubungkan transaksi dengan koordinat.

Selesai jika:

- Setiap transaksi bisa punya lokasi jelas.
- Admin bisa melihat titik pelanggan di map.

### Fase 5: Otomasi Notifikasi

Target:

- Telegram notifikasi status.
- WhatsApp resmi jika sudah siap.
- Outbound queue agar tidak hilang saat service down.

Selesai jika:

- Pelanggan mendapat update status.
- Jika API gagal, pesan tetap tersimpan untuk retry.

## Checklist Testing

Testing pelanggan:

- Bisa membuka `/pesan` di mobile.
- Bisa memilih produk.
- Bisa mengubah qty.
- Tidak bisa membeli stok kosong.
- Bisa isi data minimal.
- Bisa submit alamat manual.
- Bisa memilih transfer.
- Bisa upload bukti pembayaran.
- Bisa melihat status order.

Testing admin:

- Transaksi baru muncul di dashboard.
- Detail item benar.
- Data pelanggan tersimpan.
- Alamat tersimpan.
- Bukti pembayaran tampil.
- Admin bisa ubah status.
- Timeline order tercatat.

Testing AI:

- AI menjawab FAQ dari knowledge base.
- AI merekomendasikan produk dari database.
- AI tidak mengarang harga.
- AI tidak mengarang stok.
- AI menyimpan cache.
- Pertanyaan gagal masuk review.

Testing integrasi:

- Turso berhasil read/write.
- Cloudinary berhasil upload.
- Telegram webhook tetap sehat.
- Worker job bisa dibuat.
- Jika worker mati, order tetap aman.

## Metrik Sukses

Bisnis:

- Jumlah order harian.
- Conversion rate dari kunjungan `/pesan`.
- Nilai transaksi rata-rata.
- Produk terlaris.
- Pelanggan repeat order.

Operasional:

- Order pending paling lama.
- Waktu verifikasi admin.
- Jumlah order batal.
- Alamat tidak lengkap.
- Bukti pembayaran ditolak.

AI:

- Persentase pertanyaan terjawab otomatis.
- Cache hit rate.
- Jumlah eskalasi ke admin.
- Pertanyaan baru untuk knowledge base.
- Estimasi token per order.

## Prioritas Build Berikutnya

Urutan paling masuk akal:

1. Build `/pesan` dengan katalog, cart, dan checkout dasar.
2. Sambungkan submit order ke Turso.
3. Tampilkan order baru di dashboard transaksi.
4. Tambahkan upload bukti pembayaran ke Cloudinary.
5. Tambahkan halaman tracking pesanan.
6. Tambahkan AI product advisor dan FAQ.
7. Tambahkan parse Google Maps dan geocoding.
8. Tambahkan visualisasi map pelanggan di dashboard.
9. Tambahkan Telegram notification dari `outbound_message_queue`.
10. Tambahkan WhatsApp Cloud API resmi jika sudah siap.

## Catatan Keputusan

Strategi terbaik untuk saat ini adalah tidak memaksakan chatbot menjadi tempat checkout penuh. Web pemesanan memberi kontrol UX yang lebih baik, lebih aman untuk pembayaran, lebih mudah tersambung ke dashboard, dan tidak bergantung pada risiko blokir WhatsApp non-resmi.

AI tetap penting, tetapi diposisikan sebagai asisten cerdas:

- Membantu pelanggan memilih.
- Membantu admin bekerja lebih cepat.
- Membantu knowledge base berkembang.
- Mengurangi beban support.

Database dan dashboard tetap menjadi pusat kebenaran.

## Sumber Riset

- Baymard Institute Checkout UX: https://baymard.com/research/checkout-usability
- Nielsen Norman Group Web Form Design: https://www.nngroup.com/articles/web-form-design/
- Google Places Autocomplete: https://developers.google.com/maps/documentation/places/web-service/place-autocomplete
- Stripe Checkout: https://docs.stripe.com/payments/checkout
