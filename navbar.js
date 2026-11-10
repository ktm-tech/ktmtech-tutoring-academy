import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

// This file is loaded as an ES module on every page that needs the navbar.

function initNavbar() {
  // Support both older and newer navbar markup (only some pages contain both).
  const navLinks = document.querySelector('#navLinks'); // optional
  const menuToggle = document.querySelector('#menuToggle'); // optional

  // Prefer explicit IDs if present, otherwise fall back to class-based selectors.
  const hamburger = document.querySelector('.mobile-nav-toggle, .hamburger'); // optional
  const mobileMenu = document.querySelector('.mobile-menu'); // optional (class-based)
  const menuOverlay = document.querySelector('.menu-overlay'); // optional (class-based)

  const closeMobileMenu = () => {
    mobileMenu?.classList.remove('active');
    hamburger?.classList.remove('active');
    menuOverlay?.classList.remove('active');
  };

  // Desktop toggle (only when both elements exist).
  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => navLinks.classList.toggle('active'));

    // Close desktop/mobile menu when a nav link is clicked.
    document.querySelectorAll('.mobile-menu a, #navLinks a').forEach(link => {
      link.addEventListener('click', () => navLinks.classList.remove('active'));
    });
  }

  // Mobile toggle + accessibility
  if (hamburger && mobileMenu) {
    // Ensure mobile menu has a stable id for aria-controls.
    if (!mobileMenu.id) mobileMenu.id = 'mobileNavMenu';

    const isNativeButton = hamburger.tagName === 'BUTTON';
    if (!isNativeButton && !hamburger.hasAttribute('role')) hamburger.setAttribute('role', 'button');
    if (!isNativeButton && !hamburger.hasAttribute('tabindex')) hamburger.setAttribute('tabindex', '0');
    hamburger.setAttribute('aria-controls', mobileMenu.id);

    const setExpanded = (expanded) => {
      hamburger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    };

    // Initialize expanded state based on current classes.
    setExpanded(mobileMenu.classList.contains('active'));

    const focusFirstMobileLink = () => {
      const firstLink = mobileMenu.querySelector('a[href]');
      firstLink?.focus?.();
    };

    hamburger.addEventListener('click', () => {
      const isOpening = !mobileMenu.classList.contains('active');
      mobileMenu.classList.toggle('active');
      hamburger.classList.toggle('active');
      menuOverlay?.classList.toggle('active');
      setExpanded(isOpening);

      if (isOpening) focusFirstMobileLink();
    });

    if (!isNativeButton) {
      hamburger.addEventListener('keydown', (evt) => {
        if (evt.key !== 'Enter' && evt.key !== ' ') return;
        evt.preventDefault();
        hamburger.click();
      });
    }

    // Close menu when any mobile nav link is clicked.
    document.querySelectorAll('.mobile-menu a').forEach(link => {
      // Avoid stacking duplicate listeners.
      if (link.dataset.navCloseBound === '1') return;
      link.dataset.navCloseBound = '1';

      link.addEventListener('click', closeMobileMenu);
    });

    // Close menu when overlay is clicked.
    menuOverlay?.addEventListener('click', closeMobileMenu);
  }

  initAuthListener();
  setActiveLink();
}

function initAuthListener() {
  onAuthStateChanged(auth, async (user) => {
    const authSection = document.querySelector('#authSection');

    if (!user) {
      updateNavbarLoggedOut(authSection);
      return;
    }

    // Fetch role if available; default to user.
    let role = 'user';
    let displayName = user.email;

    try {
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        role = snap.data().role || 'user';
        displayName = snap.data().name || user.email;
      }
    } catch (err) {
      console.warn('[MathWithMDU] Role lookup unavailable; using the default user role:', err);
    }

    updateNavbarLoggedIn(authSection, displayName, role);
  });
}

function updateNavbarLoggedIn(authSection, name, role) {
  // If this page uses authSection placeholder, render there.
  if (authSection) {
    // Build DOM nodes to avoid innerHTML injection.
    const userInfo = document.createElement('div');
    userInfo.className = 'user-info';

    const glow = document.createElement('span');
    glow.className = 'glow-text';
    glow.textContent = '👤 ' + String(name ?? '');

    const badge = document.createElement('span');
    badge.className = 'role-badge';
    badge.textContent = String(role ?? 'user').toUpperCase();

    const btn = document.createElement('button');
    btn.id = 'logoutBtn';
    btn.className = 'nav-btn';
    btn.type = 'button';
    btn.textContent = 'Logout';

    userInfo.append(glow, badge, btn);
    authSection.replaceChildren(userInfo);

    document.getElementById('logoutBtn')?.addEventListener('click', () => {
      signOut(auth).then(() => {
        window.location.href = 'index.html';
      }).catch(err => console.error('[MathWithMDU] logout error', err));
    });
  }

  // Also support pages that have fixed buttons.
  document.querySelectorAll('#loginBtn').forEach(b => b.classList.add('hidden'));
  document.querySelectorAll('#registerBtn').forEach(b => b.classList.add('hidden'));
  document.querySelectorAll('#adminBtn').forEach(b => b.classList.toggle('hidden', role !== 'admin'));
  document.querySelectorAll('#logoutBtn').forEach(b => b.classList.remove('hidden'));
  document.querySelectorAll('#dashboardLink').forEach(b => b.classList.remove('hidden'));

  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = role === 'admin' ? 'block' : 'none';
  });
}

function updateNavbarLoggedOut(authSection) {
  if (authSection) {
    authSection.replaceChildren();

    const login = document.createElement('a');
    login.href = 'login.html';
    login.className = 'nav-btn';
    login.textContent = 'Login';

    const signup = document.createElement('a');
    signup.href = 'register.html';
    signup.className = 'nav-btn highlight';
    signup.textContent = 'Sign Up';

    authSection.append(login, signup);
  }

  document.querySelectorAll('#loginBtn').forEach(b => b.classList.remove('hidden'));
  document.querySelectorAll('#registerBtn').forEach(b => b.classList.remove('hidden'));
  document.querySelectorAll('#adminBtn').forEach(b => b.classList.add('hidden'));
  document.querySelectorAll('#logoutBtn').forEach(b => b.classList.add('hidden'));
  document.querySelectorAll('#dashboardLink').forEach(b => b.classList.add('hidden'));

  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = 'none';
  });
}

function setActiveLink() {
  const currentBasePage = (window.location.pathname.split('/').pop() || 'index.html');

  const normalizeHrefToPage = (href) => {
    if (!href) return null;
    const noHash = href.split('#')[0];
    const noQuery = noHash.split('?')[0];
    return noQuery.split('/').pop() || 'index.html';
  };

  const scope = document.querySelector('.navbar') || document;
  scope.querySelectorAll('a').forEach(a => {
    const href = a.getAttribute('href');
    if (!href) return;

    a.classList.remove('active-link');

    const page = normalizeHrefToPage(href);
    if (!page) return;

    if (page === currentBasePage) {
      a.classList.add('active-link');
      return;
    }

    if (currentBasePage === 'index.html' && page === 'index.html') {
      a.classList.add('active-link');
    }
  });
}

document.addEventListener('DOMContentLoaded', initNavbar);
