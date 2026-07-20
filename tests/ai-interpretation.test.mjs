import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  AI_INTERPRET_ENDPOINT,
  AI_INTERPRET_TIMEOUT_MS,
  buildAiInterpretationPayload,
  requestAiFoodInterpretation,
} from '../assets/app.js';

test('AI interpretation payload sends only the Worker contract fields derived from the local result', () => {
  const payload = buildAiInterpretationPayload({
    hexagramName: ' 地山谦 ',
    mealPeriod: ' 午餐 ',
    place: ' 在学校 ',
    weather: ' 晴暖 ',
    dailyState: { budget: ' 省钱 ', time: '', fullness: '想吃饱', mood: ' 想热乎 ' },
    recommendation: ' 盖饭配一份蔬菜。 ',
    dishes: ['宫保鸡丁', '', ' 番茄炒蛋 ', '青菜', '紫菜汤'],
    ignoredPrivateValue: 'must never leave the browser',
  });

  assert.deepEqual(payload, {
    hexagram: '地山谦',
    mealPeriod: '午餐',
    place: '在学校',
    weather: '晴暖',
    dailyState: { budget: '省钱', time: '正常', fullness: '想吃饱', mood: '想热乎' },
    recommendation: '盖饭配一份蔬菜。',
    dishes: ['宫保鸡丁', '番茄炒蛋', '青菜', '紫菜汤'],
  });
  assert.equal(Object.hasOwn(payload, 'ignoredPrivateValue'), false);
  assert.equal(buildAiInterpretationPayload({ hexagramName: '谦' }), null, 'incomplete local results must not call the Worker');
});

test('AI interpretation request uses the public Worker without frontend credentials and accepts only a text interpretation', async () => {
  const requests = [];
  const controller = new AbortController();
  const payload = buildAiInterpretationPayload({
    hexagramName: '地山谦', mealPeriod: '午餐', place: '在学校', weather: '晴暖',
    dailyState: {}, recommendation: '盖饭配一份蔬菜。', dishes: ['宫保鸡丁'],
  });
  const interpretation = await requestAiFoodInterpretation(payload, {
    signal: controller.signal,
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ interpretation: '谦意宜稳，先按现场选择一份完整午餐。', entertainmentOnly: true }) };
    },
  });

  assert.equal(interpretation, '谦意宜稳，先按现场选择一份完整午餐。');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, AI_INTERPRET_ENDPOINT);
  assert.equal(requests[0].options.method, 'POST');
  assert.deepEqual(requests[0].options.headers, { 'Content-Type': 'application/json' });
  assert.equal(requests[0].options.signal, controller.signal);
  assert.deepEqual(JSON.parse(requests[0].options.body), payload);
  await assert.rejects(
    requestAiFoodInterpretation(payload, { fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }) }),
    /503/,
  );
  await assert.rejects(
    requestAiFoodInterpretation(payload, { fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) }) }),
    /entertainment-only/,
  );
  await assert.rejects(
    requestAiFoodInterpretation(payload, { fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ interpretation: '可调理中焦。', entertainmentOnly: true }) }) }),
    /entertainment-only/,
  );
});

test('AI interpretation UI keeps the local result primary and makes async failure safe', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../assets/style.css', import.meta.url), 'utf8');

  assert.match(html, /id="ai-interpretation-panel"[^>]*aria-labelledby="ai-interpretation-title"[^>]*hidden/);
  assert.match(html, /<h3 id="ai-interpretation-title">AI 食卦解读<\/h3>/);
  assert.match(html, /AI 生成内容仅供娱乐，不构成饮食、营养或医疗建议/);
  assert.ok(html.indexOf('id="ai-interpretation-panel"') > html.indexOf('class="practical-recommendation"'), 'AI panel follows the static practical recommendation');

  assert.match(app, /const AI_INTERPRET_TIMEOUT_MS = 9000/);
  assert.match(app, /new AbortController\(\)/);
  assert.match(app, /window\.setTimeout\(\(\) => controller\?\.abort\(\), AI_INTERPRET_TIMEOUT_MS\)/);
  assert.match(app, /if \(requestToken !== aiRequestToken\) return;/);
  assert.match(app, /AI 解读暂不可用；本地卦意与就餐建议仍可直接参考。/);
  assert.match(app, /queueAiInterpretation\(divination, meal, state\.castContext\);/);
  assert.match(app, /cancelAiInterpretation\(\);/);
  assert.ok(!app.includes('DEEPSEEK_API_KEY'), 'the frontend must never carry an API key');
  assert.match(css, /\.ai-interpretation-panel\s*\{/);
  assert.match(css, /\.ai-interpretation-panel\.is-loading/);
  assert.equal(AI_INTERPRET_TIMEOUT_MS, 9000);
});
