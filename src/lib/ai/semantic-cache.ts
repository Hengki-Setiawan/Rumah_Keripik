export const CACHEABLE_CATEGORIES = new Set([
  'faq_answer',
  'product_info',
  'shipping_info',
  'store_hours',
  'payment_methods',
]);

const PERSONAL_PATTERNS = [/pesanan (saya|aku)/i, /transaksi (saya|aku)/i, /alamat (saya|aku)/i, /status (pesanan|order)/i];

function isPersonalQuery(query: string): boolean {
  return PERSONAL_PATTERNS.some((p) => p.test(query));
}

export function shouldCache(query: string, category: string): boolean {
  if (isPersonalQuery(query)) return false;
  return CACHEABLE_CATEGORIES.has(category);
}

export function isCacheable(input: { query: string; task?: string }): boolean {
  if (isPersonalQuery(input.query)) return false;
  if (input.task && CACHEABLE_CATEGORIES.has(input.task)) return true;
  return false;
}
