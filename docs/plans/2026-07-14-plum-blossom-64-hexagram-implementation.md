# 数时合参六十四卦专业版 Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 将“易食卦”从泛化的 64 条餐饮文案升级为固定北京时间、农历月日、时辰和用户报数共同推导的梅花数时合参系统，真实呈现本卦、互卦、动爻、变卦、五行取象与 64 卦独立解读。

**Architecture:** `assets/data.js` 保存标准八卦、64 卦、六爻编码和原创文化性简释；新增 `assets/divination.js` 作为无 DOM、可注入日历参数的纯算法层；`assets/app.js` 仅协调当前上下文、餐食排序和 DOM 渲染；`index.html` 提供语义化卦签结构，`assets/style.css` 绘制真实阴阳爻和克制的书爻/点爻/显变卦动效。

**Tech Stack:** 原生 ES Modules、浏览器 `Intl.DateTimeFormat`（中国农历 / `Asia/Shanghai`）、Node test runner、HTML/CSS、GitHub Pages；不引入网络 API、第三方库或账户。

---

## Shared invariants

- 起卦时区固定 `Asia/Shanghai`；海外访问不改变同一 UTC 时刻的卦象。
- 农历数值必须来自 `Intl.DateTimeFormat('en-US-u-ca-chinese', …).formatToParts()` 的 numeric parts；展示文字用 `zh-Hans-CN-u-ca-chinese`，不从中文数字猜测数值。
- 若当前浏览器无中国农历支持，显示错误并阻止起卦；不得静默使用公历。
- 余数映射固定：`1乾 2兑 3离 4震 5巽 6坎 7艮 0/8坤`；动爻 `0→6`；爻数组一律自下而上。
- 真实卦象参与稳定 tie-break seed，不取代餐别、地点、可用菜单、去重、均衡和天气规则。
- 所有解读为原创文化性简释，不输出吉凶、命理、医疗、财运、感情或宿命判断。

## Task 1: 建立八卦与 64 卦规范数据

**Objective:** 用可验证的标准数据替换泛化 `FOOD_ORACLES`，使完整 64 卦、六爻与每卦解读成为唯一真源。

**Files:**
- Modify: `assets/data.js:85-105`
- Modify: `tests/recommendation.test.mjs`

**Step 1: Write failing data-contract tests**

在 `tests/recommendation.test.mjs` 顶部新增对 `TRIGRAMS`、`HEXAGRAMS` 的 import，并增加：

```js
test('canonical hexagram table covers all 64 unique King Wen entries with readings', () => {
  assert.equal(HEXAGRAMS.length, 64);
  assert.deepEqual(HEXAGRAMS.map((item) => item.number).sort((a, b) => a - b), Array.from({ length: 64 }, (_, index) => index + 1));
  assert.equal(new Set(HEXAGRAMS.map((item) => item.name)).size, 64);
  assert.equal(new Set(HEXAGRAMS.map((item) => item.lines.join(''))).size, 64);
  for (const item of HEXAGRAMS) {
    assert.equal(item.lines.length, 6);
    assert.ok(item.lines.every((line) => line === 0 || line === 1));
    assert.ok(item.reading.image.trim());
    assert.ok(item.reading.foodCue.trim());
  }
});

test('trigram remainder order follows the documented plum-blossom sequence', () => {
  assert.deepEqual(TRIGRAMS.map(({ remainder, name, lines }) => [remainder, name, lines.join('')]), [
    [1, '乾', '111'], [2, '兑', '110'], [3, '离', '101'], [4, '震', '100'],
    [5, '巽', '011'], [6, '坎', '010'], [7, '艮', '001'], [8, '坤', '000'],
  ]);
});
```

**Step 2: Run the focused test to verify failure**

Run:

```bash
npm test -- --test-name-pattern="canonical hexagram|trigram remainder"
```

Expected: FAIL because exports do not yet exist.

**Step 3: Replace the old oracle map with canonical data**

Replace `oracleLines` / `FOOD_ORACLES` with these exported shapes in `assets/data.js`:

```js
export const TRIGRAMS = [
  { remainder: 1, name: '乾', symbol: '☰', element: '金', lines: [1, 1, 1] },
  { remainder: 2, name: '兑', symbol: '☱', element: '金', lines: [0, 1, 1] },
  // 离、震、巽、坎、艮
  { remainder: 8, name: '坤', symbol: '☷', element: '土', lines: [0, 0, 0] },
];

export const HEXAGRAMS = [
  {
    number: 1, name: '乾为天', upper: '乾', lower: '乾', lines: [1, 1, 1, 1, 1, 1],
    reading: { image: '六阳纯健，起势宜明，重在把握节奏。', foodCue: '餐签可取清楚完整的一餐，不必为选择反复拖延。' },
  },
  // Complete standard King Wen sequence through #64 未济; each row has the exact upper/lower pair,
  // bottom-to-top line vector, and distinct original image/foodCue text.
];
```

Use the canonical King Wen order and names, including `水雷屯` (#3), `地山谦` (#15), `坎为水` (#29), `离为火` (#30), `水火既济` (#63), and `火水未济` (#64). Derive `lines` by concatenating the referenced lower trigram first, then upper trigram. Do not hand-enter a contradictory line vector.

Every row must provide concise original Chinese `reading.image` and `reading.foodCue`; no copied large modern commentary, prediction wording, or duplicate placeholder text.

**Step 4: Run focused and full tests**

Run:

```bash
npm test -- --test-name-pattern="canonical hexagram|trigram remainder"
npm test
node --check assets/data.js
git diff --check
```

Expected: new data tests pass and all prior tests still pass.

**Step 5: Commit**

```bash
git add assets/data.js tests/recommendation.test.mjs
git commit -m "feat: add canonical hexagram data and readings"
```

---

## Task 2: 实现可测试的北京时间农历与数时合参算法

**Objective:** 新增纯函数，不依赖 DOM 或本机时区，稳定推导本卦、互卦、动爻、变卦和五行取象。

**Files:**
- Create: `assets/divination.js`
- Modify: `tests/recommendation.test.mjs`

**Step 1: Write failing algorithm tests**

Import new functions and add:

```js
test('plum-blossom remainder rules handle zero as 坤 and the sixth moving line', () => {
  assert.equal(trigramFromRemainder(0).name, '坤');
  assert.equal(trigramFromRemainder(8).name, '坤');
  assert.equal(normaliseMovingLine(0), 6);
});

test('deriveDivination produces the documented reproducible 谦 example', () => {
  const divination = deriveDivination(32, { lunarMonth: 5, lunarDay: 19, hourBranch: 7, lunarLabel: '五月十九', timeLabel: '北京时间 13:00 · 未时' });
  assert.equal(divination.primary.name, '地山谦');
  assert.equal(divination.primary.number, 15);
  assert.equal(divination.movingLine, 3);
  assert.equal(divination.changed.name, '坤为地');
  assert.equal(divination.changed.number, 2);
  assert.deepEqual(divination.primary.lines.filter((line, index) => line !== divination.changed.lines[index]), [1]);
});

test('mutual hexagram uses the inner second-to-fourth and third-to-fifth lines', () => {
  const result = deriveDivination(32, { lunarMonth: 5, lunarDay: 19, hourBranch: 7 });
  assert.deepEqual(result.mutual.lines, [0, 1, 0, 1, 0, 0]);
});

test('Beijing calendar parts use a fixed time zone instead of device local time', () => {
  const parts = beijingCalendarParts(new Date('2026-07-14T03:24:00Z'));
  assert.equal(parts.beijingHour, 11);
  assert.equal(parts.hourBranch, 6);
  assert.equal(parts.hourName, '巳');
  assert.ok(parts.lunarMonth >= 1 && parts.lunarMonth <= 12);
  assert.ok(parts.lunarDay >= 1 && parts.lunarDay <= 30);
});
```

**Step 2: Run focused tests to verify failure**

```bash
npm test -- --test-name-pattern="plum-blossom|deriveDivination|mutual hexagram|Beijing calendar"
```

Expected: FAIL because module/functions do not exist.

**Step 3: Implement `assets/divination.js`**

Implement and export:

```js
import { HEXAGRAMS, TRIGRAMS } from './data.js';

export function normaliseRemainder(value, modulus) {
  const remainder = ((Number(value) % modulus) + modulus) % modulus;
  return remainder === 0 ? modulus : remainder;
}

export function trigramFromRemainder(value) {
  return TRIGRAMS.find((item) => item.remainder === normaliseRemainder(value, 8));
}

export function normaliseMovingLine(value) { return normaliseRemainder(value, 6); }
export function hexagramForTrigrams(upper, lower) { /* find exact upper/lower row or throw */ }
export function hexagramForLines(lines) { /* find exact 6-bit row or throw */ }
export function deriveMutualHexagram(lines) { return hexagramForLines([...lines.slice(1, 4), ...lines.slice(2, 5)]); }
export function deriveChangedHexagram(lines, movingLine) { const changed = [...lines]; changed[movingLine - 1] = changed[movingLine - 1] ? 0 : 1; return hexagramForLines(changed); }
```

For calendar extraction:

```js
const TZ = 'Asia/Shanghai';
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

export function beijingCalendarParts(date = new Date()) {
  const numeric = new Intl.DateTimeFormat('en-US-u-ca-chinese', {
    timeZone: TZ, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  // Extract month/day/hour numeric parts; accept and record leap marker when supplied by ICU.
  // Separately get Chinese display parts with zh-Hans-CN-u-ca-chinese.
  // Throw a descriptive Error('当前浏览器不支持农历起卦') if numeric fields are absent/invalid.
}
```

`deriveDivination(reportNumber, calendar)` must validate `1..64`, calculate formulas exactly from the design spec, return `{ calendar, upper, lower, primary, mutual, movingLine, movingLineLabel, changed, elements, formula }`, and create a `transitionCue` dynamically from the actual moving line and changed hexagram without predictive language.

**Step 4: Run verification**

```bash
npm test -- --test-name-pattern="plum-blossom|deriveDivination|mutual hexagram|Beijing calendar"
npm test
node --check assets/divination.js
git diff --check
```

Expected: all new algorithm tests and existing tests pass.

**Step 5: Commit**

```bash
git add assets/divination.js tests/recommendation.test.mjs
git commit -m "feat: derive plum-blossom hexagrams from time and number"
```

---

## Task 3: 用真实卦签结构替换旧结果文案

**Objective:** 给结果区提供可访问、可逐爻渲染的本卦/变卦/解读/计算依据结构，并提供农历不支持状态。

**Files:**
- Modify: `index.html:76-110`
- Modify: `assets/app.js:1, 87-156, 235-310`

**Step 1: Create the semantic HTML structure**

Replace the old `oracle-title`, `oracle-line`-centric result area with stable IDs:

```html
<p id="calendar-context" class="calendar-context"></p>
<section class="hexagram-stage" aria-label="本次卦象">
  <figure class="hexagram-figure primary-hexagram">
    <figcaption><span id="primary-upper"></span><strong id="primary-name"></strong><span id="primary-lower"></span></figcaption>
    <div id="primary-lines" class="yao-stack" aria-label="本卦六爻"></div>
  </figure>
  <div class="hexagram-summary">
    <p><span>本卦</span><strong id="primary-meta"></strong></p>
    <p><span>互卦</span><strong id="mutual-meta"></strong></p>
    <p><span>动爻</span><strong id="moving-line-meta"></strong></p>
  </div>
  <figure class="hexagram-figure changed-hexagram">
    <figcaption>变卦 · <strong id="changed-meta"></strong></figcaption>
    <div id="changed-lines" class="yao-stack yao-stack-small" aria-label="变卦六爻"></div>
  </figure>
</section>
<section class="divination-reading" aria-labelledby="reading-title">
  <p class="eyebrow" id="reading-title">卦意简释</p>
  <p id="image-reading"></p>
  <p class="eyebrow">食候提示</p>
  <p id="food-cue"></p>
  <p id="transition-cue" class="transition-cue"></p>
</section>
<p id="formula-reading" class="formula-reading"></p>
<p class="divination-boundary">本卦用于餐签排序；餐食仍以餐别、地点与日常均衡规则为先。卦意为文化性简释，不替代《周易》原文与专业研究。</p>
```

Keep IDs required by current behavior: `number-input`, `random-number-button`, `cast-button`, `result-card`, `result-empty`, `result-content`, `result-title`, `meal-meta`, `meal-reason`, `confirm-button`, `retry-button`.

Add a compact `#calendar-status` near the report input, initially containing “按北京时间 · 农历时辰合参”。

**Step 2: Render divination before selecting a meal**

In `app.js`:

- replace `FOOD_ORACLES` import and `oracleFor*` use with `beijingCalendarParts` / `deriveDivination`;
- retain `contextualSeed` export for backwards compatibility, but add `divinationSeed(divination, context)` and use it in the call to `chooseMeal`;
- at cast start get one `now = new Date()`, one fixed calendar object and one `divination`; do not call `new Date()` separately for meal and result branches;
- catch unsupported-calendar errors, update `#calendar-status`, announce the problem and return without mutating selected meal;
- replace `showResult(oracle, meal, ordinal)` with `showResult(divination, meal, ordinal)`;
- create `renderYaoStack(container, lines, movingLine = null)` using only `document.createElement('i')`; apply `is-yang`/`is-yin`, `is-moving`, and a Chinese `aria-label` such as `第 3 爻，阳爻，动爻`;
- populate primary, mutual, changed, reading and formula IDs via `textContent`, never via `innerHTML`.

Use one formula string, for example:

```js
`数时合参：${reportNumber} + 农历${calendar.lunarLabel} + ${calendar.hourName}时；上卦取数月日，下卦取数时，动爻取合数余六。`
```

**Step 3: Verify static contract and behavior**

```bash
node --check assets/app.js
node -e "const h=require('fs').readFileSync('index.html','utf8'); for (const id of ['calendar-context','primary-lines','changed-lines','primary-meta','mutual-meta','moving-line-meta','image-reading','food-cue','transition-cue','formula-reading','result-title','confirm-button','retry-button']) if (!h.includes('id=\"'+id+'\"')) throw new Error(id); console.log('hexagram result contract present')"
npm test
git diff --check
```

Expected: static contract output and all tests pass.

**Step 4: Commit**

```bash
git add index.html assets/app.js
git commit -m "feat: render reproducible hexagram meal signatures"
```

---

## Task 4: 绘制六爻、五行取象与克制的显卦动效

**Objective:** 将真实本卦、动爻、变卦做成清晰、高级、移动端可读的卦签，取代空三横线和泛化结果视觉。

**Files:**
- Modify: `assets/style.css:298-430, 517-567`

**Step 1: Add real yao styles**

Add rules that derive the six-line image from generated nodes, rather than Unicode font glyphs:

```css
.yao-stack { display: grid; gap: 7px; width: min(100%, 13rem); }
.yao-stack i { position: relative; display: block; height: 4px; background: var(--paper-light); }
.yao-stack i.is-yin { background: linear-gradient(90deg, var(--paper-light) 0 42%, transparent 42% 58%, var(--paper-light) 58%); }
.yao-stack i.is-moving::before { position: absolute; left: -13px; top: 50%; width: 5px; height: 5px; border-radius: 50%; content: ''; background: var(--red-bright); transform: translateY(-50%); }
```

Because source lines are bottom-to-top, use `flex-direction: column-reverse` or reverse only the visual node order while preserving explicit aria labels. Do not accidentally show the bottom line at the top.

**Step 2: Add professional result layout**

- Desktop: primary hexagram / details / changed hexagram in a balanced 3-column composition, without the former giant empty center.
- Mobile: primary hexagram, metadata, changed hexagram, interpretation vertically; figures remain at least 44px apart from controls.
- Give upper/lower trigram and five-element marks a restrained bronze/vermilion accent; do not add a fake Qimen nine-palace grid.
- Make `divination-reading`, `formula-reading`, and `divination-boundary` distinctly readable but secondary to the meal title.
- Replace `.empty-lines` with a low-opacity six-line static `yao-stack` neutral preview or remove it entirely; no three-line placeholder remains.

**Step 3: Align the motion phases**

- Preserve app phase contract `count → ink → seal` and existing no-3D ink/seal character;
- During `ink`, `primary-lines i` reveal from visual bottom to top with six finite staggered `yao-write` animations (no infinite loop and no bar-loader appearance);
- During `seal`, add the red moving marker, fade in the changed figure and reveal `result-content` with existing opacity/`translateY(≤8px)` only;
- With `prefers-reduced-motion`, all yao and result states appear instantly.

**Step 4: Verify CSS quality**

```bash
node -e "const fs=require('fs'); const css=fs.readFileSync('assets/style.css','utf8'); let n=0; for(const c of css){if(c==='{')n++; if(c==='}')n--;} if(n) throw new Error('unbalanced CSS'); console.log('CSS braces balanced')"
rg 'empty-lines|finger-stage|rotateX|rotateY|ticket-settle|meal-ticket-reveal' index.html assets/style.css
npm test
node --check assets/app.js
git diff --check
```

Expected: no legacy finger/3D ritual hits; `empty-lines` only if deliberately replaced with an actual six-line neutral preview; all checks pass.

**Step 5: Commit**

```bash
git add assets/style.css
git commit -m "feat: visualize hexagrams and moving lines"
```

---

## Task 5: 更新使用说明、全量验收并发布

**Objective:** 让用户理解起法的可复算范围，并验证本地、公网、桌面与移动端都展示真实卦象。

**Files:**
- Modify: `README.md`
- Verify: `tests/recommendation.test.mjs`, `index.html`, `assets/app.js`, `assets/style.css`, public GitHub Pages URL

**Step 1: Update README**

Add a “数时合参起卦” section with:

- Beijing time + Chinese lunar calendar requirement;
- exact three formulas and zero-remainder conventions;
- 8-trigram order;
- body/mutual/changed definition;
- statement that the feature uses cultural/entertainment interpretation and does not make medical/fortune claims;
- explanation that a modern browser supporting `Intl` Chinese calendar is required.

**Step 2: Full local verification**

```bash
npm test
node --check assets/app.js
node --check assets/divination.js
node --check assets/data.js
git diff --check
git status --short --branch
```

Expected: all tests pass, syntax checks are silent, no unintended files staged.

**Step 3: Browser acceptance**

Serve the project and use Chrome:

```bash
python -m http.server 4173 --bind 127.0.0.1
```

At 1440×900 and 375×812 verify:

1. initial page says it uses Beijing time and contains a six-line, not three-line, neutral state;
2. with a deterministic test harness/calendar `{ lunarMonth: 5, lunarDay: 19, hourBranch: 7 }` and report number 32, primary is 地山谦 #15, moving line is 三, changed is 坤为地 #2;
3. actual click shows `ink` at roughly 300ms with six yao visible but result details locked, and `seal` at roughly 850ms with changed hexagram/result visible;
4. changing report number causes a visibly different primary or moving/changed result under the same fixed time;
5. repeat with same number/time returns identical details;
6. no desktop/mobile horizontal overflow; action buttons remain usable; menu and food log still work;
7. emulate `prefers-reduced-motion: reduce` and verify immediate full result;
8. console has no JavaScript errors.

**Step 4: Publish and public acceptance**

```bash
git add README.md
git commit -m "docs: explain plum-blossom meal casting"
git push origin master
gh run list --repo whz211417/yi-shi-gua --limit 1
gh run watch <new-run-id> --repo whz211417/yi-shi-gua --exit-status
```

Then open `https://whz211417.github.io/yi-shi-gua/`, conduct one actual cast, and verify canonical hexagram fields, no old generic oracle-only field, no console errors, and no horizontal overflow.
