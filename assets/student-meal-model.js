// Standalone universal templates: they describe common campus canteen meal patterns,
// not the availability, price, or vendors of any particular school.
export const WEATHER_OPTIONS = ['晴热', '晴暖', '阴凉', '雨天', '风大', '寒冷/雨雪'];

const LEGACY_WEATHER_MAP = new Map([
  ['自动以本地日期推演', '晴暖'],
  ['不考虑', '晴暖'],
  ['下雨', '雨天'],
  ['偏冷', '寒冷/雨雪'],
]);

/**
 * Converts both the new six-weather vocabulary and older saved/UI values to a
 * stable six-weather value. Unknown or missing values use the neutral 晴暖.
 */
export function normaliseStudentWeather(weather) {
  const value = typeof weather === 'string' ? weather.trim() : '';
  if (WEATHER_OPTIONS.includes(value)) return value;
  return LEGACY_WEATHER_MAP.get(value) ?? '晴暖';
}

// These are entertainment-oriented dietary directions, not health advice.
// The wording is deliberately compact so the eventual UI can show why a plan
// was ranked without presenting the trigram as a nutrition or supply oracle.
const TRIGRAM_DIETARY_TENDENCIES = Object.freeze({
  坎: '温润汤羹',
  离: '鲜香明快',
  震: '快捷',
  巽: '清爽蔬菜',
  艮: '稳妥克制',
  兑: '适度改善/分享',
  乾: '蛋白耐饱',
  坤: '均衡家常',
});

const DEFAULT_MEAL_PERIOD = '午餐';
const RECENT_RECORD_LIMIT = 5;

function primaryTrigrams(primaryOrUpper, lower) {
  if (typeof primaryOrUpper === 'string') return { upper: primaryOrUpper, lower };
  const primary = primaryOrUpper?.primary ?? primaryOrUpper ?? {};
  return { upper: primary.upper, lower: primary.lower };
}

function normaliseMealPeriod(mealPeriod) {
  return ['早餐', '午餐', '晚餐'].includes(mealPeriod) ? mealPeriod : DEFAULT_MEAL_PERIOD;
}

function normaliseRecentRecords(records) {
  if (!Array.isArray(records)) return [];
  // Records are newest-first, matching the persisted food-log ordering.
  return records.slice(0, RECENT_RECORD_LIMIT).filter((record) => record && typeof record === 'object');
}

function stableSeedValue(seed, planId) {
  const text = `${String(seed ?? '')}|${planId}`;
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0) / 0x100000000;
}

function clonePlan(plan) {
  return {
    ...plan,
    meals: [...plan.meals],
    dishSuggestions: [...plan.dishSuggestions],
    suggestions: [...plan.suggestions],
    fallbacks: [...plan.fallbacks],
    alternatives: [...plan.alternatives],
    weatherTags: [...plan.weatherTags],
    trigramTags: [...plan.trigramTags],
  };
}

/**
 * Returns the transparent dietary tendencies associated with a primary
 * hexagram's upper and lower trigrams. It accepts either { upper, lower },
 * { primary: { upper, lower } }, or (upper, lower) for adapter convenience.
 */
export function dietaryTendencyForTrigrams(primaryOrUpper, lower) {
  const trigrams = primaryTrigrams(primaryOrUpper, lower);
  return [trigrams.upper, trigrams.lower]
    .filter((trigram) => Object.hasOwn(TRIGRAM_DIETARY_TENDENCIES, trigram))
    .map((trigram) => ({ trigram, tendency: TRIGRAM_DIETARY_TENDENCIES[trigram] }));
}

/**
 * Scores one universal canteen plan without mutating either the plan or
 * context. Weather tags and trigram tags only add preferences: they never
 * remove a valid meal-period candidate. Recent records are newest-first and
 * receive a bounded, soft repeat penalty; `seed` resolves otherwise equal
 * candidates reproducibly.
 */
export function scoreStudentPlan(plan, context = {}) {
  if (!plan || typeof plan !== 'object') {
    return { eligible: false, score: Number.NEGATIVE_INFINITY, breakdown: {} };
  }

  const { upper, lower } = primaryTrigrams(context);
  const mealPeriod = normaliseMealPeriod(context.mealPeriod);
  const weather = normaliseStudentWeather(context.weather);
  const recentRecords = normaliseRecentRecords(context.recentRecords);
  const mealScore = Array.isArray(plan.meals) && plan.meals.includes(mealPeriod) ? 8 : -100;
  const weatherScore = Array.isArray(plan.weatherTags) && plan.weatherTags.includes(weather) ? 6 : 0;
  const trigramMatches = [upper, lower].filter((trigram) => Array.isArray(plan.trigramTags) && plan.trigramTags.includes(trigram)).length;
  const trigramScore = trigramMatches * 4;
  const recentRepeatIndex = recentRecords.findIndex((record) => record.id === plan.id || record.name === plan.name);
  const recentRepeatPenalty = recentRepeatIndex === -1 ? 0 : 10 - recentRepeatIndex;
  const tieBreaker = stableSeedValue(context.seed, plan.id);

  return {
    eligible: mealScore > 0,
    score: mealScore + weatherScore + trigramScore - recentRepeatPenalty + tieBreaker,
    breakdown: {
      mealScore,
      weatherScore,
      trigramScore,
      recentRepeatPenalty,
      tieBreaker,
    },
  };
}

/**
 * Recommends a generic, complete canteen plan. This does not claim a campus
 * has a particular window or dish; callers must check the day's actual supply.
 */
export function recommendCanteenPlan(context = {}) {
  const mealPeriod = normaliseMealPeriod(context.mealPeriod);
  const weather = normaliseStudentWeather(context.weather);
  const tendencies = dietaryTendencyForTrigrams(context);
  const candidates = CANTEEN_PLANS
    .filter((plan) => plan.meals.includes(mealPeriod))
    .map((plan) => ({ plan, ...scoreStudentPlan(plan, { ...context, mealPeriod, weather }) }))
    .sort((left, right) => right.score - left.score || left.plan.id.localeCompare(right.plan.id));
  const [selected, ...remaining] = candidates;

  if (!selected) return null;

  const plan = clonePlan(selected.plan);
  const fallbackPlans = remaining.slice(0, 2).map(({ plan: fallbackPlan }) => clonePlan(fallbackPlan));
  const tendencyText = tendencies.length > 0
    ? tendencies.map(({ trigram, tendency }) => `${trigram}卦偏向${tendency}`).join('；')
    : '未提供有效上下卦，按通用均衡餐型排序';
  const weatherText = plan.weatherTags.includes(weather)
    ? `${weather}时此餐型更贴合通用口味偏好`
    : `${weather}仅作轻度排序，不排除这份完整餐`;

  return {
    plan,
    dishSuggestions: plan.dishSuggestions.slice(0, 4),
    fallbacks: plan.fallbacks.slice(0, 2),
    fallbackPlans,
    tendencies,
    score: selected.score,
    reasons: [
      { label: '卦象取向', text: tendencyText },
      { label: '现实修正', text: `${weatherText}；${mealPeriod}仅保留可作为完整一餐的通用方案，并避开最近的软重复。` },
      { label: '落地替代', text: `若${plan.window}当日无供应，可改选${fallbackPlans.map((fallbackPlan) => fallbackPlan.name).join('或')}，并按实际窗口调整。` },
    ],
    disclaimer: '娱乐性饮食提示：这是通用食堂模板，不代表实际食堂当日供应，请以现场窗口和个人情况为准。',
    isEntertainment: true,
    isUniversalTemplate: true,
  };
}

const UNIVERSAL_SOURCE = '通用模板（非实际校园供应）';
const UNIVERSAL_AVAILABILITY = '通用模板，以实际食堂当日供应为准';

function canteenPlan({
  id,
  name,
  category,
  window,
  meals,
  dishSuggestions,
  fallbacks,
  weatherTags,
  trigramTags,
}) {
  return {
    id,
    name,
    category,
    isCompleteMeal: true,
    isFullMeal: true,
    isSupplement: false,
    window,
    venue: `通用食堂${window}`,
    source: UNIVERSAL_SOURCE,
    availability: UNIVERSAL_AVAILABILITY,
    meals: [...meals],
    dishSuggestions: [...dishSuggestions],
    suggestions: [...dishSuggestions],
    fallbacks: [...fallbacks],
    alternatives: [...fallbacks],
    weatherTags: [...weatherTags],
    trigramTags: [...trigramTags],
  };
}

export const CANTEEN_PLANS = [
  canteenPlan({
    id: 'universal-self-select-combo',
    name: '自选快餐：一荤一素配米饭',
    category: '自选快餐',
    window: '自选快餐窗口',
    meals: ['午餐', '晚餐'],
    dishSuggestions: ['宫保鸡丁配清炒西兰花和米饭', '番茄炒蛋配蒜蓉油麦菜和米饭', '香菇鸡块配手撕包菜和米饭'],
    fallbacks: ['鸡腿肉换成卤豆腐', '米饭换成玉米或杂粮饭'],
    weatherTags: ['晴暖', '阴凉', '风大'],
    trigramTags: ['坤', '艮'],
  }),
  canteenPlan({
    id: 'universal-home-style-stir-fry',
    name: '家常小炒：现炒两菜一饭',
    category: '家常小炒',
    window: '家常小炒窗口',
    meals: ['午餐', '晚餐'],
    dishSuggestions: ['青椒肉丝配醋溜白菜和米饭', '木须肉配清炒时蔬和米饭', '芹菜香干炒肉配紫菜蛋花汤和米饭'],
    fallbacks: ['肉丝换成鸡蛋炒木耳', '加一份清炒绿叶菜'],
    weatherTags: ['晴暖', '阴凉', '风大'],
    trigramTags: ['坤', '兑'],
  }),
  canteenPlan({
    id: 'universal-rice-bowl',
    name: '盖饭：主菜盖浇配青菜',
    category: '盖饭',
    window: '盖饭窗口',
    meals: ['午餐', '晚餐'],
    dishSuggestions: ['黑椒牛肉盖饭配生菜', '土豆鸡块盖饭配海带丝', '鱼香肉丝盖饭配紫菜汤'],
    fallbacks: ['盖饭酱汁少放', '改选番茄鸡蛋盖饭'],
    weatherTags: ['晴暖', '阴凉', '风大'],
    trigramTags: ['乾', '震'],
  }),
  canteenPlan({
    id: 'universal-noodles',
    name: '粉面：汤粉或拌面配蔬菜',
    category: '粉面',
    window: '粉面窗口',
    meals: ['早餐', '午餐', '晚餐'],
    dishSuggestions: ['牛肉汤面加青菜和卤蛋', '鸡丝米粉加生菜', '榨菜肉丝拌面配青菜汤'],
    fallbacks: ['细面换成米粉', '加一份烫青菜'],
    weatherTags: ['阴凉', '雨天', '风大', '寒冷/雨雪'],
    trigramTags: ['坎', '艮'],
  }),
  canteenPlan({
    id: 'universal-malatang-maocai',
    name: '麻辣烫/冒菜：荤素主食均衡碗',
    category: '麻辣烫/冒菜',
    window: '麻辣烫或冒菜窗口',
    meals: ['午餐', '晚餐'],
    dishSuggestions: ['麻辣烫选牛肉片、豆腐、油麦菜和玉米面', '冒菜选鸡肉丸、藕片、菠菜和米饭', '番茄汤麻辣烫选虾滑、菌菇、青菜和粉丝'],
    fallbacks: ['选番茄或菌汤底', '少麻少油并加绿叶菜'],
    weatherTags: ['阴凉', '雨天', '风大', '寒冷/雨雪'],
    trigramTags: ['离', '坎'],
  }),
  canteenPlan({
    id: 'universal-dumplings-wontons',
    name: '饺子馄饨：主食配汤菜',
    category: '饺子馄饨',
    window: '饺子馄饨窗口',
    meals: ['早餐', '午餐', '晚餐'],
    dishSuggestions: ['芹菜猪肉水饺配紫菜蛋花汤', '鲜肉馄饨配凉拌黄瓜', '香菇鸡肉蒸饺配小青菜汤'],
    fallbacks: ['水饺换成素三鲜饺子', '加一份烫生菜'],
    weatherTags: ['阴凉', '雨天', '风大', '寒冷/雨雪'],
    trigramTags: ['艮', '坎'],
  }),
  canteenPlan({
    id: 'universal-fried-rice-noodles',
    name: '炒饭炒面：加蛋白和蔬菜',
    category: '炒饭炒面',
    window: '炒饭炒面窗口',
    meals: ['午餐', '晚餐'],
    dishSuggestions: ['扬州炒饭配青菜汤', '鸡蛋牛肉炒面配生菜', '什锦炒河粉配紫菜蛋花汤'],
    fallbacks: ['要求少油少盐', '炒面换成汤面加青菜'],
    weatherTags: ['晴暖', '阴凉', '风大'],
    trigramTags: ['震', '兑'],
  }),
  canteenPlan({
    id: 'universal-teppanyaki-claypot',
    name: '铁板/煲仔：热菜配时蔬',
    category: '铁板/煲仔',
    window: '铁板或煲仔窗口',
    meals: ['午餐', '晚餐'],
    dishSuggestions: ['铁板鸡腿肉配西兰花和米饭', '腊味煲仔饭配菜心', '番茄牛腩煲配米饭和生菜'],
    fallbacks: ['铁板酱汁分开放', '选番茄牛腩煲替代腊味煲'],
    weatherTags: ['阴凉', '雨天', '风大', '寒冷/雨雪'],
    trigramTags: ['离', '艮'],
  }),
  canteenPlan({
    id: 'universal-hot-soup-meal',
    name: '汤饭汤面：热汤主食套餐',
    category: '汤饭汤面',
    window: '汤饭汤面窗口',
    meals: ['早餐', '午餐', '晚餐'],
    dishSuggestions: ['番茄鸡蛋汤面配烫青菜', '菌菇鸡汤饭配凉拌木耳', '萝卜牛腩汤米线配生菜'],
    fallbacks: ['清汤换成番茄汤', '主食减半并加青菜'],
    weatherTags: ['阴凉', '雨天', '风大', '寒冷/雨雪'],
    trigramTags: ['坎', '坤'],
  }),
  canteenPlan({
    id: 'universal-breakfast',
    name: '早餐：热主食加蛋奶蔬果',
    category: '早餐',
    window: '早餐窗口',
    meals: ['早餐'],
    dishSuggestions: ['鸡蛋灌饼配无糖豆浆和生菜', '小米粥配茶叶蛋、菜包和凉拌黄瓜', '燕麦粥配全麦面包、煮鸡蛋和香蕉'],
    fallbacks: ['油条换成玉米或红薯', '甜豆浆换成无糖豆浆'],
    weatherTags: ['晴热', '晴暖', '阴凉', '雨天', '风大', '寒冷/雨雪'],
    trigramTags: ['震', '坤'],
  }),
  canteenPlan({
    id: 'universal-fried-chicken-burger',
    name: '炸鸡/汉堡：配蔬菜或热汤',
    category: '炸鸡/汉堡',
    window: '炸鸡汉堡窗口',
    meals: ['午餐', '晚餐'],
    dishSuggestions: ['奥尔良烤鸡腿堡配生菜沙拉和玉米浓汤', '香辣鸡腿堡配蔬菜沙拉和紫菜汤', '去皮炸鸡配玉米、凉拌黄瓜和番茄汤'],
    fallbacks: ['炸鸡换成烤鸡腿', '薯条换成沙拉或玉米汤'],
    weatherTags: ['晴暖', '阴凉', '风大'],
    trigramTags: ['兑', '震'],
  }),
  canteenPlan({
    id: 'universal-light-meal',
    name: '轻食补餐：谷物蛋白蔬菜碗',
    category: '轻食补餐',
    window: '轻食或便利餐窗口',
    meals: ['早餐', '午餐', '晚餐'],
    dishSuggestions: ['鸡胸肉糙米碗配西兰花和玉米', '金枪鱼全麦三明治配蔬菜沙拉和南瓜汤', '卤牛肉杂粮饭配生菜、番茄和鸡蛋'],
    fallbacks: ['鸡胸肉换成卤豆腐或鸡蛋', '全麦三明治换成杂粮饭碗'],
    weatherTags: ['晴热', '晴暖', '阴凉', '风大'],
    trigramTags: ['巽', '乾'],
  }),
];
