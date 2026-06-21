#!/usr/bin/env node
/**
 * post-build.js — Runs after `npx expo export --platform web`
 *
 * Fixes Expo Metro's behaviour of:
 *  1) Auto-injecting <link rel="icon" href="/favicon.ico" /> into dist/index.html
 *  2) Not copying our versioned favicon PNG/ICO/apple-touch-icon to dist/
 */

const fs = require('fs');
const path = require('path');

const distDir   = path.join(__dirname, 'dist');
const publicDir = path.join(__dirname, 'public');
const indexPath = path.join(distDir, 'index.html');

const V = 10; // favicon version — bump whenever you change the favicon

const filesToCopy = [
  `syncora-favicon-v${V}.png`,
  `syncora-favicon-v${V}.ico`,
  `apple-touch-icon-v${V}.png`,
];

console.log(`\n=== Syncora Post-Build Favicon Fix (v${V}) ===\n`);

filesToCopy.forEach((file) => {
  const src  = path.join(publicDir, file);
  const dest = path.join(distDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`[COPY] ${file} -> dist/${file}`);
    
    // Also explicitly overwrite dist/favicon.ico so browsers don't fallback to old cached expo icons
    if (file.endsWith('.ico')) {
      const rootFavicon = path.join(distDir, 'favicon.ico');
      fs.copyFileSync(src, rootFavicon);
      console.log(`[OVERWRITE] dist/favicon.ico overwritten with ${file}`);
    }
  } else {
    console.warn(`[WARN] Source not found in public/: ${file}`);
  }
});

if (!fs.existsSync(indexPath)) {
  console.error('[ERROR] dist/index.html not found. Run expo export first.');
  process.exit(1);
}

let html = fs.readFileSync(indexPath, 'utf8');

// Remove ALL old/Expo-injected favicon references
html = html.replace(/<link rel="icon" href="\/favicon\.ico" \/>/g, '');
html = html.replace(/<link[^>]*syncora-favicon-v[0-9]+[^>]*>/g, '');
html = html.replace(/<link[^>]*shortcut icon[^>]*syncora[^>]*>/g, '');
html = html.replace(/<link[^>]*apple-touch-icon[^>]*>/g, '');
html = html.replace(/<meta name="application-name"[^>]*>/g, '');
html = html.replace(/<meta name="theme-color"[^>]*>/g, '');

// Inject v8 favicon links right after </title>
const faviconLinks = `
    <!-- Syncora Favicon v${V} — S-swirl mark, pink gradient, transparent bg -->
    <link rel="icon" type="image/png" href="/syncora-favicon-v${V}.png?v=${V}" />
    <link rel="shortcut icon" href="/syncora-favicon-v${V}.ico?v=${V}" />
    <link rel="apple-touch-icon" href="/apple-touch-icon-v${V}.png?v=${V}" />
    <meta name="application-name" content="Syncora" />
    <meta name="theme-color" content="#FCE7EF" />`;

if (!html.includes(`syncora-favicon-v${V}.png?v=${V}`)) {
  html = html.replace('</title>', `</title>${faviconLinks}`);
  console.log(`[INJECT] v${V} favicon links injected after <title>`);
} else {
  console.log(`[OK] v${V} favicon links already present in dist/index.html`);
}

fs.writeFileSync(indexPath, html, 'utf8');
console.log('\n[DONE] dist/index.html patched.\n');
console.log(`Favicon URLs on Render:`);
console.log(`  https://codealpha-vcapp-8eh5.onrender.com/syncora-favicon-v${V}.png`);
console.log(`  https://codealpha-vcapp-8eh5.onrender.com/syncora-favicon-v${V}.ico`);
console.log(`  https://codealpha-vcapp-8eh5.onrender.com/apple-touch-icon-v${V}.png\n`);
