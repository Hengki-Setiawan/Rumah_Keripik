# Admin Operations SOP

Use this SOP for daily Rumah Keripik order operations.

## Daily Start

- Open `/pembayaran/verifikasi` and check pending payment proofs.
- Open `/pembayaran/cod` and check pending COD orders.
- Open `/analitik/public-ordering` and check funnel/payment/OCR metrics.
- Check product and variant stock before sharing promo links.

## Payment Proof Verification

1. Open `/pembayaran/verifikasi`.
2. Open payment proof detail before deciding.
3. Compare proof image with order total, receiver/account, date, and status text.
4. Use OCR score as an assistant only; never approve based on OCR alone.
5. Approve only when the proof is valid.
6. Reject with a clear reason when amount/account/status is wrong.
7. After approval, open receipt and packing label.

## COD Verification

1. Open `/pembayaran/cod`.
2. Approve COD only when address/phone/order are acceptable.
3. Reject COD when address/phone is suspicious or outside service area.
4. Approved COD order deducts stock and moves to processing.

## Printing

- Use browser print for receipt and packing label.
- Check recipient name, phone, address, order code, and item quantities before packing.
- If print layout looks wrong, do not ship until the label is corrected.

## Customer Status

- Customers can use `/pesan/lacak` with order code plus phone/token.
- Do not share admin dashboard links with customers.
- If payment proof is rejected, ask customer to upload a clearer proof from the status page.

## Smoke/Test Orders

- Smoke test orders may have recipient names containing `Smoke`.
- Do not ship smoke/test orders.
- Reconcile product stock after smoke tests because approved smoke orders deduct stock once.

## Incident Handling

- If checkout fails, check Vercel logs and `/api/admin/deployment-health` while logged in.
- If uploads fail, check Cloudinary env and quota.
- If cron fails, check `CRON_SECRET` and Vercel function logs.
- If database requests timeout, check Turso status/connectivity.

## Weekly Tasks

- Run database backup.
- Review failed conversations.
- Review low stock variants/products.
- Rotate admin password if it was shared.
- Test one full customer order flow from `/pesan` to receipt.
