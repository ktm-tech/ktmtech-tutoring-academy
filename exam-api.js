import { auth } from './firebase.js';

export async function examApi(path, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in to continue.');

  const token = await user.getIdToken();
  const baseUrl = String(window.__ENV__?.API_BASE_URL || '').replace(/\/+$/, '');
  const response = await fetch(`${baseUrl}/api/exams${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers
    }
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch (error) {
    if (response.ok) throw new Error('The examination service returned an invalid response.');
  }
  if (!response.ok) {
    throw new Error(payload.error || 'The examination request could not be completed.');
  }
  return payload;
}
