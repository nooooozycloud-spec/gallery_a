#!/usr/bin/env node
/**
 * Build a self-contained site-gallery.html with all data embedded.
 * Run: node build-embedded.js
 */

const fs = require('fs');
const path = require('path');

const GALLERY_DIR = __dirname;
const THUMBNAILS_DIR = path.join(GALLERY_DIR, 'thumbnails');

// Map: filename (e.g. slot-madokamagica.png) -> base64 data URI
function loadImageAsBase64(filename) {
  const filepath = path.join(THUMBNAILS_DIR, filename);
  if (!fs.existsSync(filepath)) return null;
  const buf = fs.readFileSync(filepath);
  const b64 = buf.toString('base64');
  const mime = b64.startsWith('/9j/') ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${b64}`;
}

// Load all custom thumbnail PNGs
const customThumbFiles = [
  'slot-madokamagica.png', 'danganronpa.png', 'catherine.png', 'canmake.png',
  'opera.png', 'milk.png', 'bcl.png', 'hal.png', 'lizlisa.png', 'felissimo.png',
  'clipartkorea.png', 'rdlp-35888.png', 'rdlp-18701.png', 'ninout.png',
  '9ye.png', 'tenshoku-retro.png', 'alleru.png', 'hugmug.png', 'studio-pricing.png',
  'liginc-626065.png', 'rakunori.png', 'naho.png', 'atlus.png'
];

const base64Map = {};
customThumbFiles.forEach(f => {
  const data = loadImageAsBase64(f);
  if (data) base64Map[f] = data;
});

// Load sites-output.js and extract folders
const sitesOutput = fs.readFileSync(path.join(GALLERY_DIR, 'sites-output.js'), 'utf8');
// Extract the folders array - it's assigned as "const folders = [...]"
const foldersMatch = sitesOutput.match(/const folders = (\[[\s\S]*\]);/);
if (!foldersMatch) throw new Error('Could not extract folders from sites-output.js');
const foldersJson = foldersMatch[1];

// Load tapple-data.js
const tapplePath = path.join(THUMBNAILS_DIR, 'tapple-data.js');
const tappleContent = fs.readFileSync(tapplePath, 'utf8');
const tappleMatch = tappleContent.match(/window\.TAPPLE_THUMB_DATA="([^"]+)"/);
if (!tappleMatch) throw new Error('Could not extract TAPPLE_THUMB_DATA');
const tappleData = tappleMatch[1];

// Build customThumbs object with base64 data URIs
const customThumbsEntries = [
  ['slot-madokamagica.com', 'slot-madokamagica.png'],
  ['www.danganronpa.com', 'danganronpa.png'],
  ['www.tapple.co.jp', 'TAPPLE_DATA'],
  ['fullbody.jp', 'catherine.png'],
  ['www.canmake.com', 'canmake.png'],
  ['canmake.com', 'canmake.png'],
  ['www.opera-net.jp', 'opera.png'],
  ['opera-net.jp', 'opera.png'],
  ['milk-web.net', 'milk.png'],
  ['www.bcl-brand.jp', 'bcl.png'],
  ['bcl-brand.jp', 'bcl.png'],
  ['www.hal.ac.jp', 'hal.png'],
  ['hal.ac.jp', 'hal.png'],
  ['www.lizlisa.com', 'lizlisa.png'],
  ['lizlisa.com', 'lizlisa.png'],
  ['www.felissimo.co.jp', 'felissimo.png'],
  ['felissimo.co.jp', 'felissimo.png'],
  ['www.clipartkorea.co.kr', 'clipartkorea.png'],
  ['clipartkorea.co.kr', 'clipartkorea.png'],
  ['https://rdlp.jp/archives/otherdesign/lp/35888', 'rdlp-35888.png'],
  ['https://rdlp.jp/archives/otherdesign/lp/18701', 'rdlp-18701.png'],
  ['www.ninout.ai', 'ninout.png'],
  ['ninout.ai', 'ninout.png'],
  ['9ye.jp', '9ye.png'],
  ['https://tenshoku-web.jp/retro-career/', 'tenshoku-retro.png'],
  ['alleru.com', 'alleru.png'],
  ['hugmug.jp', 'hugmug.png'],
  ['https://studio.design/ja/pricing', 'studio-pricing.png'],
  ['https://studio.design/ja/pricing#price_monthly', 'studio-pricing.png'],
  ['https://liginc.co.jp/626065', 'liginc-626065.png'],
  ['rakunori.idex.co.jp', 'rakunori.png'],
  ['naho.tv', 'naho.png'],
  ['www.atlus.co.jp', 'atlus.png'],
  ['atlus.co.jp', 'atlus.png'],
];

function escapeJs(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

const customThumbsJs = customThumbsEntries.map(([key, val]) => {
  const v = val === 'TAPPLE_DATA' ? "'TAPPLE_DATA'" : (base64Map[val] ? `'${escapeJs(base64Map[val])}'` : 'null');
  return `  '${escapeJs(key)}': ${v}`;
}).join(',\n');

// Read original gallery (index.html or site-gallery.html)
const htmlPath = fs.existsSync(path.join(GALLERY_DIR, 'site-gallery.html'))
  ? path.join(GALLERY_DIR, 'site-gallery.html')
  : path.join(GALLERY_DIR, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// Remove external script tags
html = html.replace(/<script src="thumbnails\/tapple-data\.js"><\/script>\n/, '');
html = html.replace(/<script src="sites-output\.js"><\/script>\n/, '');

// Replace the inline script section: add embedded data before the main script logic
// We need to inject: 1) folders, 2) TAPPLE_THUMB_DATA, 3) customThumbs with base64

// Build embedded data block
const embeddedBlock = `// === Embedded data (self-contained, no external files) ===
const folders = ${foldersJson};
window.TAPPLE_THUMB_DATA = "${escapeJs(tappleData)}";
const customThumbs = {
${customThumbsJs}
};
// === End embedded data ===`;

// Replace embedded block (handles both template and already-embedded HTML)
const embeddedBlockRegex = /\/\/ === Embedded data \(self-contained, no external files\) ===\s*\nconst folders = \[[\s\S]*?\];\s*\nwindow\.TAPPLE_THUMB_DATA = "[^"]*";\s*\nconst customThumbs = \{[\s\S]*?\n\};\s*\n\/\/ === End embedded data ===/;
if (embeddedBlockRegex.test(html)) {
  html = html.replace(embeddedBlockRegex, embeddedBlock);
} else {
  // Template form: <script>\n// folders は sites-output.js で定義
  const scriptStart = '<script>\n// folders は sites-output.js で定義';
  html = html.replace(scriptStart, `<script>\n${embeddedBlock}\n\n// folders は上記で埋め込み済み`);
}

// Remove the old customThumbs definition (if present in template)
const customThumbsBlock = /\/\/ カスタムサムネイル（URLに応じてローカル画像を使用）\s*\nconst customThumbs = \{[\s\S]*?\n\};\n/;
html = html.replace(customThumbsBlock, '');

const outPath = path.basename(htmlPath);
fs.writeFileSync(htmlPath, html, 'utf8');
console.log('Built', outPath, '(self-contained, no external files)');
console.log('Thumbnails embedded:', Object.keys(base64Map).length);
