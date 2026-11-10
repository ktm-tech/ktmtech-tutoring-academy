document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');

  loginBtn?.addEventListener('click', () => {
    window.location.href = 'index.html?auth=login#home';
  });

  registerBtn?.addEventListener('click', () => {
    window.location.href = 'index.html?auth=register#home';
  });
});
