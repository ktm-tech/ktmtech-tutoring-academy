document.addEventListener('DOMContentLoaded', () => {
  const bindings = [
    { menu: document.querySelector('.dashboard-sidebar'), toggle: document.getElementById('dashboardMenuToggle') },
    { menu: document.querySelector('.admin-navigation'), toggle: document.getElementById('adminMenuToggle') }
  ].filter(({ menu, toggle }) => menu && toggle);

  if (!bindings.length) return;

  const overlay = document.createElement('button');
  overlay.className = 'workspace-drawer-overlay';
  overlay.type = 'button';
  overlay.setAttribute('aria-label', 'Close navigation menu');
  overlay.hidden = true;
  document.body.append(overlay);

  const closeMenus = () => {
    bindings.forEach(({ menu, toggle }) => {
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
    overlay.hidden = true;
    document.body.classList.remove('workspace-drawer-open');
  };

  bindings.forEach(({ menu, toggle }) => {
    toggle.setAttribute('aria-controls', menu.id || (menu.id = `${toggle.id}Panel`));
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', () => {
      const isOpening = !menu.classList.contains('is-open');
      closeMenus();
      if (!isOpening) return;
      menu.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      overlay.hidden = false;
      document.body.classList.add('workspace-drawer-open');
    });
  });

  overlay.addEventListener('click', closeMenus);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenus();
  });
  bindings.forEach(({ menu }) => {
    menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenus));
  });
});
