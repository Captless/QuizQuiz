/* ===== Main Application Entry Point ===== */

const CONFIG = window.QUIKQUIZ_CONFIG || {};

document.addEventListener('DOMContentLoaded', async function () {
  await loadConfig();
  initDarkMode();
  checkStripeReturn();
  updateUI();
  setupEventListeners();
  initGoogleSignIn();
  initFileUpload();
});

async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    Object.assign(CONFIG, data);
    window.QUIKQUIZ_CONFIG = CONFIG;
  } catch {}
}

/* ===== Dark Mode ===== */
function initDarkMode() {
  const saved = localStorage.getItem('quikquiz_dark');
  if (saved === 'true' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.getElementById('darkToggle').textContent = '☀️';
  }
}

function toggleDark() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  if (isDark) {
    html.removeAttribute('data-theme');
    localStorage.setItem('quikquiz_dark', 'false');
    document.getElementById('darkToggle').textContent = '🌙';
  } else {
    html.setAttribute('data-theme', 'dark');
    localStorage.setItem('quikquiz_dark', 'true');
    document.getElementById('darkToggle').textContent = '☀️';
  }
}

/* ===== Toast Notifications ===== */
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-removing');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ===== Topic Suggestions ===== */
function initTopicSuggestions() {
  const subjectEl = document.getElementById('subjectSelect');
  const gradeEl = document.getElementById('gradeSelect');
  const chipsEl = document.getElementById('topicChips');

  function updateChips() {
    const subject = subjectEl.value;
    const grade = gradeEl.value;
    chipsEl.innerHTML = '';

    if (subject && grade && TOPICS[subject] && TOPICS[subject][grade]) {
      TOPICS[subject][grade].slice(0, 5).forEach(topic => {
        const chip = document.createElement('span');
        chip.className = 'topic-chip';
        chip.textContent = topic;
        chip.addEventListener('click', () => {
          document.getElementById('topicInput').value = topic;
          chipsEl.querySelectorAll('.topic-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          document.getElementById('topicInput').focus();
        });
        chipsEl.appendChild(chip);
      });

      // Refresh chip
      var rand = document.createElement('span');
      rand.className = 'topic-chip-randomize';
      rand.textContent = 'Refresh';
      var refreshIntervalId = null;
      var refreshIntervalId = null;
      rand.addEventListener('click', async function () {
        rand.classList.add('loading');
        rand.style.pointerEvents = 'none';

        function resetBtn() {
          rand.classList.remove('loading');
          rand.textContent = 'Refresh';
          rand.style.pointerEvents = '';
        }

        var topics = (await Promise.race([
          suggestTopics(subject, grade),
          new Promise(function (resolve) {
            setTimeout(function () {
              var pool = TOPICS[subject][grade];
              var shuffled = pool.slice().sort(function () { return Math.random() - 0.5; });
              resolve(shuffled.slice(0, 10));
            }, 5000);
          })
        ])).slice(0, 5);

        while (chipsEl.children.length > 1) {
          chipsEl.removeChild(chipsEl.lastChild);
        }
        topics.forEach(function (t) {
          var chip = document.createElement('span');
          chip.className = 'topic-chip';
          chip.textContent = t;
          chip.addEventListener('click', function () {
            document.getElementById('topicInput').value = t;
            chipsEl.querySelectorAll('.topic-chip').forEach(function (c) { c.classList.remove('active'); });
            chip.classList.add('active');
            document.getElementById('topicInput').focus();
          });
          chipsEl.appendChild(chip);
        });
        resetBtn();
      });
      chipsEl.insertBefore(rand, chipsEl.firstChild);
    }
  }

  subjectEl.addEventListener('change', updateChips);
  gradeEl.addEventListener('change', updateChips);
}

/* ===== File Upload ===== */
function initFileUpload() {
  const zone = document.getElementById('fileDropZone');
  if (!zone) return;

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('drag-over');
  });

  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      document.getElementById('fileInput').files = files;
      handleFileSelected();
    }
  });
}

function handleFileSelected() {
  const input = document.getElementById('fileInput');
  const info = document.getElementById('fileInfo');
  const name = document.getElementById('fileName');
  const zone = document.getElementById('fileDropZone');
  const file = input?.files?.[0];

  if (file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'pdf' && ext !== 'pptx') {
      showToast('Only PDF and PPTX files are supported.', 'error');
      clearFileInput();
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('File exceeds 2MB limit.', 'error');
      clearFileInput();
      return;
    }
    name.textContent = file.name;
    info.classList.remove('hidden');
    zone.style.display = 'none';
    document.getElementById('subjectSelect').disabled = true;
    document.getElementById('gradeSelect').disabled = true;
    document.getElementById('topicInput').disabled = true;
    document.getElementById('topicChips').classList.add('hidden');
    showToast('"' + file.name + '" selected', 'success', 2000);
  }
}

function clearFileInput() {
  const input = document.getElementById('fileInput');
  const info = document.getElementById('fileInfo');
  const zone = document.getElementById('fileDropZone');
  if (input) input.value = '';
  if (info) info.classList.add('hidden');
  if (zone) zone.style.display = '';
  document.getElementById('subjectSelect').disabled = false;
  document.getElementById('gradeSelect').disabled = false;
  document.getElementById('topicInput').disabled = false;
  document.getElementById('topicChips').classList.remove('hidden');
}

/* ===== Stripe Check ===== */
async function checkStripeReturn() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('paid') === 'true') {
    localStorage.setItem('quikquiz_paid', 'true');
    window.history.replaceState({}, '', window.location.pathname);
    updateUI();
    return;
  }

  const sessionId = params.get('session_id');
  if (sessionId) {
    try {
      const paid = await checkPaymentStatus(sessionId);
      if (paid) {
        localStorage.setItem('quikquiz_paid', 'true');
        showToast('Payment successful! Welcome to QuikQuiz Pro.', 'success');
      }
    } catch {}
    window.history.replaceState({}, '', window.location.pathname);
    updateUI();
  }
}

/* ===== Event Listeners ===== */
function setupEventListeners() {
  document.getElementById('generateBtn').addEventListener('click', handleGenerate);
  document.getElementById('subscribeBtnHeader').addEventListener('click', handleSubscribe);
  document.getElementById('subscribeBtnPaywall').addEventListener('click', handleSubscribe);
  document.getElementById('paywallCancelBtn').addEventListener('click', () => {
    document.getElementById('paywallOverlay').classList.remove('active');
  });
  document.getElementById('signOutBtn').addEventListener('click', signOut);
  document.getElementById('darkToggle').addEventListener('click', toggleDark);
  document.getElementById('heroCtaBtn').addEventListener('click', () => {
    document.getElementById('generatorSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.getElementById('fileDropZone').addEventListener('click', () => document.getElementById('fileInput').click());
  document.getElementById('fileInput').addEventListener('change', handleFileSelected);
  document.getElementById('fileRemoveBtn').addEventListener('click', clearFileInput);
  document.getElementById('timerToggle').addEventListener('change', function() {
    document.getElementById('timerInputGroup').classList.toggle('hidden', !this.checked);
  });
  document.getElementById('timerPresets').addEventListener('click', function(e) {
    var btn = e.target.closest('.timer-preset-btn');
    if (!btn) return;
    var sec = parseInt(btn.dataset.sec);
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    document.getElementById('timerInput').value = m + ':' + String(s).padStart(2, '0');
    if (!document.getElementById('timerToggle').checked) {
      document.getElementById('timerToggle').click();
    }
  });
  initTopicSuggestions();
}

function getSelectedTypes() {
  var cbs = document.querySelectorAll('#typeCheckboxes input[type="checkbox"]:checked');
  var types = Array.from(cbs).map(function (cb) { return cb.value; });
  return types.length === 3 ? 'all' : types.join(',');
}

  /* ===== Generate Handler ===== */
async function handleGenerate() {
  const user = getUser();

  if (!user) {
    if (typeof google === 'undefined' || !window.QUIKQUIZ_CONFIG?.googleClientId) {
      showToast('Sign-in is not configured yet.', 'error');
    } else {
      triggerGoogleSignIn();
    }
    return;
  }

  if (!isPaid() && getUsageCount() >= 1) {
    document.getElementById('paywallOverlay').classList.add('active');
    return;
  }

  const fileInput = document.getElementById('fileInput');
  const file = fileInput?.files?.[0];
  const topic = document.getElementById('topicInput').value.trim();
  if (!topic && !file) {
    showToast('Please enter a topic or upload a file.', 'error');
    return;
  }

  const difficulty = document.getElementById('difficultySelect').value;
  const type = getSelectedTypes();
  if (!type) {
    showToast('Select at least one question type.', 'error');
    return;
  }
  var num = parseInt(document.getElementById('numInput').value);

  if (!num || num < 1 || num > 30) {
    showToast('Number of questions must be between 1 and 30.', 'error');
    return;
  }

  var isDemo = !isPaid() && getUsageCount() < 1;
  if (isDemo) {
    num = Math.min(10, num);
  }

  document.getElementById('spinner').classList.add('active');
  document.getElementById('spinner').scrollIntoView({ behavior: 'smooth', block: 'center' });
  document.getElementById('generateBtn').disabled = true;

  let elapsed = 0;
  const spinnerText = document.getElementById('spinnerText');
  spinnerText.textContent = 'Generating your quiz...';
  const timer = setInterval(() => {
    elapsed++;
    if (elapsed < 30) {
      spinnerText.textContent = 'Generating your quiz... (' + elapsed + 's)';
    } else if (elapsed < 90) {
      spinnerText.textContent = 'This is taking a bit longer... (' + elapsed + 's)';
    } else {
      spinnerText.textContent = 'Thanks for your patience... (' + elapsed + 's)';
    }
  }, 1000);

  try {
    const questions = file
      ? await generateQuizFromFile(topic || (file.name.replace(/\.(pdf|pptx)$/i, '')), difficulty, type, num, file)
      : await generateQuiz(topic, difficulty, type, num);
    const timerEnabled = document.getElementById('timerToggle').checked;
    var timerSeconds = 0;
    if (timerEnabled) {
      var val = document.getElementById('timerInput').value.trim();
      if (/^\d+:\d+$/.test(val)) {
        var parts = val.split(':');
        timerSeconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
      } else {
        timerSeconds = (parseInt(val) || 5) * 60;
      }
    }
    const format = document.getElementById('formatSelect').value;
    const subject = document.getElementById('subjectSelect').value;
    var quizTitle = 'Quiz ' + (document.querySelectorAll('.quiz-entry').length + 1);
    createQuizStackEntry(questions, topic || file?.name?.replace(/\.(pdf|pptx)$/i, '') || 'Untitled Quiz', difficulty, timerSeconds, format, quizTitle, subject);
    if (!isPaid()) incrementUsage();
    updateUsageInfo();
    updateUI();
    showToast(isDemo ? 'Free demo quiz generated! Upgrade to unlock unlimited.' : 'Quiz generated successfully!', 'success');
  } catch (err) {
    showToast(err.message || 'Failed to generate quiz.', 'error');
  } finally {
    clearInterval(timer);
    spinnerText.textContent = 'Generating your quiz...';
    document.getElementById('spinner').classList.remove('active');
    document.getElementById('generateBtn').disabled = false;
  }
}

/* ===== Subscribe Handler ===== */
async function handleSubscribe() {
  if (!getUser()) {
    triggerGoogleSignIn();
    return;
  }
  try {
    const url = await createCheckoutSession();
    if (url) window.location.href = url;
  } catch (err) {
    if (CONFIG.stripePaymentLink) {
      window.location.href = CONFIG.stripePaymentLink;
    } else {
      localStorage.setItem('quikquiz_paid', 'true');
      document.getElementById('paywallOverlay').classList.remove('active');
      updateUI();
      showToast('Subscribed! (dev mode)', 'success');
    }
  }
}

/* ===== UI State ===== */
function updateUI() {
  const user = getUser();
  const paid = isPaid();

  const userName = document.getElementById('userName');
  const userAvatar = document.getElementById('userAvatar');
  const authGate = document.getElementById('authGate');
  const generatorForm = document.getElementById('generatorForm');
  const subscribeHeader = document.getElementById('subscribeBtnHeader');
  const signOutBtn = document.getElementById('signOutBtn');
  const gSignInWrapper = document.getElementById('gSignInWrapper');
  const generatorSection = document.getElementById('generatorSection');
  const customGoogleBtn = document.getElementById('customGoogleBtn');
  const demoPrompt = document.getElementById('demoSignUpPrompt');
  const generateBtn = document.getElementById('generateBtn');
  const upgradeBenefits = document.getElementById('upgradeBenefits');

  if (user) {
    userName.textContent = user.name;
    userName.style.display = 'inline';
    userAvatar.src = user.picture;
    userAvatar.style.display = 'block';
    authGate.classList.add('hidden');
    generatorForm.classList.remove('hidden');
    if (paid) {
      generatorForm.classList.remove('demo-mode');
      if (generatorSection) generatorSection.classList.remove('demo-mode');
    } else {
      generatorForm.classList.add('demo-mode');
      if (generatorSection) generatorSection.classList.add('demo-mode');
    }
    if (gSignInWrapper) gSignInWrapper.style.display = 'none';
    if (customGoogleBtn) customGoogleBtn.classList.add('hidden');
    if (demoPrompt) demoPrompt.classList.add('hidden');
    signOutBtn.classList.remove('hidden');
    subscribeHeader.classList.toggle('hidden', paid);
    updateUsageInfo();

    if (generateBtn) {
      generateBtn.classList.remove('hidden');
      generateBtn.disabled = false;
      if (paid) {
        generateBtn.textContent = 'Generate Quiz';
      } else if (getUsageCount() < 1) {
        generateBtn.textContent = 'Generate Demo Quiz';
      } else {
        generateBtn.textContent = 'Upgrade now to generate more';
      }
    }
    if (upgradeBenefits) {
      upgradeBenefits.classList.toggle('hidden', paid || getUsageCount() < 1);
    }
  } else {
    userName.style.display = 'none';
    userAvatar.style.display = 'none';
    authGate.classList.add('hidden');
    generatorForm.classList.remove('hidden');
    generatorForm.classList.add('demo-mode');
    if (generatorSection) generatorSection.classList.add('demo-mode');
    if (gSignInWrapper) gSignInWrapper.style.display = 'none';
    if (customGoogleBtn) customGoogleBtn.classList.remove('hidden');
    if (demoPrompt) demoPrompt.classList.add('hidden');
    signOutBtn.classList.add('hidden');
    subscribeHeader.classList.add('hidden');

    if (generateBtn) {
      generateBtn.classList.remove('hidden');
      generateBtn.disabled = false;
      generateBtn.textContent = 'Sign in to generate free demo quiz';
    }
    if (upgradeBenefits) upgradeBenefits.classList.add('hidden');

    document.getElementById('usageInfo').textContent = '';
  }

  if (paid) {
    document.getElementById('paywallOverlay').classList.remove('active');
    subscribeHeader.classList.add('hidden');
  } else if (user) {
    subscribeHeader.classList.remove('hidden');
  }
}

function updateUsageInfo() {
  const el = document.getElementById('usageInfo');
  if (isPaid()) {
    el.textContent = 'Premium Use';
    el.style.color = 'var(--success)';
  } else {
    const remaining = Math.max(0, 1 - getUsageCount());
    el.textContent = 'Free generations remaining: ' + remaining;
    el.style.color = remaining > 0 ? 'var(--text-secondary)' : 'var(--error)';
  }
}


