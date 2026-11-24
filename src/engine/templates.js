/* 讲解成片 · 分镜模板 + 示例稿
 * 把一段稿子半自动切成页面：优先识别“小标题 / 列表 / 数字”，并给出推荐版式。
 * 纯规则实现（无模型、离线可用），规则可读、可解释 —— 这也是作品“过程可追溯”的一部分。
 */
(function (root) {
  'use strict';

  const LAYOUT_NAMES = {
    cover: '封面', title: '标题', bullets: '要点列表', split: '图文分栏', numbers: '数字卡片',
    quote: '金句', timeline: '流程时间线', compare: '对比',
  };

  const STRONG = /[。！？!?…]/;

  function splitSentences(t) {
    const s = String(t || '').replace(/\s+/g, ' ').trim();
    if (!s) return [];
    const out = [];
    let buf = '';
    for (let i = 0; i < s.length; i++) {
      buf += s[i];
      if (STRONG.test(s[i])) { out.push(buf.trim()); buf = ''; }
    }
    if (buf.trim()) out.push(buf.trim());
    return out;
  }

  function firstSentence(t) {
    const arr = splitSentences(t);
    let f = (arr[0] || String(t || '')).replace(/[。！？!?…\s]/g, '');
    if (f.length > 22) f = f.slice(0, 20) + '…';
    return f;
  }

  function parseBulletLine(s) {
    const m = /^\s*(?:[-*•·]|\d+[.、)]|[（(]\d+[)）]|[①-⑳])\s*(.+)$/.exec(s);
    return m ? m[1].trim() : null;
  }

  const NUM_RE = /(\d+(?:\.\d+)?\s*(?:%|倍|元|万|人|次|页|分钟|秒|小时|天|家|个|字))/g;
  function numsOf(t) { return String(t || '').match(NUM_RE) || []; }

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
      const cut = Math.max.apply(null, ['，', ',', '。', '；', '：', '、', '\n'].map((c) => sub.lastIndexOf(c)));
      out.push({ value: m[1].replace(/\s/g, ''), label: cleanLabel(sub.slice(cut + 1)) });
    }
    return out;
  }

  function statsFrom(t) { return statsParts(t); }

  /** 稿子 → [{head, lines[]}]，按 Markdown 小标题切块 */
  function splitBlocks(raw) {
    const blocks = [];
    let cur = { head: '', lines: [] };
    const flush = () => { if (cur.head || cur.lines.length) blocks.push(cur); cur = { head: '', lines: [] }; };
    String(raw || '').replace(/\r/g, '').split('\n').forEach((ln) => {
      const s = ln.trim();
      if (!s) { flush(); return; }
      if (/^#{1,6}\s+/.test(s) || /^\*\*.+\*\*$/.test(s)) {
        flush();
        cur.head = s.replace(/^#{1,6}\s+|\*\*/g, '').trim();
        return;
      }
      cur.lines.push(s);
    });
    flush();
    return blocks.length ? blocks : [{ head: '', lines: [] }];
  }

  /** 长段落按句打包成不超过 maxChars 的若干页 */
  function packSentences(text, maxChars) {
    const sents = splitSentences(text);
    const parts = [];
    let buf = '';
    sents.forEach((s) => {
      if (buf && (buf + s).length > maxChars) { parts.push(buf); buf = ''; }
      buf += s;
    });
    if (buf.trim()) parts.push(buf);
    if (!parts.length) parts.push('');
    return parts;
  }

  /** 分页主流程：返回基础幻灯片数据 */
  function paginate(raw, opts) {
    const o = opts || {};
    const maxChars = o.maxChars || 130;
    const out = [];
    splitBlocks(raw).forEach((b) => {
      const bullets = b.lines.map(parseBulletLine).filter((x) => x != null);
      const plain = b.lines.filter((l) => parseBulletLine(l) == null).join(' ');
      if (bullets.length >= 2) {
        out.push({ layout: 'bullets', title: b.head || firstSentence(plain) || '要点', body: plain, bullets: bullets.slice(0, 6), takeaway: b.head ? '' : '' });
        return;
      }
      const parts = packSentences(b.lines.join(''), maxChars);
      parts.forEach((p, i) => {
        out.push({
          layout: 'title',
          title: (i === 0 && b.head) || firstSentence(p) || '第 ' + (out.length + 2) + ' 页',
          body: p, bullets: [], kicker: i === 0 && b.head ? '' : '',
        });
      });
    });
    return out;
  }

  /** 推荐版式：列表页→要点；数字≥2→数字卡；数字 1 个且短→图文分栏；末页总结→金句 */
  function suggestLayouts(slides) {
    slides.forEach((s, i) => {
      const n = numsOf(s.body).length;
      if (s.bullets && s.bullets.length >= 2) s.layout = 'bullets';
      else if (n >= 2) s.layout = 'numbers';
      else if (n === 1 && String(s.body || '').length < 70) s.layout = 'split';
      else if (/总结|综上|总之|结论|记住|回到|本质/.test((s.title || '') + (s.body || '')) && i === slides.length - 1) s.layout = 'quote';
      else s.layout = 'title';
      if (s.layout === 'numbers' || s.layout === 'split') s.stats = statsFrom(s.body);
      if (s.layout === 'quote') s.quote = String(s.body || '').replace(/\[|\]/g, '').slice(0, 40);
    });
    return slides;
  }

  function buildSlides(raw) {
    const slides = paginate(raw).map((s) => Object.assign(Jpc.newSlide(), s));
    return suggestLayouts(slides);
  }

  /* ---------------- 示例稿（三份，覆盖 1–3 分钟） ---------------- */
  const SAMPLES = {
    pitch: {
      id: 'pitch', name: '产品发布（1 分钟）',
      title: '讲解成片 · 让每一份稿子都自带配音',
      author: '参赛作品演示', kicker: 'AI 实用作品 · 赛道三',
      preset: 'apple-dark',
      script: [
        '## 痛点：从讲稿到视频，隔着七道工序',
        '写稿、分页、排版、配音、配乐、打字幕、剪片子。一个熟练的人，一页也要十几分钟。',
        '- 排版靠手调，改一个字就要重新对齐',
        '- 配音要录音，一句口误就整段重来',
        '- 字幕要打轴，时间点永远对不齐',
        '## 解法：稿子即分镜',
        '在讲解成片里，你只需要写稿。用 [方括号] 标出重点，它会自动变成字幕高亮。',
        '引擎把文字拆成语块，估算节奏，把每一句排进时间轴，所以字幕和画面天然同步。',
        '## 效果：8 页讲稿，3 分钟出片',
        '从粘贴稿子到导出成片，平均耗时 3 分钟。字幕自动跟读，版式一键切换，全程可以离线。',
        '## 总结',
        '把排版、配音、对轴的时间，还给内容本身。',
      ].join('\n'),
    },
    report: {
      id: 'report', name: '季度汇报（2 分钟）',
      title: '第三季度运营复盘', author: '运营组', kicker: '季度汇报', preset: 'ocean',
      script: [
        '## 01 整体数据',
        '本季度新增用户 12.4 万，环比增长 38%。活跃率 61%，留存提升 7 个百分点。',
        '## 02 增长来源',
        '- 内容分发贡献 52% 的新增',
        '- 老用户邀请占 23%',
        '- 线下活动转化 15%',
        '## 03 问题与风险',
        '获客成本仍然高于行业均值，单用户成本 18 元，需要在下季度压到 12 元以内。',
        '## 04 下一步',
        '聚焦三件事：打磨内容分发，上线邀请激励，把线下活动搬到线上。',
      ].join('\n'),
    },
    course: {
      id: 'course', name: '微课讲解（2 分钟）',
      title: '什么是复利？', author: '数学课代表', kicker: '三分钟微课', preset: 'mint',
      script: [
        '## 一句话定义',
        '复利，就是利息也会生出利息。',
        '## 举个例子',
        '本金 1 万元，年化百分之十。第一年多 1000 元，第二年是 1100 元，第十年就是 2593 元。',
        '## 它的威力来自时间',
        '- 前五年累计增长 61%',
        '- 后五年再增长 161%',
        '- 时间越长，曲线越陡',
        '## 记住这个公式',
        '终值等于本金乘以一加利率的次方。关键是那个次方，也就是时间。',
      ].join('\n'),
    },
  };

  const api = { LAYOUT_NAMES, splitSentences, splitBlocks, paginate, packSentences, suggestLayouts, buildSlides, statsFrom, SAMPLES, firstSentence, numsOf };
  root.Jpc = Object.assign(root.Jpc || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);