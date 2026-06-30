export function resolvePublicBaseUrl(fallback?: string): string {
  const candidates = [process.env.NEXTAUTH_URL, process.env.AUTH_URL, fallback].filter(
    (value): value is string => Boolean(value),
  );

  const candidate = candidates[0];
  if (!candidate) return 'http://localhost:3000';

  return candidate.replace(/\/$/, '');
}
