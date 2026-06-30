import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { chatLog, transaksi } from '@/lib/schema';
import { sql, gte } from 'drizzle-orm';

export async function GET() {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const sinceStr = todayStart.toISOString();

    const since30d = new Date();
    since30d.setDate(since30d.getDate() - 30);
    const since30dStr = since30d.toISOString();

    const [total] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(chatLog)
      .where(gte(chatLog.timestamp, sinceStr));

    const [ruleCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(chatLog)
      .where(sql`${chatLog.sumber} = 'rule' AND ${chatLog.timestamp} >= ${sinceStr}`);

    const [groqCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(chatLog)
      .where(sql`${chatLog.sumber} = 'groq' AND ${chatLog.timestamp} >= ${sinceStr}`);

    const [geminiCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(chatLog)
      .where(sql`${chatLog.sumber} = 'gemini' AND ${chatLog.timestamp} >= ${sinceStr}`);

    const [notFoundCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(chatLog)
      .where(sql`${chatLog.sumber} = 'not_found' AND ${chatLog.timestamp} >= ${sinceStr}`);

    // ─── FUNNEL DATA (30 hari) ────────────────────────────────────────────────
    const [totalChat30d] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(chatLog)
      .where(gte(chatLog.timestamp, since30dStr));

    const [orderDimulai] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(transaksi)
      .where(gte(transaksi.waktu_simpan, since30dStr));

    const [draftDisimpan] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(transaksi)
      .where(sql`${transaksi.waktu_simpan} >= ${since30dStr} AND ${transaksi.status_pembayaran} IN ('Menunggu_Bayar', 'Menunggu_Verifikasi', 'Lunas', 'Dibatalkan')`);

    const [buktDiterima] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(transaksi)
      .where(sql`${transaksi.waktu_simpan} >= ${since30dStr} AND ${transaksi.status_pembayaran} IN ('Menunggu_Verifikasi', 'Lunas')`);

    const [lunas] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(transaksi)
      .where(sql`${transaksi.waktu_simpan} >= ${since30dStr} AND ${transaksi.status_pembayaran} = 'Lunas'`);
    // ─────────────────────────────────────────────────────────────────────────

    const totalCount = total.count || 1;

    return NextResponse.json({
      total_pesan: total.count,
      rule_persen: Math.round(((ruleCount.count || 0) / totalCount) * 100),
      groq_persen: Math.round(((groqCount.count || 0) / totalCount) * 100),
      gemini_persen: Math.round(((geminiCount.count || 0) / totalCount) * 100),
      not_found_persen: Math.round(((notFoundCount.count || 0) / totalCount) * 100),
      avg_response_ms: 0,
      // Funnel data untuk ConversionFunnel component
      funnel: {
        total_chat: totalChat30d.count,
        total_order_dimulai: orderDimulai.count,
        total_draft_disimpan: draftDisimpan.count,
        total_bukti_diterima: buktDiterima.count,
        total_lunas: lunas.count,
      },
    });
  } catch (err) {
    console.error('[Analytics/Bot/Performance]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
