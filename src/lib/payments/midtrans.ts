import { createHash } from 'crypto';

export type MidtransQrisChargeResponse = {
  statusCode?: string;
  statusMessage?: string;
  transactionId?: string;
  orderId?: string;
  grossAmount?: string;
  paymentType?: string;
  transactionTime?: string;
  transactionStatus?: string;
  actions?: Array<{
    name: string;
    method: string;
    url: string;
  }>;
};

function compactBaseUrl(value?: string | null) {
  return value?.replace(/\/+$/, '') || '';
}

export function getPublicAppUrl() {
  return compactBaseUrl(
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ''
  );
}

export function getMidtransConfig() {
  const merchantId = process.env.MIDTRANS_MERCHANT_ID?.trim();
  const clientKey = process.env.MIDTRANS_CLIENT_KEY?.trim();
  const serverKey = process.env.MIDTRANS_SERVER_KEY?.trim();
  const mode = (process.env.MIDTRANS_MODE || 'sandbox').toLowerCase();
  const baseUrl = (mode === 'production'
    ? 'https://api.midtrans.com'
    : 'https://api.sandbox.midtrans.com'
  );

  if (!merchantId || !clientKey || !serverKey) return null;

  return {
    merchantId,
    clientKey,
    serverKey,
    baseUrl,
  };
}

export async function chargeMidtransQris(input: {
  orderId: string;
  amount: number;
  customer: {
    name: string;
    phone: string;
    email?: string | null;
  };
  items: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  overrideNotificationUrl?: string;
}) {
  const config = getMidtransConfig();
  if (!config) {
    return {
      ok: false as const,
      error: 'MIDTRANS_NOT_CONFIGURED',
      message: 'Midtrans belum dikonfigurasi di environment project.',
    };
  }

  const serverKeyBase64 = Buffer.from(config.serverKey + ':').toString('base64');

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Basic ${serverKeyBase64}`,
  };

  if (input.overrideNotificationUrl) {
    headers['X-Override-Notification'] = input.overrideNotificationUrl;
  }

  const payload = {
    payment_type: 'qris',
    transaction_details: {
      order_id: input.orderId,
      gross_amount: input.amount,
    },
    customer_details: {
      first_name: input.customer.name.slice(0, 50),
      phone: input.customer.phone,
      email: input.customer.email || undefined,
    },
    item_details: input.items.map((item) => ({
      id: item.name.slice(0, 50),
      price: item.price,
      quantity: item.quantity,
      name: item.name.slice(0, 50),
    })),
  };

  const response = await fetch(`${config.baseUrl}/v2/charge`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const result = await response.json().catch(() => ({})) as MidtransQrisChargeResponse;

  if (!response.ok || (result.statusCode !== '201' && result.statusCode !== '200')) {
    return {
      ok: false as const,
      error: 'MIDTRANS_CHARGE_FAILED',
      message: result.statusMessage || `Midtrans charge gagal dengan HTTP status ${response.status}`,
      raw: result,
    };
  }

  return {
    ok: true as const,
    charge: result,
  };
}

export function verifyMidtransNotificationSignature(input: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
}) {
  const config = getMidtransConfig();
  if (!config) return false;

  const raw = `${input.orderId}${input.statusCode}${input.grossAmount}${config.serverKey}`;
  const calculated = createHash('sha512').update(raw).digest('hex');

  return calculated === input.signatureKey;
}
