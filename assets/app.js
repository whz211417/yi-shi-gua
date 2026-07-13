import { FOOD_ORACLES, STARTER_MEALS } from './data.js';

export const STORAGE_KEY = 'yi-shi-gua:v1';
const STORAGE_VERSION = 1;
const REQUIRED_MEAL_FIELDS = ['id', 'name', 'source', 'venue', 'meals', 'staple', 'protein', 'vegetable', 'flavor', 'enabled'];
const RECENT_HISTORY_WINDOW = 5;
const MEAL_PERIODS = new Set(['早餐', '午餐', '晚餐']);
const VALID_SOURCES = new Set(['食堂', '校外']);
export const MENU_OPTIONS = {
  sources: [...VALID_SOURCES],
  staples: [...new Set(STARTER_MEALS.map((meal) => meal.staple))],
  proteins: [...new Set(STARTER_MEALS.map((meal) => meal.protein))],
  vegetables: [...new Set(STARTER_MEALS.map((meal) => meal.vegetable))],
  flavors: [...new Set(STARTER_MEALS.map((meal) => meal.flavor))],
};
const VALID_STAPLES = new Set(MENU_OPTIONS.staples);
const VALID_PROTEINS = new Set(MENU_OPTIONS.proteins);
const VALID_VEGETABLES = new Set(MENU_OPTIONS.vegetables);
const VALID_FLAVORS = new Set(MENU_OPTIONS.flavors);

/** Return a local calendar key without using UTC conversion. */
export function todayKey(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Restore the editable starter bank when saved menu data is unusable. */
export function normaliseMenu(menu) {
  return isValidMenu(menu) ? cloneMeals(menu) : cloneMeals(STARTER_MEALS);
}

/** Validate and clone date-keyed, confirmed meal records. History is newest-first. */
export function normaliseRecordsByDate(recordsByDate) {
  if (!isRecord(recordsByDate)) return { recordsByDate: {}, history: [], valid: false };
  const normalised = {};
  for (const [date, records] of Object.entries(recordsByDate)) {
    if (!isDateKey(date) || !Array.isArray(records) || !records.every((record) => isUsableRecord(record, date))) {
      return { recordsByDate: {}, history: [], valid: false };
    }
    if (new Set(records.map((record) => record.mealPeriod)).size !== records.length) {
      return { recordsByDate: {}, history: [], valid: false };
    }
    if (records.length > 3) return { recordsByDate: {}, history: [], valid: false };
    if (records.length > 0) normalised[date] = records.map(cloneRecord);
  }
  const history = Object.values(normalised).flat().sort((a, b) => b.confirmedAt - a.confirmedAt || b.date.localeCompare(a.date));
  return { recordsByDate: normalised, history, valid: true };
}

/** Read versioned local state; malformed/unavailable storage is deliberately non-fatal. */
export function loadStoredState(storage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return defaultStoredState();
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== STORAGE_VERSION || !isValidMenu(parsed.menu)) return defaultStoredState();
    const records = normaliseRecordsByDate(parsed.recordsByDate);
    if (!records.valid) return defaultStoredState();
    return { menu: normaliseMenu(parsed.menu), recordsByDate: records.recordsByDate };
  } catch {
    return defaultStoredState();
  }
}

/** Persist only validated, serializable local state. Returns false when storage is unavailable. */
export function saveStoredState(storage, state) {
  try {
    if (!storage || typeof storage.setItem !== 'function' || !isRecord(state) || !isValidMenu(state.menu)) return false;
    const records = normaliseRecordsByDate(state.recordsByDate);
    if (!records.valid) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, menu: normaliseMenu(state.menu), recordsByDate: records.recordsByDate }));
    return true;
  } catch {
    return false;
  }
}

/** Resolve manual weather or an offline local-season approximation; it never fetches real weather. */
export function resolveWeather(weather = '不考虑', dateKey = todayKey()) {
  if (weather !== '自动以本地日期推演') return ['不考虑', '晴热', '下雨', '偏冷'].includes(weather) ? weather : '不考虑';
  const month = dateParts(dateKey)?.month;
  if ([6, 7, 8].includes(month)) return '晴热';
  if ([12, 1, 2].includes(month)) return '偏冷';
  return '不考虑';
}

/** Build a deterministic seed from the report number and the current local context. */
export function contextualSeed(reportNumber, context = {}) {
  const safeContext = isRecord(context) ? context : {};
  const dateKey = typeof safeContext.dateKey === 'string' ? safeContext.dateKey : '';
  const weather = resolveWeather(safeContext.weather, dateKey);
  return hashString([reportNumber, dateKey, safeContext.mealPeriod || '', weather, safeContext.place || ''].join('|'));
}

/** Score one meal against a serializable recommendation context. Higher is better. */
export function scoreMeal(meal, context = {}) {
  if (!isRecord(meal)) return Number.NEGATIVE_INFINITY;
  const safeContext = isRecord(context) ? context : {};
  const recent = normaliseRecent(safeContext.recent);
  const recentTwo = recent.slice(0, 2);
  const latestSeveral = recent.slice(0, 5);
  const calendarRecent = recentWithinCalendarDays(recent, safeContext.dateKey, 3);
  const weather = resolveWeather(safeContext.weather, safeContext.dateKey);
  let score = 100;
  for (const record of recentTwo) {
    if (sameMeal(record, meal)) score -= 110;
    if (record.staple === meal.staple) score -= 42;
    if (record.protein === meal.protein) score -= 42;
  }
  for (const record of calendarRecent) {
    if (record.venue && record.venue === meal.venue) score -= 7;
    if (record.flavor && record.flavor === meal.flavor) score -= 5;
  }
  const vegetablePoor = latestSeveral.some((record) => record.vegetable === '无' || record.vegetable === '少');
  if (vegetablePoor && meal.vegetable === '有') score += 28;
  if (vegetablePoor && meal.vegetable === '无') score -= 12;
  const proteinCounts = countBy(recent.slice(0, 3), 'protein');
  if ((proteinCounts[meal.protein] || 0) >= 2) score -= 22;
  if (Object.keys(proteinCounts).length > 0 && (proteinCounts[meal.protein] || 0) === 0) score += 16;
  const lastMealWasHeavy = recentTwo.some((record) => isHeavy(record.flavor));
  if (lastMealWasHeavy && (meal.flavor === '清淡' || meal.flavor === '汤类')) score += 18;
  if (lastMealWasHeavy && isHeavy(meal.flavor)) score -= 16;
  if (weather === '下雨' || weather === '偏冷') { if (meal.flavor === '汤类') score += 9; }
  if (weather === '晴热' && (meal.flavor === '清淡' || meal.flavor === '汤类')) score += 8;
  if (safeContext.mealPeriod === '早餐' && meal.protein !== '无明确蛋白') score += 4;
  return score;
}

/** Pick a suitable meal deterministically, with repeat relaxation only as a fallback. */
export function chooseMeal(context = {}) {
  const safeContext = isRecord(context) ? context : {};
  const meals = normaliseMenu(safeContext.meals);
  const recent = normaliseRecent(safeContext.recent);
  const rejectedIds = new Set(Array.isArray(safeContext.rejectedIds) ? safeContext.rejectedIds : []);
  const eligible = meals.filter((meal) => meal.enabled !== false && meal.meals.includes(safeContext.mealPeriod) && matchesPlace(meal, safeContext.place) && !rejectedIds.has(meal.id));
  if (eligible.length === 0) return { meal: null, score: null, reason: '当前条件下没有可用餐品，请切换地点、餐别或调整菜单库。', relaxed: false };
  const recentTwo = recent.slice(0, 2);
  const nonRepeating = eligible.filter((meal) => !recentTwo.some((record) => repeatsCore(record, meal)));
  const candidates = nonRepeating.length > 0 ? nonRepeating : eligible;
  const relaxed = nonRepeating.length === 0;
  const ranked = candidates.map((meal) => ({ meal, score: scoreMeal(meal, { ...safeContext, recent }), tie: seededTieBreak(safeContext.seed, meal.id) }))
    .sort((a, b) => b.score - a.score || b.tie - a.tie || a.meal.id.localeCompare(b.meal.id));
  const selected = ranked[0];
  return { meal: selected.meal, score: selected.score, reason: recommendationReason(selected.meal, { ...safeContext, recent }, relaxed), relaxed };
}

/** Return one of the fixed 64 entertainment-only food-oracle records. */
export function oracleFor(seed, dateKey = '', mealPeriod = '') {
  const numericSeed = Number.parseInt(seed, 10);
  const ordinal = Number.isFinite(numericSeed) ? numericSeed : hashString(`${dateKey}|${mealPeriod}`);
  const index = ((ordinal - 1) % FOOD_ORACLES.length + FOOD_ORACLES.length) % FOOD_ORACLES.length;
  return FOOD_ORACLES[index];
}

/** Return an entertainment-only oracle using the same contextual seed as the recommendation. */
export function oracleForContext(reportNumber, context = {}) { return oracleFor(contextualSeed(reportNumber, context)); }

/** Produce a compact non-medical observation from today's confirmed records. */
export function dailyBalanceTip(records = []) {
  const confirmed = Array.isArray(records) ? records.filter(isRecord) : [];
  if (confirmed.length === 0) return '今日均衡提示：尚无已确认餐食，按实际饥饿和时间从一餐开始即可。';
  if (!confirmed.some((record) => record.vegetable === '有')) return '今日均衡提示：还没记到蔬菜，下餐可考虑加一份日常蔬菜。';
  const proteins = countBy(confirmed.filter((record) => record.protein && record.protein !== '无明确蛋白'), 'protein');
  const repeated = Object.entries(proteins).find(([, count]) => count >= 2);
  if (repeated) return `今日均衡提示：${repeated[0]}已出现两次，下餐可换一种常见蛋白来源，留一点变化。`;
  return '今日均衡提示：已记餐食有蔬菜和变化，按你的食量继续安排就好。';
}

function defaultStoredState() { return { menu: cloneMeals(STARTER_MEALS), recordsByDate: {} }; }
function isValidMenu(menu) { return Array.isArray(menu) && menu.length > 0 && menu.every(isUsableMeal) && hasUniqueIds(menu); }
function isUsableMeal(meal) {
  return isRecord(meal) && REQUIRED_MEAL_FIELDS.every((field) => Object.hasOwn(meal, field)) && hasText(meal.id) && hasText(meal.name)
    && VALID_SOURCES.has(meal.source) && hasText(meal.venue) && Array.isArray(meal.meals) && meal.meals.length > 0 && meal.meals.every((period) => MEAL_PERIODS.has(period))
    && VALID_STAPLES.has(meal.staple) && VALID_PROTEINS.has(meal.protein) && VALID_VEGETABLES.has(meal.vegetable) && VALID_FLAVORS.has(meal.flavor) && typeof meal.enabled === 'boolean';
}
function isUsableRecord(record, date) { return isUsableMeal(record) && MEAL_PERIODS.has(record.mealPeriod) && record.date === date && Number.isFinite(record.confirmedAt); }
function isDateKey(value) { return Boolean(dateParts(value)); }
function dateParts(value) {
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(year, month, 0).getDate()) return null;
  return { year, month, day };
}
function hasUniqueIds(meals) { return new Set(meals.map((meal) => meal.id)).size === meals.length; }
function cloneMeals(meals) { return meals.map((meal) => ({ ...meal, meals: [...meal.meals] })); }
function cloneRecord(record) { return { ...record, meals: [...record.meals] }; }
function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function hasText(value) { return typeof value === 'string' && value.trim().length > 0; }
function normaliseRecent(recent) { return Array.isArray(recent) ? recent.filter(isRecord) : []; }
function recentWithinCalendarDays(records, dateKey, calendarDays) {
  const parts = dateParts(dateKey);
  if (!parts) return [];
  const start = new Date(parts.year, parts.month - 1, parts.day);
  start.setDate(start.getDate() - (calendarDays - 1));
  const firstDay = todayKey(start);
  return records.filter((record) => isDateKey(record.date) && record.date >= firstDay && record.date <= dateKey);
}
function matchesPlace(meal, place) { if (!place || place === '不限') return true; if (place === '在学校' || place === '不想走远') return meal.source === '食堂'; return place !== '校外' || meal.source === '校外'; }
function repeatsCore(record, meal) { return isRecord(record) && (sameMeal(record, meal) || record.staple === meal.staple || record.protein === meal.protein); }
function sameMeal(record, meal) { return isRecord(record) && isRecord(meal) && (record.mealId === meal.id || record.id === meal.id || record.name === meal.name); }
function isHeavy(flavor) { return flavor === '油炸' || flavor === '重口'; }
function countBy(records, key) { return records.reduce((counts, record) => { if (isRecord(record) && record[key]) counts[record[key]] = (counts[record[key]] || 0) + 1; return counts; }, {}); }
function seededTieBreak(seed, mealId) { return (hashString(`${seed ?? 0}|${mealId}`) % 10_000) / 10_000_000; }
function hashString(value) { let hash = 2166136261; for (const char of String(value)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return hash >>> 0; }
function recommendationReason(meal, context, relaxed) {
  const recent = normaliseRecent(isRecord(context) ? context.recent : []); const notes = [];
  if (recent.some((record) => record.vegetable === '无' || record.vegetable === '少') && meal.vegetable === '有') notes.push('补一份蔬菜');
  if (recent.slice(0, 2).some((record) => isHeavy(record.flavor)) && (meal.flavor === '清淡' || meal.flavor === '汤类')) notes.push('换成较清爽的口味');
  if (recent.slice(0, 2).some((record) => record.protein === meal.protein)) notes.push('尽量避开近期同类蛋白');
  if (notes.length === 0) notes.push('餐别与地点匹配，并保留日常变化'); if (relaxed) notes.push('可选项均与近餐相近，已放宽避重条件');
  return `${meal.name}：${notes.join('；')}。`;
}

if (typeof document !== 'undefined') initialiseCastingInterface();

function initialiseCastingInterface() {
  const $ = (selector) => document.querySelector(selector);
  const numberInput = $('#number-input'); const randomButton = $('#random-number-button'); const castButton = $('#cast-button');
  const retryButton = $('#retry-button'); const confirmButton = $('#confirm-button'); const resultCard = $('#result-card');
  const resultEmpty = $('#result-empty'); const resultContent = $('#result-content'); const liveRegion = $('#live-region'); const dateStamp = $('#today-date'); const balanceTip = $('#daily-balance-tip');
  const menuOpenButton = $('#menu-open-button'); const menuCloseButton = $('#menu-close-button'); const menuPanel = $('#menu-panel'); const menuList = $('#menu-list');
  const addMealButton = $('#add-meal-button'); const resetMenuButton = $('#reset-menu-button');
  if (![numberInput, randomButton, castButton, retryButton, confirmButton, resultCard, resultEmpty, resultContent, liveRegion, dateStamp, balanceTip, menuOpenButton, menuCloseButton, menuPanel, menuList, addMealButton, resetMenuButton].every(Boolean)) return;
  const today = new Date(); const date = todayKey(today); const saved = loadStoredState(safeStorage());
  const state = { menu: saved.menu, recordsByDate: saved.recordsByDate, rejectedIds: [], selected: null };
  dateStamp.textContent = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }).format(today);
  renderFoodLog(); renderMenu();
  const normaliseNumber = () => { const parsed = Number.parseInt(numberInput.value, 10); const value = Number.isFinite(parsed) ? Math.min(64, Math.max(1, parsed)) : 1; numberInput.value = String(value); return value; };
  numberInput.addEventListener('change', normaliseNumber); numberInput.addEventListener('blur', normaliseNumber);
  randomButton.addEventListener('click', () => { numberInput.value = String(Math.floor(Math.random() * 64) + 1); numberInput.focus(); });
  castButton.addEventListener('click', () => cast(false)); retryButton.addEventListener('click', () => cast(true)); confirmButton.addEventListener('click', confirmMeal);
  let menuInvoker = null;
  const menuFocusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href]';
  menuOpenButton.addEventListener('click', () => { menuInvoker = document.activeElement; menuPanel.hidden = false; menuOpenButton.setAttribute('aria-expanded', 'true'); menuCloseButton.focus(); });
  menuCloseButton.addEventListener('click', closeMenu);
  menuPanel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { closeMenu(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...menuPanel.querySelectorAll(menuFocusableSelector)].filter((element) => !element.hidden);
    if (focusable.length === 0) { event.preventDefault(); return; }
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  addMealButton.addEventListener('click', () => { state.menu.push(newMeal()); persist(); renderMenu(); const first = menuList.querySelector('input'); if (first) first.focus(); });
  resetMenuButton.addEventListener('click', () => { if (window.confirm('确定要恢复起始菜单吗？这会覆盖当前本地菜单。')) { state.menu = normaliseMenu(null); persist(); renderMenu(); announce('菜单已恢复为起始项。'); } });

  function safeStorage() { try { return window.localStorage; } catch { return null; } }
  function persist() { if (!saveStoredState(safeStorage(), state)) announce('本地保存不可用，本次修改仍会保留到页面关闭前。'); }
  function closeMenu() { menuPanel.hidden = true; menuOpenButton.setAttribute('aria-expanded', 'false'); (menuInvoker || menuOpenButton).focus(); menuInvoker = null; }
  function selectedValue(groupId, fallback) { return document.querySelector(`#${groupId} input:checked`)?.value || fallback; }
  function cast(isRetry) {
    if (isRetry && state.selected) state.rejectedIds.push(state.selected.id);
    const reportNumber = normaliseNumber(); const mealPeriod = selectedValue('meal-period', '午餐'); const place = selectedValue('place', '在学校'); const weather = selectedValue('weather', '自动以本地日期推演');
    const context = { dateKey: date, mealPeriod, place, weather };
    const seed = contextualSeed(reportNumber, context);
    const history = normaliseRecordsByDate(state.recordsByDate).history;
    const recommendation = chooseMeal({ meals: state.menu, ...context, rejectedIds: state.rejectedIds, seed, recent: history });
    if (!recommendation.meal) { state.rejectedIds = []; announce(recommendation.reason); return; }
    state.selected = { ...recommendation.meal, meals: [...recommendation.meal.meals], mealPeriod, reason: recommendation.reason };
    resultCard.classList.add('is-casting');
    castButton.disabled = true;
    retryButton.disabled = true;
    window.setTimeout(() => {
      showResult(oracleForContext(reportNumber, context), state.selected, reportNumber);
      resultCard.classList.remove('is-casting');
      castButton.disabled = false;
      retryButton.disabled = false;
    }, 680);
  }
  function showResult(oracle, meal, ordinal) {
    $('#result-ordinal').textContent = `第 ${ordinal} 数`; $('#oracle-title').textContent = oracle.title; $('#result-title').textContent = meal.name;
    $('#meal-meta').textContent = `${meal.source} / ${meal.venue}`; $('#oracle-line').textContent = oracle.line; $('#meal-reason').textContent = meal.reason;
    resultCard.classList.remove('is-empty', 'is-revealing'); resultEmpty.hidden = true; resultContent.hidden = false; void resultCard.offsetWidth; resultCard.classList.add('is-revealing');
    announce(`餐卦已显现：${meal.name}，${meal.source}${meal.venue}。`);
  }
  function confirmMeal() {
    if (!state.selected) return;
    const record = { ...state.selected, meals: [...state.selected.meals], date, confirmedAt: Date.now() }; delete record.reason;
    const todayRecords = (state.recordsByDate[date] || []).filter((item) => item.mealPeriod !== record.mealPeriod);
    state.recordsByDate = { ...state.recordsByDate, [date]: [...todayRecords, record] }; persist(); renderFoodLog();
    announce(`${record.mealPeriod}已记入今日食录：${record.name}。`);
  }
  function undoMeal(period) {
    const retained = (state.recordsByDate[date] || []).filter((record) => record.mealPeriod !== period);
    state.recordsByDate = { ...state.recordsByDate, ...(retained.length ? { [date]: retained } : {}) }; if (!retained.length) delete state.recordsByDate[date];
    persist(); renderFoodLog(); announce(`${period}的今日食录已撤销。`);
  }
  function renderFoodLog() {
    const records = new Map((state.recordsByDate[date] || []).map((record) => [record.mealPeriod, record]));
    document.querySelectorAll('.log-slots li').forEach((slot) => {
      const period = slot.dataset.slot; const record = records.get(period); const label = slot.querySelector('strong'); let undo = slot.querySelector('.undo-button');
      if (record) { label.textContent = record.name; slot.classList.add('is-filled'); if (!undo) { undo = document.createElement('button'); undo.type = 'button'; undo.className = 'undo-button'; undo.textContent = '撤销'; undo.addEventListener('click', () => undoMeal(period)); slot.append(undo); } }
      else { label.textContent = '尚未落笔'; slot.classList.remove('is-filled'); undo?.remove(); }
    });
    balanceTip.textContent = dailyBalanceTip([...records.values()]);
  }
  function renderMenu() {
    menuList.replaceChildren();
    state.menu.forEach((meal) => menuList.append(menuRow(meal)));
    $('#menu-count').textContent = `${state.menu.filter((meal) => meal.enabled).length} 项启用 / ${state.menu.length} 项菜单`;
  }
  function menuRow(meal) {
    const form = document.createElement('form'); form.className = 'menu-row'; form.noValidate = true; form.addEventListener('submit', (event) => event.preventDefault());
    const heading = document.createElement('div'); heading.className = 'menu-row-heading'; const title = document.createElement('h3'); title.textContent = meal.name; const status = document.createElement('span'); status.textContent = meal.enabled ? '启用中' : '已停用'; heading.append(title, status); form.append(heading);
    form.append(textControl(meal.id, '名称', 'name', meal.name), textControl(meal.id, '来源/档口', 'venue', meal.venue), selectControl(meal.id, '去处', 'source', MENU_OPTIONS.sources, meal.source), selectControl(meal.id, '主食', 'staple', MENU_OPTIONS.staples, meal.staple), selectControl(meal.id, '蛋白', 'protein', MENU_OPTIONS.proteins, meal.protein), selectControl(meal.id, '蔬菜', 'vegetable', MENU_OPTIONS.vegetables, meal.vegetable), selectControl(meal.id, '口味', 'flavor', MENU_OPTIONS.flavors, meal.flavor), periodControl(meal));
    const actions = document.createElement('div'); actions.className = 'menu-row-actions';
    const enabled = document.createElement('button'); enabled.type = 'button'; enabled.className = 'menu-small-button'; enabled.textContent = meal.enabled ? '停用此餐' : '启用此餐'; enabled.addEventListener('click', () => updateMeal(meal.id, { enabled: !meal.enabled }));
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'menu-delete-button'; remove.textContent = '删除'; remove.addEventListener('click', () => { if (state.menu.length === 1) { announce('菜单至少保留一项，请先新增餐品。'); return; } state.menu = state.menu.filter((item) => item.id !== meal.id); persist(); renderMenu(); });
    actions.append(enabled, remove); form.append(actions); return form;
  }
  function textControl(mealId, labelText, field, value) { const label = document.createElement('label'); label.className = 'menu-control'; const text = document.createElement('span'); text.textContent = labelText; const input = document.createElement('input'); input.type = 'text'; input.value = value; input.addEventListener('change', () => updateMeal(mealId, { [field]: input.value.trim() })); label.append(text, input); return label; }
  function selectControl(mealId, labelText, field, values, value) { const label = document.createElement('label'); label.className = 'menu-control'; const text = document.createElement('span'); text.textContent = labelText; const select = document.createElement('select'); values.forEach((optionValue) => { const option = document.createElement('option'); option.value = optionValue; option.textContent = optionValue; option.selected = optionValue === value; select.append(option); }); select.addEventListener('change', () => updateMeal(mealId, { [field]: select.value })); label.append(text, select); return label; }
  function periodControl(meal) { const fieldset = document.createElement('fieldset'); fieldset.className = 'menu-periods'; const legend = document.createElement('legend'); legend.textContent = '餐别'; fieldset.append(legend); [...MEAL_PERIODS].forEach((period) => { const label = document.createElement('label'); const input = document.createElement('input'); input.type = 'checkbox'; input.checked = meal.meals.includes(period); input.addEventListener('change', () => { const meals = [...fieldset.querySelectorAll('input:checked')].map((item) => item.value); updateMeal(meal.id, { meals }); }); input.value = period; const text = document.createElement('span'); text.textContent = period; label.append(input, text); fieldset.append(label); }); return fieldset; }
  function updateMeal(id, changes) { const index = state.menu.findIndex((meal) => meal.id === id); if (index < 0) return; const candidate = { ...state.menu[index], ...changes }; if (!isValidMenu(state.menu.map((meal, itemIndex) => itemIndex === index ? candidate : meal))) { announce('请保留有效名称、档口和至少一个餐别。'); renderMenu(); return; } state.menu[index] = candidate; persist(); renderMenu(); }
  function newMeal() { const base = state.menu[0] || STARTER_MEALS[0]; return { ...base, meals: ['午餐'], id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: '新餐品', venue: '自定义档口', enabled: true }; }
  function announce(message) { liveRegion.textContent = ''; window.setTimeout(() => { liveRegion.textContent = message; }, 20); }
}
