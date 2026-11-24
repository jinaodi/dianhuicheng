// 合成语音信号体检：把 WAV 切成小段频谱图，用于判断是否有清晰可辨的共振峰与音节边界
const fs = require('fs');
const path = require('path');

function readWav(p) {
  const b = fs.readFileSync(p);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let pos = 12, sr = 16000, bits = 16, ch = 1, data = null;
  while (pos < v.byteLength - 8) {
    const id = String.fromCharCode(v.getUint8(pos), v.getUint8(pos + 1), v.getUint8(pos + 2), v.getUint8(pos + 3));
    const size = v.getUint32(pos + 4, true);
    if (id === 'fmt ') { ch = v.getUint16(pos + 10, true); sr = v.getUint32(pos + 12, true); bits = v.getUint16(pos + 22, true); }
    if (id === 'data') {
      const n = Math.floor(size / ((bits / 8) * ch));
      data = new Float32Array(n);
      for (let i = 0; i < n; i++) data[i] = v.getInt16(pos + 8 + i * (bits / 8) * ch, true) / 32768;
      break;
    }
    pos += 8 + size + (size % 2);
  }
  return { sr, data };
}

// 简易 FFT（基 2）
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
        const vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
      }
    }
  }
}

const p = process.argv[2];
const { sr, data } = readWav(p);
const N = 1024;
const hop = N / 2;
const frames = [];
for (let s = 0; s + N < data.length; s += hop) {
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = data[s + i] * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (N - 1)));
  fft(re, im);
  const mag = new Float64Array(N / 2);
  for (let k = 0; k < N / 2; k++) mag[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
  // 找能量最高的两个共振峰（忽略 0-250Hz 基频区）
  const peaks = [];
  const lo = Math.round((250 / sr) * N), hi = Math.round((3400 / sr) * N);
  for (let k = lo + 2; k < hi - 2; k++) {
    if (mag[k] > mag[k - 1] && mag[k] > mag[k + 1] && mag[k] > mag[k - 2] && mag[k] > mag[k + 2]) peaks.push({ f: Math.round((k * sr) / N), m: mag[k] });
  }
  peaks.sort((a, b) => b.m - a.m);
  const rms = Math.sqrt(data.slice(s, s + N).reduce((a, x) => a + x * x, 0) / N);
  frames.push({ t: +(s / sr).toFixed(2), rms: +rms.toFixed(4), peaks: peaks.slice(0, 3).map((x) => x.f) });
}
const voiced = frames.filter((f) => f.rms > 0.02);
const f1s = voiced.map((f) => f.peaks[0] || 0).filter(Boolean);
const avg = (a) => (a.reduce((x, y) => x + y, 0) / (a.length || 1));
console.log('时长 ' + (data.length / sr).toFixed(1) + 's，帧数 ' + frames.length + '，有声帧 ' + voiced.length + '（' + Math.round((100 * voiced.length) / frames.length) + '%）');
console.log('F1 均值 ' + Math.round(avg(f1s)) + ' Hz，范围 ' + Math.min(...f1s) + '~' + Math.max(...f1s) + ' Hz（变化越丰富说明元音越可辨）');
console.log('示例帧：' + JSON.stringify(frames.filter((f, i) => i % Math.ceil(frames.length / 12) === 0).map((f) => [f.t, f.rms, f.peaks.join('/')])));