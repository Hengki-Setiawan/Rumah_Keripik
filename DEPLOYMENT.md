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
