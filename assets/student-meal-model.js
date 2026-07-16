// Standalone universal templates: they describe common campus canteen meal patterns,
// not the availability, price, or vendors of any particular school.
export const WEATHER_OPTIONS = ['晴热', '晴暖', '阴凉', '雨天', '风大', '寒冷/雨雪'];

// Daily state is deliberately a small, optional preference layer. These values
// do not describe dietary advice or hard availability constraints.
export const DAILY_STATE_OPTIONS = Object.freeze({
  budget: Object.freeze(['省钱', '正常', '想改善']),
  time: Object.freeze(['赶时间', '正常', '可以慢慢吃']),
  fullness: Object.freeze(['想吃饱', '正常', '想清淡']),
  mood: Object.freeze(['不限', '想热乎', '想重口', '想吃点好的']),
});

const DAILY_STATE_DEFAULTS = Object.freeze({
  budget: '正常',
  time: '正常',
  fullness: '正常',
  mood: '不限',
});

const DAILY_STATE_LABELS = Object.freeze({
  budget: '预算',
  time: '时间',
  fullness: '饱腹',
  mood: '心情',
});

const DAILY_STATE_PATTERNS = Object.freeze({
  budget: Object.freeze({
    省钱: /自选快餐|盖饭|粉面|炒饭|早餐|快餐/,
    想改善: /家常小炒|铁板|煲仔|炸鸡|汉堡|牛|鱼|虾/,
  }),
  time: Object.freeze({
    赶时间: /自选快餐|盖饭|炒饭|快餐|三明治|汉堡/,
    可以慢慢吃: /家常小炒|麻辣烫|冒菜|饺子|馄饨|铁板|煲仔|汤饭|火锅/,
  }),
  fullness: Object.freeze({
    想吃饱: /米饭|饭|面|粉|饺|馄饨|主食|盖饭|炒/,
    想清淡: /轻食|蔬菜|沙拉|清汤|番茄|素/,
  }),
  mood: Object.freeze({
    想热乎: /热|汤|面|粉|粥|锅|煲/,
    想重口: /麻辣|重口|炸|烤|炒/,
    想吃点好的: /牛|鱼|虾|铁板|煲仔|小炒|寿司/,
  }),
});

/** Returns a complete, safe daily-state record without retaining caller data. */
export function normaliseDailyStates(dailyState) {
  const source = dailyState && typeof dailyState === 'object' ? dailyState : {};
  return Object.fromEntries(Object.entries(DAILY_STATE_DEFAULTS).map(([field, fallback]) => {
    const value = typeof source[field] === 'string' ? source[field].trim() : '';
    return [field, DAILY_STATE_OPTIONS[field].includes(value) ? value : fallback];
  }));
}

function dailyStateSearchText(item) {
  if (!item || typeof item !== 'object') return '';
  return ['name', 'category', 'window', 'cuisineZone', 'cuisine', 'courseFamily', 'dishType']
    .map((field) => typeof item[field] === 'string' ? item[field] : '')
    .join(' ');
}

/**
 * Applies small additive daily-state preferences to a menu item. A non-match
 * always scores zero, so daily state can never remove an otherwise valid item.
 */
export function scoreDailyStatePreferences(item, dailyState) {
  const states = normaliseDailyStates(dailyState);
  const text = dailyStateSearchText(item);
  const influences = Object.entries(states).flatMap(([field, value]) => {
    const pattern = DAILY_STATE_PATTERNS[field][value];
    return pattern?.test(text) ? [{ field, value, label: DAILY_STATE_LABELS[field], score: 2 }] : [];
  });
  return { score: influences.reduce((total, influence) => total + influence.score, 0), influences };
}

function dailyStateReasonText(influences) {
  return influences.map(({ field, value }) => `${DAILY_STATE_LABELS[field]}「${value}」`).join('；');
}

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
  const dailyStatePreference = scoreDailyStatePreferences(plan, context.dailyState);
  const recentRepeatIndex = recentRecords.findIndex((record) => record.id === plan.id || record.name === plan.name);
  const recentRepeatPenalty = recentRepeatIndex === -1 ? 0 : 10 - recentRepeatIndex;
  const tieBreaker = stableSeedValue(context.seed, plan.id);

  return {
    eligible: mealScore > 0,
    score: mealScore + weatherScore + trigramScore + dailyStatePreference.score - recentRepeatPenalty + tieBreaker,
    breakdown: {
      mealScore,
      weatherScore,
      trigramScore,
      dailyStateScore: dailyStatePreference.score,
      dailyStateInfluences: dailyStatePreference.influences,
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
  const dailyStateText = dailyStateReasonText(selected.breakdown.dailyStateInfluences);

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
      ...(dailyStateText ? [{ label: '今日状态', text: `${dailyStateText}为这份餐型增加了轻度排序权重，不排除其他完整餐型。` }] : []),
      { label: '落地替代', text: `若${plan.window}当日无供应，可改选${fallbackPlans.map((fallbackPlan) => fallbackPlan.name).join('或')}，并按实际窗口调整。` },
    ],
    disclaimer: '娱乐性饮食提示：这是通用食堂模板，不代表实际食堂当日供应，请以现场窗口和个人情况为准。',
    isEntertainment: true,
    isUniversalTemplate: true,
  };
}

const OUTING_TRIGRAM_PATTERNS = Object.freeze({
  坎: /汤|羹|锅|面|粉|粥/,
  离: /辣|烤|炸|炒|咖喱|焗/,
  震: /饭|面|粉|三明治|汉堡|卷|饺/,
  巽: /沙拉|素|蔬|凉|刺身|寿司/,
  艮: /饭|面|粉|饺|包|锅/,
  兑: /寿司|火锅|烧烤|甜|点心|分享/,
  乾: /牛|鸡|肉|鱼|虾|蛋|豆腐/,
  坤: /家常|饭|炒|面|粉|菜/,
});

const OUTING_WEATHER_PATTERNS = Object.freeze({
  晴热: /沙拉|凉|刺身|寿司|冷面|冰/,
  晴暖: /饭|面|粉|菜|肉/,
  阴凉: /汤|羹|锅|面|粉/,
  雨天: /汤|羹|锅|面|粉/,
  风大: /汤|羹|锅|面|粉/,
  '寒冷/雨雪': /汤|羹|锅|面|粉|炖/,
});

const OUTING_AVAILABILITY_DISCLAIMER = '附近实际供应需自行确认；本推荐不代表任何餐馆当日菜单。';

function nonEmptyText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function outingMenuAndContext(menuOrContext, additionalContext) {
  if (Array.isArray(menuOrContext)) return { menu: menuOrContext, context: additionalContext && typeof additionalContext === 'object' ? additionalContext : {} };
  const context = menuOrContext && typeof menuOrContext === 'object' ? menuOrContext : {};
  const menu = Array.isArray(context.menu) ? context.menu : (Array.isArray(context.meals) ? context.meals : []);
  return { menu, context };
}

function usableOutingMeals(menu) {
  return menu.flatMap((meal) => {
    if (!meal || typeof meal !== 'object' || meal.enabled !== true) return [];
    const cuisineZone = nonEmptyText(meal.cuisineZone);
    const cuisine = nonEmptyText(meal.cuisine);
    const courseFamily = nonEmptyText(meal.courseFamily);
    const dishType = nonEmptyText(meal.dishType);
    if (!cuisineZone || !cuisine || !courseFamily || !dishType) return [];
    return [{
      id: nonEmptyText(meal.id) || `${cuisineZone}/${cuisine}/${courseFamily}/${dishType}`,
      cuisineZone,
      cuisine,
      courseFamily,
      dishType,
    }];
  });
}

function outingDishScore(dish, context) {
  const { upper, lower } = primaryTrigrams(context);
  const weather = normaliseStudentWeather(context.weather);
  const text = `${dish.cuisine} ${dish.courseFamily} ${dish.dishType}`;
  const trigramScore = [upper, lower]
    .filter((trigram) => OUTING_TRIGRAM_PATTERNS[trigram]?.test(text)).length * 3;
  const weatherScore = OUTING_WEATHER_PATTERNS[weather].test(text) ? 4 : 0;
  const recentRecords = normaliseRecentRecords(context.recentRecords);
  const repeatPenalty = recentRecords.some((record) => record?.dishType === dish.dishType)
    ? 6
    : (recentRecords.some((record) => record?.cuisine === dish.cuisine && record?.cuisineZone === dish.cuisineZone) ? 3 : 0);
  const dailyStatePreference = scoreDailyStatePreferences(dish, context.dailyState);
  return {
    score: trigramScore + weatherScore + dailyStatePreference.score - repeatPenalty,
    dailyStateInfluences: dailyStatePreference.influences,
  };
}

function groupedOutingCuisines(menu, context) {
  const cuisineGroups = new Map();
  for (const dish of usableOutingMeals(menu)) {
    const cuisineKey = `${dish.cuisineZone}\u0000${dish.cuisine}`;
    if (!cuisineGroups.has(cuisineKey)) {
      cuisineGroups.set(cuisineKey, {
        cuisineKey,
        cuisineZone: dish.cuisineZone,
        cuisine: dish.cuisine,
        paths: new Map(),
      });
    }
    const group = cuisineGroups.get(cuisineKey);
    const pathKey = `${cuisineKey}\u0000${dish.courseFamily}\u0000${dish.dishType}`;
    if (!group.paths.has(pathKey)) group.paths.set(pathKey, dish);
  }

  return [...cuisineGroups.values()]
    .map((group) => {
      const dishes = [...group.paths.values()];
      const dishTypes = [...new Set(dishes.map(({ dishType }) => dishType))];
      const scoredDishes = dishes
        .map((dish) => {
          const { score, dailyStateInfluences } = outingDishScore(dish, context);
          return { dish, score, dailyStateInfluences, tieBreaker: stableSeedValue(context.seed, dish.id) };
        })
        .sort((left, right) => right.score - left.score || right.tieBreaker - left.tieBreaker || left.dish.id.localeCompare(right.dish.id));
      const score = scoredDishes.reduce((total, item) => total + item.score, 0) / scoredDishes.length;
      const dailyStateInfluences = scoredDishes.flatMap((item) => item.dailyStateInfluences)
        .filter((influence, index, influences) => (
          influences.findIndex(({ field, value }) => field === influence.field && value === influence.value) === index
        ));
      return {
        ...group,
        dishTypes,
        scoredDishes,
        score,
        dailyStateInfluences,
        tieBreaker: stableSeedValue(context.seed, group.cuisineKey),
      };
    })
    // A cuisine must have enough user-enabled concrete choices to provide the
    // requested 2–4 suggestions without inventing unavailable dishes.
    .filter((group) => group.dishTypes.length >= 2)
    .sort((left, right) => right.score - left.score || right.tieBreaker - left.tieBreaker || left.cuisineKey.localeCompare(right.cuisineKey));
}

function outingCuisineSummary(group, suggestionLimit = 4) {
  const dishSuggestions = group.scoredDishes
    .map(({ dish }) => dish.dishType)
    .filter((dishType, index, dishes) => dishes.indexOf(dishType) === index)
    .slice(0, suggestionLimit);
  return {
    cuisine: group.cuisine,
    cuisineZone: group.cuisineZone,
    cuisinePath: `${group.cuisineZone} / ${group.cuisine}`,
    cuisineLabel: `${group.cuisineZone}·${group.cuisine}（校外菜系）`,
    dishSuggestions,
  };
}

/**
 * Selects a cuisine for an outing exclusively from enabled, fully classified
 * editable-menu entries. Weather and trigrams are soft rankings; the supplied
 * seed resolves ties reproducibly. It never infers nearby availability.
 */
export function recommendOutingCuisine(menuOrContext = {}, additionalContext = {}) {
  const { menu, context } = outingMenuAndContext(menuOrContext, additionalContext);
  const weather = normaliseStudentWeather(context.weather);
  const tendencies = dietaryTendencyForTrigrams(context);
  const candidates = groupedOutingCuisines(menu, { ...context, weather });

  if (candidates.length === 0) {
    const reason = '当前没有可推荐的已启用外出菜系；请在菜单库为同一菜系启用至少两项具体菜品后再试。';
    return {
      cuisine: null,
      cuisineZone: null,
      cuisinePath: null,
      cuisineLabel: null,
      dishSuggestions: [],
      suggestions: [],
      fallbackOptions: [],
      fallbacks: [],
      tendencies,
      score: null,
      reason,
      reasons: [
        { label: '卦象取向', text: tendencies.length > 0 ? tendencies.map(({ trigram, tendency }) => `${trigram}卦偏向${tendency}`).join('；') : '未提供有效上下卦，无法增加卦象排序权重。' },
        { label: '菜单范围', text: '外出推荐只会使用当前菜单中已启用、且分类完整的菜品。' },
        { label: '下一步', text: '请至少为一个菜系启用两项具体菜品，再重新获取推荐。' },
      ],
      disclaimer: OUTING_AVAILABILITY_DISCLAIMER,
      isEntertainment: true,
      isOutingCuisine: true,
    };
  }

  const [selected, ...remaining] = candidates;
  const summary = outingCuisineSummary(selected);
  const fallbackOptions = remaining.slice(0, 2).map((group) => outingCuisineSummary(group, 2));
  const tendencyText = tendencies.length > 0
    ? tendencies.map(({ trigram, tendency }) => `${trigram}卦偏向${tendency}`).join('；')
    : '未提供有效上下卦，按已启用菜系的通用排序推荐。';
  const weatherText = OUTING_WEATHER_PATTERNS[weather] ? `${weather}仅作为对菜品名称与分类的轻度排序，不排除其他已启用菜系。` : '天气仅作为轻度排序。';
  const dailyStateText = dailyStateReasonText(selected.dailyStateInfluences);

  return {
    ...summary,
    suggestions: [...summary.dishSuggestions],
    fallbackOptions,
    fallbacks: fallbackOptions,
    tendencies,
    score: selected.score + selected.tieBreaker,
    reasons: [
      { label: '卦象取向', text: tendencyText },
      { label: '天气倾向', text: weatherText },
      ...(dailyStateText ? [{ label: '今日状态', text: `${dailyStateText}为这组菜品增加了轻度排序权重，不排除其他已启用菜系。` }] : []),
      { label: '菜单范围', text: `仅从当前菜单中已启用的完整分类路径选择；${summary.cuisineLabel}作为外出菜系呈现。` },
    ],
    disclaimer: OUTING_AVAILABILITY_DISCLAIMER,
    isEntertainment: true,
    isOutingCuisine: true,
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
