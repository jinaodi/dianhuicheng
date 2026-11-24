/* 讲解成片 · 数据包规范 v1
 * .jpc 文件 = JSON：{ magic: 'JPC1', app, version, project }
 * 所有时间单位为秒（float），坐标单位为设计稿像素（默认 1920x1080）。
 */
(function (root) {
  'use strict';

  const STYLE_PRESETS = [
    { id: 'apple-dark', name: '深空发布会', bg: '#0b0d12', fg: '#f2f5f9', accent: '#5aa9ff', sub: '#93a0b4' },
    { id: 'paper', name: '米白学术', bg: '#f7f3ea', fg: '#20211f', accent: '#c2410c', sub: '#6b6a65' },
    { id: 'mint', name: '薄荷教学', bg: '#eef6f2', fg: '#123028', accent: '#0f9d76', sub: '#4d6b62' },
    { id: 'swiss', name: '瑞士极简', bg: '#ffffff', fg: '#111111', accent: '#e11d48', sub: '#666666' },
    { id: 'ocean', name: '海洋报告', bg: '#0d2136', fg: '#eaf2fb', accent: '#38d6c4', sub: '#8aa6c0' },
  ];

  function uid(prefix) {
    return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
  }

  /** 把纯文本切分为“普通文本 + [台词]”段，台词段用于动效强关联 */
  function parseBody(text) {
    const segs = [];
    const re = /\[([^\[\]]{1,40})\]/g;
    let last = 0;
    let m;
    const src = String(text == null ? '' : text);
    while ((m = re.exec(src))) {
      if (m.index > last) segs.push({ t: 'text', v: src.slice(last, m.index) });
      segs.push({ t: 'cue', v: m[1] });
      last = m.index + m[0].length;
    }
    if (last < src.length) segs.push({ t: 'text', v: src.slice(last) });
    return segs;
  }

  function plainOf(segs) {
    return segs.map((s) => (s.t === 'cue' ? s.v : s.v)).join('');
  }

  function newSlide(opts) {
    const o = opts || {};
    return {
      id: uid('s'),
      layout: o.layout || 'title',
      kicker: o.kicker || '',
      title: o.title || '',
      body: o.body || '在这里输入讲解内容。用 [方括号] 标出台词重点，会自动变成动效。',
      bullets: o.bullets || ['要点一', '要点二', '要点三'],
      stats: o.stats || [{ value: '3', label: '个平台' }, { value: '0', label: '成本' }, { value: '1', label: '次点击' }],
      quote: o.quote || '一句话金句',
      source: o.source || '',
    };
  }

  function newProject(opts) {
    const o = opts || {};
    const p = {
      schema: 1,
      title: o.title || '未命名讲解',
      author: o.author || '',
      size: { w: 1920, h: 1080 },
      style: {
        preset: o.preset || 'apple-dark',
        bg: '', fg: '', accent: '', sub: '',
        font: 'system',
        caption: { size: 44, maxLines: 2, bottom: 64 },
        motion: 'full', // full | calm | off
      },
      voice: {
        gender: o.gender || 'female',
        rate: 1.0,
        pitchHz: 0,
        volume: 0.9,
        whisper: false,
      },
      bgm: { file: '', track: 'none', gain: 0.16 },
      cover: { enabled: true, subtitle: '', kicker: 'AI 讲解成片' },
      slides: [],
    };
    p.slides = [newSlide({ layout: 'cover', title: p.title, kicker: 'Cover' })];
    return p;
  }

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  function migrate(raw) {
    if (!raw) return null;
    let obj = raw;
    if (typeof raw === 'string') {
      try { obj = JSON.parse(raw); } catch (e) { return null; }
    }
    if (obj.magic === 'JPC1' || obj.project) obj = obj.project;
    if (!obj || !Array.isArray(obj.slides)) return null;
    const p = Object.assign(newProject(), obj);
    p.style = Object.assign(newProject().style, obj.style || {});
    p.voice = Object.assign(newProject().voice, obj.voice || {});
    p.bgm = Object.assign(newProject().bgm, obj.bgm || {});
    p.cover = Object.assign(newProject().cover, obj.cover || {});
    p.slides = p.slides.map((s) => Object.assign(newSlide(), s));
    return p;
  }

  function wrap(project) {
    return JSON.stringify({ magic: 'JPC1', app: '讲解成片 v1.0', version: 1, savedAt: new Date().toISOString(), project }, null, 1);
  }

  const api = { STYLE_PRESETS, uid, parseBody, plainOf, newSlide, newProject, clone, migrate, wrap };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Jpc = Object.assign(root.Jpc || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);