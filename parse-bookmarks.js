#!/usr/bin/env node
/**
 * Parse Chrome bookmarks - extract by folder title (ブックマーク バーの直下フォルダ)
 */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'bookmarks_2026_02_21.html'), 'utf8');

const excludePatterns = [
  /^https?:\/\/(docs|drive|spreadsheets|presentation)\.google\.com\//i,
  /^https?:\/\/meet\.google\.com\//i,
  /^https?:\/\/www\.notion\.so\//i,
  /^https?:\/\/calendar\.google\.com\//i,
  /^https?:\/\/console\.aws\.amazon\.com\//i,
  /^https?:\/\/ranking-deli\.jp\//i,
  /^https?:\/\/qzin\.jp\//i,
  /^https?:\/\/cocoa-job\.jp\//i,
  /^https?:\/\/ranking-mensesthe\.jp\//i,
  /^https?:\/\/menesth\.jp\//i,
  /^https?:\/\/menesth-job\.jp\//i,
  /^https?:\/\/emily-job\.jp\//i,
  /^https?:\/\/(hporder|hearing|hearing2|originalhearing|banners)\.vootec\.net\//i,
  /^https?:\/\/tfpm\d+\.talent-p\.net\//i,
  /^https?:\/\/ytas\.obc-service\.biz\//i,
  /^https?:\/\/learning-navigator\.all-different\.co\.jp\//i,
  /^https?:\/\/chatgpt\.com\/c\//i,
  /^https?:\/\/claude\.ai\/chat\//i,
  /^https?:\/\/gemini\.google\.com\/app\/a\//i,
  /^https?:\/\/www\.dola\.com\/chat\//i,
  /^https?:\/\/www\.google\.com\/search/i,
  /^https?:\/\/www\.figma\.com\/files\/team\//i,
  /^https?:\/\/gabuchiki\.com\/what\.html/i,
  /^https?:\/\/www\.puriette\.jp\//i,
  /^https?:\/\/raise-by-relaxroom\.com\//i,
  /^https?:\/\/www\.earth\.jp\/la-estojenne/i,
  /^https?:\/\/www\.etsy\.com\/(jp\/)?listing\/(452964104|631207350)/i,
  /^https?:\/\/nailcheer\.com\//i,
  /^https?:\/\/pikbest\.com\/\?m=vip/i,
  /^https?:\/\/tcdwp\.net\/tcd041/i,
  /^https?:\/\/www\.opera-net\.jp\/special\/2018june/i,
  /^https?:\/\/www\.laissepasse\.jp\//i,
  /^https?:\/\/ririan-dsn\.com\/.*%E3%82%A2%E3%83%A1%E3%83%96%E3%83%AD/i,
  /^javascript:/i,
  /^chrome:/i,
  /^data:/i,
];

function shouldExclude(url) {
  return excludePatterns.some(p => p.test(url));
}

function toId(name) {
  return name.replace(/[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'folder';
}

const lines = html.split(/\r?\n/);
const folderStack = [];
const folders = {};
let topLevelFolderId = null;
const seen = new Set();

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const indent = (line.match(/^\s*/)[0] || '').length;

  const h3Match = line.match(/<DT><H3[^>]*>([^<]+)<\/H3>/);
  if (h3Match) {
    const folderName = h3Match[1].trim();
    const folderId = toId(folderName);

    if (folderName === 'ブックマーク バー' || folderName === 'その他のブックマーク') {
      folderStack.push({ name: folderName, indent });
      continue;
    }

    const parent = folderStack[folderStack.length - 1];
    const isTopLevel = parent && (parent.name === 'ブックマーク バー' || parent.name === 'その他のブックマーク');

    if (isTopLevel && !folders[folderId]) {
      folders[folderId] = { name: folderName, id: folderId, sites: [] };
      topLevelFolderId = folderId;
    }

    folderStack.push({ name: folderName, indent });
    continue;
  }

  if (line.match(/<\/DL>/)) {
    folderStack.pop();
    if (folderStack.length <= 1) {
      topLevelFolderId = null;
    }
    continue;
  }

  const aMatch = line.match(/<DT><A\s+HREF="([^"]+)"[^>]*>([^<]+)<\/A>/);
  if (aMatch && topLevelFolderId && folders[topLevelFolderId]) {
    const [, url, title] = aMatch;
    const cleanUrl = url.trim();
    const cleanTitle = title.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&gt;/g, '>').trim();

    if (!cleanUrl || !cleanTitle) continue;
    if (shouldExclude(cleanUrl)) continue;
    if (!url.startsWith('http')) continue;
    const key = cleanUrl + '|' + topLevelFolderId;
    if (seen.has(key)) continue;
    seen.add(key);

    const maxLen = 60;
    const displayName = cleanTitle.length > maxLen ? cleanTitle.slice(0, maxLen) + '…' : cleanTitle;

    folders[topLevelFolderId].sites.push({ name: displayName, url: cleanUrl });
  }
}

const folderOrder = ['仕事', 'ツール', '★★制作案件サイト', '【風俗関連】ネタサイト', '【一般】ネタサイト', '女性素材', '新★女性素材', '素材集', 'フォント', 'スキル', 'メディア', '事務関係', '総選挙XD', 'ショッピング リスト'];
const orderedFolders = folderOrder
  .map(name => folders[toId(name)])
  .filter(Boolean)
  .filter(f => f.sites.length > 0);

Object.values(folders).forEach(f => {
  if (!orderedFolders.find(o => o.id === f.id) && f.sites.length > 0) {
    orderedFolders.push(f);
  }
});

function esc(str) {
  return JSON.stringify(str);
}

let out = 'const folders = [\n';
orderedFolders.forEach(f => {
  out += `  { id: ${esc(f.id)}, name: ${esc(f.name)}, sites: [\n`;
  f.sites.forEach(s => {
    out += `    { name: ${esc(s.name)}, url: ${esc(s.url)} },\n`;
  });
  out += `  ] },\n`;
});
out += '];';

fs.writeFileSync(path.join(__dirname, 'sites-output.js'), out);
const total = orderedFolders.reduce((sum, f) => sum + f.sites.length, 0);
console.error(`Total: ${total} sites in ${orderedFolders.length} folders`);
orderedFolders.forEach(f => console.error(`  ${f.name}: ${f.sites.length}`));
