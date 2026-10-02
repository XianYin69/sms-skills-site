/* app.js — SMS 技能矩阵 · 纯原生 JS · 零依赖 · UTF-8 无 BOM */
(function () {
  'use strict';
  var DATA_URL = 'data/skills.json';
  var state = { items: [], cats: [], q: '', cat: '' };

  /* styles.css 未覆盖卡片/控件类，注入最小补充样式（复用其 CSS 变量） */
  var EXTRA_CSS = [
    '.controls{max-width:1100px;margin:0 auto;padding:0 clamp(16px,4vw,48px);display:flex;flex-direction:column;gap:12px}',
    '#q{width:100%;padding:11px 14px;border-radius:12px;border:1px solid var(--line);background:var(--bg2);color:var(--fg);font:inherit}',
    '#q:focus{outline:2px solid var(--acc);outline-offset:1px}',
    '.chips{display:flex;gap:8px;flex-wrap:wrap}',
    '.chip{padding:5px 12px;border-radius:999px;border:1px solid var(--line);background:var(--bg2);color:var(--dim);font-size:13px;cursor:pointer}',
    '.chip[aria-pressed="true"]{border-color:var(--acc);color:var(--acc)}',
    'main{max-width:1100px;margin:0 auto;padding:22px clamp(16px,4vw,48px) 40px}',
    '.group{margin:0 0 26px}',
    '.group>h2{font-size:14px;color:var(--dim);font-family:var(--mono);margin:0 0 12px;padding-bottom:6px;border-bottom:1px solid var(--line)}',
    '#grid{display:block}',
    '.grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(290px,1fr))}',
    '.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:8px}',
    '.card h3{margin:0;font-size:16px;font-family:var(--mono);word-break:break-word}',
    '.card .cat{font-size:12px;color:var(--acc)}',
    '.card p{margin:0;font-size:13px;color:var(--dim);display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}',
    '.card .meta{margin-top:auto;display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--dim);font-family:var(--mono)}',
    '.empty{color:var(--dim);font-size:14px}',
    '.arch{margin-top:34px}.arch h2{font-size:20px;margin:0 0 14px}',
    '.layers{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}',
    '.layer{background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:12px 14px;font-size:13px;color:var(--dim)}',
    '.layer b{display:block;color:var(--acc2);font-family:var(--mono)}',
    '.note{margin-top:14px;font-size:13px;color:var(--dim);border-left:3px solid var(--warn);padding-left:10px}',
    'footer{display:flex;gap:16px;flex-wrap:wrap;justify-content:space-between;padding:18px clamp(16px,4vw,48px);border-top:1px solid var(--line);font-size:13px;color:var(--dim)}',
    '.alert{max-width:1100px;margin:16px auto;padding:12px 16px;border:1px solid var(--warn);border-radius:12px;background:rgba(240,163,94,.1);color:var(--warn);font-size:14px}',
    '.alert code{font-family:var(--mono);color:var(--fg)}'
  ].join('\n');

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }

  /* 字段兼容：需求字段 repo/visibility/updated_at/kind 与实际 url/pushed/lang 并存 */
  function repoOf(it) { return it.repo || it.url || it.html_url || ''; }
  function dateOf(it) { return String(it.updated_at || it.pushed || it.updated || '').slice(0, 10); }
  function visOf(it) { return String(it.visibility || 'PUBLIC').toUpperCase(); }
  function starsOf(it) { var n = parseInt(it.stars, 10); return isNaN(n) ? 0 : n; }
  function kindOf(it) { return it.kind || it.lang || ''; }

  function match(it, kw) {
    if (!kw) { return true; }
    var hay = (it.name + ' ' + (it.desc || '') + ' ' + (it.category || '')).toLowerCase();
    return hay.indexOf(kw) !== -1;
  }

  function visible() {
    var kw = state.q.trim().toLowerCase();
    return state.items.filter(function (it) {
      if (state.cat && it.category !== state.cat) { return false; }
      return match(it, kw);
    });
  }

  function renderStats(list) {
    var box = $('stats');
    if (!box) { return; }
    box.textContent = '';
    var cats = {};
    var stars = 0;
    list.forEach(function (it) { cats[it.category] = 1; stars += starsOf(it); });
    [[list.length, '技能'], [Object.keys(cats).length, '类别'], [stars, 'Stars']].forEach(function (p) {
      var d = el('div', 'stat');
      d.appendChild(el('b', null, String(p[0])));
      d.appendChild(el('span', null, p[1]));
      box.appendChild(d);
    });
  }

  function renderChips() {
    var box = $('chips');
    if (!box) { return; }
    box.textContent = '';
    var all = el('button', 'chip');
    all.textContent = '全部';
    all.setAttribute('aria-pressed', state.cat ? 'false' : 'true');
    all.addEventListener('click', function () { state.cat = ''; refresh(); });
    box.appendChild(all);
    state.cats.forEach(function (c) {
      var b = el('button', 'chip');
      b.textContent = c;
      b.setAttribute('aria-pressed', state.cat === c ? 'true' : 'false');
      b.addEventListener('click', function () { state.cat = c; refresh(); });
      box.appendChild(b);
    });
  }

  function card(it) {
    var a = el('article', 'card');
    a.appendChild(el('h3', null, it.name));
    a.appendChild(el('span', 'cat', it.category + (kindOf(it) ? ' · ' + kindOf(it) : '')));
    a.appendChild(el('p', null, (it.desc || '').replace(/\s+/g, ' ').trim()));
    var meta = el('div', 'meta');
    meta.appendChild(el('span', null, '★ ' + starsOf(it)));
    var d = dateOf(it);
    if (d) { meta.appendChild(el('span', null, d)); }
    var url = repoOf(it);
    if (url) {
      var link = el('a', null, 'repo ↗');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      meta.appendChild(link);
    }
    a.appendChild(meta);
    return a;
  }

  function renderGrid() {
    var box = $('grid'), empty = $('empty');
    if (!box) { return; }
    var list = visible();
    box.textContent = '';
    var shown = 0;
    state.cats.forEach(function (c) {
      var sub = list.filter(function (it) { return it.category === c; });
      if (!sub.length) { return; }
      shown += sub.length;
      var g = el('section', 'group');
      g.appendChild(el('h2', null, c + '（' + sub.length + '）'));
      var grid = el('div', 'grid');
      sub.forEach(function (it) { grid.appendChild(card(it)); });
      g.appendChild(grid);
      box.appendChild(g);
    });
    if (empty) { empty.hidden = shown !== 0; }
    renderStats(list);
  }

  function renderFoot(meta) {
    var f = $('foot');
    if (!f) { return; }
    var pub = state.items.filter(function (it) { return visOf(it) === 'PUBLIC'; }).length;
    var gen = (meta && meta.generated) || '未知';
    f.textContent = '共 ' + pub + ' 个 PUBLIC 仓库 · 生成于 ' + gen + ' · SMS skill_manage_system';
  }

  function refresh() { renderChips(); renderGrid(); }

  function fail(msg) {
    var box = $('grid');
    if (!box) { return; }
    box.textContent = '';
    var a = el('div', 'alert');
    a.appendChild(document.createTextNode('技能数据加载失败：' + msg + '。'));
    a.appendChild(el('br'));
    a.appendChild(document.createTextNode('请在本目录起本地服务后访问：'));
    a.appendChild(el('code', null, 'python -m http.server 8000'));
    a.appendChild(document.createTextNode(' 然后打开 http://127.0.0.1:8000/（直接以 file:// 打开会被浏览器拦截 fetch）。'));
    box.appendChild(a);
    var e = $('empty');
    if (e) { e.hidden = true; }
  }

  function bindSearch() {
    var q = $('q');
    if (!q) { return; }
    q.addEventListener('input', function () { state.q = q.value; renderGrid(); });
    document.addEventListener('keydown', function (ev) {
      var tag = (ev.target && ev.target.tagName || '').toLowerCase();
      if (ev.key === '/' && tag !== 'input' && tag !== 'textarea') {
        ev.preventDefault(); q.focus(); q.select();
      } else if (ev.key === 'Escape' && (document.activeElement === q || state.q)) {
        q.value = ''; state.q = ''; renderGrid(); q.blur();
      }
    });
  }

  function boot() {
    if (!document.getElementById('fd-extra')) {
      var s = document.createElement('style');
      s.id = 'fd-extra';
      s.textContent = EXTRA_CSS;
      document.head.appendChild(s);
    }
    bindSearch();
  }

  function load() {
    if (location.protocol === 'file:') {
      fail('当前以 file:// 打开，浏览器不允许 fetch 本地 JSON');
      return;
    }
    fetch(DATA_URL, { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) { throw new Error('HTTP ' + r.status); }
        return r.json();
      })
      .then(function (data) {
        state.items = data.items || [];
        var cats = data.categories || [];
        state.items.forEach(function (it) {
          if (cats.indexOf(it.category) === -1) { cats.push(it.category); }
        });
        state.cats = cats;
        refresh();
        renderFoot(data);
      })
      .catch(function (err) { fail(err.message || String(err)); });
  }

  boot();
  load();
})();
