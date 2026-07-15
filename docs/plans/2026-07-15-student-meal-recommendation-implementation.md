# 学生就餐双层推荐模型实施计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 将“易食卦”从单一道菜随机推荐改为食堂现实套餐与外出菜系双层推荐，并用六种天气和透明卦象倾向解释结果。

**Architecture:** 保留 `STARTER_MEALS` 作为菜单目录和外出候选来源。新增独立的通用食堂餐型数据与纯函数推荐模块；`chooseMeal` 保持兼容但主流程按去处改用统一推荐结果。卦象主卦的上下卦映射为可解释标签，天气与近期食录作为稳定排序权重。

**Tech Stack:** ES Modules、原生 DOM、Node `node:test`、静态 GitHub Pages。

---

### Task 1: 定义通用食堂餐型和六种天气常量

**Files:**
- Create: `assets/student-meal-model.js`
- Test: `tests/recommendation.test.mjs`

**Step 1: Write failing tests**

测试 `CANTEEN_PLANS`：至少覆盖自选快餐、家常小炒、盖饭、粉面、麻辣烫/冒菜、饺子馄饨、炒饭炒面、铁板/煲仔、汤饭汤面、早餐、炸鸡/汉堡、轻食补餐；每项必须有完整餐标记、窗口、具体菜建议、替代方案、天气和卦象标签；补充品不允许单独成为计划。

**Step 2: Run red test**

Run: `npm test -- --test-name-pattern='canteen plans'`

**Step 3: Implement `assets/student-meal-model.js`**

导出 `CANTEEN_PLANS`、`WEATHER_OPTIONS`、`normaliseStudentWeather()`。每项使用通用高频菜，不宣称实际食堂供应，且提供 2 至 4 个可替换具体菜建议。

**Step 4: Run tests**

Run: `npm test -- --test-name-pattern='canteen plans'`

**Step 5: Commit**

```bash
git add assets/student-meal-model.js tests/recommendation.test.mjs
git commit -m "feat: add universal canteen meal plans"
```

### Task 2: 实现卦象饮食标签与天气排序

**Files:**
- Modify: `assets/student-meal-model.js`
- Test: `tests/recommendation.test.mjs`

**Step 1: Write failing tests**

断言八卦映射为坎温润汤羹、离鲜香明快、震快捷、巽清爽蔬菜、艮稳妥、兑适度改善、乾耐饱蛋白、坤均衡家常。断言六种天气影响计划排序，但不是硬性删除全部候选。

**Step 2: Implement pure helpers**

实现 `dietaryTendencyForTrigrams()`、`scoreStudentPlan()`、`recommendCanteenPlan()`；输入包含主卦上下卦、天气、餐别和近期食录，输出计划、具体菜建议、替代方案和三段理由。

**Step 3: Verify**

Run: `npm test -- --test-name-pattern='trigram|weather|canteen recommendation'`

**Step 4: Commit**

```bash
git add assets/student-meal-model.js tests/recommendation.test.mjs
git commit -m "feat: score canteen plans by weather and trigrams"
```

### Task 3: 实现外出菜系推荐

**Files:**
- Modify: `assets/student-meal-model.js`
- Test: `tests/recommendation.test.mjs`

**Step 1: Write failing tests**

构造启用世界料理、禁用世界料理以及只含中国菜的菜单，断言外出只使用启用的外出菜系；输出一个菜系及 2 至 4 个具体小类；无外出候选时返回明确可行动提示。

**Step 2: Implement**

实现 `recommendOutingCuisine()`。从启用菜单按完整分类路径分组，按卦象/天气标签排序，以稳定 seed 打破平局；不虚构门店、价格、距离。

**Step 3: Verify and commit**

```bash
npm test -- --test-name-pattern='outing cuisine'
git add assets/student-meal-model.js tests/recommendation.test.mjs
git commit -m "feat: recommend enabled outing cuisines"
```

### Task 4: 接入主起卦流程且保持食录兼容

**Files:**
- Modify: `assets/app.js`
- Test: `tests/recommendation.test.mjs`

**Step 1: Write failing integration tests**

断言“食堂 / 不想走远”使用食堂计划，“校外”使用外出菜系；确认记录仍有有效 `id`、`name`、`meals`、餐别和日期，旧 `chooseMeal()` 测试不回归。

**Step 2: Implement adapter**

在 `cast()` 中从 `deriveDivination()` 取主卦上下卦并调用新模型。将结果适配成现有确认/食录所需记录；食堂记录名称使用方案标题，外出记录使用菜系标题。旧目录和 `chooseMeal` 保留用于兼容与其他测试。

**Step 3: Verify and commit**

```bash
npm test
git add assets/app.js tests/recommendation.test.mjs
git commit -m "feat: use student meal recommendations for casting"
```

### Task 5: 更新天气控件和结果解释呈现

**Files:**
- Modify: `index.html`
- Modify: `assets/app.js`
- Modify: `assets/style.css`
- Test: `tests/recommendation.test.mjs`

**Step 1: Write static and behavior tests**

断言天气控件含晴热、晴暖、阴凉、雨天、风大、寒冷/雨雪；结果区域存在“具体菜建议”“现实修正”“替代方案”“娱乐性饮食提示”的语义容器，首页没有菜系筛选。

**Step 2: Implement**

替换旧天气单选值并在 `normaliseStudentWeather()` 兼容旧值。结果卡新增具体菜建议列表、三段式理由与替代方案；明确提示通用食堂菜不等于当日供应，外出提示按附近实际店铺选择。

**Step 3: Verify and commit**

```bash
npm test
node --check assets/app.js
git diff --check
git add index.html assets/app.js assets/style.css tests/recommendation.test.mjs
git commit -m "feat: explain practical meal recommendations"
```

### Task 6: 浏览器与 Pages 验收

**Files:**
- Test only; no planned source edits.

**Step 1: Local verification**

启动 `python -m http.server 4173 --bind 127.0.0.1`。桌面与 375px 窄屏验证：食堂结果含餐型、具体菜、替代；校外结果为启用菜系加小类；六种天气可点选；确认/重试/食录工作；菜单目录仍为中国菜 21 类、世界料理 18 类。

**Step 2: Legacy storage verification**

用浏览器注入旧版有效 81 项存储，刷新后验证 1,039 项目录已一次性合并，世界料理可见；删除一个默认项、保存刷新后不复活。

**Step 3: Publish and public verification**

```bash
git push origin master
gh run list --limit 1 --json status,conclusion,url
```

在 `https://whz211417.github.io/yi-shi-gua/` 重复关键食堂/外出目录验收并检查控制台无错误。
