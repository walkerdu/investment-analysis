/*!
 * page-enhance.js — 报告页面增强：左侧站点导航 + 右侧 TOC 目录
 * 由 sync-pages.py 自动注入到 pages/*.html
 * 依赖：同级目录的 ../config.json（fetch 读取报告列表）
 */
(function () {
  'use strict';

  /* ===== 1. 注入增强 CSS ===== */
  var css = [
    '/* ===== Site Nav（左侧站点导航）===== */',
    '.site-nav {',
    '  position: fixed; left: 0; top: 64px; bottom: 0;',
    '  width: 220px; overflow-y: auto; z-index: 90;',
    '  background: var(--bg-primary, #F7F5F3);',
    '  border-right: 1px solid var(--border, #E5E2DE);',
    '  padding: 20px 14px; font-size: 0.82rem;',
    '  scrollbar-width: thin; scrollbar-color: var(--border) transparent;',
    '}',
    '.site-nav::-webkit-scrollbar { width: 4px; }',
    '.site-nav::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }',
    '.site-nav-back {',
    '  display: block; font-weight: 600; font-size: 0.82rem;',
    '  color: var(--accent, #D97706); margin-bottom: 18px;',
    '  padding-bottom: 12px; border-bottom: 1px solid var(--border-light, #F0EEEC);',
    '  text-decoration: none;',
    '}',
    '.site-nav-back:hover { color: var(--accent-hover, #B45309); }',
    '.site-nav-label {',
    '  font-size: 0.68rem; letter-spacing: 0.18em; color: var(--text-muted, #8A8480);',
    '  font-weight: 600; text-transform: uppercase; margin-bottom: 10px;',
    '}',
    '.site-nav-list { list-style: none; padding: 0; margin: 0; }',
    '.site-nav-item {',
    '  display: block; padding: 9px 11px; border-radius: 8px;',
    '  color: var(--text-secondary, #5C5652); text-decoration: none;',
    '  margin-bottom: 3px; transition: all 0.2s; border-left: 3px solid transparent;',
    '}',
    '.site-nav-item:hover { background: var(--bg-elevated, #FAFAF9); color: var(--accent, #D97706); }',
    '.site-nav-item.active {',
    '  background: var(--accent-light, #FEF3C7); color: var(--accent, #D97706);',
    '  font-weight: 600; border-left-color: var(--accent, #D97706);',
    '}',
    '.site-nav-title { display: block; font-size: 0.82rem; line-height: 1.4; }',
    '.site-nav-meta { display: block; font-size: 0.7rem; color: var(--text-muted, #8A8480); margin-top: 3px; }',
    '',
    '/* ===== TOC Sidebar（右侧目录，若页面未内置则自动生成）===== */',
    '.toc-sidebar {',
    '  position: fixed; right: 28px; top: 88px;',
    '  width: 220px; max-height: calc(100vh - 120px); overflow-y: auto;',
    '  font-size: 0.82rem; line-height: 1.55; z-index: 50;',
    '  scrollbar-width: thin; scrollbar-color: var(--border) transparent;',
    '}',
    '.toc-sidebar::-webkit-scrollbar { width: 4px; }',
    '.toc-sidebar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }',
    '.toc-sidebar::before {',
    '  content: "目录 · INDEX"; display: block;',
    '  font-size: 0.7rem; letter-spacing: 0.18em; color: var(--text-muted);',
    '  font-weight: 600; text-transform: uppercase;',
    '  margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border-light);',
    '}',
    '.toc-item {',
    '  display: block; padding: 5px 0 5px 12px;',
    '  color: var(--text-muted); border-left: 2px solid var(--border-light);',
    '  transition: all 0.2s; cursor: pointer; text-decoration: none;',
    '  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;',
    '}',
    '.toc-item:hover { color: var(--accent); border-left-color: var(--accent); }',
    '.toc-item.active { color: var(--accent); border-left-color: var(--accent); font-weight: 600; background: var(--accent-light); border-radius: 0 4px 4px 0; }',
    '.toc-item.toc-sub { padding-left: 24px; font-size: 0.76rem; color: var(--text-light); }',
    '.toc-item.toc-sub.active { color: var(--accent); background: transparent; }',
    '',
    '/* ===== 布局调整：宽屏时为左右导航留位 ===== */',
    '@media (min-width: 1201px) {',
    '  body { margin-left: 220px; margin-right: 250px; }',
    '}',
    '@media (max-width: 1200px) {',
    '  .site-nav { display: none; }',
    '  .toc-sidebar { display: none; }',
    '}'
  ].join('\n');
  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ===== 2. 工具函数 ===== */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function currentPath() {
    var p = location.pathname;
    // 取最后一段 path，如 /pages/xxx.html → xxx.html
    var parts = p.split('/');
    return parts[parts.length - 1];
  }

  /* ===== 3. 左侧站点导航 ===== */
  function buildSiteNav(config) {
    var pages = (config.pages || []).slice().sort(function (a, b) {
      return (b.date || '').localeCompare(a.date || '');
    });
    var cur = currentPath();

    var nav = document.createElement('aside');
    nav.className = 'site-nav';
    nav.id = 'siteNav';

    var html = '';
    html += '<a href="../index.html" class="site-nav-back">← 投资研究 · 分析聚合</a>';
    html += '<div class="site-nav-label">所有报告 · ' + pages.length + ' 篇</div>';
    html += '<ul class="site-nav-list">';
    pages.forEach(function (p) {
      var pathParts = (p.path || '').split('/');
      var fileName = pathParts[pathParts.length - 1];
      var isCurrent = fileName === cur;
      var cls = isCurrent ? 'site-nav-item active' : 'site-nav-item';
      var cat = p.category || '';
      html += '<li><a href="' + fileName + '" class="' + cls + '">';
      html += '<span class="site-nav-title">' + escapeHtml(p.title || p.id) + '</span>';
      html += '<span class="site-nav-meta">' + escapeHtml(p.date || '') + ' · ' + escapeHtml(cat) + '</span>';
      html += '</a></li>';
    });
    html += '</ul>';
    nav.innerHTML = html;

    document.body.insertBefore(nav, document.body.firstChild);
  }

  /* ===== 4. 右侧 TOC（若页面未内置则自动生成）===== */
  function buildTOC() {
    var existing = document.getElementById('tocSidebar');
    if (existing) {
      // 已有 TOC 容器但可能没填充（shell.html 模板里的 JS 会填充）
      // 如果已填充则跳过，否则填充
      if (existing.children.length === 0) {
        fillTOC(existing);
      }
      return;
    }
    var toc = document.createElement('aside');
    toc.className = 'toc-sidebar';
    toc.id = 'tocSidebar';
    // 插入到 body 开头（site-nav 之后）
    var siteNav = document.getElementById('siteNav');
    if (siteNav && siteNav.nextSibling) {
      document.body.insertBefore(toc, siteNav.nextSibling);
    } else {
      document.body.appendChild(toc);
    }
    fillTOC(toc);
  }

  function fillTOC(toc) {
    var items = [];
    var labelMap = { conclusion: '01 结论', voices: '02 视角', thinking: '03 思考', watch: '04 关注' };
    document.querySelectorAll('section[id]').forEach(function (sec) {
      var label = labelMap[sec.id] || sec.id;
      items.push({ id: sec.id, label: label, sub: false });
      if (sec.id === 'voices') {
        sec.querySelectorAll('.voice-card').forEach(function (card, i) {
          var name = card.querySelector('.voice-name');
          if (name) {
            var sid = 'toc-voice-' + i;
            card.id = sid;
            items.push({ id: sid, label: name.textContent.trim(), sub: true });
          }
        });
      }
      if (sec.id === 'thinking') {
        sec.querySelectorAll('.note-item').forEach(function (note, i) {
          var h4 = note.querySelector('.note-body h4');
          if (h4) {
            var sid = 'toc-note-' + i;
            note.id = sid;
            items.push({ id: sid, label: h4.textContent.trim(), sub: true });
          }
        });
        sec.querySelectorAll('.qa-card').forEach(function (qa, i) {
          var q = qa.querySelector('.qa-question');
          if (q) {
            var sid = 'toc-qa-' + i;
            qa.id = sid;
            var t = q.textContent.trim();
            if (t.length > 22) t = t.slice(0, 22) + '…';
            items.push({ id: sid, label: t, sub: true });
          }
        });
      }
    });
    items.forEach(function (it) {
      var a = document.createElement('a');
      a.className = 'toc-item' + (it.sub ? ' toc-sub' : '');
      a.href = '#' + it.id;
      a.textContent = it.label;
      a.title = it.label;
      toc.appendChild(a);
    });
    // scrollspy
    var targets = items.map(function (it) { return document.getElementById(it.id); }).filter(Boolean);
    var links = Array.prototype.slice.call(toc.querySelectorAll('.toc-item'));
    function onScroll() {
      var y = window.scrollY + 140;
      var active = 0;
      for (var i = 0; i < targets.length; i++) {
        if (targets[i] && targets[i].offsetTop <= y) active = i;
      }
      links.forEach(function (l, i) { l.classList.toggle('active', i === active); });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ===== 5. 初始化 ===== */
  function init() {
    // 先建右侧 TOC（不依赖网络）
    buildTOC();
    // 再 fetch config.json 建左侧站点导航
    fetch('../config.json')
      .then(function (r) { return r.json(); })
      .then(function (config) { buildSiteNav(config); })
      .catch(function (e) { console.warn('[page-enhance] site nav 加载失败:', e); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
