import { STARTER_MEALS } from './data.js';
import { FOOD_ORACLES } from './data.js';
import { availableCuisineOptions, cuisinePath, filterMealsByCuisine, normaliseCuisineFields } from './cuisine-catalog.js';
import { beijingCalendarParts, deriveDivination } from './divination.js';
import { recommendCanteenPlan, recommendOutingCuisine } from './student-meal-model.js';

export const STORAGE_KEY = 'yi-shi-gua:v1';
const STORAGE_VERSION = 1;
export const CATALOG_VERSION = 1;
export const MEAL_RELATIONS = Object.freeze(['frequent', 'tried', 'wish']);
const REQUIRED_MEAL_FIELDS = ['id', 'name', 'source', 'venue', 'meals', 'staple', 'protein', 'vegetable', 'flavor', 'enabled'];
const RECENT_HISTORY_WINDOW = 5;
const MEAL_PERIODS = new Set(['早餐', '午餐', '晚餐']);
const CAST_CLEANUP_DELAY = 1550;
const CASTING_TIMELINE = Object.freeze([
  Object.freeze({ phase: 'count', delay: 0 }),
  Object.freeze({ phase: 'ink', delay: 160 }),
  Object.freeze({ phase: 'seal', delay: 720 }),
  Object.freeze({ phase: 'lines', delay: 1000 }),
  Object.freeze({ phase: 'reveal', delay: 1540 }),
]);

/** Return a defensive, finite phase schedule; reduced motion exposes the result synchronously. */
export function castingTimeline({ reducedMotion = false } = {}) {
  return reducedMotion ? [{ phase: 'reveal', delay: 0 }] : CASTING_TIMELINE.map(({ phase, delay }) => ({ phase, delay }));
}
const VALID_SOURCES = new Set(['食堂', '校外', '待确认']);
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
const VALID_MEAL_RELATIONS = new Set(MEAL_RELATIONS);

/** Create independent, display-only menu filter state. */
export function initialMenuFilters() {
  return { zone: '', cuisine: '', family: '', enabledOnly: false, query: '' };
}

/** Map a compact catalog scope tab to its independent filter state. */
export function filtersForMenuScope(scope) {
  const filters = initialMenuFilters();
  if (scope === '中国菜' || scope === '世界料理') return { ...filters, zone: scope };
  if (scope === '我的启用') return { ...filters, enabledOnly: true };
  return filters;
}

/** Reduce one menu-filter interaction without altering the caller's state. */
export function reduceMenuFilters(filters, action) {
  const current = normaliseMenuFilters(filters);
  const nextAction = isRecord(action) ? action : {};
  switch (nextAction.type) {
    case 'zone': return { ...current, zone: normaliseFilterText(nextAction.value), cuisine: '', family: '' };
    case 'cuisine': return { ...current, cuisine: normaliseFilterText(nextAction.value), family: '' };
    case 'family': return { ...current, family: normaliseFilterText(nextAction.value) };
    case 'enabledOnly': return { ...current, enabledOnly: nextAction.value === true };
    case 'query': return { ...current, query: normaliseFilterText(nextAction.value) };
    case 'clear': return initialMenuFilters();
    default: return current;
  }
}

function normaliseMenuFilters(filters) {
  const source = isRecord(filters) ? filters : {};
  return {
    zone: normaliseFilterText(source.zone),
    cuisine: normaliseFilterText(source.cuisine),
    family: normaliseFilterText(source.family),
    enabledOnly: source.enabledOnly === true,
    query: normaliseFilterText(source.query),
  };
}

function normaliseFilterText(value) { return typeof value === 'string' ? value.normalize('NFC').trim() : ''; }

/** Return a local calendar key without using UTC conversion. */
export function todayKey(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Restore the editable starter bank when saved menu data is unusable. */
export function normaliseMenu(menu) {
  return (isValidMenu(menu) ? menu : STARTER_MEALS).map(normaliseCuisineFields);
}

/** Create a valid, unlocated local menu entry with the fallback cuisine path. */
export function newMeal() {
  return normaliseCuisineFields({
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: '新餐品',
    source: '待确认',
    venue: '待确认模板',
    meals: ['午餐'],
    staple: '米饭',
    protein: '无明确蛋白',
    vegetable: '有',
    flavor: '普通',
    enabled: true,
  });
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

/** Clone valid local meal relation flags; omitted or malformed flags leave a meal unmarked. */
export function normaliseMealRelations(mealRelations) {
  if (!isRecord(mealRelations)) return {};
  const normalised = {};
  for (const [rawMealId, rawRelation] of Object.entries(mealRelations)) {
    const mealId = normaliseFilterText(rawMealId);
    const relation = normaliseFilterText(rawRelation);
    if (!mealId || !VALID_MEAL_RELATIONS.has(relation)) continue;
    Object.defineProperty(normalised, mealId, { value: relation, enumerable: true, configurable: true, writable: true });
  }
  return normalised;
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
    const mealRelations = normaliseMealRelations(parsed.mealRelations);
    const state = {
      menu: needsCatalogMigration(parsed) ? mergeCatalogTemplates(parsed.menu) : normaliseMenu(parsed.menu),
      recordsByDate: records.recordsByDate,
      mealRelations,
    };
    if (needsCatalogMigration(parsed) || !Object.hasOwn(parsed, 'mealRelations')) persistCatalogMigration(storage, state);
    return state;
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
    storage.setItem(STORAGE_KEY, JSON.stringify(storedStatePayload(normaliseMenu(state.menu), records.recordsByDate, normaliseMealRelations(state.mealRelations))));
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

/** Combine the computed plum-blossom result with the normalised meal context. */
export function divinationSeed(divination, context = {}) {
  const safeDivination = isRecord(divination) ? divination : {};
  const primaryNumber = Number(safeDivination.primary?.number);
  const changedNumber = Number(safeDivination.changed?.number);
  const movingLine = Number(safeDivination.movingLine);
  return hashString([primaryNumber, changedNumber, movingLine, contextualSeed(primaryNumber, context)].join('|'));
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
  const eligible = meals.filter((meal) => meal.enabled !== false && meal.isSupplement !== true && meal.meals.includes(safeContext.mealPeriod) && matchesPlace(meal, safeContext.place) && !rejectedIds.has(meal.id));
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

/** Adapt practical canteen or outing recommendations into a record the existing food log can confirm. */
export function recommendMealForCasting({ divination, menu, context = {} } = {}) {
  const safeContext = isRecord(context) ? context : {};
  const primary = primaryTrigramNames(divination, safeContext.primary);
  const request = {
    ...safeContext,
    primary,
    upper: primary.upper,
    lower: primary.lower,
    recentRecords: normaliseRecent(safeContext.recentRecords ?? safeContext.recent),
  };

  if (safeContext.place === '校外') {
    const recommendation = recommendOutingCuisine(Array.isArray(menu) ? menu : [], request);
    if (!recommendation.cuisine) return { meal: null, reason: recommendation.reason, recommendation };
    const meal = castingMealRecord({
      id: `outing:${recommendation.cuisineZone}:${recommendation.cuisine}`,
      title: recommendation.cuisineLabel,
      source: '校外',
      venue: recommendation.cuisinePath,
      meals: [castingMealPeriod(safeContext.mealPeriod)],
      mealPeriod: castingMealPeriod(safeContext.mealPeriod),
      reason: recommendationReasonText(recommendation),
      recommendation,
      recommendationType: 'outing-cuisine',
      historyDetails: {
        cuisineZone: recommendation.cuisineZone,
        cuisine: recommendation.cuisine,
        dishType: recommendation.dishSuggestions[0],
      },
    });
    return { meal, reason: meal.reason, recommendation };
  }

  const recommendation = recommendCanteenPlan(request);
  if (!recommendation?.plan) {
    const reason = '当前没有可推荐的食堂餐型，请调整餐别后再试。';
    return { meal: null, reason, recommendation: null };
  }
  const plan = recommendation.plan;
  const meal = castingMealRecord({
    id: plan.id,
    title: plan.name,
    source: '食堂',
    venue: plan.venue,
    meals: plan.meals,
    mealPeriod: castingMealPeriod(safeContext.mealPeriod),
    reason: recommendationReasonText(recommendation),
    recommendation,
    recommendationType: 'universal-canteen-plan',
    historyDetails: { mealId: plan.id },
  });
  return { meal, reason: meal.reason, recommendation };
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

function defaultStoredState() { return { menu: normaliseMenu(null), recordsByDate: {}, mealRelations: {} }; }
function needsCatalogMigration(state) { return !Number.isInteger(state.catalogVersion) || state.catalogVersion < CATALOG_VERSION; }
function mergeCatalogTemplates(menu) {
  const existingIds = new Set(menu.map((meal) => meal.id));
  return normaliseMenu([...menu, ...STARTER_MEALS.filter((meal) => !existingIds.has(meal.id))]);
}
function storedStatePayload(menu, recordsByDate, mealRelations = {}) { return { version: STORAGE_VERSION, catalogVersion: CATALOG_VERSION, menu, recordsByDate, mealRelations }; }
function persistCatalogMigration(storage, state) {
  try {
    if (storage && typeof storage.setItem === 'function') storage.setItem(STORAGE_KEY, JSON.stringify(storedStatePayload(state.menu, state.recordsByDate, state.mealRelations)));
  } catch { /* Migration remains available for this session when local storage cannot be written. */ }
}
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
function matchesPlace(meal, place) { if (!place || place === '不限' || meal.source === '待确认') return true; if (place === '在学校' || place === '不想走远') return meal.source === '食堂'; return place !== '校外' || meal.source === '校外'; }
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
function primaryTrigramNames(divination, fallback) {
  const source = isRecord(divination) ? divination : {};
  const fallbackPrimary = isRecord(fallback) ? fallback : {};
  return {
    upper: typeof source.upper?.name === 'string' ? source.upper.name : fallbackPrimary.upper,
    lower: typeof source.lower?.name === 'string' ? source.lower.name : fallbackPrimary.lower,
  };
}
function castingMealPeriod(value) { return MEAL_PERIODS.has(value) ? value : '午餐'; }
function recommendationReasonText(recommendation) {
  if (hasText(recommendation?.reason)) return recommendation.reason;
  const reasons = Array.isArray(recommendation?.reasons) ? recommendation.reasons : [];
  const text = reasons.map((item) => item?.text).filter(hasText).join('；');
  return text || '按当前餐别、地点与菜单范围提供一项日常建议。';
}
function castingMealRecord({ id, title, source, venue, meals, mealPeriod, reason, recommendation, recommendationType, historyDetails = {} }) {
  const name = hasText(title) ? title : '餐食推荐';
  const validMeals = [...new Set((Array.isArray(meals) ? meals : []).filter((period) => MEAL_PERIODS.has(period)))];
  return {
    id,
    name,
    title: name,
    source,
    venue: hasText(venue) ? venue : '待确认地点',
    meals: validMeals.length ? validMeals : ['午餐'],
    mealPeriod: castingMealPeriod(mealPeriod),
    staple: '米饭',
    protein: '无明确蛋白',
    vegetable: '有',
    flavor: '普通',
    enabled: true,
    ...historyDetails,
    metadata: { recommendationType, recommendationId: id },
    reason,
    recommendation,
  };
}

if (typeof document !== 'undefined') initialiseCastingInterface();

function initialiseCastingInterface() {
  const $ = (selector) => document.querySelector(selector);
  const numberInput = $('#number-input'); const randomButton = $('#random-number-button'); const castButton = $('#cast-button');
  const retryButton = $('#retry-button'); const confirmButton = $('#confirm-button'); const resultCard = $('#result-card');
  const resultEmpty = $('#result-empty'); const resultContent = $('#result-content'); const liveRegion = $('#live-region'); const dateStamp = $('#today-date'); const calendarStatus = $('#calendar-status'); const balanceTip = $('#daily-balance-tip');
  const menuOpenButton = $('#menu-open-button'); const menuCloseButton = $('#menu-close-button'); const menuPanel = $('#menu-panel'); const menuList = $('#menu-list');
  const menuScopeTabs = [...document.querySelectorAll('#menu-scope-tabs [data-menu-scope]')]; const cuisineDirectory = $('#cuisine-directory'); const cuisineDirectorySummary = $('#cuisine-directory-summary'); const mealDetailsTrigger = $('#meal-details-trigger'); const mealEditorPanel = $('#meal-editor-panel');
  const addMealButton = $('#add-meal-button'); const resetMenuButton = $('#reset-menu-button');
  const menuFilterZone = $('#menu-filter-zone'); const menuFilterCuisine = $('#menu-filter-cuisine'); const menuFilterFamily = $('#menu-filter-family');
  const menuFilterEnabled = $('#menu-filter-enabled'); const menuFilterQuery = $('#menu-filter-query'); const menuFilterClear = $('#menu-filter-clear'); const menuFilterSummary = $('#menu-filter-summary');
  const menuZoneInputs = menuFilterZone ? [...menuFilterZone.querySelectorAll('input[name="menu-zone"]')] : [];
  if (![numberInput, randomButton, castButton, retryButton, confirmButton, resultCard, resultEmpty, resultContent, liveRegion, dateStamp, calendarStatus, balanceTip, menuOpenButton, menuCloseButton, menuPanel, menuList, mealDetailsTrigger, mealEditorPanel, addMealButton, resetMenuButton].every(Boolean)) return;
  const today = new Date(); const date = todayKey(today); const saved = loadStoredState(safeStorage());
  const state = { menu: saved.menu, recordsByDate: saved.recordsByDate, mealRelations: saved.mealRelations, rejectedIds: [], selected: null };
  // The catalog opens in the Chinese-cuisine scope; world entries are never mixed into this first directory view.
  let menuFilters = { ...initialMenuFilters(), zone: '中国菜' };
  let selectedMenuMealId = null;
  dateStamp.textContent = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }).format(today);
  try {
    const calendar = beijingCalendarParts(today);
    calendarStatus.textContent = `按北京时间 · 农历${calendar.lunarLabel} · ${calendar.hourName}时`;
  } catch {
    calendarStatus.textContent = '当前浏览器不支持农历起卦，请使用新版 Chrome、Edge 或 Safari';
  }
  renderFoodLog(); renderMenu();
  const normaliseNumber = () => { const parsed = Number.parseInt(numberInput.value, 10); const value = Number.isFinite(parsed) ? Math.min(64, Math.max(1, parsed)) : 1; numberInput.value = String(value); return value; };
  numberInput.addEventListener('change', normaliseNumber); numberInput.addEventListener('blur', normaliseNumber);
  randomButton.addEventListener('click', () => { numberInput.value = String(Math.floor(Math.random() * 64) + 1); numberInput.focus(); });
  castButton.addEventListener('click', () => cast(false)); retryButton.addEventListener('click', () => cast(true)); confirmButton.addEventListener('click', confirmMeal);
  let menuInvoker = null;
  let casting = false;
  let castRevealed = false;
  let castTimers = [];
  const castElements = [resultCard, numberInput, castButton].filter(Boolean);
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
  addMealButton.addEventListener('click', () => { state.menu.push(newMeal()); persist(); renderMenu(); menuList.querySelector('.menu-row')?.focus(); });
  resetMenuButton.addEventListener('click', () => { if (window.confirm('确定要恢复起始菜单吗？这会覆盖当前本地菜单。')) { state.menu = normaliseMenu(null); clearMenuMealSelection(); persist(); renderMenu(); announce('菜单已恢复为起始项。'); } });
  mealDetailsTrigger.addEventListener('click', openMealEditor);
  menuScopeTabs.forEach((tab) => tab.addEventListener('click', () => { menuFilters = filtersForMenuScope(tab.dataset.menuScope); renderMenu(); }));
  menuZoneInputs.forEach((input) => input.addEventListener('change', () => { if (input.checked) updateMenuFilters({ type: 'zone', value: input.value }); }));
  menuFilterCuisine?.addEventListener('change', () => updateMenuFilters({ type: 'cuisine', value: menuFilterCuisine.value }));
  menuFilterFamily?.addEventListener('change', () => updateMenuFilters({ type: 'family', value: menuFilterFamily.value }));
  menuFilterEnabled?.addEventListener('change', () => updateMenuFilters({ type: 'enabledOnly', value: menuFilterEnabled.checked }));
  menuFilterQuery?.addEventListener('input', () => updateMenuFilters({ type: 'query', value: menuFilterQuery.value }));
  menuFilterClear?.addEventListener('click', () => updateMenuFilters({ type: 'clear' }));

  function updateMenuFilters(action) { menuFilters = reduceMenuFilters(menuFilters, action); renderMenu(); }

  function safeStorage() { try { return window.localStorage; } catch { return null; } }
  function persist() { if (!saveStoredState(safeStorage(), state)) announce('本地保存不可用，本次修改仍会保留到页面关闭前。'); }
  function closeMenu() { menuPanel.hidden = true; menuOpenButton.setAttribute('aria-expanded', 'false'); (menuInvoker || menuOpenButton).focus(); menuInvoker = null; }
  function selectedValue(groupId, fallback) { return document.querySelector(`#${groupId} input:checked`)?.value || fallback; }
  function cast(isRetry) {
    if (casting) return;
    const now = new Date();
    const reportNumber = normaliseNumber(); const mealPeriod = selectedValue('meal-period', '午餐'); const place = selectedValue('place', '在学校'); const weather = selectedValue('weather', '自动以本地日期推演');
    let divination;
    try {
      divination = deriveDivination(reportNumber, beijingCalendarParts(now));
    } catch {
      const message = '当前浏览器不支持农历起卦，请使用新版 Chrome、Edge 或 Safari';
      calendarStatus.textContent = message;
      announce(message);
      return;
    }
    if (isRetry && state.selected) state.rejectedIds.push(state.selected.id);
    const primaryTrigrams = { upper: divination.upper.name, lower: divination.lower.name };
    const context = { dateKey: date, mealPeriod, place, weather };
    const seed = divinationSeed(divination, context);
    const history = normaliseRecordsByDate(state.recordsByDate).history;
    const castingRecommendation = recommendMealForCasting({
      divination,
      menu: state.menu,
      context: { ...context, seed, primary: primaryTrigrams, recentRecords: history },
    });
    if (!castingRecommendation.meal) { state.rejectedIds = []; announce(castingRecommendation.reason); return; }
    state.selected = { ...castingRecommendation.meal, meals: [...castingRecommendation.meal.meals], reason: castingRecommendation.reason };
    if (prefersReducedMotion()) { showResult(divination, state.selected, reportNumber); return; }
    startCasting();
    for (const { phase, delay } of castingTimeline()) {
      if (phase === 'count') continue;
      scheduleCastPhase(phase, delay, () => {
        if (phase === 'ink') showCastingHexagram(divination);
        if (phase === 'reveal') {
          castRevealed = true;
          showResult(divination, state.selected, reportNumber);
        }
      });
    }
    castTimers.push(window.setTimeout(finishCasting, CAST_CLEANUP_DELAY));
  }
  function prefersReducedMotion() {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function startCasting() {
    casting = true;
    castRevealed = false;
    castButton.disabled = true;
    retryButton.disabled = true;
    confirmButton.disabled = true;
    castElements.forEach((element) => element.classList.add('is-casting'));
    setCastPhase('count');
  }
  function scheduleCastPhase(phase, delay, callback) {
    castTimers.push(window.setTimeout(() => {
      if (!casting) return;
      setCastPhase(phase);
      callback?.();
    }, delay));
  }
  function setCastPhase(phase) {
    castElements.forEach((element) => { element.dataset.castPhase = phase; });
  }
  function finishCasting({ discardSelection = false } = {}) {
    castTimers.forEach((timer) => window.clearTimeout(timer));
    castTimers = [];
    if (discardSelection) state.selected = null;
    casting = false;
    castRevealed = false;
    castButton.disabled = false;
    retryButton.disabled = false;
    confirmButton.disabled = !state.selected;
    castElements.forEach((element) => { element.classList.remove('is-casting'); delete element.dataset.castPhase; });
  }
  window.addEventListener('pagehide', () => finishCasting({ discardSelection: casting && !castRevealed }));
  function showCastingHexagram(divination) {
    const { calendar, upper, lower, primary } = divination;
    const setText = (id, value) => { const element = $(`#${id}`); if (element) element.textContent = value; };
    ['mutual-meta', 'moving-line-meta', 'changed-meta', 'image-reading', 'food-cue', 'transition-cue', 'formula-reading', 'oracle-title', 'result-title', 'meal-meta', 'oracle-line', 'meal-reason'].forEach((id) => setText(id, ''));
    renderPracticalRecommendation(null);
    const changedLines = $('#changed-lines');
    if (changedLines) changedLines.replaceChildren();
    setText('result-ordinal', '卦象书成');
    setText('calendar-context', `${calendar.timeLabel} · 农历${calendar.lunarLabel}`);
    setText('primary-upper', `${upper.symbol} ${upper.name} · ${upper.element}`);
    setText('primary-lower', `${lower.symbol} ${lower.name} · ${lower.element}`);
    setText('primary-name', primary.name);
    setText('primary-meta', `本卦 · 第 ${primary.number} 卦`);
    renderYaoStack('primary-lines', primary.lines);
    resultCard.classList.remove('is-empty', 'is-revealing');
    resultEmpty.hidden = true;
    resultContent.hidden = false;
  }
  function showResult(divination, meal, ordinal) {
    const { calendar, upper, lower, primary, mutual, movingLine, movingLineLabel, changed, transitionCue, formula } = divination;
    const setText = (id, value) => { const element = $(`#${id}`); if (element) element.textContent = value; };
    setText('result-ordinal', `第 ${ordinal} 数`);
    setText('calendar-context', `${calendar.timeLabel} · 农历${calendar.lunarLabel}`);
    setText('primary-upper', `${upper.symbol} ${upper.name} · ${upper.element}`);
    setText('primary-lower', `${lower.symbol} ${lower.name} · ${lower.element}`);
    setText('primary-name', primary.name);
    setText('primary-meta', `本卦 · 第 ${primary.number} 卦`);
    setText('mutual-meta', `互卦 · ${mutual.name} · 第 ${mutual.number} 卦`);
    setText('moving-line-meta', `动爻 · ${movingLineLabel}`);
    setText('changed-meta', `变卦 · ${changed.name} · 第 ${changed.number} 卦`);
    setText('image-reading', `卦意简释：${primary.reading.image}`);
    setText('food-cue', `食候提示：${primary.reading.foodCue}`);
    setText('transition-cue', transitionCue);
    setText('formula-reading', formula);
    renderYaoStack('primary-lines', primary.lines, movingLine);
    renderYaoStack('changed-lines', changed.lines);
    setText('oracle-title', `梅花数时合参 · ${primary.name}`);
    setText('result-title', meal.name);
    const recommendation = meal.recommendation;
    const recommendationMeta = recommendation?.isUniversalTemplate ? '通用食堂餐型' : (recommendation?.isOutingCuisine ? '校外菜系建议' : '日常餐食建议');
    setText('meal-meta', `${meal.source} / ${meal.venue} / ${recommendationMeta}`);
    setText('oracle-line', '本卦参与餐签的确定性排序；餐别、地点与日常均衡规则仍优先。');
    setText('meal-reason', meal.reason);
    renderPracticalRecommendation(meal.recommendation);
    resultCard.classList.remove('is-empty', 'is-revealing'); resultEmpty.hidden = true; resultContent.hidden = false; void resultCard.offsetWidth; resultCard.classList.add('is-revealing');
    announce(`餐卦已显现：${meal.name}，${meal.source}${meal.venue}。`);
  }
  function renderPracticalRecommendation(recommendation) {
    const container = $('.practical-recommendation');
    if (!container) return;
    if (!isRecord(recommendation)) {
      renderRecommendationList('result-dish-suggestions', []);
      renderRecommendationList('result-fallbacks', []);
      const reality = $('#result-reality-adjustment'); const note = $('#result-entertainment-note');
      if (reality) reality.textContent = '';
      if (note) note.textContent = '';
      container.hidden = true;
      return;
    }

    const reasons = Array.isArray(recommendation.reasons) ? recommendation.reasons : [];
    const reasonFor = (label) => reasons.find((reason) => reason?.label === label)?.text || '';
    const suggestions = Array.isArray(recommendation.dishSuggestions)
      ? recommendation.dishSuggestions
      : (Array.isArray(recommendation.suggestions) ? recommendation.suggestions : []);
    const isCanteen = recommendation.isUniversalTemplate === true;
    const isOuting = recommendation.isOutingCuisine === true;
    const fallbackItems = isCanteen
      ? recommendation.fallbacks
      : (Array.isArray(recommendation.fallbackOptions)
        ? recommendation.fallbackOptions.map((option) => `${option.cuisineLabel}：${option.dishSuggestions.join('、')}`)
        : []);
    const practicalFallbacks = fallbackItems?.length
      ? fallbackItems
      : [isOuting ? '若附近没有该菜系供应，请按实际菜单另选已启用菜系。' : '若当日窗口无供应，请按现场菜单选择同类完整一餐。'];
    const realityText = isCanteen
      ? reasonFor('现实修正')
      : [reasonFor('天气倾向'), reasonFor('菜单范围')].filter(Boolean).join(' ');

    renderRecommendationList('result-dish-suggestions', suggestions);
    renderRecommendationList('result-fallbacks', practicalFallbacks);
    const reality = $('#result-reality-adjustment');
    const note = $('#result-entertainment-note');
    if (reality) reality.textContent = realityText || '天气和近期餐食只参与轻度排序，实际供应与个人需求优先。';
    if (note) note.textContent = recommendation.disclaimer || '娱乐性饮食提示：请以实际供应和个人情况为准。';
    container.hidden = false;
  }
  function renderRecommendationList(id, items) {
    const list = $(`#${id}`);
    if (!list) return;
    const values = Array.isArray(items) ? items.filter((item) => typeof item === 'string' && item.trim()) : [];
    list.replaceChildren(...values.map((value) => {
      const item = document.createElement('li'); item.textContent = value; return item;
    }));
  }
  function renderYaoStack(id, lines, movingLine = null) {
    const stack = $(`#${id}`);
    if (!stack) return;
    const yao = Array.isArray(lines) ? lines : [];
    stack.replaceChildren(...yao.map((line, index) => {
      const item = document.createElement('i');
      const isYang = line === 1;
      const isMoving = movingLine === index + 1;
      item.classList.add(isYang ? 'is-yang' : 'is-yin');
      if (isMoving) item.classList.add('is-moving');
      item.setAttribute('aria-label', `第${index + 1}爻，${isYang ? '阳爻' : '阴爻'}${isMoving ? '，动爻' : ''}`);
      return item;
    }));
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
    const isWorldScope = menuFilters.zone === '世界料理';
    const scopedMenu = isWorldScope
      ? state.menu.filter((meal) => normaliseCuisineFields(meal).cuisineZone !== '中国菜')
      : state.menu;
    const catalogFilters = isWorldScope ? { ...menuFilters, zone: '' } : menuFilters;
    const visibleMeals = filterMealsByCuisine(scopedMenu, catalogFilters);
    const options = availableCuisineOptions(scopedMenu, catalogFilters);
    renderCuisineDirectory(options.cuisines, scopedMenu, catalogFilters);
    menuList.replaceChildren();
    if (visibleMeals.length === 0) {
      const message = document.createElement('p'); message.className = 'menu-empty-state'; message.textContent = '没有符合当前筛选的餐品。';
      const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'menu-small-button'; clear.textContent = '清除筛选'; clear.addEventListener('click', () => updateMenuFilters({ type: 'clear' }));
      menuList.append(message, clear);
    } else {
      visibleMeals.forEach((meal) => menuList.append(menuRow(meal)));
    }
    syncMenuSelect(menuFilterCuisine, options.cuisines, menuFilters.cuisine, '全部菜系');
    syncMenuSelect(menuFilterFamily, options.families, menuFilters.family, '全部大类');
    menuZoneInputs.forEach((input) => {
      input.checked = input.value === menuFilters.zone;
      input.disabled = false;
    });
    if (menuFilterEnabled) menuFilterEnabled.checked = menuFilters.enabledOnly;
    if (menuFilterQuery) menuFilterQuery.value = menuFilters.query;
    const activeScope = menuFilters.zone || (menuFilters.enabledOnly ? '我的启用' : '');
    menuScopeTabs.forEach((tab) => tab.setAttribute('aria-pressed', String(tab.dataset.menuScope === activeScope)));
    if (menuFilterSummary) {
      const path = [activeScope, menuFilters.cuisine, menuFilters.family].filter(Boolean).join(' · ');
      menuFilterSummary.textContent = `显示 ${visibleMeals.length} / ${state.menu.length} 项${path ? ` · ${path}` : ''}`;
    }
    const count = $('#menu-count');
    if (count) count.textContent = `${state.menu.filter((meal) => meal.enabled).length} 项启用 / ${state.menu.length} 项菜单`;
    syncSelectedMealTrigger();
  }
  function renderCuisineDirectory(cuisines, scopedMenu, catalogFilters) {
    if (!cuisineDirectory) return;
    cuisineDirectory.replaceChildren();
    const summary = document.createElement('p'); summary.id = 'cuisine-directory-summary'; summary.className = 'cuisine-directory-summary';
    summary.textContent = cuisines.length ? `当前范围 · ${cuisines.length} 个菜系` : '当前范围没有可浏览的菜系';
    cuisineDirectory.append(summary);
    cuisines.forEach((cuisine) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'cuisine-directory-button'; button.dataset.cuisine = cuisine;
      button.textContent = `${cuisine} · ${filterMealsByCuisine(scopedMenu, { ...catalogFilters, cuisine }).length}`;
      button.setAttribute('aria-pressed', String(menuFilters.cuisine === cuisine));
      button.addEventListener('click', () => updateMenuFilters({ type: 'cuisine', value: cuisine }));
      cuisineDirectory.append(button);
    });
  }
  function syncMenuSelect(select, values, selected, placeholder) {
    if (!select) return;
    const choices = selected && !values.includes(selected) ? [...values, selected] : values;
    select.replaceChildren();
    const all = document.createElement('option'); all.value = ''; all.textContent = placeholder; select.append(all);
    choices.forEach((value) => { const option = document.createElement('option'); option.value = value; option.textContent = value; select.append(option); });
    select.value = selected;
  }
  function menuRow(meal) {
    const row = document.createElement('div'); row.className = 'menu-row'; row.tabIndex = 0; row.dataset.mealId = meal.id;
    const heading = document.createElement('div'); heading.className = 'menu-row-heading'; const title = document.createElement('h3'); title.textContent = meal.name; const status = document.createElement('span'); status.textContent = meal.enabled ? '启用中' : '已停用'; heading.append(title, status); row.append(heading);
    const path = document.createElement('p'); path.className = 'meal-cuisine-path'; path.textContent = cuisinePath(meal).split(' / ').slice(1).join(' / '); row.append(path);
    const enabled = document.createElement('button'); enabled.type = 'button'; enabled.className = 'menu-small-button'; enabled.textContent = meal.enabled ? '停用此餐' : '启用此餐'; enabled.addEventListener('click', (event) => { event.stopPropagation(); updateMeal(meal.id, { enabled: !meal.enabled }); }); row.append(enabled);
    const select = () => selectMenuMeal(meal.id);
    row.addEventListener('click', select);
    row.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } });
    return row;
  }
  function syncSelectedMealTrigger() {
    const selected = state.menu.find((meal) => meal.id === selectedMenuMealId);
    mealDetailsTrigger.hidden = !selected;
    if (selected) mealDetailsTrigger.dataset.mealId = selected.id;
    else delete mealDetailsTrigger.dataset.mealId;
  }
  function clearMenuMealSelection() {
    selectedMenuMealId = null;
    mealDetailsTrigger.hidden = true;
    delete mealDetailsTrigger.dataset.mealId;
    mealEditorPanel.replaceChildren();
    mealEditorPanel.hidden = true;
  }
  function selectMenuMeal(id) {
    const meal = state.menu.find((item) => item.id === id);
    if (!meal) return;
    selectedMenuMealId = meal.id;
    mealEditorPanel.replaceChildren();
    mealEditorPanel.hidden = true;
    syncSelectedMealTrigger();
    announce(`已选择${meal.name}；可继续编辑所选餐品。`);
  }
  function openMealEditor() {
    const meal = state.menu.find((item) => item.id === selectedMenuMealId);
    if (!meal) return;
    renderMealEditor(meal);
    mealEditorPanel.querySelector('[data-editor-field="name"]')?.focus();
  }
  function renderMealEditor(meal) {
    const form = document.createElement('form'); form.className = 'meal-editor-form'; form.dataset.mealId = meal.id;
    const title = document.createElement('h3'); title.textContent = `编辑：${meal.name}`; form.append(title);
    const control = (field, labelText, input) => {
      const label = document.createElement('label'); label.className = 'menu-control'; label.htmlFor = `meal-editor-${field}`;
      const text = document.createElement('span'); text.textContent = labelText;
      input.id = `meal-editor-${field}`; input.name = field; input.setAttribute('data-editor-field', field);
      label.append(text, input); return label;
    };
    const textInput = (field, labelText, value) => {
      const input = document.createElement('input'); input.type = 'text'; input.value = value; input.required = true;
      form.append(control(field, labelText, input));
    };
    const selectInput = (field, labelText, value, choices) => {
      const select = document.createElement('select');
      choices.forEach((choice) => { const option = document.createElement('option'); option.value = choice; option.textContent = choice; option.selected = choice === value; select.append(option); });
      form.append(control(field, labelText, select));
    };
    textInput('name', '餐名', meal.name);
    textInput('venue', '档口 / 地点', meal.venue);
    selectInput('source', '来源', meal.source, MENU_OPTIONS.sources);
    const periods = document.createElement('fieldset'); periods.className = 'menu-periods'; periods.setAttribute('data-editor-field', 'meals');
    const legend = document.createElement('legend'); legend.textContent = '适用餐别'; periods.append(legend);
    ['早餐', '午餐', '晚餐'].forEach((period) => {
      const label = document.createElement('label'); const input = document.createElement('input'); input.type = 'checkbox'; input.name = 'meals'; input.value = period; input.checked = meal.meals.includes(period);
      label.append(input, document.createTextNode(period)); periods.append(label);
    });
    form.append(periods);
    selectInput('staple', '主食', meal.staple, MENU_OPTIONS.staples);
    selectInput('protein', '蛋白', meal.protein, MENU_OPTIONS.proteins);
    selectInput('vegetable', '蔬菜', meal.vegetable, MENU_OPTIONS.vegetables);
    selectInput('flavor', '口味', meal.flavor, MENU_OPTIONS.flavors);
    const actions = document.createElement('div'); actions.className = 'menu-row-actions';
    const save = document.createElement('button'); save.type = 'submit'; save.className = 'confirm-button'; save.textContent = '保存修改';
    const close = document.createElement('button'); close.type = 'button'; close.className = 'retry-button'; close.textContent = '取消'; close.addEventListener('click', closeMealEditor);
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'menu-delete-button'; remove.textContent = '删除此餐'; remove.addEventListener('click', () => deleteMeal(meal.id));
    actions.append(save, close, remove); form.append(actions);
    form.addEventListener('submit', saveMealEditor);
    mealEditorPanel.replaceChildren(form);
    mealEditorPanel.hidden = false;
  }
  function saveMealEditor(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const changes = {
      name: form.elements.name.value.trim(),
      venue: form.elements.venue.value.trim(),
      source: form.elements.source.value,
      meals: [...form.querySelectorAll('input[name="meals"]:checked')].map((input) => input.value),
      staple: form.elements.staple.value,
      protein: form.elements.protein.value,
      vegetable: form.elements.vegetable.value,
      flavor: form.elements.flavor.value,
    };
    if (updateMeal(form.dataset.mealId, changes)) {
      closeMealEditor();
      announce(`已保存${changes.name}。`);
    }
  }
  function closeMealEditor() {
    mealEditorPanel.replaceChildren();
    mealEditorPanel.hidden = true;
    persist();
    renderMenu();
    mealDetailsTrigger.focus();
  }
  function deleteMeal(id) {
    if (state.menu.length <= 1) { announce('菜单至少需要保留一项餐品。'); return; }
    const meal = state.menu.find((item) => item.id === id);
    if (!meal || !window.confirm(`确定删除“${meal.name}”吗？`)) return;
    state.menu = state.menu.filter((item) => item.id !== id);
    clearMenuMealSelection();
    persist();
    renderMenu();
    announce(`已删除${meal.name}。`);
  }
  function updateMeal(id, changes) { const index = state.menu.findIndex((meal) => meal.id === id); if (index < 0) return false; const candidate = { ...state.menu[index], ...changes }; if (!isValidMenu(state.menu.map((meal, itemIndex) => itemIndex === index ? candidate : meal))) { announce('请保留有效名称、档口和至少一个餐别。'); renderMenu(); return false; } state.menu[index] = candidate; persist(); renderMenu(); return true; }
  function announce(message) { liveRegion.textContent = ''; window.setTimeout(() => { liveRegion.textContent = message; }, 20); }
}
