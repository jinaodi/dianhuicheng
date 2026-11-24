/* 讲解成片 · 语音层
 * 在线：调用系统 / 云端 TTS（返回 WAV），由主进程解码后注入
 * 离线：内置“合成人声”引擎 —— 声门脉冲源 + 三共振峰级联滤波 + 中文声调曲线 + 韵律停顿
 * 两条路径输出同一种 Float32 单声道音频，后处理（去爆音、响度归一、淡入淡出）完全共享。
 */
(function (root) {
  'use strict';

  const SR = 24000;

  /* ===================== 1. 中文 → 拼音 ===================== */
  let PINYIN = {};
  const POLY = {
    行: { 银行: 'hang2', 行业: 'hang2', 一行: 'hang2', 排行: 'hang2', 行情: 'hang2', 发行: 'xing2', 行走: 'xing2', 步行: 'xing2' },
    重: { 重要: 'zhong4', 重视: 'zhong4', 重量: 'zhong4', 重复: 'chong2', 重启: 'chong2', 重新: 'chong2' },
    长: { 长度: 'chang2', 时长: 'chang2', 增长: 'chang2', 成长: 'chang2', 长期: 'chang2', 长按: 'chang2', 长大: 'zhang3', 校长: 'zhang3', 成长: 'cheng2zhang3' },
    了: { 了解: 'liao3', 为了: 'le5', 好了: 'le5' },
    地: { 地方: 'di4', 地点: 'di4', 地区: 'di4', 地图: 'di4', 地址: 'di4', 地面: 'di4', 自动地: 'de5' },
    得: { 得到: 'de2', 得分: 'de2', 心得: 'de2', 觉得: 'de5', 显得: 'de5', 讲得: 'de5' },
    为: { 因为: 'wei4', 为了: 'wei4', 为什么: 'wei4', 作为: 'wei2', 成为: 'wei2', 认为: 'wei2', 行为: 'wei2', 为主: 'wei2' },
    还: { 还有: 'hai2', 还是: 'hai2', 还要: 'hai2', 归还: 'huan2' },
    角: { 角色: 'jue2', 主角: 'jue2', 角度: 'jiao3' },
    数: { 数据: 'shu4', 数量: 'shu4', 数字: 'shu4', 数学: 'shu4', 无数: 'shu4', 少数: 'shu4', 数一数: 'shu3' },
    率: { 效率: 'lv4', 概率: 'lv4', 频率: 'lv4', 成功率: 'lv4', 速率: 'lv4' },
    散: { 散步: 'san4', 散开: 'san4', 分散: 'san4', 散文: 'san3' },
    强: { 强大: 'qiang2', 强调: 'qiang2', 强制: 'qiang2', 勉强: 'qiang3' },
    调: { 调整: 'tiao2', 调节: 'tiao2', 声调: 'diao4', 调查: 'diao4' },
    处: { 处理: 'chu3', 处于: 'chu3', 好处: 'chu4', 到处: 'chu4' },
    空: { 空白: 'kong4', 空闲: 'kong4', 空间: 'kong1', 空气: 'kong1' },
    系: { 系统: 'xi4', 关系: 'xi4', 联系: 'xi4' },
    便: { 方便: 'bian4', 便利: 'bian4', 便宜: 'pian2' },
    应: { 应该: 'ying1', 响应: 'ying4', 应用: 'ying4', 对应: 'ying4', 回应: 'ying4' },
    号: { 号码: 'hao4', 编号: 'hao4', 号召: 'hao4' },
    发: { 发布: 'fa1', 发现: 'fa1', 发展: 'fa1', 头发: 'fa4' },
    少: { 减少: 'shao3', 多少: 'shao3', 少年: 'shao4' },
    转: { 转发: 'zhuan3', 转换: 'zhuan3', 转动: 'zhuan4', 旋转: 'zhuan4' },
    载: { 下载: 'zai4', 记载: 'zai3', 承载: 'zai4', 装载: 'zai4' },
    种: { 种类: 'zhong3', 种子: 'zhong3', 种植: 'zhong4' },
    藏: { 收藏: 'cang2', 隐藏: 'cang2', 西藏: 'zang4' },
    切: { 切换: 'qie1', 一切: 'qie4', 切开: 'qie1' },
    录: { 录制: 'lu4', 录音: 'lu4', 目录: 'lu4' },
    和: { 和平: 'he2', 和谐: 'he2' },
    朝: { 朝向: 'chao2', 王朝: 'chao2', 朝阳: 'zhao1' },
    都: { 都是: 'dou1', 都市: 'du1', 首都: 'du1' },
    要: { 要点: 'yao4', 要求: 'yao1' },
    给: { 给谁: 'gei3' },
    着: { 着手: 'zhuo2', 着重: 'zhuo2', 看着: 'zhe5', 跟着: 'zhe5' },
  };

  function resolveChar(ch, text, i) {
    const poly = POLY[ch];
    if (poly) {
      for (const key in poly) {
        const at = text.indexOf(key);
        if (at >= 0 && i >= at && i < at + key.length) {
          // 连续两字读音的情况（如“成长”）
          if (poly[key].length > 5 && i === at + 1) return poly[key].slice(4);
          if (poly[key].length > 5) return poly[key].slice(0, 4);
          return poly[key];
        }
      }
    }
    const v = PINYIN[ch];
    if (!v) return null;
    return Array.isArray(v) ? v[0] : v;
  }

  function setPinyin(map) { PINYIN = map || {}; }
  function getMap() {
    if (PINYIN && Object.keys(PINYIN).length) return PINYIN;
    if (root.Jpc && root.Jpc.PINYIN_MAP) return (PINYIN = root.Jpc.PINYIN_MAP);
    return {};
  }

  function tokenize(text) {
    getMap();
    const out = [];
    for (let i = 0; i < text.length; i++) out.push({ ch: text[i], py: resolveChar(text[i], text, i) });
    return out;
  }

  /* ===================== 2. 音系参数 ===================== */
  const VOWEL = {
    a: [880, 1480, 2900], o: [540, 900, 2600], e: [500, 1380, 2700], eh: [470, 1120, 2650],
    i: [300, 2500, 3300], u: [340, 780, 2350], v: [310, 1820, 2500], ap: [420, 1450, 2700],
    n: [270, 1450, 2550], ng: [290, 1250, 2300], er: [520, 1450, 1850],
  };

  function splitPinyin(py) {
    const m = /^([a-z]+)([1-5])?$/.exec(String(py || ''));
    if (!m) return null;
    return { base: m[1], tone: m[2] ? Number(m[2]) : 5 };
  }

  function initialOf(base) {
    for (const t of ['zh', 'ch', 'sh']) if (base.startsWith(t)) return { s: t, rest: base.slice(2) };
    for (const t of 'bpmfdtnlgkhjqxrzcsyw'.split('')) if (base.startsWith(t)) return { s: t, rest: base.slice(1) };
    return { s: '', rest: base };
  }

  function finalVowels(f, ini) {
    f = f.replace(/^v/, 'v');
    // 舌尖元音：zi ci si / zhi chi shi ri 中的 i
    if (f === 'i' && ['z', 'c', 's', 'zh', 'ch', 'sh', 'r'].includes(ini)) return ['ap'];
    const map = {
      a: ['a'], o: ['o'], e: ['e'], ai: ['a', 'i'], ei: ['eh', 'i'], ao: ['a', 'o'], ou: ['o', 'u'],
      an: ['a', 'n'], en: ['e', 'n'], ang: ['a', 'ng'], eng: ['e', 'ng'], ong: ['o', 'ng'],
      i: ['i'], ia: ['i', 'a'], ie: ['i', 'eh'], iao: ['i', 'a', 'o'], iou: ['i', 'o', 'u'], iu: ['i', 'o', 'u'],
      ian: ['i', 'eh', 'n'], in: ['i', 'n'], iang: ['i', 'a', 'ng'], ing: ['i', 'ng'], iong: ['i', 'o', 'ng'],
      u: ['u'], ua: ['u', 'a'], uo: ['u', 'o'], uai: ['u', 'a', 'i'], ui: ['u', 'eh', 'i'], uan: ['u', 'a', 'n'],
      un: ['u', 'e', 'n'], uang: ['u', 'a', 'ng'], ueng: ['u', 'e', 'ng'],
      v: ['v'], ve: ['v', 'eh'], van: ['v', 'eh', 'n'], vn: ['v', 'n'], er: ['er'],
      yo: ['i', 'o'], io: ['i', 'o'],
    };
    return map[f] || ['a'];
  }

  const INIT_TYPE = {};
  (function () {
    for (const s of 'bdg'.split('')) INIT_TYPE[s] = 'unasp';
    for (const s of 'ptk'.split('')) INIT_TYPE[s] = 'asp';
    for (const s of ['z', 'zh', 'j']) INIT_TYPE[s] = 'affr';
    for (const s of ['c', 'ch', 'q']) INIT_TYPE[s] = 'affrAsp';
    INIT_TYPE.f = 'fric'; INIT_TYPE.h = 'fric';
    for (const s of ['s', 'sh', 'x']) INIT_TYPE[s] = 'fric';
    INIT_TYPE.r = 'retro'; INIT_TYPE.m = 'nasal'; INIT_TYPE.n = 'nasal';
    INIT_TYPE.l = 'lat'; INIT_TYPE.y = 'glide'; INIT_TYPE.w = 'glide';
  })();

  /* ===================== 3. 共振峰合成器 ===================== */
  function newState() {
    return { x1: [0, 0, 0], x2: [0, 0, 0], y1a: [0, 0, 0], y1b: [0, 0, 0], y2a: [0, 0, 0], y2b: [0, 0, 0] };
  }

  function band(x, st, k, f, q) {
    const w0 = (2 * Math.PI * f) / SR;
    const qq = Math.max(0.6, q);
    const alpha = Math.sin(w0) / (2 * qq);
    const a0 = 1 + alpha;
    const b0 = alpha / a0;
    const b2 = -alpha / a0;
    const a1 = (-2 * Math.cos(w0)) / a0;
    const a2 = (1 - alpha) / a0;
    // 直接 II 型
    const y = b0 * x + b2 * st.x2[k] - a1 * st.y1a[k] - a2 * st.y2a[k];
    st.x2[k] = st.x1[k];
    st.x1[k] = x;
    st.y2a[k] = st.y1a[k];
    st.y1a[k] = y;
    return y;
  }

  function synthSyllable(p) {
    const dur = Math.max(0.05, p.dur);
    const n = Math.max(48, Math.round(dur * SR));
    const out = new Float32Array(n);
    const N2 = [0, 2, 4];
    const st = p.state || newState();
    const ini = p.ini || '';
    const ftype = INIT_TYPE[ini] || 'none';
    const vs = finalVowels(p.fin || 'a', ini).map((v) => VOWEL[v] || VOWEL.a);
    const formantScale = p.formantScale || 1;
    const F = vs.map((v) => v.map((x) => x * formantScale));
    const base = p.f0 || 196;
    const wh = !!p.whisper;
    const nyq = SR / 2 - 300;

    let iniFrac = 0;
    if (ftype === 'asp') iniFrac = 0.14;
    else if (ftype === 'unasp') iniFrac = 0.09;
    else if (ftype === 'fric') iniFrac = 0.2;
    else if (ftype === 'affr' || ftype === 'affrAsp') iniFrac = 0.22;
    else if (ftype === 'nasal') iniFrac = 0.16;
    else if (ftype === 'lat') iniFrac = 0.14;
    else if (ftype === 'retro') iniFrac = 0.15;
    else if (ftype === 'glide') iniFrac = 0.1;

    const nIni = Math.round(n * iniFrac);
    const nVow = n - nIni;
    let phase = p.prevPhase || 0;
    const preIni = (vs.length && vs[0] && vs[0][1] > 1800) ? vs[0] : null; // i/ü 起头：声母带一点腭化
    const tailTrans = p.nextFormant ? 0.18 : 0;
    const ton = p.tone || 0;
    const f0base = base;
    let lastFg = p.prevFormant || null;

    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      let amp = 1;
      let fg = null;
      let noise = 0;
      let noiseGain = 0;
      let noiseLP = 0;

      if (i < nIni) {
        const v = i / Math.max(1, nIni);
        amp = Math.min(1, v * 2.2) * (ftype === 'asp' || ftype === 'fric' ? 0.55 : 0.8);
        if (ftype === 'nasal' || ftype === 'lat' || ftype === 'retro') {
          fg = ftype === 'lat' ? [VOWEL.i[0], VOWEL.i[1] * 0.85, VOWEL.i[2]] : [VOWEL.n[0], VOWEL.n[1], VOWEL.ng[2]];
          amp = 0.2 + 0.45 * v;
        } else if (ftype === 'glide') {
          fg = preIni || [VOWEL.i[0], VOWEL.i[1], VOWEL.i[2]];
          amp = 0.3 + 0.2 * v;
        } else if (ftype === 'asp' || ftype === 'fric' || ftype === 'affrAsp') {
          noise = 1; noiseGain = ftype === 'fric' ? 0.35 : 0.22; noiseLP = 0.75;
        } else {
          amp *= 0.25 + 0.55 * v;
        }
      } else {
        const v = nVow > 1 ? (i - nIni) / (nVow - 1) : 1;
        let a;
        let b;
        let w;
        if (vs.length === 1) { a = vs[0]; b = vs[0]; w = 0; }
        else {
          const seg = Math.min(vs.length - 1, Math.floor(v * vs.length));
          a = vs[seg];
          b = vs[Math.min(vs.length - 1, seg + 1)];
          w = Math.min(1, v * vs.length - seg);
        }
        fg = [0, 1, 2].map((j) => a[j] + (b[j] - a[j]) * w);
        // 韵头过渡：从上一音节末共振峰滑入
        if (p.prevFormant && v < 0.3) {
          const k = v / 0.3;
          fg = fg.map((x, j) => p.prevFormant[j] + (x - p.prevFormant[j]) * k);
        }
        // 韵尾收向下一音
        if (p.nextFormant && tailTrans && v > 1 - tailTrans) {
          const k = (v - (1 - tailTrans)) / tailTrans;
          fg = fg.map((x, j) => x + (p.nextFormant[j] - x) * k * 0.55);
        }
        amp = (0.6 + 0.4 * Math.min(1, v * 6)) * Math.min(1, (1 - v) * 8 + 0.35);
        if (ftype === 'asp' || ftype === 'fric') { noise = 1; noiseGain = 0.04; noiseLP = 0.4; }
        if (ftype === 'retro') { noiseGain += 0.05; noiseLP = 0.6; }
      }

      // —— 声调曲线
      let hz = f0base;
      switch (ton) {
        case 1: hz = f0base * (1.02 - 0.035 * u); break;
        case 2: hz = f0base * (0.88 + 0.26 * Math.pow(u, 0.75)); break;
        case 3: {
          const dip = u < 0.62 ? 1 - 0.22 * (u / 0.62) : 0.78 + 0.3 * ((u - 0.62) / 0.38);
          hz = f0base * dip;
          break;
        }
        case 4: hz = f0base * (1.16 - 0.36 * Math.pow(u, 0.55)); break;
        case 5: hz = f0base * (0.92 - 0.04 * u); break;
        default: hz = f0base * (1 - 0.02 * u);
      }
      // 音高抖动（真人感）+ 渐入渐出
      hz *= 1 + 0.006 * Math.sin(i / 29.0) + 0.003 * Math.sin(i / 7.7);
      const env = Math.min(1, i / 60) * Math.min(1, (n - i) / 60);
      amp *= env;

      // —— 声门脉冲（基频 + 谐波）
      phase += hz / SR;
      if (phase >= 1) phase -= 1;
      let src = 0;
      if (!wh) {
        const ph = phase;
        // Rosenberg 近似：开相/闭相
        const open = Math.floor(ph * 3);
        src = Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * ph), 2) - 0.35;
        src += 0.25 * Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * ph * 2), 3);
      }
      const nz = Math.random() * 2 - 1;
      if (noise) {
        // 一阶低通做“类语音”噪声
        const lp = (st.x1[0] = st.x1[0] * (1 - noiseLP) + nz * noiseLP) * 0.5;
        src += (nz * 0.6 + lp) * noiseGain * 20;
      }

      let s = 0;
      if (fg) {
        const f0 = Math.min(fg[0], nyq);
        const f1 = Math.min(fg[1], nyq);
        const f2 = Math.min(fg[2], nyq);
        s += band(src, st, 0, f0, f0 / 90) * 1.0;
        s += band(src, st, 1, f1, f1 / 110) * 0.55;
        s += band(src, st, 2, f2, f2 / 160) * 0.22;
        s *= 6.0;
      }
      if (wh) s += nz * 0.05;
      out[i] = s * amp;
      if (fg) lastFg = fg;
    }
    p._phase = phase;
    p._lastFormant = lastFg;
    return out;
  }

  /* ===================== 4. 韵律 ===================== */
  const BASE_PITCH = { female: 198, male: 112, child: 268 };

  function prosodyItems(sentence) {
    const toks = tokenize(sentence);
    const items = [];
    let prevTone = 2;
    const isQ = /[？?]\s*$/.test(sentence);
    const isExc = /[！!]\s*$/.test(sentence);
    let idx = 0;
    const nChar = toks.filter((t) => t.py).length || 1;
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.py) {
        const sp = splitPinyin(t.py);
        idx++;
        // 声调变调：三声+三声 / 一声在一二四声前不降
        let tone = sp.tone;
        const nextTok = toks.slice(i + 1).find((x) => x.py);
        const nextTone = nextTok ? (splitPinyin(nextTok.py) || {}).tone : 0;
        if (tone === 3 && nextTone === 3) tone = 2;
        if (nextTone === 3 && [1, 2, 4].includes(tone)) tone = tone;
        // 轻声字：的 了 着 吗 呢 吧 啊
        if ('的了着吗呢吧啊嘛'.includes(t.ch) && i > 0) tone = 5;
        let dur = 0.2;
        if (tone === 5) dur = 0.15;
        else if (isQ && idx === nChar) dur = 0.26;
        else if (idx === nChar) dur = 0.24;
        if (idx === 1) dur *= 1.06;
        items.push({ ch: t.ch, py: sp.base, tone, dur, first: idx === 1, last: idx === nChar });
        prevTone = tone;
      } else if (/[。！？!?…]/.test(t.ch)) {
        items.push({ rest: true, dur: isQ ? 0.32 : 0.3 });
      } else if (/[，、；：,;:]/.test(t.ch)) {
        items.push({ rest: true, dur: 0.2 });
      } else if (/[“”‘’（）《》【】「」]/.test(t.ch)) {
        /* 跳过 */
      } else if (/\s/.test(t.ch)) {
        items.push({ rest: true, dur: 0.03 });
      } else if (/[0-9]/.test(t.ch)) {
        items.push({ digit: t.ch, dur: 0.16 });
      } else if (/[a-zA-Z]/.test(t.ch)) {
        items.push({ latin: t.ch.toLowerCase(), dur: 0.1 });
      } else {
        items.push({ rest: true, dur: 0.05 });
      }
    }
    if (isQ) items.push({ rest: true, dur: 0.12, q: true });
    if (isExc) items.push({ rest: true, dur: 0.1, exc: true });
    return items;
  }

  // 英文字母读音（拼音化）
  const LETTER = {
    a: 'ei1', b: 'bi1', c: 'xi1', d: 'di1', e: 'yi1', f: 'aifu', g: 'ji1', h: 'ai1qi', i: 'ai1', j: 'jie1', k: 'kei1',
    l: 'ai1lu', m: 'ai1mu', n: 'en1', o: 'ou1', p: 'pi1', q: 'kiu1', r: 'a1er', s: 'ai1si', t: 'ti1', u: 'you1', v: 'wei1',
    w: 'da2buli1', x: 'ai1ke1si', y: 'wai1', z: 'zei1',
  };

  function synthSentence(sentence, voice) {
    const v = voice || {};
    const rate = Math.max(0.5, Math.min(2, Number(v.rate) || 1));
    const g = v.gender === 'male' ? 'male' : v.gender === 'child' ? 'child' : 'female';
    const base = (BASE_PITCH[g] || 198) * Math.pow(2, (Number(v.pitchHz) || 0) / 12);
    const items = prosodyItems(sentence);
    const chunks = [];
    const st = newState();
    let phase = 0;
    let prevF = null;
    const fscale = g === 'male' ? 0.93 : g === 'child' ? 1.22 : 1.0;

    let lastFormantOf = null;
    const formants = [];
    for (const it of items) {
      if (it.rest) { formants.push(null); continue; }
      if (it.latin) {
        const lp = LETTER[it.latin];
        if (lp) { formants.push(finalVowels(splitPinyin(lp).base.replace(/^.*?(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])/, '') || 'e', 'z').map((x) => (VOWEL[x] || VOWEL.a).map((y) => y * fscale))); continue; }
        formants.push(null);
        continue;
      }
      if (it.digit) {
        const d = ['ling2', 'yi1', 'er4', 'san1', 'si4', 'wu3', 'liu4', 'qi1', 'ba1', 'jiu3'][Number(it.digit)] || 'ling2';
        const ini = initialOf(splitPinyin(d).base);
        formants.push(finalVowels(ini.rest, ini.s).map((x) => (VOWEL[x] || VOWEL.a).map((y) => y * fscale)));
        it.py = splitPinyin(d).base; it.tone = splitPinyin(d).tone; it.ini = ini.s; it.fin = ini.rest;
        continue;
      }
      const ini = initialOf(it.py);
      it.ini = ini.s; it.fin = ini.rest;
      formants.push(finalVowels(ini.rest, ini.s).map((x) => (VOWEL[x] || VOWEL.a).map((y) => y * fscale)));
    }

    let pi = 0;
    for (let k = 0; k < items.length; k++) {
      const it = items[k];
      if (it.rest) {
        const n = Math.round((it.dur / rate) * SR);
        chunks.push(new Float32Array(n));
        continue;
      }
      // 寻找下一个共振峰用于半元音收尾
      let nf = null;
      for (let j = k + 1; j < items.length; j++) { if (items[j].rest) continue; if (formants[j]) { nf = formants[j][0]; break; } }
      const p = {
        ini: it.ini, fin: it.fin, tone: it.tone, dur: it.dur / rate, f0: base,
        state: st, prevPhase: phase, prevFormant: prevF, nextFormant: nf,
        whisper: !!v.whisper, formantScale: 1.0,
      };
      // 句末疑问句整体抬高
      const buf = synthSyllable(p);
      chunks.push(buf);
      phase = p._phase || 0;
      prevF = p._lastFormant || prevF;
      pi++;
    }
    const total = chunks.reduce((a, b) => a + b.length, 0);
    const out = new Float32Array(total);
    let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }

  /* ===================== 5. 后处理 & WAV ===================== */
  function post(buf) {
    // 去爆音
    for (let i = 1; i < buf.length; i++) {
      if (Math.abs(buf[i]) > 2.2) buf[i] = buf[i - 1] * 0.5;
    }
    // 去直流
    let mean = 0;
    for (let i = 0; i < buf.length; i++) mean += buf[i];
    mean /= buf.length || 1;
    for (let i = 0; i < buf.length; i++) buf[i] -= mean;
    // 归一
    let m = 1e-6;
    for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]));
    for (let i = 0; i < buf.length; i++) buf[i] *= 0.86 / m;
    // 淡入淡出
    const n = Math.round(0.004 * SR);
    for (let i = 0; i < n && i < buf.length; i++) { buf[i] *= i / n; buf[buf.length - 1 - i] *= i / n; }
    return buf;
  }

  function synthSpeech(sentences, voice) {
    const parts = [];
    const durations = [];
    for (const s of sentences) {
      if (s.kind === 'cue') { parts.push(new Float32Array(0)); durations.push(0); continue; }
      let buf = synthSentence(s.text, voice);
      // 句尾自然停顿
      const tail = Math.min(0.45, 0.1 + s.text.length * 0.003);
      const m = new Float32Array(buf.length + Math.round(tail * SR));
      m.set(buf, 0);
      parts.push(m);
      durations.push(m.length / SR);
    }
    const total = parts.reduce((a, b) => a + b.length, 0);
    const out = new Float32Array(total);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    post(out);
    return { samples: out, durations };
  }

  function toWav16(f32, sr) {
    sr = sr || SR;
    const n = f32.length;
    const ab = new ArrayBuffer(44 + n * 2);
    const v = new DataView(ab);
    const w = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE');
    w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    w(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) {
      const s = Math.max(-1, Math.min(1, f32[i]));
      v.setInt16(44 + i * 2, Math.round(s * 32767), true);
    }
    return new Uint8Array(ab);
  }

  function fromWav(u8) {
    const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let pos = 12;
    let sr = 24000;
    let ch = 1;
    let bits = 16;
    while (pos < v.byteLength - 8) {
      const id = String.fromCharCode(v.getUint8(pos), v.getUint8(pos + 1), v.getUint8(pos + 2), v.getUint8(pos + 3));
      const size = v.getUint32(pos + 4, true);
      if (id === 'fmt ') { ch = v.getUint16(pos + 10, true); sr = v.getUint32(pos + 12, true); bits = v.getUint16(pos + 22, true); }
      if (id === 'data') {
        const step = (bits / 8) * ch;
        const n = Math.floor(size / step);
        const out = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          const off = pos + 8 + i * step;
          out[i] = bits === 16 ? v.getInt16(off, true) / 32768 : bits === 32 ? v.getFloat32(off, true) : (v.getUint8(off) - 128) / 128;
        }
        return { samples: out, sr };
      }
      pos += 8 + size + (size % 2);
    }
    return null;
  }

  const api = { SR, setPinyin, tokenize, synthSyllable, synthSentence, synthSpeech, toWav16, fromWav, prosodyItems };
  root.Jpc = Object.assign(root.Jpc || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);