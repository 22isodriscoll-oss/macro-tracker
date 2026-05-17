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

function defaultState() {
  const meals = {};
  MEALS.forEach(m => {
    meals[m.id] = {
      goals: { ...m.defaultGoals },
      foods: [{ name: '', per100: { cal: '', carb: '', prot: '', fat: '' }, grams: '' }]
    };
  });
  return { date: todayKey(), goals: { cal: 2100, carb: 215, prot: 175, fat: 70 }, meals };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const saved = JSON.parse(raw);
    // New day: keep goals + meal goals, wipe food entries
    if (saved.date !== todayKey()) {
      const fresh = defaultState();
      fresh.goals = saved.goals;
      MEALS.forEach(m => {
        if (saved.meals?.[m.id]?.goals) fresh.meals[m.id].goals = saved.meals[m.id].goals;
      });
      return fresh;
    }
    return saved;
  } catch { return defaultState(); }
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

// ─── State ───────────────────────────────────────────────────────────────────

let state = loadState();

// Set today's date
document.getElementById('today-date').textContent = new Date().toLocaleDateString('en-IE', {
  weekday: 'long', day: 'numeric', month: 'long'
});



// ─── Mobile zoom prevention ────────────────────────────────────────────────
// Stops accidental double-tap zoom when using the app from a phone home screen.
let lastTouchEnd = 0;
document.addEventListener('touchend', (event) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    event.preventDefault();
  }
  lastTouchEnd = now;
}, { passive: false });

// Extra iOS Safari/Home Screen safeguard for pinch-style gesture zoom.
document.addEventListener('gesturestart', (event) => {
  event.preventDefault();
});

// ─── Render all meal cards ──────────────────────────────────────────────────

function renderMeals() {
  const container = document.getElementById('meals-container');
  container.innerHTML = '';
  MEALS.forEach(mDef => {
    const mState = state.meals[mDef.id];
    const card = document.createElement('div');
    card.className = 'meal-card open';
    card.id = `card-${mDef.id}`;

    const totals = calcMealTotals(mDef.id);

    card.innerHTML = `
      <div class="meal-header" onclick="toggleMeal('${mDef.id}')">
        <div class="meal-dot"></div>
        <span class="meal-name">${mDef.name}</span>
        <div class="meal-summary-pills" id="pills-${mDef.id}">
          <span class="pill cal"  id="pill-cal-${mDef.id}">cal ${totals.cal}</span>
          <span class="pill carb" id="pill-carb-${mDef.id}">carb ${totals.carb}g</span>
          <span class="pill prot" id="pill-prot-${mDef.id}">prot ${totals.prot}g</span>
          <span class="pill fat"  id="pill-fat-${mDef.id}">fat ${totals.fat}g</span>
        </div>
        <span class="meal-time">${mDef.time}</span>
        <span class="meal-chevron">▲</span>
      </div>
      <div class="meal-body" id="body-${mDef.id}">

        <!-- Meal goals -->
        <div>
          <div class="food-input-label">Meal Goals</div>
          <div class="meal-goals-row">
            ${['cal','carb','prot','fat'].map(m => `
              <div class="meal-goal-item">
                <span class="meal-goal-label ${m}">${m === 'cal' ? 'Calories' : m.charAt(0).toUpperCase() + m.slice(1)}</span>
                <input class="meal-goal-input" type="number"
                  placeholder="${mState.goals[m]}"
                  value="${mState.goals[m]}"
                  onchange="setMealGoal('${mDef.id}','${m}', this.value)">
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Food log -->
        <div id="foods-${mDef.id}">
          <div class="food-input-label">Food Log</div>
          <div class="food-log-header" style="display:grid; grid-template-columns: 140px 80px 80px 80px 80px 80px 80px 30px; gap:6px; font-size:9px; letter-spacing:0.08em; color:var(--muted); text-transform:uppercase; padding:0 2px; margin-bottom:4px;">
            <span>Food</span>
            <span style="grid-column:span 4; text-align:center; border-bottom:1px solid var(--border); padding-bottom:2px;">Per 100g</span>
            <span></span>
            <span>Amount</span>
            <span></span>
          </div>
          <div class="food-log-header" style="display:grid; grid-template-columns: 140px 80px 80px 80px 80px 80px 80px 30px; gap:6px; font-size:9px; letter-spacing:0.08em; color:var(--muted); text-transform:uppercase; padding:0 2px; margin-bottom:6px;">
            <span></span><span>kcal</span><span>carbs</span><span>prot</span><span>fat</span><span></span><span>grams</span><span></span>
          </div>
          <div id="food-rows-${mDef.id}"></div>
          <button class="add-food-btn" onclick="addFood('${mDef.id}')">+ Add Food</button>
        </div>

        <!-- Meal totals -->
        <div class="meal-totals" id="totals-${mDef.id}">
          ${renderMealTotals(mDef.id, totals, mState.goals)}
        </div>
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

// ─── Render food rows with breakdown ────────────────────────────────────────

function isMobile() {
  return window.innerWidth <= 640;
}

function renderFoodRows(mealId) {
  const container = document.getElementById(`food-rows-${mealId}`);
  if (!container) return;
  container.innerHTML = '';

  state.meals[mealId].foods.forEach((food, idx) => {
    const macros  = calcFoodMacros(food);
    const hasData = macros !== null;
    const wrap    = document.createElement('div');

    if (isMobile()) {
      // ── Mobile: compact phone-first card layout ─────────────────────────
      wrap.innerHTML = `
        <div class="food-row-grid compact-food-card">
          <div class="mobile-food-top">
            <input class="food-name-input mobile-food-name" type="text" placeholder="Food" value="${food.name}"
              oninput="updateFoodField('${mealId}',${idx},'name',this.value)">
            <input class="food-macro-input mobile-grams-input" type="number" inputmode="decimal" placeholder="g" value="${food.grams}"
              aria-label="grams eaten"
              oninput="updateFoodField('${mealId}',${idx},'grams',this.value)">
            <button class="remove-food-btn" aria-label="Remove food" onclick="removeFood('${mealId}',${idx})">×</button>
          </div>

          <div class="mobile-per100-grid compact-per100-grid" aria-label="Macros per 100 grams">
            <label class="compact-macro-field cal">
              <span>kcal/100g</span>
              <input class="food-macro-input" type="number" inputmode="decimal" placeholder="0" value="${food.per100.cal}"
                oninput="updateFoodField('${mealId}',${idx},'per100.cal',this.value)">
            </label>
            <label class="compact-macro-field carb">
              <span>carb/100g</span>
              <input class="food-macro-input" type="number" inputmode="decimal" placeholder="0" value="${food.per100.carb}"
                oninput="updateFoodField('${mealId}',${idx},'per100.carb',this.value)">
            </label>
            <label class="compact-macro-field prot">
              <span>prot/100g</span>
              <input class="food-macro-input" type="number" inputmode="decimal" placeholder="0" value="${food.per100.prot}"
                oninput="updateFoodField('${mealId}',${idx},'per100.prot',this.value)">
            </label>
            <label class="compact-macro-field fat">
              <span>fat/100g</span>
              <input class="food-macro-input" type="number" inputmode="decimal" placeholder="0" value="${food.per100.fat}"
                oninput="updateFoodField('${mealId}',${idx},'per100.fat',this.value)">
            </label>
          </div>
        </div>
        <div class="food-breakdown-grid compact-total-strip">
          <div class="breakdown-val cal  ${!hasData ? 'empty' : ''}"><span class="bd-label">kcal</span><span class="bd-num">${hasData ? macros.cal  : '—'}</span></div>
          <div class="breakdown-val carb ${!hasData ? 'empty' : ''}"><span class="bd-label">carb</span><span class="bd-num">${hasData ? macros.carb : '—'}</span><span class="bd-unit">${hasData ? 'g' : ''}</span></div>
          <div class="breakdown-val prot ${!hasData ? 'empty' : ''}"><span class="bd-label">prot</span><span class="bd-num">${hasData ? macros.prot : '—'}</span><span class="bd-unit">${hasData ? 'g' : ''}</span></div>
          <div class="breakdown-val fat  ${!hasData ? 'empty' : ''}"><span class="bd-label">fat</span><span class="bd-num">${hasData ? macros.fat  : '—'}</span><span class="bd-unit">${hasData ? 'g' : ''}</span></div>
        </div>
      `;
    } else {
      // ── Desktop: horizontal grid layout ─────────────────────────────────
      const row = document.createElement('div');
      row.style.cssText = 'display:grid; grid-template-columns: 140px 80px 80px 80px 80px 80px 80px 30px; gap:6px; margin-bottom:4px; align-items:center;';
      row.innerHTML = `
        <input class="food-name-input" type="text" placeholder="Food name" value="${food.name}"
          oninput="updateFoodField('${mealId}',${idx},'name',this.value)">
        <input class="food-macro-input" type="number" placeholder="0" value="${food.per100.cal}"
          oninput="updateFoodField('${mealId}',${idx},'per100.cal',this.value)">
        <input class="food-macro-input" type="number" placeholder="0" value="${food.per100.carb}"
          oninput="updateFoodField('${mealId}',${idx},'per100.carb',this.value)">
        <input class="food-macro-input" type="number" placeholder="0" value="${food.per100.prot}"
          oninput="updateFoodField('${mealId}',${idx},'per100.prot',this.value)">
        <input class="food-macro-input" type="number" placeholder="0" value="${food.per100.fat}"
          oninput="updateFoodField('${mealId}',${idx},'per100.fat',this.value)">
        <span style="font-size:9px;color:var(--muted);text-align:center;">×</span>
        <input class="food-macro-input" type="number" placeholder="0g" value="${food.grams}"
          oninput="updateFoodField('${mealId}',${idx},'grams',this.value)">
        <button class="remove-food-btn" onclick="removeFood('${mealId}',${idx})">×</button>
      `;
      wrap.appendChild(row);

      const brow = document.createElement('div');
      brow.className = 'food-breakdown';
      const fmt = (val, cls, unit) => `
        <div class="breakdown-val ${cls} ${!hasData ? 'empty' : ''}">
          <span class="bd-num">${hasData ? val : '—'}</span>
          <span class="bd-unit">${hasData ? unit : ''}</span>
        </div>`;
      brow.innerHTML = `
        <div class="breakdown-spacer" style="font-size:9px;color:var(--muted);display:flex;align-items:center;padding-left:2px;">
          ${hasData ? '↳ this food' : '<span style="color:#3a3a3a">↳ fill in grams</span>'}
        </div>
        ${fmt(macros?.cal,  'cal',  'kcal')}
        ${fmt(macros?.carb, 'carb', 'g')}
        ${fmt(macros?.prot, 'prot', 'g')}
        ${fmt(macros?.fat,  'fat',  'g')}
        <div></div><div></div><div></div>
      `;
      wrap.appendChild(brow);
    }

    container.appendChild(wrap);
  });
}

// ─── Meal totals HTML ────────────────────────────────────────────────────────

function renderMealTotals(mealId, totals, goals) {
  return ['cal','carb','prot','fat'].map(m => {
    const t = totals[m];
    const g = goals[m];
    const label = m === 'cal' ? 'Calories' : m.charAt(0).toUpperCase() + m.slice(1);
    const unit  = m === 'cal' ? 'kcal' : 'g';
    const over  = t > g;
    return `
      <div class="meal-total-item">
        <span class="meal-total-label">${label}</span>
        <span class="meal-total-val ${m} ${over ? 'over' : ''}">${t}<span style="font-size:12px;font-weight:400"> ${unit}</span></span>
        <span class="meal-total-goal">goal: ${g}${unit}</span>
      </div>
    `;
  }).join('');
}

// ─── Meal macro totals calculation ──────────────────────────────────────────

function calcMealTotals(mealId) {
  const foods = state.meals[mealId].foods;
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

    // Summary pills
    document.getElementById(`pill-cal-${m.id}`).textContent  = `cal ${t.cal}`;
    document.getElementById(`pill-carb-${m.id}`).textContent = `carb ${t.carb}g`;
    document.getElementById(`pill-prot-${m.id}`).textContent = `prot ${t.prot}g`;
    document.getElementById(`pill-fat-${m.id}`).textContent  = `fat ${t.fat}g`;

    // Meal totals panel
    const totalsEl = document.getElementById(`totals-${m.id}`);
    if (totalsEl) totalsEl.innerHTML = renderMealTotals(m.id, t, state.meals[m.id].goals);
  });

  // Remaining macros
  const remCal  = gc    - totCal;
  const remCarb = gcarb - totCarb;
  const remProt = gprot - totProt;
  const remFat  = gfat  - totFat;

  const setRem = (id, val, goal, barId, cls) => {
    const el  = document.getElementById(id);
    const bar = document.getElementById(barId);
    if (!el) return;
    if (goal === 0) {
      el.textContent = '—';
      el.className = `macro-val ${cls}`;
      bar.style.width = '0%';
      return;
    }
    if (val < 0) {
      el.textContent = `+${Math.abs(val)} over`;
      el.className = `macro-val ${cls} over-goal`;
      bar.style.width = '100%';
    } else {
      el.textContent = val;
      el.className = `macro-val ${cls}`;
      const pct = Math.min(100, Math.max(0, ((goal - val) / goal) * 100));
      bar.style.width = pct + '%';
    }
  };

  setRem('rem-cal',  remCal,  gc,    'bar-cal',  'cal');
  setRem('rem-carb', remCarb, gcarb, 'bar-carb', 'carb');
  setRem('rem-prot', remProt, gprot, 'bar-prot', 'prot');
  setRem('rem-fat',  remFat,  gfat,  'bar-fat',  'fat');

  // Persist current goals from inputs into state then save
  state.goals.cal  = gc;
  state.goals.carb = gcarb;
  state.goals.prot = gprot;
  state.goals.fat  = gfat;
  saveState();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setGlobalInputs() {
  document.getElementById('goal-cal').value  = state.goals.cal;
  document.getElementById('goal-carb').value = state.goals.carb;
  document.getElementById('goal-prot').value = state.goals.prot;
  document.getElementById('goal-fat').value  = state.goals.fat;
}

function toggleMeal(mealId) {
  document.getElementById(`card-${mealId}`).classList.toggle('open');
}

function addFood(mealId) {
  state.meals[mealId].foods.push({ name: '', per100: { cal: '', carb: '', prot: '', fat: '' }, grams: '' });
  renderFoodRows(mealId);
  updateAll();
}

function removeFood(mealId, idx) {
  if (state.meals[mealId].foods.length === 1) {
    state.meals[mealId].foods[0] = { name: '', per100: { cal: '', carb: '', prot: '', fat: '' }, grams: '' };
  } else {
    state.meals[mealId].foods.splice(idx, 1);
  }
  renderFoodRows(mealId);
  updateAll();
}

function updateFoodField(mealId, idx, field, value) {
  const food = state.meals[mealId].foods[idx];
  if (field === 'name') {
    food.name = value;
  } else if (field === 'grams') {
    food.grams = value;
  } else if (field.startsWith('per100.')) {
    food.per100[field.split('.')[1]] = value;
  }
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
    btn.textContent = 'Confirm Reset?';
    setTimeout(() => {
      btn.classList.remove('confirming');
      btn.textContent = '↺ Reset Day';
    }, 3000);
    return;
  }
  btn.classList.remove('confirming');
  btn.textContent = '↺ Reset Day';
  MEALS.forEach(m => {
    state.meals[m.id].foods = [{ name: '', per100: { cal: '', carb: '', prot: '', fat: '' }, grams: '' }];
  });
  renderMeals();
  updateAll();
}

// ─── Init ────────────────────────────────────────────────────────────────────

renderMeals();
updateAll();

window.addEventListener('pagehide', saveState);

// Re-render food rows if crossing the mobile breakpoint
let lastMobile = isMobile();
window.addEventListener('resize', () => {
  const nowMobile = isMobile();
  if (nowMobile !== lastMobile) {
    lastMobile = nowMobile;
    MEALS.forEach(m => renderFoodRows(m.id));
  }
});