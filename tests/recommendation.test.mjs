import test from 'node:test';
import assert from 'node:assert/strict';

import { STARTER_MEALS, FOOD_ORACLES } from '../assets/data.js';
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

test('starter menu covers all periods, venue types, and editable fields', () => {
  assert.ok(STARTER_MEALS.length >= 24 && STARTER_MEALS.length <= 36);
  for (const period of ['早餐', '午餐', '晚餐']) {
    assert.ok(STARTER_MEALS.some((meal) => meal.meals.includes(period)), `missing ${period}`);
  }
  for (const source of ['食堂', '校外']) {
    assert.ok(STARTER_MEALS.some((meal) => meal.source === source), `missing ${source}`);
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
