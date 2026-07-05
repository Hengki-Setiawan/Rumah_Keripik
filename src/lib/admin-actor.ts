import { auth } from '@/lib/auth';

export async function getAdminActor() {
  const session = await auth().catch(() => null);
  return session?.user?.name || session?.user?.email || 'admin';
}

export async function requireAdminActor() {
  const session = await auth().catch(() => null);
  const actor = session?.user?.name || session?.user?.email;
  if (!actor) throw new Error('UNAUTHORIZED_ADMIN');
  return actor;
}

export function isUnauthorizedAdminError(error: unknown) {
  return error instanceof Error && error.message === 'UNAUTHORIZED_ADMIN';
}
