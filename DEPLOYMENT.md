# Deployment

## Vercel

1. Push the `master` branch to GitHub.
2. Import the repository in Vercel.
3. Set the environment variables from `.env.example`.
4. Deploy from `master`.

## Required environment variables

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `GROQ_API_KEY`
- `GEMINI_API_KEY`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `AUTH_URL`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

## Optional environment variables

- `TELEGRAM_BOT_TOKEN`
- `EVOLUTION_API_URL`
- `EVOLUTION_API_KEY`
- `EVOLUTION_INSTANCE_NAME`
- `WORKER_ID`
- `WORKER_NAME`
- `WORKER_POLL_MS`

## Database migration

Run this once after deploying the worker/blueprint update:

```bash
npm run db:migrate:v3
```

The migration is idempotent, so it is safe to run again if needed.

## Local worker

Railway is no longer required for the AI/background processor. Run the local worker when your computer is online:

```bash
npm run worker
```

If the worker is offline, pending jobs remain stored in Turso and will continue when the worker is started again. The dashboard shows the worker online/offline state from `/api/worker/status`.

## Telegram webhook

After Vercel is live, open:

```text
/api/webhook/telegram?setup=webhook
```

This registers the bot webhook to the deployed domain.

## WhatsApp webhook

Configure the Evolution webhook to point to:

```text
/api/webhook/wa
```
