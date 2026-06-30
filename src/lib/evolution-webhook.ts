export interface EvolutionIncomingMessage {
  from: string;
  message_id: string;
  text: string;
  timestamp: string;
  name: string;
  fromMe: boolean;
  isImage?: boolean;
  isLocation?: boolean;
  imageCaption?: string;
  locationData?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  messageRaw?: any;
}

function getRecordValue(record: unknown, path: string[]): unknown {
  let current: unknown = record;
  for (const key of path) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function firstDefined(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null);
}

function extractText(message: unknown): string {
  if (!message || typeof message !== 'object') return '';
  const record = message as Record<string, unknown>;

  const text = firstDefined(
    getRecordValue(record, ['conversation']),
    getRecordValue(record, ['text']),
    getRecordValue(record, ['extendedTextMessage', 'text']),
    getRecordValue(record, ['imageMessage', 'caption']),
    getRecordValue(record, ['videoMessage', 'caption']),
    getRecordValue(record, ['documentMessage', 'caption']),
    getRecordValue(record, ['buttonsResponseMessage', 'selectedButtonId']),
    getRecordValue(record, ['listResponseMessage', 'singleSelectReply', 'selectedRowId']),
    getRecordValue(record, ['templateButtonReplyMessage', 'selectedId'])
  );

  return typeof text === 'string' ? text : '';
}

function extractFrom(payload: Record<string, unknown>): string {
  const raw = firstDefined(
    payload.from,
    payload.remoteJid,
    getRecordValue(payload, ['key', 'remoteJid']),
    getRecordValue(payload, ['data', 'key', 'remoteJid']),
    getRecordValue(payload, ['sender']),
    getRecordValue(payload, ['data', 'sender']),
    getRecordValue(payload, ['participant'])
  );

  if (typeof raw !== 'string' || !raw) return '';

  return raw.replace(/@s\.whatsapp\.net$/i, '').replace(/:[0-9]+$/i, '');
}

function extractTimestamp(payload: Record<string, unknown>): string {
  const raw = firstDefined(
    payload.timestamp,
    payload.messageTimestamp,
    getRecordValue(payload, ['data', 'messageTimestamp']),
    getRecordValue(payload, ['key', 'messageTimestamp'])
  );

  if (typeof raw === 'number') {
    return new Date(raw * 1000).toISOString();
  }

  if (typeof raw === 'string' && raw.trim()) {
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) {
      return new Date(numeric * 1000).toISOString();
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

function extractName(payload: Record<string, unknown>): string {
  const raw = firstDefined(
    payload.pushName,
    payload.pushname,
    payload.name,
    getRecordValue(payload, ['data', 'pushName']),
    getRecordValue(payload, ['data', 'senderName']),
    getRecordValue(payload, ['data', 'contactName'])
  );

  return typeof raw === 'string' ? raw : '';
}

export function parseEvolutionWebhook(body: unknown): EvolutionIncomingMessage | null {
  try {
    const payload = body as Record<string, unknown> | undefined;
    if (!payload || typeof payload !== 'object') return null;

    const candidate =
      (payload.data as Record<string, unknown> | undefined) ??
      (payload.message as Record<string, unknown> | undefined) ??
      payload;

    const fromMe = Boolean(
      firstDefined(
        candidate.fromMe,
        getRecordValue(candidate, ['key', 'fromMe']),
        getRecordValue(candidate, ['data', 'key', 'fromMe'])
      )
    );

    const from = extractFrom(candidate) || extractFrom(payload);
    if (!from || fromMe) return null;

    const rawMsg = candidate.message || payload.message || candidate;
    const msgRecord = rawMsg as any;
    
    const isImage = !!(msgRecord?.imageMessage);
    const imageCaption = msgRecord?.imageMessage?.caption || '';

    const isLocation = !!(msgRecord?.locationMessage || msgRecord?.liveLocationMessage);
    let locationData: any = undefined;
    
    if (msgRecord?.locationMessage) {
      locationData = {
        latitude: Number(msgRecord.locationMessage.degreesLatitude),
        longitude: Number(msgRecord.locationMessage.degreesLongitude),
        name: msgRecord.locationMessage.name || undefined,
        address: msgRecord.locationMessage.address || undefined,
      };
    } else if (msgRecord?.liveLocationMessage) {
      locationData = {
        latitude: Number(msgRecord.liveLocationMessage.degreesLatitude),
        longitude: Number(msgRecord.liveLocationMessage.degreesLongitude),
      };
    }

    const text =
      extractText(msgRecord) ||
      extractText(candidate) ||
      extractText(payload.message) ||
      extractText(payload.body) ||
      (isImage ? '[image]' : '') ||
      (isLocation ? '[location]' : '');

    const messageId = String(
      firstDefined(
        candidate.id,
        getRecordValue(candidate, ['key', 'id']),
        getRecordValue(candidate, ['data', 'key', 'id']),
        getRecordValue(candidate, ['messageId']),
        getRecordValue(candidate, ['data', 'messageId'])
      ) ?? ''
    );

    return {
      from,
      message_id: messageId,
      text: text.trim(),
      timestamp: extractTimestamp(candidate),
      name: extractName(candidate),
      fromMe,
      isImage,
      isLocation,
      imageCaption,
      locationData,
      messageRaw: msgRecord,
    };
  } catch (error) {
    console.error('Error parsing Evolution webhook:', error);
    return null;
  }
}
