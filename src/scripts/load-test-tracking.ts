const BASE = process.env.BASE_URL || 'https://rumah-keripik.vercel.app';
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '3', 10);
const REQUESTS = parseInt(process.env.REQUESTS || '10', 10);
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || '10000', 10);

interface LoadTestResult { success: boolean; latencyMs: number; status: number; error?: string; bytesReceived?: number; }

async function readAll(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<number> {
  let total = 0;
  let result: ReadableStreamReadResult<Uint8Array>;
  while (!(result = await reader.read()).done) {
    total += result.value.length;
  }
  return total;
}

async function trackOrder(): Promise<LoadTestResult> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(`${BASE}/api/tracking/eval-sample-order`, { signal: controller.signal });
    clearTimeout(timeout);
    const latency = Date.now() - start;
    if (!res.ok) return { success: false, latencyMs: latency, status: res.status };
    const reader = res.body?.getReader();
    const bytes = reader ? await readAll(reader) : 0;
    return { success: true, latencyMs: latency, status: 200, bytesReceived: bytes };
  } catch (error) {
    return { success: false, latencyMs: Date.now() - start, status: 0, error: String(error) };
  }
}

async function main() {
  console.log(`\n=== TRACKING LOAD TEST ===`);
  console.log(`Target: ${BASE}, Concurrency: ${CONCURRENCY}, Requests: ${REQUESTS}`);
  const results: LoadTestResult[] = [];
  const batches = Math.ceil(REQUESTS / CONCURRENCY);
  for (let b = 0; b < batches; b++) {
    const batchSize = Math.min(CONCURRENCY, REQUESTS - b * CONCURRENCY);
    const batchResults = await Promise.all(Array.from({ length: batchSize }, () => trackOrder()));
    results.push(...batchResults);
    const ok = batchResults.filter((r) => r.success).length;
    console.log(`Batch ${b + 1}/${batches}: ${ok}/${batchSize} success`);
    if (b < batches - 1) await new Promise((r) => setTimeout(r, 500));
  }
  const totalSuccess = results.filter((r) => r.success).length;
  const latencies = results.filter((r) => r.success).map((r) => r.latencyMs);
  const avg = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const p95 = latencies.length > 0 ? latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)] : 0;
  console.log(`\nResults: ${totalSuccess}/${results.length} success, Avg ${avg}ms, P95 ${p95}ms`);
  const rate = results.length > 0 ? (totalSuccess / results.length) * 100 : 0;
  process.exit(rate >= 80 ? 0 : 1);
}
main();
