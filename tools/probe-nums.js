// 临时探针：打印示例稿子被解析出的数字卡片（用于核对文案）
const load = require('./load.js');
const J = load();
const vm = require('vm');
const fs = require('fs');
const path = require('path');

(async () => {
  const { chromium } = require('playwright');
  const root = path.join(__dirname, '..').replace(/\\/g, '/');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file:///' + root + '/src/app/index.html');
  await page.waitForTimeout(500);
  const out = await page.evaluate(() => {
    const res = {};
    for (const id of ['pitch', 'report', 'course']) {
      const s = Jpc.SAMPLES[id];
      const slides = Jpc.buildSlides(s.script);
      res[id] = slides.map((x) => ({ layout: x.layout, title: x.title, stats: x.stats, body: (x.body || '').slice(0, 40) }));
    }
    return res;
  });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})();