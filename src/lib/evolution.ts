/**
 * Evolution API Helper (DEACTIVATED)
 * WhatsApp integration has been disabled. This helper returns stub/inactive
 * responses to prevent network requests and errors.
 */

export interface EvolutionIncomingMessage {
  from: string;
  message_id: string;
  text: string;
  timestamp: string;
  name: string;
  fromMe: boolean;
}

export async function sendTextMessage(number: string, text: string): Promise<any> {
  console.log(`[Evolution - WhatsApp Disabled] Attempted to send to ${number}: ${text}`);
  return { success: false, error: 'WhatsApp integration has been deactivated.' };
}

export async function sendButtonMessage(
  number: string,
  text: string,
  buttons: { displayText: string; id: string }[]
): Promise<any> {
  return { success: false, error: 'WhatsApp integration has been deactivated.' };
}

export async function sendListMessage(
  number: string,
  title: string,
  sections: { title: string; rows: { title: string; description?: string; rowId: string }[] }[]
): Promise<any> {
  return { success: false, error: 'WhatsApp integration has been deactivated.' };
}

export async function getInboundMessageHistory(
  no_wa: string,
  limit: number = 50
): Promise<any[]> {
  return [];
}

export async function checkInstanceStatus(): Promise<boolean> {
  return false;
}

export async function restartInstance(): Promise<any> {
  return { success: false, error: 'WhatsApp integration has been deactivated.' };
}

export async function logoutInstance(): Promise<any> {
  return { success: false, error: 'WhatsApp integration has been deactivated.' };
}

export async function getQRCode(): Promise<string | null> {
  return null;
}
