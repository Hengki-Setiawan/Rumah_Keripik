import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env.local');
if (!fs.existsSync(envPath)) {
  console.error("❌ .env.local not found at", envPath);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n');

const envMap = {};
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  if (key && val) {
    envMap[key] = val;
  }
}

const token = process.env.CLOUDFLARE_API_TOKEN || envMap.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || envMap.CLOUDFLARE_ACCOUNT_ID;
const scriptName = "rumah-keripik";

// Exclude build/local tokens
const EXCLUDE_KEYS = new Set([
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
  'VERCEL_TOKEN',
  'GITHUB_PAT_TOKEN',
  'NETLIFY_AUTH_TOKEN',
  'CRONJOB_API_KEY'
]);

async function putSecret(key, value) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}/secrets`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: key,
      text: value,
      type: 'secret_text'
    })
  });
  const data = await res.json();
  return data;
}

async function main() {
  console.log(`🚀 Syncing secrets for Worker: ${scriptName} (Account: ${accountId})...\n`);

  const keys = Object.keys(envMap).filter(k => !EXCLUDE_KEYS.has(k));
  let successCount = 0;
  let failCount = 0;

  for (const key of keys) {
    const val = envMap[key];
    try {
      const res = await putSecret(key, val);
      if (res.success) {
        console.log(`✅ [OK] ${key}`);
        successCount++;
      } else {
        console.error(`❌ [FAIL] ${key}:`, res.errors?.map(e => e.message).join(', ') || JSON.stringify(res));
        failCount++;
      }
    } catch (err) {
      console.error(`❌ [ERR] ${key}:`, err.message);
      failCount++;
    }
  }

  console.log(`\n🎉 Finished sync: ${successCount} succeeded, ${failCount} failed.`);
}

main().catch(console.error);
