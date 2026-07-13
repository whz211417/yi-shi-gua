import { FOOD_ORACLES, STARTER_MEALS } from './data.js';

const REQUIRED_MEAL_FIELDS = ['id', 'name', 'source', 'venue', 'meals', 'staple', 'protein', 'vegetable', 'flavor', 'enabled'];
const RECENT_HISTORY_WINDOW = 5;
const MEAL_PERIODS = new Set(['早餐', '午餐', '晚餐']);
const VALID_SOURCES = new Set(['食堂', '校外']);
const VALID_STAPLES = new Set(STARTER_MEALS.map((meal) => meal.staple));
const VALID_PROTEINS = new Set(STARTER_MEALS.map((meal) => meal.protein));
const VALID_VEGETABLES = new Set(STARTER_MEALS.map((meal) => meal.vegetable));
const VALID_FLAVORS = new Set(STARTER_MEALS.map((meal) => meal.flavor));

/** Return a local calendar key without using UTC conversion. */
export function todayKey(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Restore the editable starter bank when saved menu data is unusable. */
export function normaliseMenu(menu) {
  if (!Array.isArray(menu) || menu.length === 0 || !menu.every(isUsableMeal) || !hasUniqueIds(menu)) {
    return cloneMeals(STARTER_MEALS);
  }
  return cloneMeals(menu);
}

/**
 * Score one meal against a serializable recommendation context. Higher is better.
 * This function is deliberately side-effect-free so UI/persistence code can stay separate.
 */
export function scoreMeal(meal, context = {}) {
  if (!isRecord(meal)) return Number.NEGATIVE_INFINITY;
  const safeContext = isRecord(context) ? context : {};
  const recent = normaliseRecent(safeContext.recent);
  const recentTwo = recent.slice(0, 2);
  const latestSeveral = recent.slice(0, 5);
  let score = 100;

  for (const record of recentTwo) {
    if (sameMeal(record, meal)) score -= 110;
    if (record.staple === meal.staple) score -= 42;
    if (record.protein === meal.protein) score -= 42;
  }
  for (const record of latestSeveral) {
    if (record.venue && record.venue === meal.venue) score -= 7;
    if (record.flavor && record.flavor === meal.flavor) score -= 5;
  }

  const vegetablePoor = recent.some((record) => record.vegetable === '无' || record.vegetable === '少');
  if (vegetablePoor && meal.vegetable === '有') score += 28;
  if (vegetablePoor && meal.vegetable === '无') score -= 12;

  const proteinCounts = countBy(recent.slice(0, 3), 'protein');
  if ((proteinCounts[meal.protein] || 0) >= 2) score -= 22;
  if (Object.keys(proteinCounts).length > 0 && (proteinCounts[meal.protein] || 0) === 0) score += 16;

  const lastMealWasHeavy = recent.slice(0, 2).some((record) => isHeavy(record.flavor));
  if (lastMealWasHeavy && (meal.flavor === '清淡' || meal.flavor === '汤类')) score += 18;
  if (lastMealWasHeavy && isHeavy(meal.flavor)) score -= 16;

  if (safeContext.mealPeriod === '早餐' && meal.protein !== '无明确蛋白') score += 4;
  return score;
}

/**
 * Pick a suitable meal deterministically. The first pass removes repeat-conflicting
 * items among the latest two meals; if that leaves nothing, it reuses valid items
 * with their repeat penalties retained and reports `relaxed: true`.
 */
export function chooseMeal(context = {}) {
  const safeContext = isRecord(context) ? context : {};
  const meals = normaliseMenu(safeContext.meals);
  const recent = normaliseRecent(safeContext.recent);
  const rejectedIds = new Set(Array.isArray(safeContext.rejectedIds) ? safeContext.rejectedIds : []);
  const eligible = meals.filter((meal) => (
    meal.enabled !== false
    && Array.isArray(meal.meals)
    && meal.meals.includes(safeContext.mealPeriod)
    && matchesPlace(meal, safeContext.place)
    && !rejectedIds.has(meal.id)
  ));

  if (eligible.length === 0) {
    return { meal: null, score: null, reason: '当前条件下没有可用餐品，请切换地点、餐别或调整菜单库。', relaxed: false };
  }

  const recentTwo = recent.slice(0, 2);
  const nonRepeating = eligible.filter((meal) => !recentTwo.some((record) => repeatsCore(record, meal)));
  const candidates = nonRepeating.length > 0 ? nonRepeating : eligible;
  const relaxed = nonRepeating.length === 0;
  const ranked = candidates.map((meal) => ({
    meal,
    score: scoreMeal(meal, { ...safeContext, recent }),
    tie: seededTieBreak(safeContext.seed, meal.id),
  })).sort((a, b) => b.score - a.score || b.tie - a.tie || a.meal.id.localeCompare(b.meal.id));
  const selected = ranked[0];

  return {
    meal: selected.meal,
    score: selected.score,
    reason: recommendationReason(selected.meal, { ...safeContext, recent }, relaxed),
    relaxed,
  };
}

/** Return one of the fixed 64 entertainment-only food-oracle records. */
export function oracleFor(seed, dateKey = '', mealPeriod = '') {
  const numericSeed = Number.parseInt(seed, 10);
  const ordinal = Number.isFinite(numericSeed) ? numericSeed : hashString(`${dateKey}|${mealPeriod}`);
  const index = ((ordinal - 1) % FOOD_ORACLES.length + FOOD_ORACLES.length) % FOOD_ORACLES.length;
  return FOOD_ORACLES[index];
}

function isUsableMeal(meal) {
  return isRecord(meal)
    && REQUIRED_MEAL_FIELDS.every((field) => Object.hasOwn(meal, field))
    && hasText(meal.id)
    && hasText(meal.name)
    && VALID_SOURCES.has(meal.source)
    && hasText(meal.venue)
    && Array.isArray(meal.meals) && meal.meals.length > 0 && meal.meals.every((period) => MEAL_PERIODS.has(period))
    && VALID_STAPLES.has(meal.staple)
    && VALID_PROTEINS.has(meal.protein)
    && VALID_VEGETABLES.has(meal.vegetable)
    && VALID_FLAVORS.has(meal.flavor)
    && typeof meal.enabled === 'boolean';
}

function hasUniqueIds(meals) {
  return new Set(meals.map((meal) => meal.id)).size === meals.length;
}

function cloneMeals(meals) {
  return meals.map((meal) => ({ ...meal, meals: [...meal.meals] }));
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** History is newest-first; retain only record-like entries in the newest five stored records. */
function normaliseRecent(recent) {
  return Array.isArray(recent) ? recent.slice(0, RECENT_HISTORY_WINDOW).filter(isRecord) : [];
}

function matchesPlace(meal, place) {
  if (!place || place === '不限') return true;
  if (place === '在学校' || place === '不想走远') return meal.source === '食堂';
  if (place === '校外') return meal.source === '校外';
  return true;
}

function repeatsCore(record, meal) {
  return isRecord(record) && (sameMeal(record, meal) || record.staple === meal.staple || record.protein === meal.protein);
}

function sameMeal(record, meal) {
  return isRecord(record) && isRecord(meal)
    && (record.mealId === meal.id || record.id === meal.id || record.name === meal.name);
}

function isHeavy(flavor) {
  return flavor === '油炸' || flavor === '重口';
}

function countBy(records, key) {
  return records.reduce((counts, record) => {
    if (isRecord(record) && record[key]) counts[record[key]] = (counts[record[key]] || 0) + 1;
    return counts;
  }, {});
}

function seededTieBreak(seed, mealId) {
  return (hashString(`${seed ?? 0}|${mealId}`) % 10_000) / 10_000_000;
}

function hashString(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function recommendationReason(meal, context, relaxed) {
  const recent = normaliseRecent(isRecord(context) ? context.recent : []);
  const notes = [];
  if (recent.some((record) => record.vegetable === '无' || record.vegetable === '少') && meal.vegetable === '有') notes.push('补一份蔬菜');
  if (recent.slice(0, 2).some((record) => isHeavy(record.flavor)) && (meal.flavor === '清淡' || meal.flavor === '汤类')) notes.push('换成较清爽的口味');
  if (recent.slice(0, 2).some((record) => record.protein === meal.protein)) notes.push('尽量避开近期同类蛋白');
  if (notes.length === 0) notes.push('餐别与地点匹配，并保留日常变化');
  if (relaxed) notes.push('可选项均与近餐相近，已放宽避重条件');
  return `${meal.name}：${notes.join('；')}。`;
}
