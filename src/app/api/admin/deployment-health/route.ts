import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paymentMethod, produk, workerJob } from '@/lib/schema';
import { sql } from 'drizzle-orm';

export async function GET() {
  const checks: Record<string, { ok: boolean; message: string }> = {
    tursoUrl: { ok: Boolean(process.env.TURSO_DATABASE_URL), message: process.env.TURSO_DATABASE_URL ? 'Configured' : 'Missing TURSO_DATABASE_URL' },
    tursoToken: { ok: Boolean(process.env.TURSO_AUTH_TOKEN), message: process.env.TURSO_AUTH_TOKEN ? 'Configured' : 'Missing TURSO_AUTH_TOKEN' },
    cloudinary: { ok: Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET), message: process.env.CLOUDINARY_CLOUD_NAME ? 'Cloudinary partially/fully configured' : 'Missing Cloudinary env' },
    auth: { ok: Boolean(process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET), message: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET ? 'Configured' : 'Missing auth secret' },
    cronSecret: { ok: process.env.NODE_ENV !== 'production' || Boolean(process.env.CRON_SECRET), message: process.env.CRON_SECRET ? 'Configured' : 'Missing CRON_SECRET in production' },
  };

  try {
    const [[productCount], [paymentCount], [jobCount]] = await Promise.all([
      db.select({ total: sql<number>`count(*)` }).from(produk),
      db.select({ total: sql<number>`count(*)` }).from(paymentMethod),
      db.select({ total: sql<number>`count(*)` }).from(workerJob),
    ]);
    return NextResponse.json({
      ok: Object.values(checks).every((check) => check.ok),
      checks,
      database: {
        products: Number(productCount?.total || 0),
        paymentMethods: Number(paymentCount?.total || 0),
        workerJobs: Number(jobCount?.total || 0),
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, checks, error: error instanceof Error ? error.message : 'Database health failed' }, { status: 500 });
  }
}
