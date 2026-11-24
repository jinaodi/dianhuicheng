// 截屏工具：node tools/shot.js [url] [outPrefix] [steps...]
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const url = process.argv[2] || 'file:///' + path.join(__dirname, '..', 'src', 'app', 'index.html').replace(/\\/g, '/');
  const out = process.argv[3] || path.join(__dirname, '..', 'shots', 'app');
  const steps = process.argv.slice(4);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  await page.goto(url);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: out + '_1.png' });
  for (const s of steps) {
    if (s.startsWith('click:')) { await page.click(s.slice(6)); await page.waitForTimeout(800); }
    else if (s.startsWith('wait:')) { await page.waitForTimeout(Number(s.slice(5))); }
    else if (s.startsWith('eval:')) { await page.evaluate(s.slice(5)); await page.waitForTimeout(600); }
    else if (s.startsWith('shot:')) { await page.screenshot({ path: out + '_' + s.slice(5) + '.png' }); }
  }
  console.log('errors:', JSON.stringify(errs, null, 1));
  await browser.close();
})();