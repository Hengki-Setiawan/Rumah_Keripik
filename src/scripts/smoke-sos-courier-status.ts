const BASE = process.env.BASE_URL || 'https://rumah-keripik.vercel.app';

async function main() {
  console.log('Smoke test: GET /api/courier/sos (unauthorized — should 401)\n');

  const res = await fetch(`${BASE}/api/courier/sos`);
  const status = res.status;
  const contentType = res.headers.get('content-type') || '';
  const bodyText = await res.text();
  let ok = status === 401 || status === 307;

  console.log(`  ${ok ? '✓' : '✗'} GET /api/courier/sos (status=${status})`);
  if (!ok) console.log(`    Expected 401, got ${status}: ${bodyText.slice(0, 100)}`);
  console.log(`\n${ok ? 'All passed' : 'FAILED'}`);
  process.exit(ok ? 0 : 1);
}

main();
