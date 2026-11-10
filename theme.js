(function () {
  const THEME_KEY = 'mdu_theme';

  function getSavedTheme() {
    try {
      return localStorage.getItem(THEME_KEY) || null;
    } catch (_) {
      return null;
    }
  }

  function setSavedTheme(value) {
    try {
      localStorage.setItem(THEME_KEY, value);
    } catch (_) {}
  }

  function applyTheme(theme) {
    const isLight = theme === 'light';
    document.documentElement.dataset.theme = isLight ? 'light' : 'dark';
  }

  function initThemeToggle() {
    const btn = document.getElementById('themeToggle');
    const icon = document.getElementById('themeToggleIcon');

    if (!btn) return;

    const saved = getSavedTheme();
    const initial = saved || 'dark';
    applyTheme(initial);

    const updateIcon = (theme) => {
      if (!icon) return;
      // icon is sun for light mode toggle.
      // When current theme is dark, show sun icon (meaning toggle to light).
      const isDark = theme !== 'light';
      icon.classList.toggle('fa-sun', isDark);
      icon.classList.toggle('fa-moon', !isDark);
    };

    updateIcon(initial);

    btn.addEventListener('click', () => {
      const current = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
      const next = current === 'light' ? 'dark' : 'light';
      applyTheme(next);
      setSavedTheme(next);
      updateIcon(next);
    });
  }

  document.addEventListener('DOMContentLoaded', initThemeToggle);
})();

