export {};
const BASE = process.env.BASE_URL || 'https://rumah-keripik.vercel.app';
const AUTH_BASE = 'https://rumah-keripik.vercel.app';

async function test(label: string, fn: () => Promise<boolean>) {
  try {
    const ok = await fn();
    console.log(`  ${ok ? '✅' : '❌'} ${label}`);
  } catch (e) {
    console.log(`  ❌ ${label} — ${e instanceof Error ? e.message : 'error'}`);
  }
}

async function createSession(): Promise<string> {
  const res = await fetch(`${AUTH_BASE}/api/auth/csrf`, { method: 'GET' });
  const html = await res.text();
  return '';
}

async function main() {
  console.log(`\n=== COURIER v21 SMOKE TEST ===`);
  console.log(`Target: ${BASE}\n`);

  const adminCookie = ''; // would need actual admin session

  // 1. Seed data check
  await test('Couriers exist (min 1)', async () => {
    const res = await fetch(`${BASE}/api/admin/couriers`);
    const json = await res.json();
    return json.ok && (json.data || []).length > 0;
  });

  // 2. Live locations
  await test('Live locations endpoint', async () => {
    const res = await fetch(`${BASE}/api/admin/couriers/live-locations`);
    const json = await res.json();
    return json.ok;
  });

  // 3. Auth logout endpoint
  await test('Logout endpoint exists', async () => {
    const res = await fetch(`${BASE}/api/courier/auth/logout`, { method: 'POST' });
    return res.status === 401; // should fail without auth
  });

  // 4. Batch grouping
  await test('Batch group endpoint', async () => {
    const res = await fetch(`${BASE}/api/admin/dispatch/batch-group`);
    return res.ok;
  });

  // 5. Settings endpoint check (localStorage based — just check page exists)
  await test('Settings page route', async () => {
    const res = await fetch(`${BASE}/admin/settings/courier`);
    return res.ok || res.status === 307 || res.status === 200;
  });

  console.log(`\nSmoke test selesai.`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
