import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { botSetting } from '@/lib/schema';

export type AgentLoopConfig = {
  enabled: boolean;
  rolloutPercentage: number;
  maxIterations: number;
  enableSemanticCache: boolean;
};

export const defaultAgentLoopConfig: AgentLoopConfig = {
  enabled: true,
  rolloutPercentage: 5,
  maxIterations: 4,
  enableSemanticCache: false,
};

export async function getAgentLoopConfig(): Promise<AgentLoopConfig> {
  try {
    const [row] = await db
      .select()
      .from(botSetting)
      .where(eq(botSetting.key, 'ai.agentLoop.config'))
      .limit(1);

    if (row?.value_json) {
      const parsed = JSON.parse(row.value_json) as Partial<AgentLoopConfig>;
      return { ...defaultAgentLoopConfig, ...parsed };
    }
  } catch {}
  return defaultAgentLoopConfig;
}

export function shouldUseAgentLoop(config: AgentLoopConfig, sessionId: string): boolean {
  if (!config.enabled) return false;

  const hash = sessionId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const percentage = (hash % 100) + 1;

  return percentage <= config.rolloutPercentage;
}
