// 用 Chromium 把示例项目逐页渲染成 1920x1080 PNG（用于评审材料 / 回归检查）
// node tools/poster.js [sampleId] [outDir]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const sample = process.argv[2] || 'pitch';
  const outDir = process.argv[3] || path.join(__dirname, '..', 'shots', 'posters-' + sample);
  fs.mkdirSync(outDir, { recursive: true });
  const root = path.join(__dirname, '..').replace(/\\/g, '/');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file:///' + root + '/src/app/index.html');
  await page.waitForTimeout(600);
  await page.evaluate((id) => { window.JPC_APP.loadSample(id); }, sample);
  await page.waitForTimeout(400);
  const data = await page.evaluate(() => {
    const S = window.JPC_APP.State;
    const out = [];
    const tl = Jpc.buildTimeline(S.project, {});
    S.project.slides.forEach((slide, i) => {
      const cv = document.createElement('canvas');
      cv.width = 1920; cv.height = 1080;
      const ctx = cv.getContext('2d');
      Jpc.drawSlide(ctx, S.project, slide, 3.2, 0, { bullet: 0 });
      const idx = tl.slides[i].firstCue;
      const t = tl.cues[idx] ? (tl.cues[idx].start + tl.cues[idx].end) / 2 : 1;
      const cap = Jpc.captionFor(tl, t, S.project.style.caption.maxLines);
      const cap2 = Jpc.captionFor(tl, tl.slides[i].out - 0.05, S.project.style.caption.maxLines);
      if (S.project.style.caption.show !== false) Jpc.drawCaption(ctx, cap.text, S.project.style, Jpc.paletteOf(S.project));
      Jpc.drawBrand(ctx, S.project, t);
      out.push(cv.toDataURL('image/png'));
    });
    return out;
  });
  data.forEach((d, i) => {
    const b64 = d.split(',')[1];
    fs.writeFileSync(path.join(outDir, String(i + 1).padStart(2, '0') + '.png'), Buffer.from(b64, 'base64'));
  });
  console.log('posters', data.length, 'errors', errs);
  await browser.close();
})();