import { config } from 'dotenv';

config({ path: '.env.local' });

type SmokeResult = { name: string; status?: number; ok: boolean; detail?: string };

async function main() {
  const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
  const cookieJar: string[] = [];
  const results: SmokeResult[] = [];

  function cookieHeader() {
    return cookieJar.join('; ');
  }

  function captureCookies(res: Response) {
    const raw = getSetCookieHeaders(res);
    for (const value of raw) {
      const cookie = value.split(';')[0];
      if (cookie && !cookieJar.some((item) => item.split('=')[0] === cookie.split('=')[0])) cookieJar.push(cookie);
    }
  }

  const sessionRes = await fetch(`${baseUrl}/api/customer/session`, { method: 'POST', redirect: 'manual' });
  captureCookies(sessionRes);
  const sessionData = await sessionRes.json().catch(() => null);
  const chatSessionId = sessionData?.chatSession?.id;
  results.push({ name: 'customer session creates chat session', status: sessionRes.status, ok: sessionRes.status === 200 && Boolean(chatSessionId) && cookieJar.some((item) => item.startsWith('rk_customer_session=')), detail: chatSessionId });

  const stateRes = await fetch(`${baseUrl}/api/chat/state?chatSessionId=${encodeURIComponent(chatSessionId || '')}`, { headers: { Cookie: cookieHeader() }, redirect: 'manual' });
  const stateData = await stateRes.json().catch(() => null);
  results.push({ name: 'owned chat state allowed', status: stateRes.status, ok: stateRes.status === 200 && stateData?.ok === true && Array.isArray(stateData.messages) });

  const sendRes = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader() },
    body: JSON.stringify({ chatSessionId, message: 'Smoke test chat v3: rekomendasi produk tidak terlalu pedas untuk keluarga' }),
    redirect: 'manual',
  });
  const sendData = await sendRes.json().catch(() => null);
  results.push({ name: 'owned chat send allowed', status: sendRes.status, ok: sendRes.status === 200 && sendData?.ok === true && Array.isArray(sendData.messages), detail: sendData?.response?.intent });

  const sessionsRes = await fetch(`${baseUrl}/api/chat/sessions`, { headers: { Cookie: cookieHeader() }, redirect: 'manual' });
  const sessionsData = await sessionsRes.json().catch(() => null);
  results.push({ name: 'owned session list includes chat', status: sessionsRes.status, ok: sessionsRes.status === 200 && sessionsData?.sessions?.some((item: { id: string }) => item.id === chatSessionId) });

  const manualEditRes = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader() },
    body: JSON.stringify({ chatSessionId, message: 'Saya mau ubah alamat pengiriman' }),
    redirect: 'manual',
  });
  const manualEditData = await manualEditRes.json().catch(() => null);
  results.push({
    name: 'manual typed address edit understood',
    status: manualEditRes.status,
    ok: manualEditRes.status === 200 && manualEditData?.response?.intent === 'request_location',
    detail: manualEditData?.response?.intent,
  });

  const helpRes = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader() },
    body: JSON.stringify({ chatSessionId, message: 'Saya butuh bantuan admin' }),
    redirect: 'manual',
  });
  const helpData = await helpRes.json().catch(() => null);
  results.push({
    name: 'manual typed admin handoff understood',
    status: helpRes.status,
    ok: helpRes.status === 200 && helpData?.response?.intent === 'handoff_to_admin',
    detail: helpData?.response?.intent,
  });

  const newSessionRes = await fetch(`${baseUrl}/api/customer/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader() },
    body: JSON.stringify({ forceNew: true }),
    redirect: 'manual',
  });
  captureCookies(newSessionRes);
  const newSessionData = await newSessionRes.json().catch(() => null);
  const newChatSessionId = newSessionData?.chatSession?.id;
  results.push({
    name: 'force new chat session creates different session',
    status: newSessionRes.status,
    ok: newSessionRes.status === 200 && Boolean(newChatSessionId) && newChatSessionId !== chatSessionId,
    detail: newChatSessionId,
  });

  const deleteSingleRes = await fetch(`${baseUrl}/api/chat/sessions/${encodeURIComponent(newChatSessionId || '')}`, {
    method: 'DELETE',
    headers: { Cookie: cookieHeader() },
    redirect: 'manual',
  });
  const deleteSingleData = await deleteSingleRes.json().catch(() => null);
  results.push({
    name: 'single chat history delete works',
    status: deleteSingleRes.status,
    ok: deleteSingleRes.status === 200 && deleteSingleData?.ok === true,
  });

  const clearAllRes = await fetch(`${baseUrl}/api/chat/sessions`, {
    method: 'DELETE',
    headers: { Cookie: cookieHeader() },
    redirect: 'manual',
  });
  const clearAllData = await clearAllRes.json().catch(() => null);
  results.push({
    name: 'clear all chat history works',
    status: clearAllRes.status,
    ok: clearAllRes.status === 200 && clearAllData?.ok === true,
    detail: String(clearAllData?.deleted ?? ''),
  });

  const sessionsAfterDeleteRes = await fetch(`${baseUrl}/api/chat/sessions`, { headers: { Cookie: cookieHeader() }, redirect: 'manual' });
  const sessionsAfterDeleteData = await sessionsAfterDeleteRes.json().catch(() => null);
  results.push({
    name: 'chat history empty after clear all',
    status: sessionsAfterDeleteRes.status,
    ok: sessionsAfterDeleteRes.status === 200 && Array.isArray(sessionsAfterDeleteData?.sessions) && sessionsAfterDeleteData.sessions.length === 0,
    detail: String(sessionsAfterDeleteData?.sessions?.length ?? ''),
  });

  const forbiddenStateRes = await fetch(`${baseUrl}/api/chat/state?chatSessionId=${encodeURIComponent(chatSessionId || '')}`, { redirect: 'manual' });
  results.push({ name: 'chat state without cookie denied', status: forbiddenStateRes.status, ok: [302, 307, 401, 403].includes(forbiddenStateRes.status) });

  const streamRes = await fetch(`${baseUrl}/api/chat/stream?chatSessionId=${encodeURIComponent(chatSessionId || '')}`, { headers: { Cookie: cookieHeader() }, redirect: 'manual' });
  const contentType = streamRes.headers.get('content-type') || '';
  results.push({ name: 'owned chat stream opens', status: streamRes.status, ok: streamRes.status === 200 && contentType.includes('text/event-stream'), detail: contentType });
  await streamRes.body?.cancel().catch(() => undefined);

  const failed = results.filter((result) => !result.ok);
  console.log(JSON.stringify({ ok: failed.length === 0, baseUrl, results }, null, 2));
  if (failed.length) process.exit(1);
}

function getSetCookieHeaders(res: Response) {
  const headers = res.headers as Headers & { getSetCookie?: () => string[]; raw?: () => Record<string, string[]> };
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  if (typeof headers.raw === 'function') return headers.raw()['set-cookie'] || [];
  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
