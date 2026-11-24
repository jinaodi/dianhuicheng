// 渲染“卡片导出版式”静态图：node tools/cards.js [outDir]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const outDir = process.argv[2] || path.join(__dirname, '..', 'shots', 'cards');
  fs.mkdirSync(outDir, { recursive: true });
  const root = path.join(__dirname, '..').replace(/\\/g, '/');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file:///' + root + '/src/app/index.html');
  await page.waitForTimeout(600);
  const n = await page.evaluate(() => Jpc.CARD_SLIDE_COUNT);
  for (let i = 0; i < n; i++) {
    const data = await page.evaluate((idx) => {
      const cv = document.createElement('canvas');
      cv.width = 1920; cv.height = 1080;
      const ctx = cv.getContext('2d');
      Jpc.renderCardSlide(ctx, idx);
      return cv.toDataURL('image/png');
    }, i);
    const buf = Buffer.from(data.split(',')[1], 'base64');
    fs.writeFileSync(path.join(outDir, '0' + (i + 1) + '.png'), buf);
  }
  console.log('cards', n, 'errors', JSON.stringify(errs));
  await browser.close();
})();