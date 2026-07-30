export {};
const BASE_URL = process.env.BASE_URL || 'https://rumah-keripik.vercel.app';
const TEST_TOKEN = process.env.TEST_COURIER_TOKEN || '';
const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';

let passed = 0;
let failed = 0;

function assert(name: string, ok: boolean, detail?: string) {
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

async function main() {
  console.log('Smoke Test: Courier System v20\n');

  // ── 1. Shift endpoints ──
  console.log('1. Shift API');
  {
    const clockIn = await fetch(`${BASE_URL}/api/courier/shift/clock-in`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TEST_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: -8.5, lng: 115.2 }),
    });
    assert('POST /shift/clock-in returns 200/401', clockIn.status === 200 || clockIn.status === 401);

    const clockOut = await fetch(`${BASE_URL}/api/courier/shift/clock-out`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TEST_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: -8.5, lng: 115.2 }),
    });
    assert('POST /shift/clock-out returns 200/400/401',
      [200, 400, 401].includes(clockOut.status));
  }

  // ── 2. Delivery arrived ──
  console.log('\n2. Delivery Event API');
  {
    const arrived = await fetch(`${BASE_URL}/api/courier/deliveries/1/arrived`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TEST_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: -8.5, lng: 115.2 }),
    });
    assert('POST /deliveries/:id/arrived returns 200/401/404',
      [200, 401, 404].includes(arrived.status));
  }

  // ── 3. Incidents ──
  console.log('\n3. Incident API');
  {
    const report = await fetch(`${BASE_URL}/api/courier/incidents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TEST_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'kendaraan_mogok',
        severity: 'high',
        description: 'Smoke test: mesin mati',
        lat: '-8.5',
        lng: '115.2',
      }),
    });
    assert('POST /incidents returns 200/401', report.status === 200 || report.status === 401);

    if (report.status === 200) {
      const body = await report.json();
      assert('Incident response has ok: true', body.ok === true);
    }
  }

  // ── 4. Push tokens ──
  console.log('\n4. Push Token API');
  {
    const reg = await fetch(`${BASE_URL}/api/courier/push-tokens`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TEST_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expoPushToken: 'ExponentPushToken[smoke-test-xxxx]', platform: 'android' }),
    });
    assert('POST /push-tokens returns 200/401', reg.status === 200 || reg.status === 401);
  }

  // ── 5. Stats ──
  console.log('\n5. Stats API');
  {
    const stats = await fetch(`${BASE_URL}/api/courier/stats/me?period=week`, {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
    });
    assert('GET /stats/me returns 200/401', stats.status === 200 || stats.status === 401);

    if (stats.status === 200) {
      const body = await stats.json();
      assert('Stats response has ok: true and data', body.ok === true && body.data);
    }
  }

  // ── 6. Notifications ──
  console.log('\n6. Notification API');
  {
    const notifs = await fetch(`${BASE_URL}/api/courier/notifications?limit=5`, {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
    });
    assert('GET /notifications returns 200/401', notifs.status === 200 || notifs.status === 401);

    const markRead = await fetch(`${BASE_URL}/api/courier/notifications`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${TEST_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    });
    assert('PATCH /notifications returns 200/401', markRead.status === 200 || markRead.status === 401);
  }

  // ── 7. Route optimize ──
  console.log('\n7. Route Optimization');
  {
    const route = await fetch(`${BASE_URL}/api/courier/route/optimize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TEST_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentLat: -8.5, currentLng: 115.2 }),
    });
    assert('POST /route/optimize returns 200/401', route.status === 200 || route.status === 401);
  }

  // ── 8. Unauthorized access ──
  console.log('\n8. Unauthorized Access');
  {
    const noAuth = await fetch(`${BASE_URL}/api/courier/shift/clock-in`, { method: 'POST' });
    assert('No-auth clock-in returns 401', noAuth.status === 401);

    const noAuthStats = await fetch(`${BASE_URL}/api/courier/stats/me`);
    assert('No-auth stats returns 401', noAuthStats.status === 401);
  }

  // ── 9. Admin endpoints ──
  console.log('\n9. Admin API');
  {
    const deliveries = await fetch(`${BASE_URL}/api/admin/deliveries`);
    assert('GET /admin/deliveries returns 200/403', [200, 403].includes(deliveries.status));

    const incidents = await fetch(`${BASE_URL}/api/admin/incidents`);
    assert('GET /admin/incidents returns 200/403', [200, 403].includes(incidents.status));
  }

  // ── Summary ──
  console.log(`\n${'='.repeat(40)}`);
  console.log(`Total: ${passed + failed}  |  ✓ ${passed}  |  ✗ ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
