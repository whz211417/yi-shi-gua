# 易食卦 Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build an offline, single-page “易食卦” web application that recommends a breakfast, lunch, or dinner through an I Ching-inspired reveal while prioritizing meal variety and everyday balance.

**Architecture:** The app is dependency-free and runs from `index.html`. `data.js` provides editable starter meals and divination copy, `app.js` owns local persistence, selection scoring, state transitions, and DOM rendering, and `styles.css` provides the responsive black-and-white visual system. A Node test file validates recommendation and persistence-adjacent pure functions without a browser.

**Tech Stack:** HTML5, CSS3, browser localStorage, vanilla JavaScript, Node.js built-in test runner.

---

### Task 1: Establish the static app shell and local test harness

**Objective:** Create the runnable file structure and verify the test runner can execute a placeholder test.

**Files:**
- Create: `index.html`
- Create: `assets/styles.css`
- Create: `assets/data.js`
- Create: `assets/app.js`
- Create: `tests/recommendation.test.mjs`
- Create: `package.json`

**Step 1: Write the failing test**

Create `tests/recommendation.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseMeal } from '../assets/app.js';

test('chooseMeal returns a candidate meal', () => {
  assert.equal(typeof chooseMeal, 'function');
});
```

**Step 2: Run test to verify failure**

Run: `node --test tests/recommendation.test.mjs`

Expected: FAIL because `assets/app.js` does not export `chooseMeal` yet.

**Step 3: Create minimal app and export surface**

- Add an ES-module script tag in `index.html`.
- Add `"type": "module"` and `"test": "node --test tests/*.test.mjs"` in `package.json`.
- Export a placeholder `chooseMeal` in `assets/app.js` until Task 3 implements it.

**Step 4: Run test to verify pass**

Run: `npm test`

Expected: PASS.

**Step 5: Commit**

```bash
git add index.html package.json assets tests
git commit -m "chore: scaffold Yi Shi Gua static app"
```

### Task 2: Add seed menu data and the 64-number food-divination map

**Objective:** Provide a realistic, editable initial menu bank and safe entertainment copy.

**Files:**
- Modify: `assets/data.js`
- Modify: `tests/recommendation.test.mjs`

**Step 1: Write the failing test**

```js
import { STARTER_MEALS, FOOD_ORACLES } from '../assets/data.js';

test('starter menu covers all meal periods and both venue types', () => {
  assert.ok(STARTER_MEALS.some((meal) => meal.meals.includes('早餐')));
  assert.ok(STARTER_MEALS.some((meal) => meal.meals.includes('午餐')));
  assert.ok(STARTER_MEALS.some((meal) => meal.source === '食堂'));
  assert.ok(STARTER_MEALS.some((meal) => meal.source === '校外'));
});

test('food oracle map has 64 entries', () => {
  assert.equal(FOOD_ORACLES.length, 64);
});
```

**Step 2: Run test to verify failure**

Run: `npm test`

Expected: FAIL because seed exports are missing.

**Step 3: Implement starter data**

- Define 24-36 starter meals using the required tags: `name`, `source`, `venue`, `meals`, `staple`, `protein`, `vegetable`, `flavor`, `enabled`.
- Define 64 compact oracle records with `title`, `line`, and a non-deterministic entertainment disclaimer-friendly tone.
- Do not claim fortune-telling accuracy or medical nutrition outcomes.

**Step 4: Run tests to verify pass**

Run: `npm test`

Expected: PASS.

**Step 5: Commit**

```bash
git add assets/data.js tests/recommendation.test.mjs
git commit -m "feat: add meal bank and food oracle data"
```

### Task 3: Implement deterministic candidate scoring and selection

**Objective:** Choose a valid meal that avoids recent repetition and provides a transparent practical reason.

**Files:**
- Modify: `assets/app.js`
- Modify: `tests/recommendation.test.mjs`

**Step 1: Write failing tests**

```js
test('chooseMeal avoids the immediately repeated meal when alternatives exist', () => {
  const meals = [
    { id: 'rice-chicken', name: '鸡腿饭', meals: ['午餐'], source: '食堂', staple: '米饭', protein: '鸡肉', vegetable: '有', flavor: '普通', enabled: true },
    { id: 'beef-noodle', name: '牛肉粉', meals: ['午餐'], source: '校外', staple: '粉类', protein: '牛肉', vegetable: '少', flavor: '汤类', enabled: true },
  ];
  const result = chooseMeal({ meals, mealPeriod: '午餐', place: '不限', recent: [{ mealId: 'rice-chicken', staple: '米饭', protein: '鸡肉' }], seed: 12, rejectedIds: [] });
  assert.equal(result.meal.id, 'beef-noodle');
});

test('chooseMeal favors vegetables after a vegetable-free recorded meal', () => {
  // Use a fixed seed and candidates that differ only by vegetable tag.
  // Assert the candidate tagged "有" wins the score.
});
```

**Step 2: Run tests to verify failure**

Run: `npm test`

Expected: FAIL because scoring is not implemented.

**Step 3: Implement pure functions**

Implement and export:

```js
export function scoreMeal(meal, context) { /* number */ }
export function chooseMeal(context) { /* { meal, score, reason, relaxed } */ }
export function oracleFor(seed, dateKey, mealPeriod) { /* oracle record */ }
```

Rules:

- Exclude disabled meals, wrong meal periods, wrong source when place is `在学校` or `校外`, and current rejected IDs.
- Strongly penalize identical recent meal, staple, and protein among the previous two records.
- Apply a smaller penalty to recently used venue and flavor among the latest several records.
- Reward vegetables after a vegetable-poor current-day record, variety of protein, and lighter choices after fried/heavy selections.
- If filtering empties the candidate set, retry with repetition constraints softened and set `relaxed: true`.
- Use a seeded tie-breaker so the same selection state gives stable results while different report numbers alter results.

**Step 4: Run tests to verify pass**

Run: `npm test`

Expected: PASS.

**Step 5: Commit**

```bash
git add assets/app.js tests/recommendation.test.mjs
git commit -m "feat: add balanced meal recommendation logic"
```

### Task 4: Build the black-and-white divination interface

**Objective:** Render a complete, responsive home screen and result card.

**Files:**
- Modify: `index.html`
- Modify: `assets/styles.css`
- Modify: `assets/app.js`

**Step 1: Define DOM acceptance checks before implementation**

Use a browser console inspection after implementation and require these stable selectors:

```js
['#meal-period', '#place', '#weather', '#number-input', '#cast-button', '#result-card', '#confirm-button', '#retry-button']
  .every((selector) => document.querySelector(selector));
```

Expected: `true`.

**Step 2: Implement semantic markup**

- Create labeled controls for meal period, place, weather, and 1-64 input.
- Include an accessible random-number button.
- Add a main cast button, a hidden/loading result card, and an accessible live result region.
- Add a three-slot “今日食录” summary that can render empty states.
- Add plain-language entertainment and nutrition limitations.

**Step 3: Implement visual system**

- Use a fixed deep black, warm-gray, and off-white palette, with restrained vermilion accent only for actions and seals.
- Build divination-line artwork from CSS, not external image assets.
- Use a non-symmetrical receipt/card layout and subtle paper texture.
- Use `min-height: 100dvh`, responsive max width, ≥44px touch targets, visible focus styles, and `prefers-reduced-motion` fallback.
- Avoid network fonts, image dependencies, and generic spin-wheel visuals.

**Step 4: Wire the cast interaction**

- Validate and normalize input number to the 1-64 range.
- Call `chooseMeal` and `oracleFor` with current selection state.
- Add a short class-driven reveal transition, then show the meal, oracle text, and practical recommendation reason.
- “再起一卦” adds the shown meal to the temporary rejection set; “就吃这个” is wired in Task 5.

**Step 5: Verify manually in browser**

- Open `index.html` using a local static server.
- Verify controls exist, input is keyboard reachable, dark visual system renders, and a result card appears after casting.
- Check a narrow mobile viewport and a desktop viewport.

**Step 6: Commit**

```bash
git add index.html assets/styles.css assets/app.js
git commit -m "feat: build divination meal selection interface"
```

### Task 5: Add local persistence, daily record and menu management

**Objective:** Make meals, history, and user customization survive reloads.

**Files:**
- Modify: `assets/app.js`
- Modify: `index.html`
- Modify: `assets/styles.css`
- Modify: `tests/recommendation.test.mjs`

**Step 1: Write failing tests for pure persistence helpers**

```js
test('normaliseMenu restores usable defaults for malformed saved data', () => {
  assert.ok(normaliseMenu(null).length > 0);
  assert.ok(normaliseMenu([{ name: '' }]).length > 0);
});
```

**Step 2: Run test to verify failure**

Run: `npm test`

Expected: FAIL because `normaliseMenu` does not exist.

**Step 3: Implement state helpers and local storage boundaries**

Implement exported pure functions plus thin browser-only wrappers:

```js
export function normaliseMenu(value) { /* valid editable menu */ }
export function todayKey(date = new Date()) { /* YYYY-MM-DD */ }
function loadState() { /* localStorage guarded by try/catch */ }
function saveState(state) { /* localStorage guarded by try/catch */ }
```

Persist:

- editable menu list;
- confirmed meal records with date and tags;
- temporary preferences only where needed.

**Step 4: Implement record confirmation and undo**

- “就吃这个” writes or replaces the current meal-period record for today.
- Render the confirmed meal in 今日食录.
- Add an undo/delete action with an accessible label.
- Ensure later casts use confirmed records as recent history.

**Step 5: Implement menu drawer or panel**

- Add menu management entry point.
- Render editable meal rows with add, edit, enable/disable, and delete actions.
- Use fields corresponding to the data model rather than free-form opaque text.
- Add reset-to-starter-menu with an explicit confirmation step.

**Step 6: Run tests and browser checks**

Run: `npm test`

Manual browser check: add a meal, reload, confirm it remains; confirm a recommendation, reload, verify it remains in today’s record; then undo it.

**Step 7: Commit**

```bash
git add index.html assets/app.js assets/styles.css tests/recommendation.test.mjs
git commit -m "feat: persist meal history and custom menu"
```

### Task 6: Complete quality checks and project documentation

**Objective:** Verify all acceptance criteria and document operation.

**Files:**
- Create: `README.md`
- Modify: `assets/app.js` if verification exposes defects
- Modify: `assets/styles.css` if viewport or motion verification exposes defects

**Step 1: Run automated tests**

Run: `npm test`

Expected: all tests PASS.

**Step 2: Perform static checks**

Run:

```bash
node --check assets/app.js
node --check assets/data.js
```

Expected: no syntax output and exit status 0.

**Step 3: Verify browser behavior**

- Serve with `python -m http.server 8000` in the project root.
- Open `http://localhost:8000`.
- Test cast, retry, confirm, undo, add/edit/disable/reset custom menu flows.
- Inspect 375px-wide and desktop layouts for no horizontal overflow.
- Verify reduced motion with the browser media emulation if available.
- Reload after each persisted interaction.

**Step 4: Write README**

Document:

- How to open/run locally;
- How the recommendation logic handles repetition and balance;
- How to customize and reset meals;
- The entertainment-only nature of the divination presentation;
- The local-only data storage behavior.

**Step 5: Commit**

```bash
git add README.md assets
# add any verification fixes
git commit -m "docs: add Yi Shi Gua usage guide"
```
