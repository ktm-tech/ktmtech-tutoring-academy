/* Local, dependency-free SVG icon renderer. Replaces placeholder Font Awesome classes. */
(() => {
  const paths = {
    'fa-house':'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    'fa-book-open':'<path d="M2.5 5.5A2.5 2.5 0 0 1 5 3h6v17H5a2.5 2.5 0 0 0-2.5 2zM21.5 5.5A2.5 2.5 0 0 0 19 3h-6v17h6a2.5 2.5 0 0 1 2.5 2z"/>',
    'fa-book':'<path d="M5 3h14a2 2 0 0 1 2 2v16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M7 7h10M7 11h10M7 15h7"/>',
    'fa-bookmark':'<path d="M6 3h12v18l-6-4-6 4z"/>',
    'fa-bell':'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    'fa-calendar':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h2m4 0h2m-8 3h2"/>',
    'fa-calendar-days':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01M16 17h.01"/>',
    'fa-chart-line':'<path d="M3 3v18h18M6 15l5-5 4 3 6-8"/>',
    'fa-chart-simple':'<path d="M4 20V10m5 10V4m5 16v-7m5 7V7"/>',
    'fa-clipboard-check':'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5h6V2H9zM8 13l2.5 2.5L16 10"/>',
    'fa-comments':'<path d="M21 11.5a7.5 7.5 0 0 1-8 7.5 8 8 0 0 1-3-.6L4 21l1.6-4.2A7.2 7.2 0 0 1 5 12a7.5 7.5 0 0 1 8-7.5 7.5 7.5 0 0 1 8 7Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>',
    'fa-compass':'<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.2 5-4.8 2 2-4.8z"/>',
    'fa-envelope':'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    'fa-file-arrow-down':'<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7m-8 3v6m-3-3 3 3 3-3"/>',
    'fa-file-lines':'<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7M8 13h8m-8 4h8"/>',
    'fa-folder-open':'<path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v2H5l-2 9z"/><path d="M3 19h16l2-9H5z"/>',
    'fa-headset':'<path d="M3 13v-2a9 9 0 0 1 18 0v2M3 13h4v7H5a2 2 0 0 1-2-2zm18 0h-4v7h2a2 2 0 0 0 2-2zM17 20a5 5 0 0 1-5 2"/>',
    'fa-phone':'<path d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a14 14 0 0 1-6-6l2-2z"/>',
    'fa-layer-group':'<path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
    'fa-magnifying-glass':'<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/>',
    'fa-pen-to-square':'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/>',
    'fa-user':'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    'fa-arrow-right':'<path d="M5 12h14m-6-6 6 6-6 6"/>',
    'fa-arrow-up-right':'<path d="M7 17 17 7M7 7h10v10"/>',
    'fa-arrow-up-right-from-square':'<path d="M14 4h6v6m-1-5-9 9"/><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/>',
    'fa-bars':'<path d="M4 6h16M4 12h16M4 18h16"/>',
    'fa-bolt':'<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',
    'fa-bullseye':'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    'fa-calculator':'<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8v4H8zM8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
    'fa-circle-check':'<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
    'fa-circle-play':'<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/>',
    'fa-graduation-cap':'<path d="m2 9 10-5 10 5-10 5zM6 11v5c4 3 8 3 12 0v-5m4-2v6"/>',
    'fa-pen-ruler':'<path d="m3 21 3-.7L20 6.3 17.7 4 4 17.7zM14.5 7.5l2 2M3 4h7M6.5 4v6.5"/>',
    'fa-moon':'<path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z"/>',
    'fa-sun':'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
    'fa-xmark':'<path d="m6 6 12 12M18 6 6 18"/>'
  };
  const aliases = { 'fa-regular fa-bookmark':'fa-bookmark', 'fa-regular fa-bell':'fa-bell', 'fa-regular fa-calendar':'fa-calendar', 'fa-regular fa-calendar-days':'fa-calendar-days', 'fa-regular fa-user':'fa-user' };
  function render(root = document) {
    root.querySelectorAll('i[class*="fa-"]:not([data-ktm-icon])').forEach(old => {
      const classes = [...old.classList];
      const key = aliases[classes.join(' ')] || classes.find(c => paths[c]);
      if (!key || !paths[key]) return;
      const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('fill','none'); svg.setAttribute('stroke','currentColor'); svg.setAttribute('stroke-width','1.8'); svg.setAttribute('stroke-linecap','round'); svg.setAttribute('stroke-linejoin','round'); svg.setAttribute('aria-hidden','true'); svg.setAttribute('focusable','false'); svg.classList.add('ktm-icon');
      svg.innerHTML = paths[key];
      old.replaceWith(svg);
    });
  }
  const start = () => { render(); const observer = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => { if (node.nodeType === 1) { if (node.matches?.('i[class*="fa-"]')) { const holder = document.createElement('span'); holder.append(node.cloneNode(true)); render(holder); node.replaceWith(...holder.childNodes); } render(node); } }))); observer.observe(document.body,{childList:true,subtree:true}); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
