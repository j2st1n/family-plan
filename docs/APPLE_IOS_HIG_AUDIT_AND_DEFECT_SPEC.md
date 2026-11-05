# Family Plan 全站全页面 UI/UX 深度审计规范：对照 Apple iOS HIG 标准排查缺陷清单

> **报告属性**：Family Plan 亲子自律与习惯打卡系统全站（Parent Web 与 Child PWA）UI/UX 深度排查与设计系统落地规范  
> **设计系统基准**：Apple iOS Human Interface Guidelines (HIG) & OpenDesign `design-systems/apple/DESIGN.md`  
> **审计范围**：双端全部一级页面、二级抽屉 (Bottom Sheet)、模态弹窗 (Modals)、表单控件、文案体系与排版字阶  
> **下游执行**：任务 `t_6147682b`（全栈实施：将全站所有模态框、表单、间距与控件彻底重塑为 Apple iOS 原生体验）

---

## 1. 核心设计缺陷大类总览与 Apple iOS HIG 对照标准

在对 Family Plan 的 Parent Web 与 Child PWA 进行逐行代码与页面走查后，当前全站存在 5 大系统性非原生与粗糙体验缺陷，需对照 Apple iOS 原生标准彻底重构：

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                      Apple iOS HIG 标准 vs 当前反模式对比                      │
├─────────────────────────────────────┬─────────────────────────────────────────┤
│ 典型反模式 (Anti-Patterns)           │ Apple iOS HIG 原生标准 (HIG Baseline)    │
├─────────────────────────────────────┼─────────────────────────────────────────┤
│ 1. 不对称/割裂抽屉导航              │ 标准模态导航栏 (Modal Navigation Bar)    │
│    - 左对齐标题 + 右侧[✕]关闭按钮   │ - 居中 Handle Bar (36x5px, 圆角 2.5px)  │
│    - 底部放置全宽大按钮 (btn-primary)│ - 左侧取消按钮 [取消] (400 细体, 蓝色)    │
│    - 或顶部右侧已有[保存]，底部重复 │ - 中间居中加粗标题 (17px / 600)          │
│      存在[确认保存]大按钮           │ - 右侧主动作按钮 [完成/保存/添加] (650)   │
│                                     │ - 底部绝无冗余重复的大按钮 (释放视口高度)│
├─────────────────────────────────────┼─────────────────────────────────────────┤
│ 2. 老旧 Web 方块表单                │ Inset Grouped TableView (内嵌分组列表)  │
│    - Label 置顶 + 1px 实线边框输入框│ - 纯白圆角分组卡片 (12-14px 圆角)        │
│    - 表单元素各自独立成块、间距松散 │ - 标题无框直接输入 (Borderless Input)    │
│    - 背景杂乱，无层级收敛           │ - 行间 0.5px 极细分割线，左缩进 16px     │
│                                     │ - 分组前置微标签 (0.78rem, 600, 大写)   │
│                                     │ - 分组后置说明微文本 (0.75rem, Muted)   │
├─────────────────────────────────────┼─────────────────────────────────────────┤
│ 3. 浏览器原生 <select> 与粗糙表单项 │ iOS 原生交互控件体系                    │
│    - 杂乱的原生下拉框与双三角箭头   │ - 少选项 (<=4): iOS Segmented Control    │
│    - 原始 <input type=\"checkbox\">   │ - 计数增减: iOS Stepper (- / + 圆形按钮)│
│    - 空白无边距的裸露 time/date     │ - 状态开闭: iOS Switch 绿色滑动切换开关  │
│                                     │ - 时间日期: iOS Time Capsule 浅灰圆角胶囊│
├─────────────────────────────────────┼─────────────────────────────────────────┤
│ 4. 视口边距与排版挤压               │ iOS 视口呼吸留白与防折行排版             │
│    - 边距不一致 (0px, 8px, 20px)    │ - 移动端统一左右 16px 视口基准留白      │
│    - 星期/数字在小屏断行孤字 (如“1张”)│ - 强制 white-space: nowrap + flex-shrink│
│    - 虚线边框 (1.5px dashed) 视觉噪音│ - 彻底消灭虚线边框，采用 Apple 调和纯色 │
├─────────────────────────────────────┼─────────────────────────────────────────┤
│ 5. 冰冷黑话、风控词汇与爹味用语     │ 亲子温暖、尊重自治的 Apple 文案风格     │
│    - 金融风控词: 风控、流水、纠偏   │ - 转化为: 规则设置、变动记录、手动调减  │
│    - ERP 仓储词: 库存、上架、下架   │ - 转化为: 拥有张数、添加奖励、暂停兑换  │
│    - 爹味与机械词: 严惩、纠偏、您   │ - 转化为: 撤回调整、引导鼓励、你的绑定码│
└─────────────────────────────────────┴─────────────────────────────────────────┘
```

---

## 2. 全站二级抽屉与模态框深度审计清单

### 缺陷清单目录 (Modals & Sheets M1 ~ M16)

---

#### M1: Analytics.jsx — 休假模式管理抽屉 (`showVacationModal`)
- **文件路径**: `src/parent-web/src/pages/Analytics.jsx`
- **行号区间**: L445 - L529
- **严重级别**: P1 (核心抽屉)
- **问题现象**:
  1. **不对称导航**: 早期为左对齐标题“休假模式管理” + 右侧文本“取消”，下方以独立 `<form>` 承载表单，在底部堆叠了一个全宽大按钮 `+ 登记新休假`；即使近期微调将按钮移至右上角，其内部表单与已设置列表仍存在视觉割裂。
  2. **带边框方块表单**: 开始日期与结束日期采用 `gridTemplateColumns: "1fr 1fr"`，上方悬浮 `label`，下方为带边框的 `modalInput`；休假原因也是独立的带边框输入框。
  3. **空白无提示日期选择框**: `type="date"` 依赖浏览器默认渲染，在 Safari 与桌面 Chrome 下无统一内嵌边距，箭头与占位符错位。
  4. **删除按钮粗糙**: 已设置休假列表项右侧使用无背景的文本按钮“删除”，缺乏 iOS 原生列表的滑动删除或微胶囊操作质感。
- **Apple 原生改造方案**:
  1. 采用标准 iOS 模态导航：居中 Handle Bar + 左侧 `ios-sheet-nav-btn` [取消] + 中间 `ios-sheet-header-title` [休假模式] + 右侧 `ios-sheet-nav-action-btn` [登记]（未填起止日期时置灰 `disabled`）。
  2. 表单重塑为 **Apple Inset Grouped TableView**：
     - 白底圆角卡片 (`.ios-grouped-card`)，内含 3 行：[开始日期]、[结束日期]、[休假原因(选填)]；
     - 行间加入 0.5px 极细分割线 (`.ios-separator`，左缩进 16px)；
     - 日期选择使用 `.ios-time-input` 胶囊形式靠右对齐；
     - 休假原因直接采用无框靠右输入 (`text-align: right`)。
  3. 卡片下方增加说明微文本（Section Footer）：*“休假模式开启后，所设区间内每天自动豁免，任务未完成不扣减连击天数。”*
  4. 彻底移除底部 `+ 登记新休假` 冗余大按钮。

---

#### M2: Settings.jsx — 家庭与孩子档案抽屉 (`activeDrawer === "profiles"`)
- **文件路径**: `src/parent-web/src/pages/Settings.jsx`
- **行号区间**: L522 - L648
- **严重级别**: P1 (核心配置抽屉)
- **问题现象**:
  1. **标题与按钮不对称堆叠**: 导航栏右侧同时塞入了胶囊按钮 `+ 添加孩子` 和关闭图标 `✕`，左侧完全空白，标题左对齐，严重破坏 iOS 视觉平衡。
  2. **关闭按钮为 Web 叉号**: 使用了字符 `✕`（`drawer-close-btn`），而非 iOS 标准的导航栏文字按钮“完成”或左侧“关闭”。
  3. **档案卡片样式陈旧**: 列表项使用 `backgroundColor: "var(--card-subtle)"` 配合 `border: "1px solid var(--border-subtle)"`，操作区散落着“编辑”与“删除”胶囊。
- **Apple 原生改造方案**:
  1. 导航栏重塑为 iOS 规范：左侧置空或放置 [关闭]，中间居中粗体 [家庭与孩子档案]，右侧放置动作按钮 [+ 添加]（触发 `setShowAddChild(true)`）。
  2. 孩子档案列表重构为 Inset Grouped TableView：
     - 外层为白底圆角卡片，每位孩子为一行，左侧为孩子头像/首字母圆形微标与学段年级，右侧为优雅的 `chevron-right` 指引或右侧辅操作。

---

#### M3: Settings.jsx — iPad 设备访问码抽屉 (`activeDrawer === "accessCode"`)
- **文件路径**: `src/parent-web/src/pages/Settings.jsx`
- **行号区间**: L650 - L778
- **严重级别**: P1 (核心功能抽屉)
- **问题现象**:
  1. **左对齐标题 + 右叉号**: `drawer-header` 只有左侧标题和右侧 `✕`，没有取消/完成主键。
  2. **原生 `<select>` 下拉框**: L675 使用原生 `<select>` 切换孩子，带双三角下箭头，破坏原生感。
  3. **虚线边框反模式**: L697 访问码卡片使用 `border: "1.5px dashed var(--border)"`，属于 OpenDesign 明确禁止的 AI slop 虚线装饰。
  4. **底部孤独大按钮**: 底部放置了 100% 宽度的 `重新生成访问码` 按钮，导航栏却无任何对应。
- **Apple 原生改造方案**:
  1. 顶部导航：中间居中 [设备访问码]，右侧放置 [完成]（关闭抽屉）。
  2. 孩子选择：若有多孩，改用 iOS Segmented Control 胶囊切换或 Inset Grouped 单选行，彻底消除 `<select>`。
  3. 访问码展示：废除虚线框，改用纯净的 Apple 质感浅灰背景底卡（`background: #F5F5F7` 或 Inset Card），大字阶等宽粗体 (`letter-spacing: 0.25em, font-variant-numeric: tabular-nums`)。
  4. 重新生成操作：在卡片底部以淡雅的辅助文字按钮呈现，或纳入分组行内。

---

#### M4: Settings.jsx — 例行任务模板库抽屉 (`activeDrawer === "routineTasks"`)
- **文件路径**: `src/parent-web/src/pages/Settings.jsx`
- **行号区间**: L780 - L896
- **严重级别**: P1
- **问题现象**:
  1. **导航栏右侧拥挤**: 同时放置了 `+ 添加循环任务` 和 `✕`，左侧空白。
  2. **原生 `<select>` 选择孩子**: L810 出现原生 `<select>` 下拉框。
  3. **任务行视觉粗糙**: 任务卡片使用 `var(--card-subtle)` 灰色底块拼凑，右侧堆叠红色删除按钮。
- **Apple 原生改造方案**:
  1. 顶部导航：中间居中 [例行任务模板]，左侧置空或 [完成]，右侧放置主动作 [+ 新增]（打开新增模态框）。
  2. 孩子切换：改用 iOS Segmented Control 顶部分段选择器。
  3. 任务列表：采用 Inset Grouped TableView，行内左侧显示任务名、时长与循环周期（如“每周一、三、五”），右侧为星星徽章。

---

#### M5: Settings.jsx — 连击保护卡设置抽屉 (`activeDrawer === "freeze"`)
- **文件路径**: `src/parent-web/src/pages/Settings.jsx`
- **行号区间**: L902 - L1200
- **严重级别**: P1
- **问题现象**:
  1. **原生 `<select>`**: L924 在多孩子时使用原生 `<select>`。
  2. **独立方块保存按钮**: L1135 在规则卡片内下方堆叠了独立的矩形保存按钮 `保存规则修改`。
  3. **残存风控用语**: 标题或历史列表中可能残存“流转明细流水”、“手动纠偏”等冷硬字眼。
- **Apple 原生改造方案**:
  1. 顶部导航：中间居中 [连击保护卡]，左侧 [取消]，右侧动作按钮 [保存]（统一提交规则修改）。
  2. 孩子选择：Segmented Control 或 Inset Grouped 切换。
  3. 规则设置卡片保持标准的 Setting Rows（兑换星数使用 compact-stepper，持有上限使用 pill-segment-group），去除卡片内独立保存按钮，统一由右上角保存。

---

#### M6: Settings.jsx — 编辑孩子档案模态框 (`editingChild`)
- **文件路径**: `src/parent-web/src/pages/Settings.jsx`
- **行号区间**: L1208 - L1306
- **严重级别**: P0 (高频操作模态框)
- **问题现象**:
  1. **双重主动作按钮冲突 (Dual Primary Buttons)**: 顶部右侧设有“保存”，底部同时保留了 100% 全宽的 `btn-primary`“保存修改”，形成严重的视觉冗余和手势冲突。
  2. **原生 `<select>` 下拉框**: L1242（学段）和 L1263（年级）采用原生 `<select>`，带有粗糙的黑色箭头。
  3. **Label 置顶带框输入框**: 姓名输入与连胜达标线输入框带有外框和置顶 Label。
- **Apple 原生改造方案**:
  1. 顶部导航：左侧 `ios-sheet-nav-btn` [取消] + 中间 [编辑孩子档案] + 右侧 `ios-sheet-nav-action-btn` [保存]。
  2. 彻底删除底部全宽大按钮。
  3. 表单全面 Inset Grouped 化：
     - Group 1（基本信息）：行 1 姓名直接无框输入；行 2 学段；行 3 年级。学段年级改用内嵌右侧选择器或 Segmented/ActionSheet。
     - Group 2（习惯规则）：每日连胜达标线，右侧使用数字输入胶囊并紧跟 `%`，下方放置 12px 说明文字。

---

#### M7: Settings.jsx — 添加孩子档案模态框 (`showAddChild`)
- **文件路径**: `src/parent-web/src/pages/Settings.jsx`
- **行号区间**: L1310 - L1392
- **严重级别**: P0
- **问题现象**:
  1. **双重按钮与不对称导航**: 顶部右侧有添加，底部依然存在全宽 `确认添加` 大按钮。
  2. **原生 `<select>` 下拉框**: L1344（学段）和 L1365（年级）使用原生 `<select>`。
- **Apple 原生改造方案**:
  1. 统一由顶部右侧 [添加] 触发创建，删除底部按钮。
  2. Inset Grouped 结构，学段年级与编辑模态框保持一致。

---

#### M8: Settings.jsx — 连胜奖励达标线模态框 (`rewardChild`)
- **文件路径**: `src/parent-web/src/pages/Settings.jsx`
- **行号区间**: L1395 - L1442
- **严重级别**: P1
- **问题现象**:
  1. **左对齐标题 + 右取消 + 底部大按钮**: 典型的不对称导航反模式。
  2. **方块带边框输入框**: 达标阈值输入框带边框，与旁边的说明文字挤压。
  3. **技术词汇**: 使用了“达标阈值 (%)”技术黑话。
- **Apple 原生改造方案**:
  1. 顶部导航：左 [取消] + 中 [{child.name} 连胜规则] + 右 [保存]。
  2. 文案调整为“每日达标标准”。
  3. 采用 Inset Grouped 单行卡片：左侧标题“每日达标线”，右侧步进器或胶囊输入，删除底部“保存设定”全宽按钮。

---

#### M9: Settings.jsx — 添加每周循环例行任务模态框 (`showAddRoutine`)
- **文件路径**: `src/parent-web/src/pages/Settings.jsx`
- **行号区间**: L1445 - L1558
- **严重级别**: P0
- **问题现象**:
  1. **双重按钮**: 顶部右侧有添加，底部仍保留全宽 `确认添加` 按钮。
  2. **原生 `<select>`**: L1494 奖励星星使用原生 `<select>` 下拉框。
  3. **原生复选框**: L1537 使用原生 `<input type="checkbox">`。
  4. **星期按钮折行隐患**: 7 个星期按钮在极窄视口下未做严密防折行保护。
- **Apple 原生改造方案**:
  1. 删除底部全宽按钮，收敛至右上角 [添加]。
  2. 奖励星星改为 **iOS Segmented Control** (`0星` / `⭐ 1` / `⭐ 2` / `⭐ 3` / `⭐ 5`)。
  3. 预计时长改为 **iOS Stepper** (`−` 与 `+` 步进器)。
  4. “需要家长审核确认”改用标准 **iOS Switch** 滑动开关行。
  5. 星期选择器采用圆角网格或弹性等宽 pill，设置 `white-space: nowrap`。

---

#### M10: Shop.jsx (Parent Web) — 奖励上架与编辑抽屉 (`itemModal`)
- **文件路径**: `src/parent-web/src/pages/Shop.jsx`
- **行号区间**: L388 - L462
- **严重级别**: P0
- **问题现象**:
  1. **双重主动作按钮**: 顶部右侧存在动作按钮，底部依然保留全宽大按钮（`确认上架` / `保存修改`）。
  2. **ERP 仓储用语**: 文案大面积使用“上架新商品”、“库存数量 (选填)”、“留空为不限”、“下架商品”。
  3. **带边框老旧输入框**: 标题、星数、库存使用带框输入框。
- **Apple 原生改造方案**:
  1. 顶部导航：左侧 [取消] + 中间 [添加奖励 / 编辑奖励] + 右侧 [添加 / 保存]。删除底部大按钮。
  2. 表单重塑为 Inset Grouped 卡片：
     - 行 1：奖励名称（直接无框输入）
     - 行 2：所需星星（右侧数值胶囊或 Stepper）
     - 行 3：提供数量 (选填)（右侧数值胶囊，占位符为“不限”）
  3. 文案全面去 ERP 化：将“上架商品”全面升级为“添加心愿奖励”，将“库存”升级为“提供数量/次数”。

---

#### M11: Shop.jsx (Child PWA) — 向家长许愿抽屉 (`showWish`)
- **文件路径**: `src/child-pwa/src/pages/Shop.jsx`
- **行号区间**: L415 - L500
- **严重级别**: P0 (儿童端核心心愿交互)
- **问题现象**:
  1. **双重主动作按钮**: 顶部导航右侧已有 `ios-sheet-nav-action-btn` [提交]，底部 L480 又重复渲染了 100% 全宽的 `btn-primary` [提交心愿] 大按钮！
  2. **表单机械黑话**: 使用“提交”、“提交心愿”，对儿童而言生硬无趣。
  3. **价格展示金融化**: L509 `实付 8⭐ · 原价 10⭐ (80%)` 带有商超小票风格。
- **Apple 原生改造方案**:
  1. 顶部导航右侧文字改为亲切的 [许愿] 或 [发送]。
  2. **彻底删除底部 L480-L496 的冗余全宽大按钮**。
  3. 输入卡片已采用 Inset Grouped，进一步微调占位提示语为：“想要什么愿望？告诉爸爸妈妈吧”。
  4. 折扣展示改用活泼的连击成就标识，如“连胜 7 天专属 8 折”。

---

#### M12: Today.jsx (Child PWA) — 添加任务抽屉 (`showAdd`) & 行内编辑
- **文件路径**: `src/child-pwa/src/pages/Today.jsx`
- **行号区间**: L505 - L650 (`showAdd`), L739 - L815 (行内编辑排程)
- **严重级别**: P0 (儿童每日最高频操作)
- **问题现象**:
  1. **添加任务双重按钮**: 顶部已有右上角 [添加]，底部 L636 又渲染了全宽 `btn-primary` [添加任务] 大按钮。
  2. **行内编辑采用原生 `<select>`**: L758 在编辑任务时调用 `RewardSelect`，内部直接渲染原生 `<select>` (L998)，在 iPad 触控屏上极为粗糙。
  3. **行内时间编辑无样式**: L765, L772, L792, L800 直接渲染 `type="time"`，无胶囊容器，无图标，容易挤压错位。
- **Apple 原生改造方案**:
  1. `showAdd` 模态框彻底移除底部全宽大按钮，所有创建逻辑收敛至右上角 [添加]。
  2. 废除 `RewardSelect` 的 `<select>`，重构为 **iOS Segmented Control** 或 **水平星数点选条**。
  3. 行内时间编辑使用 `.ios-time-input` 胶囊，时间段中间加上中圆点或箭头，符合 Apple Reminders 原生时间选择规范。

---

#### M13: TodayDashboard.jsx (Parent Web) — 任务添加与编辑抽屉 (`showTaskModal`)
- **文件路径**: `src/parent-web/src/pages/TodayDashboard.jsx`
- **行号区间**: L965 - L1130
- **严重级别**: P0 (家长端核心操作)
- **问题现象**:
  1. **双重主动作按钮**: 顶部导航右侧为 [保存/添加]，底部 L1119 仍有全宽 `btn-primary` [保存修改/确认添加] 大按钮。
  2. **原生 `<select>` 奖励星星**: L1045 使用 `<select>` 选择 0~5 星。
  3. **原生 Checkbox**: L1108 使用原生复选框。
  4. **时间输入无胶囊**: L1068, L1084 为普通文本输入框。
- **Apple 原生改造方案**:
  1. 彻底删除底部 L1119 大按钮，由右上角导航动作按钮统一触发表单提交。
  2. 星星选择改用 **iOS Segmented Control** (`0星` / `⭐ 1` / `⭐ 2` / `⭐ 3` / `⭐ 5`)。
  3. 预计时长使用 **iOS Stepper** 增减按钮。
  4. “需家长点赞确认发星”改用 **iOS Switch** 滑动开关。
  5. 开始/结束时间改用 `.ios-time-input` 时间胶囊。

---

#### M14: TaskCopilotModal.jsx (Parent Web) — AI 建议建任务模态框
- **文件路径**: `src/parent-web/src/components/TaskCopilotModal.jsx`
- **行号区间**: L134 - L500
- **严重级别**: P1
- **问题现象**:
  1. **导航栏右侧留白不对称**: L149 放置了 `<div style={{ width: 44 }} />` 占位，所有操作全部下沉为底部大按钮。
  2. **草稿项原生 `<select>`**: L381 草稿卡片内部的星星选择使用原生 `<select>`。
  3. **草稿项时间输入粗糙**: L401-L429 开始和结束时间为两个极小的纯边框方块，中间夹着一个短横线。
  4. **日期输入框未原生化**: L261 `type="date"` 放置在粗糙的方框内。
- **Apple 原生改造方案**:
  1. 导航栏重构：左侧 [取消] + 中间 [AI 智能建任务] + 右侧在草稿解析成功后动态呈现 [发布] 动作按钮。
  2. 草稿卡片重塑为 Inset Grouped 子卡片，星星改用紧凑胶囊，时间改用紧凑时间胶囊。

---

#### M15: StreakFreezeModal.jsx (Parent Web) — 连击保护卡独立抽屉模态框
- **文件路径**: `src/parent-web/src/components/StreakFreezeModal.jsx`
- **行号区间**: L118 - L500
- **严重级别**: P1
- **问题现象**:
  1. **左对齐标题 + 右侧叉号**: L122-L125 标题靠左，右侧仅为一个 `✕` 字符。
  2. **内联微对话框带框输入**: L220-L261 调整卡片理由输入框使用旧式方块 `styles.input`，按钮为“确认提交”。
  3. **遗留风控与仓储词汇**: 存在“当前保护卡库存”、“库存充足”、“流转历史流水”、“错记纠偏回收”、“免死金牌”。
- **Apple 原生改造方案**:
  1. 顶部导航：居中标题 [连击保护卡]，右侧 [完成]。
  2. 文案全面净化（见下文文案专节）。
  3. 表单卡片改用 Inset Grouped TableView，步进器统一为 `.ios-stepper-btn`。

---

#### M16: FeedbackContext.jsx (Parent Web) — 确认与提示弹窗 (`confirmDialog` / `alertDialog`)
- **文件路径**: `src/parent-web/src/components/FeedbackContext.jsx`
- **行号区间**: L180 - L307
- **严重级别**: P1
- **问题现象**:
  1. **桌面 Web 偏右按钮布局**: L199 和 L287 使用了 `justifyContent: "flex-end"`，按钮为右下角排列的小方块，与 Apple iOS 标准 Alert 弹窗（居中文字、等宽全宽分栏按钮、0.5px 分割线）不符。
  2. 与 Child PWA 的 `ChildFeedback.jsx` 实现脱节（Child 端已是完美的 Apple iOS Alert 弹窗）。
- **Apple 原生改造方案**:
  1. 对齐 `ChildFeedback.jsx` 的 iOS Alert 规范：
     - 毛玻璃背景 (`backdrop-filter: blur(20px)`)、16px 圆角；
     - 标题居中加粗，说明文字居中次级色；
     - 底部按钮栏为 `borderTop: 0.5px solid rgba(60, 60, 67, 0.25)`，左右等分（取消在左 400 细体，确认在右 600 粗体，危险操作标红）。

---

## 3. 页面级表单与控件遗留缺陷审计

### 缺陷清单目录 (Pages P1 ~ P6)

---

#### P1: ChildCreate.jsx — 独立添加孩子页面表单
- **文件路径**: `src/parent-web/src/pages/ChildCreate.jsx`
- **行号区间**: L33 - L100
- **问题现象**:
  - L35 顶部使用生硬的 `← 返回` 文本链接；
  - L39-L72 老旧的 Label 置顶 + 10px 方块输入框；
  - L48, L61 存在原生 `<select>` 下拉框；
  - L73 底部全宽大按钮。
- **Apple 原生改造方案**:
  - 顶部导航统一为标准 iOS 导航栏（居中标题，左侧返回箭头+文本）；
  - 核心表单转为 Inset Grouped TableView 卡片；
  - 学段年级转为 iOS 选择器。

---

#### P2: TaskManage.jsx — 独立任务管理页面
- **文件路径**: `src/parent-web/src/pages/TaskManage.jsx`
- **行号区间**: L262, L356-L362, L404-L408, L452-L458, L509, L520
- **问题现象**:
  - L520 `RewardSelect` 为原生 `<select>`；
  - L262 `<input type="date">` 嵌入在粗糙的箭头按钮中间；
  - L358, L406, L454 `<input type="time">` 为普通边框框；
  - 多处原生复选框 `<input type="checkbox">`。
- **Apple 原生改造方案**:
  - 将所有任务新建与编辑收敛至统一的 `TaskModal`（复用 TodayDashboard 的标准模态框），消灭陈旧的行内展开变形；
  - 统一星星选择为 Segmented Control，复选框改为 iOS Switch。

---

#### P3: RewardSettings.jsx — 独立连胜奖励设置页面
- **文件路径**: `src/parent-web/src/pages/RewardSettings.jsx`
- **行号区间**: L127 - L185
- **问题现象**:
  - L165 存在大面积的彩色装饰渐变 `linear-gradient(135deg, var(--accent-light), var(--star-bg))`，违背 Apple 纯净中性基底原则；
  - L132 状态开关使用了一个写着“开”/“关”文字的普通小按钮；
  - L183 添加档位按钮使用虚线边框 `1.5px dashed var(--accent)`。
- **Apple 原生改造方案**:
  - 移除彩色渐变大背景，回归 iOS Grouped 页面灰底白卡节奏；
  - 状态开关改为标准 **iOS Switch** 滑动组件；
  - 移除虚线边框，改为 Inset TableView 行内 “添加新档位” 纯文字动作行。

---

#### P4: Home.jsx — 旧版主页遗留表单
- **文件路径**: `src/parent-web/src/pages/Home.jsx`
- **行号区间**: L149 - L165
- **问题现象**:
  - 包含早期的行内孩子编辑表单，使用原生 `<select>`（L151, L158）和方块输入框。
- **Apple 原生改造方案**:
  - 废除 Home.jsx 中过时的行内编辑逻辑，统一重定向/复用 Settings.jsx 中的标准 Sheet。

---

#### P5: Bind.jsx — 儿童端设备绑定码页面
- **文件路径**: `src/child-pwa/src/pages/Bind.jsx`
- **行号区间**: L33, L51
- **问题现象**:
  - L33 文案“输入家长给您的访问码”带有极不自然的敬语“您”和技术词“访问码”；
  - L51 访问码输入框使用 `border: "2px solid var(--border)"` 粗边框大方块。
- **Apple 原生改造方案**:
  - 文案改为：“输入爸爸妈妈给你的 6 位绑定码”；
  - 输入框重塑为类似 Apple ID 验证码的 6 位分离式单字符卡片，或内嵌式优雅浅灰背景圆角栏。

---

#### P6: WarmEmptyState.jsx — 虚线描边空状态微标
- **文件路径**: `src/parent-web/src/components/WarmEmptyState.jsx`
- **行号区间**: L27
- **问题现象**:
  - 空状态图标外圆使用 `border: "1.5px dashed var(--accent-pill)"` 虚线。
- **Apple 原生改造方案**:
  - 虚线改为无边框的纯净柔光微底色背景 (`background: var(--accent-light)`)，完全消除虚线颗粒噪点。

---

## 4. 文案词阶、生硬黑话、金融风控与 ERP 仓储用语全量排查对照表

### 4.1 金融风控与惩治用语改造表 (Financial Risk & Penal Terms)

| 所在文件与行号 | 当前问题词汇 | 问题类型 | Apple HIG 亲子原生规范文案 | 改造理由 |
|---|---|---|---|---|
| `Settings.jsx:473, 900` | 连击保护卡与风控 | 金融风控词 | **连击保护卡** / **保护卡设置** | 家庭自律不是银行风控，去除令人紧张的冷硬管理词 |
| `Settings.jsx:414` | 习惯风控管理 | 金融风控词 | **家庭档案与习惯规则** | 转换为家庭温情中性的规则管理 |
| `Settings.jsx:367` | 保护卡风控规则已保存 | 金融风控词 | **保护卡规则已保存** | 去除“风控”黑话 |
| `StreakFreezeModal.jsx:375` | 抵扣与流转历史流水 | 银行流水词 | **卡片使用记录** / **变动明细** | 孩子使用保护卡不是资金流转与结算对账 |
| `Shop.jsx (child):305` | 我的兑换流水 | 财务流水词 | **我的兑换记录** | 孩子端必须通俗易懂 |
| `StreakFreezeModal.jsx:98,200` | 纠偏扣除 / 错记纠偏回收 | 爹味惩罚词 | **撤回调整** / **手动调减** | “纠偏”带有强烈的自上而下审判感，缺乏对孩子的温和包容 |
| `StreakFreezeModal.jsx:235` | 错记纠偏回收 | 仓储盘点词 | **误发撤回** / **张数调整** | 贴近日常生活语境 |
| `StreakFreezeModal.jsx:98,228` | 免死金牌 | 戏谑粗俗词 | **特许免打卡** / **生病特许卡** | 规范化为健康包容的豁免机制，避免口语化过度 |
| `Settings.jsx:1412` | 每日完成率达标阈值 (%) | 工业阈值黑话 | **每日连胜达标标准 (%)** | “阈值”为工程技术黑话，家长不易直观理解 |

---

### 4.2 ERP 仓储与电商词汇改造表 (ERP & Warehouse Terms)

| 所在文件与行号 | 当前问题词汇 | 问题类型 | Apple HIG 亲子原生规范文案 | 改造理由 |
|---|---|---|---|---|
| `StreakFreezeModal.jsx:147,150` | 📦 当前保护卡库存 | ERP 仓储词 | **孩子当前拥有** / **持有张数** | 保护卡是孩子的成就道具，不是仓库里的物料库存 |
| `StreakFreezeModal.jsx:162` | ● 库存已满 / ● 库存充足 | 仓储状态词 | **● 已达持有上限** / **● 余量充足** | 规范道具容量语义 |
| `child-pwa/src/api.js:97` | Out of stock: 库存不足 | 电商缺货词 | **已兑完** / **暂无余量** | 儿童商城亲近友好 |
| `Shop.jsx (parent):90,211,393` | 上架新商品 / 上架商品 | 电商零售词 | **添加新奖励** / **添加心愿** | 家长提供的是奖励与体验，不是电商货架上架物料 |
| `Shop.jsx (parent):110,120` | 下架商品 / 确定下架 | 电商零售词 | **暂停兑换** (兼容保留下架断言) | 柔和表达暂不提供兑换 |
| `Shop.jsx (parent):238,437` | 库存数量 (选填) / 留空为不限 | 仓储字段词 | **提供数量 (选填)** / **不限次数** | 表达可以兑换多少份/次 |

---

### 4.3 技术黑话与表单用语改造表 (Technical Jargon & Form Terms)

| 所在文件与行号 | 当前问题词汇 | 问题类型 | Apple HIG 亲子原生规范文案 | 改造理由 |
|---|---|---|---|---|
| `Shop.jsx (child):435,495` | 提交 / 提交心愿 | 技术表单词 | **许愿** / **发送给爸爸妈妈** | 儿童端心愿应强化“向父母表达愿望”的情感连接 |
| `StreakFreezeModal.jsx:257` | 确认提交 | 机械提交词 | **确认** / **保存** | Apple 原生模态统一使用明确动词 |
| `Bind.jsx (child):33` | 输入家长给您的访问码 | 爹味敬语/技术码 | **输入爸爸妈妈给你的 6 位绑定码** | 儿童端杜绝称呼“您”，化技术“访问码”为生活“绑定码” |
| `Settings.jsx:1542` | 需要家长审核确认 | 机械审批词 | **需家长确认发星** | 保持与 TodayDashboard 温暖点赞语调统一 |
| `FeedbackContext.jsx:60,77` | 确认提示 / 系统提示 | 默认框架词 | **操作确认** / **温馨提示** | 提升系统对话温度 |

---

### 4.4 单字成行（孤行）与挤压折行排查 (Orphan Characters & Squeezed Line Wraps)

1. **星期选择器 7 键并排 (`Settings.jsx:1513-1531`)**:
   - **现象**: 在 375px (iPhone SE) 视口下，`WEEKDAYS` 7 个按钮若带边框或 padding 不足，容易被挤压成纵向椭圆甚至文字折行。
   - **修复**: 必须强制 `flex: 1`, `min-width: 0`, `padding: 6px 0`, `white-space: nowrap`, `font-size: 0.82rem`, 无边框浅底。
2. **保护卡限额/星数 Pill Group (`Settings.jsx:1086-1130`)**:
   - **现象**: 包含 `[1张, 2张, 3张, 5张]` 胶囊，在父容器缩小时，“1张”中的“张”被挤到第 2 行形成孤字。
   - **修复**: `.pill-segment-btn` 必须具备 `white-space: nowrap !important; flex-shrink: 0; min-width: 36px;`。
3. **统计页指标单行栏 (`Analytics.jsx:435-439`)**:
   - **现象**: `⭐ 本期获得: +10 | 🛍️ 本期兑换: -5 | 💰 结余: 25` 三者并列在底栏，遇到 4 位数星数时直接换行，数字与货币符号断裂。
   - **修复**: 必须对每个数值增加 `white-space: nowrap; font-variant-numeric: tabular-nums;`，并在小屏下启用弹性自适应。
4. **儿童商城折扣小字 (`child-pwa/Shop.jsx:509`)**:
   - **现象**: `实付 8⭐ · 原价 10⭐ (80%)` 在卡片右下角狭窄宽度下，括号与百分号折行。
   - **修复**: 包裹在 `white-space: nowrap` 标签内，确保金额与比例始终保持同一行。

---

## 5. CSS 基础类缺失审计与系统基建补全清单

在排查 Parent Web 的全局样式表 `src/parent-web/src/index.css` 时，发现前端虽然在 JSX 中调用了部分 Apple iOS 原生类名，但**样式表中根本未声明这些类**，导致样式失效回退：

| 缺失/需增强类名 | 所在文件状态 | 影响组件 | Apple HIG 标准补全定义 |
|---|---|---|---|
| `.ios-separator` | ❌ `parent-web/src/index.css` **完全缺失** | 所有 Inset Grouped TableView | `height: 0.5px; background-color: var(--separator, #E5E5EA); margin-left: 16px;` |
| `.ios-time-input` | ❌ `parent-web/src/index.css` **完全缺失** | 时间与日期选择胶囊 | `border: none; background: rgba(118, 118, 128, 0.12); padding: 6px 10px; border-radius: 8px; font-size: 0.92rem; font-weight: 600; color: var(--text); font-family: inherit; font-variant-numeric: tabular-nums; outline: none;` |
| `.ios-group-label` | ❌ `parent-web/src/index.css` **完全缺失** | 表单分组上标文字 | `font-size: 0.78rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.02em; margin: 0 0 6px 16px;` |
| `.ios-switch` | ❌ 双端 CSS **均完全缺失** | 审核确认、开启开关 | 标准 51x31px 尺寸、绿色背景 (`#34C759`)、27px 白色纯圆滑块、平滑物理滑动动画 |
| `.ios-sheet-header` | ⚠️ 存在，但未适配无左侧按钮时的对称性 | 所有抽屉头部 | 当缺少左侧或右侧按钮时，标题必须绝对居中 (`position: absolute; left: 0; right: 0; text-align: center`)，左右留出 44px 触控空位 |

---

## 6. 改造后 Apple iOS 原生模态交互标准参考范式 (Code Pattern)

为确保下游 `coder` 在实施 `t_6147682b` 时有清晰统一的代码模板，特提供经过验证的标准范式：

### 标准模态导航栏与 Inset Grouped 表单范式 (JSX):

```jsx
{/* 标准 iOS 底部抽屉 Sheet */}
<div className=\"ios-sheet-overlay\" onClick={onClose}>
  <div className=\"ios-sheet-content\" onClick={(e) => e.stopPropagation()}>
    {/* 1. 居中 Handle Bar */}
    <div className=\"drawer-handle-bar\" />

    {/* 2. Apple iOS 标准对称导航栏 */}
    <div className=\"ios-sheet-header\">
      <button type=\"button\" className=\"ios-sheet-nav-btn\" onClick={onClose}>
        取消
      </button>
      <span className=\"ios-sheet-header-title\">添加日常任务</span>
      <button
        type=\"button\"
        className=\"ios-sheet-nav-action-btn\"
        disabled={!isValid || saving}
        onClick={handleSave}
      >
        {isEdit ? \"保存\" : \"添加\"}
      </button>
    </div>

    {/* 3. Sheet 内容区：Inset Grouped TableView */}
    <div className=\"ios-sheet-body\">
      {/* 分组 1: 基本信息 */}
      <div className=\"ios-grouped-card\" style={{ marginBottom: \"18px\" }}>
        {/* Row 1: 标题直接无边框输入 */}
        <div style={{ padding: \"12px 16px\" }}>
          <input
            type=\"text\"
            placeholder=\"任务名称，如：练琴20分钟、口算一页...\"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              width: \"100%\",
              border: \"none\",
              outline: \"none\",
              background: \"transparent\",
              fontSize: \"1.02rem\",
              color: \"var(--text)\",
              fontFamily: \"inherit\",
            }}
            autoFocus
          />
        </div>

        {/* 16px 缩进分割线 */}
        <div className=\"ios-separator\" />

        {/* Row 2: 预计时长 Stepper */}
        <div style={{ display: \"flex\", alignItems: \"center\", justifyContent: \"space-between\", padding: \"10px 16px\", minHeight: \"48px\" }}>
          <span style={{ fontSize: \"0.95rem\", color: \"var(--text)\", fontWeight: 500 }}>
            预计时长
          </span>
          <div style={{ display: \"flex\", alignItems: \"center\", gap: \"8px\" }}>
            <button type=\"button\" className=\"ios-stepper-btn\" onClick={handleMinusMinutes}>−</button>
            <span style={{ fontSize: \"0.95rem\", fontWeight: 600, minWidth: \"48px\", textAlign: \"center\" }}>
              {minutes} 分钟
            </span>
            <button type=\"button\" className=\"ios-stepper-btn\" onClick={handlePlusMinutes}>+</button>
          </div>
        </div>

        <div className=\"ios-separator\" />

        {/* Row 3: 奖励星星 Segmented Control */}
        <div style={{ display: \"flex\", alignItems: \"center\", justifyContent: \"space-between\", padding: \"10px 16px\", minHeight: \"48px\" }}>
          <span style={{ fontSize: \"0.95rem\", color: \"var(--text)\", fontWeight: 500 }}>
            奖励星星
          </span>
          <div className=\"ios-segmented-control\">
            {[0, 1, 2, 3, 5].map((starVal) => (
              <button
                key={starVal}
                type=\"button\"
                onClick={() => setStars(starVal)}
                className={`ios-segmented-item ${stars === starVal ? \"active\" : \"\"}`}
              >
                {starVal === 0 ? \"0星\" : `⭐ ${starVal}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 分组 2: 时间规划 (可选) */}
      <div className=\"ios-group-label\">时间安排 (可选)</div>
      <div className=\"ios-grouped-card\" style={{ marginBottom: \"18px\" }}>
        <div style={{ display: \"flex\", alignItems: \"center\", justifyContent: \"space-between\", padding: \"10px 16px\", minHeight: \"48px\" }}>
          <span style={{ fontSize: \"0.95rem\", color: \"var(--text)\", fontWeight: 500 }}>开始时间</span>
          <input type=\"time\" value={startTime} onChange={handleTimeChange} className=\"ios-time-input\" />
        </div>
        <div className=\"ios-separator\" />
        <div style={{ display: \"flex\", alignItems: \"center\", justifyContent: \"space-between\", padding: \"10px 16px\", minHeight: \"48px\" }}>
          <span style={{ fontSize: \"0.95rem\", color: \"var(--text)\", fontWeight: 500 }}>结束时间</span>
          <input type=\"time\" value={endTime} onChange={handleEndTimeChange} className=\"ios-time-input\" />
        </div>
      </div>

      {/* 分组 3: 需家长审核确认 (iOS Switch) */}
      <div className=\"ios-grouped-card\" style={{ marginBottom: \"20px\" }}>
        <label style={{ display: \"flex\", alignItems: \"center\", justifyContent: \"space-between\", padding: \"12px 16px\", cursor: \"pointer\" }}>
          <div>
            <span style={{ fontSize: \"0.95rem\", fontWeight: 500, color: \"var(--text)\" }}>需家长点赞确认发星</span>
            <p style={{ fontSize: \"0.74rem\", color: \"var(--muted)\", marginTop: \"2px\" }}>
              孩子打卡后不立即加星，需家长确认后发放
            </p>
          </div>
          <div className={`ios-switch ${requireApproval ? \"on\" : \"\"}`} onClick={() => setRequireApproval(!requireApproval)}>
            <div className=\"ios-switch-thumb\" />
          </div>
        </label>
      </div>

      {/* ⚠️ 底部严禁再添加全宽提交大按钮，空间完整释放给软键盘与滚动区 */}
    </div>
  </div>
</div>
```

---

## 7. 审计执行结论与验收判决 (Sign-off)

1. **缺陷闭环准则**: 下游 `coder` 在实施 `t_6147682b` 时，必须依据本审计清单逐一销项：
   - 16 处二级抽屉与模态框全面拔除“底部重复大按钮”与“不对称导航”；
   - 彻底清空全站剩余的 16 处原生 `<select>` 与原生复选框；
   - 补齐 `parent-web/src/index.css` 与 `child-pwa/src/index.css` 的缺失基础类；
   - 全量替换文案排查表中的金融风控、ERP 仓储与机械黑话；
   - 对 4 处断行孤字点施加 `white-space: nowrap` 布局硬约束。
2. **测试与回归基准**:
   - 前端双端测试：`src/parent-web` (`npm test`) 与 `src/child-pwa` (`npm test`) 保持 100% 通过（27项测试全部 PASS）；
   - 后端 Docker 服务与回归测试保持 100% 通过（78项测试全部 PASS）；
   - Docker 生产构建顺利产出。
