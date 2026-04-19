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
const fs   = require('fs');
const path = require('path');

const ASSETS    = path.join(__dirname, '..', 'assets');
const BRAND_RED = '#C62828';
const WHITE     = '#FFFFFF';

// ── Draw the icon ─────────────────────────────────────────────────────────────
// Strategy: use canvas text rendering for the "D" lettermark — fonts always
// look sharper than hand-coded bezier curves at every icon size.
//
// withBackground = true  → red fill behind the D  (icon.png, splash-icon.png)
// withBackground = false → transparent bg          (adaptive-icon.png)
function generate(size, withBackground) {
  const canvas = createCanvas(size, size);
  const ctx    = canvas.getContext('2d');
  const cx     = size / 2;
  const cy     = size / 2;

  // ── Background ───────────────────────────────────────────────────────────
  if (withBackground) {
    ctx.fillStyle = BRAND_RED;
    ctx.fillRect(0, 0, size, size);
  } else {
    ctx.clearRect(0, 0, size, size);
  }

  // ── "D" lettermark via text rendering ───────────────────────────────────
  // Try bold fonts in order; @napi-rs/canvas uses system fonts on the host OS.
  // Arial Black / Impact are always present on Windows & macOS.
  const fontSize = Math.round(size * 0.58);

  // Draw with a few candidate font faces — the first one available will be used.
  // We intentionally overdraw the same position; last successful render wins.
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = WHITE;

  // Primary: Arial Black (Windows/macOS, very heavy)
  ctx.font = `${fontSize}px "Arial Black"`;
  let m = ctx.measureText('D');
  // Fallback: if glyph is suspiciously narrow, try Impact
  if (m.width < size * 0.3) {
    ctx.font = `${fontSize}px Impact`;
  }
  // Last resort: generic bold serif
  ctx.font = `900 ${fontSize}px Arial, Impact, sans-serif`;

  // Vertical adjustment: most fonts sit slightly above true centre at baseline=middle
  ctx.fillText('D', cx, cy + size * 0.025);

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
