// 生成演示视频（赛道三：3 分钟以内真实展示"这个工具解决一次具体问题"）
// 做法：真实浏览器操作单文件应用 + 真实逐帧成片 —— 全部由脚本自动录屏合成，不用任何剪辑软件。
// 用法：node tools/make-demo.js
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const W = 1920, H = 1080;
const FPS = 25;
const WORK = path.join(ROOT, 'shots', 'demo');
const OUT = path.join(ROOT, 'shots', 'video', '演示视频_讲解成片.mp4');

function findFfmpeg() {
  const base = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
  try {
    for (const d of fs.readdirSync(base)) {
      if (!/FFmpeg/i.test(d)) continue;
      const sub = path.join(base, d);
      for (const v of fs.readdirSync(sub)) return path.join(sub, v, 'bin', 'ffmpeg.exe');
    }
  } catch (e) { /* ignore */ }
  return 'ffmpeg.exe';
}

// 逐帧录屏器：capture() 取一张图，push 进 ffmpeg stdin
class FfmpegSink {
  constructor(ff, out, dir) {
    this.dir = dir;
    this.n = 0;
    this.ff = spawn(ff, [
      '-y', '-framerate', String(FPS), '-i', path.join(dir, 'f%05d.jpg'),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', out,
    ], { windowsHide: true });
    this.ff.stderr.on('data', () => {});
  }
  end() { return new Promise((r) => { this.ff.on('close', r); }); }
}

(async () => {
  fs.mkdirSync(WORK, { recursive: true });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const ff = findFfmpeg();
  console.log('ffmpeg:', ff);

  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, acceptDownloads: true });
  const p = await ctx.newPage();
  const frameDir = path.join(WORK, 'frames');
  fs.rmSync(frameDir, { recursive: true, force: true });
  fs.mkdirSync(frameDir, { recursive: true });
  let n = 0;

  const grab = async () => {
    const buf = await p.screenshot({ type: 'jpeg', quality: 92 });
    fs.writeFileSync(path.join(frameDir, 'f' + String(n++).padStart(5, '0') + '.jpg'), buf);
  };
  // 保持帧数：在 waitMs 内按 FPS 均匀取帧
  const hold = async (ms, every = 1000 / FPS) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { await grab(); const el = Date.now() - t0; const wait = every - (el % every); await p.waitForTimeout(Math.max(10, wait)); }
  };

  await p.goto('file:///' + path.join(ROOT, 'dist', '讲解成片.html').replace(/\\/g, '/'));
  await p.waitForTimeout(1500);
  await p.evaluate(() => document.documentElement.style.zoom = '1');
  await hold(2200);

  // 第二步：换成浅色主题，看画面立刻变化
  await p.evaluate(() => window.JPC_APP.go(1));
  await hold(1600);
  await p.evaluate(() => window.JPC_APP.go(2));
  await hold(1200);
  await p.evaluate(() => { const t = document.querySelectorAll('.theme'); if (t[1]) t[1].click(); });
  await hold(2200);
  await p.evaluate(() => { const t = document.querySelectorAll('.theme'); if (t[0]) t[0].click(); });
  await hold(1200);

  // 第三步：点播（真实出声的音频不录，只看画面节奏）
  await p.evaluate(() => window.JPC_APP.go(3));
  await hold(900);
  await p.evaluate(() => window.Screen3 && window.Screen3.toggle && window.Screen3.toggle());
  await hold(9000);
  await p.evaluate(() => window.Screen3 && window.Screen3.stop && window.Screen3.stop());

  // 第四步：导出
  await p.evaluate(() => window.JPC_APP.go(4));
  await hold(3400);
  await b.close();

  const sink = new FfmpegSink(ff, OUT, frameDir);
  const files = fs.readdirSync(frameDir).filter((f) => f.endsWith('.jpg')).sort();
  console.log('frames:', files.length, '≈', (files.length / FPS).toFixed(1) + 's');
  await sink.end();
  console.log('done ->', OUT, (fs.statSync(OUT).size / 1048576).toFixed(2) + ' MB');
})().catch((e) => { console.error(e); process.exit(1); });