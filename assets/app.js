/* ============================================================
   投资研究 · 分析聚合 — 主站逻辑
   读取 config.json，渲染卡片网格，支持分类/标签/搜索/排序
   ============================================================ */

(function () {
  'use strict';

  var state = {
    config: null,
    activeCat: 'all',
    activeTag: 'all',
    query: '',
    sort: 'date-desc'
  };

  var $ = function (sel) { return document.querySelector(sel); };
  var els = {};

  function cacheEls() {
    els.siteTitle = $('#site-title');
    els.siteDesc  = $('#site-desc');
    els.stats     = $('#stats');
    els.catChips  = $('#cat-chips');
    els.tagChips  = $('#tag-chips');
    els.sort      = $('#sort');
    els.count     = $('#result-count');
    els.grid      = $('#grid');
    els.empty     = $('#empty');
    els.search    = $('#search');
    els.reset     = $('#reset-filters');
  }

  /* ---------- Loading & error ---------- */
  function showLoading() {
    els.grid.innerHTML =
      '<div class="loading" style="grid-column:1/-1">' +
      '<div class="spinner"></div><p>正在加载分析目录…</p></div>';
  }
  function showError(msg, hint) {
    els.grid.innerHTML =
      '<div class="error-box" style="grid-column:1/-1">' +
      '<h3>无法加载配置</h3>' +
      '<p>' + msg + '</p>' +
      (hint ? '<p>' + hint + '</p>' : '') +
      '<p>配置文件位置：<code>config.json</code></p></div>';
  }

  /* ---------- Fetch config ---------- */
  function loadConfig() {
    showLoading();
    fetch('config.json', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (cfg) { state.config = cfg; init(); })
      .catch(function (e) {
        var hint = (location.protocol === 'file:')
          ? '检测到你正在用 file:// 直接打开本页面。<code>fetch</code> 在 file 协议下会被浏览器禁止。请用本地服务器预览：在 <code>invest-hub</code> 目录下运行 <code>python3 -m http.server 8080</code>，然后访问 <code>http://localhost:8080</code>。'
          : '请确认 <code>config.json</code> 与 <code>index.html</code> 在同一目录，且格式正确。';
        showError('读取 config.json 失败：' + e.message, hint);
      });
  }

  /* ---------- Init ---------- */
  function init() {
    var cfg = state.config;
    if (els.siteTitle && cfg.site && cfg.site.title) els.siteTitle.textContent = cfg.site.title;
    if (els.siteDesc  && cfg.site && cfg.site.description) els.siteDesc.textContent = cfg.site.description;
    document.title = (cfg.site && cfg.site.title) || '投资研究 · 分析聚合';

    renderStats();
    renderCatChips();
    renderTagChips();
    bindEvents();
    render();
  }

  /* ---------- Helpers ---------- */
  function catMap() {
    var m = {};
    (state.config.categories || []).forEach(function (c) { m[c.id] = c; });
    return m;
  }
  function catName(id) { var c = catMap()[id]; return c ? c.name : id; }
  function catColor(id) { var c = catMap()[id]; return c ? (c.color || '#D97706') : '#D97706'; }

  function allTags() {
    var freq = {};
    (state.config.pages || []).forEach(function (p) {
      (p.tags || []).forEach(function (t) { freq[t] = (freq[t] || 0) + 1; });
    });
    return Object.keys(freq)
      .map(function (t) { return { tag: t, count: freq[t] }; })
      .sort(function (a, b) { return b.count - a.count || a.tag.localeCompare(b.tag, 'zh'); });
  }

  function tagCounts() {
    var freq = {};
    (state.config.pages || []).forEach(function (p) {
      (p.tags || []).forEach(function (t) { freq[t] = (freq[t] || 0) + 1; });
    });
    return freq;
  }
  function catCounts() {
    var freq = {};
    (state.config.pages || []).forEach(function (p) { freq[p.category] = (freq[p.category] || 0) + 1; });
    return freq;
  }

  function fmtDate(d) {
    if (!d) return '';
    var parts = String(d).split('-');
    if (parts.length < 3) return d;
    return parts[1] + '月' + parts[2] + '日 · ' + parts[0];
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------- Render: stats ---------- */
  function renderStats() {
    var pages = state.config.pages || [];
    var cats = (state.config.categories || []).filter(function (c) {
      return pages.some(function (p) { return p.category === c.id; });
    });
    var tags = allTags();
    var latest = pages.reduce(function (acc, p) {
      return (!acc || (p.date && p.date > acc)) ? p.date : acc;
    }, '');

    var stats = [
      { num: pages.length, label: '篇分析' },
      { num: cats.length,  label: '个分类' },
      { num: tags.length,  label: '个标签' },
      { num: latest ? latest.slice(5).replace('-', '/') : '—', label: '最新更新' }
    ];
    els.stats.innerHTML = stats.map(function (s) {
      return '<div class="stat"><div class="stat-num">' + escapeHtml(s.num) +
             '</div><div class="stat-label">' + escapeHtml(s.label) + '</div></div>';
    }).join('');
  }

  /* ---------- Render: category chips ---------- */
  function renderCatChips() {
    var counts = catCounts();
    var html = chip('all', '全部', state.config.pages.length, state.activeCat === 'all', null);
    (state.config.categories || []).forEach(function (c) {
      var cnt = counts[c.id] || 0;
      if (cnt === 0) return;
      html += chip(c.id, c.name, cnt, state.activeCat === c.id, c.color);
    });
    els.catChips.innerHTML = html;
  }

  /* ---------- Render: tag chips ---------- */
  function renderTagChips() {
    var counts = tagCounts();
    var html = chip('all', '全部', state.config.pages.length, state.activeTag === 'all', null);
    allTags().forEach(function (t) {
      html += chip('tag:' + t.tag, t.tag, t.count, state.activeTag === t.tag, null);
    });
    els.tagChips.innerHTML = html;
  }

  function chip(value, label, count, active, color) {
    var dot = color ? '<span class="chip-dot" style="background:' + color + '"></span>' : '';
    return '<button class="chip' + (active ? ' active' : '') + '" data-value="' + escapeHtml(value) + '">' +
           dot + escapeHtml(label) +
           '<span class="chip-count">' + count + '</span></button>';
  }

  /* ---------- Filter + sort ---------- */
  function filtered() {
    var q = state.query.trim().toLowerCase();
    var list = (state.config.pages || []).filter(function (p) {
      if (state.activeCat !== 'all' && p.category !== state.activeCat) return false;
      if (state.activeTag !== 'all' && !(p.tags || []).some(function (t) { return t === state.activeTag; })) return false;
      if (q) {
        var hay = [p.title, p.summary, catName(p.category), (p.tags || []).join(' ')].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    switch (state.sort) {
      case 'date-asc':
        list.sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); });
        break;
      case 'title':
        list.sort(function (a, b) { return (a.title || '').localeCompare(b.title || '', 'zh'); });
        break;
      case 'category':
        list.sort(function (a, b) {
          var c = catName(a.category).localeCompare(catName(b.category), 'zh');
          return c !== 0 ? c : (b.date || '').localeCompare(a.date || '');
        });
        break;
      default: /* date-desc */
        list.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    }
    return list;
  }

  /* ---------- Render: grid ---------- */
  function render() {
    var list = filtered();
    els.count.textContent = '共 ' + list.length + ' 篇';

    if (list.length === 0) {
      els.grid.innerHTML = '';
      els.empty.hidden = false;
      return;
    }
    els.empty.hidden = true;

    els.grid.innerHTML = list.map(function (p, i) {
      var color = catColor(p.category);
      var tags = (p.tags || []).slice(0, 5).map(function (t) {
        return '<span class="card-tag">' + escapeHtml(t) + '</span>';
      }).join('');
      var href = escapeHtml(p.path || '#');
      var target = (p.path && /^https?:/.test(p.path)) ? '_blank' : '_self';
      return '' +
        '<a class="card" href="' + href + '" target="' + target + '" rel="noopener" ' +
        'style="--card-color:' + color + '; animation-delay:' + (i * 30) + 'ms" ' +
        'data-id="' + escapeHtml(p.id || '') + '">' +
          '<div class="card-head">' +
            '<span class="card-cat">' + escapeHtml(catName(p.category)) + '</span>' +
            '<span class="card-date">' + escapeHtml(fmtDate(p.date)) + '</span>' +
          '</div>' +
          '<div class="card-body">' +
            '<h3 class="card-title">' + escapeHtml(p.title) + '</h3>' +
            (p.summary ? '<p class="card-summary">' + escapeHtml(p.summary) + '</p>' : '') +
          '</div>' +
          (tags ? '<div class="card-tags">' + tags + '</div>' : '') +
          '<div class="card-foot">' +
            '<span class="card-read">阅读全文 ' +
              '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' +
            '</span>' +
            '<span class="card-id">' + escapeHtml(p.id || '') + '</span>' +
          '</div>' +
        '</a>';
    }).join('');
  }

  /* ---------- Events ---------- */
  function bindEvents() {
    // category & tag chips (event delegation)
    els.catChips.addEventListener('click', function (e) {
      var btn = e.target.closest('.chip'); if (!btn) return;
      state.activeCat = btn.dataset.value;
      renderCatChips();
      render();
    });
    els.tagChips.addEventListener('click', function (e) {
      var btn = e.target.closest('.chip'); if (!btn) return;
      var v = btn.dataset.value;
      state.activeTag = v.indexOf('tag:') === 0 ? v.slice(4) : 'all';
      renderTagChips();
      render();
    });

    // search (debounced)
    var t;
    els.search.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () { state.query = els.search.value; render(); }, 120);
    });

    // sort
    els.sort.addEventListener('change', function () {
      state.sort = els.sort.value;
      render();
    });

    // reset
    els.reset.addEventListener('click', function () {
      state.activeCat = 'all'; state.activeTag = 'all'; state.query = '';
      els.search.value = ''; els.sort.value = 'date-desc'; state.sort = 'date-desc';
      renderCatChips(); renderTagChips(); render();
    });

    // "/" focus search
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.activeElement !== els.search) {
        e.preventDefault(); els.search.focus();
      }
      if (e.key === 'Escape' && document.activeElement === els.search) {
        els.search.blur();
      }
    });
  }

  /* ---------- Boot ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    cacheEls();
    loadConfig();
  });
})();
