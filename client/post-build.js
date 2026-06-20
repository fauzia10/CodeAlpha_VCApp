#!/usr/bin/env node
/**
 * post-build.js — Runs after `npx expo export --platform web`
 * 
 * Fixes Expo Metro's behaviour of:
 *  1) Auto-injecting <link rel="icon" href="/favicon.ico" /> into dist/index.html
 *  2) Not copying our versioned favicon PNG/ICO to dist/
 */

const fs = require('fs');
const path = require('path');

const distDir   = path.join(__dirname, 'dist');
const assetsDir = path.join(__dirname, 'assets');
const publicDir = path.join(__dirname, 'public');
const indexPath = path.join(distDir, 'index.html');

const V = 5; // favicon version - bump this every time you change the favicon

const filesToCopy = [
  `syncora-favicon-v${V}.png`,
  `syncora-favicon-v${V}.ico`,
  'apple-touch-icon.png',
];

console.log(`\n=== Syncora Post-Build Favicon Fix (v${V}) ===\n`);

filesToCopy.forEach((file) => {
  const src  = fs.existsSync(path.join(assetsDir, file))
    ? path.join(assetsDir, file)
    : path.join(publicDir, file);
  const dest = path.join(distDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`[COPY] ${file} -> dist/${file}`);
  } else {
    console.warn(`[WARN] Source not found: ${file}`);
  }
});

if (!fs.existsSync(indexPath)) {
  console.error('[ERROR] dist/index.html not found. Run expo export first.');
  process.exit(1);
}

let html = fs.readFileSync(indexPath, 'utf8');

// Remove ALL old favicon.ico injections by Expo
html = html.replace(/<link rel="icon" href="\/favicon\.ico" \/>/g, '');
html = html.replace(/<link rel="icon" href="\/syncora-favicon-v[0-9]+\.png\?v=[0-9]+" \/>/g, '');

// Ensure the correct v5 favicon link is in <head> right after <title>
const v5Links = `
    <!-- Syncora Favicon v${V} - versioned to bust CDN cache -->
    <link rel="icon" type="image/png" href="/syncora-favicon-v${V}.png?v=${V}" />
    <link rel="shortcut icon" href="/syncora-favicon-v${V}.ico?v=${V}" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=${V}" />
    <meta name="application-name" content="Syncora" />
    <meta name="theme-color" content="#FCE7EF" />`;

if (!html.includes(`syncora-favicon-v${V}.png?v=${V}`)) {
  html = html.replace('</title>', `</title>${v5Links}`);
  console.log(`[INJECT] v${V} favicon links injected after <title>`);
} else {
  console.log(`[OK] v${V} favicon links already present in dist/index.html`);
}

fs.writeFileSync(indexPath, html, 'utf8');
console.log('\n[DONE] dist/index.html patched.\n');
console.log(`Favicon URLs on Render:`);
console.log(`  https://codealpha-vcapp-8eh5.onrender.com/syncora-favicon-v${V}.png`);
console.log(`  https://codealpha-vcapp-8eh5.onrender.com/syncora-favicon-v${V}.ico\n`);
