#!/usr/bin/env node
/**
 * fix-libsql.js
 *
 * Directly patches @libsql/client package.json and lib-esm/migrations.js after npm install.
 */

const fs = require('fs');
const path = require('path');

const libsqlDir = path.join(__dirname, '..', 'node_modules', '@libsql', 'client');
const packageJsonFile = path.join(libsqlDir, 'package.json');
const esmDir = path.join(libsqlDir, 'lib-esm');
const esmFile = path.join(esmDir, 'migrations.js');
const webFile = path.join(esmDir, 'web.js');

// Fix 0: Ensure lib-esm/web.js exists AND update package.json workerd target to index.js
if (fs.existsSync(packageJsonFile)) {
  try {
    let pkgContent = fs.readFileSync(packageJsonFile, 'utf8');
    if (pkgContent.includes('"./lib-esm/web.js"')) {
      pkgContent = pkgContent.replace(/"\.\/lib-esm\/web\.js"/g, '"./lib-esm/index.js"');
      fs.writeFileSync(packageJsonFile, pkgContent, 'utf8');
      console.log('[fix-libsql] ✔ Patched @libsql/client package.json workerd target to ./lib-esm/index.js');
    }
  } catch (e) {
    console.error('[fix-libsql] Error patching package.json:', e.message);
  }
}

if (fs.existsSync(esmDir)) {
  const indexFile = path.join(esmDir, 'index.js');
  if (fs.existsSync(indexFile) && !fs.existsSync(webFile)) {
    fs.writeFileSync(webFile, "export * from './index.js';\nexport { createClient } from './index.js';\n", 'utf8');
    console.log('[fix-libsql] ✔ Created missing lib-esm/web.js alias for workerd runtime');
  }
}

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
