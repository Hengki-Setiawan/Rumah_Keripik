#!/usr/bin/env node
/**
 * fix-libsql.js
 * 
 * Directly patches @libsql/client/lib-esm/migrations.js after npm install.
 * patch-package only fixes lib-cjs but Vercel uses ESM at runtime.
 * 
 * Root cause: Turso returns HTTP 400 from /v1/jobs on non-schema databases.
 * The unpatched ESM code throws "Unexpected status code while fetching migration jobs: 400"
 * which causes all db queries to silently fail and return empty arrays.
 */

const fs = require('fs');
const path = require('path');

const esmFile = path.join(__dirname, '..', 'node_modules', '@libsql', 'client', 'lib-esm', 'migrations.js');

if (!fs.existsSync(esmFile)) {
  console.log('[fix-libsql] File not found, skipping:', esmFile);
  process.exit(0);
}

let content = fs.readFileSync(esmFile, 'utf8');

// Fix 1: getIsSchemaDatabase - handle HTTP 400 gracefully (return false, not throw)
const oldGetIsSchema = `        if (result.status === 404 || result.status === 500) {
            return false;
        }
        const json = (await result.json());
        const isChildDatabase = result.status === 400 && json.error === "Invalid namespace";`;

const newGetIsSchema = `        if (result.status === 404 || result.status === 500) {
            return false;
        }
        if (result.status === 400) {
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

// Fix 2: getLastMigrationJob - return RunSuccess instead of throwing on non-200
const oldGetLastJob = `    if (result.status !== 200) {
        throw new Error("Unexpected status code while fetching migration jobs: " +
            result.status);
    }`;

const newGetLastJob = `    if (result.status !== 200) {
        return { job_id: 0, status: "RunSuccess" };
    }`;

let patched = false;

if (content.includes(oldGetIsSchema)) {
  content = content.replace(oldGetIsSchema, newGetIsSchema);
  console.log('[fix-libsql] ✔ Fixed getIsSchemaDatabase HTTP 400 handling in lib-esm');
  patched = true;
} else {
  console.log('[fix-libsql] getIsSchemaDatabase already patched or format changed');
}

if (content.includes(oldGetLastJob)) {
  content = content.replace(oldGetLastJob, newGetLastJob);
  console.log('[fix-libsql] ✔ Fixed getLastMigrationJob non-200 status in lib-esm');
  patched = true;
} else {
  console.log('[fix-libsql] getLastMigrationJob already patched or format changed');
}

if (patched) {
  fs.writeFileSync(esmFile, content, 'utf8');
  console.log('[fix-libsql] ✔ Successfully patched @libsql/client lib-esm/migrations.js');
} else {
  console.log('[fix-libsql] Nothing to patch, file may already be correct');
}
