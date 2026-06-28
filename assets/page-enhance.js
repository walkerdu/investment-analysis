/*!
 * page-enhance.js — 报告页面增强：左侧站点导航 + 右侧 TOC 目录
 * 由 sync-pages.py 自动注入到 pages/*.html
 * 依赖：同级目录的 ../config.json（fetch 读取报告列表）
 * v2: SPA 导航（不整页刷新）+ 高亮修复（URL 解码）
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
    '  cursor: pointer;',
    '}',
    '.site-nav-item:hover { background: var(--bg-elevated, #FAFAF9); color: var(--accent, #D97706); }',
    '.site-nav-item.active {',
    '  background: var(--accent-light, #FEF3C7); color: var(--accent, #D97706);',
    '  font-weight: 600; border-left-color: var(--accent, #D97706);',
    '}',
    '.site-nav-title { display: block; font-size: 0.82rem; line-height: 1.4; }',
    '.site-nav-meta { display: block; font-size: 0.7rem; color: var(--text-muted, #8A8480); margin-top: 3px; }',
    '',
    '/* ===== TOC Sidebar ===== */',
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
    '/* ===== SPA 过渡 ===== */',
    'body { transition: opacity 0.12s ease; }',
    'body.pe-loading { opacity: 0.3; }',
    '',
    '/* ===== 布局 ===== */',
    '@media (min-width: 1201px) {',
    '  body { margin-left: 220px; margin-right: 250px; }',
    '}',
    '@media (max-width: 1200px) {',
    '  .site-nav { display: none; }',
    '  .toc-sidebar { display: none; }',
    '}'
  ].join('\n');

  function injectCSS() {
    if (cssInjected) return;
    cssInjected = true;
    var el = document.createElement('style');
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
    // 移除旧的
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
      // 后备：URL 包含文件名（处理编码差异）
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
    // 滚动到当前报告位置（首次加载时当前报告可能在导航视口外）
    var activeItem = nav.querySelector('.site-nav-item.active');
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'center' });
    }
  }

  /* ===== 4. 右侧 TOC ===== */
  function buildTOC() {
    // 移除旧的
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
    // scrollspy（清理旧 handler 避免重复绑定）
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

  /* ===== 5. SPA 导航（不整页刷新）===== */
  function navigateTo(fileName, config) {
    if (fileName === currentFileName()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    document.body.classList.add('pe-loading');
    fetch(encodeURI(fileName))
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        // 替换 body 内容
        document.body.innerHTML = doc.body.innerHTML;
        document.title = doc.title;
        // 更新 URL
        history.pushState({ file: fileName }, '', fileName);
        // 重建 TOC 和站点导航
        buildTOC();
        buildSiteNav(config);
        // 滚动到顶部
        window.scrollTo(0, 0);
        document.body.classList.remove('pe-loading');
      })
      .catch(function (e) {
        console.warn('[page-enhance] SPA 导航失败，回退整页跳转:', e);
        location.href = fileName;
      });
  }

  function setupClickHandler(config) {
    if (clickHandlerInstalled) return;
    clickHandlerInstalled = true;
    // 事件委托：拦截 site-nav-item 点击
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a.site-nav-item');
      if (!link) return;
      e.preventDefault();
      var fileName = link.getAttribute('data-href') || link.getAttribute('href');
      navigateTo(fileName, config);
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

  // 浏览器前进/后退
  window.addEventListener('popstate', function () {
    location.reload();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
