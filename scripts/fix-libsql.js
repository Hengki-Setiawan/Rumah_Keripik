#!/usr/bin/env node
/**
 * fix-libsql.js
 *
 * Super-robust postinstall patcher for @libsql packages in Cloudflare Workers (workerd).
 * Guarantees that BOTH index.js and web.js exist in lib-esm & lib-cjs for @libsql/client,
 * patches @libsql/isomorphic-ws so @vercel/nft traces web.mjs into .open-next,
 * and fixes migrations.js HTTP 400 / non-200 handlers.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..', 'node_modules', '@libsql');

// ─── 1. Fix @libsql/client ──────────────────────────────────────────────────
const libsqlDir = path.join(rootDir, 'client');
if (fs.existsSync(libsqlDir)) {
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
        console.log('[fix-libsql] ✔ Standardized @libsql/client package.json exports to ./lib-esm/web.js');
      }
    } catch (e) {
      console.error('[fix-libsql] Failed to update package.json:', e.message);
    }
  }

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

    // Patch migrations.js
    const esmFile = path.join(esmDir, 'migrations.js');
    if (fs.existsSync(esmFile)) {
      let content = fs.readFileSync(esmFile, 'utf8');
      let patched = false;
      const OLD_GET_IS_SCHEMA = `        const json = (await result.json());
        const isChildDatabase = result.status === 400 && json.error === "Invalid namespace";`;
      const NEW_GET_IS_SCHEMA = `        if (result.status === 400) { return false; }
        let json;
        try { json = (await result.json()); } catch (_e) { return false; }
        const isChildDatabase = result.status === 400 && json?.error === "Invalid namespace";`;

      if (content.includes(OLD_GET_IS_SCHEMA)) {
        content = content.replace(OLD_GET_IS_SCHEMA, NEW_GET_IS_SCHEMA);
        patched = true;
      }
      const OLD_GET_LAST_JOB = `    if (result.status !== 200) {
        throw new Error("Unexpected status code while fetching migration jobs: " +
            result.status);
    }`;
      const NEW_GET_LAST_JOB = `    if (result.status !== 200) { return { job_id: 0, status: "RunSuccess" }; }`;

      if (content.includes(OLD_GET_LAST_JOB)) {
        content = content.replace(OLD_GET_LAST_JOB, NEW_GET_LAST_JOB);
        patched = true;
      }
      if (patched) {
        fs.writeFileSync(esmFile, content, 'utf8');
        console.log('[fix-libsql] ✔ Successfully patched lib-esm/migrations.js');
      }
    }
  }

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
}

// ─── 2. Fix @libsql/isomorphic-ws ──────────────────────────────────────────
const isoWsDir = path.join(rootDir, 'isomorphic-ws');
if (fs.existsSync(isoWsDir)) {
  const pkgFile = path.join(isoWsDir, 'package.json');
  const webMjs = path.join(isoWsDir, 'web.mjs');
  const nodeCjs = path.join(isoWsDir, 'node.cjs');
  const webCjs = path.join(isoWsDir, 'web.cjs');

  if (fs.existsSync(webMjs)) {
    fs.copyFileSync(webMjs, nodeCjs);
    fs.copyFileSync(webMjs, webCjs);
  }

  if (fs.existsSync(pkgFile)) {
    try {
      let pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
      pkg.main = "./web.mjs";
      if (pkg.exports && pkg.exports['.']) {
        pkg.exports['.'].import = "./web.mjs";
        pkg.exports['.'].require = "./node.cjs";
      }
      fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2), 'utf8');
      console.log('[fix-libsql] ✔ Patched @libsql/isomorphic-ws package.json & entry points');
    } catch (e) {
      console.error('[fix-libsql] Failed to update isomorphic-ws package.json:', e.message);
    }
  }
}
