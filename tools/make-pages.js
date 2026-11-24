// 生成 GitHub Pages 在线演示：不用下载，直接打开网页就能用
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs');
fs.mkdirSync(OUT, { recursive: true });

let html = fs.readFileSync(path.join(ROOT, 'dist', '讲解成片.html'), 'utf8');
// 在线版加一条提示条（说明这是网页演示，离线单文件在 Release 里）
const banner = `
<div id="onlineTip" style="position:fixed;left:50%;bottom:74px;transform:translateX(-50%);z-index:9998;font-size:13px;line-height:1.5;padding:10px 16px;border-radius:10px;background:#1b2130ee;color:#cfd8e6;border:1px solid #2b3446;box-shadow:0 8px 30px #0008;max-width:760px">
  <b style="color:#8fc4ff">在线演示版</b> · 全部计算都在你自己的浏览器里跑，不上传任何内容。
  <a href="https://github.com/jinaodi/dianhuicheng" style="color:#8fc4ff">下载离线单文件版</a>（断网也能用） · <span style="cursor:pointer" onclick="document.getElementById('onlineTip').remove()">知道了</span>
</div>`;
html = html.replace('</body>', banner + '\n</body>');
fs.writeFileSync(path.join(OUT, 'index.html'), html);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
console.log('docs/index.html', (fs.statSync(path.join(OUT, 'index.html')).size / 1024).toFixed(0) + ' KB');