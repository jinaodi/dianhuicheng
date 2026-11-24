/* 讲解成片 · 卡片导出版式（16:9 静态图，用于提交/宣传）
 * 与成片共用引擎与配色，但排版为静态卡片：标题 + 三块功能 + 一句话主张。
 * 用法：Jpc.renderCardSlide(ctx, index)  index: 0 封面 / 1 三步工作流 / 2 离线配音 / 3 卡住
 */
(function (root) {
  'use strict';
  const W = 1920;
  const H = 1080;
  const PRESET = { bg: '#0b0d12', fg: '#f2f5f9', accent: '#5aa9ff', sub: '#93a0b4' };
  const WARM = '#ffb35c';

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function rgba(hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  const FONT = '"Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif';
  const font = (size, weight) => (weight || 400) + ' ' + size + 'px ' + FONT;

  function bg(ctx) {
    ctx.fillStyle = PRESET.bg;
    ctx.fillRect(0, 0, W, H);
    const g1 = ctx.createRadialGradient(300, 120, 0, 300, 120, 900);
    g1.addColorStop(0, rgba(PRESET.accent, 0.22));
    g1.addColorStop(1, rgba(PRESET.accent, 0));
    ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
    const g2 = ctx.createRadialGradient(1680, 980, 0, 1680, 980, 760);
    g2.addColorStop(0, rgba('#38d6c4', 0.16));
    g2.addColorStop(1, rgba('#38d6c4', 0));
    ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = rgba(PRESET.fg, 0.045);
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  }

  function brand(ctx, text) {
    ctx.font = font(22, 500);
    ctx.fillStyle = rgba(PRESET.fg, 0.45);
    ctx.textAlign = 'left';
    ctx.fillText(text || '讲解成片 v1.0  ·  赛道三 AI 实用作品', 110, H - 52);
  }

  function kicker(ctx, text, y) {
    ctx.font = font(26, 700);
    ctx.fillStyle = PRESET.accent;
    ctx.fillText(text, 110, y);
    const w = ctx.measureText(text).width;
    ctx.fillStyle = rgba(PRESET.accent, 0.35);
    ctx.fillRect(110, y + 16, w, 3);
  }

  function title(ctx, lines, y, size) {
    ctx.font = font(size || 78, 800);
    ctx.fillStyle = PRESET.fg;
    lines.forEach((l, i) => ctx.fillText(l, 110, y + i * (size || 78) * 1.28));
  }

  function card(ctx, x, y, w, h, titleText, bodyText, num) {
    ctx.fillStyle = rgba('#141922', 0.92);
    rr(ctx, x, y, w, h, 22); ctx.fill();
    ctx.strokeStyle = rgba(PRESET.fg, 0.1); ctx.lineWidth = 2; ctx.stroke();
    ctx.font = font(24, 800);
    ctx.fillStyle = PRESET.accent;
    ctx.fillText(num, x + 40, y + 64);
    ctx.font = font(38, 700);
    ctx.fillStyle = PRESET.fg;
    ctx.fillText(titleText, x + 40, y + 132);
    ctx.font = font(26, 400);
    ctx.fillStyle = PRESET.sub;
    bodyText.forEach((l, i) => ctx.fillText(l, x + 40, y + 196 + i * 44));
  }

  const SLIDES = [
    // 0 封面
    (ctx) => {
      bg(ctx);
      ctx.font = font(28, 700);
      ctx.fillStyle = PRESET.accent;
      ctx.fillText('赛道三 · AI 实用作品', 110, 220);
      ctx.font = font(120, 800);
      ctx.fillStyle = PRESET.fg;
      ctx.fillText('讲解成片', 106, 400);
      ctx.font = font(52, 700);
      ctx.fillStyle = rgba(PRESET.fg, 0.92);
      ctx.fillText('一份稿子，变成一条带配音、带字幕的成片', 110, 510);
      ctx.font = font(30, 400);
      ctx.fillStyle = PRESET.sub;
      ctx.fillText('离线中文配音 + 自动分镜 + 自动时间轴 + 1080P 导出', 110, 580);
      // 右侧示意：三行“稿子→分镜→成片”
      const bx = 1180, by = 240;
      ctx.fillStyle = rgba('#141922', 0.9);
      rr(ctx, bx, by, 620, 520, 26); ctx.fill();
      ctx.strokeStyle = rgba(PRESET.accent, 0.35); ctx.lineWidth = 2; ctx.stroke();
      ['①②③'].forEach(() => {});
      const steps = ['① 粘贴稿子', '② 自动分镜 · 配音', '③ 一键导出 MP4'];
      steps.forEach((s, i) => {
        ctx.font = font(30, i === 2 ? 700 : 500);
        ctx.fillStyle = i === 2 ? PRESET.accent : rgba(PRESET.fg, 0.85);
        ctx.fillText(s, bx + 50, by + 120 + i * 130);
        if (i < 2) {
          ctx.strokeStyle = rgba(PRESET.accent, 0.5); ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(bx + 50, by + 150 + i * 130); ctx.lineTo(bx + 50, by + 200 + i * 130); ctx.stroke();
        }
      });
      ctx.font = font(24, 400);
      ctx.fillStyle = rgba(PRESET.fg, 0.4);
      ctx.fillText('全程离线，不上传任何文字', bx + 50, by + 470);
      brand(ctx);
    },
    // 1 三步工作流
    (ctx) => {
      bg(ctx);
      kicker(ctx, '工作流', 150);
      title(ctx, ['三步，从稿子到成片'], 260);
      ctx.font = font(30, 400);
      ctx.fillStyle = PRESET.sub;
      ctx.fillText('不装剪辑软件，不录人声，不手动打轴。', 110, 390);
      const cw = 520, gap = 35, y = 470, ch = 380;
      card(ctx, 110, y, cw, ch, '粘贴稿子', ['支持 Markdown 小标题与列表', '[方括号] 标重点 → 字幕高亮', '自动切成 4–12 页分镜'], '01');
      card(ctx, 110 + cw + gap, y, cw, ch, '自动分镜配音', ['规则分镜：标题/要点/数字/金句', '离线共振峰合成，三个音色', '语音时长决定画面时长'], '02');
      card(ctx, 110 + (cw + gap) * 2, y, cw, ch, '一键导出', ['1920×1080 · 30fps · H.264', '烧录字幕 + SRT 字幕文件', '可再导出每页 PNG 与稿子'], '03');
      ctx.font = font(28, 500);
      ctx.fillStyle = rgba(PRESET.fg, 0.75);
      ctx.fillText('实测：4 页 1 分钟片，从粘贴到出片约 3 分钟。', 110, 940);
      brand(ctx);
    },
    // 2 离线配音
    (ctx) => {
      bg(ctx);
      kicker(ctx, '核心之一：离线配音', 150);
      title(ctx, ['不联网，也能有声音'], 260);
      ctx.font = font(30, 400);
      ctx.fillStyle = PRESET.sub;
      ctx.fillText('内置 20914 字拼音表，前端实时合成中文语音；音色、语速、音调都能调。', 110, 390);
      // 波形示意
      const wx = 110, wy = 500, ww = 1100, wh = 260;
      ctx.fillStyle = rgba('#141922', 0.9);
      rr(ctx, wx, wy, ww, wh, 22); ctx.fill();
      ctx.strokeStyle = rgba(PRESET.fg, 0.08); ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = rgba(PRESET.accent, 0.9); ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 220; i++) {
        const x = wx + 30 + (i / 220) * (ww - 60);
        const a = (Math.sin(i * 0.7) * 0.5 + 0.5) * Math.sin(i * 0.13) * 0.5 + 0.5;
        const hh = 8 + a * 90;
        ctx.moveTo(x, wy + wh / 2 - hh / 2);
        ctx.lineTo(x, wy + wh / 2 + hh / 2);
      }
      ctx.stroke();
      ctx.fillStyle = rgba(PRESET.fg, 0.5);
      ctx.font = font(24, 400);
      ctx.fillText('00:00', wx + 30, wy + wh - 30);
      ctx.fillText('00:12', wx + ww - 110, wy + wh - 30);
      // 右侧参数
      const px = 1260;
      [['音色', '女声 / 男声 / 童声'], ['语速', '0.8× – 1.3×'], ['音调', '±0.8 半音'], ['字数', '2 万字拼音表']].forEach((r, i) => {
        ctx.font = font(24, 500); ctx.fillStyle = PRESET.sub;
        ctx.fillText(r[0], px, 540 + i * 90);
        ctx.font = font(32, 700); ctx.fillStyle = PRESET.fg;
        ctx.fillText(r[1], px, 582 + i * 90);
      });
      ctx.font = font(28, 500);
      ctx.fillStyle = rgba(PRESET.fg, 0.75);
      ctx.fillText('三个音色只是听感选项，它服务的是“能不能自己出片”。', 110, 940);
      brand(ctx);
    },
    // 3 卡点
    (ctx) => {
      bg(ctx);
      kicker(ctx, '为什么我自己要写一个', 150);
      title(ctx, ['我卡在哪一步'], 260);
      ctx.font = font(30, 400);
      ctx.fillStyle = PRESET.sub;
      ctx.fillText('做一个讲解视频，真正花时间的不是想内容。', 110, 390);
      ctx.fillStyle = rgba(WARM, 0.1);
      rr(ctx, 110, 450, 1700, 200, 22); ctx.fill();
      ctx.strokeStyle = rgba(WARM, 0.45); ctx.lineWidth = 2; ctx.stroke();
      ctx.font = font(40, 700);
      ctx.fillStyle = WARM;
      ctx.fillText('录音要重来 · 字幕对不上 · 音乐音量调不准 · 换文案还要重排一遍', 150, 545);
      ctx.font = font(28, 400);
      ctx.fillStyle = rgba(PRESET.fg, 0.7);
      ctx.fillText('这四件事都跟内容无关，却占掉八成时间。', 150, 605);
      ctx.font = font(44, 700);
      ctx.fillStyle = PRESET.fg;
      ctx.fillText('所以：把「排版 + 配音 + 对轴」交给程序。', 110, 800);
      ctx.font = font(28, 500);
      ctx.fillStyle = rgba(PRESET.fg, 0.75);
      ctx.fillText('人只负责想清楚要讲什么。', 110, 880);
      brand(ctx);
    },
  ];

  function renderCardSlide(ctx, index) {
    ctx.save();
    (SLIDES[index] || SLIDES[0])(ctx);
    ctx.restore();
  }

  root.Jpc = Object.assign(root.Jpc || {}, { renderCardSlide, CARD_SLIDE_COUNT: SLIDES.length });
  if (typeof module !== 'undefined' && module.exports) module.exports = { renderCardSlide, CARD_SLIDE_COUNT: SLIDES.length };
})(typeof window !== 'undefined' ? window : globalThis);