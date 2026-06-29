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
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

## Optional environment variables

- `TELEGRAM_BOT_TOKEN`
- `WA_ACCESS_TOKEN`
- `WA_PHONE_NUMBER_ID`
- `WA_VERIFY_TOKEN`
- `WA_API_VERSION`
- `N8N_WEBHOOK_SECRET`

## Telegram webhook

After Vercel is live, open:

```text
/api/webhook/telegram?setup=webhook
```

This registers the bot webhook to the deployed domain.

## WhatsApp webhook

Configure the Meta webhook to point to:

```text
/api/webhook/wa
```
