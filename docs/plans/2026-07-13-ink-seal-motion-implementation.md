# 墨环落印动效 Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 将“掐指一算”的六爻加载式动效替换为克制的“墨环收束—朱砂落印—餐签显现”仪式，同时保持推荐、菜单、本地存储和降动效行为不变。

**Architecture:** 在结果卡内部加入两个纯装饰节点：未闭合墨环和“食”字朱砂印。`assets/app.js` 仅保留 `count → ink → seal` 三个可检查阶段；CSS 根据阶段负责所有视觉变化。现有 `showResult()` 仍是结果唯一写入点，在 `seal` 阶段调用。

**Tech Stack:** 原生 HTML、CSS 动画、ES Modules、Node 内置测试、Chrome / agent-browser。

---

### Task 1: 用语义化装饰节点替换六爻舞台

**Objective:** 移除用户可见的六爻加载元素，为结果卡提供不会影响读屏的墨环和印章节点。

**Files:**
- Modify: `index.html:80-107`
- Test: Chrome DOM/无障碍快照（无纯函数单测；本任务只改静态结构）

**Step 1: 记录当前结构契约**

确认以下 ID 仍存在且不改名：`number-input`、`random-number-button`、`cast-button`、`result-card`、`result-empty`、`result-content`、`confirm-button`、`retry-button`。

Run:

```bash
node -e "const fs=require('fs'); const h=fs.readFileSync('index.html','utf8'); for (const id of ['number-input','random-number-button','cast-button','result-card','result-empty','result-content','confirm-button','retry-button']) if (!h.includes(`id=\"${id}\"`)) throw new Error(id); console.log('structure contract present')"
```

Expected: `structure contract present`.

**Step 2: Replace the old decorative stage**

Delete only this old visual node:

```html
<div class="finger-stage" aria-hidden="true"><i></i><i class="broken"></i><i></i><i class="broken"></i><i class="broken"></i><i></i></div>
```

Immediately after the `result-card` opening tag, add:

```html
<div class="ink-ritual" aria-hidden="true">
  <span class="ink-ring"></span>
  <span class="seal-mark">食</span>
</div>
```

Do not change the existing `aria-live` on `#result-card`, result text IDs, buttons, or form controls.

**Step 3: Verify static structure**

Run the Step 1 command and:

```bash
node --check assets/app.js
```

Expected: both succeed.

**Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add ink-seal ritual structure"
```

---

### Task 2: Replace the timed state sequence without changing recommendation behavior

**Objective:** Replace `finger` with `ink`, retain timer cleanup and button locking, and make `showResult()` occur at the beginning of the `seal` phase.

**Files:**
- Modify: `assets/app.js:217-309`
- Test: `tests/recommendation.test.mjs` (regression suite; no new export is needed because this change is DOM-only)

**Step 1: Run existing logic regression suite first**

Run:

```bash
npm test
```

Expected: 21 passing tests before code changes.

**Step 2: Remove finger-stage references safely**

Change DOM lookup and cast element list from:

```js
const retryButton = $('#retry-button'); const confirmButton = $('#confirm-button'); const resultCard = $('#result-card'); const fingerStage = $('.finger-stage');
// ...
const castElements = [resultCard, fingerStage, numberInput, castButton].filter(Boolean);
```

to:

```js
const retryButton = $('#retry-button'); const confirmButton = $('#confirm-button'); const resultCard = $('#result-card');
// ...
const castElements = [resultCard, numberInput, castButton].filter(Boolean);
```

**Step 3: Implement the new timing sequence**

Within `cast()`, retain recommendation selection and reduced-motion branch. Replace the normal-motion timers with exactly:

```js
startCasting();
scheduleCastPhase('ink', 180);
castTimers.push(window.setTimeout(() => {
  if (!casting) return;
  setCastPhase('seal');
  reveal();
}, 760));
castTimers.push(window.setTimeout(finishCasting, 1040));
```

Do not change `contextualSeed`, `chooseMeal`, `oracleForContext`, `persist`, `confirmMeal`, `finishCasting`, or the public exports.

**Step 4: Verify logic and syntax**

Run:

```bash
npm test
node --check assets/app.js
node --check assets/data.js
git diff --check
```

Expected: all commands succeed; test suite remains 21/21 passing.

**Step 5: Commit**

```bash
git add assets/app.js
git commit -m "feat: use ink-seal casting phases"
```

---

### Task 3: Implement the ink-ring / seal visual system and remove legacy motion

**Objective:** Create a non-rotating, finite CSS motion sequence that reads as brushwork and a physical seal rather than a loading indicator or card flip.

**Files:**
- Modify: `assets/style.css:268-442`
- Test: Chrome desktop/mobile visual and interaction checks

**Step 1: Remove legacy selectors and keyframes**

Remove or replace all visual rules specific to:

- `.finger-stage` and `.finger-stage i`;
- `data-cast-phase="finger"`;
- `ticket-settle`;
- `meal-ticket-reveal`;
- old line-mask usage in `.result-card::after` when it represents the six-line motif.

Keep the existing general result-card surface, typography, focus styles and `.result-card.is-revealing` fallback animation unless a new rule intentionally supersedes it.

**Step 2: Add finite ritual styling**

Use `.ink-ritual` as an absolute, pointer-events-none layer below textual result content and above result-card background. Requirements:

- `.ink-ring` is a non-uniform, open elliptical border/gradient at card center; no `infinite` animation and no `rotate()` animation loop;
- `count` applies only a short vermilion input/button press treatment;
- `ink` reveals the ring with opacity/scale/blur settling from 180–760ms;
- `seal` reveals `.seal-mark` with a maximum `translateY(-8px)` and subtle scale compression; it uses `content` text `食` from markup;
- in `seal`, `.result-content` only uses opacity + `translateY(8px)` to settle; it must not use 3D `perspective`, `rotateX`, or `rotateY`;
- after `finishCasting`, the ring remains only as a low-opacity static texture and the seal is visually quiet;
- set explicit `z-index` values so neither ornament can cover controls or text.

A representative CSS shape:

```css
.ink-ritual { position:absolute; inset:0; z-index:0; pointer-events:none; }
.ink-ring { position:absolute; left:50%; top:52%; width:min(58vw,250px); aspect-ratio:1.22; border:3px solid rgb(216 196 139 / .55); border-left-color:transparent; border-radius:50%; opacity:0; transform:translate(-50%,-50%) scale(.82); }
.seal-mark { position:absolute; left:50%; top:50%; display:grid; width:48px; aspect-ratio:1; place-items:center; border:1px solid var(--red-bright); color:#e5a293; opacity:0; transform:translate(-50%,calc(-50% - 8px)) scale(.94) rotate(-6deg); }
```

Tune exact colors and gradients to match existing CSS tokens; do not introduce external assets.

**Step 3: Implement reduced-motion visual fallback**

Inside existing `@media (prefers-reduced-motion: reduce)`, force any ink-ring/seal/reveal animation to one near-instant frame and ensure the static result text remains fully visible. Do not make a reduced-motion user wait for timers; this is already handled by Task 2 JavaScript.

**Step 4: Verify static style constraints**

Run:

```bash
node --check assets/app.js
npm test
git diff --check
```

Then confirm no legacy selector remains:

```bash
rg 'finger-stage|ticket-settle|meal-ticket-reveal|rotateX|rotateY' assets/style.css index.html
```

Expected: command returns no legacy animation matches (other unrelated occurrences should be reviewed, not blindly deleted).

**Step 5: Commit**

```bash
git add assets/style.css
git commit -m "feat: style ink-seal ritual reveal"
```

---

### Task 4: Browser verification, regression review, and publish

**Objective:** Verify the exact animation timeline and public-site behavior, then push the implementation to GitHub Pages.

**Files:**
- Modify: none unless a verified bug requires a focused follow-up fix
- Verify: `https://whz211417.github.io/yi-shi-gua/`

**Step 1: Run an end-to-end timeline probe locally**

Serve the repository:

```bash
python -m http.server 4173 --bind 127.0.0.1
```

In Chrome/agent-browser, trigger `#cast-button` and resolve delayed snapshots in one evaluation. Assert:

```js
{
  at300: { phase: 'ink', casting: true, resultVisible: false, castDisabled: true, retryDisabled: true, confirmDisabled: true },
  at850: { phase: 'seal', casting: true, resultVisible: true },
  at1200: { phase: null, casting: false, resultVisible: true, castDisabled: false, retryDisabled: false, confirmDisabled: false }
}
```

Allow a small scheduling tolerance (±100ms) but do not accept a missing phase, visible result before `seal`, or still-disabled controls after completion.

**Step 2: Check desktop and mobile visual behavior**

At 1440×900 and 375×812:

- assert `document.documentElement.scrollWidth <= window.innerWidth`;
- inspect the center of the result card during `ink` and `seal`;
- verify the ink ring and seal do not obscure result title or buttons;
- ensure no six-line glyph, large spin, 3D flip, particles, or continuous animation remains;
- open/close the menu drawer and confirm its sticky close control still works.

**Step 3: Check reduced-motion JavaScript branch**

In a trusted local test context, temporarily make `matchMedia('(prefers-reduced-motion: reduce)')` return `matches: true`, trigger a cast, and assert the result becomes visible synchronously without a cast phase. Restore the original `matchMedia` after the test. State clearly in reporting that this proves the JS branch, not native media emulation.

**Step 4: Run final checks and push**

```bash
npm test
node --check assets/app.js
node --check assets/data.js
git diff --check
git status --short --branch
git push origin master
```

Expected: 21/21 tests passing, syntax and diff checks pass, only intended source changes committed, and `master` is pushed.

**Step 5: Verify published site**

Wait for GitHub Pages build completion, open `https://whz211417.github.io/yi-shi-gua/`, repeat the primary click flow, and check browser console for zero JavaScript errors.

**Step 6: Commit any focused follow-up fix**

If and only if verification finds a real defect, write the smallest correction, rerun all Task 4 checks, then:

```bash
git add <intended-files>
git commit -m "fix: polish ink-seal ritual motion"
git push origin master
```
