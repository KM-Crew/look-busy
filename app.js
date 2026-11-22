/* 열공 위장막 — 아무 키나 두드려도 그럴싸한 화면이 써짐
   Esc = 보스 키(완성된 필기 화면으로 즉시 전환), 탭 제목·아이콘 위장 */
'use strict';

const opts = store.get('lb-opts', { subject: 'biz', speed: 3, disguise: true });
const saveOpts = () => store.set('lb-opts', opts);
const ORIG_TITLE = document.title;
const ORIG_ICON = $('link[rel=icon]').href;
const DOC_ICON = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect x='18' y='8' width='64' height='84' rx='6' fill='%23e5484d'/><text x='50' y='64' font-size='26' text-anchor='middle' fill='white' font-family='Arial' font-weight='bold'>PDF</text></svg>";

function disguise(on, title) {
  document.title = on ? title : ORIG_TITLE;
  $('link[rel=icon]').href = on ? DOC_ICON : ORIG_ICON;
}

function renderMarkup(text) {
  return text.split('\n').map(line => {
    let cls = 'p', body = line;
    if (line.startsWith('## ')) { cls = 'h2'; body = line.slice(3); }
    else if (line.startsWith('# ')) { cls = 'h1'; body = line.slice(2); }
    else if (line.startsWith('- ')) { cls = 'li'; body = line.slice(2); }
    body = esc(body).replace(/==(.+?)(==|$)/g, '<mark>$1</mark>').replace(/\*\*(.+?)(\*\*|$)/g, '<b>$1</b>');
    return `<div class="${cls}">${body || '&nbsp;'}</div>`;
  }).join('');
}

/* 한 번에 훑는 정규식(문자열·키워드·숫자·데코레이터)으로 태그 안을 다시 건드리지 않게 함 */
const PY_TOKEN = /(f?&quot;.*?(?:&quot;|$))|\b(def|class|return|if|for|in|import|from|as|not|and|or|None|True|False|while|with|lambda|elif|else|print)\b|\b(\d+)\b|(@\w+)/g;
function highlightPy(code) {
  return code.split('\n').map((line, i) => {
    const hashAt = line.indexOf('#');
    let src = line, comment = '';
    if (hashAt >= 0 && !/["']/.test(line.slice(0, hashAt))) { comment = `<span class="cm">${esc(line.slice(hashAt))}</span>`; src = line.slice(0, hashAt); }
    const html = esc(src).replace(PY_TOKEN, (m, str, kw, num, dec) =>
      str ? `<span class="st">${str}</span>` : kw ? `<span class="kw">${kw}</span>` : num ? `<span class="nu">${num}</span>` : `<span class="dc">${dec}</span>`);
    return `<div class="ln"><i>${i + 1}</i><span>${html}${comment}</span></div>`;
  }).join('');
}

/* 공통 타자기: 키 입력마다 원문을 몇 글자씩 */
function typer(source, onRender, perKey) {
  let pos = 0;
  return {
    step() {
      pos = Math.min(source.length, pos + perKey() + Math.floor(Math.random() * 2));
      onRender(source.slice(0, pos), pos >= source.length);
    },
    get done() { return pos >= source.length; },
    reset() { pos = 0; }
  };
}

function bindKeys(handler, area) {
  const kd = e => {
    if (e.key === 'Escape') { boss(); e.preventDefault(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.key) || e.key === 'Tab') return;
    if ($('#boss')) return;
    e.preventDefault();
    handler();
  };
  addEventListener('keydown', kd);
  // 모바일: 화면을 누르면 숨은 입력칸이 키보드를 띄움
  const hidden = h('<textarea class="sink" aria-hidden="true" autocapitalize="off" autocomplete="off"></textarea>');
  document.body.append(hidden);
  hidden.addEventListener('input', () => { hidden.value = ''; handler(); });
  const tap = () => { hidden.focus({ preventScroll: true }); handler(); };
  area.addEventListener('click', tap);
  return () => { removeEventListener('keydown', kd); hidden.remove(); area.removeEventListener('click', tap); };
}

/* 보스 키: 완성된 필기 화면 오버레이 */
function boss() {
  const ex = $('#boss');
  if (ex) { ex.remove(); return; }
  const n = NOTES[opts.subject];
  const el = h(`<div id="boss"><div class="pdfbar"><span>📄 ${esc(n.file)}</span><span class="grow"></span><span>1 / 12</span><span>100%</span></div><div class="pdfpage note-view">${renderMarkup(n.text)}</div><div class="bosshint">Esc 를 다시 누르면 돌아가요</div></div>`);
  el.onclick = () => el.remove();
  document.body.append(el);
}

/* ---------- 모드 선택 ---------- */
Router.on('/', root => {
  disguise(false);
  root.append(h(`
    <section class="stack">
      <h1>강의 시간,<br>열공하는 척 끝판왕</h1>
      <p class="muted">모드를 고르고 <b>아무 키나 마구</b> 두드리세요. 화면에는 그럴싸한 필기·코드·표가 착착 써집니다.</p>
      <div class="modes">
        <a class="mode card" href="#/note"><div class="mprev note-prev"><i></i><i></i><i></i><i></i></div><b>📓 필기 모드</b><span class="muted small">노트 앱에 강의 필기하는 척</span></a>
        <a class="mode card" href="#/code"><div class="mprev code-prev"><i></i><i></i><i></i><i></i></div><b>💻 코딩 모드</b><span class="muted small">과제 코드 짜는 척</span></a>
        <a class="mode card" href="#/sheet"><div class="mprev sheet-prev"><i></i><i></i><i></i><i></i></div><b>📊 엑셀 모드</b><span class="muted small">팀플 예산 정리하는 척</span></a>
      </div>
      <div class="card stack">
        <div><label class="field">필기 과목</label><div class="row" id="subj">${Object.entries(NOTES).map(([k, n]) => `<button class="chip ${opts.subject === k ? 'on' : ''}" data-k="${k}">${n.name}</button>`).join('')}</div></div>
        <div><label class="field">타자 속도 (한 번 누를 때 글자 수)</label><input type="range" id="spd" min="1" max="8" value="${opts.speed}"></div>
        <label class="row small"><input type="checkbox" id="dis" ${opts.disguise ? 'checked' : ''}> 탭 이름·아이콘을 강의자료 PDF처럼 바꾸기</label>
      </div>
      <div class="notice"><b>Esc</b> = 보스 키. 누르는 즉시 완성된 강의 필기 화면으로 바뀌어요. 휴대폰은 화면을 톡톡 두드리면 돼요.</div>
      <p class="muted small center">교수님 죄송합니다. 이 사이트는 농담입니다. 수업은 들읍시다.</p>
    </section>`));
  $$('#subj .chip').forEach(b => b.onclick = () => { opts.subject = b.dataset.k; saveOpts(); $$('#subj .chip').forEach(x => x.classList.toggle('on', x === b)); });
  $('#spd').oninput = e => { opts.speed = Number(e.target.value); saveOpts(); };
  $('#dis').onchange = e => { opts.disguise = e.target.checked; saveOpts(); };
});

function fullscreenBtn() {
  const b = h('<button class="fsbtn" title="전체 화면">⛶</button>');
  b.onclick = e => { e.stopPropagation(); const d = document.documentElement; if (document.fullscreenElement) document.exitFullscreen(); else (d.requestFullscreen || d.webkitRequestFullscreen || (() => {})).call(d); };
  return b;
}

/* ---------- 필기 모드 ---------- */
Router.on('/note', root => {
  const n = NOTES[opts.subject];
  disguise(opts.disguise, n.file);
  document.body.classList.add('mode-on');
  root.append(h(`
    <section class="app note-app">
      <aside class="side"><div class="sidehead">내 노트</div>${Object.values(NOTES).map(x => `<div class="sideitem ${x === n ? 'on' : ''}">${esc(x.name)}</div>`).join('')}<div class="sideitem">기말 정리</div><div class="sideitem">팀플 회의록</div></aside>
      <div class="paper"><div class="meta muted small">${new Date().toLocaleDateString('ko-KR')} · ${esc(n.name)}</div><div class="note-view" id="out"></div><span class="caret"></span></div>
    </section>`));
  root.append(fullscreenBtn());
  const out = $('#out');
  const t = typer(n.text, txt => { out.innerHTML = renderMarkup(txt); const p = $('.paper'); p.scrollTop = p.scrollHeight; }, () => opts.speed);
  const off = bindKeys(() => t.step(), $('.paper'));
  return () => { off(); document.body.classList.remove('mode-on'); disguise(false); };
});

/* ---------- 코딩 모드 ---------- */
Router.on('/code', root => {
  disguise(opts.disguise, 'timetable.py — 과제3');
  document.body.classList.add('mode-on', 'dark');
  root.append(h(`
    <section class="app code-app">
      <div class="tabs"><span class="tab on">timetable.py</span><span class="tab">test_timetable.py</span><span class="tab">README.md</span></div>
      <div class="editor" id="ed"></div>
      <div class="term" id="term"><div class="termhead">터미널</div></div>
    </section>`));
  root.append(fullscreenBtn());
  const ed = $('#ed'), term = $('#term');
  let lineShown = 0, termIdx = 0;
  const t = typer(CODE, txt => {
    ed.innerHTML = highlightPy(txt) + '<span class="caret"></span>';
    ed.scrollTop = ed.scrollHeight;
    const lines = txt.split('\n').length;
    if (lines - lineShown >= 14) {
      lineShown = lines;
      for (let k = 0; k < 2 && termIdx < TERMINAL_LINES.length; k++) term.append(h(`<div class="tl">${esc(TERMINAL_LINES[termIdx++])}</div>`));
      term.scrollTop = term.scrollHeight;
    }
  }, () => opts.speed + 1);
  const off = bindKeys(() => t.step(), ed);
  return () => { off(); document.body.classList.remove('mode-on', 'dark'); disguise(false); };
});

/* ---------- 엑셀 모드 ---------- */
Router.on('/sheet', root => {
  disguise(opts.disguise, SHEET.title);
  document.body.classList.add('mode-on');
  const months = SHEET.cols.length - 2;
  const values = SHEET.rows.map((_, r) => Array.from({ length: months }, (_, c) => Math.round((20 + ((r * 37 + c * 53) % 90)) * 1000 / 10) * 10));
  const cells = [];
  SHEET.rows.forEach((name, r) => { cells.push([r, 0, name]); values[r].forEach((v, c) => cells.push([r, c + 1, v])); cells.push([r, months + 1, 'SUM']); });
  root.append(h(`
    <section class="app sheet-app">
      <div class="fx"><span class="cellref" id="ref">A1</span><span class="fxi">fx</span><span id="fx"></span></div>
      <div class="gridwrap"><table class="grid" id="grid">
        <thead><tr><th></th>${SHEET.cols.map((c, i) => `<th>${String.fromCharCode(65 + i)}</th>`).join('')}</tr>
        <tr class="hdr"><th>1</th>${SHEET.cols.map(c => `<td>${c}</td>`).join('')}</tr></thead>
        <tbody>${SHEET.rows.map((_, r) => `<tr><th>${r + 2}</th>${SHEET.cols.map((_, c) => `<td id="c${r}-${c}"></td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>
      <div class="chartbox"><div class="ctitle">월별 지출</div><div class="cbars" id="cb">${Array.from({ length: months }, (_, i) => `<div class="cb"><i style="height:0%"></i><span>${SHEET.cols[i + 1]}</span></div>`).join('')}</div></div>
    </section>`));
  root.append(fullscreenBtn());
  let k = 0;
  const colSum = Array(months).fill(0);
  const maxCol = Math.max(...Array.from({ length: months }, (_, c) => values.reduce((s, row) => s + row[c], 0)));
  const step = () => {
    for (let n = 0; n < Math.max(1, Math.floor(opts.speed / 2)); n++) {
      if (k >= cells.length) return;
      const [r, c, v] = cells[k++];
      const td = $(`#c${r}-${c}`);
      $$('.grid td.sel').forEach(x => x.classList.remove('sel'));
      td.classList.add('sel');
      $('#ref').textContent = String.fromCharCode(65 + c) + (r + 2);
      if (v === 'SUM') {
        const sum = values[r].reduce((a, b) => a + b, 0);
        $('#fx').textContent = `=SUM(B${r + 2}:${String.fromCharCode(65 + months)}${r + 2})`;
        td.textContent = sum.toLocaleString('ko-KR'); td.classList.add('num', 'sum');
      } else if (typeof v === 'number') {
        $('#fx').textContent = v; td.textContent = v.toLocaleString('ko-KR'); td.classList.add('num');
        colSum[c - 1] += v;
        $$('#cb .cb i')[c - 1].style.height = (colSum[c - 1] / maxCol * 100) + '%';
      } else { $('#fx').textContent = v; td.textContent = v; }
    }
  };
  const off = bindKeys(step, $('.gridwrap'));
  return () => { off(); document.body.classList.remove('mode-on'); disguise(false); };
});

Router.start($('#app'));
