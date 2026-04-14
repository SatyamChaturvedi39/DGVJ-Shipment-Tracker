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

const BRAND_RED = '#C62828';
const WHITE     = '#FFFFFF';

// ── Draw a single icon ────────────────────────────────────────────────────────
function generate(size, withBackground) {
  const canvas = createCanvas(size, size);
  const ctx    = canvas.getContext('2d');
  const cx     = size / 2;
  const cy     = size / 2;

  if (withBackground) {
    ctx.fillStyle = BRAND_RED;
    ctx.fillRect(0, 0, size, size);
  } else {
    ctx.clearRect(0, 0, size, size);
  }

  // ── "D" lettermark — drawn as a custom path for crispness ──────────────────
  // Strategy: large rounded D using bezier curves.
  // The D is ~68% of canvas height, horizontally centred with slight left offset.

  const letterH = size * 0.68;          // total letter height
  const stemW   = size * 0.13;          // stem (vertical bar) width
  const letterTop    = cy - letterH / 2;
  const letterBottom = cy + letterH / 2;
  const stemLeft     = cx - size * 0.22;
  const stemRight    = stemLeft + stemW;

  // Outer bounding right edge of the bow
  const bowRight = cx + size * 0.22;
  const bowCx    = stemRight + (bowRight - stemRight) / 2 + size * 0.03;
  const bowRY    = letterH / 2;        // vertical radius
  const bowRX    = bowRight - bowCx;   // horizontal radius

  // Corner rounding for stem top/bottom
  const cornerR = size * 0.04;

  ctx.beginPath();
  // Top-left corner
  ctx.moveTo(stemLeft + cornerR, letterTop);
  // Top edge → top-right of bow
  ctx.lineTo(bowCx - size * 0.10, letterTop);
  // Top-right arc of bow
  ctx.bezierCurveTo(
    bowRight, letterTop,
    bowRight + size * 0.10, cy - bowRY * 0.1,
    bowRight + size * 0.10, cy
  );
  // Bottom-right arc of bow
  ctx.bezierCurveTo(
    bowRight + size * 0.10, cy + bowRY * 0.1,
    bowRight, letterBottom,
    bowCx - size * 0.10, letterBottom
  );
  // Bottom edge back to stem
  ctx.lineTo(stemLeft + cornerR, letterBottom);
  // Bottom-left corner
  ctx.arcTo(stemLeft, letterBottom, stemLeft, letterBottom - cornerR, cornerR);
  ctx.lineTo(stemLeft, letterTop + cornerR);
  // Top-left corner
  ctx.arcTo(stemLeft, letterTop, stemLeft + cornerR, letterTop, cornerR);
  ctx.closePath();
  ctx.fillStyle = WHITE;
  ctx.fill();

  // Inner cutout (counter of the D)
  const innerPad   = size * 0.055;
  const innerTop   = letterTop + innerPad;
  const innerBot   = letterBottom - innerPad;
  const innerLeft  = stemRight + innerPad * 0.5;
  const innerCx    = bowCx + size * 0.015;
  const innerRY    = (innerBot - innerTop) / 2;
  const innerBowR  = bowRight - innerPad * 0.5;

  ctx.beginPath();
  ctx.moveTo(innerLeft, innerTop);
  ctx.lineTo(innerCx - size * 0.06, innerTop);
  ctx.bezierCurveTo(
    innerBowR, innerTop,
    innerBowR + size * 0.06, innerTop + innerRY * 0.1,
    innerBowR + size * 0.06, innerTop + innerRY
  );
  ctx.bezierCurveTo(
    innerBowR + size * 0.06, innerBot - innerRY * 0.1,
    innerBowR, innerBot,
    innerCx - size * 0.06, innerBot
  );
  ctx.lineTo(innerLeft, innerBot);
  ctx.closePath();
  ctx.fillStyle = withBackground ? BRAND_RED : 'rgba(0,0,0,0)';
  ctx.fill();

  return canvas.toBuffer('image/png');
}

// ── Write files ───────────────────────────────────────────────────────────────
const files = [
  { name: 'icon.png',          size: 1024, bg: true  },
  { name: 'adaptive-icon.png', size: 1024, bg: false },
  { name: 'splash-icon.png',   size: 512,  bg: true  },
];

files.forEach(({ name, size, bg }) => {
  const buf  = generate(size, bg);
  const dest = path.join(ASSETS, name);
  fs.writeFileSync(dest, buf);
  console.log(`✓ ${dest}  (${size}×${size})`);
});

console.log('\nDone! Run: npx expo start --clear');
