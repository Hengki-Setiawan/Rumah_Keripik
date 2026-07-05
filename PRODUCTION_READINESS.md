# Production Readiness Final Validation

Use this checklist before saying the system is 100% ready for real customers.

## Local Final Gate

Run:

```bash
npm run readiness:production
```

This checks:

- required env values;
- Turso database connectivity;
- Cloudinary API connectivity;
- TypeScript;
- production build;
- public order smoke flow.

## Running HTTP/Security Smoke

Start a local production server:

```bash
npm run build
npm run start
```

Then in another terminal:

```bash
SMOKE_BASE_URL=http://localhost:3000 npm run smoke:http
SMOKE_BASE_URL=http://localhost:3000 npm run smoke:security
```

For deployed production, replace the URL:

```bash
SMOKE_BASE_URL=https://your-production-domain npm run smoke:http
SMOKE_BASE_URL=https://your-production-domain npm run smoke:security
```

## Manual Browser Gate

Verify in the production browser:

- `/pesan` loads on mobile and desktop.
- Customer can add product and variant to cart.
- Refresh restores active cart.
- Transfer/QRIS checkout creates an order.
- Payment instruction is shown.
- Cloudinary payment proof upload succeeds.
- `/pesan/lacak` rejects wrong phone/token and accepts valid phone/token.
- Admin can login.
- Admin can reject a proof with reason.
- Customer can reupload after rejection.
- Admin can approve a proof.
- Stock is deducted once.
- Receipt opens only after verification.
- Proforma, receipt, and packing label print cleanly.
- COD order can be approved and rejected.
- `/analitik/public-ordering` loads funnel and operations metrics.

## Cron Gate

Run against production:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://your-production-domain/api/cron/worker
curl -H "Authorization: Bearer <CRON_SECRET>" https://your-production-domain/api/cron/payment-ops
```

Expected: both return JSON with `ok: true`.

## Known External Dependencies

Production readiness depends on these external services being reachable:

- Turso database endpoint.
- Cloudinary API and upload endpoint.
- Vercel/hosting domain and auth cookie configuration.
- Optional OCR provider or Gemini Vision if OCR mode requires it.

If any external service times out, the code can still be correct but production is not ready until connectivity is restored.
