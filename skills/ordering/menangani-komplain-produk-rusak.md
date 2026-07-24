---
name: menangani-komplain-produk-rusak
description: >
  Gunakan ketika pelanggan mengeluh keripik yang diterima basi, tidak renyah, remuk, atau rusak dalam pengiriman. Kata kunci: "basi", "melempem", "rusak", "hancur", "remuk".
tools_allowed:
  - get_order_status
  - search_knowledge_base
  - request_admin_handoff
version: 1
created_from: manual
---

## Langkah Penanganan
1. Validasi: tanyakan nomor pesanan ATAU kapan pesanan dibuat jika belum disebutkan.
2. Sampaikan empati singkat (maksimal 1 kalimat).
3. Panggil search_knowledge_base dengan query "kebijakan retur produk rusak" untuk memastikan jawaban sesuai kebijakan TERKINI.
4. Kalau pesanan dalam 3 hari terakhir DAN pelanggan belum pernah komplain sebelumnya: tawarkan proses retur/ganti dengan meminta FOTO bukti kerusakan.
5. Kalau di luar kondisi itu, ATAU pelanggan sudah komplain sebelumnya: request_admin_handoff dengan alasan spesifik.
