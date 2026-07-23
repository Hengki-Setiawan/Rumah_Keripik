/**
 * Smoke test untuk API baru (loyalty, ledger, AI ops) di production.
 * Jalankan: npx tsx src/scripts/smoke-production-apis.ts
 */

const BASE = process.env.BASE_URL || 'https://rumah-keripik.vercel.app';

interface TestResult { name: string; passed: boolean; status: number; detail?: string }

async function main() {
  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<Response>) {
    try {
      const res = await fn();
      const status = res.status;
      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('json');
      const isRedirect = status >= 300 && status < 400;
      let detail = '';
      let ok = false;

      if (isRedirect) {
        const loc = res.headers.get('location') || '';
        detail = `redirect → ${loc}`;
        ok = loc.includes('/login') || loc.includes('/auth'); // 307 to login is expected for POST without auth
      } else if (isJson) {
        try { const b = await res.json(); detail = JSON.stringify(b).slice(0, 120); } catch { detail = '(json parse failed)'; }
        ok = status >= 200 && status < 500;
      } else {
        const text = await res.text(); detail = text.slice(0, 80);
        ok = status >= 200 && status < 500;
      }

      results.push({ name, passed: ok, status, detail });
      if (ok) passed++; else failed++;
      console.log(`  ${ok ? '✓' : '✗'} ${name} (${status})${detail ? ` — ${detail}` : ''}`);
    } catch (e) {
      results.push({ name, passed: false, status: 0, detail: String(e) });
      failed++;
      console.log(`  ✗ ${name} — ERROR: ${e}`);
    }
  }

  const GET = (path: string) => fetch(`${BASE}${path}`, { redirect: 'manual' });
  const POST = (path: string, body: object) => fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), redirect: 'manual' });

  console.log(`\n🔍 Smoke Test — ${BASE}\n`);

  // 1. Public GET endpoints
  console.log('\n📡 Public GET (expect JSON):');
  await test('Loyalty Balance', () => GET('/api/loyalty/balance?customerId=INVALID'));
  await test('Chat Order History', () => GET('/api/chat/history?no_wa=6281234567890&page=1&limit=5'));
  await test('Public Products', () => GET('/api/public/products'));
  await test('Public Categories', () => GET('/api/public/categories'));
  await test('Payment Methods', () => GET('/api/public/payment-methods'));

  // 2. Public POST — Auth.js v5 intercepts & redirects to login (expected)
  console.log('\n📡 Public POST (expect 307 → login — Auth.js CSRF):');
  await test('Loyalty Redeem', () => POST('/api/loyalty/redeem', { customerId: '', points: 0, orderId: '' }));
  await test('Referral Use', () => POST('/api/loyalty/referral/use', { code: '', refereeCustomerId: '' }));
  await test('Chat Send', () => POST('/api/chat/send', { no_wa: '', teks: '' }));

  // 3. Admin GET (no auth → 307 or 200 with login page)
  console.log('\n🔐 Admin GET (no auth → expect redirect/login):');
  await test('Ledger Report', () => GET('/api/admin/ledger/report?periodStart=2026-01-01&periodEnd=2026-12-31'));
  await test('AI Ops Provider Usage', () => GET('/api/admin/ai-ops/provider-usage'));
  await test('AI Ops Daily Usage', () => GET('/api/admin/ai-ops/daily-usage'));
  await test('AI Ops Task Dist', () => GET('/api/admin/ai-ops/task-distribution'));
  await test('Loyalty Stats', () => GET('/api/admin/loyalty/stats'));

  // 4. Admin POST (no auth → 307 redirect to login)
  console.log('\n🔐 Admin POST (no auth → expect 307 redirect):');
  await test('Ledger Expense', () => POST('/api/admin/ledger/expense', { categoryId: '', amount: 0, note: '' }));
  await test('Order Status Update', () => POST('/api/admin/orders/test/status', { orderStatus: 'processing' }));

  // Summary
  console.log(`\n📊 Summary: ${passed} passed, ${failed} failed out of ${results.length}\n`);

  if (failed > 0) {
    console.log('Failed tests:');
    results.filter((r) => !r.passed).forEach((r) => console.log(`  ✗ ${r.name} — status=${r.status} ${r.detail || ''}`));
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
export {};
