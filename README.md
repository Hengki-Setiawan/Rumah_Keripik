# 🍿 Rumah Keripik — Platform Pemesanan & Dashboard Operasional v1.0.0

> Platform pemesanan online berbasis AI Agent (RAG Engine) dan Dashboard Operasional Real-Time untuk UMKM Keripik Renyah Samarinda.

---

## 🌟 Fitur Utama v1.0.0

- 🤖 **AI Interactive Order Assistant**: Chatbot pemesanan berbasis Groq + Gemini RAG Engine & Rule State Machine.
- 📱 **PWA (Progressive Web App)**: Web `/pesan` dapat di-install langsung ke Layar Utama HP dengan Service Worker offline caching.
- ⚡ **Auto-Cancel & Restock Cron**: Pembatalan otomatis transaksi transfer > 24 jam & pengembalian stok ke database Turso.
- 🚚 **Courier Real-Time Tracking**: Integrasi lokasi kurir live & OSRM Map Routing.
- 💳 **Metode Pembayaran Lengkap**: Duitku, QRIS, Transfer Bank BCA/BNI (dengan Vision AI OCR Struk), dan COD.

---

## 🛠️ Stack Teknologi

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS & Lucide Icons
- **Database**: Turso (LibSQL / SQLite) via Drizzle ORM
- **AI Engine**: Groq (Llama 3.3 70B) & Gemini 2.0 Flash
- **Cloud Storage**: Cloudinary (Foto Produk & Bukti Transfer)
- **Testing**: Playwright E2E & Smoke Audit Suite

---

## 🚀 Memulai (Quick Start)

1. **Install Dependensi**:
   ```bash
   npm install
   ```
2. **Jalankan Dev Server**:
   ```bash
   npm run dev
   ```
   Buka `http://localhost:3000` di browser.

3. **Audit Kesiapan Produksi**:
   ```bash
   npm run readiness:production
   ```

---

© 2026 Rumah Keripik. Released under official Tag `v1.0.0`.
