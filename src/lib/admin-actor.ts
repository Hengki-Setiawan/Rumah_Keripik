import { auth } from '@/lib/auth';

export async function getAdminActor() {
  const session = await auth().catch(() => null);
  return session?.user?.name || session?.user?.email || 'admin';
}
