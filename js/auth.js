/* ===== Google OAuth ===== */

function initGoogleSignIn() {
  const clientId = window.QUIKQUIZ_CONFIG?.googleClientId;
  if (!clientId || typeof google === 'undefined') return;
  google.accounts.id.initialize({
    client_id: clientId,
    callback: handleGoogleCredential,
    cancel_on_tap_outside: false
  });
  const wrapper = document.getElementById('gSignInWrapper');
  if (wrapper) {
    google.accounts.id.renderButton(wrapper, {
      type: 'standard',
      shape: 'pill',
      theme: 'outline',
      size: 'medium',
      text: 'signin_with'
    });
  }
}

function handleGoogleCredential(response) {
  const data = parseJwt(response.credential);
  localStorage.setItem('quikquiz_user', JSON.stringify({
    name: data.name || 'User',
    email: data.email || '',
    picture: data.picture || ''
  }));
  if (typeof updateUI === 'function') updateUI();
}

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(window.atob(base64));
  } catch { return {}; }
}

function signOut() {
  localStorage.removeItem('quikquiz_user');
  if (typeof updateUI === 'function') updateUI();
}

function getUser() {
  try { return JSON.parse(localStorage.getItem('quikquiz_user')); }
  catch { return null; }
}

function isPaid() {
  return localStorage.getItem('quikquiz_paid') === 'true';
}

function getUsageCount() {
  return parseInt(localStorage.getItem('quikquiz_usage') || '0');
}

function incrementUsage() {
  localStorage.setItem('quikquiz_usage', getUsageCount() + 1);
}
