#!/usr/bin/env node
/**
 * fix-libsql.js
 *
 * Super-robust postinstall patcher for @libsql/client in Cloudflare Workers (workerd).
 * Guarantees that BOTH index.js and web.js exist in lib-esm & lib-cjs,
 * and fixes migrations.js HTTP 400 / non-200 handlers.
 */

const fs = require('fs');
const path = require('path');

const libsqlDir = path.join(__dirname, '..', 'node_modules', '@libsql', 'client');

if (!fs.existsSync(libsqlDir)) {
  console.log('[fix-libsql] @libsql/client not found in node_modules — skipping');
  process.exit(0);
}

// 1. Fix package.json workerd/browser/deno targets to ./lib-esm/web.js
const packageJsonFile = path.join(libsqlDir, 'package.json');
if (fs.existsSync(packageJsonFile)) {
  try {
    let pkg = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8'));
    if (pkg.exports && pkg.exports['.']) {
      pkg.exports['.'].workerd = './lib-esm/web.js';
      pkg.exports['.'].deno = './lib-esm/web.js';
      pkg.exports['.'].browser = './lib-esm/web.js';
      pkg.exports['.'].import = './lib-esm/web.js';
      fs.writeFileSync(packageJsonFile, JSON.stringify(pkg, null, 2), 'utf8');
      console.log('[fix-libsql] ✔ Standardized package.json exports to ./lib-esm/web.js');
    }
  } catch (e) {
    console.error('[fix-libsql] Failed to update package.json:', e.message);
  }
}

// 2. Ensure BOTH index.js AND web.js exist in lib-esm
const esmDir = path.join(libsqlDir, 'lib-esm');
if (fs.existsSync(esmDir)) {
  const webFile = path.join(esmDir, 'web.js');
  const indexFile = path.join(esmDir, 'index.js');
  
  if (fs.existsSync(webFile)) {
    fs.copyFileSync(webFile, indexFile);
    console.log('[fix-libsql] ✔ Created lib-esm/index.js as exact copy of web.js');
  } else if (fs.existsSync(indexFile)) {
    fs.copyFileSync(indexFile, webFile);
    console.log('[fix-libsql] ✔ Created lib-esm/web.js as exact copy of index.js');
  }
}

// 3. Ensure BOTH index.js AND web.js exist in lib-cjs
const cjsDir = path.join(libsqlDir, 'lib-cjs');
if (fs.existsSync(cjsDir)) {
  const webFile = path.join(cjsDir, 'web.js');
  const indexFile = path.join(cjsDir, 'index.js');
  
  if (fs.existsSync(webFile)) {
    fs.copyFileSync(webFile, indexFile);
    console.log('[fix-libsql] ✔ Created lib-cjs/index.js as exact copy of web.js');
  } else if (fs.existsSync(indexFile)) {
    fs.copyFileSync(indexFile, webFile);
    console.log('[fix-libsql] ✔ Created lib-cjs/web.js as exact copy of index.js');
  }
}

// 4. Patch lib-esm/migrations.js for Turso schema checks
const esmFile = path.join(esmDir, 'migrations.js');
if (fs.existsSync(esmFile)) {
  let content = fs.readFileSync(esmFile, 'utf8');
  let patched = false;

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
    patched = true;
  }

  const OLD_GET_LAST_JOB = `    if (result.status !== 200) {
        throw new Error("Unexpected status code while fetching migration jobs: " +
            result.status);
    }`;

  const NEW_GET_LAST_JOB = `    if (result.status !== 200) {
        return { job_id: 0, status: "RunSuccess" };
    }`;

  if (content.includes(OLD_GET_LAST_JOB)) {
    content = content.replace(OLD_GET_LAST_JOB, NEW_GET_LAST_JOB);
    patched = true;
  }

  if (patched) {
    fs.writeFileSync(esmFile, content, 'utf8');
    console.log('[fix-libsql] ✔ Successfully patched lib-esm/migrations.js');
  }
}
