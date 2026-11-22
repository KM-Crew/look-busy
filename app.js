/* 열공 위장막 — 아무 키나 두드려도 그럴싸한 화면이 써짐
   흉내 내는 프로그램(노트 앱·코드 편집기·엑셀·PDF 뷰어)과 키 동작을 최대한 같게 맞춤:
   - 글자 키: 준비된 문장이 몇 글자씩 써짐 / 스페이스: 다음 단어까지 / Enter: 줄 바꿈 / Tab: 들여쓰기
   - Backspace: 방금 친 만큼 지워짐 / Shift·Ctrl·방향키 등: 글자를 만들지 않음
   - 엑셀: 방향키·Enter·Tab으로 칸 이동, Backspace·Delete로 칸 비우기, 칸 클릭으로 선택
   - Esc: 보스 키(완성된 강의자료 화면으로 즉시 전환)
   - Shift를 빠르게 3번: "접근 허가/거부" 팝업 이스터에그(글자는 안 만듦)
   화면 맨 아래 한 줄에는 실제로 친 내용이 그대로 보임(설정에서 끌 수 있음). */
'use strict';

const opts = Object.assign({ subject: 'biz', speed: 1, disguise: true, raw: true, keysnd: false }, store.get('lb-opts', {}));
if (opts.ver !== 2) { opts.speed = 1; opts.ver = 2; }        // 예전 기본값(한 번에 3자)에서 한 글자씩으로 바꿈
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

/* ---------- 타자기: 키 종류별로 원래 프로그램처럼 반응 ---------- */
/* 직접 치는 느낌: 짧은 줄(들여쓰기 빼고 SHORT자 이하)은 한 번에, 긴 줄은 키 한 번에 opts.speed자(기본 1자)씩.
   Enter → 쓰던 줄을 즉시 끝까지 완성하고 줄 바꿈(코드는 다음 줄 들여쓰기까지). */
const SHORT = 18;
function makeTyper(original, render, kind) {
  let source = original, pos = 0;
  const hist = [];                                   // 키 한 번마다 이전 위치를 쌓음 → Backspace로 되돌림
  const ensure = need => { while (source.length < need + 400) source += '\n\n' + original; };
  const lineEnd = p => { ensure(p + 400); const e = source.indexOf('\n', p); return e < 0 ? source.length : e; };
  const lineStart = p => source.lastIndexOf('\n', p - 1) + 1;
  const indentEnd = p => { while (source[p] === ' ') p++; return p; };
  const isShort = p => source.slice(lineStart(p), lineEnd(p)).trim().length <= SHORT;
  const go = np => { hist.push(pos); ensure(np); pos = np; render(source.slice(0, pos)); };
  // 다음 줄로 넘어가기: 줄바꿈 + (코드면 들여쓰기) + (짧은 줄이면 그 줄 전체)
  const nextLineFrom = p => {
    let np = p + 1;
    if (kind === 'code') np = indentEnd(np);
    if (isShort(np)) np = lineEnd(np);
    return np;
  };
  function one() {                                   // 글자 키 한 번
    ensure(pos + 400);
    if (source[pos] === '\n') {                      // 줄 끝에서 계속 치면 다음 줄로(긴 줄이면 첫 글자까지)
      const np = nextLineFrom(pos);
      go(source[np] === '\n' ? np : Math.min(lineEnd(np), np + opts.speed));
      return;
    }
    if (pos === lineStart(pos) && kind === 'code' && source[pos] === ' ') { go(isShort(pos) ? lineEnd(pos) : indentEnd(pos)); return; }
    if (isShort(pos)) { go(lineEnd(pos)); return; }
    go(Math.min(lineEnd(pos), pos + opts.speed));
  }
  return {
    type: one,
    space: one,                                      // 스페이스도 글자 하나
    enter() { go(nextLineFrom(lineEnd(pos))); },     // 쓰던 줄을 즉시 완성하고 줄 바꿈
    tab() {
      ensure(pos + 50);
      const end = indentEnd(pos);
      go(end > pos ? end : pos + (kind === 'code' ? 4 : 2));
    },
    back() { if (hist.length) { pos = hist.pop(); render(source.slice(0, pos)); } },
    stop() { /* 자동 타이핑이 없어져 멈출 것 없음(화면 정리 호출 호환용) */ }
  };
}

/* ---------- 타자 소리(설정에서 켬, 기본 끔) — 외부 파일 없이 짧은 잡음으로 합성 ---------- */
let keyNoise = null;
function keyClick(kind) {
  if (!opts.keysnd) return;
  const ctx = Sfx.ensure();
  if (!ctx) return;
  try {
    if (!keyNoise) {
      keyNoise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * .04), ctx.sampleRate);
      const d = keyNoise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    }
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = keyNoise;
    f.type = 'bandpass';
    f.frequency.value = kind === 'enter' ? 900 : kind === 'back' ? 1400 : 2200 + Math.random() * 900;
    g.gain.value = kind === 'enter' ? .5 : .32;
    src.connect(f).connect(g).connect(ctx.destination);
    src.start();
    keyClick.played = (keyClick.played || 0) + 1;
  } catch (e) { /* 소리 실패는 무시 */ }
}

/* ---------- 이스터에그: Shift 3번 → 접근 허가/거부 팝업(번갈아) ---------- */
let accessCount = 0, accessTimer = 0;
function accessPopup() {
  const granted = accessCount++ % 2 === 0;
  const old = $('#access');
  if (old) old.remove();
  const el = h(`<div id="access" class="access ${granted ? 'ok' : 'no'}" role="status"><b>${granted ? '접근 허가' : '접근 거부'}</b><span>${granted ? 'ACCESS GRANTED' : 'ACCESS DENIED'}</span></div>`);
  document.body.append(el);
  Sfx.play(granted ? 'ok' : 'bad');
  clearTimeout(accessTimer);
  accessTimer = setTimeout(() => el.remove(), 1600);
}

/* ---------- 키보드·휴대폰 입력 받기 ----------
   숨은 입력칸에 실제로 쳐서, 입력칸 내용의 변화(자모 수 증감·줄바꿈)로 동작을 정함.
   → 한글 조합 중 Backspace, 휴대폰 가상 키보드도 똑같이 처리됨. 입력칸 내용 = "내가 친 내용". */
function jamoLen(str) {
  let n = 0;
  for (const ch of str) {
    const c = ch.charCodeAt(0) - 0xac00;
    n += (c >= 0 && c <= 11171) ? (c % 28 ? 3 : 2) : 1;
  }
  return n;
}
const NAV_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'];

function bindInput(hd, area) {
  const sink = h('<textarea class="sink" aria-label="입력" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"></textarea>');
  document.body.append(sink);
  let rawbar = null;
  if (opts.raw) {
    rawbar = h('<div class="rawbar"><span class="rlab">내가 친 내용</span><span class="rtext" id="rawtext"></span></div>');
    document.body.append(rawbar);
    document.body.classList.add('has-raw');
  }
  let prev = '';
  const showRaw = () => {
    if (!rawbar) return;
    const t = $('#rawtext');
    t.textContent = sink.value.slice(-300).replace(/\n/g, ' ⏎ ').replace(/\t/g, ' ⇥ ');
    t.scrollLeft = t.scrollWidth;
  };
  const addRaw = ch => { sink.value += ch; prev = sink.value; showRaw(); };
  const focus = () => sink.focus({ preventScroll: true });
  let shifts = [];

  sink.addEventListener('keydown', e => {
    const bossEl = $('#boss');
    if (e.key === 'Escape') { e.preventDefault(); if (hd.cancel) hd.cancel(); boss(); return; }
    if (bossEl) {                                    // PDF 뷰어처럼 스크롤만
      const page = $('.pdfpage', bossEl), stepY = { ArrowDown: 60, ArrowUp: -60, PageDown: 500, PageUp: -500, ' ': 500 }[e.key];
      if (stepY) page.scrollBy({ top: stepY });
      e.preventDefault(); return;
    }
    if (e.key === 'Shift') {                         // 글자는 안 만들고, 빠르게 3번이면 이스터에그
      if (!e.repeat) {
        const now = performance.now();
        shifts = shifts.filter(t => now - t < 900).concat(now);
        if (shifts.length >= 3) { shifts = []; accessPopup(); }
      }
      return;
    }
    shifts = [];
    if (e.key === 'Tab') { e.preventDefault(); addRaw('\t'); hd.tab(e.shiftKey); return; }
    if (NAV_KEYS.includes(e.key)) { e.preventDefault(); if (hd.nav) hd.nav(e.key, e.shiftKey, e.ctrlKey || e.metaKey); return; }
    if (e.key === 'Delete') { e.preventDefault(); if (hd.del) hd.del(); return; }
    if (e.key === 'Enter' && hd.enterKey) { e.preventDefault(); addRaw('\n'); hd.enterKey(e.shiftKey); return; }
  });
  sink.addEventListener('input', () => {
    const v = sink.value;
    const d = jamoLen(v) - jamoLen(prev);
    if (d > 0) {
      let k = 0;
      while (k < prev.length && k < v.length && prev[k] === v[k]) k++;
      const added = v.slice(k);
      keyClick(added.includes('\n') ? 'enter' : 'type');
      if (added.includes('\n')) (hd.enterKey || hd.enter)(false);
      else if (/^ +$/.test(added) && hd.space) hd.space();
      else for (let n = 0; n < Math.min(d, 12); n++) hd.type();
    } else if (d < 0) {
      keyClick('back');
      for (let n = 0; n < Math.min(-d, 40); n++) hd.back();
    }
    if (v.length > 4000) sink.value = v.slice(-2000);
    prev = sink.value;
    showRaw();
  });
  const onDown = e => { if (!e.target.closest('.fsbtn, [data-file], [data-subj]')) setTimeout(focus, 0); };
  area.addEventListener('pointerdown', onDown);
  focus();
  return {
    focus,
    off() { sink.remove(); const ac = $('#access'); if (ac) ac.remove(); if (rawbar) rawbar.remove(); document.body.classList.remove('has-raw'); area.removeEventListener('pointerdown', onDown); }
  };
}

/* 보스 키: 완성된 강의자료(PDF 뷰어) 화면 */
function boss() {
  const ex = $('#boss');
  if (ex) { ex.remove(); return; }
  const n = NOTES[opts.subject];
  const el = h(`<div id="boss"><div class="pdfbar"><span>📄 ${esc(n.file)}</span><span class="grow"></span><span>1 / 12</span><span>100%</span></div><div class="pdfpage note-view">${renderMarkup(n.text)}</div><div class="bosshint">Esc 를 다시 누르면 돌아가요</div></div>`);
  el.addEventListener('dblclick', () => el.remove());
  document.body.append(el);
}

/* ---------- 모드 선택 ---------- */
Router.on('/', root => {
  disguise(false);
  root.append(h(`
    <section class="stack lb-home">
      <h1>강의 시간,<br>열공하는 척 끝판왕</h1>
      <p class="muted">모드를 고르고 <b>아무 키나</b> 두드리세요. 화면에는 그럴싸한 필기·코드·표가 착착 써집니다. Backspace는 지워지고, Enter는 줄이 바뀌어요 — 진짜 프로그램처럼.</p>
      <div class="modes">
        <a class="mode card" href="#/note"><div class="mprev note-prev"><i></i><i></i><i></i><i></i></div><b>📓 필기 모드</b><span class="muted small">노트 앱에 강의 필기하는 척</span></a>
        <a class="mode card" href="#/code"><div class="mprev code-prev"><i></i><i></i><i></i><i></i></div><b>💻 코딩 모드</b><span class="muted small">과제 코드 짜는 척</span></a>
        <a class="mode card" href="#/sheet"><div class="mprev sheet-prev"><i></i><i></i><i></i><i></i></div><b>📊 엑셀 모드</b><span class="muted small">팀플 예산 정리하는 척 (방향키·Enter·Tab으로 칸 이동)</span></a>
        <a class="mode card" href="#/paper"><div class="mprev paper-prev"><i></i><i></i><i></i><i></i></div><b>📄 논문 모드</b><span class="muted small">PDF 논문 읽으며 형광펜 긋는 척</span></a>
      </div>
      <div class="card stack">
        <div><label class="field">필기 과목</label><div class="row" id="subj">${Object.entries(NOTES).map(([k, n]) => `<button class="chip ${opts.subject === k ? 'on' : ''}" data-k="${k}">${n.name}</button>`).join('')}</div></div>
        <div><label class="field">긴 줄에서 한 번 누를 때 나오는 글자 수 <b id="spdv">${opts.speed}</b> (짧은 줄은 한 번에 나와요)</label><input type="range" id="spd" min="1" max="4" value="${opts.speed}"></div>
        <label class="row small"><input type="checkbox" id="dis" ${opts.disguise ? 'checked' : ''}> 탭 이름·아이콘을 강의자료 PDF처럼 바꾸기</label>
        <label class="row small"><input type="checkbox" id="raw" ${opts.raw ? 'checked' : ''}> 화면 맨 아래에 내가 실제로 친 내용 한 줄로 보여 주기</label>
        <label class="row small"><input type="checkbox" id="ksnd" ${opts.keysnd ? 'checked' : ''}> 타자 소리 내기 (강의실에서는 끄세요)</label>
      </div>
      <div class="notice"><b>Esc</b> = 보스 키. 누르는 즉시 완성된 강의자료 화면으로 바뀌어요. 휴대폰은 화면을 누르면 키보드가 열려요. <span class="muted">(비밀: Shift를 빠르게 세 번)</span></div>
      <p class="muted small center">교수님 죄송합니다. 이 사이트는 농담입니다. 수업은 들읍시다.</p>
    </section>`));
  $$('#subj .chip').forEach(b => b.onclick = () => { opts.subject = b.dataset.k; saveOpts(); $$('#subj .chip').forEach(x => x.classList.toggle('on', x === b)); });
  $('#spd').oninput = e => { opts.speed = Number(e.target.value); $('#spdv').textContent = opts.speed; saveOpts(); };
  $('#dis').onchange = e => { opts.disguise = e.target.checked; saveOpts(); };
  $('#raw').onchange = e => { opts.raw = e.target.checked; saveOpts(); };
  $('#ksnd').onchange = e => { opts.keysnd = e.target.checked; saveOpts(); if (opts.keysnd) keyClick('type'); };
});

function fullscreenBtn() {
  const b = h('<button class="fsbtn" title="전체 화면">⛶</button>');
  b.onclick = e => { e.stopPropagation(); const d = document.documentElement; if (document.fullscreenElement) document.exitFullscreen(); else (d.requestFullscreen || d.webkitRequestFullscreen || (() => {})).call(d); };
  return b;
}

/* ---------- 필기 모드(노트 앱) — 왼쪽 노트 목록을 누르면 과목이 바뀜(쓰던 내용은 과목별로 남음) ---------- */
Router.on('/note', root => {
  document.body.classList.add('mode-on');
  root.append(h(`
    <section class="app note-app">
      <aside class="side"><div class="sidehead">내 노트</div>${Object.entries(NOTES).map(([k, x]) => `<button type="button" class="sideitem" data-subj="${k}">${esc(x.name)}</button>`).join('')}<div class="sideitem">기말 정리</div><div class="sideitem">팀플 회의록</div></aside>
      <div class="paper"><div class="meta muted small" id="nmeta"></div><div class="note-view" id="out"><span class="caret"></span></div></div>
    </section>`));
  root.append(fullscreenBtn());
  const out = $('#out'), paper = $('.paper');
  const typers = {};
  let cur;
  const draw = txt => {
    out.innerHTML = renderMarkup(txt);
    const last = out.lastElementChild;
    (last || out).insertAdjacentHTML('beforeend', '<span class="caret"></span>');
    paper.scrollTop = paper.scrollHeight;
  };
  function open(k) {
    if (!NOTES[k]) k = 'biz';
    opts.subject = k; saveOpts();
    const n = NOTES[k];
    disguise(opts.disguise, n.file);
    $('#nmeta').textContent = `${new Date().toLocaleDateString('ko-KR')} · ${n.name}`;
    $$('.side [data-subj]').forEach(b => { b.classList.toggle('on', b.dataset.subj === k); b.setAttribute('aria-current', b.dataset.subj === k ? 'page' : 'false'); });
    if (!typers[k]) typers[k] = { text: '', t: makeTyper(n.text, txt => { typers[k].text = txt; if (cur === typers[k]) draw(txt); }, 'note') };
    cur = typers[k];
    draw(cur.text);
  }
  open(opts.subject);
  const io = bindInput({ type: () => cur.t.type(), space: () => cur.t.space(), enter: () => cur.t.enter(), tab: () => cur.t.tab(), back: () => cur.t.back() }, paper);
  $$('.side [data-subj]').forEach(b => b.onclick = () => { open(b.dataset.subj); io.focus(); });
  return () => { io.off(); document.body.classList.remove('mode-on'); disguise(false); };
});

/* ---------- 코딩 모드(코드 편집기) — 파일 탐색기·탭을 눌러 파일을 바꿔 가며 침(파일마다 쓰던 내용 유지) ---------- */
function highlightMd(text) {
  return text.split('\n').map((line, i) => {
    let html = esc(line);
    if (/^#/.test(line)) html = `<span class="kw">${html}</span>`;
    else if (/^ {4}/.test(line)) html = `<span class="st">${html}</span>`;
    else if (/^- /.test(line)) html = `<span class="dc">-</span>${esc(line.slice(1))}`;
    return `<div class="ln"><i>${i + 1}</i><span>${html}</span></div>`;
  }).join('');
}
const CODE_FILES = [
  { name: 'timetable.py', icon: '🐍', lang: 'Python', src: () => CODE, hl: highlightPy },
  { name: 'test_timetable.py', icon: '🧪', lang: 'Python', src: () => TEST_CODE, hl: highlightPy },
  { name: 'README.md', icon: '📝', lang: 'Markdown', src: () => README_MD, hl: highlightMd }
];
Router.on('/code', root => {
  document.body.classList.add('mode-on', 'dark');
  root.append(h(`
    <section class="app code-app">
      <aside class="explorer"><div class="exhead">탐색기</div><div class="exfolder">▾ 과제3</div>${CODE_FILES.map((f, i) => `<button type="button" class="exfile" data-file="${i}">${f.icon} ${esc(f.name)}</button>`).join('')}<div class="exfile dim">📁 data</div><div class="exfile dim">⚙ requirements.txt</div></aside>
      <div class="codemain">
        <div class="tabs" role="tablist">${CODE_FILES.map((f, i) => `<button type="button" class="tab" role="tab" data-file="${i}">${esc(f.name)}</button>`).join('')}</div>
        <div class="editor" id="ed"><span class="caret"></span></div>
        <div class="statusbar"><span id="lc">줄 1, 열 1</span><span>공백: 4</span><span>UTF-8</span><span id="lang">Python</span></div>
        <div class="term" id="term"><div class="termhead">터미널</div><div id="tl"></div></div>
      </div>
    </section>`));
  root.append(fullscreenBtn());
  const ed = $('#ed'), tl = $('#tl'), term = $('#term');
  let shownTerm = -1, curIdx = 0;
  const texts = CODE_FILES.map(() => '');
  function draw() {
    const f = CODE_FILES[curIdx], txt = texts[curIdx];
    ed.innerHTML = f.hl(txt);
    const lastLine = $$('.ln > span', ed).pop();
    if (lastLine) lastLine.insertAdjacentHTML('beforeend', '<span class="caret"></span>');
    ed.scrollTop = ed.scrollHeight;
    const lines = txt.split('\n');
    $('#lc').textContent = `줄 ${lines.length}, 열 ${lines[lines.length - 1].length + 1}`;
    // 터미널은 세 파일을 친 양을 합쳐서 조금씩 늘어남(지우면 같이 줄어듦)
    const total = texts.reduce((s, x) => s + (x ? x.split('\n').length : 0), 0);
    const want = Math.min(TERMINAL_LINES.length, Math.floor(total / 14) * 2);
    if (want !== shownTerm) {
      shownTerm = want;
      tl.innerHTML = TERMINAL_LINES.slice(0, want).map(x => `<div class="tl">${esc(x)}</div>`).join('');
      term.scrollTop = term.scrollHeight;
    }
  }
  const typers = CODE_FILES.map((f, i) => makeTyper(f.src(), txt => { texts[i] = txt; if (i === curIdx) draw(); }, 'code'));
  function open(i) {
    curIdx = (i + CODE_FILES.length) % CODE_FILES.length;
    const f = CODE_FILES[curIdx];
    disguise(opts.disguise, `${f.name} — 과제3`);
    $('#lang').textContent = f.lang;
    $$('[data-file]').forEach(b => {
      const on = Number(b.dataset.file) === curIdx;
      b.classList.toggle('on', on);
      if (b.classList.contains('tab')) b.setAttribute('aria-selected', String(on));
    });
    draw();
  }
  const t = () => typers[curIdx];
  const io = bindInput({
    type: () => t().type(), space: () => t().space(), enter: () => t().enter(), tab: () => t().tab(), back: () => t().back(),
    nav(key, shift, ctrl) { if (ctrl && key === 'PageDown') open(curIdx + 1); else if (ctrl && key === 'PageUp') open(curIdx - 1); }   // 편집기처럼 Ctrl+PageDown/PageUp으로 탭 이동
  }, ed);
  $$('[data-file]').forEach(b => b.onclick = () => { open(Number(b.dataset.file)); io.focus(); });
  open(0);
  return () => { io.off(); document.body.classList.remove('mode-on', 'dark'); disguise(false); };
});

/* ---------- 논문 모드(PDF 뷰어) — 문단을 다 쓰면 형광펜이 저절로 그어짐 ---------- */
function paperLine(line, done) {
  let cls = 'pp', body = line;
  if (line.startsWith('# ')) { cls = 'pt'; body = line.slice(2); }
  else if (line.startsWith('## ')) { cls = 'ps'; body = line.slice(3); }
  else if (line.startsWith('@ ')) { cls = 'pa'; body = line.slice(2); }
  else if (line.startsWith('> ')) { cls = 'pab'; body = line.slice(2); }
  // 쓰는 중인 줄은 형광펜 표시 없이, 줄을 다 쓰면 형광펜이 그어지는 애니메이션
  body = esc(body).replace(/==(.+?)(==|$)/g, done ? '<mark class="hl">$1</mark>' : '$1');
  return `<div class="${cls}">${body || '&nbsp;'}</div>`;
}
Router.on('/paper', root => {
  disguise(opts.disguise, PAPER.file);
  document.body.classList.add('mode-on', 'pdfmode');
  root.append(h(`
    <section class="app paper-app">
      <div class="pdfbar"><span>📄 ${esc(PAPER.file)}</span><span class="grow"></span><span id="pg">1 / ${PAPER.pages}</span><span>−</span><span>100%</span><span>+</span><span title="형광펜">🖍</span></div>
      <div class="pdfbody">
        <aside class="thumbs">${Array.from({ length: PAPER.pages }, (_, i) => `<div class="thumb ${i ? '' : 'on'}"><i></i><i></i><i></i><span>${i + 1}</span></div>`).join('')}</aside>
        <div class="pdfscroll" id="psc"><div class="pdfsheet"><div id="pout"></div><div class="pnum" id="pnum">- 1 -</div></div></div>
      </div>
    </section>`));
  root.append(fullscreenBtn());
  const pout = $('#pout'), psc = $('#psc');
  const t = makeTyper(PAPER.text, txt => {
    const lines = txt.split('\n');
    const doneCount = lines.length - 1;              // 마지막 줄을 뺀 나머지는 다 쓴 줄
    // 다 쓴 줄은 그대로 두고(형광펜 애니메이션이 한 번만 나오게), 늘거나 줄어든 만큼만 고침
    const old = $('.cur', pout);
    if (old) old.remove();                           // 쓰는 중인 줄은 매번 새로 그림
    while (pout.children.length > doneCount) pout.lastElementChild.remove();
    for (let i = pout.children.length; i < doneCount; i++) pout.insertAdjacentHTML('beforeend', paperLine(lines[i], true));
    pout.insertAdjacentHTML('beforeend', paperLine(lines[doneCount], false));
    const cur = pout.lastElementChild;
    cur.classList.add('cur');
    cur.insertAdjacentHTML('beforeend', '<span class="caret"></span>');
    psc.scrollTop = psc.scrollHeight;
    const page = clamp(Math.floor(doneCount / 4) + 1, 1, PAPER.pages);
    $('#pg').textContent = `${page} / ${PAPER.pages}`;
    $('#pnum').textContent = `- ${page} -`;
    $$('.thumb').forEach((x, i) => x.classList.toggle('on', i === page - 1));
  }, 'note');
  const io = bindInput({
    type: t.type, space: t.space, enter: t.enter, tab: t.tab, back: t.back,
    nav(key) { const y = { ArrowDown: 60, ArrowUp: -60, PageDown: 500, PageUp: -500 }[key]; if (y) psc.scrollBy({ top: y }); }
  }, psc);
  return () => { io.off(); document.body.classList.remove('mode-on', 'pdfmode'); disguise(false); };
});

/* ---------- 엑셀 모드(스프레드시트) ---------- */
Router.on('/sheet', root => {
  disguise(opts.disguise, SHEET.title);
  document.body.classList.add('mode-on');
  const COLS = SHEET.cols.length, ROWS = SHEET.rows.length, MONTHS = COLS - 2;
  const colName = c => String.fromCharCode(65 + c);
  const values = SHEET.rows.map((_, r) => Array.from({ length: MONTHS }, (_, c) => Math.round((20 + ((r * 37 + c * 53) % 90)) * 100) * 10));
  // 각 칸에 "치면 써질 내용"을 정해 둠: 항목명 / 숫자 / 합계 수식
  const plan = (r, c) => c === 0 ? SHEET.rows[r] : c <= MONTHS ? String(values[r][c - 1]) : `=SUM(B${r + 2}:${colName(MONTHS)}${r + 2})`;
  const cell = Array.from({ length: ROWS }, () => Array(COLS).fill(null));   // 확정된 원본(숫자 문자열·수식·글자)
  let sel = { r: 0, c: 0 }, editing = false, editText = '', hist = [];
  const perKey = () => opts.speed;

  root.append(h(`
    <section class="app sheet-app">
      <div class="ribbon"><span class="on">홈</span><span>삽입</span><span>페이지 레이아웃</span><span>수식</span><span>데이터</span><span>검토</span></div>
      <div class="fx"><span class="cellref" id="ref">A2</span><span class="fxi">fx</span><span id="fx" class="fxv"></span></div>
      <div class="gridwrap"><table class="grid" id="grid">
        <thead><tr><th class="corner"></th>${SHEET.cols.map((_, c) => `<th data-ch="${c}">${colName(c)}</th>`).join('')}</tr>
        <tr class="hdr"><th>1</th>${SHEET.cols.map(c => `<td>${c}</td>`).join('')}</tr></thead>
        <tbody>${SHEET.rows.map((_, r) => `<tr><th data-rh="${r}">${r + 2}</th>${SHEET.cols.map((_, c) => `<td data-r="${r}" data-c="${c}"></td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>
      <div class="chartbox"><div class="ctitle">월별 지출</div><div class="cbars" id="cb">${Array.from({ length: MONTHS }, (_, i) => `<div class="cb"><i style="height:0%"></i><span>${SHEET.cols[i + 1]}</span></div>`).join('')}</div></div>
      <div class="sheettabs"><span class="on">예산</span><span>회의록</span><span>+</span></div>
    </section>`));
  root.append(fullscreenBtn());
  const td = (r, c) => $(`#grid td[data-r="${r}"][data-c="${c}"]`);
  const num = v => (v != null && v !== '' && !isNaN(Number(v))) ? Number(v) : 0;
  const rowSum = r => cell[r].slice(1, MONTHS + 1).reduce((s, v) => s + num(v), 0);
  function shown(r, c) {
    const v = cell[r][c];
    if (v == null) return '';
    if (String(v).startsWith('=')) return rowSum(r).toLocaleString('ko-KR');
    return c > 0 && !isNaN(Number(v)) ? Number(v).toLocaleString('ko-KR') : v;
  }
  function paintCell(r, c) {
    const el = td(r, c), isSel = r === sel.r && c === sel.c;
    const v = cell[r][c];
    el.textContent = isSel && editing ? editText : shown(r, c);
    el.classList.toggle('num', !(isSel && editing) && c > 0 && v != null);
    el.classList.toggle('sum', c === COLS - 1 && v != null);
    el.classList.toggle('sel', isSel);
    el.classList.toggle('edit', isSel && editing);
  }
  function paintAll() {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) paintCell(r, c);
    $('#ref').textContent = colName(sel.c) + (sel.r + 2);
    $('#fx').textContent = editing ? editText : (cell[sel.r][sel.c] ?? '');
    $$('#grid th[data-ch]').forEach(th => th.classList.toggle('hl', Number(th.dataset.ch) === sel.c));
    $$('#grid th[data-rh]').forEach(th => th.classList.toggle('hl', Number(th.dataset.rh) === sel.r));
    const totals = Array.from({ length: MONTHS }, (_, m) => cell.reduce((s, row) => s + num(row[m + 1]), 0));
    const max = Math.max(1, ...Array.from({ length: MONTHS }, (_, m) => values.reduce((s, row) => s + row[m], 0)));
    $$('#cb .cb i').forEach((bar, m) => { bar.style.height = (totals[m] / max * 100) + '%'; });
    const el = td(sel.r, sel.c);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function commit() {
    if (!editing) return;
    // 친 만큼만 저장하면 어색하므로, 한 글자라도 쳤으면 그 칸에 정해진 내용을 끝까지 채워 확정
    cell[sel.r][sel.c] = editText.length ? plan(sel.r, sel.c) : null;
    editing = false; editText = ''; hist = [];
  }
  function move(dr, dc) {
    commit();
    sel = { r: clamp(sel.r + dr, 0, ROWS - 1), c: clamp(sel.c + dc, 0, COLS - 1) };
    paintAll();
  }
  const hd = {
    type() {
      if (!editing) { editing = true; editText = ''; hist = []; }
      const full = plan(sel.r, sel.c);
      if (editText.length >= full.length) {          // 다 쳤는데 계속 치면 오른쪽 칸으로 넘어가 이어서 씀
        commit();
        if (sel.c < COLS - 1) sel = { r: sel.r, c: sel.c + 1 }; else sel = { r: Math.min(sel.r + 1, ROWS - 1), c: 0 };
        editing = true; editText = ''; hist = [];
      }
      const f = plan(sel.r, sel.c);
      hist.push(editText.length);
      editText = f.slice(0, Math.min(f.length, editText.length + perKey()));
      paintAll();
    },
    back() {                                         // 편집 중이면 한 글자씩 지움, 아니면 칸을 비우고 편집 시작(엑셀과 같음)
      if (editing) { editText = hist.length ? editText.slice(0, hist.pop()) : ''; }
      else { cell[sel.r][sel.c] = null; editing = true; editText = ''; hist = []; }
      paintAll();
    },
    del() { editing = false; editText = ''; hist = []; cell[sel.r][sel.c] = null; paintAll(); },
    enterKey(shift) { move(shift ? -1 : 1, 0); },
    enter() { move(1, 0); },
    tab(shift) { move(0, shift ? -1 : 1); },
    nav(key) {
      const m = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], PageUp: [-10, 0], PageDown: [10, 0] }[key];
      if (m) move(m[0], m[1]);
      else if (key === 'Home') move(0, -sel.c);
      else if (key === 'End') move(0, COLS - 1 - sel.c);
    },
    cancel() { if (editing) { editing = false; editText = ''; hist = []; paintAll(); } }
  };
  const io = bindInput(hd, $('.gridwrap'));
  $('#grid').addEventListener('click', e => {
    const c = e.target.closest('td[data-r]');
    if (!c) return;
    commit();
    sel = { r: Number(c.dataset.r), c: Number(c.dataset.c) };
    paintAll();
  });
  $('#grid').addEventListener('dblclick', () => { if (!editing) { editing = true; editText = cell[sel.r][sel.c] ?? ''; hist = []; paintAll(); } });
  paintAll();
  return () => { io.off(); document.body.classList.remove('mode-on'); disguise(false); };
});

Router.start($('#app'));
