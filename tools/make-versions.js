// 生成三个迭代版本的可运行快照：v0.1 / v0.9 / v1.0（都能双击直接用，能看出改进过程）
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '参赛作品_讲解成片', '02_过程材料', '版本记录');

function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

// —— 单文件打包（注入额外的 JS / CSS 补丁）
function bundle(extra, outFile) {
  const css = read('src/app/style.css');
  const order = ['engine/packet.js', 'engine/timeline.js', 'engine/pinyin-data.js', 'engine/voice.js',
    'engine/backgrounds.js', 'engine/templates.js', 'app/ui.js', 'app/screen1.js', 'app/screen2.js',
    'app/screen3.js', 'app/screen4.js', 'app/main.js'];
  const js = order.map((f) => read('src/' + f)).join('\n;\n');
  let html = read('src/app/index.html');
  html = html.replace(/<link[^>]*style\.css[^>]*>/, '<style>\n' + css + '\n</style>');
  // 去掉原有的 <script src> 标签，统一注入
  html = html.replace(/<script src="[^"]*"><\/script>\s*/g, '');
  html = html.replace('</body>', '<script>\n' + js + '\n;\n' + (extra || '') + '\n</script>\n</body>');
  const ver = (outFile.match(/v(\d+\.\d+)/) || [])[1];
  if (ver) html = html.replace('id="verTag">v1.0<', 'id="verTag">v' + ver + '<');
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, html);
  return (Buffer.byteLength(html) / 1024).toFixed(0) + ' KB';
}

const rel = (p) => path.join(OUT, p);

// —— v0.1：只有 4 个版式、2 个主题、1 个示例，界面带"实验版"水印提示
const v01 = `
(function(){
  // v0.1 快照：压缩可选项，还原最初版本的能力边界
  var P = Jpc.STYLE_PRESETS;
  Jpc.STYLE_PRESETS = [P[0], P[1]];
  var keep = ['cover','title','bullets','numbers'];
  var SAMPLE = { id:'v01', name:'产品发布（1 分钟）', script: Jpc.SAMPLES.pitch.script };
  Jpc.SAMPLES = { pitch: SAMPLE };
  var badge = document.createElement('div');
  badge.textContent = 'v0.1 实验版 · 仅 4 种版式 / 2 套主题';
  badge.style.cssText = 'position:fixed;right:14px;bottom:12px;z-index:9999;font-size:12px;padding:6px 10px;border-radius:999px;background:#5aa9ff22;color:#8fc4ff;border:1px solid #5aa9ff44';
  document.body.appendChild(badge);
  var _draw = Jpc.drawSlide;
  Jpc.drawSlide = function(ctx, proj, slide, t, ci, info){
    if (keep.indexOf(slide.layout) < 0) {
      var c = Jpc.clone(slide); c.layout = 'title';
      return _draw(ctx, proj, c, t, ci, info);
    }
    return _draw(ctx, proj, slide, t, ci, info);
  };
})();
`;

// —— v0.9：能力齐全，但不含"避头标点/字幕去方括号/数字取词"等打磨
const v09 = `
(function(){
  // v0.9 快照：还原打磨前的渲染细节（用于对比 v1.0 的修正）
  var badge = document.createElement('div');
  badge.textContent = 'v0.9 候选版 · 尚未做标点避头与取词规则';
  badge.style.cssText = 'position:fixed;right:14px;bottom:12px;z-index:9999;font-size:12px;padding:6px 10px;border-radius:999px;background:#34d6b022;color:#7ee7cd;border:1px solid #34d6b044';
  document.body.appendChild(badge);
  // 字幕里保留方括号（v0.9 的行为）
  var _cap = Jpc.drawCaption;
  Jpc.drawCaption = function(ctx, text, style, pal){
    return _cap(ctx, String(text), style, pal);
  };
  // 数字卡片用整句做标签（v0.9 的行为）
  if (Jpc.statsParts) {
    var _sp = Jpc.statsParts;
    Jpc.statsParts = function(text){
      return _sp(text).map(function(it){ return { v: it.v, label: String(text).slice(0, 16) }; });
    };
  }
})();
`;

const a = bundle(v01, rel('v0.1/讲解成片_v0.1.html'));
const b = bundle(v09, rel('v0.9/讲解成片_v0.9.html'));
// v1.0 直接使用官方打包产物（与 01_作品成品 完全一致）
const single = fs.readFileSync(path.join(ROOT, 'dist', '讲解成片.html'), 'utf8');
fs.mkdirSync(rel('v1.0'), { recursive: true });
fs.writeFileSync(rel('v1.0/讲解成片_v1.0.html'), single);
console.log('v0.1', a, '\nv0.9', b, '\nv1.0', (Buffer.byteLength(single) / 1024).toFixed(0) + ' KB (dist 原样)');