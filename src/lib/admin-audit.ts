import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { adminAuditLog } from '@/lib/schema';
import { generateIdAdminAuditLog } from '@/lib/id-generator';

type AuditInput = {
  actor: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
  req?: Request;
};

export async function logAdminAudit(input: AuditInput) {
  try {
    await db.insert(adminAuditLog).values({
      id: generateIdAdminAuditLog(),
      actor: input.actor,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId || null,
      ipHash: hashOptional(input.req?.headers.get('x-forwarded-for') || input.req?.headers.get('x-real-ip')),
      userAgentHash: hashOptional(input.req?.headers.get('user-agent')),
      metadataJson: input.metadata ? JSON.stringify(input.metadata).slice(0, 4000) : null,
    });
  } catch {
    // Audit logging must not break the operational action.
  }
}

function hashOptional(value: string | null | undefined) {
  if (!value) return null;
  return createHash('sha256').update(value).digest('hex');
}
