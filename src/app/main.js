/* 讲解成片 · 应用外壳（状态机 + 四步导航） */
(function () {
  'use strict';
  const { h, toast } = UI;

  const State = {
    project: Jpc.newProject({ title: '未命名讲解' }),
    raw: '',
    step: 1,
    timeline: null,
    audio: null, // { slideIndex: { cueIndex: wavBytes } }
    audioCache: null,
    fileName: '讲解.jpc',
    playing: false,
    cursor: 0, // 当前播放时间
  };

  function loadSample(id) {
    const s = Jpc.SAMPLES[id];
    if (!s) return;
    State.project = Jpc.newProject({ title: s.title, author: s.author, preset: s.preset || 'apple-dark' });
    State.project.cover = { enabled: true, subtitle: '', kicker: s.kicker || 'AI 讲解成片' };
    State.raw = s.script;
    State.project.slides = Jpc.buildSlides(s.script);
    invalidate();
    toast('已载入示例：' + s.name);
    go(1);
  }

  function invalidate() {
    State.timeline = null;
    State.audioCache = null;
  }

  function getTimeline() {
    if (!State.timeline) {
      const audio = State.audioCache;
      State.timeline = Jpc.buildTimeline(State.project, { audio });
    }
    return State.timeline;
  }

  function setActiveStep(n) {
    document.querySelectorAll('.step').forEach((b) => {
      const s = Number(b.dataset.step);
      b.classList.toggle('active', s === n);
      b.classList.toggle('done', s < n);
    });
  }

  const screens = {
    1: () => Screen1.render(State, api),
    2: () => Screen2.render(State, api),
    3: () => Screen3.render(State, api),
    4: () => Screen4.render(State, api),
  };

  function go(n) {
    if (State.playing) { State.playing = false; if (Screen3.stop) Screen3.stop(); }
    State.step = n;
    setActiveStep(n);
    const main = document.getElementById('main');
    main.innerHTML = '';
    const el = screens[n]();
    main.appendChild(el);
    if (Screen1.leave) Screen1.leave();
  }

  const api = {
    State, go, invalidate, getTimeline, loadSample, toast, h,
    setProject(p) { State.project = p; invalidate(); },
    setName(n) { State.fileName = n; },
  };

  document.querySelectorAll('.step').forEach((b) => b.addEventListener('click', () => go(Number(b.dataset.step))));

  document.getElementById('btnTpl').addEventListener('click', () => {
    // 示例选择
    const ids = Object.keys(Jpc.SAMPLES);
    const idx = (ids.indexOf(State._lastSample) + 1) % ids.length;
    State._lastSample = ids[idx];
    loadSample(ids[idx]);
  });

  document.getElementById('btnNew').addEventListener('click', () => {
    State.project = Jpc.newProject({ title: '未命名讲解' });
    State.raw = '';
    State.audio = null;
    invalidate();
    go(1);
    toast('已新建空白项目');
  });

  document.getElementById('btnSave').addEventListener('click', () => {
    const txt = Jpc.wrap(State.project);
    const name = (State.project.title || '讲解') + '.jpc';
    const blob = new Blob([txt], { type: 'application/json' });
    if (window.nativeSave) window.nativeSave(name, txt); else UI.download(name, blob);
    toast('已保存项目：' + name);
  });

  document.getElementById('btnOpen').addEventListener('click', () => {
    if (window.nativeOpen) { window.nativeOpen(); return; }
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.jpc,.json';
    inp.onchange = () => {
      const f = inp.files[0];
      if (!f) return;
      const fr = new FileReader();
      fr.onload = () => {
        const p = Jpc.migrate(fr.result);
        if (!p) { toast('无法识别的项目文件'); return; }
        api.setProject(p);
        go(1);
        toast('已打开：' + p.title);
      };
      fr.readAsText(f);
    };
    inp.click();
  });

  // 桌面端（Electron）回调
  window.addEventListener('jpc:opened', (e) => {
    const p = Jpc.migrate(e.detail);
    if (!p) { toast('无法识别的项目文件'); return; }
    api.setProject(p);
    go(1);
    toast('已打开：' + p.title);
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); document.getElementById('btnSave').click(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'o') { e.preventDefault(); document.getElementById('btnOpen').click(); }
    if (e.key === ' ' && State.step === 3 && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
      e.preventDefault(); Screen3.toggle();
    }
  });

  /* ---------------- 桌面版（Electron）导出桥 ---------------- */
  // 只有 Electron（contextIsolation:false + nodeIntegration）里才有 require + ipcRenderer
  const hasElectron = (() => { try { return typeof require === 'function' && !!require('electron').ipcRenderer; } catch (e) { return false; } })();

  if (hasElectron) {
    const { ipcRenderer } = require('electron');
    const FPS = 30;
    const W = 1920;
    const H = 1080;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d');

    // 逐帧渲染：与预览、与浏览器导出使用同一个 drawSlide / drawCaption
    window.__jpcDrawFrame = function (frame) {
      const t = frame / FPS;
      const tl = getTimeline();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      let si = tl.slides.findIndex((s) => t >= s.in && t < s.out);
      if (si < 0) si = tl.slides.length - 1;
      const s = tl.slides[si];
      const slide = State.project.slides[si];
      const ci = Jpc.cueAt(tl, t);
      Jpc.drawSlide(ctx, State.project, slide, t - s.in, ci, { bullet: Math.max(0, Math.min(5, (ci >= 0 ? ci - s.firstCue : 0) / 2 | 0)) });
      const capCfg = State.project.style.caption || {};
      if (capCfg.show !== false) {
        const cap = Jpc.captionFor(tl, t, capCfg.maxLines || 2);
        if (cap.text) Jpc.drawCaption(ctx, cap.text, State.project.style, Jpc.paletteOf(State.project));
      }
      Jpc.drawBrand(ctx, State.project, t);
      return cv.toDataURL('image/png');
    };

    // 全程配音：一次合成，返回 WAV 字节
    window.__jpcMakeAudio = function () {
      const tl = getTimeline();
      const sentences = tl.cues.map((c) => ({ kind: c.kind, text: c.text }));
      const res = Jpc.synthSpeech(sentences, State.project.voice);
      return Jpc.toWav16(res.samples, Jpc.SR);
    };

    window.jpcExport = async function (project, opts) {
      const tl = getTimeline();
      const onProgress = (opts && opts.onProgress) || function () {};
      ipcRenderer.on('jpc:progress', (_e, d) => onProgress(d.p, d.msg));
      const res = await ipcRenderer.invoke('jpc:export', { project, timeline: tl, fps: FPS });
      if (res && res.canceled) throw new Error('已取消导出');
      onProgress(1, '完成：' + (res.filePath || ''));
      return res;
    };
  }

  // 载入示例作为首屏引导（首次打开）
  loadSample('pitch');
  State._lastSample = 'pitch';

  window.JPC_APP = api;
})();