# Family Plan 交互原型与设计规范定型：全局模态抽屉、Inset Grouped 表单与亲子 UX 文案基线

> **文档属性**：Family Plan 亲子自律系统全站（Parent Web 与 Child PWA）交互设计规范唯一权威基准文档  
> **设计系统基准**：Apple iOS Human Interface Guidelines (HIG) & `DESIGN.md` (Google Design Token Spec)  
> **文档受众**：Product Designers, Frontend Developers (`coder`), Code Reviewers (`reviewer`), QA Engineers (`qa`)  
> **设计主理**：Senior Product & Interaction Designer  
> **生效版本**：v1.0.0 (Release Baseline)  

---

## 1. 核心交互设计规范与 Apple iOS HIG 基准定型

在 Apple 人机界面指南（HIG）中，优雅的体验源于“清晰（Clarity）、遵从（Deference）与纵深（Depth）”。功能代码跑通仅仅是工程起点，只有当用户在每一次触控、每一次滑开抽屉、每一次填写表单时感受到节奏感、呼吸感与被尊重的温情，体验才算真正定型。

### 1.1 全局模态抽屉导航栏规范 (Canonical 3-part Modal Navigation Bar)

全站所有二级浮层（Bottom Sheet 抽屉及居中模态框）必须严格采用 Apple iOS 经典的“三段式”对称导航栏体系，彻底废止 Web 时代的非对称堆叠与双重主动作按钮冲突：

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Apple iOS 标准模态抽屉头部                       │
├────────────────────────────────────────────────────────────────────────┤
│                               [ ─── ]  Handle Bar (36x5px, 居中)       │
│                                                                        │
│   [取消]                     [抽屉标题]                      [保存]    │
│  (Nav Button, 400 细体)   (17px / 600, 绝对居中)     (Action, 650 粗体)│
├────────────────────────────────────────────────────────────────────────┤
│                     ── 0.5px 分割线 (var(--separator)) ──              │
│                                                                        │
│  (内容区：Inset Grouped TableView，垂直滚动)                            │
│                                                                        │
│  ⚠️ 底部严禁再渲染 100% 全宽“保存/提交”大按钮，空间完整释放给虚拟键盘    │
└────────────────────────────────────────────────────────────────────────┘
```

#### 规范细则：
1. **居中 Handle Bar**：
   - 尺寸为 `36px × 5px`，圆角 `2.5px`，底色 `#D2D2D7`，上下边距 `margin: 10px auto 2px auto`。
   - 仅在移动端（`< 768px`）渲染，桌面端自动隐藏。
2. **三段式对称导航（Symmetrical Navigation Bar）**：
   - **左侧按钮 (`.ios-sheet-nav-btn`)**：文案固定为“取消”或“关闭”，字体字阶 `1rem` (16px)，字重 `400`（Regular），颜色为系统强调色 `var(--accent, #0071E3)`，最小触控热区 `44 × 44 pt`。
   - **中间标题 (`.ios-sheet-header-title`)**：采用 `position: absolute; left: 0; right: 0; text-align: center; pointer-events: none` 实现物理绝对居中，字阶 `1.05rem` (17px)，字重 `600`（Semibold），字距 `-0.015em`。
   - **右侧主动作按钮 (`.ios-sheet-nav-action-btn`)**：文案根据场景明确表达（如“添加”、“保存”、“登记”、“完成”），字阶 `1rem` (16px)，字重 `650`（Bold），颜色为 `var(--accent, #0071E3)`；未满足表单校验时置灰（`opacity: 0.35; cursor: not-allowed`）。
3. **彻底拔除底部冗余全宽大按钮（Eradication of Dual Primary Buttons）**：
   - **反模式现状**：早期部分表单在右上角放置“添加”，底部又堆叠 100% 宽度的 `btn-primary`“确认添加”，导致严重的视觉割裂并严重挤压小屏输入时的虚拟键盘空间。
   - **定型准则**：所有表单提交动作必须收敛至导航栏右侧主动作按钮，底部完全留白，杜绝双主按钮冲突。
4. **废除原生 Web 叉号 (`✕`)**：
   - 模态抽屉禁止使用字符 `✕`（如 `drawer-close-btn`），统一采用文字型“关闭”或“取消”。

---

### 1.2 Inset Grouped 表单与列表规范 (TableView Architecture)

表单设计杜绝“Label 置顶 + 1px 实线方框”的老旧后台系统风格，全站表单与配置列表一律收敛至 Apple Inset Grouped TableView 范式：

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Apple Inset Grouped TableView 结构                   │
├────────────────────────────────────────────────────────────────────────┤
│  分组小标 (0.78rem, 600, 大写微标, 左缩进 16px)                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Row 1: 标题直接输入 (无边框, 背景透明, 1.02rem, autoFocus)       │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ ────── 0.5px 细分割线 (左侧缩进 16px, 避开图标/边框) ───────── │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ Row 2: 预计时长                   [ − ]  20 分钟  [ + ] (Stepper)│  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ ────── 0.5px 细分割线 (左侧缩进 16px) ────────────────────────── │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ Row 3: 奖励星星                 [ 0星 ][ ⭐1 ][ ⭐2 ][ ⭐3 ] (Segment)│
│  └──────────────────────────────────────────────────────────────────┘  │
│  分组说明 (0.75rem, Muted 浅灰文本, 左缩进 16px, 行高 1.4)             │
└────────────────────────────────────────────────────────────────────────┘
```

#### 规范细则：
1. **纯白卡片容器 (`.ios-grouped-card`)**：
   - 底色 `#FFFFFF`，圆角 `14px`，无多层重阴影，仅施加 Apple 调和微投影 `box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)`。
   - 在灰色大画布（`#F5F5F7`）上形成温润清晰的视觉层次。
2. **无边框直接输入 (Borderless Direct Input)**：
   - 核心字段（如任务名、心愿名、孩子姓名）直接嵌入首行，去掉边框与背景色（`border: none; outline: none; background: transparent; padding: 12px 16px`），字阶 `1.02rem`，提示占位符颜色使用次级灰。
3. **0.5px 左缩进分割线 (`.ios-separator`)**：
   - 行间分割线高度固定为 `0.5px`，底色 `var(--separator, #E5E5EA)`。
   - 必须设置 `margin-left: 16px`，使其起点与行内文本对齐，末端直达卡片右侧边缘；最后一行底部严禁添加分割线。
4. **行高与触控热区**：
   - 列表行最小高度保证为 `48px ~ 52px`，内边距 `padding: 10px 16px`，确保移动端触控极其舒适。
5. **分组微标与说明文本**：
   - **分组上标 (`.ios-group-label`)**：字阶 `0.78rem`，字重 `600`，字距 `+0.02em`，大写或中性词，左外边距 `16px`。
   - **分组后置说明**：字阶 `0.75rem`，行高 `1.4`，颜色 `var(--muted)`，边距 `margin: 4px 16px 18px 16px`。

---

### 1.3 核心控件体系规范 (Native iOS Control System)

全站坚决清退所有未封装的浏览器原生 `<select>`、复选框 `<input type="checkbox">` 以及散落的数字加减框，统一落位为原生 iOS 控件：

| 控件类型 | 对应标准 iOS 规范 | 视觉与交互参数 | 禁止使用的反模式 |
|---|---|---|---|
| **选项切换 (≤5项)** | **iOS Segmented Control** (`.ios-segmented-control`) | 灰色胶囊槽 (`rgba(118, 118, 128, 0.12)`)，圆角 `9px`，内嵌纯白激活卡片，带微阴影，等宽弹性排布 | 严禁使用浏览器原生 `<select>` 下拉框与黑色双三角箭头 |
| **数值增减 (1~N)** | **iOS Stepper** (`.ios-stepper-btn`) | 左右 `32 × 32 px` 圆形微按钮，底色浅灰，内含居中加粗 `−` 与 `+`；中间居中等宽显示数值 | 严禁使用原生 `<input type="number">` 浏览器自带微调小箭头 |
| **状态开闭 (Bool)** | **iOS Switch** (`.ios-switch`) | 标准尺寸 `51 × 31 px`，绿色底槽（`#34C759`，激活时）与灰白底槽（`#E9E9EB`，关闭时）；`27px` 白色纯圆滑块，`0.25s` 平滑滑动物理弹性 | 严禁使用原生方形 Checkbox，或用写着“开/关”字样的小按钮替代 |
| **时间与日期** | **iOS Time Capsule** (`.ios-time-input`) | 浅灰半透明胶囊 (`rgba(118, 118, 128, 0.12)`)，圆角 `8px`，内边距 `6px 10px`，等宽数字字体 `font-variant-numeric: tabular-nums` | 严禁使用带边框方块或裸露无背景原生日期框 |

---

### 1.4 毛玻璃底衬与弹窗规范 (Blur Backdrops & Alert Modals)

1. **背景遮罩 (Modal Backdrop)**：
   - 统一采用半透明深色叠加强度适中的硬件加速毛玻璃：
     ```css
     background-color: rgba(0, 0, 0, 0.35);
     backdrop-filter: blur(20px) saturate(180%);
     -webkit-backdrop-filter: blur(20px) saturate(180%);
     ```
2. **iOS 原生风格确认与提示弹窗 (Alert Modal)**：
   - 宽度固定 `270px ~ 300px`，圆角 `16px ~ 20px`，居中排版。
   - 标题居中粗体（`1.02rem`, 600），说明文案居中（`0.85rem`, 400）。
   - 底部操作按钮栏为标准 `50 / 50` 左右分等宽排布，上方带有 `0.5px` 分割线，中间带有 `0.5px` 垂直分割线。
   - **左侧按钮**：取消（400 细体，蓝色）；**右侧按钮**：主确认（600 粗体，常规操作蓝色，危险破坏操作使用 `#FF3B30` 红色）。
   - 彻底废除桌面 Web 偏右下角堆叠灰色小方块按钮的生硬布局。

---

### 1.5 触控工效学与视口留白规范 (Ergonomics & Typography Discipline)

1. **最小触控热区**：
   - 遵守 Apple 44pt 规则，所有可点击控件（按钮、分段项、步进器、关闭图标）的触控命中区域不得低于 `44 × 44 pt`。
2. **移动端视口左右基准留白**：
   - 在移动端视口（`< 768px`），页面容器与抽屉内容区严格执行左右 `16px` 留白（`padding: 0 16px`），既不贴边造成压迫，也不浪费有限的视口宽度。
3. **单字成行（孤行）与排版折行严厉治理**：
   - 强制在星期分段、星数角标、折扣标识和数据指标上施加 `white-space: nowrap !important` 与 `flex-shrink: 0`，配合 `font-variant-numeric: tabular-nums`，严禁“1张”中的“张”被挤到次行。
4. **彻底清空虚线边框 (Zero Dashed Borders)**：
   - 废止全站一切 `border: 1.5px dashed`，改用纯净的 Apple 调和实线或浅色纯净微底色卡片。

---

## 2. 亲子 UX 文案基线与全量词典对照规范

### 2.1 语气与心智模型 (Tone of Voice)
家庭自律系统不是企业资源计划（ERP）库存系统，也不是商业银行信贷风控平台。孩子在使用应用时建立的是对时间的掌控感和与父母之间的信任纽带，家长在使用时体现的是支持、肯定与温和边界。

- **我们要传达的感受**：温暖鼓励、亲切平等、自律自主、清晰可信。
- **我们要杜绝的感受**：监控惩罚、机械冰冷、买卖货架、距离敬语。

---

### 2.2 金融风控词汇全面清退与转化对照表 (Financial & Risk Control Terms)

| 所在模块与位置 | 遗留问题词汇 | 问题归类 | Apple 亲子规范标准文案 | 交互场景与设计理由 |
|---|---|---|---|---|
| `Settings.jsx` 抽屉标题 | 连击保护卡与风控 | 金融风控黑话 | **连击保护卡** / **保护卡设置** | 保护卡是帮孩子应对生病突发情况的暖心道具，非信贷风控 |
| `Settings.jsx` 页面副标题 | 习惯风控管理 | 金融管理用语 | **家庭档案与习惯规则** | 将冷硬的“风控”还原为充满生活气息的“家庭习惯规则” |
| `Settings.jsx` Toast 提示 | 连击保护卡风控规则已保存 | 金融风控黑话 | **保护卡规则已保存** | 界面反馈杜绝风控泄漏 |
| `StreakFreezeModal.jsx` 标题 | 抵扣与流转历史流水 | 银行流水账目 | **卡片使用记录** / **变动明细** | 孩子使用保护卡是习惯豁免，非资金流水划扣 |
| `Shop.jsx (Child PWA)` 列表 | 我的兑换流水 | 会计财务黑话 | **我的兑换记录** | 儿童端必须清晰直观、亲切易懂 |
| `StreakFreezeModal.jsx` 按钮 | 纠偏扣除 / 错记纠偏回收 | 审判惩戒用语 | **手动调减** / **误发撤回** | “纠偏”带有自上而下的冷酷审判感，缺乏对孩子的包容 |
| `StreakFreezeModal.jsx` 预设 | 免死金牌 | 戏谑粗俗用语 | **特许免打卡** / **生病特许免打卡** | 规范为健康包容的健康与突发豁免机制，提升用语格调 |
| `Settings.jsx` 表单项 | 每日完成率达标阈值 (%) | 工业阈值黑话 | **每日连胜达标标准 (%)** | “阈值”为工程技术黑话，家长不易直观理解 |
| `Settings.jsx` 调整原因 | 家长手动纠偏调减 | 冷硬管理词 | **家长手动调减** | 去除纠偏，语言保持克制温润 |

---

### 2.3 ERP 仓储与电商词汇全面清退与转化对照表 (ERP & Warehouse Terms)

| 所在模块与位置 | 遗留问题词汇 | 问题归类 | Apple 亲子规范标准文案 | 交互场景与设计理由 |
|---|---|---|---|---|
| `StreakFreezeModal.jsx` 区域 | 📦 当前保护卡库存 | ERP 仓储字段 | **孩子当前拥有** / **持有张数** | 道具是属于孩子的成就资产，不是仓储物料 |
| `StreakFreezeModal.jsx` 徽标 | ● 库存已满 / ● 库存充足 | 仓储状态标签 | **● 已达持有上限** / **● 余量充足** | 贴近游戏化成就道具的容量表达 |
| `child-pwa/src/api.js` 异常提示 | Out of stock: 库存不足 | 电商缺货提示 | **已兑完** / **暂无余量** | 儿童商城亲近友好 |
| `Shop.jsx (Parent Web)` 抽屉标题 | 上架新商品 / 编辑商品 | 电商零售货架 | **添加新奖励** / **编辑心愿奖励** | 家长提供的是成就激励与亲子体验，不是货架商品 |
| `Shop.jsx (Parent Web)` 操作 | 确认上架 / 下架商品 | 电商零售动作 | **添加** / **暂停兑换** | 表达暂时不向孩子开放兑换，保留友好缓冲 |
| `Shop.jsx (Parent Web)` 表单项 | 库存数量 (选填) | 仓储盘点字段 | **提供数量 (选填)** | 表达可以兑换多少份或多少次 |
| `Shop.jsx (Parent Web)` 占位符 | 留空为不限 | 数据库默认值 | **不限次数** | 明确生活化含义 |
| `Shop.jsx (Child PWA)` 列表 | 暂无可兑换商品 | 电商空货架 | **暂无心愿奖励** | 强化心愿与鼓励氛围 |

---

### 2.4 技术黑话与冷硬表单用语全面清退与转化对照表 (Technical & Form Jargon)

| 所在模块与位置 | 遗留问题词汇 | 问题归类 | Apple 亲子规范标准文案 | 交互场景与设计理由 |
|---|---|---|---|---|
| `Shop.jsx (Child PWA)` 按钮 | 提交 / 提交心愿 | 机械表单动作 | **许愿** / **发送给爸爸妈妈** | 儿童端心愿输入强化向父母表达心声的情感纽带 |
| `StreakFreezeModal.jsx` 提交 | 确认提交 | 机械表单动作 | **确认** / **保存** | Apple 原生标准统一使用精准简洁的动词 |
| `Bind.jsx (Child PWA)` 副标题 | 输入家长给您的访问码 | 生硬敬语与技术码 | **输入爸爸妈妈给你的 6 位绑定码** | 儿童端禁止对孩子称呼“您”，化“访问码”为“绑定码” |
| `Bind.jsx (Child PWA)` 占位符 | 6 位访问码 | 技术授权码 | **6 位绑定码** | 统一全站命名一致性 |
| `Settings.jsx` 选项行 | 需要家长审核确认 | 机械审批流程 | **需家长点赞确认发星** | 与 TodayDashboard 温暖点赞语调统一，弱化审查感 |
| `FeedbackContext.jsx` 默认标题 | 确认提示 / 系统提示 | 框架脚手架词 | **操作确认** / **温馨提示** | 提升对话温度 |
| `TodayDashboard.jsx` 待办 | 待审核任务 | 审批卡点 | **待点赞确认** | 用“点赞”代替“审核”，化卡点为父母的肯定契机 |

---

### 2.5 单字成行（孤行）与挤压排版排查治理表 (Anti-Wrap Discipline)

| 所在模块与控件 | 排版缺陷现象 | 隐患视口区间 | 强制 CSS 治理规范 | 预期验收效果 |
|---|---|---|---|---|
| `Settings.jsx` 星期选择 7 键并排 | 按钮带实线边框或 padding 过大，在小屏下被挤成纵向椭圆甚至数字折行 | iPhone SE (375px) | `flex: 1; min-width: 0; padding: 6px 0; white-space: nowrap !important; font-size: 0.82rem; border: none;` | 7 键完美均分宽度，文本单行居中 |
| `Settings.jsx` 保护卡张数 Pill 组 | 父容器缩小时，“1张”中的“张”被挤到次行形成孤字 | 375px ~ 414px | `.pill-segment-btn { white-space: nowrap !important; flex-shrink: 0; min-width: 36px; }` | 张数与数字始终保持同一行 |
| `Analytics.jsx` 底部统计汇总栏 | `⭐获得 / 🛍️兑换 / 💰结余` 并列一行，星数超 4 位时换行割裂 | 移动端各视口 | 每一项增加 `white-space: nowrap; font-variant-numeric: tabular-nums;`，外层支持弹性折行换行 | 金额与符号绝不断裂 |
| `Shop.jsx (Child PWA)` 折扣小字 | `实付 8⭐ · 原价 10⭐ (80%)` 在卡片右下角狭窄处发生括号与比例断行 | iPad 分屏与小屏 | 包裹在 `white-space: nowrap` 标签内，配合 `flex-shrink: 0` | 优惠信息整行清晰呈现 |

---

## 3. 双端全量页面与抽屉组件设计审查矩阵 (Universal Component Matrix)

本矩阵覆盖整个项目 **16 处二级抽屉/模态框 (M1 ~ M16)** 与 **6 处独立页面表单 (P1 ~ P6)**，为每一处组件确立明确的 Apple iOS HIG 验收基准与 **7 大显式交互状态**（Default 默认、Pressed/Active 点击按压、Loading 加载中、Empty 空状态、Disabled 禁用、Error 错误提示、Partial Data 部分数据）。

---

### 3.1 全量 16 个二级抽屉/模态框定型矩阵 (Modals & Sheets M1 ~ M16)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                全站 16 处抽屉与模态框 HIG 改造定型清单                                │
├─────┬───────────────────────┬──────────────────────┬─────────────────────────────────────────────────┤
│ 编号│ 所在文件              │ 组件/抽屉名称        │ 核心定型要点与 Apple iOS HIG 改造标准            │
├─────┼───────────────────────┼──────────────────────┼─────────────────────────────────────────────────┤
│ M1  │ Analytics.jsx         │ 休假模式管理抽屉     │ 对称导航 (左取消/中休假模式/右登记) + Inset Grouped│
│ M2  │ Settings.jsx          │ 家庭与孩子档案抽屉   │ 对称导航 (左关闭/中档案/右+添加) + Grouped 卡片行│
│ M3  │ Settings.jsx          │ iPad设备配对码抽屉   │ 对称导航 (右完成) + Segmented 孩子切换 + 无虚线卡│
│ M4  │ Settings.jsx          │ 例行任务模板库抽屉   │ 对称导航 (左关闭/中模板库/右+添加) + Stepper/星数│
│ M5  │ Settings.jsx          │ 连击保护卡设置抽屉   │ 对称导航 (左取消/右保存) + 彻底删除内部保存大按钮│
│ M6  │ Settings.jsx          │ 编辑孩子档案模态框   │ 对称导航 (左取消/右保存) + 彻底移除底部全宽大按钮│
│ M7  │ Settings.jsx          │ 添加孩子档案模态框   │ 对称导航 (左取消/右添加) + Inset Grouped 字段卡片│
│ M8  │ Settings.jsx          │ 连胜达标标准模态框   │ 对称导航 (左取消/右保存) + 去“阈值”技术词汇      │
│ M9  │ Settings.jsx          │ 添加每周循环任务模态 │ 对称导航 (右添加) + Stepper 时长 + Segment 星数  │
│ M10 │ Shop.jsx (Parent Web) │ 奖励添加/编辑抽屉    │ 对称导航 (左取消/右保存) + 去“库存/上架”ERP黑话  │
│ M11 │ Shop.jsx (Child PWA)  │ 向家长许愿抽屉       │ 对称导航 (左取消/右许愿) + 彻底移除底部提交大按钮│
│ M12 │ Today.jsx (Child PWA) │ 添加任务抽屉与排程   │ 对称导航 (左取消/右添加) + 行内废除原生 <select> │
│ M13 │ TodayDashboard.jsx    │ 任务添加/编辑抽屉    │ 对称导航 (左取消/右保存) + Stepper/Switch/时间胶囊│
│ M14 │ TaskCopilotModal.jsx  │ AI 建议建任务抽屉    │ 对称导航 (左取消/中AI建议/右发布) + 时间胶囊     │
│ M15 │ StreakFreezeModal.jsx │ 保护卡独立管理抽屉   │ 对称导航 (居中标题/右完成) + 去“流水/库存/免死金牌│
│ M16 │ FeedbackContext.jsx   │ 系统确认与提示弹窗   │ 对齐 Child 端 16px 圆角毛玻璃 + 50/50 居中双分栏 │
└─────┴───────────────────────┴──────────────────────┴─────────────────────────────────────────────────┘
```

#### 逐个组件的 7 大交互状态与验收规格：

#### [M1] Analytics.jsx — 休假模式管理抽屉 (`showVacationModal`)
- **导航栏标准**：`ios-sheet-header`，左侧 [取消]，中间 [休假模式]，右侧 [登记]（起止日期未填时 `disabled`）。
- **表单布局**：Inset Grouped 卡片，3 行（开始日期、结束日期、休假原因），采用 `.ios-time-input` 与 `.ios-separator`。
- **状态规格**：
  - *Default*：展示当前选择的默认起止日期，休假原因占位符“选填，如：期末出游、生病”。
  - *Pressed*：轻点“登记”按钮呈现微透明反馈（`opacity: 0.6`）。
  - *Loading*：登记中禁用动作按钮并显示“登记中…”，列表加载时显示居中“加载中…”。
  - *Empty*：已设置休假为 0 时，显示干净纯白的空状态卡片：“暂无休假记录 · 轻点右上角‘登记’新增休假区间”。
  - *Disabled*：起止日期为空或开始日期大于结束日期时，右侧“登记”不可点。
  - *Error*：接口报错时在卡片上方呈现浅红背景提示条（`var(--danger-bg)`），自动换行不遮挡表单。
  - *Partial Data*：只有 1 条休假时紧凑展示，超过 4 条启用抽屉内部滚动。

#### [M2] Settings.jsx — 家庭与孩子档案抽屉 (`activeDrawer === "profiles"`)
- **导航栏标准**：左侧 [关闭]，中间 [家庭与孩子档案]，右侧动作按钮 [+ 添加]（打开添加模态框）。
- **列表布局**：纯白 Inset Grouped 卡片，每位孩子为一行，左侧为圆形头像微标、姓名、学段年级；右侧为编辑胶囊。
- **状态规格**：
  - *Default*：列表呈现所有孩子档案，信息对齐。
  - *Empty*：家庭无孩子档案时渲染温暖插画空状态 `WarmEmptyState`。
  - *Loading*：保存或拉取档案时呈现流畅占位。

#### [M3] Settings.jsx — iPad 设备配对码抽屉 (`activeDrawer === "accessCode"`)
- **导航栏标准**：居中 [设备配对码]，右侧动作按钮 [完成]。
- **布局规范**：多孩子时顶部分段选择；配对码展示废除虚线框，改用纯净白卡底（`background: #FFFFFF`），大字阶等宽粗体 (`letter-spacing: 0.25em, font-variant-numeric: tabular-nums`)。
- **文案规范**：副标题文案统一为“在儿童 iPad 端打开应用并输入 6 位配对码即可自动绑定，24 小时内有效：”。
- **状态规格**：
  - *Default*：显示未生成状态提示或当前生成的 6 位清晰大码与剩余有效倒计时。
  - *Pressed*：“重新生成配对码”按压态缩放。
  - *Loading*：生成中按钮置灰并显示“生成中…”。

#### [M4] Settings.jsx — 例行任务模板库抽屉 (`activeDrawer === "routineTasks"`)
- **导航栏标准**：左侧 [关闭]，中间 [例行任务模板库]，右侧动作按钮 [+ 添加]。
- **控件规范**：多孩子切换采用 iOS Segmented Control；模板卡片采用 Inset Grouped TableView，行间 0.5px 分割线。
- **状态规格**：
  - *Empty*：当前孩子无循环模板时展示“暂无例行任务模板”。

#### [M5] Settings.jsx — 连击保护卡设置抽屉 (`activeDrawer === "freeze"`)
- **导航栏标准**：左侧 [取消]，中间 [连击保护卡]，右侧主动作 [保存]（`disabled={savingFreezeRules}`）。
- **结构重塑**：**彻底删除卡片内原有的独立矩形大按钮“保存规则修改”**，所有修改统一在右上角“保存”提交。
- **文案去风控**：彻底清空“流水”、“纠偏”，替换为“卡片使用记录”、“手动调减”。

#### [M6] Settings.jsx — 编辑孩子档案模态框 (`editingChild`)
- **导航栏标准**：左侧 [取消]，中间 [编辑孩子档案]，右侧 [保存]。
- **反模式拔除**：**彻底删除底部全宽 `btn-primary`“保存修改”大按钮**。
- **表单布局**：Inset Grouped TableView，姓名无框直接输入；学段年级内嵌；连胜达标线右侧胶囊输入。

#### [M7] Settings.jsx — 添加孩子档案模态框 (`showAddChild`)
- **导航栏标准**：左侧 [取消]，中间 [添加孩子]，右侧 [添加]。
- **反模式拔除**：**彻底删除底部全宽“确认添加”大按钮**。

#### [M8] Settings.jsx — 连胜达标标准模态框 (`rewardChild`)
- **导航栏标准**：左侧 [取消]，中间 [{child.name} 连胜规则]，右侧 [保存]。
- **文案更新**：将“每日完成率达标阈值”全面修正为“每日连胜达标标准 (%)”。
- **反模式拔除**：彻底删除底部“保存设定”大按钮。

#### [M9] Settings.jsx — 添加每周循环例行任务模态框 (`showAddRoutine`)
- **导航栏标准**：左侧 [取消]，中间 [添加例行任务]，右侧 [添加]。
- **控件重塑**：预计时长改用 **iOS Stepper** (`−` 与 `+`)；奖励星星改用 **iOS Segmented Control**；“需家长点赞确认发星”改用 **iOS Switch**；7 星期选择按钮强制 `white-space: nowrap` 防折行。
- **反模式拔除**：**彻底删除底部全宽“确认添加”大按钮**。

#### [M10] Shop.jsx (Parent Web) — 奖励管理抽屉 (`itemModal`)
- **导航栏标准**：左侧 [取消]，中间 [添加新奖励 / 编辑心愿奖励]，右侧 [添加 / 保存]。
- **文案全面去 ERP**：消灭“上架新商品”、“库存数量”、“留空为不限”，转换为“添加新奖励”、“提供数量 (选填)”、“不限次数”。
- **反模式拔除**：**彻底删除底部“确认上架 / 保存修改”大按钮**。

#### [M11] Shop.jsx (Child PWA) — 向家长许愿抽屉 (`showWish`)
- **导航栏标准**：左侧 [取消]，中间 [向家长许愿]，右侧 [许愿]。
- **反模式拔除**：**彻底删除原 L480-L496 的 100% 全宽“提交心愿”大按钮**！
- **文案亲情化**：占位语调整为“想要什么愿望？告诉爸爸妈妈吧”。

#### [M12] Today.jsx (Child PWA) — 添加任务抽屉 (`showAdd`) & 行内排程
- **导航栏标准**：左侧 [取消]，中间 [添加任务]，右侧 [添加]。
- **反模式拔除**：**彻底删除原 L638 的底部全宽“添加任务”大按钮**。
- **行内编辑改造**：废除 `RewardSelect` 的原生 `<select>` 下拉框，改用水平星数点选控制条；时间输入改用胶囊样式。

#### [M13] TodayDashboard.jsx (Parent Web) — 任务添加与编辑抽屉 (`showTaskModal`)
- **导航栏标准**：左侧 [取消]，中间 [添加今日任务 / 编辑任务]，右侧 [添加 / 保存]。
- **控件升级**：预计时长采用 Stepper，奖励星星采用 Segmented Control，需家长确认采用 iOS Switch，起止时间采用 `.ios-time-input`。
- **反模式拔除**：**彻底删除原底部全宽“保存修改 / 确认添加”大按钮**。

#### [M14] TaskCopilotModal.jsx (Parent Web) — AI 建议建任务抽屉
- **导航栏标准**：左侧 [取消]，中间 [AI 建议建任务]，右侧根据草稿状态呈现动作按钮 [发布]。
- **输入原生化**：日期选择与草稿项时间输入全面采用原生胶囊样式，草稿内部星数废除原生 `<select>`。

#### [M15] StreakFreezeModal.jsx (Parent Web) — 连击保护卡独立抽屉模态框
- **导航栏标准**：对称化导航栏，居中 [连击保护卡 · {孩子姓名}]，右侧 [完成]。
- **文案与结构**：彻底消除“库存”、“流水”、“免死金牌”，调整理由采用 Inset Grouped 单行无框输入。

#### [M16] FeedbackContext.jsx (Parent Web) — 确认与提示弹窗
- **Alert 标准**：对齐 Child PWA 的 `ChildFeedback.jsx`，毛玻璃背景，居中标题与文案，底部标准 `50 / 50` 左右分栏按钮，消灭右下角方块小按钮。

---

### 3.2 全量 6 个独立页面表单定型矩阵 (Pages P1 ~ P6)

| 页面编号 | 文件路径 | 现存反模式与缺陷 | Apple iOS HIG 改造定型标准 |
|---|---|---|---|
| **P1** | `src/parent-web/src/pages/ChildCreate.jsx` | `← 返回` 文本、Label 置顶带框输入、2 处原生 `<select>`、底部全宽按钮 | 规范 iOS 导航栏（居中标题，左侧返回文字），核心字段转为 Inset Grouped TableView，学段年级转为 iOS 列表选择 |
| **P2** | `src/parent-web/src/pages/TaskManage.jsx` | 任务行内展开旧表单、原生 `<select>` 选星、裸露 time/date 框、原生复选框 | 行内展开表单收敛至标准 `TaskModal` 模态抽屉（复用 TodayDashboard），全量清空 `<select>` 与原生复选框 |
| **P3** | `src/parent-web/src/pages/RewardSettings.jsx` | 彩色装饰渐变背景、文字“开/关”方块按钮、`1.5px dashed` 虚线按钮 | 移除彩色渐变，回归纯净中性底卡；状态开关转为标准 **iOS Switch**；虚线按钮改为 Inset Grouped 纯文字动作行 |
| **P4** | `src/parent-web/src/pages/Home.jsx` | 遗留早期行内编辑表单，含有原生 `<select>` 与方块输入框 | 废除 Home.jsx 中过时的行内编辑逻辑，统一重定向或调起 Settings.jsx 的标准 Sheet |
| **P5** | `src/child-pwa/src/pages/Bind.jsx` | 敬语“您”、“输入家长给您的访问码”、`border: 2px solid` 粗边框大方块 | 文案改为“输入爸爸妈妈给你的 6 位绑定码”；输入框转为轻浅微底色圆角卡片，等宽防抖排版 |
| **P6** | `src/parent-web/src/components/WarmEmptyState.jsx` | 图标外圆使用 `border: 1.5px dashed var(--accent-pill)` 虚线噪点 | 废除虚线边框，改为纯净柔光微底色背景 (`background: var(--accent-light)`)，完全消除视觉颗粒噪点 |

---

## 4. 样式令牌与 CSS 基础类权威参考 (Design Tokens & Classes)

为保证代码层面 100% 具备上述样式支持，Parent Web 与 Child PWA 的全局样式表中必须完整声明以下规范类名：

```css
/* ==========================================================================
   Apple iOS HIG 基础交互类名定义 (Parent Web & Child PWA 共享基线)
   ========================================================================== */

/* 1. 0.5px 左缩进极细分割线 */
.ios-separator {
  height: 0.5px;
  background-color: var(--separator, #E5E5EA);
  margin-left: 16px;
}

/* 2. Apple 标准 Inset Grouped 白底圆角卡片 */
.ios-grouped-card {
  background: #FFFFFF;
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.04);
}

/* 3. 分组微标题 (Section Header Label) */
.ios-group-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--muted, #86868B);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  margin: 0 0 6px 16px;
}

/* 4. 时间与日期输入胶囊 */
.ios-time-input {
  border: none;
  background: rgba(118, 118, 128, 0.12);
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--text, #1D1D1F);
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  outline: none;
}

/* 5. iOS 标准触摸步进器按钮 (32x32px) */
.ios-stepper-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(118, 118, 128, 0.12);
  color: var(--accent, #0071E3);
  font-size: 1.15rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.1s ease;
  user-select: none;
}

.ios-stepper-btn:active {
  background: rgba(118, 118, 128, 0.22);
  transform: scale(0.94);
}

/* 6. Apple 51x31px 滑动开关 (iOS Switch) */
.ios-switch {
  position: relative;
  width: 51px;
  height: 31px;
  background-color: #E9E9EB;
  border-radius: 31px;
  cursor: pointer;
  transition: background-color 0.25s ease;
  user-select: none;
  flex-shrink: 0;
  display: inline-block;
}

.ios-switch.on {
  background-color: #34C759;
}

.ios-switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 27px;
  height: 27px;
  background-color: #FFFFFF;
  border-radius: 50%;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15), 0 1px 1px rgba(0, 0, 0, 0.16);
  transition: transform 0.25s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.ios-switch.on .ios-switch-thumb {
  transform: translateX(20px);
}

/* 7. 分段选择器 (Segmented Control) */
.ios-segmented-control {
  display: flex;
  background-color: rgba(118, 118, 128, 0.12);
  border-radius: 9px;
  padding: 2px;
  user-select: none;
}

.ios-segmented-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--muted, #86868B);
  border-radius: 7px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
  white-space: nowrap !important;
}

.ios-segmented-item.active {
  background-color: #FFFFFF;
  color: #000000;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.06);
}
```

---

## 5. 研发与 QA 验收核对清单 (Engineering & QA Acceptance Criteria)

下游角色（`coder` 实施、`reviewer` 审查、`qa` 验收）在执行测试与验收时，必须依据以下判定项进行逐一核销：

### 5.1 模态抽屉导航栏规范验收 (Navigation Bar Checklist)
- [ ] **[NAV-01] Handle Bar 一致性**：所有抽屉顶部正中具备 `36 × 5 px`（圆角 `2.5px`，底色 `#D2D2D7`）拖拽把手（移动端显示，桌面端自动隐藏）。
- [ ] **[NAV-02] 三段式对称布局**：所有抽屉头部标题使用 `position: absolute; left: 0; right: 0; text-align: center` 物理居中（17px / 600），两侧具备对称的取消/动作按键或占位。
- [ ] **[NAV-03] 零底部重复大按钮**：所有 16 个二级模态框/抽屉底部**绝无** 100% 全宽的大按钮（如 `btn-primary`“确认添加”、“保存修改”、“提交心愿”），表单提交统一收敛至右上角。
- [ ] **[NAV-04] 废除原生叉号**：关闭交互统一使用文字型“取消”或“关闭”，无裸露 `✕` 字符。

### 5.2 表单与 Inset Grouped 规范验收 (Forms & Tables Checklist)
- [ ] **[FORM-01] 纯白圆角分组卡片**：表单收敛至 `.ios-grouped-card`，底色 `#FFFFFF`，圆角 `14px`，无刺眼外边框。
- [ ] **[FORM-02] 无边框直接输入**：标题类输入项无实线外框、无背景底色，聚焦时不出现浏览器默认黑色外光晕。
- [ ] **[FORM-03] 0.5px 极细分割线**：行间分割线高度为 `0.5px`，左缩进 `16px`，卡片最后一行底部无分割线。
- [ ] **[FORM-04] 全站零原生 `<select>`**：全站代码搜索 `<select`，结果除测试 Mock 之外必须为 **0**。选项一律使用 Segmented Control 或 Inset Grouped 选择项。
- [ ] **[FORM-05] 步进器触控体验**：预计时长等增减数值项使用 `32 × 32 px` 圆形 `.ios-stepper-btn`，按压反馈平滑。
- [ ] **[FORM-06] iOS Switch 开关**：所有家长审核、功能开闭采用 `51 × 31 px` 绿色滑动开关，无原生方块复选框。
- [ ] **[FORM-07] 时间日期胶囊化**：所有时间与日期输入框使用 `.ios-time-input` 胶囊，时间段中间使用自然居中短横线或中圆点。

### 5.3 UX 文案与亲子温度验收 (Copywriting Checklist)
- [ ] **[COPY-01] 金融风控词清零**：全站界面文本搜索“风控”、“流水”、“纠偏”、“阈值”，匹配结果必须为 **0**。
- [ ] **[COPY-02] ERP 仓储词清零**：全站界面文本搜索“库存”、“上架”、“下架”，匹配结果必须为 **0**。
- [ ] **[COPY-03] 敬语与技术词清零**：儿童端（Child PWA）搜索“您”、“访问码”，匹配结果必须为 **0**，统一采用亲切的“你”、“绑定码”。
- [ ] **[COPY-04] 审批词转化为肯定词**：“需要家长审核确认”全量升级为“需家长点赞确认发星”。

### 5.4 视口排版与防折行验收 (Typography & Layout Checklist)
- [ ] **[LAYOUT-01] 视口呼吸留白**：移动端视口（iPhone SE 375px 至 iPhone 15 Pro Max 430px）左右边距稳定维持 `16px`。
- [ ] **[LAYOUT-02] 星期选择防挤压**：7 天循环星期选择器在 375px 窄屏视口下字级适中，无纵向挤压拉伸或折行。
- [ ] **[LAYOUT-03] 胶囊标签防孤字**：“1张”、“2张”、“⭐ 1”、“支付 80%”等标签具备 `white-space: nowrap`，绝无单字断行掉入下一行。
- [ ] **[LAYOUT-04] 虚线边框清零**：全站 CSS 与内联样式搜索 `dashed`，除历史注释外匹配结果必须为 **0**。

### 5.5 无障碍与端到端测试验收 (Accessibility & QA Baseline)
- [ ] **[A11Y-01] WCAG 2.2 AA 对比度**：正文文字与底色对比度 ≥ 4.5:1，大标题对比度 ≥ 3.0:1。`npx @google/design.md lint DESIGN.md` 验证通过 0 错误。
- [ ] **[TEST-01] 双端单元与集成测试**：
  - `src/parent-web`: `npm test` 保持 100% 通过（17/17 PASS）。
  - `src/child-pwa`: `npm test` 保持 100% 通过（10/10 PASS）。
  - `src/backend`: `pytest` 保持 100% 通过（78/78 PASS）。
- [ ] **[BUILD-01] 生产构建**：双端 `npm run build` 0 警告、0 报错产出生产静态产物。

---

## 6. 设计交接与后续协同准则 (Handoff & Governance)

1. **唯一权威基准**：本规范与 `DESIGN.md` 作为 Family Plan 交互与视觉验收的唯一真理之源（Single Source of Truth）。任何新增业务组件不得跳出 Inset Grouped、三段式模态导航与亲子温语文案体系。
2. **下游角色协同**：
   - 研发专家 (`coder`)：对照第 3 章矩阵与第 5 章清单逐一补齐 JSX 结构与 CSS 基础类。
   - 代码审查员 (`reviewer`)：依据第 5 章核对清单执行无死角 Diff 审查，发现残留 `<select>`、底部重复按钮或风控词汇一律驳回。
   - 测试工程师 (`qa`)：在移动端与 iPad 视口下运行端到端真机走查，重点核查虚拟键盘升起时是否遮挡表单以及单字折行现象。
