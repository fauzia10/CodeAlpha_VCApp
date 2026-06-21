#!/usr/bin/env node
/**
 * make-ico.js — Creates a minimal valid .ico file from a PNG by wrapping
 * the PNG data directly (modern ICO format that supports PNG entries).
 * Works in Node.js without any native dependencies.
 */

const fs = require('fs');
const path = require('path');

const [,, srcPng, destIco] = process.argv;

if (!srcPng || !destIco) {
  console.error('Usage: node make-ico.js <src.png> <dest.ico>');
  process.exit(1);
}

const pngData = fs.readFileSync(srcPng);
const pngSize = pngData.length;

// ICO format: ICONDIR header (6 bytes) + ICONDIRENTRY (16 bytes) + PNG data
// ICONDIR: reserved(2) + type(2)=1 + count(2)=1
const iconDir = Buffer.alloc(6);
iconDir.writeUInt16LE(0, 0);   // Reserved, must be 0
iconDir.writeUInt16LE(1, 2);   // Type: 1 = ICO
iconDir.writeUInt16LE(1, 4);   // Count: 1 image

// ICONDIRENTRY: width(1)+height(1)+colorCount(1)+reserved(1)+planes(2)+bitCount(2)+bytesInRes(4)+imageOffset(4)
const iconDirEntry = Buffer.alloc(16);
iconDirEntry.writeUInt8(0, 0);         // Width: 0 = 256px
iconDirEntry.writeUInt8(0, 1);         // Height: 0 = 256px
iconDirEntry.writeUInt8(0, 2);         // Color count: 0 = no palette
iconDirEntry.writeUInt8(0, 3);         // Reserved
iconDirEntry.writeUInt16LE(1, 4);      // Planes
iconDirEntry.writeUInt16LE(32, 6);     // Bit count: 32-bit RGBA
iconDirEntry.writeUInt32LE(pngSize, 8);// Bytes in resource
iconDirEntry.writeUInt32LE(22, 12);    // Image data offset (6 + 16 = 22)

const icoBuffer = Buffer.concat([iconDir, iconDirEntry, pngData]);
fs.writeFileSync(destIco, icoBuffer);

console.log(`[make-ico] Created ${destIco} (${icoBuffer.length} bytes, PNG entry: ${pngSize} bytes)`);
