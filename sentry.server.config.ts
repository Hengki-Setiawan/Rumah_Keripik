import * as Sentry from '@sentry/nextjs'

const DSN = process.env.SENTRY_DSN || 'https://4cc732fa015ca2a0805344e771a1118c@o4510928650633216.ingest.us.sentry.io/4510928666361856'

if (process.env.DISABLE_SENTRY !== 'true') {
  Sentry.init({
    dsn: DSN,
    tracesSampleRate: 0.1,
  })
}
