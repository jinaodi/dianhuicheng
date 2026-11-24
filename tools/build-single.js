// 讲解成片 · 单文件构建：把所有 JS/CSS 内联进一个 HTML，双击即用、完全离线
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const app = path.join(root, 'src', 'app');

let html = fs.readFileSync(path.join(app, 'index.html'), 'utf8');

// CSS
html = html.replace(/<link rel="stylesheet" href="([^"]+)"\s*\/?>/, (m, href) => {
  const css = fs.readFileSync(path.join(app, href), 'utf8');
  return '<style>\n' + css + '\n</style>';
});

// JS（顺序保持原样）
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const fp = path.resolve(app, src);
  const code = fs.readFileSync(fp, 'utf8');
  return '<script>\n/* ---- ' + path.basename(fp) + ' ---- */\n' + code + '\n</script>';
});

const outDir = process.argv[2] || path.join(root, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, process.argv[3] || '讲解成片.html');
fs.writeFileSync(out, html, 'utf8');
const kb = (fs.statSync(out).size / 1024).toFixed(0);
console.log('已生成单文件：' + out + '（' + kb + ' KB）');