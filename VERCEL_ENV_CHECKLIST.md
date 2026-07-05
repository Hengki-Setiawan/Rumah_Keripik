# Vercel Environment Checklist

Add these in Vercel Project Settings -> Environment Variables.

## Required

```txt
TURSO_DATABASE_URL
TURSO_AUTH_TOKEN
NEXTAUTH_SECRET
NEXTAUTH_URL
AUTH_URL
ADMIN_USERNAME
ADMIN_PASSWORD
CRON_SECRET
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
CLOUDINARY_URL
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
```

Use your deployed Vercel URL for:

```txt
NEXTAUTH_URL=https://your-domain.vercel.app
AUTH_URL=https://your-domain.vercel.app
```

## Recommended

```txt
GROQ_API_KEY
GEMINI_API_KEY
OCR_MODE=conditional
GEMINI_VISION_MODEL=gemini-2.0-flash
```

## Optional

```txt
TELEGRAM_BOT_TOKEN
PAYMENT_OCR_ENDPOINT
PAYMENT_OCR_API_KEY
WORKER_ID
WORKER_NAME
WORKER_POLL_MS
```

## Not Used If Evolution Is Disabled

```txt
EVOLUTION_API_URL
EVOLUTION_API_KEY
EVOLUTION_INSTANCE_NAME
```

## Security Rules

- Do not use `admin123` in production.
- Generate a long random `NEXTAUTH_SECRET`.
- Generate a long random `CRON_SECRET`.
- Never commit `.env.local`.
- Rotate any key that was accidentally shared or committed.

## Post-Deploy Smoke

After deploy, test:

```bash
curl https://your-domain.vercel.app/api/public/products
curl https://your-domain.vercel.app/api/public/payment-methods
curl -H "Authorization: Bearer <CRON_SECRET>" https://your-domain.vercel.app/api/cron/worker
```

Manual browser checks:

- `/pesan`
- checkout transfer
- upload payment proof
- admin login
- approve/reject proof
- COD approve/reject
- receipt and packing label after admin login
