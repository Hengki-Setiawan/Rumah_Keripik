# Database Migration Order

Run these commands after configuring `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.

Recommended single command:

```bash
npm run db:migrate:all
```

This runs the runtime-safe migrations in order:

1. `npm run db:migrate:v3` - worker, order events, outbound queue, delivery support.
2. `npm run db:migrate:v4` - integration fixes and delivery zones.
3. `npm run db:migrate:v5` - OCR result and order document tables.
4. `npm run db:migrate:public-ordering` - public ordering, product variants, payment methods, customer/session tables, and missing columns.

Optional smoke seed for test data:

```bash
npm run db:seed:smoke
```

Do not run smoke seed on a production database unless you intentionally want dummy smoke records.

Verification commands:

```bash
npm run smoke:public-order
npm run smoke:cloudinary
npm run smoke:worker
npm run smoke:cron-auth
npm run smoke:http
npm run build
```

Notes:

- Migrations are designed to be idempotent where possible.
- `.env.local` is ignored by git and must not be committed.
- Vercel production must have the same required environment variables set in the dashboard.
