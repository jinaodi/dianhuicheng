// 用统一的数字卡片抽取规则替换 backgrounds.js / templates.js 中的旧实现
const fs = require('fs');
const path = require('path');

const helper = `  /** 从正文中抽取“数值 + 单位 + 说明文字”作为数字卡片（未手填 stats 时使用） */
  const NUM_RE = /(\\d+(?:\\.\\d+)?\\s*(?:%|倍|元|万|人|次|页|分钟|秒|小时|天|家|个|字))/g;
  const FUNC_CHARS = '的了在是为到让把和与约就都要会能有从对由及但也还只才更最再又并而则这那你我他它们每支段组条张多少近共全总';
  /** 数值前的同一分句 → 卡片说明（取最后一段实词，最多 7 字） */
  function cleanLabel(raw) {
    const src = String(raw || '');
    let last = 0;
    for (let i = 0; i < src.length; i++) if (FUNC_CHARS.indexOf(src[i]) >= 0) last = i + 1;
    const tail = src.slice(last);
    const s = (tail.length >= 2 ? tail : src).slice(-7);
    return s || '关键指标';
  }
  function statsParts(text) {
    const s = String(text || '');
    const out = [];
    let m;
    NUM_RE.lastIndex = 0;
    while ((m = NUM_RE.exec(s)) && out.length < 3) {
      const sub = s.slice(0, m.index);
      const cut = Math.max.apply(null, ['，', ',', '。', '；', '：', '、', '\\n'].map((c) => sub.lastIndexOf(c)));
      out.push({ value: m[1].replace(/\\s/g, ''), label: cleanLabel(sub.slice(cut + 1)) });
    }
    return out;
  }
`;

function patch(file, fromMark, toMark, replacement) {
  let t = fs.readFileSync(file, 'utf8');
  const a = t.indexOf(fromMark);
  const b = t.indexOf(toMark, a);
  if (a < 0 || b < 0) throw new Error('marker not found in ' + file + ' ' + a + ' ' + b);
  const before = t.slice(0, a);
  const tail = t.slice(b);
  t = before + replacement + tail;
  fs.writeFileSync(file, t, 'utf8');
  return t.length;
}

// backgrounds.js: 替换 statFrom + cleanLabel 两个函数
const bg = path.join(__dirname, '..', 'src', 'engine', 'backgrounds.js');
const bgFn = helper + `
  function statFrom(body) {
    const out = statsParts(body);
    if (!out.length) out.push({ value: '—', label: '关键指标' });
    return out;
  }

`;
patch(bg, '  function statFrom(body) {', '  function drawText(ctx, text, x, y, size, weight, color, maxW, lineH) {', bgFn);

// templates.js: 替换 cleanLabel + statsFrom
const tp = path.join(__dirname, '..', 'src', 'engine', 'templates.js');
const tpFn = helper + `
  function statsFrom(t) { return statsParts(t); }

`;
patch(tp, '  function cleanLabel(raw) {', '  /** 稿子 → [{head, lines[]}]，按 Markdown 小标题切块 */', tpFn);
console.log('patched');