// 校验三个版本快照都能打开、能渲染，并各截一张图用于对比
const { chromium } = require('playwright');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VERS = ['v0.1/讲解成片_v0.1.html', 'v0.9/讲解成片_v0.9.html', 'v1.0/讲解成片_v1.0.html'];

(async () => {
  const b = await chromium.launch();
  for (const v of VERS) {
    const file = 'file:///' + path.join(ROOT, '参赛作品_讲解成片', '02_过程材料', '版本记录', v).replace(/\\/g, '/');
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(String(e)));
    await p.goto(file);
    await p.waitForTimeout(1200);
    const info = await p.evaluate(() => ({
      slides: window.JPC_APP.State.project.slides.length,
      themeCount: (document.querySelectorAll('.theme') || []).length,
      total: Math.round(window.JPC_APP.getTimeline().total * 10) / 10,
    }));
    await p.evaluate(() => window.JPC_APP.go(2));
    await p.waitForTimeout(500);
    const tag = v.split('/')[0];
    await p.screenshot({ path: path.join(ROOT, 'shots', 'ver_' + tag + '.png') });
    console.log(tag, JSON.stringify(info), 'errors:', errs.length ? errs.join('|') : 'none');
    await ctx.close();
  }
  await b.close();
})();