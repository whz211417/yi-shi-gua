import test from 'node:test';
import assert from 'node:assert/strict';

import { STARTER_MEALS, FOOD_ORACLES } from '../assets/data.js';
import { chooseMeal, normaliseMenu, oracleFor, scoreMeal, todayKey } from '../assets/app.js';

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
});

test('normaliseMenu restores defaults for malformed menus and keeps valid editable records', () => {
  assert.deepEqual(normaliseMenu(null), STARTER_MEALS);
  assert.deepEqual(normaliseMenu([{ name: '' }]), STARTER_MEALS);
  const custom = meal('custom', { name: '自定义轻食' });
  assert.deepEqual(normaliseMenu([custom]), [custom]);
});

test('todayKey formats a local date as an ISO-like day key', () => {
  assert.equal(todayKey(new Date(2026, 6, 13)), '2026-07-13');
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
