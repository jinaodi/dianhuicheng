/* 讲解成片 · 时间轴引擎
 * 输入：项目 + 可选“真实音频时长”（离线 TTS 实测）
 * 输出：不可变时间轴（cues / 每页区间 / 总时长）。渲染、字幕、合成全部读同一份时间轴，
 *       这正是“预览即成片”的关键：画面与口播不会对不上。
 */
(function (root) {
  'use strict';

  const CJK = /[\u3400-\u9fff\uf900-\ufaff]/;
  const STRONG = /[。！？!?…]/;
  const WEAK = /[，、；：,;:]/;

  /** 无实测音频时的语速估算：按“汉字权重 + 标点停顿”折算秒数 */
  function speakingSeconds(text, rate) {
    const r = Math.max(0.5, Math.min(2, Number(rate) || 1));
    let weight = 0;
    let pauses = 0;
    const s = String(text || '');
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (/\s/.test(ch)) { weight += 0.12; continue; }
      if (STRONG.test(ch)) { pauses += 1; weight += 0.9; continue; }
      if (WEAK.test(ch)) { pauses += 0.55; weight += 0.6; continue; }
      if (/[，。；：！？“”‘’（）《》【】—…·]/.test(ch)) { weight += 0.35; continue; }
      if (CJK.test(ch)) { weight += 1.0; continue; }
      weight += 0.42;
    }
    const sec = weight / 4.6 / r;
    return Math.max(1.2, sec + pauses * 0.25);
  }

  /** 按标点切句；超过 24 字允许在逗号处断开，保证一句字幕不超长 */
  function splitSentences(text) {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    if (!s) return [];
    const out = [];
    let buf = '';
    for (let i = 0; i < s.length; i++) {
      buf += s[i];
      const ch = s[i];
      const next = s[i + 1] || '';
      if (/[0-9]/.test(next) || /\.[0-9]/.test(buf.slice(-2))) continue;
      if (STRONG.test(ch) || (WEAK.test(ch) && buf.length > 24)) {
        if (buf.trim()) out.push(buf.trim());
        buf = '';
      }
    }
    if (buf.trim()) out.push(buf.trim());
    return out;
  }

  /** 一页 → 语块序列：正文句 + 台词锚点 */
  function segmentsOf(slide) {
    const segs = [];
    const raw = String(slide.body || '');
    if (!raw.trim() && slide.layout === 'bullets') {
      (slide.bullets || []).filter(Boolean).forEach((b) => {
        splitSentences(b).forEach((t) => segs.push({ kind: 'text', text: t }));
      });
      return segs;
    }
    if (!raw.trim()) return segs;
    root.Jpc.parseBody(raw).forEach((seg) => {
      if (seg.t === 'cue') { segs.push({ kind: 'cue', text: seg.v }); return; }
      splitSentences(seg.v).forEach((t) => segs.push({ kind: 'text', text: t }));
    });
    return segs;
  }

  /**
   * @param project 项目
   * @param opts { audio: { slideIndex: { segIndex: seconds } } | null, measured: { slideIndex: seconds } }
   */
  function buildTimeline(project, opts) {
    const o = opts || {};
    const audio = o.audio || null;
    const cues = [];
    const slideAt = [];
    let t = 0;
    project.slides.forEach((slide, si) => {
      const segs = segmentsOf(slide);
      const first = cues.length;
      let slideSpeech = 0;
      segs.forEach((seg, k) => {
        let dur;
        if (seg.kind === 'cue') dur = 0.12;
        else if (audio && audio[si] && audio[si][k]) dur = audio[si][k];
        else dur = speakingSeconds(seg.text, project.voice.rate);
        dur = Math.max(seg.kind === 'cue' ? 0.08 : 0.3, dur);
        if (seg.kind === 'text') slideSpeech += dur;
        cues.push({ slide: si, kind: seg.kind, text: seg.text, start: t, end: t + dur });
        t += dur;
      });
      let tail = segs.length ? Math.max(0.32, Math.min(1.1, 0.18 + segs.length * 0.06)) : 0.9;
      if (!segs.length) tail = 1.2;
      slideAt.push({ index: si, in: slideAt.length ? slideAt[slideAt.length - 1].out : 0, out: t + tail, firstCue: first, lastCue: cues.length - 1, speech: slideSpeech, tail });
      t += tail;
    });
    return { cues, slides: slideAt, total: t, audio };
  }

  /** 当前时间点所在的语块下标（-1 表示落在页间停顿里） */
  function cueAt(tl, t) {
    let lo = 0;
    let hi = tl.cues.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const c = tl.cues[mid];
      if (t < c.start) hi = mid - 1;
      else if (t > c.end) lo = mid + 1;
      else { ans = mid; break; }
    }
    return ans;
  }

  /** 字幕内容：当前句 + 前一句（最多 max 行、34 字），与画面同源 */
  function captionFor(tl, t, max) {
    max = max || 2;
    const idx = cueAt(tl, t);
    if (idx < 0) return { text: '' };
    const c = tl.cues[idx];
    const near = [];
    let used = 0;
    for (let i = idx; i >= 0; i--) {
      const cu = tl.cues[i];
      if (cu.kind === 'cue' || cu.slide !== c.slide) continue;
      near.unshift(cu.text);
      used += cu.text.length;
      if (near.length >= max || used > 34) break;
    }
    return { text: near.join(''), index: idx };
  }

  function easeInOutCubic(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  const api = { speakingSeconds, splitSentences, segmentsOf, buildTimeline, cueAt, captionFor, easeInOutCubic, clamp01 };
  root.Jpc = Object.assign(root.Jpc || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);