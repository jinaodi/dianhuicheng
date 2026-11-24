// 在 Node 中加载渲染引擎（供测试/海报生成用）
const fs = require('fs');
const vm = require('vm');
const path = require('path');

module.exports = function loadEngine() {
  const dir = path.join(__dirname, '..', 'src', 'engine');
  const ctx = { console, Math, Date, JSON, Object, String, Number, Array, Float32Array, Uint8Array, ArrayBuffer, DataView, setTimeout, Int16Array, Error };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['packet.js', 'timeline.js', 'pinyin-data.js', 'voice.js', 'backgrounds.js']) {
    const fp = path.join(dir, f);
    if (!fs.existsSync(fp)) continue;
    vm.runInContext(fs.readFileSync(fp, 'utf8'), ctx, { filename: f });
  }
  return ctx.Jpc;
};