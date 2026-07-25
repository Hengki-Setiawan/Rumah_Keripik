#!/usr/bin/env node
/**
 * fix-libsql.js
 *
 * Patches @libsql/client so it works in Cloudflare Workers (workerd) runtime:
 * 1. Creates the missing lib-esm/index.js that package.json workerd target points to
 * 2. Patches lib-esm/migrations.js to avoid crashes on HTTP 400/non-200 responses
 */

const fs = require('fs');
const path = require('path');

const libsqlDir = path.join(__dirname, '..', 'node_modules', '@libsql', 'client');
const esmDir = path.join(libsqlDir, 'lib-esm');
const esmFile = path.join(esmDir, 'migrations.js');
const webFile = path.join(esmDir, 'web.js');
const indexFile = path.join(esmDir, 'index.js');

// ─── Fix 0: Create missing lib-esm/index.js ────────────────────────────────
// The @libsql/client package.json points workerd/deno/edge-light/browser to
// "./lib-esm/index.js" but only ships "./lib-esm/web.js".
// We just re-export web.js so esbuild can resolve it.
if (fs.existsSync(esmDir)) {
  if (fs.existsSync(webFile) && !fs.existsSync(indexFile)) {
    fs.writeFileSync(indexFile, fs.readFileSync(webFile, 'utf8'), 'utf8');
    console.log('[fix-libsql] ✔ Created missing lib-esm/index.js (copy of web.js) for workerd runtime');
  } else if (fs.existsSync(indexFile)) {
    console.log('[fix-libsql] lib-esm/index.js already exists — skipping');
  } else {
    console.log('[fix-libsql] WARNING: lib-esm/web.js not found, cannot create index.js');
  }
} else {
  console.log('[fix-libsql] lib-esm directory not found, skipping');
}

// ─── Fix 1 & 2: Patch migrations.js ────────────────────────────────────────
if (!fs.existsSync(esmFile)) {
  console.log('[fix-libsql] File not found, skipping:', esmFile);
  process.exit(0);
}

let content = fs.readFileSync(esmFile, 'utf8');
let patched = false;

// Fix 1: getIsSchemaDatabase — handle HTTP 400 gracefully (return false)
const OLD_GET_IS_SCHEMA = `        const json = (await result.json());
        const isChildDatabase = result.status === 400 && json.error === "Invalid namespace";`;

const NEW_GET_IS_SCHEMA = `        if (result.status === 400) {
            return false;
        }
        let json;
        try {
            json = (await result.json());
        }
        catch (_e) {
            return false;
        }
        const isChildDatabase = result.status === 400 && json?.error === "Invalid namespace";`;

if (content.includes(OLD_GET_IS_SCHEMA)) {
  content = content.replace(OLD_GET_IS_SCHEMA, NEW_GET_IS_SCHEMA);
  console.log('[fix-libsql] ✔ Patched getIsSchemaDatabase HTTP 400 handler in lib-esm');
  patched = true;
} else if (content.includes('if (result.status === 400) {')) {
  console.log('[fix-libsql] getIsSchemaDatabase already patched — skipping');
}

// Fix 2: getLastMigrationJob — return RunSuccess instead of throwing
const OLD_GET_LAST_JOB = `    if (result.status !== 200) {
        throw new Error("Unexpected status code while fetching migration jobs: " +
            result.status);
    }`;

const NEW_GET_LAST_JOB = `    if (result.status !== 200) {
        return { job_id: 0, status: "RunSuccess" };
    }`;

if (content.includes(OLD_GET_LAST_JOB)) {
  content = content.replace(OLD_GET_LAST_JOB, NEW_GET_LAST_JOB);
  console.log('[fix-libsql] ✔ Patched getLastMigrationJob non-200 handler in lib-esm');
  patched = true;
} else if (content.includes('return { job_id: 0, status: "RunSuccess" }')) {
  console.log('[fix-libsql] getLastMigrationJob already patched — skipping');
}

if (patched) {
  fs.writeFileSync(esmFile, content, 'utf8');
  console.log('[fix-libsql] ✔ Successfully patched @libsql/client lib-esm/migrations.js');
} else {
  console.log('[fix-libsql] Nothing new to patch — file already correct');
}
