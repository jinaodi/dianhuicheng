// 桌面版自动化验收：启动 Electron → 等待就绪 → 保存日志 → 退出
const { _electron } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const env = Object.assign({}, process.env);
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({
    args: [path.resolve(__dirname, '..', 'desktop')],
    env,
  });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push(String(e)));
  await win.waitForTimeout(2500);
  const info = await win.evaluate(() => ({
    slides: window.JPC_APP.State.project.slides.length,
    hasExport: typeof window.jpcExport,
    hasDraw: typeof window.__jpcDrawFrame,
    hasAudio: typeof window.__jpcMakeAudio,
  }));
  console.log('desktop:', JSON.stringify(info), 'errors:', errs.length ? errs.join('|') : 'none');

  // 逐帧渲染 + 配音自检（不弹保存框）
  const probe = await win.evaluate(() => {
    const a = window.__jpcMakeAudio();
    const d = window.__jpcDrawFrame(120);
    return { audioBytes: a.length, frameOk: d.slice(0, 22), frameLen: d.length };
  });
  console.log('probe:', JSON.stringify(probe));
  await win.screenshot({ path: path.join(__dirname, '..', 'shots', 'desktop.png') });
  fs.writeFileSync(path.join(__dirname, '..', 'shots', 'desktop_check.json'), JSON.stringify({ info, probe, errs }, null, 2));
  await app.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });