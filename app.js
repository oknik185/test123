'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---- Данные полей (единая структура) ----
const MAIN = [
  ['gsm', 'GSM', 'gsm'], ['width', 'Ширина материала', 'mm'], ['speedPct', 'Скорость линии', '%'],
  ['speedMm', 'Скорость линии', 'm/min'], ['moisture', 'Влажность', '%'], ['calcGsm', 'Расчётный GSM', 'gsm'],
  ['measGsm', 'Измеренный GSM', 'gsm'], ['tLD', 'Tõmbetest LD', 'N'], ['tCD', 'Tõmbetest CD', 'N'],
  ['date', 'Дата', '', 'd'], ['comment', 'Комментарий', '', 'a']
].map(([k, l, u, t]) => ({ k, l, u, t: t || 'n' }));

const EDS = [['su', 'Suction Pa', 'Pa'], ['pb', 'Pressure Box Pa', 'Pa'], ['tf', 'Transport Fan %', '%'],
  ['od', 'Outlet draft %', '%'], ['to', 'Take-Off draft %', '%'], ['c1', 'Compacting #1 %', '%'],
  ['c2', 'Compacting #2 %', '%'], ['lh', 'Left hood %', '%'], ['rh', 'Right hood %', '%'],
  ['cbl', 'Compacting box L', '%'], ['cbs', 'Compacting box SET', '%'], ['cbr', 'Compacting box R', '%']];
const EFO = [['ff', 'Feedroll Fast %', '%'], ['df', 'Doffer %', '%']];
// [id, заголовок, [[ключ, подпись, единица, тип(t=текст,b=вкл/выкл)]]]
const SECS = [
  ['bl', 'BLENDOMAT', [['pu', 'Puuvill', '', 't'], ['mix', 'Mix', '']]],
  ['te', 'TEHAS', [['nm', 'Niiskus %', '%'], ['tp', 'Temp.', '']]],
  ['cn', 'CANALAIR', [['nm', 'Niiskus %', '%'], ['tp', 'Temp.', '']]],
  ['lu', 'LUWA', [['nm', 'Niiskus %', '%'], ['tp', 'Temperatuur', '']]],
  ['se', 'SECUROP', [['fr', 'Feedroll RPM', 'RPM'], ['bf', 'BR-CO fan RPM', 'RPM'], ['dc', 'BR-CO Dust Cage RPM', 'RPM']]],
  ['e1', 'EFO1', EFO], ['e2', 'EFO2', EFO],
  ['d1', 'EDS1', EDS], ['d2', 'EDS2', EDS],
  ['cd', 'CARD', [['gsm', 'GSM', 'gsm'], ['dr', 'Draft %', '%']]],
  ['al', 'AIRLAY', [['gsm', 'GSM', 'gsm'], ['bf', 'Blowerfan RPM', 'RPM'], ['sf', 'Suctionfan RPM', 'RPM'],
    ['a', 'Ilemise laba mootor %', '%'], ['b', 'Ilumise laba mootor %', '%']]],
  ['aq', 'AQUAJET', [['j11', 'JetHead 1.1 Bar', 'Bar'], ['j12', 'JetHead 1.2 Bar', 'Bar'], ['j21', 'JetHead 2.1 Bar', 'Bar'],
    ['j22', 'JetHead 2.2 Bar', 'Bar'], ['j31', 'JetHead 3.1 Bar', 'Bar'], ['m21', 'JetHead 2.1 mm', 'mm'],
    ['m31', 'JetHead 3.1 mm', 'mm'], ['s1', 'SF1 fan %', '%'], ['s2', 'SF2 fan %', '%'],
    ['sc', 'Scorpio ON/OFF', '', 'b'], ['st', 'Scorpio Temp.', ''], ['pi', 'Pingutus daN', 'daN'],
    ['r1', 'Ratio #1 %', '%'], ['r2', 'Ratio #2 %', '%'], ['r3', 'Ratio #3 %', '%'], ['r4', 'Ratio #4 %', '%']]],
  ['dy', 'DRYER', [['tp', 'Temperatuur', ''], ['ex', 'Exhaust %', '%'], ['ci', 'Circulation %', '%'],
    ['pi', 'Pingutus daN', 'daN'], ['rd', 'Ratio Drum %', '%'], ['ro', 'Ratio Outlet %', '%']]],
  ['ba', 'BASTIAN', [['re', 'Retsept', '', 't']]]
].map(([id, title, f]) => ({ id, title, fields: f.map(([k, l, u, t]) => ({ k: id + '.' + k, l, u, t: t || 'n' })) }));

// ---- Хранилище ----
const KEY = 'pr_recipes';
const now = () => new Date().toISOString();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const save = () => localStorage.setItem(KEY, JSON.stringify(R));
let R;
try { R = JSON.parse(localStorage.getItem(KEY)); } catch { R = null; }
if (!Array.isArray(R)) { R = []; save(); }

// ---- Тема ----
const theme = () => localStorage.getItem('pr_theme') || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
const applyTheme = () => { document.documentElement.dataset.theme = theme(); };
applyTheme();

// ---- Состояние ----
let q = '', gf = '', dirty = false, draft = null, cur = location.hash;
const fmt = d => d ? new Date(d).toLocaleDateString('ru-RU') : '';
const find = id => R.find(r => r.id === id);

function route() {
  const h = location.hash.slice(1) || '/', p = h.split('/');
  return { v: p[1] || 'list', id: p[2] };
}
addEventListener('hashchange', () => {
  if (location.hash === cur) return;
  if (dirty && !confirm('Выйти без сохранения изменений?')) { location.hash = cur; return; }
  dirty = false; cur = location.hash; render();
});
const go = h => { dirty = false; if (location.hash === h) render(); else location.hash = h; };

// ---- Рендер ----
function render() {
  const { v, id } = route();
  const app = $('#app');
  app.oninput = app.onchange = null;
  $('#nav').classList.toggle('off', v === 'e');
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.t === (v === 'r' ? 'list' : v === '' ? 'list' : v)));
  window.scrollTo(0, 0);
  if (v === 'set') return settings(app);
  if (v === 'r') { const r = find(id); return r ? view(app, r) : go('#/'); }
  if (v === 'e') {
    const r = id === 'new' ? (draft || { name: '', v: { date: new Date().toISOString().slice(0, 10) } }) : find(id);
    return r ? edit(app, r, id) : go('#/');
  }
  list(app, v === 'fav');
}

function list(app, fav) {
  const gsms = [...new Set(R.map(r => r.v.gsm).filter(Boolean))].sort((a, b) => a - b);
  app.innerHTML = `<h1>${fav ? 'Избранное' : 'Production Recipes'}</h1>
  <div class="bar"><input id="q" type="search" placeholder="Поиск по названию" value="${esc(q)}">
  <select id="gf"><option value="">Все GSM</option>${gsms.map(g => `<option ${g === gf ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></div>
  <div id="lst"></div>${fav ? '' : '<button class="fab" id="add">+</button>'}`;
  const draw = () => {
    const x = q.trim().toLowerCase();
    const a = R.filter(r => (!fav || r.fav) && (!gf || r.v.gsm === gf) && r.name.toLowerCase().includes(x))
      .sort((a, b) => b.modified.localeCompare(a.modified));
    $('#lst').innerHTML = a.length ? a.map(r => `<div class="rc" data-id="${r.id}"><div class="t"><b>${esc(r.name)}</b>
      <small>${r.v.gsm ? 'GSM ' + esc(r.v.gsm) + ' · ' : ''}${fmt(r.modified)}</small></div>
      <button class="star ${r.fav ? 'on' : ''}" data-s="${r.id}">${r.fav ? '★' : '☆'}</button></div>`).join('')
      : '<p class="empty">Нет рецептов</p>';
  };
  draw();
  $('#q').oninput = e => { q = e.target.value; draw(); };
  $('#gf').onchange = e => { gf = e.target.value; draw(); };
  $('#lst').onclick = e => {
    const s = e.target.closest('[data-s]');
    if (s) { const r = find(s.dataset.s); r.fav = !r.fav; save(); return draw(); }
    const c = e.target.closest('.rc'); if (c) go('#/r/' + c.dataset.id);
  };
  if (!fav) $('#add').onclick = () => { draft = null; go('#/e/new'); };
}

function view(app, r) {
  const kv = f => r.v[f.k] === undefined || r.v[f.k] === '' ? '' :
    `<div class="kv ${f.t === 'a' ? 'w' : ''}"><small>${f.l}${f.u ? ', ' + f.u : ''}</small>${f.t === 'b' ? 'ON' : f.t === 'd' ? fmt(r.v[f.k]) : esc(r.v[f.k])}</div>`;
  const secs = SECS.map(s => { const h = s.fields.map(kv).join(''); return h ? `<details><summary>${s.title}</summary><div class="in2 grid">${h}</div></details>` : ''; }).join('');
  app.innerHTML = `<div class="top"><button class="back" id="bk">←</button><h1>${esc(r.name)}</h1>
  <button class="star ${r.fav ? 'on' : ''}" id="fv">${r.fav ? '★' : '☆'}</button></div>
  <div class="grid">${MAIN.map(kv).join('')}</div>${secs}
  <small class="info">Создан: ${fmt(r.created)} · Изменён: ${fmt(r.modified)}</small>
  <div class="row"><button class="btn" id="ed">Изменить</button><button class="btn s" id="cp">Копировать</button></div>
  <div class="row"><button class="btn d" id="dl">Удалить</button></div>`;
  $('#bk').onclick = () => history.length > 1 ? history.back() : go('#/');
  $('#fv').onclick = () => { r.fav = !r.fav; save(); render(); };
  $('#ed').onclick = () => go('#/e/' + r.id);
  $('#cp').onclick = () => { draft = { name: r.name + ' (копия)', v: { ...r.v } }; go('#/e/new'); };
  $('#dl').onclick = () => { if (confirm('Удалить рецепт «' + r.name + '»?')) { R = R.filter(x => x !== r); save(); go('#/'); } };
}

function input(f, val) {
  if (f.t === 'b') return `<label class="chk"><input type="checkbox" data-k="${f.k}" ${val ? 'checked' : ''}> ${f.l}</label>`;
  const u = f.u ? `<i>${f.u}</i>` : '';
  const el = f.t === 'a' ? `<textarea data-k="${f.k}">${esc(val)}</textarea>`
    : `<input data-k="${f.k}" value="${esc(val)}" ${f.t === 'd' ? 'type="date"' : f.t === 'n' ? 'type="text" inputmode="decimal" autocomplete="off"' : 'type="text"'}>`;
  return `<label class="fld"><span>${f.l}</span><div class="in">${el}${u}</div></label>`;
}

function edit(app, r, id) {
  const V = r.v;
  app.innerHTML = `<div class="top"><button class="back" id="bk">←</button><h1>${id === 'new' ? 'Новый рецепт' : 'Редактирование'}</h1></div>
  <label class="fld"><span>Название рецепта *</span><div class="in"><input id="nm" value="${esc(r.name)}" autocomplete="off"></div></label>
  ${MAIN.map(f => input(f, V[f.k])).join('')}
  ${SECS.map(s => `<details><summary>${s.title}</summary><div class="in2">${s.fields.map(f => input(f, V[f.k])).join('')}</div></details>`).join('')}
  <div class="save"><button class="btn s" id="cn">Отмена</button><button class="btn" id="sv">Сохранить</button></div>`;
  dirty = false;
  app.oninput = app.onchange = () => { dirty = true; };
  $('#bk').onclick = $('#cn').onclick = () => history.length > 1 ? history.back() : go(id === 'new' ? '#/' : '#/r/' + id);
  $('#sv').onclick = () => {
    const name = $('#nm').value.trim();
    if (!name) { alert('Введите название рецепта'); $('#nm').focus(); return; }
    const v = {};
    app.querySelectorAll('[data-k]').forEach(el => {
      if (el.type === 'checkbox') { if (el.checked) v[el.dataset.k] = true; }
      else if (el.value.trim() !== '') v[el.dataset.k] = el.value.trim();
    });
    let rec = id === 'new' ? null : find(id);
    if (!rec) { rec = { id: uid(), fav: false, created: now() }; R.push(rec); }
    Object.assign(rec, { name, v, modified: now() });
    save(); draft = null; dirty = false; cur = '#/r/' + rec.id; location.replace(cur); render();
  };
}

function settings(app) {
  app.innerHTML = `<h1>Настройки</h1><div class="set">
  <button class="btn s" id="th">Тема: ${theme() === 'dark' ? 'тёмная' : 'светлая'}</button>
  <button class="btn" id="ex">Export (сохранить в JSON)</button>
  <button class="btn s" id="im">Import (загрузить из JSON)</button>
  <p class="info">Рецептов: ${R.length}. Данные хранятся только на этом телефоне. При импорте существующие рецепты не удаляются.</p></div>`;
  $('#th').onclick = () => { localStorage.setItem('pr_theme', theme() === 'dark' ? 'light' : 'dark'); applyTheme(); render(); };
  $('#ex').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ app: 'production-recipes', recipes: R }, null, 1)], { type: 'application/json' }));
    a.download = 'recipes-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
  };
  $('#im').onclick = () => $('#file').click();
}

$('#file').onchange = async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    const arr = Array.isArray(d) ? d : d && Array.isArray(d.recipes) ? d.recipes : null;
    if (!arr || !arr.every(r => r && typeof r.name === 'string' && r.name && r.v && typeof r.v === 'object' && !Array.isArray(r.v))) throw 0;
    if (!confirm(`Импортировать рецептов: ${arr.length}?\nСуществующие рецепты сохранятся (совпадающие по ID будут обновлены).`)) return;
    arr.forEach(r => {
      const rec = { id: String(r.id || uid()), name: r.name, fav: !!r.fav, created: r.created || now(), modified: r.modified || now(), v: r.v };
      const i = R.findIndex(x => x.id === rec.id);
      if (i >= 0) R[i] = rec; else R.push(rec);
    });
    save(); alert('Импортировано: ' + arr.length); render();
  } catch { alert('Некорректный файл. Нужен JSON, созданный функцией Export.'); }
};

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
render();
