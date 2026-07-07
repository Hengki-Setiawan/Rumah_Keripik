import { getChatV3Sessions } from '@/actions/chat-v3-admin';
import { HubKomunikasiV3Client } from '@/components/dashboard/HubKomunikasiV3Client';

export const dynamic = 'force-dynamic';

export default async function HubKomunikasiV3Page() {
  const sessions = await getChatV3Sessions();
  return <HubKomunikasiV3Client initialSessions={sessions} />;
}
