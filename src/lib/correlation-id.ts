const CORRELATION_HEADER = 'x-request-id';

export function getOrCreateCorrelationId(request?: Request): string {
  if (request) {
    const existing = request.headers.get(CORRELATION_HEADER);
    if (existing) return existing;
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function addCorrelationHeaders(response: Response, correlationId: string): Response {
  response.headers.set(CORRELATION_HEADER, correlationId);
  return response;
}

export function createApiResponse(data: unknown, status = 200, correlationId?: string): Response {
  const body = JSON.stringify(data);
  const response = new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
  if (correlationId) {
    response.headers.set(CORRELATION_HEADER, correlationId);
  }
  return response;
}