(function () {
  const quizId = window.location.pathname.replace('/quiz/', '');
  if (!quizId) {
    document.getElementById('studentLoading').classList.add('hidden');
    document.getElementById('studentError').classList.remove('hidden');
    return;
  }

  let quizData = null;
  let answers = {};
  let submitted = false;
  let started = false;
  let timedOut = false;
  let timerInterval = null;
  let timerRemaining = 0;

  var slideNavigator = null;

  function initDarkMode() {
    var saved = localStorage.getItem('quikquiz_dark');
    var toggle = document.getElementById('studentDarkToggle');
    if (!toggle) return;
    if (saved === 'true' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.setAttribute('data-theme', 'dark');
      toggle.textContent = '☀️';
    }
    toggle.addEventListener('click', function () {
      var html = document.documentElement;
      var isDark = html.getAttribute('data-theme') === 'dark';
      if (isDark) {
        html.removeAttribute('data-theme');
        localStorage.setItem('quikquiz_dark', 'false');
        toggle.textContent = '🌙';
      } else {
        html.setAttribute('data-theme', 'dark');
        localStorage.setItem('quikquiz_dark', 'true');
        toggle.textContent = '☀️';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    initDarkMode();
    try {
      const res = await fetch('/api/quiz/' + quizId);
      if (!res.ok) throw new Error('not found');
      quizData = await res.json();
      document.getElementById('studentLoading').classList.add('hidden');

      document.getElementById('studentSubjectBadge').textContent = quizData.subject || '';
      document.getElementById('studentQuizTitle').textContent = quizData.title || quizData.topic || 'Untitled Quiz';
      document.getElementById('studentTopic').textContent = quizData.topic || '';
      document.getElementById('startQCount').textContent = quizData.questions.length;
      if (quizData.subject) {
        document.getElementById('startSubject').textContent = quizData.subject;
        document.getElementById('startSubjectMeta').classList.remove('hidden');
      }

      var timerSec = parseInt(quizData.timerSeconds) || parseInt(quizData.timerMinutes) * 60 || 0;
      if (timerSec > 0) {
        var m = Math.floor(timerSec / 60);
        var s = timerSec % 60;
        document.getElementById('startTimeLimit').textContent = m + ':' + String(s).padStart(2, '0');
      } else {
        document.getElementById('startTimerMeta').style.display = 'none';
      }

      document.getElementById('startScreen').classList.remove('hidden');
      document.getElementById('startQuizBtn').addEventListener('click', startQuiz);
    } catch (e) {
      document.getElementById('studentLoading').classList.add('hidden');
      document.getElementById('studentError').classList.remove('hidden');
    }
  }

  function startQuiz() {
    if (started) return;
    started = true;
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('studentContent').classList.remove('hidden');
    if (quizData.format === 'slide') {
      document.getElementById('slideNav').classList.remove('hidden');
    }
    renderQuestions();
    document.getElementById('studentSubmitBtn').addEventListener('click', handleSubmit);
    startTimer();
    window.scrollTo(0, 0);
  }

  function startTimer() {
    var timerSec = parseInt(quizData.timerSeconds) || parseInt(quizData.timerMinutes) * 60 || 0;
    if (timerSec <= 0) return;

    timerRemaining = timerSec;
    updateTimerDisplay();
    document.getElementById('studentTimerBar').classList.add('active');
    document.getElementById('studentHeaderTimer').classList.remove('hidden');

    timerInterval = setInterval(function () {
      timerRemaining--;
      updateTimerDisplay();
      if (timerRemaining <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        timedOut = true;
        doSubmit();
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    document.getElementById('studentTimerBar').classList.remove('active');
    document.getElementById('studentHeaderTimer').classList.add('hidden');
  }

  function updateTimerDisplay() {
    const mins = Math.floor(timerRemaining / 60);
    const secs = timerRemaining % 60;
    const display = document.getElementById('studentTimerDisplay');
    const fill = document.getElementById('studentTimerFill');
    if (!display || !fill) return;

    display.textContent = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    var headerTimer = document.getElementById('studentHeaderTimer');
    if (headerTimer) headerTimer.textContent = display.textContent;

    display.className = 'timer-display';
    fill.className = 'timer-fill';

    var total = parseInt(quizData.timerSeconds) || parseInt(quizData.timerMinutes) * 60 || 1;
    const pct = Math.max(0, (timerRemaining / total) * 100);
    fill.style.width = pct + '%';

    if (timerRemaining <= 30) {
      display.classList.add('danger');
      fill.classList.add('danger');
    } else if (timerRemaining <= 60) {
      display.classList.add('warning');
      fill.classList.add('warning');
    }
  }

  function buildQuestionCard(q, i) {
    var card = document.createElement('div');
    card.className = 'question-card';
    card.dataset.index = i;

    var header = document.createElement('div');
    header.className = 'question-card-header';

    var num = document.createElement('span');
    num.className = 'question-number';
    num.textContent = 'Question ' + (i + 1);
    header.appendChild(num);

    var tagType = q.type === 'truefalse' ? 'truefalse' : q.type === 'dropdown' ? 'dropdown' : 'multiple';
    var tagLabel = q.type === 'truefalse' ? 'True / False' : q.type === 'dropdown' ? 'Dropdown' : 'Multiple Choice';
    var tag = document.createElement('span');
    tag.className = 'question-tag tag-' + tagType;
    tag.textContent = tagLabel;
    header.appendChild(tag);

    card.appendChild(header);

    var text = document.createElement('div');
    text.className = 'question-text';
    text.textContent = q.question;
    card.appendChild(text);

    var list = document.createElement('div');
    list.className = 'options-list';

    var shuffled = shuffle(q.options);

    if (q.type === 'dropdown') {
      var wrapper = document.createElement('div');
      wrapper.className = 'dropdown-wrapper';
      var select = document.createElement('select');
      select.className = 'dropdown-select';
      select.dataset.index = i;

      var placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = '— Select an answer —';
      placeholder.disabled = true;
      placeholder.selected = true;
      select.appendChild(placeholder);

      shuffled.forEach(function (opt) {
        var optEl = document.createElement('option');
        optEl.value = opt;
        optEl.textContent = opt;
        select.appendChild(optEl);
      });

      select.addEventListener('change', function () {
        if (submitted) return;
        answers[i] = select.value;
        if (quizData.format === 'slide' && slideNavigator && i < quizData.questions.length - 1) {
          slideNavigator(i + 1);
        }
      });

      wrapper.appendChild(select);
      list.appendChild(wrapper);
    } else {
      shuffled.forEach(function (opt) {
        const item = document.createElement('div');
        item.className = 'option-item';
        item.dataset.value = opt;
        item.textContent = opt;
        item.addEventListener('click', function () {
          if (submitted) return;
          answers[i] = item.dataset.value;
          card.querySelectorAll('.option-item').forEach(function (o) {
            o.classList.toggle('selected', o === item);
          });
          if (quizData.format === 'slide' && slideNavigator && i < quizData.questions.length - 1) {
            slideNavigator(i + 1);
          }
        });
        list.appendChild(item);
      });
    }

    card.appendChild(list);

    var reveal = document.createElement('div');
    reveal.className = 'answer-reveal';
    reveal.textContent = 'Answer: ' + q.answer;
    card.appendChild(reveal);

    // Restore previously selected answer when rebuilding card (e.g. slide navigation)
    if (answers[i]) {
      var restoreDropdown = card.querySelector('.dropdown-select');
      if (restoreDropdown) {
        restoreDropdown.value = answers[i];
      } else {
        card.querySelectorAll('.option-item').forEach(function (opt) {
          if (opt.dataset.value === answers[i]) {
            opt.classList.add('selected');
          }
        });
      }
    }

    return card;
  }

  function renderQuestions() {
    var container = document.getElementById('studentQuizContainer');
    container.innerHTML = '';

    if (quizData.format === 'slide') {
      renderSlideQuestions();
    } else {
      quizData.questions.forEach(function (q, i) {
        container.appendChild(buildQuestionCard(q, i));
      });
    }
  }

  function renderSlideQuestions() {
    var container = document.getElementById('studentQuizContainer');
    var dotsEl = document.getElementById('studentSlideDots');
    var prevBtn = document.getElementById('slidePrevBtn');
    var nextBtn = document.getElementById('slideNextBtn');
    var counterEl = document.getElementById('slideCounter');
    var current = 0;

    function showSlide(idx) {
      if (idx < 0 || idx >= quizData.questions.length) return;
      current = idx;
      var q = quizData.questions[idx];

      container.innerHTML = '';
      var slideCard = buildQuestionCard(q, idx);
      slideCard.classList.add('slide-enter');
      container.appendChild(slideCard);

      prevBtn.disabled = idx === 0;
      nextBtn.disabled = idx === quizData.questions.length - 1;
      counterEl.textContent = (idx + 1) + ' / ' + quizData.questions.length;

      dotsEl.querySelectorAll('.slide-dot').forEach(function (d, di) {
        d.classList.toggle('active', di === idx);
      });
    }

    function renderDots() {
      dotsEl.innerHTML = '';
      quizData.questions.forEach(function (_, i) {
        var dot = document.createElement('span');
        dot.className = 'slide-dot' + (i === 0 ? ' active' : '');
        dot.addEventListener('click', function () { showSlide(i); });
        dotsEl.appendChild(dot);
      });
    }

    slideNavigator = function (idx) { showSlide(idx); };

    prevBtn.addEventListener('click', function () { showSlide(current - 1); });
    nextBtn.addEventListener('click', function () { showSlide(current + 1); });
    renderDots();
    showSlide(0);
  }

  function doSubmit() {
    submitted = true;
    stopTimer();

    var ub = document.getElementById('unansweredBox');
    if (ub) ub.remove();

    if (quizData.format === 'slide') {
      document.getElementById('slideNav').classList.add('hidden');
    }

    let correct = 0;
    const total = quizData.questions.length;

    quizData.questions.forEach(function (q, i) {
      if (answers[i] === q.answer) correct++;
    });

    var submitBtn = document.getElementById('studentSubmitBtn');
    submitBtn.innerHTML = '<span class="spinner-bars"><span class="spinner-bar"></span><span class="spinner-bar"></span><span class="spinner-bar"></span><span class="spinner-bar"></span><span class="spinner-bar"></span></span>';
    submitBtn.disabled = true;

    fetch('/api/quiz/' + quizId + '/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers, correct, total, percentage: total ? Math.round((correct / total) * 100) : 0 })
    }).catch(function () {});

    setTimeout(function () {
      var wrap = document.querySelector('.student-submit-wrap');
      if (wrap) wrap.classList.add('hidden');
      document.getElementById('studentQuizContainer').classList.add('hidden');
      if (quizData.showScore !== false) {
        showScore(correct, total);
      } else {
        showScoreSimple();
      }
    }, 600);
  }

  function showUnansweredBox(unanswered) {
    var existing = document.getElementById('unansweredBox');
    if (existing) existing.remove();

    var box = document.createElement('div');
    box.id = 'unansweredBox';
    box.style.cssText = 'background:var(--bg-error);border:2px solid var(--error);border-radius:var(--radius-md);padding:20px;margin-bottom:16px;text-align:center;';

    var title = document.createElement('p');
    title.style.cssText = 'font-weight:700;font-size:15px;color:var(--error);margin-bottom:12px;';
    title.textContent = 'Unanswered Questions';
    box.appendChild(title);

    var badges = document.createElement('div');
    badges.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:16px;';

    unanswered.forEach(function (qi) {
      var badge = document.createElement('span');
      badge.className = 'unanswered-badge';
      badge.textContent = qi + 1;
      badge.addEventListener('click', function () {
        if (quizData.format === 'slide' && slideNavigator) {
          slideNavigator(qi);
        } else {
          var card = document.querySelector('.question-card[data-index="' + qi + '"]');
          if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        var b = document.getElementById('unansweredBox');
        if (b) b.remove();
      });
      badges.appendChild(badge);
    });

    box.appendChild(badges);



    var submitWrap = document.querySelector('.student-submit-wrap');
    submitWrap.parentNode.insertBefore(box, submitWrap);
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function handleSubmit() {
    if (submitted) return;

    timedOut = false;

    var unanswered = [];
    for (var i = 0; i < quizData.questions.length; i++) {
      if (!answers[i]) unanswered.push(i);
    }

    if (unanswered.length > 0) {
      showUnansweredBox(unanswered);
      return;
    }

    doSubmit();
  }

  function showScore(correct, total) {
    const area = document.getElementById('studentScoreArea');
    const pct = total ? Math.round((correct / total) * 100) : 0;

    let tier, message;
    if (pct === 100) { tier = 'perfect'; message = 'Perfect score!'; }
    else if (pct >= 80) { tier = 'great'; message = 'Great job!'; }
    else if (pct >= 60) { tier = 'good'; message = 'Good try!'; }
    else if (pct >= 40) { tier = 'fair'; message = 'Keep practicing!'; }
    else { tier = 'keep'; message = "You'll get it next time!"; }

    var passed = pct >= 60;
    area.innerHTML = '' +
      '<div class="pass-badge ' + (passed ? 'passed' : 'failed') + '">' +
        (passed ? 'Passed' : 'Needs Improvement') +
      '</div>' +
      '<div class="score-message tier-' + tier + '">' + message + '</div>' +
      '<div class="score-circle ' + (pct === 100 ? 'perfect' : pct >= 80 ? 'good' : pct >= 60 ? 'fair' : 'poor') + '">' +
        '<span>' + pct + '%</span>' +
      '</div>' +
      '<div class="score-stats">' +
        '<div class="score-stat correct">' +
          '<div class="score-stat-value">' + correct + '</div>' +
          '<div class="score-stat-label">Correct</div>' +
        '</div>' +
        '<div class="score-stat incorrect">' +
          '<div class="score-stat-value">' + (total - correct) + '</div>' +
          '<div class="score-stat-label">Incorrect</div>' +
        '</div>' +
      '</div>';
    area.classList.remove('hidden');
    area.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function showScoreSimple() {
    const area = document.getElementById('studentScoreArea');
    if (timedOut) {
      area.innerHTML = '<div style="font-size:26px;font-weight:700;color:var(--warning);margin-bottom:4px;">Time\'s up!</div>' +
        '<p style="color:var(--text-secondary);margin-top:8px;font-size:14px;">The timer ran out. Your answers have been recorded.</p>';
    } else {
      area.innerHTML = '<div style="font-size:26px;font-weight:700;color:var(--success);margin-bottom:4px;">Successfully submitted!</div>' +
        '<p style="color:var(--text-secondary);margin-top:8px;font-size:14px;">Your answers have been recorded.</p>';
    }
    area.classList.remove('hidden');
    area.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function shuffle(arr) {
    const a = [].concat(arr);
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }
})();
