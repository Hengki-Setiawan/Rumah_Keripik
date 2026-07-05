# Backup And Recovery

## Data Sources

- Turso/libSQL stores orders, customers, products, payment methods, payment proofs metadata, OCR results, and document metadata.
- Cloudinary stores product images, QRIS images, and payment proof images.

## Manual Turso Backup

Preferred helper:

```bash
npm run db:backup
```

This writes backup metadata under `backups/` and attempts a Turso CLI dump if the CLI is available and authenticated.

Use the Turso CLI from an authenticated machine:

```bash
turso db shell <database-name> ".dump" > backup-rumah-keripik-$(date +%Y%m%d).sql
```

If using libSQL remote URL only, export through the Turso dashboard/CLI according to the current Turso account policy.

## Restore Outline

1. Create a new Turso database or clear a recovery database.
2. Import the SQL dump.
3. Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` to the recovery database.
4. Run idempotent migrations:
   - `npm run db:migrate:v3`
   - `npm run db:migrate:v4`
   - `npm run db:migrate:v5`
5. Run `npx tsc --noEmit` and a production smoke flow.

## Cloudinary Retention

Keep these folders:

- `rumah-keripik/products`
- `rumah-keripik/products/variants`
- `rumah-keripik/qris`
- `rumah-keripik/payment-proofs`

Do not delete payment proof images unless the related order and proof metadata retention period has expired.

## Suggested Schedule

- Before each deployment: manual Turso dump.
- Weekly: Turso dump and Cloudinary folder review.
- Monthly: restore drill into a temporary database.

## Recovery Smoke Test

1. Open dashboard login.
2. Open product/category/variant pages.
3. Open `/pesan` and create a test order.
4. Upload a payment proof.
5. Run `/api/cron/worker` with `CRON_SECRET`.
6. Approve proof and open receipt/packing label.
