/* 讲解成片 · ③ 点播：预览画布 + 时间轴 + 逐句点播 */
(function (root) {
  'use strict';
  const { h, toast, fmt } = UI;

  let raf = 0;
  let startClock = 0;
  let startT = 0;
  let audioCtx = null;
  let playing = false;
  let source = null;
  let T = 0;
  let tl = null;
  let cv = null;
  let fillEl = null;
  let timeEl = null;
  let cueEls = [];
  let ctxState = null;

  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  /** 播放某一句对应的离线合成音频（逐句即时合成，秒级响应） */
  function speakCue(idx, speed) {
    const cue = tl.cues[idx];
    if (!cue || cue.kind !== 'text') return;
    const State = S();
    const ac = ensureAudio();
    // 缓存：相同句/相同音色直接复用
    ctxState = ctxState || { key: '', buf: new Map() };
    const vk = JSON.stringify(S().project.voice);
    if (ctxState.key !== vk) { ctxState.key = vk; ctxState.buf.clear(); }
    let buf = ctxState.buf.get(cue.text);
    if (!buf) {
      const wav = Jpc.synthSpeech([{ kind: 'text', text: cue.text }], S().project.voice);
      buf = ac.createBuffer(1, wav.samples.length, wav.sr || Jpc.SR);
      buf.copyToChannel(wav.samples, 0);
      ctxState.buf.set(cue.text, buf);
    }
    try { if (source) source.stop(); } catch (e) { }
    source = ac.createBufferSource();
    source.buffer = buf;
    source.playbackRate.value = speed || 1;
    source.connect(ac.destination);
    source.start();
  }

  function S() { return root.JPC_APP.State; }

  function draw() {
    if (!cv || !tl) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth || 960;
    const Hh = W * 9 / 16;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, Hh);
    ctx.save();
    ctx.scale(W / 1920, W / 1920);
    const i = Jpc.cueAt(tl, T);
    const slideIdx = i >= 0 ? tl.cues[i].slide : (tl.slides.findIndex((s) => T < s.out) >= 0 ? tl.slides.findIndex((s) => T < s.out) : 0);
    const slide = S().project.slides[slideIdx] || S().project.slides[0];
    const local = T - (tl.slides[slideIdx] ? tl.slides[slideIdx].in : 0);
    // 单句播放时的强调：当前句索引 → 要点高亮
    Jpc.drawSlide(ctx, S().project, slide, local, i, { bullet: Math.max(0, Math.min(5, (i >= 0 ? i - tl.slides[slideIdx].firstCue : 0) / 2 | 0)) });
    if (S().project.style.caption.show !== false) {
      const cap = Jpc.captionFor(tl, T, (S().project.style.caption && S().project.style.caption.maxLines) || 2);
      Jpc.drawCaption(ctx, cap.text, S().project.style, Jpc.paletteOf(S().project));
    }
    Jpc.drawBrand(ctx, S().project, T);
    ctx.restore();
    if (fillEl) fillEl.style.width = (100 * Math.min(1, T / tl.total)) + '%';
    if (timeEl) timeEl.textContent = fmt(T) + ' / ' + fmt(tl.total);
    if (cueEls) cueEls.forEach((el, k) => { if (el) el.classList.toggle('on', k === i); });
  }

  function loop() {
    if (!playing) return;
    T = startT + (performance.now() - startClock) / 1000;
    if (T >= tl.total) { T = tl.total; playing = false; raf = 0; draw(); return; }
    // 换句时触发配音
    const cur = Jpc.cueAt(tl, T);
    if (cur >= 0 && cur !== loop._lastCue) {
      loop._lastCue = cur;
      if (S().engine !== 'mute' && tl.cues[cur] && tl.cues[cur].kind === 'text' && S().soundOn !== false) speakCue(cur, 1.08);
    }
    draw();
    raf = requestAnimationFrame(loop);
  }

  function play() {
    tl = Jpc.buildTimeline(S().project, {});
    if (!tl.total) return;
    playing = true;
    ensureAudio();
    startT = T; startClock = performance.now(); loop._lastCue = -1;
    cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    updateBtn();
  }

  function pause() {
    playing = false;
    cancelAnimationFrame(raf);
    try { if (source) source.stop(); } catch (e) { }
    updateBtn();
  }

  function seek(t) {
    T = Math.max(0, Math.min(tl ? tl.total : 0, t));
    loop._lastCue = Jpc.cueAt(tl, T);
    if (playing) { startT = T; startClock = performance.now(); }
    draw();
  }

  let playBtn = null;
  function updateBtn() { if (playBtn) playBtn.textContent = playing ? '⏸' : '▶'; }

  function toggle() { if (playing) pause(); else play(); }

  function render(_st, api) {
    tl = Jpc.buildTimeline(S().project, {});
    S().voiceKey = JSON.stringify(S().project.voice);
    const left = h('div', { class: 'col', style: { width: '720px', flex: '0 0 720px' } });
    const right = h('div', { class: 'col grow' });

    const stage = h('div', { class: 'stage' });
    cv = h('canvas');
    stage.appendChild(cv);
    const overlay = h('div', { class: 'overlay', onclick: () => { overlay.classList.add('hide'); toggle(); } }, '▶ 点击播放');
    stage.appendChild(overlay);
    cv.addEventListener('click', () => { overlay.classList.add('hide'); toggle(); });
    left.appendChild(h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, [
      h('div', { class: 'section-title' }, [h('span', { class: 'dot' }), '点播预览（与导出完全一致的画面）']),
      stage,
    ]));

    playBtn = h('button', { class: 'play', onclick: toggle, title: '播放/暂停（空格）' }, '▶');
    const bar = h('div', { class: 'timeline-bar', onclick: (e) => { const r = bar.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * tl.total); overlay.classList.add('hide'); draw(); } });
    fillEl = h('div', { class: 'fill' });
    bar.appendChild(fillEl);
    tl.slides.forEach((s) => {
      const m = h('div', { class: 'mark', style: { left: (100 * s.in / tl.total) + '%' } });
      bar.appendChild(m);
    });
    timeEl = h('div', { class: 'time' }, fmt(0) + ' / ' + fmt(tl.total));
    const mute = h('button', {
      class: 'ghost', onclick: (e) => { S().soundOn = !(S().soundOn !== false); e.target.textContent = S().soundOn === false ? '🔇' : '🔊'; }, title: '静音点播',
    }, '🔊');
    left.appendChild(h('div', { class: 'ctrl', style: { marginTop: '12px' } }, [playBtn, timeEl, bar, mute]));
    left.appendChild(h('div', { class: 'hint', style: { marginTop: '8px' } }, [
      '预计时长 ', h('b', null, fmt(tl.total)), ' · ', S().project.slides.length, ' 页 · ',
      tl.cues.filter((c) => c.kind === 'text').length, ' 个语块。点播时逐句实时合成人声；导出时全程离线渲染。',
    ]));
    left.appendChild(h('div', { class: 'row', style: { marginTop: '14px' } }, [
      h('button', { class: 'primary', onclick: () => { pause(); api.go(4); } }, '导出成片 →'),
    ]));

    // 右侧语块列表
    right.appendChild(h('div', { class: 'section-title' }, [h('span', { class: 'dot' }), '逐句点播']));
    const list = h('div', { class: 'cue-list', style: { height: 'calc(100% - 60px)', overflow: 'auto' } });
    cueEls = new Array(tl.cues.length).fill(null);
    let lastSlide = -1;
    tl.cues.forEach((c, i) => {
      if (c.kind !== 'text') return;
      if (c.slide !== lastSlide) {
        lastSlide = c.slide;
        list.appendChild(h('div', { style: { padding: '10px 12px 4px', fontSize: '12px', color: 'var(--accent)', fontWeight: '700' } }, '第 ' + (c.slide + 1) + ' 页 · ' + (S().project.slides[c.slide].title || '')));
      }
      const el = h('div', {
        class: 'cue',
        onclick: () => {
          pause();
          seek(c.start + 0.01);
          overlay.classList.add('hide');
          if (S().soundOn !== false) speakCue(i, 1.0);
        },
      }, [h('span', { class: 't' }, fmt(c.start)), c.text]);
      cueEls[i] = el;
      list.appendChild(el);
    });
    right.appendChild(list);
    draw();

    setTimeout(() => { if (cv && !cv.width) draw(); }, 50);

    return h('div', { class: 'screen' }, [left, right]);
  }

  function stop() { pause(); }

  root.Screen3 = { render, toggle, stop };
})(window);