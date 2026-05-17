// Meal definitions
const MEALS = [
  { id: 'breakfast', name: 'Breakfast', time: '10:00 AM', defaultGoals: { cal: 500, carb: 50, prot: 40, fat: 15 } },
  { id: 'snack1',    name: 'Snack 1',   time: '12:30 PM', defaultGoals: { cal: 200, carb: 20, prot: 20, fat: 8 } },
  { id: 'lunch',     name: 'Lunch',     time: '2:00 PM',  defaultGoals: { cal: 600, carb: 60, prot: 50, fat: 20 } },
  { id: 'snack2',    name: 'Snack 2',   time: '4:30 PM',  defaultGoals: { cal: 150, carb: 15, prot: 15, fat: 5 } },
  { id: 'dinner',    name: 'Dinner',    time: '7:00 PM',  defaultGoals: { cal: 650, carb: 70, prot: 50, fat: 22 } },
];

// ─── Persistence ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'macrotracker_state';

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function blankFood() {
  return { name: '', per100: { cal: '', carb: '', prot: '', fat: '' }, grams: '' };
}

function defaultState() {
  const meals = {};
  MEALS.forEach(m => {
    meals[m.id] = {
      goals: { ...m.defaultGoals },
      foods: []
    };
  });
  return { date: todayKey(), goals: { cal: 2100, carb: 215, prot: 175, fat: 70 }, meals };
}

function cleanNumber(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

function normalizeFood(food) {
  return {
    name: food?.name ? String(food.name) : '',
    grams: cleanNumber(food?.grams),
    per100: {
      cal: cleanNumber(food?.per100?.cal),
      carb: cleanNumber(food?.per100?.carb),
      prot: cleanNumber(food?.per100?.prot),
      fat: cleanNumber(food?.per100?.fat),
    }
  };
}

function isBlankFood(food) {
  if (!food) return true;
  return !String(food.name || '').trim()
    && !String(food.grams || '').trim()
    && !String(food.per100?.cal || '').trim()
    && !String(food.per100?.carb || '').trim()
    && !String(food.per100?.prot || '').trim()
    && !String(food.per100?.fat || '').trim();
}

function normalizeState(saved) {
  const fresh = defaultState();
  if (!saved || typeof saved !== 'object') return fresh;

  fresh.date = saved.date || todayKey();
  fresh.goals = { ...fresh.goals, ...(saved.goals || {}) };

  MEALS.forEach(m => {
    const savedMeal = saved.meals?.[m.id] || {};
    fresh.meals[m.id].goals = { ...fresh.meals[m.id].goals, ...(savedMeal.goals || {}) };
    fresh.meals[m.id].foods = Array.isArray(savedMeal.foods)
      ? savedMeal.foods.map(normalizeFood).filter(food => !isBlankFood(food))
      : [];
  });

  return fresh;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();

    const saved = normalizeState(JSON.parse(raw));

    // New day: keep daily goals + meal goals, wipe food entries.
    if (saved.date !== todayKey()) {
      const fresh = defaultState();
      fresh.goals = saved.goals;
      MEALS.forEach(m => {
        fresh.meals[m.id].goals = saved.meals[m.id].goals;
      });
      return fresh;
    }

    return saved;
  } catch {
    return defaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

// ─── State ───────────────────────────────────────────────────────────────────

let state = loadState();
const editingFoods = new Set();

function foodKey(mealId, idx) {
  return `${mealId}:${idx}`;
}

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatInt(value) {
  const n = Math.round(Number(value) || 0);
  return Number.isFinite(n) ? String(n) : '0';
}

function formatMacroSummary(goals) {
  return `${formatInt(goals.cal)} kcal · ${formatInt(goals.carb)}C · ${formatInt(goals.prot)}P · ${formatInt(goals.fat)}F`;
}

// Set today's date
const dateEl = document.getElementById('today-date');
if (dateEl) {
  dateEl.textContent = new Date().toLocaleDateString('en-IE', {
    weekday: 'short', day: 'numeric', month: 'short'
  });
}

// ─── Mobile zoom prevention ────────────────────────────────────────────────

let lastTouchEnd = 0;
document.addEventListener('touchend', (event) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    event.preventDefault();
  }
  lastTouchEnd = now;
}, { passive: false });

document.addEventListener('gesturestart', (event) => {
  event.preventDefault();
});

// ─── Render all meal cards ──────────────────────────────────────────────────

function renderMeals() {
  const container = document.getElementById('meals-container');
  if (!container) return;

  container.innerHTML = '';

  MEALS.forEach(mDef => {
    const mState = state.meals[mDef.id];
    const card = document.createElement('div');
    card.className = 'meal-card open';
    card.id = `card-${mDef.id}`;

    const totals = calcMealTotals(mDef.id);

    card.innerHTML = `
      <div class="meal-header" onclick="toggleMeal('${mDef.id}')">
        <div class="meal-title-wrap">
          <div class="meal-dot"></div>
          <div>
            <span class="meal-name">${escapeHTML(mDef.name)}</span>
            <span class="meal-time">${escapeHTML(mDef.time)}</span>
          </div>
        </div>
        <div class="meal-summary-pills" id="pills-${mDef.id}">
          <span class="pill cal"  id="pill-cal-${mDef.id}">${totals.cal} kcal</span>
          <span class="pill carb" id="pill-carb-${mDef.id}">${totals.carb}C</span>
          <span class="pill prot" id="pill-prot-${mDef.id}">${totals.prot}P</span>
          <span class="pill fat"  id="pill-fat-${mDef.id}">${totals.fat}F</span>
        </div>
        <span class="meal-chevron">⌄</span>
      </div>

      <div class="meal-body" id="body-${mDef.id}">
        <div class="food-log" id="foods-${mDef.id}">
          <div class="section-heading-row">
            <div class="food-input-label">Foods</div>
            <button class="add-food-btn small" onclick="addFood('${mDef.id}')">+ Add</button>
          </div>
          <div id="food-rows-${mDef.id}"></div>
        </div>

        <div class="meal-totals" id="totals-${mDef.id}">
          ${renderMealTotals(mDef.id, totals, mState.goals)}
        </div>

        <details class="meal-goals-details">
          <summary>
            <span>Meal goals</span>
            <strong id="meal-goals-summary-${mDef.id}">${formatMacroSummary(mState.goals)}</strong>
          </summary>
          <div class="meal-goals-row">
            ${['cal','carb','prot','fat'].map(m => `
              <label class="meal-goal-item ${m}">
                <span class="meal-goal-label ${m}">${m === 'cal' ? 'Calories' : m.charAt(0).toUpperCase() + m.slice(1)}</span>
                <input class="meal-goal-input" type="number" inputmode="decimal"
                  placeholder="${escapeHTML(mState.goals[m])}"
                  value="${escapeHTML(mState.goals[m])}"
                  oninput="setMealGoal('${mDef.id}','${m}', this.value)">
              </label>
            `).join('')}
          </div>
        </details>
      </div>
    `;

    container.appendChild(card);
    renderFoodRows(mDef.id);
  });

  setGlobalInputs();
}

// ─── Per-food macro calculation ─────────────────────────────────────────────

function calcFoodMacros(food) {
  const g = parseFloat(food.grams) || 0;
  if (g <= 0) return null;

  return {
    cal:  Math.round((parseFloat(food.per100.cal)  || 0) * g / 100),
    carb: Math.round((parseFloat(food.per100.carb) || 0) * g / 100),
    prot: Math.round((parseFloat(food.per100.prot) || 0) * g / 100),
    fat:  Math.round((parseFloat(food.per100.fat)  || 0) * g / 100),
  };
}

function displayFoodName(food, idx) {
  const name = String(food.name || '').trim();
  return name || `Food ${idx + 1}`;
}

function isMobile() {
  return window.innerWidth <= 720;
}

// ─── Food rows ──────────────────────────────────────────────────────────────

function renderFoodRows(mealId) {
  const container = document.getElementById(`food-rows-${mealId}`);
  if (!container) return;

  const foods = state.meals[mealId].foods || [];
  container.innerHTML = '';

  if (foods.length === 0) {
    container.innerHTML = `<div class="empty-food-state">No foods yet. Tap <b>+ Add</b> when you eat.</div>`;
    return;
  }

  foods.forEach((food, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'food-item-wrap';

    const shouldEdit = editingFoods.has(foodKey(mealId, idx)) || isBlankFood(food);

    if (shouldEdit || !isMobile()) {
      wrap.innerHTML = renderFoodEditor(mealId, idx, food);
    } else {
      wrap.innerHTML = renderFoodSummary(mealId, idx, food);
    }

    container.appendChild(wrap);
    updateFoodPreview(mealId, idx);
  });
}

function renderFoodSummary(mealId, idx, food) {
  const macros = calcFoodMacros(food) || { cal: 0, carb: 0, prot: 0, fat: 0 };
  const grams = parseFloat(food.grams) || 0;
  const name = displayFoodName(food, idx);

  return `
    <div class="food-summary-card" role="button" tabindex="0" onclick="startEditFood('${mealId}', ${idx})">
      <div class="food-summary-main">
        <div class="food-summary-title">${escapeHTML(name)}</div>
        <div class="food-summary-sub">${formatInt(grams)}g eaten</div>
      </div>

      <div class="food-summary-cal">
        <strong>${macros.cal}</strong>
        <span>kcal</span>
      </div>

      <button class="summary-delete-btn" aria-label="Delete ${escapeHTML(name)}" onclick="event.stopPropagation(); removeFood('${mealId}', ${idx})">×</button>

      <div class="food-summary-macros">
        <span class="summary-chip carb">${macros.carb}C</span>
        <span class="summary-chip prot">${macros.prot}P</span>
        <span class="summary-chip fat">${macros.fat}F</span>
      </div>
    </div>
  `;
}

function renderFoodEditor(mealId, idx, food) {
  return `
    <div class="food-edit-card">
      <div class="food-edit-top">
        <input class="food-name-input" id="food-name-${mealId}-${idx}" type="text" placeholder="Food name" value="${escapeHTML(food.name)}"
          oninput="updateFoodField('${mealId}', ${idx}, 'name', this.value)">

        <label class="grams-field">
          <span>grams</span>
          <input class="food-macro-input" type="number" inputmode="decimal" placeholder="0" value="${escapeHTML(food.grams)}"
            oninput="updateFoodField('${mealId}', ${idx}, 'grams', this.value)">
        </label>
      </div>

      <div class="per100-label">Per 100g</div>
      <div class="per100-grid">
        <label class="macro-edit-field cal">
          <span>kcal</span>
          <input class="food-macro-input" type="number" inputmode="decimal" placeholder="0" value="${escapeHTML(food.per100.cal)}"
            oninput="updateFoodField('${mealId}', ${idx}, 'per100.cal', this.value)">
        </label>
        <label class="macro-edit-field carb">
          <span>carbs</span>
          <input class="food-macro-input" type="number" inputmode="decimal" placeholder="0" value="${escapeHTML(food.per100.carb)}"
            oninput="updateFoodField('${mealId}', ${idx}, 'per100.carb', this.value)">
        </label>
        <label class="macro-edit-field prot">
          <span>protein</span>
          <input class="food-macro-input" type="number" inputmode="decimal" placeholder="0" value="${escapeHTML(food.per100.prot)}"
            oninput="updateFoodField('${mealId}', ${idx}, 'per100.prot', this.value)">
        </label>
        <label class="macro-edit-field fat">
          <span>fat</span>
          <input class="food-macro-input" type="number" inputmode="decimal" placeholder="0" value="${escapeHTML(food.per100.fat)}"
            oninput="updateFoodField('${mealId}', ${idx}, 'per100.fat', this.value)">
        </label>
      </div>

      <div class="editor-total-strip">
        <div class="editor-total cal"><span>kcal</span><strong id="preview-cal-${mealId}-${idx}">—</strong></div>
        <div class="editor-total carb"><span>carbs</span><strong id="preview-carb-${mealId}-${idx}">—</strong></div>
        <div class="editor-total prot"><span>protein</span><strong id="preview-prot-${mealId}-${idx}">—</strong></div>
        <div class="editor-total fat"><span>fat</span><strong id="preview-fat-${mealId}-${idx}">—</strong></div>
      </div>

      <div class="food-edit-actions">
        <button class="delete-food-btn" onclick="removeFood('${mealId}', ${idx})">Delete</button>
        <button class="done-food-btn" onclick="finishEditFood('${mealId}', ${idx})">Done</button>
      </div>
    </div>
  `;
}

function updateFoodPreview(mealId, idx) {
  const food = state.meals[mealId]?.foods?.[idx];
  if (!food) return;

  const macros = calcFoodMacros(food);
  const values = macros || { cal: '—', carb: '—', prot: '—', fat: '—' };

  ['cal', 'carb', 'prot', 'fat'].forEach(m => {
    const el = document.getElementById(`preview-${m}-${mealId}-${idx}`);
    if (el) el.textContent = values[m];
  });
}

function startEditFood(mealId, idx) {
  editingFoods.add(foodKey(mealId, idx));
  renderFoodRows(mealId);

  requestAnimationFrame(() => {
    const input = document.getElementById(`food-name-${mealId}-${idx}`);
    if (input) input.focus({ preventScroll: true });
  });
}

function finishEditFood(mealId, idx) {
  const food = state.meals[mealId]?.foods?.[idx];
  if (!food) return;

  if (isBlankFood(food)) {
    removeFood(mealId, idx);
    return;
  }

  editingFoods.delete(foodKey(mealId, idx));
  renderFoodRows(mealId);
  updateAll();
}

// ─── Meal totals HTML ────────────────────────────────────────────────────────

function renderMealTotals(mealId, totals, goals) {
  return ['cal','carb','prot','fat'].map(m => {
    const t = totals[m];
    const g = parseFloat(goals[m]) || 0;
    const label = m === 'cal' ? 'Calories' : m === 'prot' ? 'Protein' : m.charAt(0).toUpperCase() + m.slice(1);
    const unit  = m === 'cal' ? 'kcal' : 'g';
    const over  = g > 0 && t > g;

    return `
      <div class="meal-total-item ${m}">
        <span class="meal-total-label">${label}</span>
        <span class="meal-total-val ${m} ${over ? 'over' : ''}">${t}<small>${unit}</small></span>
        <span class="meal-total-goal">goal ${formatInt(g)}${unit}</span>
      </div>
    `;
  }).join('');
}

// ─── Meal macro totals calculation ──────────────────────────────────────────

function calcMealTotals(mealId) {
  const foods = state.meals[mealId].foods || [];
  let cal = 0, carb = 0, prot = 0, fat = 0;

  foods.forEach(f => {
    const g = parseFloat(f.grams) || 0;
    if (g > 0) {
      cal  += (parseFloat(f.per100.cal)  || 0) * g / 100;
      carb += (parseFloat(f.per100.carb) || 0) * g / 100;
      prot += (parseFloat(f.per100.prot) || 0) * g / 100;
      fat  += (parseFloat(f.per100.fat)  || 0) * g / 100;
    }
  });

  return {
    cal:  Math.round(cal),
    carb: Math.round(carb),
    prot: Math.round(prot),
    fat:  Math.round(fat)
  };
}

// ─── Update remaining + all meal summaries ───────────────────────────────────

function updateAll() {
  const gc    = parseFloat(document.getElementById('goal-cal')?.value)  || 0;
  const gcarb = parseFloat(document.getElementById('goal-carb')?.value) || 0;
  const gprot = parseFloat(document.getElementById('goal-prot')?.value) || 0;
  const gfat  = parseFloat(document.getElementById('goal-fat')?.value)  || 0;

  let totCal = 0, totCarb = 0, totProt = 0, totFat = 0;

  MEALS.forEach(m => {
    const t = calcMealTotals(m.id);
    totCal  += t.cal;
    totCarb += t.carb;
    totProt += t.prot;
    totFat  += t.fat;

    const pillCal  = document.getElementById(`pill-cal-${m.id}`);
    const pillCarb = document.getElementById(`pill-carb-${m.id}`);
    const pillProt = document.getElementById(`pill-prot-${m.id}`);
    const pillFat  = document.getElementById(`pill-fat-${m.id}`);

    if (pillCal)  pillCal.textContent  = `${t.cal} kcal`;
    if (pillCarb) pillCarb.textContent = `${t.carb}C`;
    if (pillProt) pillProt.textContent = `${t.prot}P`;
    if (pillFat)  pillFat.textContent  = `${t.fat}F`;

    const totalsEl = document.getElementById(`totals-${m.id}`);
    if (totalsEl) totalsEl.innerHTML = renderMealTotals(m.id, t, state.meals[m.id].goals);

    const mealGoalSummary = document.getElementById(`meal-goals-summary-${m.id}`);
    if (mealGoalSummary) mealGoalSummary.textContent = formatMacroSummary(state.meals[m.id].goals);
  });

  const remCal  = gc    - totCal;
  const remCarb = gcarb - totCarb;
  const remProt = gprot - totProt;
  const remFat  = gfat  - totFat;

  const setRem = (id, val, goal, barId, cls) => {
    const el  = document.getElementById(id);
    const bar = document.getElementById(barId);
    if (!el || !bar) return;

    if (goal === 0) {
      el.textContent = '—';
      el.className = `macro-val ${cls}`;
      bar.style.width = '0%';
      return;
    }

    if (val < 0) {
      el.textContent = `+${Math.abs(Math.round(val))}`;
      el.className = `macro-val ${cls} over-goal`;
      bar.style.width = '100%';
    } else {
      el.textContent = Math.round(val);
      el.className = `macro-val ${cls}`;
      const pct = Math.min(100, Math.max(0, ((goal - val) / goal) * 100));
      bar.style.width = pct + '%';
    }
  };

  setRem('rem-cal',  remCal,  gc,    'bar-cal',  'cal');
  setRem('rem-carb', remCarb, gcarb, 'bar-carb', 'carb');
  setRem('rem-prot', remProt, gprot, 'bar-prot', 'prot');
  setRem('rem-fat',  remFat,  gfat,  'bar-fat',  'fat');

  state.goals.cal  = gc;
  state.goals.carb = gcarb;
  state.goals.prot = gprot;
  state.goals.fat  = gfat;

  const dailySummary = document.getElementById('daily-goals-summary');
  if (dailySummary) dailySummary.textContent = formatMacroSummary(state.goals);

  saveState();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setGlobalInputs() {
  const cal = document.getElementById('goal-cal');
  const carb = document.getElementById('goal-carb');
  const prot = document.getElementById('goal-prot');
  const fat = document.getElementById('goal-fat');

  if (cal)  cal.value  = state.goals.cal;
  if (carb) carb.value = state.goals.carb;
  if (prot) prot.value = state.goals.prot;
  if (fat)  fat.value  = state.goals.fat;
}

function toggleMeal(mealId) {
  document.getElementById(`card-${mealId}`)?.classList.toggle('open');
}

function addFood(mealId) {
  if (!Array.isArray(state.meals[mealId].foods)) state.meals[mealId].foods = [];

  state.meals[mealId].foods.push(blankFood());
  const idx = state.meals[mealId].foods.length - 1;
  editingFoods.add(foodKey(mealId, idx));

  renderFoodRows(mealId);
  updateAll();

  requestAnimationFrame(() => {
    const input = document.getElementById(`food-name-${mealId}-${idx}`);
    if (input) input.focus({ preventScroll: false });
  });
}

function removeFood(mealId, idx) {
  if (!Array.isArray(state.meals[mealId].foods)) return;

  state.meals[mealId].foods.splice(idx, 1);

  // Rebuild edit keys for this meal because indexes have shifted.
  [...editingFoods].forEach(key => {
    if (key.startsWith(`${mealId}:`)) editingFoods.delete(key);
  });

  renderFoodRows(mealId);
  updateAll();
}

function updateFoodField(mealId, idx, field, value) {
  const food = state.meals[mealId]?.foods?.[idx];
  if (!food) return;

  if (field === 'name') {
    food.name = value;
  } else if (field === 'grams') {
    food.grams = value;
  } else if (field.startsWith('per100.')) {
    food.per100[field.split('.')[1]] = value;
  }

  updateFoodPreview(mealId, idx);
  updateAll();
}

function setMealGoal(mealId, macro, value) {
  state.meals[mealId].goals[macro] = parseFloat(value) || 0;
  updateAll();
}

function resetAll() {
  const btn = document.querySelector('.reset-btn');
  if (!btn) return;

  if (!btn.classList.contains('confirming')) {
    btn.classList.add('confirming');
    btn.textContent = 'Confirm?';
    setTimeout(() => {
      btn.classList.remove('confirming');
      btn.textContent = '↺ Reset';
    }, 3000);
    return;
  }

  btn.classList.remove('confirming');
  btn.textContent = '↺ Reset';

  MEALS.forEach(m => {
    state.meals[m.id].foods = [];
  });

  editingFoods.clear();
  renderMeals();
  updateAll();
}

// ─── Init ────────────────────────────────────────────────────────────────────

renderMeals();
updateAll();
window.addEventListener('beforeunload', saveState);

let lastMobile = isMobile();
window.addEventListener('resize', () => {
  const nowMobile = isMobile();
  if (nowMobile !== lastMobile) {
    lastMobile = nowMobile;
    MEALS.forEach(m => renderFoodRows(m.id));
  }
});
