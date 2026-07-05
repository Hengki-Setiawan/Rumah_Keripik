import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customerAddress, customerIdentity, customerProfile, transaksi, webChatMessage, webOrderSession } from '@/lib/schema';
import { formatRupiah } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function WebSessionsPage() {
  const sessions = await db
    .select({ session: webOrderSession, customer: customerProfile })
    .from(webOrderSession)
    .leftJoin(customerProfile, eq(webOrderSession.id_customer, customerProfile.id_customer))
    .orderBy(desc(webOrderSession.last_event_at))
    .limit(80);

  const orders = await db.select().from(transaksi).orderBy(desc(transaksi.waktu_simpan)).limit(80);
  const orderBySession = new Map(orders.filter((order) => order.id_session).map((order) => [order.id_session!, order]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Web Sessions</h1>
        <p className="text-on-surface-variant">Pantau sesi publik `/pesan`, customer, dan order yang terhubung.</p>
      </div>
      <div className="grid gap-4">
        {sessions.map(({ session, customer }) => {
          const order = orderBySession.get(session.id_session);
          return (
            <section key={session.id_session} className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">{session.status} - {session.current_state}</p>
                  <h2 className="mt-1 text-xl font-black">{customer?.nama || 'Customer anonim'}</h2>
                  <p className="text-sm text-on-surface-variant">{customer?.phone || session.anonymous_token.slice(0, 10)}</p>
                  <p className="mt-2 text-xs text-on-surface-variant">Last event: {new Date(session.last_event_at).toLocaleString('id-ID')}</p>
                </div>
                <div className="text-left md:text-right">
                  {order ? <><p className="font-black">{order.kode_pesanan || order.id_transaksi}</p><p className="text-primary font-black">{formatRupiah(order.total_bayar)}</p><p className="text-sm text-on-surface-variant">{order.payment_status}</p></> : <p className="text-sm text-on-surface-variant">Belum ada order</p>}
                </div>
              </div>
              <details className="mt-4 rounded-xl bg-neutral-50 p-3">
                <summary className="cursor-pointer font-black">Context dan cart</summary>
                <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify({ cart: safeParse(session.cart_json), context: safeParse(session.context_json) }, null, 2)}</pre>
              </details>
            </section>
          );
        })}
        {sessions.length === 0 && <p className="rounded-2xl border bg-white p-6 text-center text-on-surface-variant">Belum ada sesi web.</p>}
      </div>
      <CustomerSummary />
    </div>
  );
}

async function CustomerSummary() {
  const customers = await db.select().from(customerProfile).orderBy(desc(customerProfile.last_active_at)).limit(40);
  const identities = await db.select().from(customerIdentity).limit(200);
  const addresses = await db.select().from(customerAddress).limit(200);
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black">Customer Web Terbaru</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {customers.map((customer) => (
          <div key={customer.id_customer} className="rounded-xl bg-neutral-50 p-4">
            <p className="font-black">{customer.nama || customer.id_customer}</p>
            <p className="text-sm text-on-surface-variant">{customer.phone || '-'}</p>
            <p className="mt-1 text-xs text-on-surface-variant">Identity: {identities.filter((item) => item.id_customer === customer.id_customer).map((item) => item.provider).join(', ') || '-'}</p>
            <p className="mt-1 text-xs text-on-surface-variant">Alamat: {addresses.find((item) => item.id_customer === customer.id_customer)?.address_text || '-'}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function safeParse(value: string) {
  try { return JSON.parse(value); } catch { return value; }
}
