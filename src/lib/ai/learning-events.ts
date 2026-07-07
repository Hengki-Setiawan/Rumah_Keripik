import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { aiLearningEvents, recommendationEvents } from '@/lib/schema';
import { generateIdAiLearningEvent, generateIdRecommendationEvent } from '@/lib/id-generator';

type RecommendationEventType = 'shown' | 'clicked' | 'added_to_cart' | 'ordered';

export async function logRecommendationEvent(input: {
  eventType: RecommendationEventType;
  chatSessionId?: string | null;
  customerId?: string | null;
  productIds?: string[];
  selectedProductId?: string | null;
  reason?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await db.insert(recommendationEvents).values({
      id: generateIdRecommendationEvent(),
      chatSessionId: input.chatSessionId || null,
      customerId: input.customerId || null,
      eventType: input.eventType,
      productIdsJson: JSON.stringify((input.productIds || []).slice(0, 20)),
      selectedProductId: input.selectedProductId || null,
      reason: input.reason?.slice(0, 240),
      metadataJson: input.metadata ? JSON.stringify(input.metadata).slice(0, 2000) : null,
    });
  } catch {
    // Learning telemetry must never break the ordering flow.
  }
}

export async function logAiLearningEvent(input: {
  eventType: string;
  chatSessionId?: string | null;
  customerId?: string | null;
  intent?: string | null;
  productIds?: string[];
  outcome?: string | null;
  rating?: number | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await db.insert(aiLearningEvents).values({
      id: generateIdAiLearningEvent(),
      eventType: input.eventType.slice(0, 80),
      chatSessionId: input.chatSessionId || null,
      customerIdHash: input.customerId ? hashId(input.customerId) : null,
      intent: input.intent?.slice(0, 80) || null,
      productIdsJson: JSON.stringify((input.productIds || []).slice(0, 20)),
      outcome: input.outcome?.slice(0, 120) || null,
      rating: input.rating == null ? null : Math.max(1, Math.min(5, input.rating)),
      metadataJson: input.metadata ? JSON.stringify(input.metadata).slice(0, 2000) : null,
    });
  } catch {
    // Learning telemetry must never break chat.
  }
}

function hashId(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
