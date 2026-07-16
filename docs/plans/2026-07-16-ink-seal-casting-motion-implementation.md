# 墨环落印起卦动效实施计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 将起卦过程升级为富有器物感的墨环落印仪式，并保留可访问性与现有推荐流程。

**Architecture:** 复用 `assets/app.js` 的现有 casting 生命周期和定时器清理机制；在 `index.html` 增加纯装饰的印环层，在 `assets/style.css` 以阶段 class 驱动边框、密文、墨环、朱印和逐爻动画。动效元素不承载业务状态。

**Tech Stack:** 原生 DOM、CSS keyframes、ES Modules、Node `node:test`。

---

### Task 1: 加入语义隔离的印环装饰层

**Files:**
- Modify: `index.html`
- Modify: `tests/recommendation.test.mjs`

**Step 1: Write failing static test**

断言起卦结果卡包含 `casting-ritual`、双层边框、密文环、时辰刻印、朱砂食印，且所有装饰 `aria-hidden="true"`；现有结果文本节点唯一保留。

**Step 2: Implement minimal markup**

在结果卡的现有 `ink-ritual` 内或旁加入静态装饰层，初始隐藏/低可见度，不新增可聚焦元素。

**Step 3: Verify and commit**

```bash
npm test -- --test-name-pattern='ink seal ritual'
git add index.html tests/recommendation.test.mjs
git commit -m "feat: add ink seal ritual layers"
```

### Task 2: 实现五阶段 CSS 动效与窄屏样式

**Files:**
- Modify: `assets/style.css`
- Test: `tests/recommendation.test.mjs`

**Step 1: Add failing static assertions**

测试应要求 `count/ink/seal/lines/reveal` 阶段、墨环/朱印/逐爻 keyframes、375px 样式和 `prefers-reduced-motion` 覆盖。

**Step 2: Implement CSS**

用现有 `data-cast-phase` 增加五阶段样式。总动画不超过 1.55 秒；禁止无限旋转、3D transform、闪电/火焰效果。朱砂只应用于印和动爻。

**Step 3: Verify and commit**

```bash
npm test -- --test-name-pattern='ink seal ritual'
git add assets/style.css tests/recommendation.test.mjs
git commit -m "feat: animate ink seal casting ritual"
```

### Task 3: 连接阶段时间轴与逐爻状态

**Files:**
- Modify: `assets/app.js`
- Test: `tests/recommendation.test.mjs`

**Step 1: Write failing pure/static test**

断言正常生命周期的阶段顺序为 count → ink → seal → lines → reveal；减少动态时跳过中间阶段；页面隐藏清理计时器和临时状态。

**Step 2: Implement**

扩展 `cast()`、`setCastPhase()`、`showCastingHexagram()` 与 `finishCasting()`。前三爻和后三爻的可见性由阶段 class 表达，动爻只在 lines/reveal 后突出。不得改变数时起卦计算、食堂/外出推荐或确认食录。

**Step 3: Verify and commit**

```bash
npm test
node --check assets/app.js
git diff --check
git add assets/app.js tests/recommendation.test.mjs
git commit -m "feat: sequence ink seal casting motion"
```

### Task 4: 本地和公网视觉验收

**Files:** no planned source edits.

1. 在 HTTP 服务下正常起卦，确认 1.55 秒内形成结果、无控制台错误；
2. 用 375px 宽屏确认无裁切；
3. 启用减少动态效果，确认直接展示结果；
4. 确认食堂与校外两条新推荐结果仍可确认并进入食录；
5. 推送 `master`，等待 Pages 成功后在公网复验。
