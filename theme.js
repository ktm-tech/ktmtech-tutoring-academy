/* KTM Academy theme controller: light by default, user-selectable dark mode. */
(() => {
  const KEY = 'ktm_academy_theme';
  const root = document.documentElement;
  const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const write = value => { try { localStorage.setItem(KEY, value); } catch {} };
  const apply = value => {
    const theme = value === 'dark' ? 'dark' : 'light';
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      const dark = theme === 'dark';
      button.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
      button.setAttribute('title', dark ? 'Switch to light theme' : 'Switch to dark theme');
      button.setAttribute('aria-pressed', String(dark));
      const icon = button.querySelector('svg');
      if (icon) icon.innerHTML = dark
        ? '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"></path>'
        : '<path d="M20.2 15.4A8.5 8.5 0 0 1 8.6 3.8 8.6 8.6 0 1 0 20.2 15.4Z"></path>';
      const text = button.querySelector('.theme-toggle-label');
      if (text) text.textContent = dark ? 'Light' : 'Dark';
    });
  };
  const iconSvg = () => '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></svg>';
  function addToggle() {
    if (document.querySelector('[data-theme-toggle]')) return;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'theme-toggle'; button.dataset.themeToggle = '';
    button.innerHTML = iconSvg() + '<span class="theme-toggle-label">Dark</span>';
    button.addEventListener('click', () => { const next = root.dataset.theme === 'dark' ? 'light' : 'dark'; apply(next); write(next); });
    const nav = document.querySelector('.nav-container');
    if (nav) nav.append(button);
    else (document.querySelector('main') || document.body).prepend(button);
  }
  function init() { apply(read() || 'light'); addToggle(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
