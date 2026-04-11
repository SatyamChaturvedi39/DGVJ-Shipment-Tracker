/**
 * generate-icon.js
 * Generates app icons for Digvijay BLR using @napi-rs/canvas.
 *
 * Run: node scripts/generate-icon.js
 * Requires: npm install --save-dev @napi-rs/canvas
 *
 * Outputs:
 *   assets/icon.png          1024×1024  — main iOS icon + Android legacy
 *   assets/adaptive-icon.png 1024×1024  — Android adaptive foreground (transparent bg)
 *   assets/splash-icon.png    512×512   — splash screen mark
 */

const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'assets');

// ── Design tokens ─────────────────────────────────────────────────────────────
const BRAND_RED    = '#C62828';
const WHITE        = '#FFFFFF';
const RED_DARK     = '#8E0000';   // used for subtle inner shadow / depth on D

// ── Helper: draw rounded-square background ────────────────────────────────────
function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Draw the "D" lettermark ───────────────────────────────────────────────────
// Draws a heavy white "D" centred on (cx, cy), sized ~55% of canvas.
function drawD(ctx, cx, cy, size) {
  // We'll draw the D as a filled path for maximum crispness.
  // Stem: vertical rectangle on the left.
  // Bow:  large arc on the right.
  const stemW  = size * 0.18;   // width of vertical stem
  const height = size * 0.70;   // total height of the letterform
  const top    = cy - height / 2;
  const bottom = cy + height / 2;
  const left   = cx - size * 0.28;
  const right  = left + stemW;

  // Outer radius of the bow — full width of the D
  const bowRight  = cx + size * 0.30;
  const bowRadius = (bottom - top) / 2;

  ctx.beginPath();
  // Start at top-left of stem
  ctx.moveTo(left, top);
  // Top of stem
  ctx.lineTo(bowRight - bowRadius * 0.15, top);
  // Top-right corner rounding
  ctx.quadraticCurveTo(bowRight + stemW, top, bowRight + stemW, top + bowRadius * 0.3);
  // Right arc (outer)
  ctx.arc(left + stemW / 2 + (bowRight - left - stemW / 2), cy, bowRadius, -Math.PI * 0.85, Math.PI * 0.85);
  // Bottom-right corner rounding
  ctx.quadraticCurveTo(bowRight + stemW, bottom, bowRight - bowRadius * 0.15, bottom);
  // Bottom of stem
  ctx.lineTo(left, bottom);
  ctx.closePath();
  ctx.fillStyle = WHITE;
  ctx.fill();

  // Cutout — inner "hole" of the D
  const innerLeft  = right;
  const innerTop   = top + height * 0.14;
  const innerBot   = bottom - height * 0.14;
  const innerH     = innerBot - innerTop;
  const innerBowR  = innerH / 2;
  const innerRight = bowRight + stemW * 0.5;

  ctx.beginPath();
  ctx.moveTo(innerLeft, innerTop);
  ctx.lineTo(innerRight - innerBowR * 0.2, innerTop);
  ctx.arc(innerLeft + (innerRight - innerLeft - innerBowR * 0.2), cy, innerBowR, -Math.PI * 0.80, Math.PI * 0.80);
  ctx.lineTo(innerLeft, innerBot);
  ctx.closePath();
  ctx.fillStyle = BRAND_RED;
  ctx.fill();
}

// ── Draw BLR text ─────────────────────────────────────────────────────────────
function drawBLR(ctx, cx, yCenter, fontSize) {
  ctx.font      = `800 ${fontSize}px sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '6px';
  ctx.fillText('BLR', cx, yCenter);
}

// ── Generate one canvas ───────────────────────────────────────────────────────
function generate(size, withBackground, withBLR) {
  const canvas = createCanvas(size, size);
  const ctx    = canvas.getContext('2d');

  if (withBackground) {
    // Solid red fill (iOS auto-clips to rounded square; Android uses adaptive)
    ctx.fillStyle = BRAND_RED;
    ctx.fillRect(0, 0, size, size);
  } else {
    // Transparent for adaptive foreground
    ctx.clearRect(0, 0, size, size);
  }

  const cx = size / 2;
  const dSize = size * 0.56;

  if (withBLR) {
    // Move D up slightly to make room for BLR text below
    drawD(ctx, cx, cx - size * 0.06, dSize);
    drawBLR(ctx, cx, cx + size * 0.32, Math.max(size * 0.075, 18));
  } else {
    drawD(ctx, cx, cx, dSize);
  }

  return canvas.toBuffer('image/png');
}

// ── Write files ───────────────────────────────────────────────────────────────
const files = [
  { name: 'icon.png',          size: 1024, bg: true,  blr: true  },
  { name: 'adaptive-icon.png', size: 1024, bg: false, blr: true  },
  { name: 'splash-icon.png',   size: 512,  bg: true,  blr: false },
];

files.forEach(({ name, size, bg, blr }) => {
  const buf  = generate(size, bg, blr);
  const dest = path.join(ASSETS, name);
  fs.writeFileSync(dest, buf);
  console.log(`✓ ${dest}  (${size}×${size})`);
});

console.log('\nDone! Restart Expo with: npx expo start --clear');
