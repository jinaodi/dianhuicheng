const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs=[]; p.on('pageerror', e=>errs.push(e.message)); p.on('console', m=>{ if(m.type()==='error') errs.push(m.text()); });
  await p.goto('file:///' + process.argv[2].replace(/\\/g,'/'));
  await p.waitForTimeout(800);
  const info = await p.evaluate(() => {
    const S = window.JPC_APP.State;
    return { n: S.project.slides.length, slides: S.project.slides.map(s=>({layout:s.layout,title:s.title,body:(s.body||'').slice(0,20),bul:s.bullets,stats:s.stats})) };
  });
  console.log(JSON.stringify(info,null,1)); console.log('errs', errs);
  await b.close();
})();
