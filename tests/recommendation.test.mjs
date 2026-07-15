import test from 'node:test';
import assert from 'node:assert/strict';

import { STARTER_MEALS, FOOD_ORACLES } from '../assets/data.js';
import {
  FALLBACK_TAXONOMY,
  availableCuisineOptions,
  cuisinePath,
  filterMealsByCuisine,
  normaliseCuisineFields,
} from '../assets/cuisine-catalog.js';
import { HEXAGRAMS, TRIGRAMS } from '../assets/hexagrams.js';
import {
  beijingCalendarParts,
  deriveDivination,
  normaliseMovingLine,
  trigramFromRemainder,
} from '../assets/divination.js';
import {
  chooseMeal,
  contextualSeed,
  dailyBalanceTip,
  loadStoredState,
  normaliseMenu,
  normaliseRecordsByDate,
  oracleFor,
  oracleForContext,
  resolveWeather,
  saveStoredState,
  scoreMeal,
  todayKey,
} from '../assets/app.js';

test('trigram export preserves the eight strict remainder rows and order', () => {
  assert.deepEqual(TRIGRAMS, [
    { remainder: 1, name: '乾', symbol: '☰', element: '金', lines: [1, 1, 1] },
    { remainder: 2, name: '兑', symbol: '☱', element: '金', lines: [1, 1, 0] },
    { remainder: 3, name: '离', symbol: '☲', element: '火', lines: [1, 0, 1] },
    { remainder: 4, name: '震', symbol: '☳', element: '木', lines: [1, 0, 0] },
    { remainder: 5, name: '巽', symbol: '☴', element: '木', lines: [0, 1, 1] },
    { remainder: 6, name: '坎', symbol: '☵', element: '水', lines: [0, 1, 0] },
    { remainder: 7, name: '艮', symbol: '☶', element: '土', lines: [0, 0, 1] },
    { remainder: 8, name: '坤', symbol: '☷', element: '土', lines: [0, 0, 0] },
  ]);
});

test('canonical hexagram source has 64 ordered, uniquely encoded King Wen rows', () => {
  assert.equal(HEXAGRAMS.length, 64);
  assert.deepEqual(HEXAGRAMS.map(({ number }) => number), Array.from({ length: 64 }, (_, index) => index + 1));
  assert.equal(new Set(HEXAGRAMS.map(({ name }) => name)).size, 64, 'hexagram names must be unique');
  assert.equal(new Set(HEXAGRAMS.map(({ lines }) => lines.join(''))).size, 64, 'six-line encodings must be unique');
});

test('each hexagram vector is lower-first and matches its named canonical trigrams', () => {
  const trigramLines = new Map(TRIGRAMS.map(({ name, lines }) => [name, lines]));
  for (const hexagram of HEXAGRAMS) {
    assert.equal(hexagram.lines.length, 6, `${hexagram.name} must have six lines`);
    assert.deepEqual(
      hexagram.lines,
      [...trigramLines.get(hexagram.lower), ...trigramLines.get(hexagram.upper)],
      `${hexagram.name} line vector must be lower trigram then upper trigram`,
    );
  }
});

test('each hexagram carries distinct, nonempty entertainment readings', () => {
  const images = HEXAGRAMS.map(({ reading }) => reading.image);
  const foodCues = HEXAGRAMS.map(({ reading }) => reading.foodCue);
  assert.ok(images.every((value) => typeof value === 'string' && value.trim().length > 0));
  assert.ok(foodCues.every((value) => typeof value === 'string' && value.trim().length > 0));
  assert.equal(new Set(images).size, 64, 'reading images must be distinct');
  assert.equal(new Set(foodCues).size, 64, 'food cues must be distinct');
  assert.ok(foodCues.every((value) => !/游戏|挑战|任务|投票|猜猜|数一数|朗读|同伴/.test(value)), 'food cues must be food interpretations, not activities');
});

test('canonical named examples retain their King Wen identity', () => {
  const namesByNumber = new Map(HEXAGRAMS.map(({ number, name }) => [number, name]));
  assert.equal(namesByNumber.get(1), '乾为天');
  assert.equal(namesByNumber.get(2), '坤为地');
  assert.equal(namesByNumber.get(3), '水雷屯');
  assert.equal(namesByNumber.get(15), '地山谦');
  assert.equal(namesByNumber.get(29), '坎为水');
  assert.equal(namesByNumber.get(30), '离为火');
  assert.equal(namesByNumber.get(40), '雷水解');
  assert.equal(namesByNumber.get(63), '水火既济');
  assert.equal(namesByNumber.get(64), '火水未济');
});

test('plum-blossom remainder rules map zero to 坤 and the sixth moving line', () => {
  assert.equal(trigramFromRemainder(0).name, '坤');
  assert.equal(trigramFromRemainder(8).name, '坤');
  assert.equal(normaliseMovingLine(0), 6);
  assert.throws(() => normaliseMovingLine(2.5), /余数计算参数无效/);
});

test('deriveDivination produces the documented 谦 example with mutual and changed hexagrams', () => {
  const calendar = { lunarMonth: 5, lunarDay: 19, hourBranch: 7, lunarLabel: '五月十九', hourName: '未', timeLabel: '北京时间 13:00 · 未时' };
  const result = deriveDivination(32, calendar);
  assert.equal(result.primary.name, '地山谦');
  assert.equal(result.primary.number, 15);
  assert.equal(result.movingLine, 3);
  assert.equal(result.mutual.name, '雷水解');
  assert.equal(result.mutual.number, 40);
  assert.equal(result.changed.name, '坤为地');
  assert.equal(result.changed.number, 2);
  assert.equal(result.primary.lines.filter((line, index) => line !== result.changed.lines[index]).length, 1);
});

test('deriveDivination is deterministic for injected calendar values', () => {
  const calendar = { lunarMonth: 5, lunarDay: 19, hourBranch: 7, lunarLabel: '五月十九', hourName: '未', timeLabel: '北京时间 13:00 · 未时' };
  assert.deepEqual(deriveDivination(32, calendar), deriveDivination(32, calendar));
});

test('divination results are defensive copies and cannot corrupt canonical data', () => {
  const calendar = { lunarMonth: 5, lunarDay: 19, hourBranch: 7 };
  const altered = deriveDivination(32, calendar);
  altered.primary.lines[0] = 1;
  altered.primary.reading.image = '篡改';
  altered.upper.element = '篡改';
  const fresh = deriveDivination(32, calendar);
  assert.equal(fresh.primary.name, '地山谦');
  assert.deepEqual(fresh.primary.lines, [0, 0, 1, 0, 0, 0]);
  assert.notEqual(fresh.primary.reading.image, '篡改');
  assert.equal(fresh.upper.element, '土');
});

test('Beijing calendar parts use Asia Shanghai rather than the device local time', () => {
  const parts = beijingCalendarParts(new Date('2026-07-14T03:24:00Z'));
  assert.equal(parts.beijingHour, 11);
  assert.equal(parts.beijingMinute, 24);
  assert.equal(parts.hourBranch, 7);
  assert.equal(parts.hourName, '午');
  assert.ok(parts.lunarMonth >= 1 && parts.lunarMonth <= 12);
  assert.ok(parts.lunarDay >= 1 && parts.lunarDay <= 30);
});

test('starter menu offers 70+ varied editable choices across key meal situations', () => {
  assert.ok(STARTER_MEALS.length >= 70, 'starter menu should contain at least 70 choices');
  for (const period of ['早餐', '午餐', '晚餐']) {
    assert.ok(STARTER_MEALS.some((meal) => meal.meals.includes(period)), `missing ${period}`);
  }
  for (const source of ['食堂', '校外']) {
    assert.ok(STARTER_MEALS.some((meal) => meal.source === source), `missing ${source}`);
  }
  assert.ok(STARTER_MEALS.some((meal) => meal.source === '校外' && meal.meals.includes('早餐')), 'missing off-campus breakfast');
  assert.ok(STARTER_MEALS.some((meal) => meal.protein === '鱼虾' && meal.meals.includes('午餐')), 'missing fish/shrimp lunch');
  assert.ok(STARTER_MEALS.some((meal) => meal.protein === '鱼虾' && meal.meals.includes('晚餐')), 'missing fish/shrimp dinner');
  assert.ok(STARTER_MEALS.some((meal) => meal.staple === '粥类' && meal.meals.includes('晚餐')), 'missing porridge dinner');
  assert.equal(new Set(STARTER_MEALS.map((meal) => meal.id)).size, STARTER_MEALS.length, 'starter meal ids must be unique');
  assert.equal(new Set(STARTER_MEALS.map((meal) => meal.name)).size, STARTER_MEALS.length, 'starter meal names must be unique');
  const validSources = new Set(['食堂', '校外']);
  const validPeriods = new Set(['早餐', '午餐', '晚餐']);
  const validStaples = new Set(['米饭', '粉类', '面食', '粥类']);
  const validProteins = new Set(['鸡肉', '牛肉', '猪肉', '鱼虾', '蛋类', '豆制品', '无明确蛋白']);
  const validVegetables = new Set(['有', '少', '无']);
  const validFlavors = new Set(['清淡', '普通', '汤类', '重口', '油炸']);
  for (const meal of STARTER_MEALS) {
    assert.ok(validSources.has(meal.source), `${meal.name} has invalid source`);
    assert.ok(Array.isArray(meal.meals) && meal.meals.length > 0 && meal.meals.every((period) => validPeriods.has(period)), `${meal.name} has invalid periods`);
    assert.ok(validStaples.has(meal.staple), `${meal.name} has invalid staple`);
    assert.ok(validProteins.has(meal.protein), `${meal.name} has invalid protein`);
    assert.ok(validVegetables.has(meal.vegetable), `${meal.name} has invalid vegetable value`);
    assert.ok(validFlavors.has(meal.flavor), `${meal.name} has invalid flavor`);
    assert.equal(typeof meal.enabled, 'boolean', `${meal.name} has invalid enabled value`);
  }
  for (const meal of STARTER_MEALS) {
    for (const key of ['id', 'name', 'source', 'venue', 'meals', 'staple', 'protein', 'vegetable', 'flavor', 'enabled']) {
      assert.ok(Object.hasOwn(meal, key), `${meal.name} is missing ${key}`);
    }
  }
});

test('food oracle map has 64 gentle entertainment-only entries', () => {
  assert.equal(FOOD_ORACLES.length, 64);
  for (const oracle of FOOD_ORACLES) {
    assert.equal(typeof oracle.title, 'string');
    assert.equal(typeof oracle.line, 'string');
    assert.ok(oracle.title.length > 1 && oracle.line.length > 3);
    assert.match(oracle.line, /娱乐|仅作|不作/);
  }
});

test('cuisine taxonomy gives legacy meals a coherent fallback without losing legacy data', () => {
  const legacy = meal('legacy', { meals: ['午餐'], metadata: { source: 'old-menu' } });
  const normalised = normaliseCuisineFields(legacy);

  assert.deepEqual(
    {
      cuisineZone: normalised.cuisineZone,
      cuisine: normalised.cuisine,
      courseFamily: normalised.courseFamily,
      dishType: normalised.dishType,
    },
    FALLBACK_TAXONOMY,
  );
  assert.equal(normalised.id, 'legacy');
  assert.deepEqual(normalised.metadata, { source: 'old-menu' });
  assert.equal(cuisinePath(legacy), '中国菜 / 中式日常 / 其他中式 / 自定义');
});

test('cuisine taxonomy retains a valid Chinese meal path', () => {
  const mealWithCuisine = meal('gongbao', {
    name: '宫保鸡丁',
    cuisineZone: '中国菜',
    cuisine: '川菜',
    courseFamily: '热菜',
    dishType: '宫保鸡丁',
  });

  assert.deepEqual(normaliseCuisineFields(mealWithCuisine), mealWithCuisine);
  assert.equal(cuisinePath(mealWithCuisine), '中国菜 / 川菜 / 热菜 / 宫保鸡丁');
});

test('cuisine taxonomy falls back for partial catalog paths but preserves full custom paths', () => {
  const partial = normaliseCuisineFields(meal('partial', { cuisineZone: '中国菜' }));
  assert.deepEqual(
    { cuisineZone: partial.cuisineZone, cuisine: partial.cuisine, courseFamily: partial.courseFamily, dishType: partial.dishType },
    FALLBACK_TAXONOMY,
  );
  const customInput = meal('custom-path', {
    cuisineZone: '自定义范围', cuisine: '我的菜系', courseFamily: '我的大类', dishType: '我的餐品',
  });
  assert.deepEqual(normaliseCuisineFields(customInput), customInput);
});

test('cuisine filters compose zone, cuisine, family, enabled state, and text search', () => {
  const meals = [
    meal('gongbao', { name: '宫保鸡丁', cuisineZone: '中国菜', cuisine: '川菜', courseFamily: '热菜', dishType: '宫保鸡丁' }),
    meal('mapo-disabled', { name: '麻婆豆腐', enabled: false, cuisineZone: '中国菜', cuisine: '川菜', courseFamily: '热菜', dishType: '麻婆豆腐' }),
    meal('sushi', { name: '东瀛午餐', cuisineZone: '东亚料理', cuisine: '日料', courseFamily: '刺身寿司', dishType: '寿司' }),
  ];

  assert.deepEqual(
    filterMealsByCuisine(meals, {
      zone: '中国菜',
      cuisine: '川菜',
      family: '热菜',
      enabledOnly: true,
      query: ' 宫保 ',
    }).map((item) => item.id),
    ['gongbao'],
  );
  assert.deepEqual(filterMealsByCuisine(meals, { query: '寿司' }).map((item) => item.id), ['sushi']);
  const unicodeMeal = meal('unicode', {
    name: 'Cafe\u0301 午餐', cuisineZone: '跨地域', cuisine: '咖啡烘焙', courseFamily: '咖啡', dishType: '拿铁',
  });
  assert.deepEqual(filterMealsByCuisine([unicodeMeal], { query: 'Café' }).map((item) => item.id), ['unicode']);
});

test('cuisine options contain only actual normalised choices and respect upstream filters', () => {
  const meals = [
    meal('legacy'),
    meal('gongbao', { cuisineZone: '中国菜', cuisine: '川菜', courseFamily: '热菜', dishType: '宫保鸡丁' }),
    meal('sushi', { cuisineZone: '东亚料理', cuisine: '日料', courseFamily: '刺身寿司', dishType: '寿司' }),
  ];

  assert.deepEqual(availableCuisineOptions(meals, { zone: '中国菜' }), {
    zones: ['东亚料理', '中国菜'],
    cuisines: ['中式日常', '川菜'],
    families: ['其他中式', '热菜'],
  });
  assert.deepEqual(availableCuisineOptions(meals, { zone: '欧洲料理' }), {
    zones: ['东亚料理', '中国菜'],
    cuisines: [],
    families: [],
  });
});

test('cuisine utilities leave source meals and nested fields untouched and return original meal objects', () => {
  const source = meal('custom', {
    meals: ['午餐'],
    metadata: { labels: ['keep'] },
    cuisineZone: '中国菜',
    cuisine: '川菜',
    courseFamily: '热菜',
    dishType: '宫保鸡丁',
  });
  const normalised = normaliseCuisineFields(source);
  normalised.meals.push('晚餐');
  normalised.metadata.labels.push('changed');

  assert.deepEqual(source.meals, ['午餐']);
  assert.deepEqual(source.metadata.labels, ['keep']);
  assert.notEqual(normalised, source);
  assert.notEqual(normalised.metadata, source.metadata);
  assert.equal(filterMealsByCuisine([source], { cuisine: '川菜' })[0], source);
});

test('chooseMeal excludes wrong period, place, disabled, and rejected meals', () => {
  const meals = [
    meal('good', { source: '食堂' }),
    meal('wrong-period', { meals: ['晚餐'] }),
    meal('wrong-place', { source: '校外' }),
    meal('disabled', { enabled: false }),
    meal('rejected'),
  ];
  const result = chooseMeal({ meals, mealPeriod: '午餐', place: '在学校', rejectedIds: ['rejected'], seed: 5 });
  assert.equal(result.meal.id, 'good');
  assert.equal(result.relaxed, false);
});

test('chooseMeal strongly avoids an immediately repeated meal, staple, and protein when alternatives exist', () => {
  const meals = [
    meal('rice-chicken', { staple: '米饭', protein: '鸡肉' }),
    meal('beef-noodle', { staple: '粉类', protein: '牛肉', vegetable: '少', flavor: '汤类' }),
  ];
  const result = chooseMeal({
    meals,
    mealPeriod: '午餐',
    place: '不限',
    recent: [{ mealId: 'rice-chicken', staple: '米饭', protein: '鸡肉' }],
    seed: 12,
  });
  assert.equal(result.meal.id, 'beef-noodle');
});

test('chooseMeal favors vegetables after a vegetable-poor meal', () => {
  const meals = [
    meal('few-veg', { vegetable: '少' }),
    meal('has-veg', { vegetable: '有' }),
  ];
  const context = { meals, mealPeriod: '午餐', place: '不限', recent: [{ vegetable: '无', protein: '猪肉' }], seed: 27 };
  assert.ok(scoreMeal(meals[1], context) > scoreMeal(meals[0], context));
  assert.equal(chooseMeal(context).meal.id, 'has-veg');
});

test('recommendation boundaries ignore malformed newest-first history records', () => {
  const meals = [meal('safe-choice')];
  const context = {
    meals,
    mealPeriod: '午餐',
    place: '不限',
    recent: [null, 7, 'not a record', {}, { staple: '米饭' }],
  };

  assert.doesNotThrow(() => scoreMeal(meals[0], context));
  assert.doesNotThrow(() => chooseMeal(context));
  assert.equal(chooseMeal(context).meal.id, 'safe-choice');
});

test('vegetable compensation only considers the newest five newest-first history records', () => {
  const hasVegetables = meal('has-vegetables', { vegetable: '有' });
  const noVegetables = meal('no-vegetables', { vegetable: '无' });
  const context = {
    recent: [
      { protein: '鸡肉' }, { protein: '鸡肉' }, { protein: '鸡肉' },
      { protein: '鸡肉' }, { protein: '鸡肉' }, { vegetable: '无', protein: '鸡肉' },
    ],
  };

  assert.equal(scoreMeal(hasVegetables, context), scoreMeal(noVegetables, context));
});

test('chooseMeal relaxes only repeat constraints when every valid meal is recently repeated', () => {
  const meals = [meal('only-choice')];
  const result = chooseMeal({
    meals,
    mealPeriod: '午餐',
    place: '不限',
    recent: [{ mealId: 'only-choice', staple: '米饭', protein: '鸡肉' }],
    seed: 1,
  });
  assert.equal(result.meal.id, 'only-choice');
  assert.equal(result.relaxed, true);
});

test('oracleFor is deterministic and maps report numbers into the 64 records', () => {
  assert.deepEqual(oracleFor(64, '2026-07-13', '晚餐'), oracleFor(64, '2026-07-13', '晚餐'));
  assert.equal(oracleFor(64, '2026-07-13', '晚餐').title, FOOD_ORACLES[63].title);
  assert.equal(oracleFor(0).title, FOOD_ORACLES[63].title);
  assert.equal(oracleFor(-1).title, FOOD_ORACLES[62].title);
  assert.deepEqual(oracleFor('not-a-number', '2026-07-13', '晚餐'), oracleFor('not-a-number', '2026-07-13', '晚餐'));
});

test('automatic weather is an offline local-date season rule while manual choices remain unchanged', () => {
  assert.equal(resolveWeather('自动以本地日期推演', '2026-07-13'), '晴热');
  assert.equal(resolveWeather('自动以本地日期推演', '2026-01-13'), '偏冷');
  assert.equal(resolveWeather('自动以本地日期推演', '2026-04-13'), '不考虑');
  assert.equal(resolveWeather('下雨', '2026-07-13'), '下雨');
});

test('contextual seed and both deterministic outcomes include report number, local date, meal period, weather, and place', () => {
  const context = { dateKey: '2026-07-13', mealPeriod: '午餐', weather: '下雨', place: '在学校' };
  const same = contextualSeed(32, context);
  assert.equal(same, contextualSeed(32, context));
  assert.notEqual(same, contextualSeed(32, { ...context, dateKey: '2026-07-14' }));
  assert.notEqual(same, contextualSeed(32, { ...context, mealPeriod: '晚餐' }));
  assert.notEqual(same, contextualSeed(32, { ...context, weather: '晴热' }));
  assert.notEqual(same, contextualSeed(32, { ...context, place: '校外' }));
  assert.deepEqual(oracleForContext(32, context), oracleForContext(32, context));
  assert.notDeepEqual(oracleForContext(32, context), oracleForContext(32, { ...context, weather: '晴热' }));

  const meals = [meal('one'), meal('two')];
  assert.equal(chooseMeal({ meals, ...context, seed: same }).meal.id, chooseMeal({ meals, ...context, seed: same }).meal.id);
});

test('weather has a small, explainable preference for soup or light meals', () => {
  const soup = meal('soup', { flavor: '汤类' });
  const plain = meal('plain', { flavor: '普通' });
  const light = meal('light', { flavor: '清淡' });
  assert.ok(scoreMeal(soup, { weather: '下雨' }) > scoreMeal(plain, { weather: '下雨' }));
  assert.ok(scoreMeal(soup, { weather: '偏冷' }) > scoreMeal(plain, { weather: '偏冷' }));
  assert.ok(scoreMeal(light, { weather: '晴热' }) > scoreMeal(plain, { weather: '晴热' }));
});

test('soft venue and flavor repeat penalties use only the current and prior two calendar days', () => {
  const target = meal('target', { venue: '同一档口', flavor: '普通' });
  const base = scoreMeal(target, { dateKey: '2026-07-13' });
  const outsideWindow = scoreMeal(target, {
    dateKey: '2026-07-13',
    recent: [{ date: '2026-07-10', venue: '同一档口', flavor: '普通' }],
  });
  const insideWindow = scoreMeal(target, {
    dateKey: '2026-07-13',
    recent: [{ date: '2026-07-11', venue: '同一档口', flavor: '普通' }],
  });
  assert.equal(outsideWindow, base);
  assert.equal(insideWindow, base - 12);
});

test('daily balance tips are compact, non-medical, and based on confirmed records', () => {
  assert.match(dailyBalanceTip([]), /尚无/);
  assert.match(dailyBalanceTip([record('no-veg', '午餐', '2026-07-13')]), /蔬菜/);
  assert.match(dailyBalanceTip([
    record('chicken-one', '早餐', '2026-07-13', 1),
    record('chicken-two', '午餐', '2026-07-13', 2),
  ]), /鸡肉/);
  assert.match(dailyBalanceTip([
    record('chicken', '早餐', '2026-07-13', 1),
    record('fish', '午餐', '2026-07-13', 2),
  ]), /变化/);
});

test('normaliseMenu restores clean defaults for malformed persisted menus', () => {
  assert.deepEqual(normaliseMenu(null), STARTER_MEALS);
  assert.deepEqual(normaliseMenu([{ name: '' }]), STARTER_MEALS);
  assert.deepEqual(normaliseMenu([meal('bad-source', { source: null })]), STARTER_MEALS);
  assert.deepEqual(normaliseMenu([meal('bad-venue', { venue: 7 })]), STARTER_MEALS);
  assert.deepEqual(normaliseMenu([meal('bad-periods', { meals: ['午餐', 7] })]), STARTER_MEALS);
  assert.deepEqual(normaliseMenu([meal('empty-periods', { meals: [] })]), STARTER_MEALS);
  assert.deepEqual(normaliseMenu([meal('bad-protein', { protein: null })]), STARTER_MEALS);
  assert.deepEqual(normaliseMenu([meal('bad-enabled', { enabled: 'true' })]), STARTER_MEALS);
  assert.deepEqual(normaliseMenu([meal('duplicate'), meal('duplicate', { name: 'duplicate two' })]), STARTER_MEALS);
});

test('normaliseMenu clones fallback and accepted records to protect canonical data and callers', () => {
  const restored = normaliseMenu(null);
  assert.notEqual(restored, STARTER_MEALS);
  assert.notEqual(restored[0], STARTER_MEALS[0]);
  assert.notEqual(restored[0].meals, STARTER_MEALS[0].meals);
  restored[0].name = 'mutated fallback';
  restored[0].meals.push('午餐');
  assert.notEqual(STARTER_MEALS[0].name, 'mutated fallback');
  assert.equal(STARTER_MEALS[0].meals.includes('午餐'), false);

  const custom = meal('custom', { name: '自定义轻食' });
  const normalised = normaliseMenu([custom]);
  assert.deepEqual(normalised, [custom]);
  assert.notEqual(normalised, [custom]);
  assert.notEqual(normalised[0], custom);
  assert.notEqual(normalised[0].meals, custom.meals);
  normalised[0].meals.push('晚餐');
  assert.equal(custom.meals.includes('晚餐'), false);
});

test('chooseMeal reports no eligible result and resolves identical scores deterministically', () => {
  assert.deepEqual(chooseMeal({ meals: [meal('lunch-only')], mealPeriod: '早餐', place: '不限' }), {
    meal: null,
    score: null,
    reason: '当前条件下没有可用餐品，请切换地点、餐别或调整菜单库。',
    relaxed: false,
  });

  const baseContext = { meals: [meal('one'), meal('two')], mealPeriod: '午餐', place: '不限' };
  assert.equal(chooseMeal({ ...baseContext, seed: 0 }).meal.id, 'two');
  assert.equal(chooseMeal({ ...baseContext, seed: 1 }).meal.id, 'one');
  assert.equal(chooseMeal({ ...baseContext, seed: 0 }).meal.id, chooseMeal({ ...baseContext, seed: 0 }).meal.id);
});

test('麻辣烫名称明确粉类主食以匹配重复规避元数据', () => {
  const malatang = STARTER_MEALS.find((meal) => meal.id === 'cf-malatang');
  assert.equal(malatang.staple, '粉类');
  assert.match(malatang.name, /粉类/);
});

test('todayKey formats a local date as an ISO-like day key', () => {
  assert.equal(todayKey(new Date(2026, 6, 13)), '2026-07-13');
});

test('persistence restores a valid editable menu and newest-first confirmed records', () => {
  const storage = memoryStorage();
  const state = {
    menu: [meal('custom', { name: '自定义轻食' })],
    recordsByDate: {
      '2026-07-12': [record('earlier', '早餐', '2026-07-12', 100)],
      '2026-07-13': [record('latest', '午餐', '2026-07-13', 200)],
    },
  };
  assert.equal(saveStoredState(storage, state), true);
  assert.deepEqual(loadStoredState(storage), state);
  assert.deepEqual(normaliseRecordsByDate(state.recordsByDate).history.map((item) => item.id), ['latest', 'earlier']);
});

test('persistence safely falls back for broken JSON, bad schema, bad records, and unavailable storage', () => {
  const storage = memoryStorage();
  storage.setItem('yi-shi-gua:v1', '{broken');
  assert.deepEqual(loadStoredState(storage), { menu: STARTER_MEALS, recordsByDate: {} });

  storage.setItem('yi-shi-gua:v1', JSON.stringify({ version: 1, menu: [meal('ok')], recordsByDate: { nope: [record('bad', '宵夜', 'nope')] } }));
  assert.deepEqual(loadStoredState(storage), { menu: STARTER_MEALS, recordsByDate: {} });

  const unavailable = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(loadStoredState(unavailable), { menu: STARTER_MEALS, recordsByDate: {} });
  assert.equal(saveStoredState(unavailable, { menu: [meal('ok')], recordsByDate: {} }), false);
  assert.equal(saveStoredState(null, { menu: [meal('ok')], recordsByDate: {} }), false);
});

function meal(id, overrides = {}) {
  return {
    id,
    name: id,
    source: '食堂',
    venue: '一食堂',
    meals: ['午餐'],
    staple: '米饭',
    protein: '鸡肉',
    vegetable: '有',
    flavor: '普通',
    enabled: true,
    ...overrides,
  };
}

function record(id, mealPeriod, date, confirmedAt = 0) {
  return { ...meal(id), mealPeriod, date, confirmedAt };
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); },
  };
}
