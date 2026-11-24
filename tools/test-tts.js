// 离线试听：生成音频并输出 WAV用于评估可懂度与自然度
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const dir = path.join(__dirname, '..', 'src', 'engine');
const ctx = { console, Math, Date, JSON, Float32Array, Uint8Array, ArrayBuffer, DataView, Object, String, Number, Array, setTimeout };
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['packet.js', 'timeline.js', 'pinyin-data.js', 'voice.js']) {
  const fp = path.join(dir, f);
  if (!fs.existsSync(fp)) continue;
  vm.runInContext(fs.readFileSync(fp, 'utf8'), ctx, { filename: f });
}
const J = ctx.Jpc;
const text = process.argv[2] || '\u5927\u5bb6\u597d\uff0c\u6211\u662f\u8bb2\u89e3\u6210\u7247\u3002\u4eca\u5929\u7528\u4e09\u5341\u79d2\uff0c\u628a\u4e00\u4efd\u4e8c\u5341\u9875\u7684\u62a5\u544a\u53d8\u6210\u4e00\u6761\u80fd\u770b\u7684\u89c6\u9891\u3002';
const rate = Number(process.argv[4] || 1);
const gender = process.argv[5] || 'female';
console.log('tokens:', J.tokenize(text).slice(0, 16).map((t) => t.ch + '=' + t.py).join(' '));
const t0 = Date.now();
const sentences = J.splitSentences(text).map((t) => ({ kind: 'text', text: t }));
const out = J.synthSpeech(sentences, { gender, rate });
console.log('synth ms', Date.now() - t0, 'dur', (out.samples.length / J.SR).toFixed(2) + 's');
let peak = 0; let rms = 0;
for (let i = 0; i < out.samples.length; i++) { peak = Math.max(peak, Math.abs(out.samples[i])); rms += out.samples[i] * out.samples[i]; }
console.log('peak', peak.toFixed(3), 'rms', Math.sqrt(rms / out.samples.length).toFixed(4));
const wav = J.toWav16(out.samples, J.SR);
const dest = path.join(__dirname, '..', 'shots', process.argv[3] || 'tts-test.wav');
fs.writeFileSync(dest, Buffer.from(wav));
console.log('wrote', dest);