/*!
 * page-enhance.js — 报告页面增强：左侧站点导航 + 右侧 TOC 目录
 * 由 sync-pages.py 自动注入到 pages/*.html
 * 依赖：同级目录的 ../config.json（fetch 读取报告列表）
 * v3: SPA 导航样式隔离修复 — 切换时迁移 head 资源 + 清理旧 style + 强制重注入增强 CSS
 */
(function () {
  'use strict';

  var cssInjected = false;
  var configCache = null;
  var clickHandlerInstalled = false;
  var scrollHandler = null;

  /* ===== 1. 注入增强 CSS ===== */
  var CSS_TEXT = [
    '/* ===== Site Nav ===== */',
    '.site-nav {',
    '  position: fixed !important; left: 0 !important; top: 64px !important; bottom: 0 !important;',
    '  width: 220px !important; overflow-y: auto; z-index: 90;',
    '  background: var(--bg-primary, #F7F5F3);',
    '  border-right: 1px solid var(--border, #E5E2DE);',
    '  padding: 20px 14px; font-size: 0.82rem;',
    '  scrollbar-width: thin; scrollbar-color: var(--border) transparent;',
    '}',
    '.site-nav::-webkit-scrollbar { width: 4px; }',
    '.site-nav::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }',
    '.site-nav-back {',
    '  display: block; font-weight: 600; font-size: 0.82rem;',
    '  color: var(--accent, #D97706) !important; margin-bottom: 18px;',
    '  padding-bottom: 12px; border-bottom: 1px solid var(--border-light, #F0EEEC);',
    '  text-decoration: none;',
    '}',
    '.site-nav-back:hover { color: var(--accent-hover, #B45309) !important; }',
    '.site-nav-label {',
    '  font-size: 0.68rem; letter-spacing: 0.18em; color: var(--text-muted, #8A8480);',
    '  font-weight: 600; text-transform: uppercase; margin-bottom: 10px;',
    '}',
    '.site-nav-list { list-style: none; padding: 0; margin: 0; }',
    '.site-nav-item {',
    '  display: block; padding: 9px 11px; border-radius: 8px;',
    '  color: var(--text-secondary, #5C5652) !important; text-decoration: none !important;',
    '  margin-bottom: 3px; transition: all 0.2s; border-left: 3px solid transparent;',
    '  cursor: pointer;',
    '}',
    '.site-nav-item:hover { background: var(--bg-elevated, #FAFAF9) !important; color: var(--accent, #D97706) !important; }',
    '.site-nav-item.active {',
    '  background: var(--accent-light, #FEF3C7) !important; color: var(--accent, #D97706) !important;',
    '  font-weight: 600; border-left-color: var(--accent, #D97706) !important;',
    '}',
    '.site-nav-title { display: block; font-size: 0.82rem; line-height: 1.4; }',
    '.site-nav-meta { display: block; font-size: 0.7rem; color: var(--text-muted, #8A8480); margin-top: 3px; }',
    '',
    '/* ===== TOC Sidebar ===== */',
    '.toc-sidebar {',
    '  position: fixed !important; right: 28px !important; top: 88px !important;',
    '  width: 220px !important; max-height: calc(100vh - 120px); overflow-y: auto;',
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
    '  color: var(--text-muted) !important; border-left: 2px solid var(--border-light);',
    '  transition: all 0.2s; cursor: pointer; text-decoration: none !important;',
    '  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;',
    '}',
    '.toc-item:hover { color: var(--accent) !important; border-left-color: var(--accent) !important; }',
    '.toc-item.active { color: var(--accent) !important; border-left-color: var(--accent) !important; font-weight: 600; background: var(--accent-light); border-radius: 0 4px 4px 0; }',
    '.toc-item.toc-sub { padding-left: 24px; font-size: 0.76rem; color: var(--text-light); }',
    '.toc-item.toc-sub.active { color: var(--accent) !important; background: transparent; }',
    '',
    '/* ===== SPA 过渡 ===== */',
    'body { transition: opacity 0.12s ease; }',
    'body.pe-loading { opacity: 0.3; }',
    '',
    '/* ===== 布局 ===== */',
    '@media (min-width: 1201px) {',
    '  body { margin-left: 220px !important; margin-right: 250px !important; }',
    '}',
    '@media (max-width: 1200px) {',
    '  .site-nav { display: none !important; }',
    '  .toc-sidebar { display: none !important; }',
    '}'
  ].join('\n');

  /* 注入增强 CSS，force=true 时强制重新注入（SPA 切换后使用）*/
  function injectCSS(force) {
    if (!force && cssInjected) return;
    cssInjected = true;
    // 清理之前从其他页面迁移来的 style 标签，避免累积
    // 保留 page-enhance 自身的 (#pe-enhance-css)、Google Fonts、以及外部 link
    document.querySelectorAll('head > style:not(#pe-enhance-css)').forEach(function (el) {
      el.remove();
    });
    var el = document.createElement('style');
    el.id = 'pe-enhance-css';
    el.textContent = CSS_TEXT;
    document.head.appendChild(el);
  }

  /* ===== 2. 工具函数 ===== */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* 当前页面文件名（URL 解码后），如 "2026-06-26-物理AI.html" */
  function currentFileName() {
    var p = location.pathname;
    var parts = p.split('/');
    return decodeURIComponent(parts[parts.length - 1]);
  }

  /* ===== 3. 左侧站点导航 ===== */
  function buildSiteNav(config) {
    var old = document.getElementById('siteNav');
    if (old) old.remove();

    var pages = (config.pages || []).slice().sort(function (a, b) {
      return (b.date || '').localeCompare(a.date || '');
    });
    var cur = currentFileName();

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
      if (!isCurrent && location.href.indexOf(encodeURIComponent(fileName)) !== -1) {
        isCurrent = true;
      }
      var cls = isCurrent ? 'site-nav-item active' : 'site-nav-item';
      var cat = p.category || '';
      html += '<li><a href="' + fileName + '" class="' + cls + '" data-href="' + escapeHtml(fileName) + '">';
      html += '<span class="site-nav-title">' + escapeHtml(p.title || p.id) + '</span>';
      html += '<span class="site-nav-meta">' + escapeHtml(p.date || '') + ' · ' + escapeHtml(cat) + '</span>';
      html += '</a></li>';
    });
    html += '</ul>';
    nav.innerHTML = html;

    document.body.insertBefore(nav, document.body.firstChild);
    var activeItem = nav.querySelector('.site-nav-item.active');
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'center' });
    }
  }

  /* ===== 4. 右侧 TOC ===== */
  function buildTOC() {
    var old = document.getElementById('tocSidebar');
    if (old) old.remove();

    var toc = document.createElement('aside');
    toc.className = 'toc-sidebar';
    toc.id = 'tocSidebar';
    document.body.appendChild(toc);
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
    toc.innerHTML = '';
    items.forEach(function (it) {
      var a = document.createElement('a');
      a.className = 'toc-item' + (it.sub ? ' toc-sub' : '');
      a.href = '#' + it.id;
      a.textContent = it.label;
      a.title = it.label;
      toc.appendChild(a);
    });
    if (scrollHandler) {
      window.removeEventListener('scroll', scrollHandler);
    }
    var targets = items.map(function (it) { return document.getElementById(it.id); }).filter(Boolean);
    var links = Array.prototype.slice.call(toc.querySelectorAll('.toc-item'));
    scrollHandler = function () {
      var y = window.scrollY + 140;
      var active = 0;
      for (var i = 0; i < targets.length; i++) {
        if (targets[i] && targets[i].offsetTop <= y) active = i;
      }
      links.forEach(function (l, i) { l.classList.toggle('active', i === active); });
    };
    window.addEventListener('scroll', scrollHandler, { passive: true });
    scrollHandler();
  }

  /* ===== 5. 页面导航（整页跳转）===== */
  // 各页面是独立完整的 HTML 文档，有各自的 CSS 变量体系和全局样式，
  // SPA 式 body.innerHTML 替换会导致不同页面的 CSS 互相污染，
  // 所以直接用整页跳转，让浏览器正确加载各页面独立的样式。
  function navigateTo(fileName, config) {
    if (fileName === currentFileName()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    location.href = fileName;
  }

  function setupClickHandler(config) {
    if (clickHandlerInstalled) return;
    clickHandlerInstalled = true;
    document.addEventListener('click', function (e) {
      var navLink = e.target.closest('a.site-nav-item');
      if (navLink) {
        e.preventDefault();
        var fileName = navLink.getAttribute('data-href') || navLink.getAttribute('href');
        navigateTo(fileName, config);
        return;
      }
      var tocLink = e.target.closest('a.toc-item');
      if (tocLink) {
        e.preventDefault();
        var href = tocLink.getAttribute('href');
        if (href && href.charAt(0) === '#') {
          var target = document.getElementById(href.slice(1));
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
        return;
      }
    });
  }

  /* ===== 6. 初始化 ===== */
  function init() {
    injectCSS();
    buildTOC();
    if (configCache) {
      buildSiteNav(configCache);
      setupClickHandler(configCache);
    } else {
      fetch('../config.json')
        .then(function (r) { return r.json(); })
        .then(function (config) {
          configCache = config;
          buildSiteNav(config);
          setupClickHandler(config);
        })
        .catch(function (e) { console.warn('[page-enhance] site nav 加载失败:', e); });
    }
  }

  var spaPath = location.pathname;
  window.addEventListener('popstate', function () {
    if (location.pathname !== spaPath) {
      location.reload();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
