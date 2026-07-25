#!/usr/bin/env node
/**
 * fix-deps.js
 *
 * Fixes broken ESM .mjs resolution in npm dependencies (y18n, @node-minify/*)
 * that cause OpenNext / Node ESM resolution failures in Node 22/24+.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'node_modules');

// 1. Fix y18n
const y18nDir = path.join(root, 'y18n');
if (fs.existsSync(y18nDir)) {
  const mjs = path.join(y18nDir, 'index.mjs');
  const cjs = path.join(y18nDir, 'build', 'index.cjs');
  if (fs.existsSync(cjs)) {
    fs.writeFileSync(mjs, "import y18n from './build/index.cjs';\nexport default y18n;\n", 'utf8');
    console.log('[fix-deps] ✔ Created y18n/index.mjs wrapper');
  }
}

// 2. Fix @node-minify/* packages
const nmDir = path.join(root, '@node-minify');
if (fs.existsSync(nmDir)) {
  const pkgs = fs.readdirSync(nmDir);
  for (const pkg of pkgs) {
    const dist = path.join(nmDir, pkg, 'dist');
    if (fs.existsSync(dist)) {
      const jsFile = path.join(dist, 'index.js');
      const mjsFile = path.join(dist, 'index.mjs');
      if (fs.existsSync(jsFile)) {
        fs.writeFileSync(
          mjsFile,
          "import pkg from './index.js';\nexport default pkg;\nexport * from './index.js';\n",
          'utf8'
        );
        console.log(`[fix-deps] ✔ Created @node-minify/${pkg}/dist/index.mjs ESM wrapper`);
      }
    }
  }
}
