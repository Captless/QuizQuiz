/* ===== Google OAuth ===== */

var _googleReady = false;

function initGoogleSignIn() {
  if (_googleReady) return;
  const clientId = window.QUIKQUIZ_CONFIG?.googleClientId;
  if (!clientId || typeof google === 'undefined') return;
  google.accounts.id.initialize({
    client_id: clientId,
    callback: handleGoogleCredential,
    cancel_on_tap_outside: false
  });
  var hidden = document.getElementById('hiddenGoogleBtn');
  if (hidden) {
    google.accounts.id.renderButton(hidden, {
      type: 'standard',
      shape: 'pill',
      theme: 'filled_blue',
      size: 'medium',
      text: 'signin_with'
    });
  }
  _googleReady = true;
}

function triggerGoogleSignIn() {
  if (!_googleReady) {
    console.warn('Google sign-in not initialized – client ID missing?');
    return;
  }
  var btn = document.querySelector('#hiddenGoogleBtn div[role="button"]');
  if (btn) {
    btn.click();
  } else if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
    google.accounts.id.prompt();
  }
}

document.addEventListener('DOMContentLoaded', function () {
  var customBtn = document.getElementById('customGoogleBtn');
  if (customBtn) customBtn.addEventListener('click', triggerGoogleSignIn);
  var demoBtn = document.getElementById('demoGoogleBtn');
  if (demoBtn) demoBtn.addEventListener('click', triggerGoogleSignIn);
});

function handleGoogleCredential(response) {
  const data = parseJwt(response.credential);
  var prev = getUser();
  if (prev && prev.email && prev.email !== (data.email || '')) {
    localStorage.removeItem('quikquiz_paid');
    localStorage.removeItem('quikquiz_usage');
  }
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
  localStorage.removeItem('quikquiz_paid');
  localStorage.removeItem('quikquiz_usage');
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
