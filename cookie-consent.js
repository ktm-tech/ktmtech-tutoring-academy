document.addEventListener('DOMContentLoaded', () => {
  const consentBanner = document.getElementById('cookieConsentBanner');
  const essentialBtn = document.getElementById('cookieEssentialBtn');
  const acceptBtn = document.getElementById('cookieAcceptBtn');

  if (!consentBanner) return;

  const consentKey = 'mdu_cookie_consent';

  let lastFocusedEl = null;

  function showBanner() {
    lastFocusedEl = document.activeElement;
    consentBanner.classList.remove('hidden');
    // Move focus to the first actionable button for keyboard users.
    essentialBtn?.focus?.();
  }

  function hideBanner() {
    consentBanner.classList.add('hidden');
    // Restore focus to where the user was before the banner appeared.
    try {
      lastFocusedEl?.focus?.();
    } catch (_) {}
  }

  function setConsent(value) {
    try {
      localStorage.setItem(consentKey, JSON.stringify({ value, setAt: new Date().toISOString() }));
    } catch (_) {}
    hideBanner();
  }

  // Restore banner state
  try {
    const stored = localStorage.getItem(consentKey);
    if (!stored) showBanner();
    else hideBanner();
  } catch (_) {
    showBanner();
  }

  essentialBtn?.addEventListener('click', () => setConsent('essential'));
  acceptBtn?.addEventListener('click', () => setConsent('analytics'));
});
