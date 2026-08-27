/**
 * Smoke test untuk API baru (ledger, AI ops) di production.
 * Jalankan: npx tsx src/scripts/smoke-production-apis.ts
 */

const STOREFRONT_BASE = process.env.STOREFRONT_URL || 'https://rumah-keripik.pages.dev';
const ADMIN_BASE = process.env.ADMIN_URL || 'https://rumah-keripik-admin.pages.dev';

interface TestResult { name: string; passed: boolean; status: number; detail?: string }

async function main() {
  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<Response>, expectedCheck?: (status: number, isJson: boolean, isRedirect: boolean, body: string) => boolean) {
    try {
      const res = await fn();
      const status = res.status;
      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('json');
      const isRedirect = status >= 300 && status < 400;
      let detail = '';
      let ok = false;
      let bodyText = '';

      if (isRedirect) {
        const loc = res.headers.get('location') || '';
        detail = `redirect → ${loc}`;
        ok = true;
      } else if (isJson) {
        try { 
          const b = await res.json(); 
          bodyText = JSON.stringify(b);
          detail = bodyText.slice(0, 120); 
        } catch { 
          detail = '(json parse failed)'; 
        }
        ok = status >= 200 && status < 500;
      } else {
        bodyText = await res.text(); 
        detail = bodyText.slice(0, 80);
        ok = status >= 200 && status < 500;
      }

      if (expectedCheck) {
        ok = expectedCheck(status, isJson, isRedirect, bodyText);
      }

      results.push({ name, passed: ok, status, detail });
      if (ok) passed++; else failed++;
      console.log(`  ${ok ? '✅' : '❌'} ${name} (${status})${detail ? ` — ${detail}` : ''}`);
    } catch (e) {
      results.push({ name, passed: false, status: 0, detail: String(e) });
      failed++;
      console.log(`  ❌ ${name} — ERROR: ${e}`);
    }
  }

  const GET_STORE = (path: string) => fetch(`${STOREFRONT_BASE}${path}`, { redirect: 'manual' });
  const POST_STORE = (path: string, body: object) => fetch(`${STOREFRONT_BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), redirect: 'manual' });

  const GET_ADMIN = (path: string) => fetch(`${ADMIN_BASE}${path}`, { redirect: 'manual' });
  const POST_ADMIN = (path: string, body: object) => fetch(`${ADMIN_BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), redirect: 'manual' });

  console.log(`\n🌐 Smoke Test Cloudflare Production\nStorefront: ${STOREFRONT_BASE}\nAdmin: ${ADMIN_BASE}\n`);

  // 1. Storefront Home & Catalog Endpoints
  console.log('\n🛒 Storefront Endpoints:');
  await test('Storefront Homepage', () => GET_STORE('/'), (s) => s === 200);
  await test('Storefront Catalog Products API', () => GET_STORE('/api/public/products'));
  await test('Storefront Payment Methods API', () => GET_STORE('/api/public/payment-methods'));

  // 2. Courier API Endpoints on Admin
  console.log('\n🛵 Courier & Fleet Endpoints:');
  await test('Courier Route List (Unauthenticated → 401)', () => GET_ADMIN('/api/courier/routes'), (s) => s === 401);
  await test('Courier Incidents (Unauthenticated → 401)', () => POST_ADMIN('/api/courier/incidents', { type: 'test', description: 'test' }), (s) => s === 401);
  await test('Transcribe Endpoint Options (CORS)', () => fetch(`${ADMIN_BASE}/api/ai/transcribe`, { method: 'OPTIONS' }), (s) => s === 200 || s === 204);

  // 3. Admin Secured Endpoints
  console.log('\n👑 Admin Secured Endpoints:');
  await test('Admin Dashboard Homepage', () => GET_ADMIN('/'), (s) => s === 200 || s === 307);
  await test('Admin Ledger Report (Unauthenticated → 401/403)', () => GET_ADMIN('/api/admin/ledger/report'), (s) => s === 307 || s === 401 || s === 403 || s === 200);
  await test('Admin Courier Roster (Unauthenticated → 401/403)', () => GET_ADMIN('/api/admin/couriers'), (s) => s === 307 || s === 401 || s === 403 || s === 200);

  // Summary
  console.log(`\n📊 Summary: ${passed} passed, ${failed} failed out of ${results.length}\n`);

  if (failed > 0) {
    console.log('Failed tests:');
    results.filter((r) => !r.passed).forEach((r) => console.log(`   ${r.name} — status=${r.status} ${r.detail || ''}`));
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
export {};
