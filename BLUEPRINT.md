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

## Konsep Lanjutan: Advanced Mini-Commerce System

Jika ingin dibuat lebih canggih dari blueprint awal, arah terbaik bukan membuat chatbot menjadi semakin panjang, tetapi membuat web pemesanan terasa seperti mini aplikasi yang pintar, cepat, dan tetap sederhana.

Konsep utamanya:

- Pelanggan merasa seperti dibantu pelayan toko yang ramah.
- Admin merasa seperti punya asisten operasional.
- Database tetap menjadi sumber kebenaran.
- AI bekerja di bagian yang bernilai tinggi, bukan di semua tombol.
- Sistem tetap jalan walau worker lokal atau AI sedang tidak aktif.

### 1. PWA Ringan Untuk Pelanggan

Web pemesanan bisa dikembangkan menjadi Progressive Web App.

Manfaat:

- Bisa dibuka seperti aplikasi dari homescreen HP.
- Lebih terasa cepat dan app-like.
- Bisa punya offline fallback sederhana.
- Bisa menyimpan draft keranjang lokal jika koneksi putus.
- Cocok untuk pelanggan repeat order dan mitra warung.

Fitur PWA yang disarankan:

- Manifest app dengan nama "Rumah Keripik".
- Icon app dari brand Rumah Keripik.
- Offline page untuk kondisi jaringan buruk.
- Cache halaman katalog dan asset gambar penting.
- Draft cart tersimpan di local storage lalu disinkronkan ke `order_draft`.

Catatan penting:

- Jangan simpan data sensitif di browser.
- Data transaksi final tetap harus dibuat server-side.
- Push notification web bisa dipertimbangkan nanti, tetapi Telegram lebih sederhana untuk fase awal.

### 2. AI Concierge Di Halaman Pesan

Alih-alih chatbot panjang seperti WhatsApp, AI dibuat sebagai concierge kecil di dalam halaman `/pesan`.

Contoh tampilan:

- Tombol "Bantu pilih rasa".
- Tombol "Paket hemat 50 ribu".
- Tombol "Untuk oleh-oleh".
- Tombol "Saya suka pedas".
- Input bebas: "Aku mau yang cocok buat anak-anak".

AI Concierge harus memberi hasil berbentuk aksi:

- Rekomendasi produk.
- Tombol tambah ke keranjang.
- Alasan singkat.
- Opsi paket.
- Pertanyaan klarifikasi maksimal 1 kali jika perlu.

Aturan rekomendasi:

- Tampilkan 1 sampai 3 rekomendasi saja.
- Produk wajib berasal dari tabel `produk`.
- Jika stok habis, AI tidak boleh merekomendasikan sebagai pilihan utama.
- Jika pelanggan menyebut budget, AI menghitung kombinasi berdasarkan harga database.
- Jika pelanggan menyebut "pedas", "original", atau "oleh-oleh", pakai tag produk sebelum LLM.

### 3. Smart Bundle Dan Upsell Halus

Sistem bisa membantu menaikkan nilai transaksi tanpa terasa memaksa.

Contoh:

- Jika cart di bawah Rp50.000, tampilkan "Tambah 1 Kripik Original agar jadi paket hemat".
- Jika pelanggan pilih pedas, tawarkan original sebagai penyeimbang.
- Jika pelanggan warung, tawarkan paket reseller.
- Jika pelanggan pernah beli produk tertentu, tampilkan "Pesan lagi favoritmu".

Sumber data:

- `detail_transaksi` untuk histori pembelian.
- `produk` untuk harga dan stok.
- `memory_pelanggan` untuk preferensi.
- `ai_response_cache` untuk cache rekomendasi umum.

AI dipakai hanya untuk bahasa penjelasan. Perhitungan bundle tetap deterministic dari database.

### 4. Repeat Order Super Cepat

Untuk pelanggan lama, alur bisa dipersingkat.

Flow:

- Pelanggan buka link dari Telegram atau halaman lacak.
- Sistem mengenali nomor HP atau `chatId`.
- Tampilkan order terakhir.
- Tombol "Pesan lagi".
- Pelanggan hanya konfirmasi qty, alamat, dan pembayaran.

Data terkait:

- `pelanggan_chatbot`
- `memory_pelanggan`
- `transaksi`
- `detail_transaksi`
- `lokasi_pelanggan`

Ini sangat cocok untuk:

- Warung retail.
- Reseller.
- Pelanggan rutin mingguan.
- Order keluarga.

### 5. Smart Address Dan Map Kit

Location kit perlu dibuat bertahap agar tidak mahal dan tidak terlalu kompleks.

Fase murah:

- Terima alamat manual.
- Terima link Google Maps.
- Terima koordinat dari browser geolocation.
- Simpan semua ke `lokasi_pelanggan`.
- Cache hasil parse/geocode di `geocode_cache`.

Fase canggih:

- Autocomplete alamat.
- Validasi alamat.
- Deteksi zona pengiriman otomatis.
- Hitung estimasi jarak.
- Tampilkan peta pelanggan di dashboard.
- Susun daftar pengiriman berdasarkan area.

Fase sangat canggih:

- Route optimization untuk banyak titik pengiriman.
- Delivery batch: "rute hari ini".
- Estimasi ongkir berbasis jarak.
- Deteksi pelanggan di luar zona.
- Heatmap pelanggan dan area potensial.

Prinsip biaya:

- Jangan panggil API Maps setiap render.
- Cache semua hasil geocode.
- Pakai geocode hanya saat alamat berubah.
- Untuk MVP, koordinat manual/link maps sudah cukup.

### 6. Realtime Order Timeline

Setiap order harus punya timeline yang jelas.

Contoh timeline pelanggan:

- Pesanan dibuat.
- Menunggu pembayaran.
- Bukti pembayaran diterima.
- Admin memverifikasi.
- Pesanan diproses.
- Pesanan dikirim.
- Pesanan selesai.

Contoh timeline admin:

- Draft dibuat dari web.
- Produk dikunci sementara.
- Bukti pembayaran masuk.
- Admin A memverifikasi.
- Stok dipotong.
- Pengiriman dibuat.

Tabel utama:

- `order_events`
- `transaksi`
- `detail_transaksi`
- `bukti_pembayaran`
- `delivery_assignment`

Jika belum memakai websocket, realtime bisa dimulai dari polling ringan setiap 10 sampai 20 detik di dashboard transaksi.

### 7. Admin Copilot

Dashboard bisa dibuat lebih kuat dengan AI Copilot.

Fitur admin copilot:

- Ringkas order yang perlu tindakan.
- Ringkas pelanggan repeat.
- Buat balasan cepat untuk chat.
- Sarankan update knowledge base.
- Deteksi alamat kurang lengkap.
- Deteksi bukti pembayaran yang perlu dicek manual.
- Sarankan prioritas pengiriman hari ini.

Contoh kartu copilot:

```text
Ada 3 order menunggu verifikasi.
2 pelanggan belum melengkapi alamat.
1 pertanyaan belum terjawab di knowledge base.
Produk Kripik Pedas mulai menipis.
```

AI copilot tidak boleh mengambil keputusan final. Admin tetap klik verifikasi, ubah status, dan konfirmasi pengiriman.

### 8. Token Budgeting AI

Agar AI tidak boros token, setiap fitur diberi level prioritas.

Level 0: tanpa AI

- Harga.
- Stok.
- Ongkir dari zona.
- Status transaksi.
- Validasi qty.

Level 1: rule/template

- Sapaan.
- Format invoice.
- Status order.
- Instruksi pembayaran.
- Reminder alamat kurang lengkap.

Level 2: retrieval/cache

- FAQ knowledge base.
- Rekomendasi berdasarkan tag produk.
- Pertanyaan katalog.
- Pertanyaan pengiriman umum.

Level 3: LLM

- Pertanyaan bebas.
- Perapihan alamat.
- Ringkasan chat panjang.
- Admin copilot.
- Saran knowledge base baru.

Aturan:

- Selalu cek cache dulu.
- Selalu kirim konteks minimal.
- Jangan kirim seluruh database ke model.
- Batasi output pendek.
- Simpan pertanyaan gagal untuk review, bukan dipaksa dijawab.

### 9. Agentic Workflow Aman

Konsep AI agent boleh dipakai, tetapi dengan batas aman.

AI boleh:

- Membuat draft order.
- Mengusulkan produk.
- Mengisi draft alamat.
- Membuat ringkasan.
- Menyiapkan pesan notifikasi.
- Membuat job untuk worker.

AI tidak boleh:

- Mengubah transaksi menjadi lunas.
- Menghapus transaksi.
- Mengubah stok final.
- Mengirim broadcast tanpa approval.
- Menentukan order selesai tanpa admin.

Semua aksi penting harus melewati:

- Validasi server.
- Database transaction jika diperlukan.
- Event log.
- Approval admin untuk aksi sensitif.

### 10. Customer Intelligence

Sistem bisa belajar dari transaksi tanpa terasa menyeramkan.

Data yang bermanfaat:

- Produk favorit.
- Rasa favorit.
- Budget umum.
- Area pengiriman.
- Frekuensi repeat order.
- Status pelanggan: baru, loyal, reseller, warung.

Output yang berguna:

- Segmentasi pelanggan.
- Paket rekomendasi.
- Reminder restock untuk warung.
- Promo area tertentu.
- Rekomendasi produksi stok.

Privasi:

- Tampilkan hanya data yang relevan untuk operasional.
- Jangan menjual data pelanggan.
- Jangan menyimpan data sensitif yang tidak dibutuhkan.
- Beri opsi admin menghapus data pelanggan jika diminta.

### 11. Inventory Forecasting Ringan

Untuk bisnis keripik, AI bisa membantu stok tanpa sistem ERP mahal.

Fitur awal:

- Produk terlaris 7 hari dan 30 hari.
- Estimasi stok habis.
- Rekomendasi produksi sederhana.
- Alert jika stok di bawah batas.

Rumus awal tanpa AI:

```text
rata_rata_terjual_harian = total_terjual_7_hari / 7
estimasi_hari_sisa = stok_saat_ini / rata_rata_terjual_harian
```

AI dipakai untuk menjelaskan insight:

- "Kripik Pedas kemungkinan habis dalam 3 hari."
- "Produksi Original bisa dinaikkan minggu ini karena repeat order naik."

### 12. Mode Hemat Biaya

Arsitektur hemat yang disarankan:

- Vercel untuk web dan API.
- Turso untuk database.
- Cloudinary untuk gambar dan bukti pembayaran.
- Telegram untuk notifikasi murah.
- Worker lokal opsional untuk job berat.
- Google Maps API hanya untuk fitur yang benar-benar perlu.
- WhatsApp resmi ditunda sampai order stabil.

Mode degradasi:

- Jika AI mati, checkout tetap jalan.
- Jika worker mati, job menunggu.
- Jika Maps API mahal, pelanggan tetap bisa input alamat manual.
- Jika Telegram gagal, admin tetap melihat order di dashboard.

## Roadmap Implementasi Canggih

### Fase A: Web Order MVP

Fokus:

- `/pesan`
- katalog produk
- cart
- checkout singkat
- create transaksi
- dashboard menerima order

### Fase B: Trust Layer

Fokus:

- bukti pembayaran Cloudinary
- invoice sederhana
- tracking order
- timeline status
- admin verification

### Fase C: AI-Assisted Commerce

Fokus:

- AI concierge
- FAQ knowledge base
- smart bundle
- repeat order
- cache AI

### Fase D: Map And Delivery Intelligence

Fokus:

- parse link Google Maps
- koordinat pelanggan
- zona pengiriman
- dashboard map
- delivery batch

### Fase E: Business Intelligence

Fokus:

- inventory forecast
- customer segmentation
- admin copilot
- unanswered question review
- rekomendasi produksi

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
- Google Maps Routes API: https://developers.google.com/maps/documentation/routes
- web.dev Progressive Web Apps: https://web.dev/explore/progressive-web-apps
- Next.js Forms: https://nextjs.org/docs/app/guides/forms
- Cloudinary Image Transformations: https://cloudinary.com/documentation/image_transformations
- Stripe Checkout: https://docs.stripe.com/payments/checkout
