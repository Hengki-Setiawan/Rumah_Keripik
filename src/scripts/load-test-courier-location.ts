export {};
const BASE = process.env.BASE_URL || 'https://rumah-keripik.vercel.app';
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '5', 10);
const BATCHES = parseInt(process.env.BATCHES || '10', 10);

async function simulateLocationBatch(courierId: number, batchIndex: number): Promise<{ ok: boolean; ms: number }> {
  const start = Date.now();
  const baseLat = -5.147665 + (Math.random() - 0.5) * 0.02;
  const baseLng = 119.432732 + (Math.random() - 0.5) * 0.02;
  const points = Array.from({ length: 5 }, (_, i) => ({
    lat: String(baseLat + i * 0.0005),
    lng: String(baseLng + i * 0.0005),
    accuracy: String(5 + Math.random() * 10),
    speed: String(Math.random() * 10),
    recordedAt: new Date(Date.now() - i * 12000).toISOString(),
  }));
  try {
    const res = await fetch(`${BASE}/api/courier/location/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Test-Courier-Id': String(courierId) },
      body: JSON.stringify({ points }),
    });
    return { ok: res.ok, ms: Date.now() - start };
  } catch {
    return { ok: false, ms: Date.now() - start };
  }
}

async function main() {
  console.log(`=== LOCATION BATCH LOAD TEST ===`);
  console.log(`Target: ${BASE}, Concurrency: ${CONCURRENCY}, Batches: ${BATCHES}`);
  const allResults: number[] = [];
  let success = 0;
  let total = 0;

  for (let b = 0; b < BATCHES; b++) {
    const courierId = (b % 5) + 1;
    const batch = Array.from({ length: CONCURRENCY }, () => simulateLocationBatch(courierId, b));
    const results = await Promise.all(batch);
    for (const r of results) {
      total++;
      if (r.ok) success++;
      allResults.push(r.ms);
    }
    const ok = results.filter(r => r.ok).length;
    const avg = Math.round(results.reduce((a, r) => a + r.ms, 0) / results.length);
    console.log(`Batch ${b + 1}/${BATCHES}: ${ok}/${results.length} success, avg ${avg}ms`);
  }

  const avgAll = Math.round(allResults.reduce((a, b) => a + b, 0) / allResults.length);
  const sorted = [...allResults].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  console.log(`\nHasil: ${success}/${total} sukses, Avg ${avgAll}ms, P95 ${p95}ms`);
  const rate = (success / total) * 100;
  process.exit(rate >= 80 ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
