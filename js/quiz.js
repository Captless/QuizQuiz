/* ===== Quiz stack and per-entry state management ===== */

let quizStack = [];

/* ===== Stacked Quiz ===== */

function createQuizStackEntry(questions, topic, difficulty, timerSeconds, format, title, subject) {
  const id = 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const entry = {
    id,
    topic: topic || 'Untitled Quiz',
    difficulty: difficulty || 'Easy',
    questions,
    timerSeconds: timerSeconds || 0,
    format: 'form',
    studentFormat: format || 'form',
    shareId: null,
    showScore: false,
    title: title || 'Quiz ' + (document.querySelectorAll('.quiz-entry').length + 1),
    subject: subject || '',
    element: null,
    bodyEl: null
  };

  const stack = document.getElementById('quizStack');

  // Entry card
  const card = document.createElement('div');
  card.className = 'quiz-entry card';
  card.dataset.entryId = id;
  entry.element = card;

  // Header
  const header = document.createElement('div');
  header.className = 'quiz-entry-header';

  const info = document.createElement('div');
  info.className = 'quiz-entry-info';

  var titleRow = document.createElement('div');
  titleRow.className = 'quiz-entry-title-row';

  var titleSpan = document.createElement('span');
  titleSpan.className = 'quiz-entry-title';
  titleSpan.textContent = entry.title;
  titleSpan.title = 'Click to rename';
  titleSpan.addEventListener('click', function (e) {
    e.stopPropagation();
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'quiz-entry-title-input';
    input.value = entry.title;
    input.style.width = (entry.title.length * 8 + 20) + 'px';
    titleSpan.replaceWith(input);
    input.focus();
    input.select();
    input.addEventListener('blur', function () {
      entry.title = input.value.trim() || entry.title;
      titleSpan.textContent = entry.title;
      input.replaceWith(titleSpan);
    });
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
      if (ev.key === 'Escape') { ev.preventDefault(); input.value = entry.title; input.blur(); }
    });
  });
  titleRow.appendChild(titleSpan);

  if (entry.subject) {
    var subjBadge = document.createElement('span');
    subjBadge.className = 'quiz-entry-subject badge';
    subjBadge.textContent = entry.subject;
    titleRow.appendChild(subjBadge);
  }

  var diffBadge = document.createElement('span');
  diffBadge.className = 'quiz-entry-badge';
  diffBadge.textContent = difficulty || 'Easy';
  titleRow.appendChild(diffBadge);

  info.appendChild(titleRow);

  var meta = document.createElement('div');
  meta.className = 'quiz-entry-meta';
  meta.textContent = questions.length + ' question' + (questions.length !== 1 ? 's' : '');
  info.appendChild(meta);

  header.appendChild(info);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'quiz-entry-actions';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-sm btn-outline entry-delete-btn';
  deleteBtn.title = 'Delete quiz';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!confirm('Delete this quiz?')) return;
    card.remove();
    const idx = quizStack.indexOf(entry);
    if (idx > -1) quizStack.splice(idx, 1);
    if (quizStack.length === 0) {
      document.getElementById('quizArea').classList.remove('active');
      document.getElementById('quizStackEmpty').classList.remove('hidden');
    }
  });
  actions.appendChild(deleteBtn);

  const pdfBtn = document.createElement('button');
  pdfBtn.className = 'btn btn-sm btn-outline entry-pdf-btn';
  pdfBtn.title = 'Download Quiz (PDF)';
  pdfBtn.textContent = 'PDF';
  pdfBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportQuizPDF(entry, false);
  });
  actions.appendChild(pdfBtn);

  const scoreToggle = document.createElement('button');
  scoreToggle.className = 'btn btn-sm btn-outline entry-score-toggle';
  scoreToggle.title = 'Toggle score visibility for students';
  scoreToggle.textContent = '✗ Score';
  scoreToggle.dataset.on = 'false';
  scoreToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    entry.showScore = !entry.showScore;
    scoreToggle.dataset.on = entry.showScore ? 'true' : 'false';
    scoreToggle.textContent = entry.showScore ? '✓ Score' : '✗ Score';
  });
  actions.appendChild(scoreToggle);

  const resultsBtn = document.createElement('button');
  resultsBtn.className = 'btn btn-sm btn-outline entry-results-btn';
  resultsBtn.title = 'View student results';
  resultsBtn.textContent = 'Results';
  resultsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showResultsModal(entry);
  });
  actions.appendChild(resultsBtn);

  const shareBtn = document.createElement('button');
  shareBtn.className = 'btn btn-sm btn-outline entry-share-btn';
  shareBtn.title = 'Copy share link';
  shareBtn.textContent = 'Share';
  shareBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleShareEntry(entry);
  });
  actions.appendChild(shareBtn);

  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'entry-toggle';
  toggleBtn.textContent = '▶';
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleQuizEntry(entry);
  });
  actions.appendChild(toggleBtn);

  header.appendChild(actions);

  card.appendChild(header);

  // Collapsible body
  const body = document.createElement('div');
  body.className = 'quiz-entry-body hidden';
  entry.bodyEl = body;

  const content = document.createElement('div');
  content.className = 'quiz-entry-content';
  body.appendChild(content);

  card.appendChild(body);

  stack.appendChild(card);

  // Render questions
  renderEntryQuestions(entry);

  quizStack.push(entry);

  // Hide empty state, show stack section, scroll to new entry
  document.getElementById('quizStackEmpty').classList.add('hidden');
  document.getElementById('quizArea').classList.add('active');
  setTimeout(() => {
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);

  return entry;
}

function toggleQuizEntry(entry) {
  const isOpen = !entry.bodyEl.classList.contains('hidden');

  if (!isOpen) {
    // Single-expand: close all others
    quizStack.forEach(e => {
      if (e !== entry && !e.bodyEl.classList.contains('hidden')) {
        e.bodyEl.classList.add('hidden');
        const btn = e.element.querySelector('.entry-toggle');
        if (btn) btn.textContent = '▶';
      }
    });
  }

  entry.bodyEl.classList.toggle('hidden');
  const toggle = entry.element.querySelector('.entry-toggle');
  if (toggle) toggle.textContent = entry.bodyEl.classList.contains('hidden') ? '▶' : '▼';
}

function renderEntryQuestions(entry) {
  const container = entry.bodyEl.querySelector('.quiz-entry-content');

  if (entry.format === 'slide') {
    renderSlides(entry, container);
    return;
  }

  const fragment = document.createDocumentFragment();

  entry.questions.forEach((q, i) => {
    const card = document.createElement('div');
    card.className = 'question-card';

    const header = document.createElement('div');
    header.className = 'question-card-header';

    const num = document.createElement('span');
    num.className = 'question-number';
    num.textContent = 'Question ' + (i + 1);
    header.appendChild(num);

    const tagType = q.type === 'truefalse' ? 'truefalse' : q.type === 'dropdown' ? 'dropdown' : 'multiple';
    const tagLabel = q.type === 'truefalse' ? 'True / False' : q.type === 'dropdown' ? 'Dropdown' : 'Multiple Choice';
    const tag = document.createElement('span');
    tag.className = 'question-tag tag-' + tagType;
    tag.textContent = tagLabel;
    header.appendChild(tag);

    card.appendChild(header);

    const text = document.createElement('div');
    text.className = 'question-text';
    text.textContent = q.question;
    card.appendChild(text);

    const shuffled = shuffleArray([...q.options]);
    q._shuffled = shuffled;

    const list = document.createElement('div');
    list.className = 'options-list';

    shuffled.forEach(opt => {
      const item = document.createElement('div');
      item.className = 'option-item option-item--readonly';
      item.textContent = opt;
      list.appendChild(item);
    });

    card.appendChild(list);
    fragment.appendChild(card);
  });

  container.appendChild(fragment);
}

function renderSlides(entry, container) {
  let currentSlide = 0;

  function buildSlide(idx) {
    container.innerHTML = '';
    const q = entry.questions[idx];
    if (!q) return;

    const dots = document.createElement('div');
    dots.className = 'slide-dots';
    entry.questions.forEach((_, di) => {
      const dot = document.createElement('span');
      dot.className = 'slide-dot' + (di === idx ? ' active' : '');
      dot.addEventListener('click', function () { goTo(di); });
      dots.appendChild(dot);
    });
    container.appendChild(dots);

    const card = document.createElement('div');
    card.className = 'question-card slide-card';

    const header = document.createElement('div');
    header.className = 'question-card-header';

    const num = document.createElement('span');
    num.className = 'question-number';
    num.textContent = 'Question ' + (idx + 1);
    header.appendChild(num);

    const tagType = q.type === 'truefalse' ? 'truefalse' : q.type === 'dropdown' ? 'dropdown' : 'multiple';
    const tagLabel = q.type === 'truefalse' ? 'True / False' : q.type === 'dropdown' ? 'Dropdown' : 'Multiple Choice';
    const tag = document.createElement('span');
    tag.className = 'question-tag tag-' + tagType;
    tag.textContent = tagLabel;
    header.appendChild(tag);

    card.appendChild(header);

    const text = document.createElement('div');
    text.className = 'question-text';
    text.textContent = q.question;
    card.appendChild(text);

    const shuffled = shuffleArray([...q.options]);
    q._shuffled = shuffled;

    const list = document.createElement('div');
    list.className = 'options-list';
    shuffled.forEach(opt => {
      const item = document.createElement('div');
      item.className = 'option-item option-item--readonly';
      item.textContent = opt;
      list.appendChild(item);
    });
    card.appendChild(list);
    container.appendChild(card);

    const nav = document.createElement('div');
    nav.className = 'slide-nav';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'slide-nav-btn';
    prevBtn.textContent = '◀';
    prevBtn.disabled = idx === 0;
    prevBtn.addEventListener('click', function () { goTo(idx - 1); });
    nav.appendChild(prevBtn);

    const counter = document.createElement('span');
    counter.className = 'slide-counter';
    counter.textContent = (idx + 1) + ' / ' + entry.questions.length;
    nav.appendChild(counter);

    const nextBtn = document.createElement('button');
    nextBtn.className = 'slide-nav-btn';
    nextBtn.textContent = '▶';
    nextBtn.disabled = idx === entry.questions.length - 1;
    nextBtn.addEventListener('click', function () { goTo(idx + 1); });
    nav.appendChild(nextBtn);

    container.appendChild(nav);
  }

  function goTo(idx) {
    if (idx < 0 || idx >= entry.questions.length) return;
    currentSlide = idx;
    buildSlide(idx);
  }

  buildSlide(0);
}



/* ===== Share ===== */

async function handleShareEntry(entry) {
  try {
    let id;

    if (entry.shareId) {
      // Update existing shared quiz with current settings
      const res = await fetch('/api/quiz/' + entry.shareId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showScore: entry.showScore !== false,
          timerSeconds: entry.timerSeconds || 0,
          format: entry.studentFormat || 'form',
          title: entry.title || '',
          subject: entry.subject || ''
        })
      });
      if (!res.ok) throw new Error('Failed to update share link');
      id = entry.shareId;
    } else {
      // Create new shared quiz
      const res = await fetch('/api/quiz/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: entry.questions,
          topic: entry.topic,
          difficulty: entry.difficulty,
          showScore: entry.showScore !== false,
          timerSeconds: entry.timerSeconds || 0,
          format: entry.studentFormat || 'form',
          title: entry.title || '',
          subject: entry.subject || ''
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save quiz');
      id = data.id;
      entry.shareId = id;
    }

    copyToClipboard(window.location.origin + '/quiz/' + id);
  } catch (err) {
    showToast(err.message || 'Failed to create share link', 'error');
  }
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Link copied to clipboard!', 'success');
    }).catch(() => {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showToast('Link copied to clipboard!', 'success');
  } catch {
    showToast('Failed to copy link', 'error');
  }
  document.body.removeChild(ta);
}

/* ===== PDF Export ===== */

function exportQuizPDF(entry, includeAnswerKey) {
  if (!entry || !entry.questions) return;

  const printContainer = document.createElement('div');
  printContainer.style.cssText = 'padding: 40px; font-family: Inter, sans-serif; max-width: 800px; margin: 0 auto;';

  const topic = entry.topic || 'Untitled Quiz';

  printContainer.innerHTML = `
    <h1 style="font-size:28px;font-weight:800;color:#2563eb;margin-bottom:4px;">QuikQuiz</h1>
    <p style="font-size:14px;color:#64748b;margin-bottom:24px;">${topic}</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin-bottom:24px;">
  `;

  entry.questions.forEach((q, i) => {
    const div = document.createElement('div');
    div.style.cssText = 'margin-bottom:20px;page-break-inside:avoid;';
    const options = q._shuffled || q.options;
    div.innerHTML = `
      <p style="font-size:12px;color:#2563eb;font-weight:700;margin-bottom:4px;">Question ${i + 1}</p>
      <p style="font-size:15px;font-weight:600;margin-bottom:8px;">${q.question}</p>
      <div style="padding-left:16px;">
        ${options.map(o => '<p style="font-size:14px;margin-bottom:4px;">' + o + '</p>').join('')}
      </div>
      ${includeAnswerKey ? '<p style="font-size:14px;font-weight:600;color:#059669;margin-top:6px;">Answer: ' + q.answer + '</p>' : ''}
    `;
    printContainer.appendChild(div);
  });

  if (includeAnswerKey) {
    const keyDiv = document.createElement('div');
    keyDiv.style.cssText = 'page-break-before:always;padding-top:40px;';
    keyDiv.innerHTML = '<h2 style="font-size:22px;font-weight:700;margin-bottom:16px;">Answer Key</h2>';
    entry.questions.forEach((q, i) => {
      const item = document.createElement('p');
      item.style.cssText = 'font-size:14px;margin-bottom:6px;';
      item.innerHTML = '<strong>' + (i + 1) + '.</strong> ' + q.answer;
      keyDiv.appendChild(item);
    });
    printContainer.appendChild(keyDiv);
  }

  document.body.appendChild(printContainer);

  const safeTopic = topic.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase() || 'quiz';
  const filename = 'QuikQuiz-' + safeTopic + '.pdf';

  html2pdf()
    .set({
      margin: [15, 15],
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: 'avoid-all' }
    })
    .from(printContainer)
    .save()
    .then(() => {
      document.body.removeChild(printContainer);
    })
    .catch(() => {
      document.body.removeChild(printContainer);
      showToast('PDF export failed. Please try again.', 'error');
    });
}

/* ===== Results Modal ===== */

function showResultsModal(entry) {
  if (!entry.shareId) {
    showToast('Share the quiz first to collect results.', 'info');
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'paywall-overlay active';

  const modal = document.createElement('div');
  modal.className = 'paywall-modal results-modal';

  modal.innerHTML = '<h2 class="card-title text-center" style="margin-bottom:4px;">Results</h2>' +
    '<p style="text-align:center;color:var(--text-secondary);font-size:14px;margin-bottom:20px;">' + entry.topic + '</p>' +
    '<div id="resultsContent" style="text-align:center;padding:24px 0;color:var(--text-muted);">Loading...</div>' +
    '<button id="resultsCloseBtn" class="btn btn-secondary btn-block mt-4">Close</button>';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  document.getElementById('resultsCloseBtn').addEventListener('click', function () {
    document.body.removeChild(overlay);
  });
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) document.body.removeChild(overlay);
  });

  fetchResults(entry);
}

async function fetchResults(entry) {
  const content = document.getElementById('resultsContent');
  if (!content) return;

  try {
    const res = await fetch('/api/quiz/' + entry.shareId + '/results');
    const data = await res.json();

    if (!data.results || data.results.length === 0) {
      content.innerHTML = '<p style="color:var(--text-muted);padding:20px 0;">No submissions yet. Share the link with students.</p>';
      return;
    }

    const total = data.totalQuestions;
    const count = data.results.length;
    const avg = Math.round(data.results.reduce(function (s, r) { return s + r.percentage; }, 0) / count);

    var html = '<div style="display:flex;justify-content:center;gap:24px;margin-bottom:20px;">' +
      '<div class="score-stat"><div class="score-stat-value">' + count + '</div><div class="score-stat-label">Submissions</div></div>' +
      '<div class="score-stat correct"><div class="score-stat-value">' + avg + '%</div><div class="score-stat-label">Average</div></div>' +
      '</div>';

    data.results.forEach(function (r, idx) {
      var pct = r.percentage || Math.round((r.correct / r.total) * 100);
      var time = new Date(r.submittedAt).toLocaleString();

      html += '<div class="results-entry" data-idx="' + idx + '">' +
        '<div class="results-entry-header">' +
        '<div><strong>Submission #' + (idx + 1) + '</strong> <span style="color:var(--text-muted);font-size:12px;">' + time + '</span></div>' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
        '<div class="history-bar"><div class="history-bar-fill" style="width:' + pct + '%;background:' + (pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--error)') + '"></div></div>' +
        '<span style="font-weight:700;font-size:14px;">' + r.correct + '/' + total + '</span>' +
        '<span class="results-toggle" style="cursor:pointer;font-size:12px;color:var(--accent);">▼</span>' +
        '</div></div>' +
        '<div class="results-detail hidden">';

      if (r.answers && entry.questions) {
        entry.questions.forEach(function (q, qi) {
          var selected = r.answers[qi];
          var isCorrect = selected === q.answer;
          html += '<div class="results-q" style="margin-bottom:10px;padding:8px;background:var(--bg-body);border-radius:var(--radius-sm);">' +
            '<div style="font-size:13px;font-weight:600;margin-bottom:4px;">Q' + (qi + 1) + ': ' + q.question + '</div>' +
            '<div style="font-size:12px;">Answered: <span style="color:' + (isCorrect ? 'var(--success)' : 'var(--error)') + ';font-weight:600;">' + (selected || '—') + '</span>' +
            (!isCorrect ? ' &nbsp;·&nbsp; Correct: <span style="color:var(--success);font-weight:600;">' + q.answer + '</span>' : '') +
            '</div></div>';
        });
      }

      html += '</div></div>';
    });

    content.innerHTML = html;

    content.querySelectorAll('.results-entry-header').forEach(function (hdr) {
      hdr.addEventListener('click', function () {
        var detail = this.nextElementSibling;
        var toggle = this.querySelector('.results-toggle');
        if (detail.classList.contains('hidden')) {
          detail.classList.remove('hidden');
          if (toggle) toggle.textContent = '▲';
        } else {
          detail.classList.add('hidden');
          if (toggle) toggle.textContent = '▼';
        }
      });
    });
  } catch (e) {
    content.innerHTML = '<p style="color:var(--error);">Failed to load results.</p>';
  }
}

/* ===== Utility ===== */
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
