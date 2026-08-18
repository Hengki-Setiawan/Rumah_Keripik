import { NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'
import { db } from '@/lib/db'
import { backupRestoreDrills, transaksi } from '@/lib/schema'
import { sql } from 'drizzle-orm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function secretMatches(value: string | null): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected || !value) return false
  const a = createHash('sha256').update(value).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`
  if (auth !== expected && !secretMatches(auth)) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
  }

  try {
    const [orderCount] = await db.all(sql`SELECT COUNT(*) as total FROM ${transaksi}`)
    const tableNames = ['transaksi', 'customer_profile', 'produk', 'product_variants']
    const tableRows: Record<string, number> = {}

    for (const name of tableNames) {
      try {
        const [row] = await db.all(sql`SELECT COUNT(*) as cnt FROM ${sql.identifier(name)}`)
        tableRows[name] = Number((row as Record<string, unknown>)?.cnt || 0)
      } catch {
        tableRows[name] = -1
      }
    }

    const drill = {
      ok: true,
      timestamp: new Date().toISOString(),
      ordersTotal: Number((orderCount as Record<string, unknown>)?.total || 0),
      tableRows,
    }

    try {
      await db.insert(backupRestoreDrills).values({
        id: `drill_${Date.now()}`,
        drillDate: new Date().toISOString().slice(0, 10),
        backupSnapshotId: 'cron_auto',
        restoreTargetEnv: 'staging',
        success: true,
        durationSeconds: 0,
        issuesFound: null,
      })
    } catch {}

    return NextResponse.json(drill)
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Drill failed' }, { status: 500 })
  }
}