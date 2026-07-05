# Smoke Test Checklist

Run this before production deployment and after major database migrations.

## Admin Setup

- Login admin.
- Open `/master-data/kategori-produk` and create/toggle a category.
- Open `/master-data/produk`, create/edit a product, upload a product image.
- Open `/master-data/varian-produk`, choose a product from dropdown, create a variant, upload a variant image.
- Open `/pembayaran/metode`, create/edit bank transfer, QRIS, e-wallet, and COD methods.

## Public Order

- Open `/pesan` without login.
- Select category, product, and variant.
- Confirm disabled payment methods obey min/max order rules.
- Ask the public assistant about payment or COD.
- Checkout and confirm success URL contains `?token=`.
- Confirm payment instruction card appears.
- Upload payment proof.

## Worker And Verification

- Call `/api/cron/worker` with `Authorization: Bearer <CRON_SECRET>`.
- Open `/pembayaran/verifikasi`.
- Confirm proof appears with risk score and OCR info.
- Open proof detail and verify OCR/duplicate panels do not error.
- Reject once and confirm customer status page shows rejection reason.
- Reupload proof and approve.
- Confirm stock deducted only once.

## Documents

- Open proforma.
- Open receipt after approval.
- Open packing label.
- Print/save and confirm document number appears.

## COD

- Create COD order.
- Open `/pembayaran/cod`.
- Approve one COD order and reject another.
- Confirm customer status changes.

## Observability

- Open `/web-sessions`.
- Open `/failed-conversations`.
- Open `/api/admin/deployment-health` while authenticated.

## Build

- Run `npx tsc --noEmit`.
- Run `npm run build`.
