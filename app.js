const GITHUB_API = 'https://api.github.com/repos/shner-elmo/israeli-bagrut-test/contents/exams';

const state = {
  score: 0,
  maxScore: 100,
  exams: [],
  verbCorrect: {},   // questionId → boolean
  selfAssessed: {},  // questionId → points awarded
  cloze: {
    selected: null,       // currently selected word chip element
    placements: {},       // blankIndex → word string
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function updateScoreDisplay() {
  document.getElementById('score').textContent = fmt(state.score);
  document.getElementById('max-score').textContent = state.maxScore;
}

function addScore(delta) {
  state.score = Math.max(0, state.score + delta);
  updateScoreDisplay();
}

function formatParagraphs(text) {
  return text.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init ────────────────────────────────────────────────────────────────────

async function init() {
  try {
    const res = await fetch(GITHUB_API);
    if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
    const files = await res.json();
    const jsonFiles = files.filter(f => f.name.endsWith('.json'));

    if (jsonFiles.length === 0) {
      showError('No exam files found in the exams/ folder.');
      return;
    }

    // Fetch all JSONs to get subject/session for the picker cards
    const exams = await Promise.all(
      jsonFiles.map(async f => {
        const r = await fetch(f.download_url);
        const data = await r.json();
        return { url: f.download_url, exam: data.exam };
      })
    );
    state.exams = exams;

    if (exams.length === 1) {
      renderExam(exams[0].exam);
    } else {
      renderPicker(exams);
    }
  } catch (e) {
    showError(
      'Could not load exams. ' +
      'Make sure the site is running from GitHub Pages (not a local file://) ' +
      'and the exams/ folder exists in the repository.'
    );
    console.error(e);
  }
}

function showError(msg) {
  document.getElementById('app').innerHTML = `<p class="error-msg">${escapeHtml(msg)}</p>`;
}

// ── Picker ──────────────────────────────────────────────────────────────────

function renderPicker(exams) {
  const app = document.getElementById('app');
  app.innerHTML = `<h2 class="picker-title">Choose an exam</h2><div class="exam-cards" id="exam-cards"></div>`;
  const grid = document.getElementById('exam-cards');
  exams.forEach((e, i) => {
    const card = document.createElement('div');
    card.className = 'exam-card';
    card.innerHTML = `
      <div class="card-subject">${escapeHtml(e.exam.subject)}</div>
      <div class="card-session">${escapeHtml(e.exam.session)}</div>
      <div class="card-meta">${e.exam.duration_hours}h &middot; ${e.exam.total_points} pts</div>
      <div class="card-badge">${e.exam.type}</div>
    `;
    card.addEventListener('click', () => renderExam(e.exam));
    grid.appendChild(card);
  });
}

// ── Exam view ───────────────────────────────────────────────────────────────

function renderExam(exam) {
  // Reset scoring state
  state.score = 0;
  state.maxScore = exam.total_points;
  state.verbCorrect = {};
  state.selfAssessed = {};
  state.cloze = { selected: null, placements: {} };
  updateScoreDisplay();

  const showBack = state.exams.length > 1;
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="exam-header">
      ${showBack ? '<button class="back-btn" id="back-btn">← All Exams</button>' : ''}
      <div class="exam-title-block">
        <h2>${escapeHtml(exam.subject)}</h2>
        <div class="exam-subtitle">${escapeHtml(exam.session)} &middot; ${exam.duration_hours}h &middot; ${exam.total_points} pts</div>
      </div>
    </div>
    <div class="section-tabs" id="section-tabs"></div>
    <div id="sections-container"></div>
  `;

  if (showBack) {
    document.getElementById('back-btn').addEventListener('click', () => renderPicker(state.exams));
  }

  const tabs = document.getElementById('section-tabs');
  const container = document.getElementById('sections-container');

  exam.sections.forEach((section, i) => {
    // Render section panel (all at once, show/hide to preserve input state)
    const panel = document.createElement('div');
    panel.id = `panel-${i}`;
    panel.style.display = i === 0 ? '' : 'none';
    container.appendChild(panel);
    renderSection(section, panel);

    // Tab button
    const tab = document.createElement('button');
    tab.className = 'tab' + (i === 0 ? ' active' : '');
    tab.textContent = section.title_he;
    tab.addEventListener('click', () => {
      tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      container.querySelectorAll('[id^="panel-"]').forEach(p => { p.style.display = 'none'; });
      panel.style.display = '';
    });
    tabs.appendChild(tab);
  });
}

// ── Section ─────────────────────────────────────────────────────────────────

function renderSection(section, panel) {
  panel.innerHTML = `
    <div class="section-intro">
      <h3>${escapeHtml(section.title_he)} — ${escapeHtml(section.title_it)}</h3>
      <div class="section-pts">${section.points} נקודות</div>
      ${section.instruction_he ? `<div class="instr instr-he">${escapeHtml(section.instruction_he)}</div>` : ''}
      ${section.instruction_it ? `<div class="instr">${escapeHtml(section.instruction_it)}</div>` : ''}
    </div>
  `;

  if (section.reading_text) {
    const rc = document.createElement('div');
    rc.className = 'reading-card';
    rc.innerHTML = `
      <div class="reading-card-header">${escapeHtml(section.reading_text.title)}</div>
      <div class="reading-card-body">${formatParagraphs(section.reading_text.content)}</div>
    `;
    panel.appendChild(rc);
  }

  section.exercises.forEach(exercise => {
    const card = document.createElement('div');
    card.className = 'exercise-card';
    panel.appendChild(card);
    renderExercise(exercise, card);
  });
}

// ── Exercise dispatch ────────────────────────────────────────────────────────

function renderExercise(exercise, container) {
  if (exercise.word_bank) {
    renderCloze(exercise, container);
  } else if (exercise.tense) {
    renderVerbFill(exercise, container);
  } else if (exercise.questions && exercise.questions[0]?.underlined_part !== undefined) {
    renderQuestionFormulation(exercise, container);
  } else {
    renderComprehension(exercise, container);
  }
}

function exerciseHeader(exercise) {
  return `
    <div class="exercise-card-header">
      <h4>תרגיל ${exercise.exercise_number} <span class="exercise-pts">(${exercise.points} נקודות)</span></h4>
      ${exercise.tense ? `<span class="tense-pill">${exercise.tense}</span>` : ''}
      ${exercise.instruction_he ? `<div class="instr instr-he">${escapeHtml(exercise.instruction_he)}</div>` : ''}
      ${exercise.instruction_it ? `<div class="instr">${escapeHtml(exercise.instruction_it)}</div>` : ''}
    </div>
  `;
}

// ── Comprehension (Ex 1, 2) ──────────────────────────────────────────────────

function renderComprehension(exercise, container) {
  container.innerHTML = exerciseHeader(exercise);

  exercise.questions.forEach(q => {
    const div = document.createElement('div');
    div.className = 'comp-question';

    const pts = exercise.points_per_question ?? exercise.points;
    const isOpen = q.prompt !== undefined;

    div.innerHTML = `
      ${isOpen
        ? `<div class="open-prompt-box">
             <strong>${escapeHtml(q.prompt)}</strong>
             <p>${escapeHtml(q.description)}</p>
           </div>`
        : `<div class="question-label">${q.id}.</div>
           <div class="question-text">${escapeHtml(q.question)}</div>`
      }
      <textarea rows="${isOpen ? 5 : 3}" placeholder="Scrivi la tua risposta in italiano…"></textarea>
      <button class="submit-btn">Submit</button>
      <div class="model-answer-box" id="model-${q.id}">
        <div class="model-label">Model Answer</div>
        <p>${escapeHtml(q.answer)}</p>
        <div class="self-grade-row">
          <button class="self-btn got-it" data-pts="${pts}">✓ Got it right (+${pts} pts)</button>
          <button class="self-btn needs-work" data-pts="0">✗ Needs work</button>
        </div>
      </div>
    `;

    const submitBtn = div.querySelector('.submit-btn');
    const modelBox = div.querySelector('.model-answer-box');

    submitBtn.addEventListener('click', () => {
      modelBox.classList.add('visible');
      submitBtn.disabled = true;
    });

    div.querySelectorAll('.self-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const newPts = parseFloat(btn.dataset.pts);
        const prev = state.selfAssessed[q.id] ?? 0;
        state.selfAssessed[q.id] = newPts;
        addScore(newPts - prev);
        div.querySelectorAll('.self-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    container.appendChild(div);
  });
}

// ── Verb fill (Ex 3, 4, 5) ───────────────────────────────────────────────────

function renderVerbFill(exercise, container) {
  container.innerHTML = exerciseHeader(exercise);

  exercise.questions.forEach(q => {
    const [before, after] = q.sentence.split('__________');
    const pts = exercise.points_per_question ?? 0;
    const row = document.createElement('div');
    row.className = 'verb-row';
    row.innerHTML = `
      <span>${escapeHtml(before)}</span>
      <span class="verb-input-wrap" id="wrap-${q.id}">
        <input class="verb-input" type="text"
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
          placeholder="…"
          data-answer="${escapeHtml(q.answer)}"
          data-qid="${q.id}"
          data-pts="${pts}">
        <span class="verb-feedback"></span>
      </span>
      <span>${escapeHtml(after ?? '')}</span>
    `;

    const input = row.querySelector('.verb-input');
    input.addEventListener('input', () => checkVerbInput(input));
    container.appendChild(row);
  });
}

function checkVerbInput(input) {
  const qid = input.dataset.qid;
  const pts = parseFloat(input.dataset.pts);
  const correct = input.dataset.answer.toLowerCase().trim();
  const typed = input.value.toLowerCase().trim();
  const wrap = document.getElementById(`wrap-${qid}`);
  const icon = wrap.querySelector('.verb-feedback');
  const wasCorrect = state.verbCorrect[qid] === true;

  if (!typed) {
    wrap.classList.remove('correct', 'incorrect');
    icon.textContent = '';
    if (wasCorrect) { state.verbCorrect[qid] = false; addScore(-pts); }
    return;
  }

  if (typed === correct) {
    wrap.classList.add('correct');
    wrap.classList.remove('incorrect');
    icon.textContent = '✓';
    if (!wasCorrect) { state.verbCorrect[qid] = true; addScore(pts); }
  } else {
    wrap.classList.add('incorrect');
    wrap.classList.remove('correct');
    icon.textContent = '✗';
    if (wasCorrect) { state.verbCorrect[qid] = false; addScore(-pts); }
  }
}

// ── Cloze (Ex 6) ─────────────────────────────────────────────────────────────

function renderCloze(exercise, container) {
  container.innerHTML = exerciseHeader(exercise);

  // Word bank
  const bankDiv = document.createElement('div');
  bankDiv.className = 'word-bank';
  bankDiv.innerHTML = `<div class="word-bank-label">Word bank — click a word, then click a blank</div>`;
  exercise.word_bank.forEach(word => {
    const chip = document.createElement('button');
    chip.className = 'word-chip';
    chip.textContent = word;
    chip.dataset.word = word;
    chip.addEventListener('click', () => handleChipClick(chip, container));
    bankDiv.appendChild(chip);
  });
  container.appendChild(bankDiv);

  // Cloze text
  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'cloze-body';

  const parts = exercise.cloze_text.split('__________');
  parts.forEach((part, i) => {
    // Insert text (with paragraph breaks)
    part.split('\n\n').forEach((para, pi) => {
      if (pi > 0) bodyDiv.appendChild(document.createElement('br'));
      if (para) bodyDiv.appendChild(document.createTextNode(para));
    });

    if (i < parts.length - 1) {
      const blankNum = i + 1;
      const correctWord = exercise.answers[i].word;
      const blank = document.createElement('button');
      blank.className = 'cloze-blank';
      blank.dataset.blank = blankNum;
      blank.dataset.correct = correctWord;
      blank.textContent = `[${blankNum}]`;
      blank.addEventListener('click', () => handleBlankClick(blank, container, exercise));
      bodyDiv.appendChild(blank);
    }
  });

  container.appendChild(bodyDiv);
}

function handleChipClick(chip, container) {
  if (chip.classList.contains('used')) return;

  const currentSelected = container.querySelector('.word-chip.selected');
  if (currentSelected) currentSelected.classList.remove('selected');

  if (state.cloze.selected === chip) {
    state.cloze.selected = null;
    // Remove highlight from blanks
    container.querySelectorAll('.cloze-blank:not(.filled)').forEach(b => b.classList.remove('has-selection'));
  } else {
    state.cloze.selected = chip;
    chip.classList.add('selected');
    container.querySelectorAll('.cloze-blank:not(.filled)').forEach(b => b.classList.add('has-selection'));
  }
}

function handleBlankClick(blank, container, exercise) {
  const blankNum = parseInt(blank.dataset.blank);
  const correctWord = blank.dataset.correct;
  const pts = exercise.points_per_blank ?? 2;

  // Clicking a filled blank → clear it
  if (state.cloze.placements[blankNum]) {
    const oldWord = state.cloze.placements[blankNum];
    delete state.cloze.placements[blankNum];

    // Return chip to bank
    const chip = container.querySelector(`.word-chip[data-word="${CSS.escape(oldWord)}"]`);
    if (chip) chip.classList.remove('used');

    // Deduct points if it was correct
    if (oldWord === correctWord) addScore(-pts);

    blank.textContent = `[${blankNum}]`;
    blank.className = 'cloze-blank';
    if (state.cloze.selected) blank.classList.add('has-selection');
    return;
  }

  // No word selected → nothing to place
  if (!state.cloze.selected) return;

  const word = state.cloze.selected.dataset.word;
  state.cloze.placements[blankNum] = word;

  // Mark chip used
  state.cloze.selected.classList.remove('selected');
  state.cloze.selected.classList.add('used');
  state.cloze.selected = null;

  // Remove has-selection hint from all blanks
  container.querySelectorAll('.cloze-blank').forEach(b => b.classList.remove('has-selection'));

  // Fill blank
  blank.textContent = word;
  blank.classList.add('filled');
  if (word === correctWord) {
    blank.classList.add('correct');
    addScore(pts);
  } else {
    blank.classList.add('incorrect');
  }
}

// ── Question formulation (Ex 7) ───────────────────────────────────────────────

function renderQuestionFormulation(exercise, container) {
  container.innerHTML = exerciseHeader(exercise);

  exercise.questions.forEach(q => {
    const pts = exercise.points_per_question ?? exercise.points;
    const div = document.createElement('div');
    div.className = 'comp-question';

    // Highlight the underlined part in the answer
    const safeAnswer = escapeHtml(q.answer);
    const safePart = escapeHtml(q.underlined_part);
    const highlighted = safeAnswer.replace(safePart, `<mark>${safePart}</mark>`);

    div.innerHTML = `
      <div class="answer-display">
        <span class="ans-label">Answer</span>
        ${highlighted}
      </div>
      <textarea rows="2" placeholder="Scrivi la domanda in italiano…"></textarea>
      <button class="submit-btn">Submit</button>
      <div class="model-answer-box" id="model-${q.id}">
        <div class="model-label">Model Question</div>
        <p>${escapeHtml(q.question)}</p>
        <div class="self-grade-row">
          <button class="self-btn got-it" data-pts="${pts}">✓ Got it right (+${pts} pts)</button>
          <button class="self-btn needs-work" data-pts="0">✗ Needs work</button>
        </div>
      </div>
    `;

    const submitBtn = div.querySelector('.submit-btn');
    const modelBox = div.querySelector('.model-answer-box');

    submitBtn.addEventListener('click', () => {
      modelBox.classList.add('visible');
      submitBtn.disabled = true;
    });

    div.querySelectorAll('.self-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const newPts = parseFloat(btn.dataset.pts);
        const prev = state.selfAssessed[q.id] ?? 0;
        state.selfAssessed[q.id] = newPts;
        addScore(newPts - prev);
        div.querySelectorAll('.self-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    container.appendChild(div);
  });
}

// ── Start ────────────────────────────────────────────────────────────────────
init();
