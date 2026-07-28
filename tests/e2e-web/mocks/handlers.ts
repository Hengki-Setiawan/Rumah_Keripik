import { http, HttpResponse } from 'msw';

export const mockProducts = [
  { id: 'prod-1', name: 'Kripik Balado', price: 15000, image: '/images/balado.jpg', category: 'Balado', stock: 50 },
  { id: 'prod-2', name: 'Kripik Original', price: 13000, image: '/images/original.jpg', category: 'Original', stock: 30 },
  { id: 'prod-3', name: 'Kripik Pedas', price: 14000, image: '/images/pedas.jpg', category: 'Pedas', stock: 20 },
];

export const mockPaymentMethods = [
  { id: 'cod', name: 'Bayar di Tempat (COD)', type: 'cod' },
  { id: 'qris', name: 'QRIS', type: 'online' },
  { id: 'transfer', name: 'Transfer Bank', type: 'online' },
];

export const mockChatSession = { id: 'CHS-test-0001', stage: 'idle' };

export const mockGreetingMessage = {
  role: 'assistant' as const,
  content: 'Halo! Mau pesan keripik apa hari ini?',
  createdAt: new Date().toISOString(),
};

export const handlers = [
  http.post('/api/customer/session', () =>
    HttpResponse.json({
      ok: true,
      chatSession: mockChatSession,
      messages: [],
      cart: null,
      customerContext: null,
    }),
  ),

  http.get('/api/chat/sessions', () =>
    HttpResponse.json({ ok: true, sessions: [] }),
  ),

  http.post('/api/chat/action', () =>
    HttpResponse.json({
      ok: true,
      messages: [mockGreetingMessage],
      cart: null,
      stage: 'idle',
    }),
  ),

  http.get('/api/chat/poll', () =>
    HttpResponse.json({ ok: true, changed: false }),
  ),

  http.get('/api/chat/state', () =>
    HttpResponse.json({ ok: true, messages: [], cart: null, stage: 'idle' }),
  ),

  http.post('/api/chat', async ({ request }) => {
    const body = await request.json() as { message?: string };
    return HttpResponse.json({
      ok: true,
      messages: [
        { role: 'user', content: body.message || '', createdAt: new Date().toISOString() },
        { role: 'assistant', content: 'Baik, saya bantu pesankan! Silakan isi data pengiriman ya kak!', createdAt: new Date().toISOString() },
      ],
      cart: { items: [{ productId: 'prod-1', name: 'Kripik Balado', qty: 2, price: 15000 }], itemCount: 1, total: 30000 },
      stage: 'awaiting_address',
    });
  }),

  http.get('/api/public/products', () =>
    HttpResponse.json({ ok: true, products: mockProducts }),
  ),

  http.get('/api/public/payment-methods', () =>
    HttpResponse.json({ ok: true, methods: mockPaymentMethods }),
  ),

  http.post('/api/chat/order', () =>
    HttpResponse.json({
      ok: true,
      order: { id: 'ORD-test-001', orderCode: 'TEST-001', total: 30000, paymentMethod: 'cod' },
    }),
  ),
];
