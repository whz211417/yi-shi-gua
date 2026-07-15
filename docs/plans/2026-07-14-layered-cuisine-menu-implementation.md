# 分层菜系食单 Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 把“整饬食单”升级为可筛选的分层菜系库：默认启用丰富中餐，预置但默认停用世界料理；首页起卦保持没有菜系筛选的极简流程。

**Architecture:** 将稳定分类目录、分类补全与筛选纯函数抽到 `assets/cuisine-catalog.js`，让 `assets/data.js` 只负责生成并导出可编辑默认餐品。`assets/app.js` 继续管理 localStorage 与 DOM，但通过纯函数筛选食单；筛选只影响“整饬食单”的可见列表，候选池仍仅由 `enabled` 决定。

**Tech Stack:** 原生 ES Modules、Node `node:test`、HTML、CSS、浏览器 localStorage。

---

### Task 1: 建立分类目录与可测试的归一化 / 筛选纯函数

**Objective:** 用独立模块定义稳定菜系目录，安全兼容旧本地菜单，并提供不触碰 DOM 的筛选函数。

**Files:**
- Create: `assets/cuisine-catalog.js`
- Modify: `tests/recommendation.test.mjs`

**Step 1: 写失败测试**

在 `tests/recommendation.test.mjs` 导入：

```js
import {
  DEFAULT_CUISINE_TAXONOMY,
  normaliseCuisineFields,
  filterMealsByCuisine,
  availableCuisineOptions,
} from '../assets/cuisine-catalog.js';
```

加入测试：

```js
test('legacy meals receive a Chinese daily fallback taxonomy without data loss', () => {
  const meal = normaliseCuisineFields({ id: 'legacy', name: '旧餐', enabled: true });
  assert.deepEqual(
    pick(meal, ['cuisineZone', 'cuisine', 'courseFamily', 'dishType']),
    { cuisineZone: '中国菜', cuisine: '中式日常', courseFamily: '其他中式', dishType: '自定义' },
  );
});

test('cuisine filters compose zone cuisine family enabled state and text search', () => {
  const filtered = filterMealsByCuisine(sampleMeals, {
    zone: '中国菜', cuisine: '川菜', family: '粉面', enabledOnly: true, query: '小面',
  });
  assert.deepEqual(filtered.map(({ id }) => id), ['sichuan-noodle']);
});
```

**Step 2: 运行失败测试**

Run:

```bash
npm test -- --test-name-pattern='legacy meals receive|cuisine filters compose'
```

Expected: FAIL — module not found.

**Step 3: 实现 `assets/cuisine-catalog.js`**

导出：

- `DEFAULT_CUISINE_TAXONOMY`：包含中国菜与世界料理的 `zone → cuisines → families → dishTypes` 目录；
- `FALLBACK_TAXONOMY`：`中国菜 / 中式日常 / 其他中式 / 自定义`；
- `normaliseCuisineFields(meal)`：返回新对象，不改写调用方；缺失 / 无效字段补回退值；
- `filterMealsByCuisine(meals, filters)`：仅使用 `zone`、`cuisine`、`family`、`enabledOnly`、`query`；query 匹配 `name` 和 `dishType`；
- `availableCuisineOptions(meals, filters)`：从实际餐品提取下一层可选项，避免显示空分类；
- `cuisinePath(meal)`：返回 `中国菜 / 川菜 / 火锅麻辣烫 / 麻辣烫`。

目录至少收录规格中的全部中国菜系和全部世界料理分区。不要将分类逻辑复制到 `app.js`。

**Step 4: 运行聚焦测试**

Run:

```bash
npm test -- --test-name-pattern='legacy meals receive|cuisine filters compose'
```

Expected: PASS.

**Step 5: Commit**

```bash
git add assets/cuisine-catalog.js tests/recommendation.test.mjs
git commit -m "feat: add cuisine taxonomy utilities"
```

---

### Task 2: 扩展默认模板为中餐启用、世界菜停用的食单库

**Objective:** 让默认菜单拥有至少 210 个分类完整的模板，且默认候选池只含中餐。

**Files:**
- Modify: `assets/data.js`
- Modify: `tests/recommendation.test.mjs`

**Step 1: 写失败测试**

替换旧的“70+ starter menu”断言，并加入：

```js
test('starter menu ships enabled Chinese choices and disabled world cuisine templates', () => {
  assert.ok(STARTER_MEALS.length >= 210);
  const chinese = STARTER_MEALS.filter((meal) => meal.cuisineZone === '中国菜');
  const world = STARTER_MEALS.filter((meal) => meal.cuisineZone !== '中国菜');
  assert.ok(chinese.length >= 140);
  assert.ok(chinese.every((meal) => meal.enabled));
  assert.ok(world.length >= 70);
  assert.ok(world.every((meal) => !meal.enabled));
  assert.ok(STARTER_MEALS.every((meal) => [meal.cuisineZone, meal.cuisine, meal.courseFamily, meal.dishType].every(Boolean)));
});
```

增加按早餐、午餐、晚餐和食堂 / 校外的完整性断言，增加世界料理涵盖日料、韩餐、泰餐、越南菜、印度菜、意餐、美式、墨西哥、中东 / 地中海等断言。

**Step 2: 运行失败测试**

Run:

```bash
npm test -- --test-name-pattern='starter menu ships enabled Chinese'
```

Expected: FAIL — starter menu count / taxonomy conditions not met.

**Step 3: 重构并补齐 `STARTER_MEALS`**

在 `assets/data.js` 使用一个局部 `meal()` 工厂生成不可共享的餐品对象；不要复制 210 行近似 JSON。确保：

- 每一项 `id` 与 `name` 唯一；
- 现有餐品保留或拥有等价替代，避免刷新默认菜单时明显退化；
- 中国菜模板至少 140 项、全部 `enabled: true`；
- 世界料理模板至少 70 项、全部 `enabled: false`；
- 所有项继续满足现有 `staple`、`protein`、`vegetable`、`flavor` 枚举；
- 校园食堂与校外只是可编辑模板来源，不表示真实档口；
- 分类字段全由 `cuisine-catalog.js` 的规范名称填入。

**Step 4: 运行数据和全量测试**

Run:

```bash
npm test
node --check assets/data.js
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add assets/data.js tests/recommendation.test.mjs
git commit -m "feat: expand layered cuisine starter menu"
```

---

### Task 3: 迁移 localStorage 菜单且保证世界菜启用后参与起卦

**Objective:** 旧本地菜单保留并补齐分类；世界模板启用后自然进入推荐候选池。

**Files:**
- Modify: `assets/app.js`
- Modify: `tests/recommendation.test.mjs`

**Step 1: 写失败测试**

新增：

```js
test('normaliseMenu retains legacy meals while adding fallback cuisine fields', () => {
  const [meal] = normaliseMenu([{ ...validMeal, cuisineZone: undefined }]);
  assert.equal(meal.cuisineZone, '中国菜');
  assert.equal(meal.cuisine, '中式日常');
});

test('an enabled world template can participate in matching meal recommendations', () => {
  const world = { ...STARTER_MEALS.find((meal) => meal.cuisine === '日料'), enabled: true, source: '食堂' };
  assert.equal(chooseMeal({ meals: [world], mealPeriod: world.meals[0], place: '在学校', seed: 4 }).meal.id, world.id);
});
```

**Step 2: 运行失败测试**

Run:

```bash
npm test -- --test-name-pattern='normaliseMenu retains legacy|enabled world template'
```

Expected: FAIL before normalization calls the new taxonomy helper.

**Step 3: 最小实现**

在 `assets/app.js`：

- 导入 `normaliseCuisineFields`；
- 在 `normaliseMeal()` / `normaliseMenu()` 的对象复制路径中调用它；
- 在新餐品默认值中添加回退分类；
- 不为 `chooseMeal()` 添加首页菜系参数或偏好过滤；只依赖现有 `enabled` 资格条件；
- 确认 `loadStoredState` / `saveStoredState` 往返时不会丢失新增字段。

**Step 4: 验证**

Run:

```bash
npm test
node --check assets/app.js
git diff --check
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add assets/app.js tests/recommendation.test.mjs
git commit -m "feat: migrate cuisine fields in local menus"
```

---

### Task 4: 添加简洁的“整饬食单”筛选骨架与样式

**Objective:** 在抽屉中提供简单筛选，不在首页增加菜系控件。

**Files:**
- Modify: `index.html`
- Modify: `assets/style.css`
- Modify: `tests/recommendation.test.mjs`

**Step 1: 写失败的静态合约测试**

用 `fs.readFileSync` 断言 `index.html` 有且仅有菜单抽屉内的：

- `#menu-filter-zone`；
- `#menu-filter-cuisine`；
- `#menu-filter-family`；
- `#menu-filter-enabled`；
- `#menu-filter-query`；
- `#menu-filter-clear`；
- `#menu-filter-summary`。

并断言起卦区域没有 `cuisine-preference`、`cast-cuisine` 或同类首页筛选 ID。

**Step 2: 运行失败测试**

Run:

```bash
npm test -- --test-name-pattern='menu filter static contract'
```

Expected: FAIL — menu controls absent.

**Step 3: 实现 HTML / CSS**

在 `#menu-panel` 的说明文字和 `#menu-list` 之间插入 `form.menu-filters`：

- 范围采用 3 个可访问的分段单选按钮；
- 菜系和大类使用原生 `<select>`；
- “只看已启用”使用原生 checkbox；
- 搜索使用 `<input type="search">`；
- 清除是 `type="button"`；
- 总结 `#menu-filter-summary` 使用 `aria-live="polite"`。

CSS 规则：

- 桌面以紧凑两行网格呈现；
- 小于 700px 改为单列；
- 不使用滚动标签云或嵌套树；
- 搜索、选择框、分段按钮最小点击高度 44px；
- 每张 `.menu-row` 预留 `.meal-cuisine-path` 的低对比层级标签样式；
- 不改变首页的 `#cast-button`、餐别 / 去处 / 天气结构。

**Step 4: 验证**

Run:

```bash
npm test -- --test-name-pattern='menu filter static contract'
node --check assets/app.js
```

Expected: PASS.

**Step 5: Commit**

```bash
git add index.html assets/style.css tests/recommendation.test.mjs
git commit -m "feat: add simple cuisine menu filter controls"
```

---

### Task 5: 连接食单筛选、路径显示和分类编辑

**Objective:** 让筛选控件和餐品编辑实际工作，且交互默认简单。

**Files:**
- Modify: `assets/app.js`
- Modify: `tests/recommendation.test.mjs`

**Step 1: 写失败测试**

对导出的纯 helper（必要时从 `app.js` 导出）测试：

```js
test('menu filter state resets dependent selections and clears to defaults', () => {
  const state = reduceMenuFilters(initialFilters, { type: 'zone', value: '世界料理' });
  assert.equal(state.cuisine, '');
  assert.equal(state.family, '');
  assert.deepEqual(reduceMenuFilters(state, { type: 'clear' }), initialFilters);
});
```

同时测试：搜索命中 `dishType`，范围 / 菜系 / 大类 / 已启用复选框组合时列表正确。

**Step 2: 运行失败测试**

Run:

```bash
npm test -- --test-name-pattern='menu filter state resets|searches dish type'
```

Expected: FAIL — reducer / binding absent.

**Step 3: 实现绑定**

在 `assets/app.js`：

1. 创建内存态 `menuFilters`，默认 `{ zone: '', cuisine: '', family: '', enabledOnly: false, query: '' }`；它不需要写入 localStorage；
2. `renderMenu()` 使用 `filterMealsByCuisine(state.menu, menuFilters)`，并更新可选菜系 / 大类和结果摘要；
3. 绑定范围、下拉、checkbox、搜索和清除按钮；变更范围时清空菜系和大类，变更菜系时清空大类；
4. `menuRow()` 标题下插入 `meal-cuisine-path`，用 `cuisinePath(meal)`；
5. 在 `menuRow()` 的编辑表单添加版图、菜系、大类、小类四个级联分类控件；使用目录 + 当前菜单生成选项；仅在用户选“自定义”时出现文本输入；
6. 使 `updateMeal()` 与既有 `isValidMenu()` 保持兼容；分类字段始终通过 `normaliseCuisineFields()` 存储；
7. 筛选为零项时用 DOM 生成空态和“清除筛选”按钮，而非空白。

不要在首页添加控件，不要给 `chooseMeal()` 增加分类偏好参数。

**Step 4: 全量验证**

Run:

```bash
npm test
node --check assets/app.js
git diff --check
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add assets/app.js tests/recommendation.test.mjs
git commit -m "feat: filter and classify local meal menus"
```

---

### Task 6: 浏览器验收、回归与公开发布

**Objective:** 验证首页极简、菜单筛选、世界菜启用、移动布局和 GitHub Pages。

**Files:**
- Modify: `README.md`（补充分层食单的本地保存与默认启用规则，如需要）

**Step 1: 本地校验**

Run:

```bash
npm test
node --check assets/app.js
node --check assets/cuisine-catalog.js
node --check assets/data.js
git diff --check
```

Expected: all tests pass; clean diff.

**Step 2: 浏览器桌面验收**

启动 HTTP 服务：

```bash
python -m http.server 4173 --bind 127.0.0.1
```

检查：

- 首页没有菜系、国家或分类表单控件；
- 初始餐品全部是已启用中国菜；
- 打开“整饬食单”后，世界料理模板可见且显示停用；
- 切换范围、菜系、大类、只看已启用、搜索与清除筛选均生效；
- 启用一个日料模板后，再起卦可以把它作为候选；
- 新增 / 编辑 / 停用 / 删除 / 恢复起始菜单、确认食录和重试无回归；
- console 无 JavaScript error。

**Step 3: 移动端验收**

在 375×812 检查：筛选栏单列、抽屉无水平滚动、控件可点击、关闭 / Esc / 焦点恢复可用。

**Step 4: 文档与提交**

如 README 需要补充：说明世界菜模板默认停用，启用操作只保存在本机浏览器。

```bash
git add README.md
git commit -m "docs: explain layered cuisine menu defaults"
```

**Step 5: 发布与公网验证**

```bash
git push origin master
gh run list --repo whz211417/yi-shi-gua --limit 2
gh run watch <pages-run-id> --repo whz211417/yi-shi-gua --exit-status
```

随后用公开 URL `https://whz211417.github.io/yi-shi-gua/` 重复关键浏览器验收，并记录 GitHub Pages 成功、实际世界菜停用状态、筛选路径和无控制台错误。
