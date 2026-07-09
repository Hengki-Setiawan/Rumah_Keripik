import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function AiMonitorPage() {
  redirect('/ai-workspace?tab=monitor');
}
