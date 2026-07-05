import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { failedConversation } from '@/lib/schema';
import { ResolveFailedConversationButton } from '@/components/admin/ResolveFailedConversationButton';

export const dynamic = 'force-dynamic';

export default async function FailedConversationsPage() {
  const rows = await db.select().from(failedConversation).orderBy(desc(failedConversation.created_at)).limit(100);
  const unresolved = rows.filter((row) => row.resolved === 0).length;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Failed Conversations</h1>
        <p className="text-on-surface-variant">Review input public/WA/Telegram yang tidak dipahami AI atau flow deterministic.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Summary label="Total" value={rows.length} />
        <Summary label="Belum resolved" value={unresolved} />
        <Summary label="Resolved" value={rows.length - unresolved} />
      </div>
      <div className="grid gap-4">
        {rows.map((row) => (
          <section key={row.id} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-black uppercase">{row.channel}</span>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase text-amber-800">{row.reason}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${row.resolved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{row.resolved ? 'resolved' : 'open'}</span>
                </div>
                <p className="mt-3 font-black">{row.user_message}</p>
                <p className="mt-1 text-sm text-on-surface-variant">State: {row.current_state || '-'}</p>
                {row.admin_note && <p className="mt-2 rounded-xl bg-neutral-50 p-3 text-sm">Admin note: {row.admin_note}</p>}
              </div>
              {!row.resolved && <ResolveFailedConversationButton id={row.id} />}
            </div>
          </section>
        ))}
        {rows.length === 0 && <p className="rounded-2xl border bg-white p-6 text-center text-on-surface-variant">Belum ada failed conversation.</p>}
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border bg-white p-4"><p className="text-xs font-black uppercase text-on-surface-variant">{label}</p><p className="text-3xl font-black text-primary">{value}</p></div>;
}
