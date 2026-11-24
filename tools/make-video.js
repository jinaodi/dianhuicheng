// 讲解成片 · 成片导出（Node / 桌面版共用）
// 逐帧渲染 1920×1080@30fps → PNG 序列 → 离线配音 WAV → ffmpeg 合成 MP4（含字幕烧录）
// 用法：node tools/make-video.js <sample:pitch|report|course> [out.mp4] [--frames-only]
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const loadEngine = require('./load');

const FPS = 30;
const W = 1920;
const H = 1080;

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); return p; }

function findFfmpeg() {
  if (process.env.JPC_FFMPEG && fs.existsSync(process.env.JPC_FFMPEG)) return process.env.JPC_FFMPEG;
  const base = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
  try {
    for (const d of fs.readdirSync(base)) {
      if (!/FFmpeg/i.test(d)) continue;
      const sub = path.join(base, d);
      for (const v of fs.readdirSync(sub)) {
        const p = path.join(sub, v, 'bin', 'ffmpeg.exe');
        if (fs.existsSync(p)) return p;
      }
    }
  } catch (e) { /* ignore */ }
  return 'ffmpeg';
}

function loadApp() {
  // templates.js 依赖 Jpc.newSlide 等，load.js 已按依赖顺序载入
  const Jpc = loadEngine();
  // 追加 templates.js（buildSlides / SAMPLES）
  const vm = require('vm');
  const fp = path.join(__dirname, '..', 'src', 'engine', 'templates.js');
  const sandbox = { Jpc, console, JSON, Math, Object, String, Number, Array };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(fp, 'utf8'), sandbox, { filename: 'templates.js' });
  return sandbox.Jpc;
}

/** 离屏画布（node-canvas 未安装时用无头浏览器）—— 这里用 Playwright 统一渲染，保证与浏览器逐像素一致 */
async function renderFrames(project, tl, framesDir, onProgress) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const idx = path.join(__dirname, '..', 'src', 'app', 'index.html');
  await page.goto('file:///' + idx.replace(/\\/g, '/'));
  await page.waitForFunction(() => window.Jpc && window.Jpc.drawSlide);

  const total = Math.ceil(tl.total * FPS);
  // 一次性把项目与时间轴注入页面，逐帧调用 drawSlide → 导出 dataURL
  await page.evaluate(([proj, tlJson]) => {
    window.__PROJ = proj;
    window.__TL = tlJson;
    window.__cv = document.createElement('canvas');
    window.__cv.width = 1920;
    window.__cv.height = 1080;
    window.__ctx = window.__cv.getContext('2d');
    window.__drawAt = function (frame) {
      const t = frame / 30;
      const ctx = window.__ctx;
      const p = window.__PROJ;
      const tl = window.__TL;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, 1920, 1080);
      let si = tl.slides.findIndex((s) => t >= s.in && t < s.out);
      if (si < 0) si = tl.slides.length - 1;
      const s = tl.slides[si];
      const slide = p.slides[si];
      const local = t - s.in;
      const ci = Jpc.cueAt(tl, t);
      Jpc.drawSlide(ctx, p, slide, local, ci, { bullet: Math.max(0, Math.min(5, (ci >= 0 ? ci - s.firstCue : 0) / 2 | 0)) });
      if (p.style && p.style.caption && p.style.caption.show !== false) {
        const cap = Jpc.captionFor(tl, t, (p.style.caption && p.style.caption.maxLines) || 2);
        if (cap.text) Jpc.drawCaption(ctx, cap.text, p.style, Jpc.paletteOf(p));
      }
      Jpc.drawBrand(ctx, p, t);
      return window.__cv.toDataURL('image/png');
    };
  }, [project, tl]);

  for (let f = 0; f < total; f++) {
    const dataUrl = await page.evaluate((n) => window.__drawAt(n), f);
    const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    fs.writeFileSync(path.join(framesDir, 'f' + String(f).padStart(5, '0') + '.png'), Buffer.from(b64, 'base64'));
    if (onProgress && f % 30 === 0) onProgress(f / total);
  }
  await browser.close();
  return total;
}

function buildAudio(project, tl, outWav) {
  const sentences = tl.cues.map((c) => ({ kind: c.kind, text: c.text }));
  const speech = project.synthSpeech ? null : null;
  const Jpc = require('./load')();
  const res = Jpc.synthSpeech(sentences, project.voice);
  const wav = Jpc.toWav16(res.samples, Jpc.SR);
  fs.writeFileSync(outWav, Buffer.from(wav));
  return res.samples.length / Jpc.SR;
}

function makeSrt(tl) {
  const to = (t) => {
    const ms = Math.round(t * 1000);
    return [Math.floor(ms / 3600000), Math.floor((ms % 3600000) / 60000), Math.floor((ms % 60000) / 1000)]
      .map((n) => String(n).padStart(2, '0')).join(':') + ',' + String(ms % 1000).padStart(3, '0');
  };
  const out = [];
  let n = 1;
  tl.cues.forEach((c) => {
    if (c.kind !== 'text') return;
    out.push(n++, to(c.start) + ' --> ' + to(c.end), c.text, '');
  });
  return out.join('\n');
}

module.exports = { FPS, W, H, findFfmpeg, loadApp, renderFrames, buildAudio, makeSrt, ensureDir };

if (require.main === module) {
  (async () => {
    const arg = process.argv[2] || 'pitch';
    const out = path.resolve(process.argv[3] || path.join(__dirname, '..', 'shots', 'video', arg + '.mp4'));
    const framesOnly = process.argv.includes('--frames-only');
    const Jpc = loadApp();
    const sample = Jpc.SAMPLES[arg];
    if (!sample) { console.error('未知示例：' + arg + '；可选 ' + Object.keys(Jpc.SAMPLES).join(', ')); process.exit(1); }

    const project = Jpc.newProject({ title: sample.title, author: sample.author, preset: sample.preset });
    project.slides = Jpc.buildSlides(sample.script);
    const tl = Jpc.buildTimeline(project, {});

    const work = ensureDir(path.join(path.dirname(out), arg + '_work'));
    const framesDir = ensureDir(path.join(work, 'frames'));
    const t0 = Date.now();
    const n = await renderFrames(project, tl, framesDir, (p) => process.stdout.write('\r渲染帧 ' + Math.round(p * 100) + '%   '));
    console.log('\n帧数 ' + n + '，用时 ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
    buildAudio(project, tl, path.join(work, 'voice.wav'));
    fs.writeFileSync(path.join(work, 'sub.srt'), makeSrt(tl), 'utf8');
    if (framesOnly) { console.log('仅渲染帧：' + work); return; }

    const ff = findFfmpeg();
    const audioDur = tl.total;
    const args = [
      '-y', '-framerate', String(FPS), '-i', path.join(framesDir, 'f%05d.png'),
      '-i', path.join(work, 'voice.wav'),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium',
      '-c:a', 'aac', '-b:a', '128k', '-shortest',
      '-t', String(audioDur.toFixed(2)),
      out,
    ];
    console.log('合成中：' + ff);
    cp.execFileSync(ff, args, { stdio: 'inherit' });
    console.log('完成：' + out);
  })().catch((e) => { console.error(e); process.exit(1); });
}