---
name: pemburu-promo
description: >
  Gunakan ketika pelanggan tanya diskon/promo, ATAU ketika isi keranjang memenuhi syarat promo aktif dan pelanggan belum sadar.
tools_allowed:
  - get_cart
  - get_payment_methods
  - search_knowledge_base
version: 1
created_from: manual
---

## Langkah Penanganan
1. Cek search_knowledge_base untuk promo aktif TERKINI.
2. Kalau dipicu dari isi keranjang: sebutkan HANYA kalau relevan dan menguntungkan, jangan memaksakan promo tidak relevan.
3. Jangan menjanjikan kombinasi promo yang tidak eksplisit tertulis - kalau ragu, arahkan ke admin.
