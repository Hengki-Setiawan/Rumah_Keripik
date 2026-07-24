---
name: komplain-keterlambatan-kirim
description: >
  Gunakan ketika pelanggan mengeluh pesanan belum sampai padahal sudah lama. Kata kunci: "lama banget", "belum sampai", "kapan sampai", "kok belum dikirim".
tools_allowed:
  - get_order_status
  - search_knowledge_base
  - request_admin_handoff
version: 1
created_from: manual
---

## Langkah Penanganan
1. Ambil status order via get_order_status — jangan menjawab berdasar asumsi umum.
2. Kalau status masih wajar (belum melewati estimasi): jelaskan posisi order dengan tenang, beri estimasi berdasar data.
3. Kalau sudah melebihi estimasi wajar: minta maaf singkat, request_admin_handoff untuk investigasi, jangan janji waktu pasti tanpa konfirmasi admin.
4. Kalau status delivered tapi pelanggan bilang belum terima: request_admin_handoff SEGERA, jangan coba selesaikan sendiri.
