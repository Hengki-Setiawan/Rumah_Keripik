import { test, expect } from '@playwright/test';

test.describe('Midtrans Webhook', () => {
  test('should reject webhook with invalid signature', async ({ request }) => {
    const res = await request.post('/api/payments/midtrans/webhook', {
      data: {
        order_id: 'test-123',
        transaction_status: 'settlement',
        gross_amount: '50000',
        signature_key: 'invalid-signature',
      },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('signature');
  });

  test('should process valid webhook idempotently', async ({ request }) => {
    const payload = {
      order_id: 'test-456',
      transaction_status: 'settlement',
      gross_amount: '50000',
      fraud_status: 'accept',
      signature_key: '',
    };
    const serverKey = process.env.MIDTRANS_SERVER_KEY || '';
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha512').update(payload.order_id + payload.transaction_status + payload.gross_amount + serverKey).digest('hex');
    payload.signature_key = hash;

    const res1 = await request.post('/api/payments/midtrans/webhook', { data: payload });
    expect(res1.status()).toBe(200);

    const res2 = await request.post('/api/payments/midtrans/webhook', { data: payload });
    expect(res2.status()).toBe(200);
  });
});
