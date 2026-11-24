// 把 pinyin.txt（mozillazg/pinyin-data, MIT）编译为 src/engine/pinyin-data.js
// 声调映射使用 \uXXXX 转义，避免任何文件编码问题
const fs = require('fs');
const path = require('path');

const text = fs.readFileSync(path.join(__dirname, 'pinyin.txt'), 'utf8');

// 带调元音 → (字母, 声调)
const TONE = {
  '\u0101': 'a1', '\u00e1': 'a2', '\u01ce': 'a3', '\u00e0': 'a4',
  '\u0113': 'e1', '\u00e9': 'e2', '\u011b': 'e3', '\u00e8': 'e4',
  '\u012b': 'i1', '\u00ed': 'i2', '\u01d0': 'i3', '\u00ec': 'i4',
  '\u014d': 'o1', '\u00f3': 'o2', '\u01d2': 'o3', '\u00f2': 'o4',
  '\u016b': 'u1', '\u00fa': 'u2', '\u01d4': 'u3', '\u00f9': 'u4',
  '\u01d6': 'v1', '\u01d8': 'v2', '\u01da': 'v3', '\u01dc': 'v4',
  '\u00fc': 'v', '\u0144': 'n2', '\u0148': 'n3', '\u01f9': 'n4', '\u1e3f': 'm2', '\u00ea': 'e',
};

function toneNum(py) {
  let tone = 5;
  let out = '';
  let marked = false;
  for (const ch of py) {
    if (TONE[ch]) {
      const t = TONE[ch];
      out += t.replace(/[1-4]$/, '');
      if (/[1-4]$/.test(t)) { tone = Number(t.slice(-1)); marked = true; }
    } else if (/[a-z]/.test(ch)) out += ch;
    else return null;
  }
  if (!out) return null;
  if (marked) return out + tone;
  if (py === 'r' || py === 'hm' || py === 'hng' || py === 'n' || py === 'ng' || py === 'm') return out + '5';
  return null; // 无调号且非轻声字，交给默认值
}

const re = /^U\+([0-9A-Fa-f]+):\s*([^#]+?)\s*(?:#\s*(.*))?$/;
const map = {};
const multi = {};
for (const line of text.split(/\r?\n/)) {
  const m = re.exec(line.trim());
  if (!m) continue;
  const cp = parseInt(m[1], 16);
  if (cp < 0x4e00 || cp > 0x9fff) continue;
  const ch = String.fromCodePoint(cp);
  const alts = m[2].split(',').map((x) => toneNum(x.trim())).filter(Boolean);
  if (!alts.length) continue;
  map[ch] = alts[0];
  if (alts.length > 1) multi[ch] = alts.slice(0, 3).join('|');
}

const lines = [];
let l = '';
const push = (item) => { if (l.length + item.length > 100) { lines.push(l); l = ''; } l += item; };
for (const k in map) push(JSON.stringify(k) + ':' + JSON.stringify(map[k]) + ',');

const mlines = [];
let ml = '';
for (const k in multi) { const item = JSON.stringify(k) + ':' + JSON.stringify(multi[k]) + ','; if (ml.length + item.length > 100) { mlines.push(ml); ml = ''; } ml += item; }

const body = '/* 拼音数据：mozillazg/pinyin-data (MIT) 编译；U+4E00..U+9FFF\n'
  + ' * 字:拼音+声调；多音字备选表供上下文规则之外的兜底。 */\n'
  + '(function (root) {\n  var MAP = {\n' + lines.join('\n') + '\n  };\n'
  + '  var MULTI = {\n' + mlines.join('\n') + '\n  };\n'
  + '  root.Jpc = root.Jpc || {};\n  root.Jpc.PINYIN_MAP = MAP;\n  root.Jpc.PINYIN_MULTI = MULTI;\n'
  + '  if (root.Jpc.setPinyin) root.Jpc.setPinyin(MAP);\n'
  + '  if (typeof module !== "undefined" && module.exports) { module.exports = { MAP: MAP, MULTI: MULTI }; }\n'
  + '})(typeof window !== "undefined" ? window : globalThis);\n';
const dest = path.join(__dirname, '..', 'src', 'engine', 'pinyin-data.js');
fs.writeFileSync(dest, body, 'utf8');
console.log('chars', Object.keys(map).length, 'multi', Object.keys(multi).length, 'size', (body.length / 1024).toFixed(0) + 'KB');
console.log('sample', map['\u4f60'], map['\u8bb2'], map['\u89e3'], map['\u6210'], map['\u7247'], map['\u7387']);