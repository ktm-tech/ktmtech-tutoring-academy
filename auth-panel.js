document.addEventListener('DOMContentLoaded', () => {
  const drawer = document.getElementById('authDrawer');
  const overlay = document.getElementById('authDrawerOverlay');
  const closeButton = document.getElementById('authDrawerClose');
  const loginButton = document.getElementById('loginBtn');
  const registerButton = document.getElementById('registerBtn');
  const tabs = [...document.querySelectorAll('[role="tab"][data-auth-tab]')];
  const forms = [...document.querySelectorAll('[data-auth-form]')];
  let returnFocus = null;

  if (!drawer || !overlay) return;

  const activateForm = (name) => {
    tabs.forEach((tab) => {
      const active = tab.dataset.authTab === name;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    forms.forEach((form) => {
      form.hidden = form.dataset.authForm !== name;
    });
    drawer.dataset.activeForm = name;
  };

  const openDrawer = (name, trigger) => {
    returnFocus = trigger;
    activateForm(name);
    drawer.classList.add('is-open');
    overlay.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('auth-drawer-open');
    drawer.querySelector(`[data-auth-form="${name}"] input:not([type="checkbox"])`)?.focus();
  };

  const closeDrawer = () => {
    drawer.classList.remove('is-open');
    overlay.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('auth-drawer-open');
    returnFocus?.focus();
  };

  loginButton?.addEventListener('click', () => openDrawer('login', loginButton));
  registerButton?.addEventListener('click', () => openDrawer('register', registerButton));
  closeButton?.addEventListener('click', closeDrawer);
  overlay.addEventListener('click', closeDrawer);

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => activateForm(tab.dataset.authTab));
  });

  document.querySelectorAll('[data-open-auth]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      openDrawer(link.dataset.openAuth, link);
    });
  });

  document.querySelectorAll('[data-password-toggle]').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const input = document.getElementById(toggle.dataset.passwordToggle);
      if (!input) return;
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      toggle.textContent = visible ? 'Hide' : 'Show';
      toggle.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
    });
  });

  document.addEventListener('keydown', (event) => {
    if (!drawer.classList.contains('is-open')) return;
    if (event.key === 'Escape') {
      closeDrawer();
      return;
    }

    if (event.key === 'Tab') {
      const focusable = [...drawer.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled])')]
        .filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  const requestedForm = new URLSearchParams(window.location.search).get('auth');
  if (requestedForm === 'login' || requestedForm === 'register') {
    openDrawer(requestedForm, null);
  }
});
