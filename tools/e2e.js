// 单文件应用端到端自测：四步 + 配音 + 导出素材包（拦截下载）
const { chromium } = require('playwright');
const path = require('path');

const FILE = 'file:///' + path.join(__dirname, '..', 'dist', '讲解成片.html').replace(/\\/g, '/');

(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  const downloads = [];
  p.on('download', async (d) => {
    const fp = await d.path();
    downloads.push({ name: d.suggestedFilename(), size: fp ? require('fs').statSync(fp).size : 0 });
  });
  await p.goto(FILE);
  await p.waitForTimeout(1000);

  // 1. 编辑分镜
  await p.evaluate(() => window.JPC_APP.go(1));
  await p.waitForTimeout(400);
  // 2. 风格：换主题
  await p.evaluate(() => window.JPC_APP.go(2));
  await p.waitForTimeout(400);
  // 3. 播放 3 秒
  await p.evaluate(() => window.JPC_APP.go(3));
  await p.waitForTimeout(600);
  await p.evaluate(() => window.Screen3.toggle());
  await p.waitForTimeout(3000);
  await p.screenshot({ path: path.join(__dirname, '..', 'shots', 'e2e_playing.png') });
  await p.evaluate(() => window.Screen3.stop());
  // 4. 导出素材包
  await p.evaluate(() => window.JPC_APP.go(4));
  await p.waitForTimeout(500);
  await p.click('button.primary');
  await p.waitForTimeout(9000);
  console.log('pageerrors:', errs.length ? errs.join(' | ') : 'none');
  console.log('downloads:', JSON.stringify(downloads));
  await b.close();
})();