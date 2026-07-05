# Security And Backup Checklist

## Password And Secrets

- Do not use simple admin passwords in production.
- Use a long random `ADMIN_PASSWORD` and update it in Vercel Production env.
- Keep `NEXTAUTH_SECRET` and `CRON_SECRET` at least 32 random characters.
- Never commit `.env.local`.
- Redeploy Vercel after changing env values.

## Recommended Admin Password Rotation

1. Generate a new strong password locally.
2. Update `ADMIN_PASSWORD` in Vercel Production env.
3. Redeploy latest production deployment.
4. Test login at `/login`.
5. Update local `.env.local` only after Vercel login works.

## Backup SOP

Run before major changes and at least weekly:

```bash
npm run db:backup
```

Store backups outside the repository, for example a private drive or cloud storage.

## Production Validation After Env Or Deploy Changes

```bash
SMOKE_BASE_URL=https://rumah-keripik.vercel.app npm run smoke:http
SMOKE_BASE_URL=https://rumah-keripik.vercel.app npm run smoke:security
```

Validate cron:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://rumah-keripik.vercel.app/api/cron/worker
curl -H "Authorization: Bearer <CRON_SECRET>" https://rumah-keripik.vercel.app/api/cron/payment-ops
```

## Operational Audit

Run:

```bash
npm run audit:production-ops
```

This reports recent smoke orders, payment proofs, low-stock products/variants, and recent worker jobs.

## Monitoring Recommendation

Add an external error monitor before large campaigns. Sentry is the recommended first choice because it is quick to add to Next.js and catches server/client exceptions.
