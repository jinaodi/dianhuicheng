// 单文件应用 UI 截图：四步各一张（v1.0 交付用）
const { chromium } = require('playwright');
const path = require('path');

const FILE = 'file:///' + path.join(__dirname, '..', 'dist', '讲解成片.html').replace(/\\/g, '/');
const OUT = path.join(__dirname, '..', 'shots');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(FILE);
  await p.waitForTimeout(900);

  const steps = ['稿子', '风格', '点播', '导出'];
  for (let i = 1; i <= 4; i++) {
    await p.evaluate((n) => window.JPC_APP.go(n), i);
    await p.waitForTimeout(i === 3 ? 1400 : 800);
    await p.screenshot({ path: path.join(OUT, 'ui_v10_s' + i + '.png') });
  }
  console.log('UI 截图完成：4 张，pageerror ' + errs.length);
  await b.close();
})();