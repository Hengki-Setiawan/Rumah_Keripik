import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatMessages } from '@/lib/schema';
import { generateIdChatMessage } from '@/lib/id-generator';
import { ChatComponentSchema } from './schemas';
import type { ChatComponent, ChatMessageDto, ChatRole } from './types';

export function serializeComponents(components?: ChatComponent[]) {
  if (!components || components.length === 0) return null;
  const safe = components.map((component) => ChatComponentSchema.parse(component));
  return JSON.stringify(safe);
}

export function parseComponents(value: string | null): ChatComponent[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((component) => ChatComponentSchema.parse(component));
  } catch {
    return [];
  }
}

function parseMetadata(value: string | null): Record<string, unknown> | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export async function createChatMessage(input: {
  chatSessionId: string;
  role: ChatRole;
  content: string;
  components?: ChatComponent[];
  metadata?: Record<string, unknown>;
  tokenEstimate?: number;
}) {
  const id = generateIdChatMessage();
  await db.insert(chatMessages).values({
    id,
    chatSessionId: input.chatSessionId,
    role: input.role,
    content: input.content,
    componentJson: serializeComponents(input.components),
    metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    tokenEstimate: input.tokenEstimate,
  });
  const [created] = await db.select().from(chatMessages).where(eq(chatMessages.id, id)).limit(1);
  if (!created) throw new Error('Gagal membuat chat message');
  return toMessageDto(created);
}

export async function getChatMessages(chatSessionId: string, limit = 80) {
  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.chatSessionId, chatSessionId))
    .orderBy(asc(chatMessages.createdAt))
    .limit(limit);
  return rows.map(toMessageDto);
}

export function toMessageDto(row: typeof chatMessages.$inferSelect): ChatMessageDto {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    components: parseComponents(row.componentJson),
    metadata: parseMetadata(row.metadataJson),
    createdAt: row.createdAt,
  };
}
