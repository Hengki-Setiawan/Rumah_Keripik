# Deployment Checklist

## Required Environment Variables

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `NEXTAUTH_SECRET` or `AUTH_SECRET`
- `NEXTAUTH_URL`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CRON_SECRET` for production cron endpoints
- `OCR_MODE` (recommended: `conditional`)
- `GEMINI_VISION_MODEL` (recommended: `gemini-2.5-flash-lite`)

## Optional Environment Variables

- `PAYMENT_OCR_ENDPOINT`
- `PAYMENT_OCR_API_KEY`
- `EVOLUTION_API_URL`
- `EVOLUTION_API_KEY`
- `EVOLUTION_INSTANCE_NAME`
- `TELEGRAM_BOT_TOKEN`
- `GROQ_API_KEY`
- `GEMINI_API_KEY`

## Required Smoke Flow

Run database migrations first:

```bash
npm run db:migrate:all
```

1. Open `/pesan` without login.
2. Select category, product, variant, and payment method.
3. Create order and confirm success page has `token` query.
4. Upload payment proof.
5. Open `/pembayaran/verifikasi` as admin.
6. Approve or reject payment proof.
7. Open proforma, receipt, and packing label.
8. Call `/api/admin/deployment-health` as authenticated admin.
9. Call `/api/cron/worker` with `Authorization: Bearer <CRON_SECRET>`.

## Notes

- Browser printing is the supported MVP print method.
- Payment gateway is intentionally not part of MVP.
- Static QRIS and manual bank/e-wallet transfer require customer proof upload and admin verification.
- OCR output is advisory only. Admin approval remains the source of truth.
- Vercel Hobby only allows daily cron schedules; keep `vercel.json` cron expressions daily unless the project is upgraded to Pro.
- See `DEPLOYMENT_DB_MIGRATION_ORDER.md` and `VERCEL_ENV_CHECKLIST.md` before production deploy.
