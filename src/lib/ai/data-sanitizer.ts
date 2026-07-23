const PHONE_REGEX = /\b(62|0)8[0-9]{7,12}\b/g;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const ADDRESS_KEYWORDS = ['jalan', 'jl', 'gg', 'gang', 'rt', 'rw', 'kecamatan', 'kelurahan', 'desa'];
const ADDRESS_REGEX = new RegExp(`\\b(${ADDRESS_KEYWORDS.join('|')})\\s[^.,]{5,100}`, 'gi');
const CUSTOMER_ID_REGEX = /CUS-[A-Z0-9-]{10,20}/g;
const ORDER_ID_REGEX = /TX-\d{8}-\d{3,}/g;

export function sanitizeForAi(text: string): string {
  let sanitized = text;
  sanitized = sanitized.replace(PHONE_REGEX, '[PHONE]');
  sanitized = sanitized.replace(EMAIL_REGEX, '[EMAIL]');
  sanitized = sanitized.replace(CUSTOMER_ID_REGEX, '[CUSTOMER_ID]');
  sanitized = sanitized.replace(ORDER_ID_REGEX, '[ORDER_ID]');
  sanitized = sanitized.replace(ADDRESS_REGEX, '[ADDRESS]');
  return sanitized;
}

export function sanitizeMessages(messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>) {
  return messages.map((msg) => ({
    ...msg,
    content: sanitizeForAi(msg.content || ''),
  }));
}
