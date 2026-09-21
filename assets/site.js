/* Progressive enhancement: every page is readable without JavaScript. */
(() => {
  'use strict';
  const root = document.documentElement;
  const themeButton = document.querySelector('.theme-toggle');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const menuButton = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('#site-nav');
  let toastTimer;

  function notify(message) {
    const toast = document.querySelector('#toast');
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('show');
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 3200);
  }

  function syncTheme() {
    const dark = root.dataset.theme === 'dark';
    if (themeButton) {
      themeButton.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
      themeButton.setAttribute('title', dark ? 'Switch to light theme' : 'Switch to dark theme');
    }
    if (themeMeta) themeMeta.setAttribute('content', dark ? '#191d19' : '#f6f5f1');
  }
  syncTheme();
  themeButton?.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('dh-profile-theme', root.dataset.theme); } catch (_) { /* Private/file mode. */ }
    syncTheme();
  });

  function closeMenu(restoreFocus = false) {
    navigation?.classList.remove('is-open');
    menuButton?.setAttribute('aria-expanded', 'false');
    menuButton?.setAttribute('aria-label', 'Open navigation');
    if (restoreFocus) menuButton?.focus();
  }
  menuButton?.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    navigation?.classList.toggle('is-open', open);
  });
  navigation?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => closeMenu()));
  document.addEventListener('click', event => {
    if (!event.target.closest('.site-header')) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') closeMenu(true);
  });
  window.matchMedia('(min-width: 621px)').addEventListener('change', event => {
    if (event.matches) closeMenu();
  });

  async function copyText(text) {
    // Clipboard API requires a secure context. Fall back for a file:// preview.
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(text); return true; } catch (_) { /* Try fallback. */ }
    }
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;left:0;top:0;opacity:0;width:1px;height:1px;';
    // Keep the fallback inside the active dialog, outside content is inert.
    const parent = document.querySelector('dialog[open]') || document.body;
    const previousFocus = document.activeElement;
    parent.append(area);
    area.focus();
    area.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch (_) { /* Manual fallback message below. */ }
    area.remove();
    previousFocus?.focus();
    return copied;
  }
  document.querySelectorAll('[data-copy-text]').forEach(button => {
    button.addEventListener('click', async () => {
      const success = await copyText(button.dataset.copyText || '');
      notify(success ? 'Email address copied.' : 'Copy unavailable. Please select the email address manually.');
    });
  });

  const dialog = document.querySelector('#citation-dialog');
  const citationTitle = document.querySelector('#citation-title');
  const citationCode = document.querySelector('#citation-code');
  document.querySelectorAll('[data-cite]').forEach(button => {
    button.addEventListener('click', () => {
      const entry = window.PROFILE_CITATIONS?.[button.dataset.cite];
      if (!entry || !dialog) { notify('Citation metadata is unavailable.'); return; }
      citationTitle.textContent = entry.title;
      citationCode.textContent = entry.bibtex;
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else { notify('Please use a browser that supports citation dialogs.'); return; }
    });
  });
  dialog?.querySelector('.close-dialog')?.addEventListener('click', () => dialog.close());
  dialog?.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  document.querySelector('#copy-citation')?.addEventListener('click', async () => {
    const success = await copyText(citationCode?.textContent || '');
    if (success) {
      const button = document.querySelector('#copy-citation');
      button.lastChild.textContent = ' Copied';
      window.setTimeout(() => { button.lastChild.textContent = ' Copy BibTeX'; }, 1800);
      notify('BibTeX copied.');
    } else {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(citationCode);
      selection?.removeAllRanges();
      selection?.addRange(range);
      citationCode?.focus();
      document.querySelector('#copy-citation').lastChild.textContent = ' Press Ctrl+C / ⌘C to copy';
    }
  });

  const searchInput = document.querySelector('#publication-search');
  if (!searchInput) return;
  const records = [...document.querySelectorAll('.publication-record')];
  const groups = [...document.querySelectorAll('[data-group]')];
  const filters = [...document.querySelectorAll('[data-filter]')];
  const count = document.querySelector('#result-count');
  const empty = document.querySelector('#no-results');
  const validCategories = new Set(filters.map(button => button.dataset.filter));
  let category = 'all';
  let searchTimer;

  function applyFilters(updateURL = true) {
    const terms = searchInput.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    let visible = 0;
    for (const record of records) {
      const categoryMatches = category === 'all' || record.dataset.category === category;
      const textMatches = terms.every(term => record.dataset.search.includes(term));
      record.hidden = !(categoryMatches && textMatches);
      if (!record.hidden) visible += 1;
    }
    for (const group of groups) group.hidden = ![...group.querySelectorAll('.publication-record')].some(record => !record.hidden);
    for (const button of filters) button.setAttribute('aria-pressed', String(button.dataset.filter === category));
    count.textContent = `${visible} ${visible === 1 ? 'record' : 'records'}`;
    empty.hidden = visible !== 0;
    if (updateURL) {
      try {
        const url = new URL(window.location.href);
        if (searchInput.value.trim()) url.searchParams.set('q', searchInput.value.trim());
        else url.searchParams.delete('q');
        url.hash = category === 'all' ? '' : category;
        window.history.replaceState(null, '', url);
      } catch (_) { /* file:// previews may restrict history updates. */ }
    }
  }
  function restoreState() {
    const url = new URL(window.location.href);
    const hash = url.hash.slice(1);
    category = validCategories.has(hash) ? hash : 'all';
    searchInput.value = url.searchParams.get('q') || '';
    applyFilters(false);
  }
  filters.forEach(button => button.addEventListener('click', () => {
    category = button.dataset.filter;
    applyFilters();
  }));
  searchInput.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => applyFilters(), 100);
  });
  document.querySelector('#reset-filters')?.addEventListener('click', () => {
    category = 'all';
    searchInput.value = '';
    applyFilters();
    searchInput.focus();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || dialog?.open) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, button'))) return;
    event.preventDefault();
    searchInput.focus();
  });
  window.addEventListener('hashchange', restoreState);
  window.addEventListener('popstate', restoreState);
  restoreState();
})();
