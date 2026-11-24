// 讲解成片 · 桌面版主进程
// 打开 app.html（单文件应用），并注入 window.jpcExport：逐帧渲染 + 离线配音 + 调用本机 ffmpeg 直接出 MP4。
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

let win = null;

// 无人值守自检：SET JPC_SELFTEST=1 → 启动后自动做一次导出并输出结果（供自动化验收使用）
const SELFTEST = process.env.JPC_SELFTEST === '1';
const SELFTEST_OUT = process.env.JPC_SELFTEST_OUT || path.join(__dirname, 'selftest.mp4');

function findFfmpeg() {
  const cands = [];
  if (process.env.JPC_FFMPEG) cands.push(process.env.JPC_FFMPEG);
  const res = path.join(process.resourcesPath, 'ffmpeg.exe');
  cands.push(res);
  cands.push(path.join(__dirname, 'ffmpeg.exe'));
  cands.push(path.join(__dirname, '..', 'ffmpeg.exe'));
  // winget 安装位置
  const base = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
  try {
    for (const d of fs.readdirSync(base)) {
      if (!/FFmpeg/i.test(d)) continue;
      const sub = path.join(base, d);
      for (const v of fs.readdirSync(sub)) cands.push(path.join(sub, v, 'bin', 'ffmpeg.exe'));
    }
  } catch (e) { /* ignore */ }
  for (const c of cands) { try { if (c && fs.existsSync(c)) return c; } catch (e) { /* ignore */ } }
  return null;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0f1116',
    title: '讲解成片 v1.0',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: false, nodeIntegration: true, backgroundThrottling: false },
  });
  win.loadFile(path.join(__dirname, 'app.html'));
  if (SELFTEST) {
    const logline = (s) => { try { fs.appendFileSync(path.join(path.dirname(SELFTEST_OUT), 'selftest-log.txt'), s + '\n'); } catch (e) { /* ignore */ } };
    win.webContents.on('did-fail-load', (e, code, desc) => logline('FAIL LOAD ' + code + ' ' + desc));
    win.webContents.on('console-message', (e, level, msg) => logline('CONSOLE ' + msg));
    win.webContents.on('did-finish-load', () => {
      logline('LOADED');
      setTimeout(async () => {
        try {
          const info = await win.webContents.executeJavaScript('({slides: window.JPC_APP.State.project.slides.length, hasExport: typeof window.jpcExport})');
          logline('info ' + JSON.stringify(info));
          await doExport(null, null, 30, SELFTEST_OUT);
          logline('OK ' + SELFTEST_OUT);
        } catch (e) {
          logline('FAIL ' + (e && e.message ? e.message : e));
        }
        app.exit(0);
      }, 1200);
    });
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

/* ---------------- 导出 MP4 ---------------- */
ipcMain.handle('jpc:export', async (ev, payload) => {
  const { project, timeline, fps } = payload;
  const FF = findFfmpeg();
  if (!FF) throw new Error('未找到 FFmpeg。请把 ffmpeg.exe 放到程序目录，或设置环境变量 JPC_FFMPEG。');

  const send = (p, msg) => { try { ev.sender.send('jpc:progress', { p, msg }); } catch (e) { /* ignore */ } };

  let filePath;
  if (SELFTEST) {
    filePath = SELFTEST_OUT;
  } else {
    const r = await dialog.showSaveDialog(win, {
      title: '导出成片',
      defaultPath: (project.title || '讲解') + '.mp4',
      filters: [{ name: 'MP4 视频', extensions: ['mp4'] }],
    });
    filePath = r.filePath;
    if (!filePath) return { canceled: true };
  }
  return doExport(send, project, timeline, fps, filePath);
});

async function doExport(send, project, timeline, fps, filePath) {
  send = send || function () {};
  fps = fps || 30;
  const FF = findFfmpeg();
  if (!FF) throw new Error('未找到 FFmpeg');
  // 自检模式：从渲染进程取真实项目与时间轴
  if (!timeline) {
    const data = await win.webContents.executeJavaScript('({p: window.JPC_APP.State.project, tl: window.JPC_APP.State.timeline || null})');
    project = data.p;
    const total = await win.webContents.executeJavaScript('window.JPC_APP.getTimeline().total');
    timeline = JSON.parse(await win.webContents.executeJavaScript('JSON.stringify(window.JPC_APP.getTimeline())'));
    timeline.total = total;
    filePath = filePath || SELFTEST_OUT;
  }

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'jpc-'));
  const framesDir = path.join(work, 'frames');
  fs.mkdirSync(framesDir, { recursive: true });

  try {
    const total = Math.ceil(timeline.total * fps);
    send(0, '开始逐帧渲染（' + total + ' 帧）');
    // 在渲染进程里逐帧导出 PNG
    for (let f = 0; f < total; f++) {
      const dataUrl = await win.webContents.executeJavaScript('window.__jpcDrawFrame(' + f + ')');
      const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      fs.writeFileSync(path.join(framesDir, 'f' + String(f).padStart(5, '0') + '.png'), Buffer.from(b64, 'base64'));
      if (f % 15 === 0) send(0.02 + 0.6 * (f / total), '渲染帧 ' + f + '/' + total);
    }

    send(0.63, '合成离线配音');
    const wavBytes = await win.webContents.executeJavaScript('window.__jpcMakeAudio()');
    const wavPath = path.join(work, 'voice.wav');
    fs.writeFileSync(wavPath, Buffer.from(wavBytes));

    send(0.72, '调用 FFmpeg 合成 1080P 视频');
    await new Promise((resolve, reject) => {
      const args = [
        '-y', '-framerate', String(fps), '-i', path.join(framesDir, 'f%05d.png'),
        '-i', wavPath,
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium',
        '-c:a', 'aac', '-b:a', '128k', '-shortest', '-t', timeline.total.toFixed(2),
        filePath,
      ];
      const ff = cp.spawn(FF, args, { windowsHide: true });
      let err = '';
      ff.stderr.on('data', (d) => { err += d.toString(); const m = /frame=\s*(\d+)/g; });
      ff.on('error', reject);
      ff.on('close', (code) => { if (code === 0) resolve(); else reject(new Error('FFmpeg 失败（' + code + '）：' + err.slice(-400))); });
    });

    send(1, '完成：' + filePath);
    return { ok: true, filePath };
  } finally {
    try { fs.rmSync(work, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  }
}

ipcMain.handle('jpc:diff', () => ({ ok: true }));