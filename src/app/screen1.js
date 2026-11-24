/* 讲解成片 · ① 稿子：粘贴 → 自动分镜 → 逐页改写 */
(function (root) {
  'use strict';
  const { h, toast } = UI;

  let editing = -1;

  function render(State, api) {
    const left = h('div', { class: 'col', style: { width: '520px', flex: '0 0 520px' } });
    const right = h('div', { class: 'col grow' });

    // 左：粘贴区
    left.appendChild(h('div', { class: 'section-title' }, [h('span', { class: 'dot' }), '把你的稿子粘进来']));
    const ta = h('textarea', {
      placeholder: '支持 Markdown 小标题（## 标题）和列表（- 要点）。\n\n示例：\n## 一、我们的问题\n每个季度要做十几份汇报，讲稿写完还要排版、录音、打轴。\n- 排版靠手调\n- 配音要重录\n\n## 二、我们的解法\n稿子即分镜。用 [方括号] 标重点，自动变成字幕高亮。',
      style: { minHeight: '300px', fontSize: '14px', lineHeight: '1.8' },
      value: State.raw,
      oninput: (e) => { State.raw = e.target.value; },
    });
    left.appendChild(ta);

    const titleIn = h('input', {
      type: 'text', value: State.project.title,
      oninput: (e) => { State.project.title = e.target.value; renderList(); },
      style: { marginTop: '10px' },
    });
    left.appendChild(h('label', { style: { marginTop: '12px' } }, '成片标题'));
    left.appendChild(titleIn);

    const btn = h('button', {
      class: 'primary', style: { marginTop: '12px', width: '100%', padding: '12px' },
      onclick: () => {
        const raw = (State.raw || '').trim();
        if (!raw) { toast('先粘贴一段稿子吧'); return; }
        api.State.project.slides = Jpc.buildSlides(raw);
        api.invalidate();
        api.State.audio = null;
        renderList();
        toast('已自动切成 ' + State.project.slides.length + ' 页');
      },
    }, '⚡ 自动分镜');
    left.appendChild(btn);

    left.appendChild(h('div', { class: 'hint', style: { marginTop: '14px' } }, [
      h('div', null, [h('b', null, '写作小技巧')]),
      h('div', null, '· 用 ' + '## 小标题' + ' 分节，每一节会变成一页或几页'),
      h('div', null, '· 用 - 列表 写要点，会自动变成要点页并逐条高亮'),
      h('div', null, '· 用 [方括号] 标出台词重点，成片里会变成高亮字幕和画面动效'),
      h('div', null, '· 出现两个以上数字的短句，会被识别成数字卡片页'),
    ]));

    // 右：分镜列表
    right.appendChild(h('div', { class: 'section-title' }, [h('span', { class: 'dot' }), '分镜（' + State.project.slides.length + ' 页）', h('span', { class: 'hint', style: { marginLeft: 'auto' } }, '点开每一页可改标题、正文与版式')]));
    const list = h('div', { id: 'slideList' });
    right.appendChild(list);

    function renderList() {
      list.innerHTML = '';
      State.project.slides.forEach((s, i) => {
        const item = h('div', { class: 'slide-item' + (editing === i ? ' open' : '') });
        const cueCount = (s.body || '').match(/\[[^\]]+\]/g);
        item.appendChild(h('div', {
          class: 'hd',
          onclick: () => { editing = editing === i ? -1 : i; renderList(); },
        }, [
          h('span', { class: 'idx' }, String(i + 1)),
          h('span', { class: 't' }, (s.title || '（无标题）')),
          h('span', { class: 'badge' }, Jpc.LAYOUT_NAMES[s.layout] || s.layout),
          cueCount ? h('span', { class: 'badge cue' }, cueCount.length + ' 处重点') : null,
          h('button', {
            class: 'danger fixed', style: { padding: '0 8px', flex: '0 0 auto' },
            onclick: (e) => {
              e.stopPropagation();
              State.project.slides.splice(i, 1);
              if (editing >= i) editing = -1;
              api.invalidate(); api.State.audio = null;
              renderList();
            },
          }, '✕'),
        ]));
        if (editing === i) {
          const bd = h('div', { class: 'bd' });
          bd.appendChild(h('label', null, '标题'));
          bd.appendChild(h('input', {
            type: 'text', value: s.title,
            oninput: (e) => { s.title = e.target.value; api.invalidate(); const t = item.querySelector('.t'); if (t) t.textContent = s.title || '（无标题）'; },
          }));
          bd.appendChild(h('label', { style: { marginTop: '8px' } }, '讲解内容（[方括号] = 重点）'));
          bd.appendChild(h('textarea', {
            value: s.body,
            oninput: (e) => { s.body = e.target.value; api.invalidate(); api.State.audio = null; },
          }));
          bd.appendChild(h('label', { style: { marginTop: '8px' } }, '版式'));
          const sel = h('select', {
            onchange: (e) => { s.layout = e.target.value; api.invalidate(); },
          }, Object.keys(Jpc.LAYOUT_NAMES).map((k) => h('option', { value: k, selected: k === s.layout }, Jpc.LAYOUT_NAMES[k])));
          bd.appendChild(sel);
          if (s.layout === 'bullets') {
            bd.appendChild(h('label', { style: { marginTop: '8px' } }, '要点（每行一条）'));
            bd.appendChild(h('textarea', {
              value: (s.bullets || []).join('\n'),
              oninput: (e) => { s.bullets = e.target.value.split('\n').filter(Boolean); api.invalidate(); },
            }));
          }
          if (s.layout === 'numbers' || s.layout === 'split') {
            bd.appendChild(h('label', { style: { marginTop: '8px' } }, '数字卡片（每行：数值|说明）'));
            bd.appendChild(h('textarea', {
              value: (s.stats || []).map((x) => x.value + '|' + x.label).join('\n'),
              oninput: (e) => {
                s.stats = e.target.value.split('\n').filter(Boolean).map((l) => {
                  const [v, l2] = l.split('|');
                  return { value: (v || '').trim(), label: (l2 || '').trim() };
                });
                api.invalidate();
              },
            }));
          }
          if (s.layout === 'quote') {
            bd.appendChild(h('label', { style: { marginTop: '8px' } }, '金句'));
            bd.appendChild(h('input', {
              type: 'text', value: s.quote || '',
              oninput: (e) => { s.quote = e.target.value; api.invalidate(); },
            }));
          }
          bd.appendChild(h('div', { class: 'row', style: { marginTop: '10px' } }, [
            h('button', {
              class: 'ghost', onclick: () => {
                State.project.slides.splice(i + 1, 0, Jpc.newSlide({ title: '新的一页', body: '' }));
                editing = i + 1; api.invalidate(); renderList();
              },
            }, '在下方插入一页'),
          ]));
          item.appendChild(bd);
        }
        list.appendChild(item);
      });
      if (!State.project.slides.length) {
        list.appendChild(h('div', { class: 'hint' }, '还没有分镜。粘贴稿子后点上方按钮自动分镜，或点下面新建一页。'));
      }
      list.appendChild(h('button', {
        class: 'ghost', style: { marginTop: '4px' },
        onclick: () => { State.project.slides.push(Jpc.newSlide({ title: '新的一页', body: '' })); editing = State.project.slides.length - 1; api.invalidate(); renderList(); },
      }, '+ 新建一页'));
    }
    renderList();

    const wrap = h('div', { class: 'screen' }, [left, right]);
    return wrap;
  }

  root.Screen1 = { render, leave() { } };
})(window);