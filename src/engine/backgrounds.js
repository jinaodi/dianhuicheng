/* 讲解成片 · 画面层
 * 8 套版式 + 由项目色调推导的程序化背景（光斑/网格/山脊/星空/水波/光线/纸纹/渐层）
 * 每个模板自身负责入场动效与“高亮当前要点”，并与口播语块对齐。
 */
(function (root) {
  'use strict';

  const W = 1920;
  const H = 1080;

  function palette(project) {
    const P = (root.Jpc.STYLE_PRESETS || []).find((x) => x.id === project.style.preset) || root.Jpc.STYLE_PRESETS[0];
    const st = project.style;
    return {
      bg: st.bg || P.bg,
      fg: st.fg || P.fg,
      accent: st.accent || P.accent,
      sub: st.sub || P.sub,
    };
  }
  function paletteOf(project) {
    const P = (root.Jpc.STYLE_PRESETS || []).find((x) => x.id === project.style.preset) || root.Jpc.STYLE_PRESETS[0];
    const st = project.style;
    return { bg: st.bg || P.bg, fg: st.fg || P.fg, accent: st.accent || P.accent, sub: st.sub || P.sub };
  }
  root.Jpc = Object.assign(root.Jpc || {}, { paletteOf });

  function hexToRgb(h) {
    const s = String(h || '#000').replace('#', '');
    const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(h, a) { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; }
  function mix(a, b, k) {
    const A = hexToRgb(a); const B = hexToRgb(b);
    const c = A.map((x, i) => Math.round(x + (B[i] - x) * k));
    return '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  function isLight(h) { const [r, g, b] = hexToRgb(h); return (r * 299 + g * 587 + b * 114) / 1000 > 150; }
  root.Jpc = Object.assign(root.Jpc || {}, { rgba, mix, isLight });

  // 极简确定性随机（同一页每次重绘一致）
  function rng(seed) {
    let s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  root.Jpc = Object.assign(root.Jpc || {}, { rng });

  const BACKGROUNDS = {
    aurora(ctx, t, p, seed) {
      const { bg, accent } = p;
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      const R = rng(seed);
      const blobs = [[0.2, 0.3, 900], [0.78, 0.22, 700], [0.55, 0.85, 820], [0.9, 0.75, 560]];
      blobs.forEach((b, i) => {
        const x = W * b[0] + Math.sin(t * 0.12 + i) * 90;
        const y = H * b[1] + Math.cos(t * 0.09 + i * 1.7) * 70;
        const g = ctx.createRadialGradient(x, y, 0, x, y, b[2]);
        g.addColorStop(0, rgba(accent, 0.2 + 0.05 * Math.sin(t * 0.4 + i)));
        g.addColorStop(1, rgba(accent, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      });
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 70; i++) {
        const x = R() * W; const y = R() * H;
        const s = 0.6 + R() * 1.4;
        ctx.fillStyle = rgba(p.fg, 0.15 + 0.25 * Math.abs(Math.sin(t * 0.5 + i)));
        ctx.fillRect(x, y, s, s);
      }
      ctx.globalAlpha = 1;
    },
    paper(ctx, t, p, seed) {
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      const R = rng(seed);
      ctx.globalAlpha = 0.05;
      for (let i = 0; i < 2600; i++) {
        ctx.fillStyle = i % 3 ? p.fg : p.accent;
        ctx.fillRect(R() * W, R() * H, 1 + R() * 3, 1 + R() * 2);
      }
      ctx.globalAlpha = 1;
      const g = ctx.createLinearGradient(0, H * 0.6, W, H);
      g.addColorStop(0, rgba(p.accent, 0));
      g.addColorStop(1, rgba(p.accent, 0.06));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    },
    grid(ctx, t, p) {
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = rgba(p.fg, 0.06);
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.strokeStyle = rgba(p.accent, 0.5);
      ctx.lineWidth = 2;
      const cx = W * 0.5; const cy = H * 0.5;
      const r = 46 + 14 * Math.sin(t * 0.6);
      ctx.beginPath(); ctx.arc(cx, cy, r * 2, 0, Math.PI * 2); ctx.stroke();
    },
    starfield(ctx, t, p, seed) {
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      const R = rng(seed);
      for (let i = 0; i < 160; i++) {
        const x = R() * W; const y = R() * H; const s = R() * 2.2 + 0.4;
        const a = 0.15 + 0.5 * Math.abs(Math.sin(t * 0.6 + i * 0.7));
        ctx.fillStyle = rgba(i % 11 === 0 ? p.accent : p.fg, a);
        ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
      }
      const g = ctx.createLinearGradient(0, H * 0.55, 0, H);
      g.addColorStop(0, rgba(p.accent, 0));
      g.addColorStop(1, rgba(p.accent, 0.13));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    },
    waves(ctx, t, p) {
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        const amp = 26 + k * 10;
        const off = H * (0.62 + k * 0.07);
        for (let x = -40; x <= W + 40; x += 16) {
          const y = off + Math.sin(x / 240 + t * (0.5 + k * 0.12) + k) * amp;
          if (x === -40) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.lineTo(W + 40, H); ctx.lineTo(-40, H); ctx.closePath();
        ctx.fillStyle = rgba(p.accent, 0.05 + k * 0.03);
        ctx.fill();
      }
    },
    rays(ctx, t, p) {
      const g0 = ctx.createLinearGradient(0, 0, W, H);
      g0.addColorStop(0, p.bg);
      g0.addColorStop(1, mix(p.bg, p.accent, 0.15));
      ctx.fillStyle = g0; ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W * 0.84, -H * 0.25);
      for (let i = 0; i < 9; i++) {
        ctx.rotate(0.16);
        ctx.fillStyle = rgba(p.accent, 0.05 + 0.03 * Math.sin(t * 0.5 + i));
        ctx.fillRect(-40, 0, 80, H * 2.2);
      }
      ctx.restore();
    },
    ridge(ctx, t, p) {
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      const layers = 4;
      for (let k = 0; k < layers; k++) {
        const base = H * (0.55 + k * 0.11);
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 24) {
          const y = base + Math.sin(x / 300 + k * 1.3) * 40 + Math.sin(x / 97 + k) * 16 - Math.sin(t * 0.15 + k) * 6;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H); ctx.closePath();
        ctx.fillStyle = mix(p.bg, p.accent, 0.08 + k * 0.09);
        ctx.fill();
      }
    },
    dots(ctx, t, p) {
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      for (let x = 40; x < W; x += 56) {
        for (let y = 40; y < H; y += 56) {
          const d = Math.hypot(x - W * 0.5, y - H * 0.42) / 900;
          const a = 0.05 + 0.2 * Math.max(0, 1 - d) * (0.7 + 0.3 * Math.sin(t * 1.2 - d * 6));
          ctx.fillStyle = rgba(p.accent, a);
          ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
        }
      }
    },
  };

  /* ---------------- 文字工具 ---------------- */
  const FONT = '"Microsoft YaHei UI", "PingFang SC", "Noto Sans CJK SC", "Source Han Sans SC", sans-serif';

  function font(size, weight) { return `${weight || 400} ${size}px ${FONT}`; }

  /** 行首避头标点：避头标点不能落在行首，否则会单独一行 */
  const NO_LINE_START = '。，、；：！？…）》」』】,.;:!?)]}%';
  function wrap(ctx, text, maxW) {
    const lines = [];
    const paras = String(text || '').split('\n');
    paras.forEach((para) => {
      if (!para) { lines.push(''); return; }
      let line = '';
      for (const ch of para) {
        const test = line + ch;
        if (ctx.measureText(test).width > maxW && line) {
          // 若下一个字是避头标点，则把它带回上一行（允许轻微溢出，避免标点独占一行）
          if (NO_LINE_START.indexOf(ch) >= 0) { line = test; continue; }
          // 若行尾已是开引号/开括号，也一起带走
          lines.push(line);
          line = ch;
        } else line = test;
      }
      if (line) lines.push(line);
    });
    return lines;
  }

  function richText(ctx, segs, x, y, maxW, lineH, opts) {
    // segs: [{t:'text'|'cue', v}]，cue 用强调色加底；也可直接传字符串
    if (typeof segs === 'string') segs = [{ t: 'text', v: segs }];
    const o = opts || {};
    const base = o.font || font(40, 400);
    ctx.font = base;
    const getFont = (cue) => (cue ? font(o.size || 40, 700) : base);
    const lines = [];
    let cur = [];
    segs.forEach((seg) => {
      const runFont = getFont(seg.t === 'cue');
      const isLatinWord = /^[A-Za-z0-9.\-]+$/.test(seg.v);
      for (let i = 0; i < seg.v.length; i++) {
        const ch = seg.v[i];
        cur.push({ ch, cue: seg.t === 'cue', f: runFont, size: seg.t === 'cue' ? (o.size || 40) : null });
      }
    });
    // 行排版
    let line = [];
    let w = 0;
    for (const g of cur) {
      ctx.font = g.f;
      const cw = ctx.measureText(g.ch).width;
      if (g.ch === '\n' || (w + cw > maxW && line.length)) {
        // 避头标点：不让标点（。，、等）单独落到下一行行首
        if (g.ch !== '\n' && NO_LINE_START.indexOf(g.ch) >= 0) {
          line.push({ ...g, w: cw });
          w += cw;
          continue;
        }
        lines.push(line); line = []; w = 0;
        if (g.ch === '\n') continue;
      }
      line.push({ ...g, w: cw });
      w += cw;
    }
    if (line.length) lines.push(line);
    const maxLines = o.maxLines || 99;
    if (lines.length > maxLines) {
      const extra = lines.splice(maxLines);
      if (lines.length) lines[lines.length - 1].push({ ch: '…', f: base, w: ctx.measureText('…').width });
    }
    return { lines, lineH, x, y, maxW };
  }

  function drawRich(ctx, rich, color, cueColor, cueBg, align) {
    let y = rich.y;
    const lh = rich.lineH;
    rich.lines.forEach((line) => {
      let total = line.reduce((a, g) => a + g.w, 0);
      let x = rich.x;
      if (align === 'center') x = rich.x + (rich.maxW - total) / 2;
      // 先画底色块
      line.forEach((g) => {
        ctx.font = g.f;
        if (g.cue) {
          ctx.fillStyle = cueBg;
          const padX = 6;
          ctx.fillRect(x - padX, y - lh * 0.78, g.w + padX * 2, lh * 0.86);
        }
        ctx.fillStyle = g.cue ? cueColor : color;
        ctx.fillText(g.ch, x, y);
        x += g.w;
      });
      y += lh;
    });
    return y;
  }

  /** 从正文中抽取“数值 + 单位 + 说明文字”作为数字卡片（未手填 stats 时使用） */
  const NUM_RE = /(\d+(?:\.\d+)?\s*(?:%|倍|元|万|人|次|页|分钟|秒|小时|天|家|个|字))/g;
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

  function statFrom(body) {
    const out = statsParts(body);
    if (!out.length) out.push({ value: '—', label: '关键指标' });
    return out;
  }

  function drawText(ctx, text, x, y, size, weight, color, maxW, lineH) {
    ctx.font = font(size, weight);
    ctx.fillStyle = color;
    const lines = wrap(ctx, text, maxW);
    lines.forEach((l, i) => {
      if (lineH && i >= Math.floor(lineH)) return;
      ctx.fillText(l, x, y + i * (size * 1.42));
    });
    return lines.length;
  }

  function fade(t, t0, dur) { return Math.max(0, Math.min(1, (t - t0) / (dur || 0.6))); }
  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }

  /* ---------------- 版式模板 ---------------- */
  const LAYOUTS = {
    cover(ctx, s, t, p, seed, seg) {
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      BACKGROUNDS.aurora(ctx, t, p, seed);
      const k = easeOut(fade(t, 0.1, 0.9));
      ctx.globalAlpha = k;
      // 竖线 + 大标题
      ctx.fillStyle = p.accent;
      ctx.fillRect(140, 300, 6, 380 * k);
      ctx.font = font(30, 600);
      ctx.fillStyle = p.accent;
      ctx.fillText(String(s.kicker || 'PRESENTATION').toUpperCase(), 190, 330);
      ctx.font = font(96, 800);
      ctx.fillStyle = p.fg;
      const lines = wrap(ctx, s.title, 1500);
      lines.forEach((l, i) => {
        const a = easeOut(fade(t, 0.3 + i * 0.18, 0.8));
        ctx.globalAlpha = a * k;
        ctx.fillText(l, 190, 460 + i * 130);
      });
      ctx.globalAlpha = k;
      const sub = s.body ? String(s.body).split(/[。\n]/)[0] : '';
      if (sub) {
        const a2 = easeOut(fade(t, 1.0, 0.8));
        ctx.globalAlpha = a2 * k;
        ctx.font = font(34, 400);
        ctx.fillStyle = p.sub;
        ctx.fillText(sub.slice(0, 30), 190, 480 + lines.length * 130);
        ctx.globalAlpha = k;
      }
      ctx.font = font(24, 500);
      ctx.fillStyle = rgba(p.fg, 0.5);
      ctx.fillText(s.source || '', 190, H - 120);
      ctx.globalAlpha = 1;
    },

    title(ctx, s, t, p, seed) {
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      BACKGROUNDS.aurora(ctx, t * 0.6, p, seed);
      const k = easeOut(fade(t, 0.05, 0.7));
      ctx.globalAlpha = k;
      ctx.font = font(26, 600);
      ctx.fillStyle = p.accent;
      const kb = String(s.kicker || '').toUpperCase();
      if (kb) ctx.fillText(kb, 140, 250);
      ctx.font = font(86, 800);
      ctx.fillStyle = p.fg;
      let lines = wrap(ctx, s.title, 1640);
      if (lines.length > 3) { ctx.font = font(70, 800); lines = wrap(ctx, s.title, 1640); }
      lines.forEach((l, i) => ctx.fillText(l, 140, 250 + 120 + i * 118));
      let y = 250 + 120 + lines.length * 118 + 30;
      ctx.fillStyle = p.accent;
      ctx.fillRect(140, y - 10, 120 * easeOut(fade(t, 0.5, 0.8)), 5);
      y += 60;
      if (s.body) {
        const segs = root.Jpc.parseBody(s.body);
        const rich = richText(ctx, segs, 140, y + 20, 1500, 58, { font: font(38, 400), size: 38, maxLines: 3 });
        drawRich(ctx, rich, p.sub, p.accent, rgba(p.accent, 0.14));
      }
      ctx.globalAlpha = 1;
      footer(ctx, s, p);
    },

    bullets(ctx, s, t, p, seed, seg, ctxInfo) {
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      BACKGROUNDS[p._paper ? 'paper' : 'rays'](ctx, t, p, seed);
      header(ctx, s, t, p);
      const items = (s.bullets || []).slice(0, 6);
      const active = ctxInfo ? ctxInfo.bullet : Math.min(items.length - 1, Math.floor((t - 0.4) / 0.7));
      const startY = String(s.body || '').trim() ? 500 : 430;
      const rowH = Math.min(118, (H - 260 - startY) / Math.max(1, items.length));
      items.forEach((it, i) => {
        const a = easeOut(fade(t, 0.35 + i * 0.16, 0.5));
        if (a <= 0) return;
        const dx = (1 - a) * -40;
        ctx.globalAlpha = a;
        const y = startY + i * rowH;
        const on = i === active;
        if (on) {
          ctx.fillStyle = rgba(p.accent, 0.12);
          roundRect(ctx, 110, y - 52, 1700, rowH - 10, 14);
          ctx.fill();
          ctx.fillStyle = p.accent;
          ctx.fillRect(110, y - 52, 6, rowH - 10);
        }
        ctx.font = font(34, 700);
        ctx.fillStyle = on ? p.accent : rgba(p.sub, 0.8);
        ctx.fillText(String(i + 1).padStart(2, '0'), 150 + dx, y);
        ctx.font = font(on ? 44 : 40, on ? 700 : 500);
        ctx.fillStyle = on ? p.fg : rgba(p.fg, 0.82);
        const lines = wrap(ctx, it, 1480);
        lines.slice(0, 2).forEach((l, j) => ctx.fillText(l, 240 + dx, y + j * 56));
        ctx.globalAlpha = 1;
      });
      footer(ctx, s, p);
    },

    split(ctx, s, t, p, seed) {
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      // 右半可视化
      ctx.save();
      ctx.beginPath(); ctx.rect(W * 0.5, 0, W * 0.5, H); ctx.clip();
      ctx.fillStyle = mix(p.bg, p.accent, 0.12); ctx.fillRect(W * 0.5, 0, W * 0.5, H);
      ctx.save(); ctx.beginPath(); ctx.rect(W * 0.5, 0, W * 0.5, H); ctx.clip(); BACKGROUNDS.dots(ctx, t, p, seed); ctx.restore();
      ctx.restore();
      const st = s.stats && s.stats.length ? s.stats : statFrom(s.body);
      const n = Math.min(3, st.length);
      st.slice(0, n).forEach((it, i) => {
        const a = easeOut(fade(t, 0.3 + i * 0.25, 0.7));
        ctx.globalAlpha = a;
        const cx = W * 0.75 + (i - (n - 1) / 2) * 340 * (n > 1 ? 0.6 : 0);
        const cy = H * 0.5;
        ctx.beginPath(); ctx.arc(cx, cy, 128, 0, Math.PI * 2);
        ctx.fillStyle = rgba(p.accent, 0.12); ctx.fill();
        ctx.font = font(72, 800);
        ctx.fillStyle = p.accent;
        const txt = String(it.value || '');
        ctx.textAlign = 'center';
        ctx.fillText(txt, cx, cy + 18);
        ctx.font = font(24, 500);
        ctx.fillStyle = p.sub;
        ctx.fillText(String(it.label || ''), cx, cy + 72);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
      });
      header(ctx, s, t, p, true);
      if (s.body) {
        const rich = richText(ctx, root.Jpc.parseBody(s.body), 140, 430, 680, 56, { font: font(34, 400), size: 34, maxLines: 5 });
        drawRich(ctx, rich, p.sub, p.accent, rgba(p.accent, 0.14));
      }
      footer(ctx, s, p);
    },

    numbers(ctx, s, t, p, seed) {
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      BACKGROUNDS.grid(ctx, t, p);
      header(ctx, s, t, p, true);
      const st = (s.stats && s.stats.length ? s.stats : statFrom(s.body)).slice(0, 4);
      const n = st.length;
      const bw = 1680 / n;
      st.forEach((it, i) => {
        const a = easeOut(fade(t, 0.3 + i * 0.18, 0.7));
        ctx.globalAlpha = a;
        const x = 120 + i * bw;
        ctx.font = font(30, 600);
        ctx.fillStyle = rgba(p.accent, 0.8);
        ctx.fillText('0' + (i + 1), x, 470);
        ctx.font = font(96, 800);
        ctx.fillStyle = p.fg;
        const val = String(it.value == null ? '' : it.value);
        ctx.fillText(val, x, 600);
        ctx.font = font(30, 500);
        ctx.fillStyle = p.sub;
        const ls = wrap(ctx, String(it.label || ''), bw - 60);
        ls.slice(0, 3).forEach((l, j) => ctx.fillText(l, x, 680 + j * 44));
        ctx.globalAlpha = 1;
      });
      footer(ctx, s, p);
    },

    quote(ctx, s, t, p, seed) {
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      BACKGROUNDS.ridge(ctx, t * 0.5, p);
      const a = easeOut(fade(t, 0.2, 0.9));
      ctx.globalAlpha = a;
      ctx.font = font(260, 800);
      ctx.fillStyle = rgba(p.accent, 0.35);
      ctx.fillText('“', 120, 400);
      ctx.font = font(66, 700);
      ctx.fillStyle = p.fg;
      const q = wrap(ctx, s.quote || s.title || '', 1500);
      q.forEach((l, i) => ctx.fillText(l, 260, 420 + i * 96));
      ctx.font = font(30, 500);
      ctx.fillStyle = p.sub;
      ctx.fillText(s.title || '', 260, 420 + q.length * 96 + 50);
      ctx.globalAlpha = 1;
      footer(ctx, s, p);
    },

    timeline(ctx, s, t, p, seed) {
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      BACKGROUNDS.grid(ctx, t, p);
      header(ctx, s, t, p);
      const items = (s.bullets && s.bullets.length ? s.bullets : ['阶段一', '阶段二', '阶段三', '阶段四']).slice(0, 5);
      const y = 620;
      const prog = easeOut(fade(t, 0.3, 1.2));
      // 步骤条随口播逐步点亮
      const totalDur = 1.6;
      const step = Math.floor((t - 0.4) / 0.5);
      ctx.fillStyle = rgba(p.fg, 0.15);
      ctx.fillRect(160, y, 1600 * prog, 6);
      const active = Math.min(items.length - 1, Math.max(0, step));
      items.forEach((it, i) => {
        const x = 160 + (1600 / Math.max(1, items.length - 1)) * i;
        const a = easeOut(fade(t, 0.35 + i * 0.3, 0.5));
        if (a <= 0) return;
        const on = i <= active;
        ctx.globalAlpha = a;
        ctx.beginPath(); ctx.arc(x, y + 3, on ? 18 : 11, 0, Math.PI * 2);
        ctx.fillStyle = on ? p.accent : rgba(p.fg, 0.3); ctx.fill();
        if (i === active) { ctx.beginPath(); ctx.arc(x, y + 3, 30, 0, Math.PI * 2); ctx.strokeStyle = rgba(p.accent, 0.5); ctx.lineWidth = 2; ctx.stroke(); }
        ctx.font = font(30, i === active ? 700 : 500);
        ctx.fillStyle = i === active ? p.fg : rgba(p.fg, 0.7);
        const ls = wrap(ctx, String(it), 300);
        ls.slice(0, 3).forEach((l, j) => ctx.fillText(l, x - 140, y + 80 + j * 46));
        ctx.globalAlpha = 1;
      });
      footer(ctx, s, p);
    },

    compare(ctx, s, t, p, seed, seg) {
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      BACKGROUNDS.rays(ctx, t, p);
      header(ctx, s, t, p);
      const items = (s.bullets && s.bullets.length >= 2 ? s.bullets : ['现状', '目标']);
      const half = Math.ceil(items.length / 2);
      const left = items.slice(0, half);
      const right = items.slice(half);
      const cols = [[left, 140], [right, W / 2 + 40]];
      cols.forEach(([list, x]) => {
        ctx.fillStyle = rgba(p.fg, 0.05);
        roundRect(ctx, x, 420, W / 2 - 180, 460, 22);
        ctx.fill();
        list.forEach((it, i) => {
          const a = easeOut(fade(t, 0.4 + i * 0.3, 0.5));
          ctx.globalAlpha = a;
          ctx.font = font(40, 600);
          ctx.fillStyle = p.fg;
          const ls = wrap(ctx, String(it), W / 2 - 260);
          ls.slice(0, 2).forEach((l, j) => ctx.fillText(l, x + 60, 500 + i * 140 + j * 52));
          ctx.globalAlpha = 1;
        });
      });
      ctx.font = font(44, 800);
      ctx.fillStyle = p.accent;
      ctx.textAlign = 'center';
      ctx.fillText('→', W / 2, 660);
      ctx.textAlign = 'left';
      footer(ctx, s, p);
    },
  };

  /* ---------------- 通用件 ---------------- */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function header(ctx, s, t, p, noBody) {
    const k = easeOut(fade(t, 0.05, 0.6));
    ctx.globalAlpha = k;
    ctx.font = font(24, 600);
    ctx.fillStyle = p.accent;
    if (s.kicker) ctx.fillText(String(s.kicker).toUpperCase(), 140, 200);
    ctx.font = font(62, 800);
    ctx.fillStyle = p.fg;
    const lines = wrap(ctx, s.title || '', 1560);
    lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, 140, 200 + 74 + i * 76));
    ctx.fillStyle = p.accent;
    ctx.fillRect(140, 200 + 74 + Math.min(2, lines.length) * 76 - 6, 90 * easeOut(fade(t, 0.3, 0.7)), 5);
    ctx.globalAlpha = 1;
    if (s.layout === 'bullets' && !String(s.body || '').trim()) {
      if (s.takeaway) {
        ctx.font = font(28, 500);
        ctx.fillStyle = p.sub;
        ctx.fillText(String(s.takeaway).slice(0, 46), 140, 368);
      }
      return;
    }
    if (!noBody && s.body) {
      const segs = root.Jpc.parseBody(s.body);
      const rich = richText(ctx, segs, 140, 320 + Math.min(2, lines.length) * 76, 1500, 50, { font: font(30, 400), size: 30, maxLines: 2 });
      drawRich(ctx, rich, p.sub, p.accent, rgba(p.accent, 0.14));
    }
  }

  function footer(ctx, s, p) {
    ctx.font = font(20, 400);
    ctx.fillStyle = rgba(p.fg, 0.35);
    if (s.source) ctx.fillText(String(s.source).slice(0, 80), 140, H - 56);
  }

  function drawBackground(name, ctx, t, p, seed) {
    const fn = BACKGROUNDS[name] || BACKGROUNDS.aurora;
    fn(ctx, t, p, seed);
  }

  /** 主渲染入口：所有画面（预览、点播、导出）都走这里，确保预览即成片 */
  function drawSlide(ctx, project, slide, t, seg, ctxInfo) {
    const p = paletteOf(project);
    p._paper = project.style.preset === 'paper';
    const seed = hash(slide.id);
    ctx.save();
    const fn = LAYOUTS[slide.layout] || LAYOUTS.bullets;
    try {
      fn(ctx, slide, t, p, seed, seg, ctxInfo || {});
    } finally {
      ctx.restore();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
  }

  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function drawCaption(ctx, text, style, p) {
    if (!text) return;
    // 字幕只念出口播内容：[方括号] 是“强调标记”，不能出现在字幕里
    text = String(text).replace(/[\[\]【】]/g, '');
    if (!text.trim()) return;
    ctx.save();
    const size = (style.caption && style.caption.size) || 44;
    const bottom = Math.max(88, (style.caption && style.caption.bottom) || 64);
    ctx.font = font(size, 700);
    const lines = wrap(ctx, text, W - 420);
    const lh = size * 1.38;
    const maxLines = (style.caption && style.caption.maxLines) || 2;
    const use = lines.slice(-maxLines);
    const h = use.length * lh + 34;
    const y0 = H - bottom - h;
    const dark = !isLight(p.bg);
    ctx.fillStyle = dark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.86)';
    roundRect(ctx, W / 2 - (W - 420) / 2 - 24, y0, W - 420 + 48, h, 14);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = dark ? '#ffffff' : '#1b1f24';
    use.forEach((l, i) => ctx.fillText(l, W / 2, y0 + 34 + size * 0.92 + i * lh));
    ctx.restore();
  }

  function drawBrand(ctx, project, t) {
    // 右下角角标：讲解成片 · 作品演示
    const p = paletteOf(project);
    ctx.font = font(20, 600);
    ctx.fillStyle = rgba(p.fg, 0.4);
    ctx.textAlign = 'right';
    ctx.fillText(project.author ? project.author : '讲解成片', W - 60, H - 56);
    ctx.textAlign = 'left';
  }

  const api = {
    W, H, LAYOUTS, BACKGROUNDS, drawSlide, drawBackground, drawCaption, drawBrand, palette, roundRect,
    drawText, font, wrap, fade, easeOut, rng, hash,
  };
  root.Jpc = Object.assign(root.Jpc || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);