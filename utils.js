// Shared utilities for MathWithMDU - prevents duplication
// FIXED: Centralized alert/loading/modals - removes 4x duplicate showAlert functions

// DOM helper - assumes alertContainer ID exists or falls back to body
export function showAlert(message, type = 'success', containerId = 'alertContainer') {
  const container = document.getElementById(containerId) || document.body;
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.textContent = message; // FIXED: textContent prevents XSS
  container.appendChild(alert);
  setTimeout(() => {
    if (alert.parentNode) alert.remove();
  }, 5000);
  return alert; // Return for manual dismiss if needed
}

// Loading spinner toggle
export function showLoading(loadingId = 'loading') {
  const loading = document.getElementById(loadingId);
  if (loading) loading.classList.remove('hidden');
}

export function hideLoading(loadingId = 'loading') {
  const loading = document.getElementById(loadingId);
  if (loading) loading.classList.add('hidden');
}

// Modal helpers (app.js only)
export function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('hidden');
}

export function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
}

/**
 * Escape HTML special characters so user input can be safely embedded into HTML.
 * Prefer `textContent` over HTML insertion, but this is useful when building strings.
 *
 * Escapes: &, <, >, ", '
 */
export function escapeHtml(input) {
  // Treat null/undefined as empty string.
  const str = input == null ? '' : String(input);

  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#39;');
}

