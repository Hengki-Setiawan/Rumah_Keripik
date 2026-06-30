#!/usr/bin/env node
/**
 * fix-libsql.js
 *
 * Directly patches @libsql/client/lib-esm/migrations.js after npm install.
 * patch-package only fixes lib-cjs but Vercel uses ESM at runtime.
 *
 * Root cause: Turso returns HTTP 400 from /v1/jobs on non-schema databases.
 * The unpatched ESM code throws "Unexpected status code while fetching migration jobs: 400"
 * which causes all db queries to silently fail and return empty arrays on Vercel.
 */

const fs = require('fs');
const path = require('path');

const esmFile = path.join(__dirname, '..', 'node_modules', '@libsql', 'client', 'lib-esm', 'migrations.js');

if (!fs.existsSync(esmFile)) {
  console.log('[fix-libsql] File not found, skipping:', esmFile);
  process.exit(0);
}

let content = fs.readFileSync(esmFile, 'utf8');
let patched = false;

// -----------------------------------------------------------------------
// Fix 1: getIsSchemaDatabase — handle HTTP 400 gracefully (return false)
// Original npm code (single line after 404/500 check):
//   const json = (await result.json());
//   const isChildDatabase = result.status === 400 && json.error === "Invalid namespace";
// -----------------------------------------------------------------------
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
} else {
  console.log('[fix-libsql] WARNING: getIsSchemaDatabase pattern not matched — check lib version');
}

// -----------------------------------------------------------------------
// Fix 2: getLastMigrationJob — return RunSuccess instead of throwing
// Original npm code:
//   if (result.status !== 200) {
//       throw new Error("Unexpected status code while fetching migration jobs: " +
//           result.status);
//   }
// -----------------------------------------------------------------------
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
} else {
  console.log('[fix-libsql] WARNING: getLastMigrationJob pattern not matched — check lib version');
}

if (patched) {
  fs.writeFileSync(esmFile, content, 'utf8');
  console.log('[fix-libsql] ✔ Successfully patched @libsql/client lib-esm/migrations.js');
} else {
  console.log('[fix-libsql] Nothing new to patch — file already correct');
}
