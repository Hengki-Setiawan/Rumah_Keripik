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

export function isCacheable(input: { query: string; task?: string }): boolean {
  if (isPersonalQuery(input.query)) return false;
  if (input.task && CACHEABLE_CATEGORIES.has(input.task)) return true;
  return false;
}

const INTENT_TO_CATEGORY: Record<string, string> = {
  small_talk: 'faq_answer',
  faq_answer: 'faq_answer',
  show_payment: 'payment_methods',
  payment_methods: 'payment_methods',
  show_products: 'product_info',
  shipping_info: 'shipping_info',
  store_hours: 'store_hours',
};

export function cacheableCategoryForIntent(intent: string): string | null {
  const category = INTENT_TO_CATEGORY[intent] || null;
  return category && CACHEABLE_CATEGORIES.has(category) ? category : null;
}
