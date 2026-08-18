import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export function adminAuthErrorResponse(error: unknown) {
  if (error instanceof Error && (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION')) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
  }
  return null;
}

export async function requireAdminRoleOrResponse(permission: AdminPermission): Promise<NextResponse | null> {
  try {
    await requireAdminRole(permission);
    return null;
  } catch (error) {
    const response = adminAuthErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

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

export type AdminPermission = 'chat:manage' | 'payment:verify' | 'order:update' | 'audit:read' | 'ledger:view' | 'ledger:write' | 'courier:manage' | 'product:manage' | 'sos:view' | 'sos:respond' | 'customer:view' | 'customer:edit';

export async function requireAdminRole(permission: AdminPermission) {
  const actor = await requireAdminActor();
  const roleMap = parseRoleMap(process.env.ADMIN_ROLE_MAP);
  const role = roleMap[actor] || roleMap['*'] || 'owner';
  const allowed = role === 'owner' || rolePermissions[role]?.includes(permission);
  if (!allowed) throw new Error('FORBIDDEN_ADMIN_PERMISSION');
  return { actor, role };
}

export function isUnauthorizedAdminError(error: unknown) {
  return error instanceof Error && error.message === 'UNAUTHORIZED_ADMIN';
}

export function isForbiddenAdminPermissionError(error: unknown) {
  return error instanceof Error && error.message === 'FORBIDDEN_ADMIN_PERMISSION';
}

const rolePermissions: Record<string, AdminPermission[]> = {
  operator: ['chat:manage', 'order:update'],
  finance: ['payment:verify', 'audit:read', 'ledger:view', 'ledger:write'],
  courier_admin: ['courier:manage', 'order:update', 'sos:view', 'sos:respond'],
  product_admin: ['product:manage', 'customer:view'],
  customer_support: ['customer:view', 'customer:edit', 'sos:view', 'chat:manage'],
  owner: ['chat:manage', 'payment:verify', 'order:update', 'audit:read', 'ledger:view', 'ledger:write', 'courier:manage', 'product:manage', 'sos:view', 'sos:respond', 'customer:view', 'customer:edit'],
  viewer: ['audit:read', 'ledger:view', 'sos:view'],
};

function parseRoleMap(value?: string) {
  if (!value) return {} as Record<string, string>;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
  } catch {
    return {} as Record<string, string>;
  }
}
