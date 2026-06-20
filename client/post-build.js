#!/usr/bin/env node
/**
 * post-build.js
 * 
 * Runs after `npx expo export --platform web --output-dir dist`
 * 
 * Fixes that Expo Metro injects its own favicon.ico link into dist/index.html
 * and does NOT copy our versioned favicon PNG.
 * 
 * This script:
 * 1. Copies syncora-favicon-v3.png and apple-touch-icon.png to dist/
 * 2. Strips Expo's auto-injected favicon.ico link from dist/index.html
 * 3. Confirms the correct versioned link is present
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
const assetsDir = path.join(__dirname, 'assets');
const indexPath = path.join(distDir, 'index.html');

// 1. Copy versioned favicon assets to dist root
const filesToCopy = [
  'syncora-favicon-v3.png',
  'apple-touch-icon.png',
  'favicon-32x32.png',
  'favicon-16x16.png',
];

console.log('\n=== Syncora Post-Build Favicon Fix ===\n');

filesToCopy.forEach((file) => {
  const src = path.join(assetsDir, file);
  const dest = path.join(distDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`[COPY] ${file} -> dist/${file}`);
  } else {
    console.warn(`[WARN] Source not found: ${src}`);
  }
});

// 2. Patch dist/index.html
if (!fs.existsSync(indexPath)) {
  console.error('[ERROR] dist/index.html not found. Run expo export first.');
  process.exit(1);
}

let html = fs.readFileSync(indexPath, 'utf8');

// Remove Expo's injected favicon.ico link (it appears right before </head>)
const expoFaviconPattern = /<link rel="icon" href="\/favicon\.ico" \/>/g;
const countBefore = (html.match(expoFaviconPattern) || []).length;
html = html.replace(expoFaviconPattern, '');
console.log(`\n[PATCH] Removed ${countBefore} Expo-injected favicon.ico link(s)`);

// Verify our versioned link is present
if (html.includes('syncora-favicon-v3.png?v=3')) {
  console.log('[OK] Versioned favicon link confirmed: /syncora-favicon-v3.png?v=3');
} else {
  // Inject it right after the <title> if missing
  html = html.replace(
    '</title>',
    `</title>\n    <link rel="icon" type="image/png" href="/syncora-favicon-v3.png?v=3" />\n    <link rel="shortcut icon" type="image/png" href="/syncora-favicon-v3.png?v=3" />`
  );
  console.log('[INJECT] Versioned favicon link was missing - injected after <title>');
}

fs.writeFileSync(indexPath, html, 'utf8');
console.log('\n[DONE] dist/index.html patched successfully.');
console.log('\nFavicon URL on Render: https://codealpha-vcapp-8eh5.onrender.com/syncora-favicon-v3.png\n');
