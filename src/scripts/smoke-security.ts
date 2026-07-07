import { config } from 'dotenv';

config({ path: '.env.local' });

async function main() {
  const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
  const { db } = await import('@/lib/db');
  const { desc, eq } = await import('drizzle-orm');
  const { paymentProof, transaksi } = await import('@/lib/schema');

  const [order] = await db
    .select()
    .from(transaksi)
    .orderBy(desc(transaksi.waktu_simpan))
    .limit(1);
  const [proof] = await db
    .select()
    .from(paymentProof)
    .orderBy(desc(paymentProof.uploaded_at))
    .limit(1);

  const checks: Array<{ name: string; run: () => Promise<{ status: number; ok: boolean }> }> = [];

  if (order?.kode_pesanan) {
    checks.push({
      name: 'track requires phone or token',
      run: async () => {
        const res = await fetch(`${baseUrl}/api/order/track?code=${encodeURIComponent(order.kode_pesanan!)}`);
        return { status: res.status, ok: res.status === 403 };
      },
    });
  }

  if (order?.kode_pesanan && order.status_token) {
    checks.push({
      name: 'track accepts valid token',
      run: async () => {
        const res = await fetch(`${baseUrl}/api/order/track?code=${encodeURIComponent(order.kode_pesanan!)}&token=${encodeURIComponent(order.status_token!)}`);
        return { status: res.status, ok: res.status === 200 };
      },
    });
  }

  if (proof?.id_payment_proof) {
    checks.push({
      name: 'admin approve rejects anonymous',
      run: async () => {
        const res = await fetch(`${baseUrl}/api/admin/payment-proofs/${encodeURIComponent(proof.id_payment_proof)}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: 'anonymous smoke should fail' }),
          redirect: 'manual',
        });
        return { status: res.status, ok: [302, 307, 401].includes(res.status) };
      },
    });
  }

  checks.push({
    name: 'invalid proof upload payload rejected',
    run: async () => {
      const res = await fetch(`${baseUrl}/api/public/payment-proof/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      return { status: res.status, ok: res.status === 400 };
    },
  });

  checks.push({
    name: 'chat send rejects missing customer session cookie',
    run: async () => {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatSessionId: 'CHS-forbidden-smoke', message: 'halo' }),
        redirect: 'manual',
      });
      return { status: res.status, ok: [302, 307, 401, 403, 404].includes(res.status) };
    },
  });

  checks.push({
    name: 'chat state rejects missing customer session cookie',
    run: async () => {
      const res = await fetch(`${baseUrl}/api/chat/state?chatSessionId=CHS-forbidden-smoke`, { redirect: 'manual' });
      return { status: res.status, ok: [302, 307, 401, 403, 404].includes(res.status) };
    },
  });

  checks.push({
    name: 'chat stream rejects missing customer session cookie',
    run: async () => {
      const res = await fetch(`${baseUrl}/api/chat/stream?chatSessionId=CHS-forbidden-smoke`, { redirect: 'manual' });
      return { status: res.status, ok: [302, 307, 401, 403, 404].includes(res.status) };
    },
  });

  const results = [];
  for (const check of checks) {
    const result = await check.run();
    results.push({ name: check.name, ...result });
  }

  const failed = results.filter((result) => !result.ok);
  console.log(JSON.stringify({ ok: failed.length === 0, results }, null, 2));
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
