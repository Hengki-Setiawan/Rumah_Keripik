const BASE = process.env.BASE_URL || 'https://rumah-keripik.vercel.app';
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '5', 10);
const REQUESTS = parseInt(process.env.REQUESTS || '20', 10);
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || '15000', 10);

interface LoadTestResult {
  success: boolean;
  latencyMs: number;
  status: number;
  error?: string;
  bytesReceived?: number;
}

async function sendChatRequest(): Promise<LoadTestResult> {
  const start = Date.now();
  try {
    const sessRes = await fetch(`${BASE}/api/customer/session`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    if (!sessRes.ok) return { success: false, latencyMs: Date.now() - start, status: sessRes.status, error: `Session ${sessRes.status}` };
    const sess = await sessRes.json();
    const chatSessionId = sess.chatSession?.id;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(`${BASE}/api/chat/stream?chatSessionId=${chatSessionId}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const latency = Date.now() - start;

    if (!res.ok) return { success: false, latencyMs: latency, status: res.status, error: `Stream ${res.status}` };

    const reader = res.body?.getReader();
    let bytes = 0;
    if (reader) {
      await reader.read().then(async function read({ done, value }) {
        if (done) return;
        bytes += value.length;
        return reader.read().then(read);
      });
    }

    return { success: true, latencyMs: latency, status: 200, bytesReceived: bytes };
  } catch (error) {
    return { success: false, latencyMs: Date.now() - start, status: 0, error: String(error) };
  }
}

async function main() {
  console.log(`\nLoading Test — ${BASE}`);
  console.log(`   Concurrency: ${CONCURRENCY}, Requests: ${REQUESTS}, Timeout: ${TIMEOUT_MS}ms\n`);

  const results: LoadTestResult[] = [];
  const batches = Math.ceil(REQUESTS / CONCURRENCY);

  for (let batch = 0; batch < batches; batch++) {
    const batchSize = Math.min(CONCURRENCY, REQUESTS - batch * CONCURRENCY);
    const batchResults = await Promise.all(Array.from({ length: batchSize }, () => sendChatRequest()));
    results.push(...batchResults);
    const ok = batchResults.filter((r) => r.success).length;
    console.log(`   Batch ${batch + 1}/${batches}: ${ok}/${batchSize} success`);
  }

  const totalSuccess = results.filter((r) => r.success).length;
  const totalFailed = results.filter((r) => !r.success).length;
  const latencies = results.filter((r) => r.success).map((r) => r.latencyMs);
  const avg = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const p95 = latencies.length > 0 ? latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)] : 0;

  console.log(`\nResults — Total: ${results.length}`);
  console.log(`   Success: ${totalSuccess}, Failed: ${totalFailed}`);
  console.log(`   Avg Latency: ${avg}ms, P95: ${p95}ms`);

  const errors = results.filter((r) => !r.success).reduce<Record<string, number>>((acc, r) => {
    const k = r.error?.split('\n')[0] || 'unknown';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  if (Object.keys(errors).length > 0) {
    console.log(`\nErrors:`);
    Object.entries(errors).forEach(([e, c]) => console.log(`   ${e}: ${c}`));
  }

  const rate = results.length > 0 ? (totalSuccess / results.length) * 100 : 0;
  console.log(`\nGrade: ${rate >= 95 ? 'A' : rate >= 80 ? 'B' : rate >= 50 ? 'C' : 'D'} (${rate.toFixed(1)}%)`);
  process.exit(totalFailed > 0 ? 1 : 0);
}

main();
