// 生成 src/engine/pinyin-data.js：常用汉字 → 带声调拼音
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

function fetch(url, redirect) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { 'User-Agent': 'node' } }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        r.resume();
        return fetch(r.headers.location, redirect).then(res, rej);
      }
      if (r.statusCode !== 200) { r.resume(); return rej(new Error('HTTP ' + r.statusCode + ' ' + url)); }
      const chunks = [];
      r.on('data', (d) => chunks.push(d));
      r.on('end', () => res(Buffer.concat(chunks)));
    }).on('error', rej);
  });
}

async function tryOne(file) {
  const url = 'https://raw.githubusercontent.com/mozillazg/pinyin-data/master/pinyin.txt';
  const raw = (await fetch(url)).toString('utf8');
  const map = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = /^U\+([0-9A-F]+):\s*([a-zü:]+)\s*#\s*(.*)$/i.exec(line.trim());
    if (!m) continue;
    const cp = parseInt(m[1], 16);
    if (cp < 0x4e00 || cp > 0x9fff) continue;
    const ch = String.fromCodePoint(cp);
    const py = m[2].split(',')[0].replace(/u:/g, 'v');
    map[ch] = py;
  }
  return { map, src: url };
}

(async () => {
  const out = await tryOne();
  const keys = Object.keys(out.map);
  if (keys.length < 20000) throw new Error('too few entries: ' + keys.length);
  const lines = [];
  let l = '';
  for (const k of keys) {
    const item = JSON.stringify(k) + ':' + JSON.stringify(out.map[k]) + ',';
    if (l.length + item.length > 110) { lines.push(l); l = ''; }
    l += item;
  }
  if (l) lines.push(l);
  const body = '/* 拼音数据：来源 ' + out.src + '（mozillazg/pinyin-data, MIT License）\n'
    + ' * 仅收录 U+4E00..U+9FFF 区段每字首选读音；多音字由 voice.js 上下文表兜底。 */\n'
    + '(function (root) {\n  var MAP = {\n' + lines.join('\n') + '\n  };\n'
    + '  root.Jpc = root.Jpc || {};\n  root.Jpc.PINYIN_MAP = MAP;\n'
    + '  if (root.Jpc.setPinyin) root.Jpc.setPinyin(MAP);\n'
    + '  if (typeof module !== "undefined" && module.exports) module.exports = MAP;\n'
    + '})(typeof window !== "undefined" ? window : globalThis);\n';
  const dest = path.join(__dirname, '..', 'src', 'engine', 'pinyin-data.js');
  fs.writeFileSync(dest, body, 'utf8');
  console.log('wrote', dest, keys.length, 'chars', (body.length / 1024).toFixed(0) + 'KB');
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });