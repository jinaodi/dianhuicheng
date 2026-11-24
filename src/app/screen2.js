/* 讲解成片 · ② 风格：主题 / 版式 / 配音 / 字幕 */
(function (root) {
  'use strict';
  const { h, toast, canvasPreview } = UI;

  function render(State, api) {
    const P = State.project;
    const left = h('div', { class: 'col', style: { width: '620px', flex: '0 0 620px', overflow: 'auto' } });
    const right = h('div', { class: 'col grow' });

    // —— 主题
    left.appendChild(h('div', { class: 'section-title' }, [h('span', { class: 'dot' }), '配色主题']));
    const themes = h('div', { class: 'theme-grid' });
    const markOn = () => themes.querySelectorAll('.theme').forEach((x, i) => x.classList.toggle('on', Jpc.STYLE_PRESETS[i] && Jpc.STYLE_PRESETS[i].id === P.style.preset));
    Jpc.STYLE_PRESETS.forEach((t) => {
      const el = h('div', {
        class: 'theme' + (P.style.preset === t.id ? ' on' : ''),
        onclick: () => {
          P.style.preset = t.id;
          P.style.bg = ''; P.style.fg = ''; P.style.accent = ''; P.style.sub = '';
          api.invalidate();
          refreshRight();
          markOn();
        },
      }, [
        h('div', { class: 'sw' }, [t.bg, t.fg, t.accent, t.sub].map((c) => h('i', { style: { background: c, border: '1px solid rgba(255,255,255,.15)' } }))),
        h('div', { class: 'nm' }, t.name),
      ]);
      themes.appendChild(el);
    });
    left.appendChild(themes);

    // —— 配音
    left.appendChild(h('h3', { class: 'section-title', style: { marginTop: '22px' } }, [h('span', { class: 'dot' }), '配音']));
    const genderSeg = h('div', { class: 'seg' });
    [['female', '女声'], ['male', '男声'], ['child', '童声（轻快）']].forEach(([v, n]) => {
      genderSeg.appendChild(h('button', {
        class: P.voice.gender === v ? 'on' : '',
        onclick: () => { P.voice.gender = v; api.invalidate(); genderSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.textContent === n)); },
      }, n));
    });
    left.appendChild(h('label', null, '音色'));
    left.appendChild(genderSeg);

    const rateLabel = h('label', null, '语速 ' + (P.voice.rate || 1).toFixed(2) + '×');
    left.appendChild(h('div', { style: { marginTop: '12px' } }, [rateLabel]));
    left.appendChild(h('input', {
      type: 'range', min: '0.7', max: '1.5', step: '0.05', value: String(P.voice.rate || 1),
      oninput: (e) => { P.voice.rate = Number(e.target.value); rateLabel.textContent = '语速 ' + P.voice.rate.toFixed(2) + '×'; api.invalidate(); refreshRight(); },
    }));

    const pitchLabel = h('label', null, '音调 ' + (P.voice.pitchHz > 0 ? '+' : '') + Math.round(P.voice.pitchHz || 0) + ' 半音');
    left.appendChild(h('div', { style: { marginTop: '10px' } }, [pitchLabel]));
    left.appendChild(h('input', {
      type: 'range', min: '-6', max: '6', step: '1', value: String(P.voice.pitchHz || 0),
      oninput: (e) => { P.voice.pitchHz = Number(e.target.value); pitchLabel.textContent = '音调 ' + (P.voice.pitchHz > 0 ? '+' : '') + P.voice.pitchHz + ' 半音'; api.invalidate(); },
    }));
    left.appendChild(h('div', { class: 'hint' }, '离线引擎：声调曲线 + 韵律停顿，可调语速与音调；接入在线 TTS 时音色随平台变化。'));

    // —— 配音引擎
    left.appendChild(h('h3', { class: 'section-title', style: { marginTop: '22px' } }, [h('span', { class: 'dot' }), '配音引擎']));
    const engSeg = h('div', { class: 'seg' });
    [['offline', '离线合成人声'], ['system', '系统语音（需在线安装）']].forEach(([v, n]) => {
      const on = (State.engine || 'offline') === v;
      engSeg.appendChild(h('button', {
        class: on ? 'on' : '',
        onclick: () => { State.engine = v; engSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.textContent === n)); refreshRight(); },
      }, n));
    });
    left.appendChild(engSeg);

    // —— 字幕 & 画面
    left.appendChild(h('h3', { class: 'section-title', style: { marginTop: '22px' } }, [h('span', { class: 'dot' }), '字幕与动效']));
    const ck = h('label', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, [h('input', {
      type: 'checkbox', checked: P.style.caption.show !== false, style: { width: 'auto' },
      onchange: (e) => { P.style.caption.show = e.target.checked; api.invalidate(); },
    }), '显示口播字幕']);
    left.appendChild(ck);
    left.appendChild(h('label', { style: { marginTop: '10px' } }, '画面动效'));
    const motSeg = h('div', { class: 'seg' });
    [['full', '完整动效'], ['calm', '克制（文档/评审）'], ['off', '关闭']].forEach(([v, n]) => {
      motSeg.appendChild(h('button', {
        class: P.style.motion === v ? 'on' : '',
        onclick: () => { P.style.motion = v; motSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.textContent === n)); },
      }, n));
    });
    left.appendChild(motSeg);

    // —— 右：实时预览
    function refreshRight() {
      right.innerHTML = '';
      right.appendChild(h('div', { class: 'section-title' }, [h('span', { class: 'dot' }), '风格实时预览']));
      const grid = h('div', { class: 'layout-grid' });
      P.slides.slice(0, 8).forEach((s, i) => {
        const cv = h('canvas', { style: { width: '100%', borderRadius: '10px', border: '1px solid var(--line)', cursor: 'pointer' }, title: '点我切到第 ' + (i + 1) + ' 页调整版式' });
        const box = h('div', { class: 'card', style: { padding: '8px', margin: '0' } }, [
          cv,
          h('div', { class: 'row', style: { marginTop: '6px' } }, [
            h('div', { class: 'hint', style: { flex: '1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--fg)' } }, (i + 1) + '. ' + (s.title || '')),
            h('span', { class: 'badge fixed' }, Jpc.LAYOUT_NAMES[s.layout] || s.layout),
          ]),
        ]);
        cv.addEventListener('click', () => {
          const keys = Object.keys(Jpc.LAYOUT_NAMES);
          s.layout = keys[(keys.indexOf(s.layout) + 1) % keys.length];
          api.invalidate();
          refreshRight();
          toast('第 ' + (i + 1) + ' 页版式 → ' + Jpc.LAYOUT_NAMES[s.layout]);
        });
        requestAnimationFrame(() => canvasPreview(cv, P, i, 2.6));
        grid.appendChild(box);
      });
      right.appendChild(grid);
      right.appendChild(h('div', { class: 'hint', style: { marginTop: '12px' } }, '点任意缩略图可以循环切换该页版式；也可以在“稿子”页精确选择。'));
    }
    refreshRight();

    return h('div', { class: 'screen' }, [left, right]);
  }

  root.Screen2 = { render };
})(window);