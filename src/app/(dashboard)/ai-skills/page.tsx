import { Bot, Brain, CreditCard, Handshake, MapPin, MessageSquare, PackageSearch, ShoppingCart } from 'lucide-react';

export const dynamic = 'force-dynamic';

const skills = [
  { title: 'Rekomendasi Produk', icon: PackageSearch, status: 'Aktif', input: 'Pesan user + katalog + stok + memory', output: 'product_cards', provider: 'Rule/database + LLM intent' },
  { title: 'Keranjang Chat', icon: ShoppingCart, status: 'Aktif', input: 'Card action + session', output: 'cart_summary', provider: 'Deterministic tool' },
  { title: 'Customer Memory', icon: Brain, status: 'Aktif', input: 'Cookie + customer_id + order facts', output: 'customer_confirm/address_confirm', provider: 'Database memory' },
  { title: 'Knowledge Base Search', icon: MessageSquare, status: 'Aktif', input: 'FAQ/policy/payment/shipping question', output: 'Short grounded answer + source', provider: 'RAG + model router' },
  { title: 'Location Picker', icon: MapPin, status: 'Aktif', input: 'Address/location stage', output: 'location_picker', provider: 'Browser geolocation + map' },
  { title: 'Payment Flow', icon: CreditCard, status: 'Aktif', input: 'Order + method + proof upload', output: 'payment_methods/payment_upload/order_status', provider: 'Payment service + admin verification' },
  { title: 'Admin Handoff', icon: Handshake, status: 'Aktif', input: 'Low confidence/complaint/manual request', output: 'needs_admin + handoff card', provider: 'Guardrail' },
  { title: 'Model Router', icon: Bot, status: 'Aktif', input: 'Task config + provider availability', output: 'Groq/Gemini/Cerebras/Qwen/deterministic fallback', provider: 'AI router' },
];

export default function AiSkillsPage() {
  return (
    <div className="space-y-6">
      <div><h1 className="font-headline-lg text-headline-lg text-on-surface">AI Skills</h1><p className="mt-1 text-on-surface-variant">Peta kemampuan AI Rumah Keripik sesuai Blueprint V3: tool, card, provider, dan guardrail.</p></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {skills.map((skill) => {
          const Icon = skill.icon;
          return (
            <article key={skill.title} className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
              <div className="mb-4 flex items-center justify-between gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-container text-primary"><Icon size={22} /></div><span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">{skill.status}</span></div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">{skill.title}</h2>
              <dl className="mt-4 space-y-2 text-sm"><Info label="Input" value={skill.input} /><Info label="Output" value={skill.output} /><Info label="Provider" value={skill.provider} /></dl>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-medium text-on-surface-variant">{label}</dt><dd className="mt-0.5 font-semibold text-on-surface">{value}</dd></div>; }
