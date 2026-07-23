/**
 * Load test sederhana untuk endpoint chat AI ordering.
 * Jalankan: npx tsx src/scripts/load-test-chat.ts
 *
 * Kirim N request concurrently ke endpoint /api/chat/order (SSE streaming).
 * Catat: success rate, avg latency, error distribution.
 *
 * PRASYARAT: VALID_SESSION_COOKIE harus di .env.local untuk autentikasi.
 * Jika tidak ada, test akan fallback ke endpoint public.
 */

const BASE = process.env.BASE_URL || 'https://rumah-keripik.vercel.app';
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '5', 10);
const REQUESTS = parseInt(process.env.REQUESTS || '20', 10);
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || '15000', 10);
const MESSAGE = process.env.TEST_MESSAGE || 'Halo, mau pesan keripik balado 2 bungkus';

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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const sessRes = await fetch(`${BASE}/api/customer/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const sessData = await sessRes.json().catch(() => ({}));
    const chatSessionId = sessData.chatSession?.id || `load-test-${Date.now()}`;

    const res = await fetch(`${BASE}/api/chat/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
      body: JSON.stringify({
        chatSessionId,
        message: MESSAGE,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latency = Date.now() - start;

    if (!res.ok) return { success: false, latencyMs: latency, status: res.status, error: `HTTP ${res.status}` };

    const reader = res.body?.getReader();
    let bytes = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
      }
    }

    return { success: true, latencyMs: latency, status: 200, bytesReceived: bytes };
  } catch (error) {
    return { success: false, latencyMs: Date.now() - start, status: 0, error: String(error) };
  }
}

async function main() {
  console.log(`\n🚀 Load Test — ${BASE}`);
  console.log(`   Concurrency: ${CONCURRENCY}, Total Requests: ${REQUESTS}, Timeout: ${TIMEOUT_MS}ms\n`);

  const results: LoadTestResult[] = [];
  const batches = Math.ceil(REQUESTS / CONCURRENCY);

  for (let batch = 0; batch < batches; batch++) {
    const batchSize = Math.min(CONCURRENCY, REQUESTS - batch * CONCURRENCY);
    const promises = Array.from({ length: batchSize }, () => sendChatRequest());
    const batchResults = await Promise.all(promises);
    results.push(...batchResults);

    const batchSuccess = batchResults.filter((r) => r.success).length;
    console.log(`   Batch ${batch + 1}/${batches}: ${batchSuccess}/${batchSize} success`);
  }

  const totalSuccess = results.filter((r) => r.success).length;
  const totalFailed = results.filter((r) => !r.success).length;
  const latencies = results.filter((r) => r.success).map((r) => r.latencyMs);
  const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const p95 = latencies.length > 0 ? latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)] : 0;
  const totalBytes = results.filter((r) => r.bytesReceived).reduce((a, r) => a + (r.bytesReceived || 0), 0);

  const errors = results.filter((r) => !r.success).reduce<Record<string, number>>((acc, r) => {
    const key = r.error?.split('\n')[0] || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  console.log(`\n📊 Load Test Results`);
  console.log(`   Total: ${results.length}`);
  console.log(`   ✅ Success: ${totalSuccess}`);
  console.log(`   ❌ Failed: ${totalFailed}`);
  console.log(`   ⚡ Avg Latency: ${avgLatency}ms`);
  console.log(`   📈 P95 Latency: ${p95}ms`);
  console.log(`   📦 Total Data: ${(totalBytes / 1024).toFixed(1)} KB`);

  if (Object.keys(errors).length > 0) {
    console.log(`\n❌ Error Distribution:`);
    Object.entries(errors).forEach(([err, count]) => console.log(`   ${err}: ${count}`));
  }

  const successRate = results.length > 0 ? (totalSuccess / results.length) * 100 : 0;
  const grade = successRate >= 95 ? 'A' : successRate >= 80 ? 'B' : successRate >= 50 ? 'C' : 'D';
  console.log(`\n🏆 Load Test Grade: ${grade} (${successRate.toFixed(1)}% success rate)`);

  process.exit(totalFailed > 0 ? 1 : 0);
}

main();
export {};
