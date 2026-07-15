# 食单目录重构实施计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 修复旧菜单无法看到世界料理的问题，将食单重构为严格范围隔离的完整菜系目录与紧凑餐品名单，并把默认模板扩展至至少 450 项。

**Architecture:** 先扩展权威 taxonomy 与模板数据，提供纯函数化的范围、目录、迁移和展示模型。随后将持久化菜单从“旧菜单即全部菜单”改为“旧菜单合并当前默认目录”，保留用户记录。最后替换菜单抽屉 DOM/CSS 与事件绑定，使用范围标签、菜系目录和名单行，编辑表单改为按需打开的独立编辑面板。

**Tech Stack:** 依赖现有 ES Modules、原生 DOM、原生 CSS、Node `node:test`、localStorage、GitHub Pages。

---

## Task 1: 扩展权威 taxonomy 到每菜系至少 11 至 12 个具体菜品

**Objective:** 用真实、明确、可解释的菜名扩充 39 个菜系，保证每个菜系至少有三类有意义的大类。

**Files:**
- Modify: `assets/cuisine-catalog.js:2-58`
- Modify: `tests/recommendation.test.mjs`

**Step 1: Write failing coverage tests**

添加按菜系统计的断言。中国菜每个 cuisine 至少 12 个 distinct `dishType`，世界料理每个 cuisine 至少 11 个；每个 cuisine 至少覆盖 3 个 `courseFamily`。同时断言中国菜正好 21 类、世界料理合计正好 18 类。

```js
const paths = taxonomyPaths(DEFAULT_CUISINE_TAXONOMY);
for (const cuisine of chineseCuisines) {
  assert.ok(paths.filter((path) => path.cuisine === cuisine).length >= 12);
  assert.ok(new Set(paths.filter((path) => path.cuisine === cuisine).map((path) => path.courseFamily)).size >= 3);
}
```

**Step 2: Run focused test and verify failure**

Run: `npm test -- --test-name-pattern='taxonomy cuisine coverage'`

Expected: FAIL because current paths provide roughly 6 to 10 dishes per cuisine.

**Step 3: Expand taxonomy data only**

补入具体餐品，绝不复制路径或用“模板一/模板二”凑数。例如川菜扩充鱼香肉丝、辣子鸡、水煮牛肉、夫妻肺片、酸辣汤等，并将它们放到热菜、凉菜、汤羹等真实大类。对每一菜系重复这一原则。

世界料理须保留单独的菜系键，例如“日料”“韩餐”，而不是将“日料 / 韩餐”作为一个可选菜系。

**Step 4: Verify pass and integrity**

Run:

```bash
npm test -- --test-name-pattern='taxonomy cuisine coverage|cuisine taxonomy'
node --check assets/cuisine-catalog.js
git diff --check
```

Expected: focused tests pass；无语法或空白错误。

**Step 5: Commit**

```bash
git add assets/cuisine-catalog.js tests/recommendation.test.mjs
git commit -m "feat: enrich cuisine taxonomy coverage"
```

---

## Task 2: 从扩展 taxonomy 生成至少 450 项稳定模板

**Objective:** 让模板数量、启用默认值、稳定 ID 和语义元数据随扩展 taxonomy 正确生成。

**Files:**
- Modify: `assets/meal-templates.js:1-150`
- Modify: `tests/recommendation.test.mjs`

**Step 1: Write failing data tests**

断言 `MEAL_TEMPLATES.length >= 450`；中国菜至少 252 项且全部初始启用；世界料理至少 198 项且全部初始停用。逐菜系验证条目数量与 taxonomy 一致，所有 ID/名称唯一、路径有效、没有共享 `meals` 数组。

**Step 2: Run focused test and verify failure**

Run: `npm test -- --test-name-pattern='layered meal template catalog'`

Expected: FAIL with current 228 项目录。

**Step 3: Keep builders stable and dish-aware**

继续使用 `stableId(path, variant)`，禁止按遍历位置分配 ID。调整 `BREAKFAST_DISH_TYPES`、`SUPPLEMENT_DISH_TYPES` 及关键词识别，只添加能由菜名和小类解释的元数据。补充品仍不得进入 `chooseMeal` 的独立推荐。

不要为了强行达到数量增加任意“配饭模板”；优先由新增真实 `dishType` 自然生成模板。只有早餐/套餐确有独立意义时才保留显式 variant，且 key 语义稳定。

**Step 4: Verify pass**

Run:

```bash
npm test -- --test-name-pattern='layered meal template catalog|supplement templates|starter menu'
node --check assets/meal-templates.js
git diff --check
```

**Step 5: Commit**

```bash
git add assets/meal-templates.js tests/recommendation.test.mjs
git commit -m "feat: expand layered meal catalog"
```

---

## Task 3: 实现版本化默认目录合并迁移

**Objective:** 已保存的 81 项菜单也能无损获得新默认目录和世界料理，且刷新不重复注入。

**Files:**
- Modify: `assets/app.js:6-128,230-247`
- Modify: `tests/recommendation.test.mjs`

**Step 1: Write failing migration tests**

创建内存 storage 与完整旧 81 项格式的有效菜单样本。断言 `loadStoredState(storage)`：

- 保留旧餐品的 `enabled` 和用户改过的字段；
- 补齐默认模板，并能找到世界料理；
- 自定义餐品保留；
- 第二次 load/save/load 后模板 ID 不重复；
- recordsByDate 不变；
- 新模板版本升级时只补新增默认模板，不重新覆盖用户状态。

**Step 2: Run focused test and verify failure**

Run: `npm test -- --test-name-pattern='catalog migration'`

Expected: FAIL because当前 `loadStoredState()` 只返回已保存菜单。

**Step 3: Add explicit catalog migration boundary**

引入一个不改变 `STORAGE_KEY` 的持久化 `catalogVersion` 字段，并实现可导出的纯函数，例如：

```js
export function mergeDefaultCatalog(savedMenu, defaults = STARTER_MEALS) {
  // clone defaults; map saved records by stable id and normalized dish identity;
  // retain user records; merge mutable user fields; append missing defaults once.
}
```

`loadStoredState()` 对有效旧菜单调用合并，`saveStoredState()` 写入当前目录版本。只有默认模板被识别为同一道餐品时才能传递旧的启用状态；无法匹配的旧餐品作为自定义项保留。不得删除食录。

**Step 4: Verify pass**

Run:

```bash
npm test -- --test-name-pattern='catalog migration|persistence|normaliseMenu'
node --check assets/app.js
git diff --check
```

**Step 5: Commit**

```bash
git add assets/app.js tests/recommendation.test.mjs
git commit -m "fix: merge expanded catalog into saved menus"
```

---

## Task 4: 建立严格范围和菜系目录纯函数

**Objective:** 将“中国菜”“世界料理”“我的启用”定义为严格范围，而不是把世界料理硬塞进 `menuFilters.zone`。

**Files:**
- Modify: `assets/cuisine-catalog.js:142-201`
- Modify: `tests/recommendation.test.mjs`

**Step 1: Write failing tests**

新增 `scopeCuisineCatalog(meals, scope)` 或等价纯函数测试：

- `中国菜` 返回且只返回 `cuisineZone === '中国菜'` 的 21 个 cuisine；
- `世界料理` 返回且只返回 `cuisineZone !== '中国菜'` 的 18 个 cuisine；
- `我的启用` 仅保留 `enabled === true`，可同时包含两种范围；
- 每个目录项的 count 与同一范围下的过滤结果相同；
- 不变异输入。

**Step 2: Run focused test and verify failure**

Run: `npm test -- --test-name-pattern='catalog scope'`

**Step 3: Implement scope model**

在 `cuisine-catalog.js` 增加 `MENU_SCOPES`、`scopeMeals`、`cuisineDirectory` 等纯函数。范围名称是 UI 概念，不能假装等同 `cuisineZone`。世界料理应根据 `cuisineZone !== '中国菜'` 聚合，但目录项始终是单个 `cuisine`，例如“日料”和“韩餐”分别显示。

**Step 4: Verify pass and commit**

```bash
npm test -- --test-name-pattern='catalog scope|cuisine options'
git add assets/cuisine-catalog.js tests/recommendation.test.mjs
git commit -m "feat: add strict cuisine catalog scopes"
```

---

## Task 5: 用目录与紧凑名单替换当前筛选表单骨架

**Objective:** 将现有范围单选和菜系下拉替换为顶部 scope tabs、目录列表和紧凑餐品名单的语义 DOM。

**Files:**
- Modify: `index.html:160-190`
- Modify: `assets/style.css` menu panel selectors
- Modify: `tests/recommendation.test.mjs`

**Step 1: Write static contract test**

断言菜单抽屉包含：

- `#menu-scope-tabs`，三个按钮为中国菜、世界料理、我的启用；
- `#cuisine-directory`；
- `#menu-list`；
- 搜索、大类、餐别、只看已启用、清除；
- `#meal-editor-panel[hidden]`；
- 不再包含旧 `#menu-filter-zone` 单选组或主列表内 `.menu-control` 编辑表单。

**Step 2: Run focused test and verify failure**

Run: `npm test -- --test-name-pattern='directory menu static contract'`

**Step 3: Change HTML and CSS**

结构示例：

```html
<nav id="menu-scope-tabs" aria-label="食单范围">
  <button type="button" data-menu-scope="中国菜">中国菜</button>
  <button type="button" data-menu-scope="世界料理">世界料理</button>
  <button type="button" data-menu-scope="我的启用">我的启用</button>
</nav>
<div class="menu-catalog-layout">
  <nav id="cuisine-directory" aria-label="菜系目录"></nav>
  <section class="menu-catalog-results">
    <div id="menu-list" class="menu-list" aria-live="polite"></div>
  </section>
</div>
<aside id="meal-editor-panel" hidden aria-label="编辑餐品"></aside>
```

CSS 必须让桌面目录固定而非独立滚动条占满视窗；窄屏将目录改为分组可横向滚动标签或可折叠分组。名单行使用清晰的启用按钮、菜名、元信息和编辑按钮。禁止恢复大卡片和逐行完整输入表单。

**Step 4: Verify static and responsive structure**

Run:

```bash
npm test -- --test-name-pattern='directory menu static contract'
git diff --check
```

**Step 5: Commit**

```bash
git add index.html assets/style.css tests/recommendation.test.mjs
git commit -m "feat: add cuisine directory menu layout"
```

---

## Task 6: 接入目录、紧凑名单、启用开关与按需编辑抽屉

**Objective:** 让新的 UI 实际操控 `state.menu` 并保留原有编辑能力。

**Files:**
- Modify: `assets/app.js:24-55,274-329,474-532`
- Modify: `tests/recommendation.test.mjs`

**Step 1: Write reducer tests**

替换旧 `initialMenuFilters`/`reduceMenuFilters` 的范围动作，测试：

- scope 变更时清空 cuisine/family/search；
- 选择目录 cuisine 时仅改变当前名单；
- 世界料理 scope 的目录没有中国菜；
- 中国菜 scope 的目录没有世界料理；
- 按大类、餐别、搜索、已启用叠加过滤；
- 切换启用状态后马上影响“我的启用”和后续 `chooseMeal`；
- 编辑抽屉保存后保持 taxonomy 和启用状态。

**Step 2: Run focused tests and verify failure**

Run: `npm test -- --test-name-pattern='directory scope|menu reducer|catalog migration'`

**Step 3: Implement DOM behavior using safe APIs**

- `renderMenu()` 先调用 `scopeMeals()`，再构建 `#cuisine-directory`；
- 目录按钮由 `document.createElement('button')` 创建，不使用 `innerHTML`；
- 当前 scope/cuisine 的激活状态使用 `aria-current` 或 `aria-pressed`；
- 菜单行只渲染启用切换、菜名、元信息、编辑按钮；
- “编辑”打开 `#meal-editor-panel`，在里面复用或迁移现有表单字段；保存后调用 `normaliseCuisineFields`、`persist()`、`renderMenu()`；
- 菜单行的名称按钮和编辑按钮都应有键盘可用行为；
- 空状态提供“清除筛选”与“返回该范围全部菜系”动作。

**Step 4: Verify pass and commit**

```bash
npm test
node --check assets/app.js
git diff --check
git add assets/app.js tests/recommendation.test.mjs
git commit -m "feat: browse meals through cuisine directories"
```

---

## Task 7: 浏览器回归与发布

**Objective:** 验证旧菜单迁移、目录范围隔离、响应式、推荐资格和公开 Pages。

**Files:**
- No source changes expected; only fix verified defects in focused commits.

**Step 1: Local browser migration check**

在浏览器 localStorage 注入有效的旧 81 项菜单 fixture，刷新后确认：

- 目录总数达到扩容后默认数量或以上；
- 中国菜 scope 无世界料理目录项；
- 世界料理 scope 有完整 18 个独立菜系；
- 用户已有餐品和食录未消失。

**Step 2: Functional browser check**

桌面 1440px 宽度依次验证中国菜、世界料理、我的启用、一个菜系、全文搜索、大类、餐别、已启用开关和编辑抽屉。确认启用一个世界菜后，调用/触发起卦可将其加入候选；未启用时不入选。检查 console 0 errors 与 `scrollWidth <= clientWidth`。

**Step 3: Narrow viewport check**

在 375px 宽 iframe 或真实窄视窗验证目录切换、名单、编辑抽屉、44px 点击区和无横向溢出。

**Step 4: Full verification and deploy**

```bash
npm test
node --check assets/app.js
node --check assets/cuisine-catalog.js
node --check assets/meal-templates.js
git diff --check
git status --short --branch
git push origin master
gh run watch <pages-run-id> --exit-status
```

在 `https://whz211417.github.io/yi-shi-gua/` 重新执行菜单打开、世界料理切换、菜系选择与启用操作，检查控制台错误为 0。
