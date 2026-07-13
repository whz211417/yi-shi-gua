# 易食卦·古籍卷轴式视觉重构 Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 将易食卦重构为手机优先、具有古籍卷轴叙事和“掐指推演”仪式动效的离线网页，同时不回归推荐、菜单或本地记录功能。

**Architecture:** 仅调整 `index.html` 的语义性展示结构、`assets/style.css` 的设计令牌/响应式布局/动效，以及 `assets/app.js` 的展示文案和起卦状态时序。推荐与持久化纯函数保持不变；浏览器交互仍通过现有 DOM API 和 `textContent` 完成。

**Tech Stack:** 原生 HTML、CSS、ESM JavaScript、Node 内置测试、agent-browser Chrome 验收；无第三方运行依赖。

---

### Task 1: 建立古籍卷轴的结构与轻文言文案

**Objective:** 令首屏和核心操作从“大字极简落地页”转为有页眉、侧栏卦谱和案头签条层级的古籍式叙事。

**Files:**
- Modify: `index.html:12-118`
- Test: `tests/recommendation.test.mjs`（只确认原有测试不回归）

**Step 1: 写结构验收脚本（先失败）**

在项目根目录运行：

```bash
python - <<'PY'
from pathlib import Path
p = Path('index.html').read_text(encoding='utf-8')
for token in ['scroll-hero', 'oracle-aside', 'finger-stage', '今朝食录']:
    assert token in p, token
PY
```

预期：失败，因新展示节点尚不存在。

**Step 2: 重构 Hero 与起卦区**

在 `index.html`：

- Hero 改为 `.scroll-hero`，主标题固定两行：
  ```html
  <h1 id="page-title"><span>今日食何</span><span>请报一数</span></h1>
  ```
- 新增右侧 `.oracle-aside`：六爻谱、卦序 `食卦·其一`、朱砂印元素和纯装饰云纹；全部 `aria-hidden="true"`。
- 将条件区外层改为 `.ritual-sheet`；保持所有现有 `id`、radio `name` 和按钮选择器不变。
- 新增 `.finger-stage`，仅作为起卦动效的六个 `i` 爻线容器；默认 `aria-hidden="true"`。
- 改文案：`请陈其时`、`拈数起卦`、`此餐可取`、`再演一卦`、`整饬食单`、`今朝食录`；饮食建议、免责声明保持清晰现代汉语。

**Step 3: 运行结构检查**

运行同一段 Python 脚本。

预期：通过。

**Step 4: 运行不回归测试**

```bash
npm test
node --check assets/app.js
```

预期：21 项测试通过、语法检查通过。

**Step 5: 提交**

```bash
git add index.html
git commit -m "feat: add scroll-style ritual layout"
```

### Task 2: 写入古风设计系统与桌面/手机排版

**Objective:** 解决截图中标题断裂、重心偏左、右侧空白，以及手机端首屏过高的问题。

**Files:**
- Modify: `assets/style.css:1-160`
- Test: CSS/HTML 静态检查与 Chrome 截图

**Step 1: 写失败的视口结构检查**

启动静态服务后，以 Chrome 打开页面，在 375px 宽度通过浏览器求值：

```js
({ overflow: document.documentElement.scrollWidth > innerWidth,
   titleLines: document.querySelectorAll('#page-title span').length })
```

预期：重构前 `titleLines` 不为 2。

**Step 2: 建立令牌和纹样背景**

在 `assets/style.css`：

- 保留深墨/米白/朱砂，增加铜墨辅助色；不引入图片或外部字体。
- 用多个低不透明度 `linear-gradient` / `radial-gradient` 构造纸纤维、淡云纹、回纹和墨晕；确保正文对比度不受影响。
- 为 `.scroll-hero` 设双栏网格，左列为可控宽度标题，右列为卦谱侧栏。
- 标题在桌面使用 `clamp(54px, 7vw, 92px)`，每个 `span` 块级显示；手机使用 `clamp(42px, 13vw, 62px)`。
- `.ritual-sheet` 使用细线、内边框、角标和层叠阴影表现案头签条；选项、输入与按钮最小触控高度维持 44px。
- 用媒体查询在 `<700px` 下改为单列，`.oracle-aside` 变为紧凑横向装饰区，避免空白和横向滚动。
- 扩展现有菜单面板、结果餐签和食录，使它们共享古籍色彩与边框语义。

**Step 3: 用 Chrome 验证桌面和手机**

```bash
agent-browser --session yi-shi-gua open http://localhost:4173
agent-browser --session yi-shi-gua set viewport 1440 900
agent-browser --session yi-shi-gua screenshot artifacts/scroll-desktop.png --full
agent-browser --session yi-shi-gua set viewport 375 812
agent-browser --session yi-shi-gua eval "JSON.stringify({overflow:document.documentElement.scrollWidth>innerWidth,titleLines:document.querySelectorAll('#page-title span').length})"
agent-browser --session yi-shi-gua screenshot artifacts/scroll-mobile.png --full
```

预期：`overflow:false`、`titleLines:2`；截图中标题不超过两行、手机无横向滚动。

**Step 4: 提交**

```bash
git add assets/style.css artifacts/scroll-desktop.png artifacts/scroll-mobile.png
git commit -m "feat: style ancient scroll responsive interface"
```

### Task 3: 实现四段掐指推演与降动效回退

**Objective:** 将当前通用翻转升级为清晰可感的“定数—掐指—凝墨—落印揭签”四段起卦过程。

**Files:**
- Modify: `assets/app.js:253-276`
- Modify: `assets/style.css`（起卦关键帧）
- Test: `tests/recommendation.test.mjs`（既有逻辑测试）

**Step 1: 写可检查的行为断言（先失败）**

通过 Chrome 点击 `#cast-button`，立即求值：

```js
({casting: document.querySelector('#result-card').classList.contains('is-casting'),
  stages: document.querySelectorAll('.finger-stage i').length})
```

预期：重构前 `stages` 不为 6 或不存在逐段阶段状态。

**Step 2: 最小状态实现**

在 `assets/app.js`：

- 不改动 `contextualSeed`、`chooseMeal`、`oracleForContext` 和本地存储行为。
- 起卦时为 `#result-card` 加入 `is-casting`，并用 `data-cast-phase` 依序标记 `count`、`finger`、`ink`、`seal`。
- 每阶段由可取消的 `setTimeout` 串联；总时长控制在 1.1–1.4 秒。
- 动画结束后调用现有安全的 `showResult`；起卦期间禁用起卦/再演按钮，完成后恢复。
- 只使用 `textContent` 写入动态内容。

**Step 3: CSS 动效实现**

在 `assets/style.css`：

- `.finger-stage i` 依次点亮六爻；阴爻用断线样式。
- `data-cast-phase="ink"` 让淡墨层缩放、扩散与褪去。
- `data-cast-phase="seal"` 让朱砂圆印从轻微缩放中压下，并让餐签完成一次 3D 翻面。
- 禁止无限循环、大幅位移或音效；`prefers-reduced-motion` 立即显示结果，不使用连续关键帧。

**Step 4: 验证交互与减少动效**

```bash
agent-browser --session yi-shi-gua click '#cast-button'
agent-browser --session yi-shi-gua wait 250
agent-browser --session yi-shi-gua eval "JSON.stringify({phase:document.querySelector('#result-card').dataset.castPhase,casting:document.querySelector('#result-card').classList.contains('is-casting')})"
agent-browser --session yi-shi-gua wait 1500
agent-browser --session yi-shi-gua is visible '#result-content'
agent-browser --session yi-shi-gua set media dark reduced-motion
agent-browser --session yi-shi-gua click '#cast-button'
agent-browser --session yi-shi-gua wait 50
agent-browser --session yi-shi-gua is visible '#result-content'
```

预期：中途有有效 phase，完成后结果可见；减少动效时结果可立即显示。

**Step 5: 提交**

```bash
git add assets/app.js assets/style.css
git commit -m "feat: add finger-counting casting ritual"
```

### Task 5: 扩充起始菜单并凸显本地食单入口

**Objective:** 将默认餐品从 30 项扩充到约 70–90 项，并明确保留可自行增删改的本地食单抽屉。

**Files:**
- Modify: `assets/data.js:2-33`
- Modify: `tests/recommendation.test.mjs`
- Verify: `index.html` 中 `#menu-open-button` 和 `#menu-panel` 仍存在

**Step 1: 写失败的数据覆盖测试**

在 `tests/recommendation.test.mjs` 新增断言：

```js
assert.ok(STARTER_MEALS.length >= 70);
assert.ok(STARTER_MEALS.some((meal) => meal.meals.includes('早餐') && meal.source === '校外'));
assert.ok(STARTER_MEALS.some((meal) => meal.meals.includes('午餐') && meal.protein === '鱼虾'));
assert.ok(STARTER_MEALS.some((meal) => meal.meals.includes('晚餐') && meal.staple === '粥类'));
```

运行 `npm test`，预期数量断言先失败。

**Step 2: 扩充 `STARTER_MEALS`**

添加约 40–60 项常见餐品：早餐覆盖包点、汤粉、粥、面、三明治/饭团；午晚餐覆盖盖饭、炒菜配饭、汤面、拌面、饺子、砂锅、轻食、日常家常菜。每项必须拥有合法 `id/name/source/venue/meals/staple/protein/vegetable/flavor/enabled` 标签，且 id 唯一。

不得声称为暨南大学或某个真实档口的实时供应；档口使用泛化名称或用户可编辑的默认名。

**Step 3: 验证既有本地自定义能力**

以 Chrome 打开页面：

```bash
agent-browser --session yi-shi-gua click '#menu-open-button'
agent-browser --session yi-shi-gua is visible '#menu-panel'
agent-browser --session yi-shi-gua click '#add-meal-button'
agent-browser --session yi-shi-gua get count '.menu-row'
```

预期：菜单抽屉可见，新增后行数增加；编辑、删除、启用/停用和恢复按钮仍保留。

**Step 4: 运行测试并提交**

```bash
npm test
git add assets/data.js tests/recommendation.test.mjs
git commit -m "feat: expand editable starter menu"
```

### Task 4: 真机尺度浏览器验收与手机使用说明

**Objective:** 用已安装的 Chrome 完成视觉/交互验收，并将手机访问步骤补进 README。

**Files:**
- Modify: `README.md`
- Create: `artifacts/scroll-desktop.png`
- Create: `artifacts/scroll-mobile.png`

**Step 1: 桌面主流程验收**

使用 `agent-browser`：打开本地页面，确认餐别、去处、天气、报数和起卦按钮可操作；起卦后确认结果、再演一卦、此餐可取与食录均能工作。执行：

```bash
agent-browser --session yi-shi-gua console --clear
agent-browser --session yi-shi-gua errors
```

预期：无未捕获 JavaScript 错误。

**Step 2: 手机视口验收**

在 375×812：检查横向溢出、44px 控件、菜单抽屉关闭与起卦流程；存储一次记录并 reload，验证食录仍存在。

**Step 3: 写手机使用说明**

在 `README.md` 新增“手机使用”章节：

- 最稳妥：部署到静态托管后，用手机访问 HTTPS 链接并“添加到主屏幕”。
- 本地临时体验：电脑与手机接入同一 Wi‑Fi，在电脑运行 `python -m http.server 4173`，查本机局域网 IP（`ipconfig` 或 `hostname -I`），手机访问 `http://<局域网IP>:4173`。
- 说明手机/电脑浏览器的 `localStorage` 相互独立；手机首次使用会有单独的菜单和食录。
- 不把电脑 `localhost` 误写成手机可直接访问的地址。

**Step 4: 全量验证**

```bash
npm test
node --check assets/app.js && node --check assets/data.js
git diff --check
```

预期：全部通过。

**Step 5: 提交**

```bash
git add README.md artifacts/scroll-desktop.png artifacts/scroll-mobile.png
git commit -m "docs: add mobile access and visual verification"
```
