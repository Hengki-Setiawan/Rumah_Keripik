import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

export async function GET() {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL ?? 'MISSING',
      TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN ? '✔ ada (' + process.env.TURSO_AUTH_TOKEN.slice(0, 20) + '...)' : 'MISSING',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? 'MISSING',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? '✔ ada' : 'MISSING',
      ADMIN_USERNAME: process.env.ADMIN_USERNAME ?? 'MISSING',
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ? '✔ ada' : 'MISSING',
    },
    tables: {} as Record<string, unknown>,
    errors: [] as string[],
  };

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    (results.errors as string[]).push('TURSO_DATABASE_URL atau TURSO_AUTH_TOKEN tidak ada di env!');
    return NextResponse.json(results);
  }

  // Gunakan fetch langsung ke Turso HTTP API — bypass @libsql/client sepenuhnya
  const tursoHttpUrl = url.replace('libsql://', 'https://');

  async function runQuery(sql: string): Promise<{ rows: unknown[]; error?: string }> {
    try {
      const resp = await fetch(`${tursoHttpUrl}/v2/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            { type: 'execute', stmt: { sql } },
            { type: 'close' },
          ],
        }),
      });
      if (!resp.ok) {
        return { rows: [], error: `HTTP ${resp.status}: ${await resp.text()}` };
      }
      const data = await resp.json() as any;
      const execResult = data?.results?.[0]?.response?.result;
      const rows = execResult?.rows ?? [];
      return { rows };
    } catch (err) {
      return { rows: [], error: String(err) };
    }
  }

  // Test koneksi dasar
  const pingResult = await runQuery('SELECT 1 as ping');
  results.ping = pingResult.error ?? 'ok';

  // Cek semua tabel penting
  const tables = ['produk', 'warung_retail', 'pelanggan_chatbot', 'transaksi', 'ai_knowledge_base', 'pesan_chat', 'chat_log'];
  for (const table of tables) {
    const r = await runQuery(`SELECT COUNT(*) as jumlah FROM ${table}`);
    if (r.error) {
      (results.tables as Record<string, unknown>)[table] = { error: r.error };
    } else {
      const row = r.rows[0] as any;
      const jumlah = row?.['0'] ?? row?.jumlah ?? '?';
      (results.tables as Record<string, unknown>)[table] = { jumlah };
    }
  }

  // Sample data produk
  const produkSample = await runQuery('SELECT id_produk, nama_produk, harga_jual, stok_gudang_utama FROM produk LIMIT 5');
  results.produk_sample = produkSample.error ? { error: produkSample.error } : produkSample.rows;

  // Versi Node.js dan env info
  results.runtime = {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
  };

  return NextResponse.json(results, {
    headers: { 'Content-Type': 'application/json' },
  });
}
