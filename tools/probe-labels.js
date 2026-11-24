// 临时探针：测试不同的“数字卡片说明”抽取规则
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const root = path.join(__dirname, '..').replace(/\\/g, '/');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file:///' + root + '/src/app/index.html');
  await page.waitForTimeout(500);
  const out = await page.evaluate(() => {
    const NUM = /(\d+(?:\.\d+)?\s*(?:%|倍|元|万|人|次|页|分钟|秒|小时|天|家|个|字))/g;
    const FUNC = '的了在是为到让把和与约就都要会能有从对由及但也还只才更最再又并而则这那你我他它们每支段组条张多少近共全总';
    function pick(raw) {
      const src = String(raw || '').replace(/[的了是在为到]?[，,。；：、！？\s].*$/, '');
      let last = 0;
      for (let i = 0; i < src.length; i++) if (FUNC.indexOf(src[i]) >= 0) last = i + 1;
      let tail = src.slice(last);
      if (tail.length < 2) return src.slice(-6);
      return tail.slice(-7);
    }
    const res = {};
    for (const id of ['pitch', 'report', 'course']) {
      const slides = Jpc.buildSlides(Jpc.SAMPLES[id].script);
      res[id] = slides.filter((s) => s.body).map((s) => {
        const body = s.body;
        const items = [];
        let m;
        const re = new RegExp(NUM.source, 'g');
        while ((m = re.exec(body)) && items.length < 3) {
          const i = m.index;
          const src = body.slice(Math.max(0, i - 20), i);
          const sub = body.slice(Math.max(0, i - 20), i);
          const lastSep = Math.max.apply(null, ['，', ',', '。', '；', '：', '、', '\n'].map((c) => sub.lastIndexOf(c)));
          const clause = sub.slice(lastSep + 1);
          items.push(m[1].replace(/\s/g, '') + ' / ' + pick(clause) + '   〔' + clause + '〕');
        }
        return [s.title, items];
      });
    }
    return res;
  });
  for (const k of Object.keys(out)) { console.log('==', k); out[k].forEach((r) => { console.log(' ', r[0]); r[1].forEach((x) => console.log('    ', x)); }); }
  await browser.close();
})();