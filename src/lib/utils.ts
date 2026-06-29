import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRupiah(n: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

export function normalizePhoneNumber(phone: string): string {
  return phone
    .replace(/[+\s\-()]/g, '')
    .replace(/^0+/, '62')
    .replace(/^62+/, '62')
}

export function detectChannel(id: string): 'wa' | 'telegram' {
  return id.startsWith('tg_') ? 'telegram' : 'wa'
}

export function formatTelegramChatId(chatId: number | string): string {
  return `tg_${String(chatId)}`
}

export function parseTelegramChatId(externalId: string): string {
  return externalId.replace(/^tg_/, '')
}
