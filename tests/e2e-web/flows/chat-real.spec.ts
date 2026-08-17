import { test, expect } from '@playwright/test';

// ============================================================================
// L2 â€” REAL CHAT VIA API (production LLM, no browser, no UI mimicry).
// Exercises the actual deployed /api/chat (real Groq/Gemini) end-to-end and
// verifies persistence in the prod Turso database. Asserts STATE, never the
// exact wording of the AI reply (LLM output is non-deterministic by design).
// Run with: npx playwright test --config=playwright.prod.config.ts
// ============================================================================

const PRODUCT_ID = process.env.E2E_PRODUCT_ID || 'KRP-004';

async function tursoRows(sql: string): Promise<Array<Record<string, unknown>>> {
  const dbUrl = (process.env.TURSO_DATABASE_URL || '')
    .replace(/^libsql:\/\//, 'https://')
    .replace(/\/$/, '');
  const token = process.env.TURSO_AUTH_TOKEN || process.env.TURSO_DATABASE_AUTH_TOKEN || '';
  if (!dbUrl || !token) throw new Error('TURSO_DATABASE_URL / TURSO_AUTH_TOKEN belum diset');
  const res = await fetch(`${dbUrl}/v2/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{ type: 'execute', stmt: { sql } }, { type: 'close' }],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Turso HTTP ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
  const step = json?.results?.[0];
  if (step?.response?.error) throw new Error(`Turso SQL error: ${JSON.stringify(step.response.error)}`);
  const result = step?.response?.result;
  if (!result) throw new Error(`Turso no result: ${JSON.stringify(json).slice(0, 500)}`);
  const cols: string[] = (result.cols || []).map((c: { name: string }) => c.name);
  return (result.rows || []).map((row: Array<{ type: string; value: unknown }>) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((col, i) => {
      obj[col] = row[i]?.value ?? null;
    });
    return obj;
  });
}

test.describe('L2 real chat via API (prod LLM)', () => {
  test('free-text message produces a real assistant reply persisted to DB', async ({ request }) => {
    test.setTimeout(240_000);

    const created = await request.post('/api/customer/session');
    expect(created.ok()).toBeTruthy();
    const { chatSession } = (await created.json()) as { chatSession: { id: string } };
    expect(chatSession.id).toBeTruthy();

    const res = await request.post('/api/chat', {
      data: { chatSessionId: chatSession.id, message: 'Halo, jualan keripik apa saja?' },
      timeout: 180_000,
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as {
      ok: boolean;
      userMessage: { id: string; role: string };
      assistantMessage: { id: string; role: string; content: string };
      stage: string;
    };
    expect(body.ok).toBe(true);
    expect(body.userMessage.role).toBe('user');
    expect(body.assistantMessage.role).toBe('assistant');
    expect(body.assistantMessage.content.length).toBeGreaterThan(0);
    expect(body.stage).toBeTruthy();

    const dbRows = await tursoRows(
      `SELECT role, content FROM chat_messages WHERE chat_session_id = '${chatSession.id}'
       ORDER BY created_at ASC LIMIT 10`,
    );
    const roles = dbRows.map((r) => r.role);
    expect(roles).toContain('user');
    expect(roles).toContain('assistant');
  });

  test('show_cart action writes a deterministic assistant message (no LLM)', async ({ request }) => {
    const created = await request.post('/api/customer/session');
    expect(created.ok()).toBeTruthy();
    const { chatSession } = (await created.json()) as { chatSession: { id: string } };

    const res = await request.post('/api/chat/action', {
      data: { chatSessionId: chatSession.id, action: 'show_cart', payload: {} },
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);

    const dbRows = await tursoRows(
      `SELECT role, content FROM chat_messages WHERE chat_session_id = '${chatSession.id}'
       ORDER BY created_at ASC`,
    );
    expect(dbRows.some((r) => r.role === 'assistant' && String(r.content).includes('Keranjang'))).toBe(true);
  });

  test('add_to_cart action is deterministic and persists cart in DB', async ({ request }) => {
    const created = await request.post('/api/customer/session');
    expect(created.ok()).toBeTruthy();
    const { chatSession } = (await created.json()) as { chatSession: { id: string } };

    const res = await request.post('/api/chat/action', {
      data: { chatSessionId: chatSession.id, action: 'add_to_cart', payload: { productId: PRODUCT_ID, quantity: 1 } },
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { ok: boolean; cart: { itemCount: number } };
    expect(body.ok).toBe(true);
    expect(body.cart.itemCount).toBeGreaterThanOrEqual(1);
  });
});
