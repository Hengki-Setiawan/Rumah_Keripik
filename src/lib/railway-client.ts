"use server";

import { getOrCreateMemory } from './memory-engine';

const RAILWAY_AI_URL = process.env.RAILWAY_AI_URL || 'http://localhost:8000';
const RAILWAY_API_KEY = process.env.RAILWAY_API_KEY || '';

async function callRailway(path: string, body: unknown) {
  try {
    const res = await fetch(`${RAILWAY_AI_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(RAILWAY_API_KEY ? { 'x-api-key': RAILWAY_API_KEY } : {}),
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getPersonalizedGreeting(no_wa: string) {
  const memory = await getOrCreateMemory(no_wa);
  const result = await callRailway('/api/personalize', {
    no_wa,
    memory: {
      produk_favorit: memory.produk_favorit,
      total_order: memory.total_order,
      avg_order_value: memory.avg_order_value,
    },
  });
  return result?.greeting || null;
}

export async function learnFromConversation(
  userMessage: string,
  botResponse: string,
  rating?: number,
  no_wa?: string,
) {
  const result = await callRailway('/api/learn', {
    user_message: userMessage,
    bot_response: botResponse,
    rating,
    no_wa,
  });
  return result;
}
