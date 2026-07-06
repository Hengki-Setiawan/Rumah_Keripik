import { scorePaymentProof } from '@/lib/payment-proof-scoring';

type PaymentOcrPayload = {
  proofId: string;
  orderId: string;
  secureUrl: string;
  expectedAmount: number | null;
  expectedReceiverName?: string | null;
  paymentMethodLabel?: string | null;
  amountClaimed: number | null;
  precheck?: { score?: number; warnings?: string[]; level?: string };
};

type ProviderOcrResult = {
  text?: string;
  amount?: number | null;
  reference?: string | null;
  statusKeywords?: string[];
  raw?: unknown;
};

export async function analyzePaymentProof(payload: PaymentOcrPayload) {
  const provider = await callOptionalOcrProvider(payload) ?? await callConditionalGeminiOcr(payload);
  const extractedAmount = provider?.amount ?? payload.amountClaimed ?? null;
  const precheck = scorePaymentProof(
    { amount_claimed: extractedAmount, status: 'pending', uploaded_at: new Date().toISOString() },
    payload.expectedAmount == null ? null : { total_bayar: payload.expectedAmount, payment_status: 'proof_uploaded' },
  );

  const receiverWarnings = buildReceiverWarnings(provider?.text, payload.expectedReceiverName);
  const warnings = [...new Set([...(payload.precheck?.warnings || []), ...precheck.warnings, ...receiverWarnings])];
  const summary = buildSummary({ provider, extractedAmount, expectedAmount: payload.expectedAmount, warnings, score: precheck.score });

  return {
    engine: provider?.raw && typeof provider.raw === 'object' && 'provider' in provider.raw ? String((provider.raw as { provider?: string }).provider) : provider ? 'external_ocr_provider' : 'rule_based_mvp',
    proofId: payload.proofId,
    orderId: payload.orderId,
    expectedAmount: payload.expectedAmount,
    amountClaimed: payload.amountClaimed,
    extractedAmount,
    reference: provider?.reference ?? null,
    statusKeywords: provider?.statusKeywords ?? [],
    score: precheck.score,
    warnings,
    summary,
    autoDecision: 'none',
    rawProviderResult: provider?.raw ?? null,
  };
}

function buildReceiverWarnings(text: string | undefined, expectedReceiverName?: string | null) {
  if (!expectedReceiverName || !text) return [];
  const normalizedText = normalizeForMatch(text);
  const normalizedReceiver = normalizeForMatch(expectedReceiverName);
  if (!normalizedReceiver || normalizedText.includes(normalizedReceiver)) return [];
  return [`Nama penerima yang diharapkan (${expectedReceiverName}) tidak terbaca jelas dari OCR.`];
}

function normalizeForMatch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function callOptionalOcrProvider(payload: PaymentOcrPayload): Promise<ProviderOcrResult | null> {
  const endpoint = process.env.PAYMENT_OCR_ENDPOINT;
  if (!endpoint) return null;

  const apiKey = process.env.PAYMENT_OCR_API_KEY;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ imageUrl: payload.secureUrl, proofId: payload.proofId, orderId: payload.orderId }),
  });

  if (!res.ok) throw new Error(`OCR provider gagal: ${res.status}`);
  const data = await res.json();
  return {
    text: typeof data.text === 'string' ? data.text : undefined,
    amount: typeof data.amount === 'number' ? data.amount : extractAmountFromText(data.text),
    reference: typeof data.reference === 'string' ? data.reference : null,
    statusKeywords: extractStatusKeywords(String(data.text || '')),
    raw: data,
  };
}

async function callConditionalGeminiOcr(payload: PaymentOcrPayload): Promise<ProviderOcrResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  const mode = (process.env.OCR_MODE || 'conditional').toLowerCase();
  if (!apiKey || mode === 'off') return null;
  if (mode === 'manual' && !payload.precheck?.warnings?.includes('manual_ocr_requested')) return null;

  const shouldRun = mode === 'manual' || payload.amountClaimed == null || payload.amountClaimed !== payload.expectedAmount || (payload.precheck?.score ?? 100) < 80 || (payload.precheck?.warnings?.length ?? 0) > 0;
  if (!shouldRun) return null;

  const image = await fetchImageAsBase64(payload.secureUrl);
  if (!image) return null;

  const model = process.env.GEMINI_VISION_MODEL || 'gemini-2.0-flash';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: buildGeminiOcrPrompt(payload) },
          { inline_data: { mime_type: image.mimeType, data: image.base64 } },
        ],
      }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    }),
  });
  if (res.status === 429) return null;
  if (!res.ok) throw new Error(`Gemini OCR gagal: ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  const parsed = parseGeminiOcrJson(text);
  if (!parsed) return null;

  const rawText = typeof parsed.text === 'string' ? parsed.text : '';
  return {
    text: rawText,
    amount: typeof parsed.amount === 'number' ? parsed.amount : extractAmountFromText(rawText),
    reference: typeof parsed.reference === 'string' ? parsed.reference : null,
    statusKeywords: Array.isArray(parsed.statusKeywords) ? parsed.statusKeywords.filter((item): item is string => typeof item === 'string') : extractStatusKeywords(rawText),
    raw: { provider: 'gemini_vision_ocr', model, parsed, gemini: data },
  };
}

async function fetchImageAsBase64(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > 5 * 1024 * 1024) return null;
    return { mimeType: contentType.split(';')[0], base64: buffer.toString('base64') };
  } catch {
    return null;
  }
}

function buildGeminiOcrPrompt(payload: PaymentOcrPayload) {
  return `Extract payment proof fields from this Indonesian bank/e-wallet/QRIS screenshot. Return JSON only with keys: text, amount, reference, statusKeywords, receiverName, senderName, bankOrWallet, paymentDate, confidence. Expected amount: ${payload.expectedAmount ?? 'unknown'}. Expected receiver: ${payload.expectedReceiverName || 'unknown'}. Payment method: ${payload.paymentMethodLabel || 'unknown'}. Do not decide validity.`;
}

function parseGeminiOcrJson(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value.replace(/^```json\s*/i, '').replace(/```$/i, '').trim());
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function extractAmountFromText(text: unknown) {
  if (typeof text !== 'string') return null;
  const matches = text.match(/(?:rp\s*)?([0-9][0-9\s.,]{3,})/gi) || [];
  const amounts = matches
    .map((match) => Number(match.replace(/rp/gi, '').replace(/[^0-9]/g, '')))
    .filter((value) => Number.isFinite(value) && value > 0);
  return amounts.length ? Math.max(...amounts) : null;
}

function extractStatusKeywords(text: string) {
  const lower = text.toLowerCase();
  return ['berhasil', 'sukses', 'success', 'completed', 'transfer', 'qris'].filter((keyword) => lower.includes(keyword));
}

function buildSummary(input: { provider: ProviderOcrResult | null; extractedAmount: number | null; expectedAmount: number | null; warnings: string[]; score: number }) {
  const parts = [
    input.provider ? 'OCR provider berhasil membaca bukti.' : 'OCR provider belum dikonfigurasi; memakai rule-based precheck.',
    input.extractedAmount != null ? `Nominal terbaca/klaim: ${input.extractedAmount}.` : 'Nominal belum terbaca.',
    input.expectedAmount != null ? `Nominal order: ${input.expectedAmount}.` : 'Nominal order tidak tersedia.',
    `Skor bantuan: ${input.score}/100.`,
  ];
  if (input.warnings.length) parts.push(`Peringatan: ${input.warnings.join('; ')}.`);
  parts.push('Admin tetap wajib memutuskan approve/reject secara manual.');
  return parts.join(' ');
}
