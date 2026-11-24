/* 讲解成片 · ④ 导出成片
 * 在桌面版（Electron）里：逐帧离屏渲染 + 离线配音 + 直接调用 ffmpeg → MP4
 * 在浏览器里：走同一条渲染流水线，把 WAV 与 PNG 帧序打包下载（附带 CSV 字幕轴名）
 */
(function (root) {
  'use strict';
  const { h, toast, fmt } = UI;

  const FPS = 30;
  const W = 1920;
  const H = 1080;

  function stats(State) {
    const tl = Jpc.buildTimeline(State.project, {});
    const chars = tl.cues.filter((c) => c.kind === 'text').reduce((a, c) => a + c.text.length, 0);
    return { total: tl.total, pages: State.project.slides.length, cues: tl.cues.filter((c) => c.kind === 'text').length, chars, tl };
  }

  function makeScript(State, tl) {
    const lines = [];
    lines.push('讲解成片 · 离线合成脚本');
    lines.push('页面数：' + State.project.slides.length + '；语块数：' + tl.cues.filter((c) => c.kind === 'text').length);
    lines.push('');
    tl.cues.forEach((c) => {
      if (c.kind !== 'text') return;
      lines.push(fmt(c.start) + '  ' + c.text);
    });
    return lines.join('\n');
  }

  function srtTime(t) {
    const ms = Math.round(t * 1000);
    const hh = Math.floor(ms / 3600000);
    const mm = Math.floor((ms % 3600000) / 60000);
    const ss = Math.floor((ms % 60000) / 1000);
    const mmm = ms % 1000;
    return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0') + ',' + String(mmm).padStart(3, '0');
  }

  function makeSrt(State, tl) {
    const out = [];
    let n = 1;
    tl.cues.forEach((c) => {
      if (c.kind !== 'text') return;
      out.push(n++);
      out.push(srtTime(c.start) + ' --> ' + srtTime(c.end));
      out.push(c.end - c.start < 0.35 ? c.text : c.text);
      out.push('');
    });
    return out.join('\n');
  }

  function render(State, api) {
    const st = stats(State);
    const wrap = h('div', { class: 'col grow', style: { overflow: 'auto' } });
    wrap.appendChild(h('div', { class: 'section-title' }, [h('span', { class: 'dot' }), '导出成片']));

    const grid = h('div', { class: 'stat-grid' }, [
      ['预计时长', fmt(st.total)],
      ['页面数', String(st.pages)],
      ['语块数', String(st.cues)],
      ['口播字数', String(st.chars)],
    ].map(([k, v]) => h('div', { class: 'stat' }, [h('div', { class: 'v' }, v), h('div', { class: 'k' }, k)])));
    wrap.appendChild(grid);

    const native = !!window.jpcExport;
    const card = h('div', { class: 'card' });
    card.appendChild(h('div', { class: 'row' }, [
      h('div', null, [
        h('div', { style: { fontWeight: 800, marginBottom: '6px' } }, native ? '导出 MP4（桌面版 · 一键完成）' : '导出素材包（浏览器模式）'),
        h('div', { class: 'hint' }, native
          ? '离线逐帧渲染 ' + W + '×' + H + ' @ ' + FPS + 'fps，叠加离线语音与字幕，调用本地 FFmpeg 合成 1080P 视频。'
          : '浏览器无法直接启动本地编码器，会导出 WAV 配音 + SRT 字幕 + 每页 PNG 快照；桌面版可一键出 MP4。'),
      ]),
    ]));
    const bar = h('div', { class: 'progress', style: { marginTop: '14px' } }, [h('div', { class: 'fill', id: 'progFill' })]);
    card.appendChild(bar);
    const log = h('div', { class: 'log', style: { marginTop: '10px' } }, '就绪。');
    card.appendChild(log);
    const runBtn = h('button', { class: 'primary', style: { marginTop: '12px' } }, native ? '🎬 开始导出 MP4' : '📦 导出素材包');
    card.appendChild(runBtn);
    wrap.appendChild(card);

    // 提交物自检
    const chk = h('div', { class: 'card' });
    chk.appendChild(h('div', { style: { fontWeight: 800, marginBottom: '6px' } }, '配套文件'));
    const cl = h('ul', { class: 'checklist' });
    [
      ['配音 WAV（离线合成人声）', true],
      ['字幕 SRT（与画面严格同源时间轴）', true],
      ['口播脚本 TXT（逐句时间点）', true],
      ['每页海报 PNG（1080P 快照）', true],
      ['MP4 成片（桌面版导出）', native],
    ].forEach(([name, ok]) => cl.appendChild(h('li', null, [h('span', { class: ok ? 'ok' : 'no' }, ok ? '●' : '○'), name])));
    chk.appendChild(cl);
    wrap.appendChild(chk);

    function setProg(p, msg) {
      const f = document.getElementById('progFill');
      if (f) f.style.width = Math.round(p * 100) + '%';
      if (msg) { log.textContent += '\n' + msg; log.scrollTop = log.scrollHeight; }
    }

    runBtn.addEventListener('click', async () => {
      runBtn.disabled = true;
      log.textContent = '开始生成';
      try {
        if (native) {
          await window.jpcExport(State.project, { fps: FPS, onProgress: setProg });
          setProg(1, '完成：已保存 MP4');
          toast('成片已导出');
        } else {
          await exportBundle(State, st, setProg);
          toast('素材包已生成');
        }
      } catch (e) {
        log.textContent += '\n失败：' + (e && e.message ? e.message : e);
      } finally {
        runBtn.disabled = false;
      }
    });

    return wrap;
  }

  async function exportBundle(State, st, setProg) {
    const tl = st.tl;
    setProg(0.05, '① 合成全程配音…');
    const sentences = tl.cues.map((c) => ({ kind: c.kind === 'cue' ? 'cue' : 'text', text: c.text }));
    const speech = Jpc.synthSpeech(sentences, State.project.voice);
    const wav = Jpc.toWav16(speech.samples, Jpc.SR);
    UI.download((State.project.title || '讲解') + '_配音.wav', new Blob([wav], { type: 'audio/wav' }));
    setProg(0.3, '② 写入字幕轴…');
    UI.download((State.project.title || '讲解') + '_字幕.srt', new Blob([makeSrt(State, tl)], { type: 'text/plain;charset=utf-8' }));
    UI.download((State.project.title || '讲解') + '_口播脚本.txt', new Blob([makeScript(State, tl)], { type: 'text/plain;charset=utf-8' }));
    setProg(0.5, '③ 生成每页海报快照…');
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    for (let i = 0; i < State.project.slides.length; i++) {
      ctx.clearRect(0, 0, W, H);
      Jpc.drawSlide(ctx, State.project, State.project.slides[i], 2.6, 0, { bullet: 0 });
      const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
      UI.download(String(i + 1).padStart(2, '0') + '_' + (State.project.slides[i].title || 'page').replace(/[\\/:*?"<>|]/g, '') + '.png', blob);
      setProg(0.5 + 0.45 * (i + 1) / State.project.slides.length);
      await new Promise((r) => setTimeout(r, 120));
    }
    setProg(1, '完成');
  }

  root.Screen4 = { render, makeSrt, makeScript };
})(window);