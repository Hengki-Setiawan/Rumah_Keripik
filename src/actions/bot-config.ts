'use server';

import { db } from '@/lib/db';
import { botAutoReply, chatLog } from '@/lib/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const RuleSchema = z.object({
  keyword: z.string().min(1, 'Keyword wajib diisi'),
  response: z.string().min(1, 'Response wajib diisi'),
});

export async function getAutoReplyRules() {
  try {
    return await db
      .select()
      .from(botAutoReply)
      .orderBy(desc(botAutoReply.created_at));
  } catch (error) {
    console.error('Error fetch rules:', error);
    return [];
  }
}

export async function addAutoReplyRule(data: z.infer<typeof RuleSchema>) {
  try {
    const validated = RuleSchema.parse(data);
    await db.insert(botAutoReply).values({
      keyword: validated.keyword.toLowerCase().trim(),
      response: validated.response.trim(),
    });
    revalidatePath('/bot-config');
    return { success: true };
  } catch (error) {
    return { success: false, message: 'Gagal menambah rule' };
  }
}

export async function updateAutoReplyRule(id: number, data: { keyword?: string; response?: string; is_active?: number }) {
  try {
    await db
      .update(botAutoReply)
      .set({
        ...(data.keyword !== undefined && { keyword: data.keyword.toLowerCase().trim() }),
        ...(data.response !== undefined && { response: data.response.trim() }),
        ...(data.is_active !== undefined && { is_active: data.is_active }),
      })
      .where(eq(botAutoReply.id, id));
    revalidatePath('/bot-config');
    return { success: true };
  } catch (error) {
    return { success: false, message: 'Gagal update rule' };
  }
}

export async function deleteAutoReplyRule(id: number) {
  try {
    await db
      .delete(botAutoReply)
      .where(eq(botAutoReply.id, id));
    revalidatePath('/bot-config');
    return { success: true };
  } catch (error) {
    return { success: false, message: 'Gagal hapus rule' };
  }
}

export async function getChatLogs(limit = 50) {
  try {
    return await db
      .select()
      .from(chatLog)
      .orderBy(desc(chatLog.timestamp))
      .limit(limit);
  } catch (error) {
    console.error('Error fetch chat logs:', error);
    return [];
  }
}

export async function getChatStats() {
  try {
    const [total] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        rules: sql<number>`SUM(CASE WHEN ${chatLog.sumber} = 'rule' THEN 1 ELSE 0 END)`,
        groq: sql<number>`SUM(CASE WHEN ${chatLog.sumber} = 'groq' THEN 1 ELSE 0 END)`,
        notFound: sql<number>`SUM(CASE WHEN ${chatLog.sumber} = 'not_found' THEN 1 ELSE 0 END)`,
        total_tokens: sql<number>`COALESCE(SUM(${chatLog.tokens_used}), 0)`,
      })
      .from(chatLog);
    return total;
  } catch (error) {
    return { total: 0, rules: 0, groq: 0, notFound: 0, total_tokens: 0 };
  }
}
