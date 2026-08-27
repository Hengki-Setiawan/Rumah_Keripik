import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const envPath = path.resolve(rootDir, '.env.local');
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
const projectName = "rumah-keripik";

const EXCLUDE_KEYS = new Set([
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
  'VERCEL_TOKEN',
  'GITHUB_PAT_TOKEN',
  'NETLIFY_AUTH_TOKEN',
  'CRONJOB_API_KEY'
]);

function copyDirRecursive(src, dst) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

async function ensurePagesProject() {
  console.log(`🔍 Checking Cloudflare Pages project: ${projectName}...`);
  const getUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}`;
  const resGet = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const dataGet = await resGet.json();

  const envVars = {};
  for (const [k, v] of Object.entries(envMap)) {
    if (!EXCLUDE_KEYS.has(k)) {
      envVars[k] = { value: v, type: "secret_text" };
    }
  }

  if (dataGet.success) {
    console.log(`✅ Project ${projectName} exists. Updating environment variables...`);
    const patchUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}`;
    const resPatch = await fetch(patchUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        deployment_configs: {
          production: {
            env_vars: envVars,
            compatibility_date: "2024-12-30",
            compatibility_flags: ["nodejs_compat"]
          },
          preview: {
            env_vars: envVars,
            compatibility_date: "2024-12-30",
            compatibility_flags: ["nodejs_compat"]
          }
        }
      })
    });
    const patchData = await resPatch.json();
    if (patchData.success) {
      console.log(`✅ Environment variables updated for ${projectName}`);
    } else {
      console.warn(`⚠️ Warning on updating env:`, JSON.stringify(patchData.errors));
    }
  } else {
    console.log(`✨ Creating Cloudflare Pages project: ${projectName}...`);
    const createUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`;
    const resCreate = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: projectName,
        production_branch: "master",
        deployment_configs: {
          production: {
            env_vars: envVars,
            compatibility_date: "2024-12-30",
            compatibility_flags: ["nodejs_compat"]
          },
          preview: {
            env_vars: envVars,
            compatibility_date: "2024-12-30",
            compatibility_flags: ["nodejs_compat"]
          }
        }
      })
    });
    const createData = await resCreate.json();
    if (createData.success) {
      console.log(`✅ Created Pages project ${projectName}`);
    } else {
      console.error(`❌ Failed to create project:`, JSON.stringify(createData.errors));
    }
  }
}

async function prepareAssets() {
  const openNextDir = path.resolve(rootDir, '.open-next');
  const workerSrc = path.join(openNextDir, 'worker.js');
  const assetsDir = path.join(openNextDir, 'assets');
  const workerDst = path.join(assetsDir, '_worker.js');
  const routesJsonDst = path.join(assetsDir, '_routes.json');

  if (!fs.existsSync(workerSrc)) {
    console.error(`❌ worker.js not found at ${workerSrc}. Please run opennext build first.`);
    process.exit(1);
  }

  console.log(`📦 Copying ${workerSrc} -> ${workerDst}`);
  fs.copyFileSync(workerSrc, workerDst);

  const dirsToCopy = ['cloudflare', 'middleware', '.build', 'server-functions', 'dynamodb-provider', 'cloudflare-templates'];
  for (const d of dirsToCopy) {
    const srcDir = path.join(openNextDir, d);
    const dstDir = path.join(assetsDir, d);
    if (fs.existsSync(srcDir)) {
      console.log(`📁 Copying directory ${d} -> assets/${d}...`);
      copyDirRecursive(srcDir, dstDir);
    }
  }

  const routesConfig = {
    version: 1,
    include: ["/*"],
    exclude: [
      "/_next/static/*",
      "/brand/*",
      "/favicon.ico",
      "/icon.png",
      "/manifest.json",
      "/sw.js",
      "/window.svg",
      "/next.svg",
      "/vercel.svg",
      "/file.svg",
      "/globe.svg"
    ]
  };
  fs.writeFileSync(routesJsonDst, JSON.stringify(routesConfig, null, 2));
  console.log(`✅ Created _routes.json for Pages`);
}

async function main() {
  await ensurePagesProject();
  await prepareAssets();
  console.log(`\n🎉 Pages assets and worker dependencies ready for deployment!`);
}

main().catch(console.error);
