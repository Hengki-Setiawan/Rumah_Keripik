import { db } from '@/lib/db'
import { botSetting } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'

const KEY_VAULT_KEY = 'api.key.vault'

type KeyEntry = {
  provider: string
  key: string
  rotatedAt: string
  version: number
}

async function loadVault(): Promise<KeyEntry[]> {
  const [row] = await db.select().from(botSetting).where(eq(botSetting.key, KEY_VAULT_KEY)).limit(1)
  if (!row?.value_json) return []
  try { return JSON.parse(row.value_json) as KeyEntry[] } catch { return [] }
}

async function saveVault(entries: KeyEntry[]) {
  await db.insert(botSetting).values({ key: KEY_VAULT_KEY, value_json: JSON.stringify(entries) }).onConflictDoUpdate({ target: botSetting.key, set: { value_json: JSON.stringify(entries) } })
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16)
  const key = crypto.createHash('sha256').update(process.env.KEY_ENCRYPTION_SECRET || 'rk_default_secret_rotate').digest()
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export async function rotateProviderKey(provider: string, newKey: string) {
  const vault = await loadVault()
  const maxVersion = vault.filter((e) => e.provider === provider).reduce((max, e) => Math.max(max, e.version), 0)
  vault.push({ provider, key: encrypt(newKey), rotatedAt: new Date().toISOString(), version: maxVersion + 1 })
  await saveVault(vault)

  const envKey = provider === 'gemini' ? 'GEMINI_API_KEY' : provider === 'groq' ? 'GROQ_API_KEY' : provider === 'cerebras' ? 'CEREBRAS_API_KEY' : null
  if (envKey) {
    process.env[envKey] = newKey
  }
  return { provider, version: maxVersion + 1, rotatedAt: new Date().toISOString() }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length < 2) {
    console.log('Usage: tsx src/scripts/rotate-api-keys.ts <provider> <newKey>')
    console.log('Providers: gemini, groq, cerebras')
    process.exit(1)
  }
  const result = await rotateProviderKey(args[0], args[1])
  console.log(`Rotated ${result.provider} key to version ${result.version} at ${result.rotatedAt}`)
}

if (require.main === module) main()