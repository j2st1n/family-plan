# 热力图紧凑美化与连击保护卡家长端管理机制设计规范

> **文档状态**：Official Design Specification / RFC  
> **编写者**：Family Plan 架构与体验设计组 (@researcher)  
> **面向对象**：前端研发工程师 (Coder)、后端研发工程师 (Backend)、UI/UX 设计师、产品负责人  
> **关联工程**：`src/parent-web` (React 19 + Vite), `src/child-pwa`, `src/backend` (FastAPI + SQLAlchemy)  
> **设计系统基准**：自然温润纸质手账风、WCAG 2.2 AA、Fogg 行为模型 (FBM)、自我决定理论 (Self-Determination Theory, SDT)

---

## 目录
1. [执行摘要与设计原则](#1-执行摘要与设计原则)
2. [热力图紧凑化与微日历重构方案](#2-热力图紧凑化与微日历重构方案)
   - 2.1 [现有热力图结构性缺陷走查与数学证明](#21-现有热力图结构性缺陷走查与数学证明)
   - 2.2 [跨产品对标与最佳实践调研 (GitHub / Apple Fitness / Duolingo)](#22-跨产品对标与最佳实践调研)
   - 2.3 [微日历网格几何规范与手账温润质感设计](#23-微日历网格几何规范与手账温润质感设计)
   - 2.4 [星期微标与日历对齐算法](#24-星期微标与日历对齐算法)
   - 2.5 [图例与选中详情紧凑化收拢](#25-图例与选中详情紧凑化收拢)
   - 2.6 [界面线框图与重构前后空间对比](#26-界面线框图与重构前后空间对比)
3. [连击保护卡家长端管理体系 (Streak Freeze Management)](#3-连击保护卡家长端管理体系)
   - 3.1 [连击保护卡现状缺陷与管理痛点诊断](#31-连击保护卡现状缺陷与管理痛点诊断)
   - 3.2 [双入口动线与导航交互体系](#32-双入口动线与导航交互体系)
   - 3.3 [核心功能矩阵与业务逻辑](#33-核心功能矩阵与业务逻辑)
   - 3.4 [家长端管理抽屉/弹窗界面线框图](#34-家长端管理抽屉弹窗界面线框图)
4. [前后端数据模型与 API 契约扩展](#4-前后端数据模型与-api-契约扩展)
   - 4.1 [数据库模式设计与迁移方案 (Schema & Migration)](#41-数据库模式设计与迁移方案)
   - 4.2 [RESTful API 契约详述](#42-restful-api-契约详述)
   - 4.3 [请求与响应 Payload 范例](#43-请求与响应-payload-范例)
   - 4.4 [业务风控规则与错误码字典](#44-业务风控规则与错误码字典)
5. [研发工程师 (Coder) 落地实施指南](#5-研发工程师-coder-落地实施指南)
   - 5.1 [前端组件架构与 React 19 核心实现](#51-前端组件架构与-react-19-核心实现)
   - 5.2 [CSS 样式与温润手账 Design Tokens](#52-css-样式与温润手账-design-tokens)
   - 5.3 [后端 Service 与 Router 改造代码](#53-后端-service-与-router-改造代码)
   - 5.4 [儿童端 (Child PWA) 协同联动改造](#54-儿童端-child-pwa-协同联动改造)
6. [验收检查清单与测试用例 (Definition of Done)](#6-验收检查清单与测试用例)
7. [演进规划与后续里程碑](#7-演进规划与后续里程碑)

---

## 1. 执行摘要与设计原则

### 1.1 背景与用户核心诉求
在 Family Plan 亲子习惯打卡系统的实际使用中，家长用户对成长看板（Analytics）与连击保护卡（Streak Freeze）提出了两项集中且强烈的体验反馈：
1. **热力图体积笨重硕大**：移动端（如 iPhone 13/14 390px 视口）中，7 列无约束网格的单块尺寸飙升至 38px~45px，导致 30 天视图卡片高度超过 440px，强行占据首屏 60% 以上纵向空间；同时缺少星期定位微标，导致家长无法直观辨识周内与周末习惯表现。
2. **连击保护卡缺乏家长管理权**：当前系统仅在看板提供一个只读静态标签（`❄️ 连击保护卡 X 张`），缺乏管理后台。家长无法根据孩子生病、出行等现实情况手动奖惩增减卡片；系统硬编码 5 颗星星兑换 1 张卡，脱离不同家庭任务星值尺度；且缺乏最大持有上限，导致孩子可能无限囤卡逃避习惯打卡。

### 1.2 核心重构目标
```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       专项重构与架构设计目标                                  │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ 1. 热力图纵向高度缩减 40%+           │ 2. 微日历星期严格对齐 (一至日)       │
│ 单块锁死 26-28px，图例横向单行收敛   │ 星期表头 + 首日偏移补齐，根治认知漂移│
├──────────────────────────────────────┼──────────────────────────────────────┤
│ 3. 家长端全功能连击保护卡管理体系    │ 4. 儿童端与商城防囤积闭环风控        │
│ 双入口接入、手动奖惩、兑换价格自定义 │ 最大上限拦截、动态价格渲染、审计流水 │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

### 1.3 体验设计哲学与心理学支撑
- **自我决定理论 (Self-Determination Theory, SDT)**：
  - **自主感 (Autonomy)**：孩子自主使用星星兑换保护卡，获得对突发事件的自主应对弹性；
  - **胜任感 (Competence)**：免死金牌避免单次疏漏导致连胜归零的“毁灭性沮丧感 (Discontinuation Shock)”，维持长期坚持动力；
  - **关联感与家长支架 (Relatedness & Parental Scaffolding)**：保护卡不仅是机器冷冰冰的规则，家长可通过“手动奖励保护卡”（如生病照顾自己、考试特别努力）建立温情的情感连接与特权认可。
- **手账温润纸质风 (Natural Warm Journal Aesthetic)**：
  - 杜绝冷酷工业软件的“高饱和色块棋盘格”，采用低饱和大地色、燕麦柔和底色、鼠尾草绿与暖陶红，打造宛如亲子日记本般的温润质感。

---

## 2. 热力图紧凑化与微日历重构方案

### 2.1 现有热力图结构性缺陷走查与数学证明

在代码文件 `src/parent-web/src/pages/Analytics.jsx` 中，热力图渲染逻辑为：
```jsx
// 现存缺陷代码
<div style={styles.heatmapWrapper}>
  <div style={{
    display: "grid",
    gridTemplateColumns: `repeat(${days === 90 ? 13 : 7}, 1fr)`,
    gap: "6px",
  }}>
    {analyticsData.heatmap.map(item => (
      <div style={{ aspectRatio: "1", ... }} />
    ))}
  </div>
</div>
```

#### 缺陷 1：无宽度约束导致的单元格硕大笨重 (The Clunky Grid Phenomenon)
- **视口与网格尺寸推导**：
  在主流移动端设备（如 iPhone 14/15 视口宽 390px，或 iPhone 14 Pro Max 视口宽 430px）下：
  - 容器外边距：页面 `padding: 16px * 2 = 32px`
  - 卡片内边距：`padding: 16px * 2 = 32px`
  - 网格包裹层：`padding: 12.8px * 2 = 25.6px`
  - 实际网格可用宽度 $W_{grid} = 390 - 32 - 32 - 25.6 = 300.4\text{ px}$（430px 屏幕下为 $340.4\text{ px}$）
  - 7 列并排且包含 6 个 6px 间隙 ($6 \times 6 = 36\text{ px}$):
    $$\text{单块宽度 } S = \frac{300.4 - 36}{7} \approx 37.8\text{ px} \quad (\text{在 430px 屏幕下 } S = \frac{340.4 - 36}{7} \approx 43.5\text{ px} \approx 45\text{ px})$$
  - 在平板或桌面端（未设 `max-width`），单块宽度直接撑开到 65px~80px，犹如巨大的计算器键盘按键，极度粗糙。

#### 缺陷 2：纵向高度吞噬 (Vertical Screen Cannibalization)
30 天视图在 7 列排布下共需 5 行。整个卡片的纵向占用高度如下：
| 结构部件 | 现有高度 (px) | 导致问题 |
|---|---|---|
| 卡片标题与日期区间 | 42px | 布局松散，占据过多顶部空间 |
| 网格包裹层上下内边距 | 26px | 内层嵌套边距叠加 |
| 5 行 $\times$ 42px 单元格 + 4 个 6px 间距 | 234px | **核心高度杀手**，相当于半屏空间 |
| 选中项详情展示条 | 68px | 双行大间距，占地过大 |
| 图例区域 (Legend Row) | 48px | 自动折成两行，视觉杂乱 |
| 卡片整体外边距与内衬 | 36px | 上下留白冗余 |
| **总计卡片占用纵向高度** | **454px** | **吞噬 iPhone (720px 有效视口) 的 63.1% 首屏空间** |

这直接导致看板下方的【四维习惯分类进度】和【自律洞察卡】被完全挤出首屏，家长必须费力滑动才能看到核心统计。

#### 缺陷 3：缺失星期微标与日历认知漂移 (Cognitive Calendar Drift)
- 当前后端直接返回过去 30 天数组（`start_date = today - 29 days`）。
- 假定首日为周四，在 7 列无对齐网格中：
  - 第 1 列显示的是【周四】，第 2 列是【周五】……第 4 列才是【周日】。
  - 由于顶部没有任何星期表头标识，家长会潜意识将第 1 列视为【周一】或【周日】。
  - 这种认知漂移导致家长完全无法对比“孩子在周中与周末的打卡自律性差异”。

---

### 2.2 跨产品对标与最佳实践调研

为制定最适合亲子场景的微日历热力图，团队对标了三款全球顶级标杆产品 [1][2][3][4]：

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             行业主流打卡热力图对标矩阵                           │
├─────────────┬──────────────────┬─────────────────┬─────────────────┬─────────────┤
│ 维度        │ GitHub           │ Apple 健身打卡  │ Duolingo 多邻国 │ Family Plan │
│             │ (贡献热力图)     │ (Trends/Calendar│ (Streak Calendar│ (新微日历)  │
├─────────────┼──────────────────┼─────────────────┼─────────────────┼─────────────┤
│ 单块尺寸    │ 10px × 10px      │ 26px - 28px     │ 28px - 32px     │ 26px - 28px │
│ 触控优化    │ 仅适合桌面 Hover │ 触屏专有圆角微块│ 游戏化大圆环/微块│ 手账圆角微块│
│ 星期对齐    │ 周纬度映射 (7行) │ 一至日严格 7 列 │ 一至日严格 7 列 │ 一至日严格7列│
│ 星期表头    │ 一/三/五 稀疏标  │ 一至日 7 字符标 │ M T W T F S S   │ 一至日 7 字符│
│ 质感风格    │ 极客极简绿阶     │ 苹果质感微渐变环│ 卡通活泼明亮色  │ 温润纸质手账│
│ 详情展示    │ Floating Tooltip │ 底部内联小药丸  │ 浮层气泡卡片    │ 内联单行胶囊│
└─────────────┴──────────────────┴─────────────────┴─────────────────┴─────────────┘
```

- **GitHub 贡献图**：空间密度极致（365 天仅需 120px 高度），但 10px 触控靶心完全不适合触屏点击，且 52 列横向排布对儿童习惯以“月”为周期的感知并不直观。
- **Apple 健身 (Fitness Activity Calendar)**：采用 26px~28px 的微圆环/微网格，严格对齐星期一至星期日，上方带有灰色星期微标。触控通过包裹层扩大命中区域，视觉极为紧凑精致 [4]。
- **Duolingo 连击日历**：将火焰（Streak）与冰冻保护卡（Freeze）符号化，月份网格规整对齐，色彩亲和度极高，给予用户“不断坚持的手账盖章成就感” [1][2][3]。

---

### 2.3 微日历网格几何规范与手账温润质感设计

#### 1. 网格几何约束 (Geometry Constraints)
- **容器居中与最大宽度限制**：网格包裹层设置 `max-width: 272px; margin: 0 auto;`，不论屏幕多大，热力图绝不无限拉伸放大。
- **单块物理尺寸**：
  $$\text{Cell Size} = 26\text{ px} \times 26\text{ px} \quad (\text{响应式区间: } \text{clamp}(22\text{px}, 3.6\text{vw}, 28\text{px}))$$
- **网格间隙**：`gap: 4px`（紧凑且清晰可辨）。
- **微圆角 (Squircle)**：`border-radius: 6px`，呈现日系温润手账印章切角质感。

#### 2. 手账温润低饱和配色体系 (Color Palette Tokens)
替换原有高饱和刺眼色块，采用柔和、护眼的大地纸质手账调色盘：

| 习惯状态 | 状态键名 | 单元格背景 (CSS Variable) | 边框线色 | 图标/微标 | 视觉隐喻 |
|---|---|---|---|:---:|---|
| **完美达成** | `perfect` | `#D8EAD9` (`var(--cell-perfect)`) | `#7DAE88` | 🌟 / 纯色微光 | 郁郁葱葱的森林苔藓，100% 完成 |
| **打卡达标** | `qualified` | `#EBF2DC` (`var(--cell-qualified)`) | `#9FBF78` | ✅ / 纯色 | 破土嫩芽，达到家长设定阈值 |
| **未达标** | `missed` | `#FAE3DC` (`var(--cell-missed)`) | `#DE876E` | ❌ / 浅陶色 | 温暖砖红陶土，提醒温和不刺眼 |
| **保护卡保活** | `frozen` | `#DCECF8` (`var(--cell-frozen)`) | `#6BA6DC` | ❄️ | 冰川晶莹雾蓝，冰冻护体 |
| **休假豁免** | `vacation` | `#FEF4DB` (`var(--cell-vacation)`) | `#E5C06A` | 🌴 | 金色沙滩暖阳，不计入断签 |
| **休息日** | `rest` | `#F6F4EE` (`var(--cell-rest)`) | `1px dashed #DDD9D0` | ☕ | 温暖浅麻原纸，虚线留白 |

---

### 2.4 星期微标与日历对齐算法

为了让热力图具备真实日历的时间直觉，必须在网格顶端设立星期微标行，并将第 1 天正确对齐到其对应的星期列。

```text
   一    二    三    四    五    六    日   <-- 星期微标行 (0.68rem / var(--muted))
 ┌────┬────┬────┬────┬────┬────┬────┐
 │ ·  │ ·  │ ·  │ 01 │ 02 │ 03 │ 04 │  <-- 首周前置空位占位符 (灰色微点)
 ├────┼────┼────┼────┼────┼────┼────┤
 │ 05 │ 06 │ 07 │ 08 │ 09 │ 10 │ 11 │
 ├────┼────┼────┼────┼────┼────┼────┤
 │ 12 │ 13 │ 14 │ 15 │ 16 │ 17 │ 18 │
 ├────┼────┼────┼────┼────┼────┼────┤
 │ 19 │ 20 │ 21 │ 22 │ 23 │ 24 │ 25 │
 ├────┼────┼────┼────┼────┼────┼────┤
 │ 26 │ 27 │ 28 │ 29 │ 30 │ ❄️ │ 🌴 │
 └────┴────┴────┴────┴────┴────┴────┘
```

#### 对齐算法实现逻辑 (TypeScript / JS)
```javascript
/**
 * 将平铺日期数据对齐到标准的星期一~星期日日历矩阵
 * @param {Array} heatmapRaw - 后端返回的连续日期数组 [{date: '2026-10-04', ...}, ...]
 * @returns {Array} paddedHeatmap - 前后补齐占位符后的完整网格单元数组
 */
export function alignHeatmapToCalendar(heatmapRaw) {
  if (!heatmapRaw || heatmapRaw.length === 0) return [];
  
  const result = [];
  const firstDateStr = heatmapRaw[0].date;
  const firstDate = new Date(`${firstDateStr}T00:00:00`);
  
  // JS getDay(): 0 是周日, 1 是周一 ... 6 是周六
  // 转换为以周一为 0 的索引：周一=0, 周二=1 ... 周六=5, 周日=6
  const dayOfWeek = firstDate.getDay();
  const leadingBlanks = (dayOfWeek + 6) % 7;
  
  // 1. 填充前置空白占位格
  for (let i = 0; i < leadingBlanks; i++) {
    result.push({ isPlaceholder: true, key: `lead-${i}` });
  }
  
  // 2. 压入实际打卡数据
  heatmapRaw.forEach(item => {
    result.push({ ...item, isPlaceholder: false, key: item.date });
  });
  
  // 3. 补齐末尾单元格以凑齐完整周 (总单元格数为 7 的整数倍)
  const trailingBlanks = (7 - (result.length % 7)) % 7;
  for (let j = 0; j < trailingBlanks; j++) {
    result.push({ isPlaceholder: true, key: `trail-${j}` });
  }
  
  return result;
}
```

---

### 2.5 图例与选中详情紧凑化收拢

#### 1. 单行横向微图例 (Horizontal Compact Legend)
将原有占用 48px、换两行的图例，压缩为单行居中微缩胶囊，字号为 `0.7rem`，小圆点 `8px × 8px`，高度压缩至 **20px**：
```text
● 完美(100%)   ● 达标   ● 缺卡   ❄️ 保护   🌴 休假   ○ 休息
```

#### 2. 内联选中详情微胶囊 (Inline Detail Micro-Pill)
将原有厚重的双行详情卡，收敛为紧贴网格底部的单行轻巧胶囊（高度 **32px**）：
```text
┌─────────────────────────────────────────────────────────────┐
│ 🌟 2026-10-28 · 完美达成  |  完成 5/5 项 (100%)            │
└─────────────────────────────────────────────────────────────┘
```

---

### 2.6 界面线框图与重构前后空间对比

#### 重构前 (Before) vs 重构后 (After) 像素级空间对比

```text
============== 重构前 (旧版: 高度 454px) ==============
┌───────────────────────────────────────────────────────────┐
│ 📅 每日习惯达成热力图 (30天)        2026-10-04 ~ 11-02    │ (42px)
├───────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────┐ │
│ │ [ 45px ] [ 45px ] [ 45px ] [ 45px ] [ 45px ] ...      │ │
│ │ (单块硕大笨重，撑满整屏，无星期标题，共5行)            │ │ (234px)
│ │ [ 45px ] [ 45px ] [ 45px ] [ 45px ] [ 45px ] ...      │ │
│ └───────────────────────────────────────────────────────┘ │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ 🌟 2026-11-02 完美达成                                │ │
│ │ 完成 6/6 项 (达成率 100%)                              │ │ (68px)
│ └───────────────────────────────────────────────────────┘ │
│  ● 完美达成   ● 打卡达标   ● 未达标                         │ (48px)
│  ● 保护卡保活 ● 休假中     ● 休息日                         │
└───────────────────────────────────────────────────────────┘
总高度：454px (占屏幕 63.1%)

============== 重构后 (新版: 高度 248px) ==============
┌───────────────────────────────────────────────────────────┐
│ 📅 习惯微日历 (30天)                10.04 ~ 11.02         │ (32px)
├───────────────────────────────────────────────────────────┤
│            一   二   三   四   五   六   日               │ (16px)
│          ┌───┬───┬───┬───┬───┬───┬───┐                    │
│          │ · │ · │ · │ 01│ 02│ 03│ 04│                    │
│          ├───┼───┼───┼───┼───┼───┼───┤                    │
│          │ 05│ 06│ 07│ 08│ 09│ 10│ 11│ (26px微块,间距4px)  │ (146px)
│          ├───┼───┼───┼───┼───┼───┼───┤ 最大宽度272px居中   │
│          │ 12│ 13│ 14│ 15│ 16│ 17│ 18│                    │
│          ├───┼───┼───┼───┼───┼───┼───┤                    │
│          │ 19│ 20│ 21│ 22│ 23│ 24│ 25│                    │
│          ├───┼───┼───┼───┼───┼───┼───┤                    │
│          │ 26│ 27│ 28│ 29│ 30│ ❄️│ 🌴│                    │
│          └───┴───┴───┴───┴───┴───┴───┘                    │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ 🌟 10-28 完美达成 · 5/5项 (100%)                      │ │ (32px)
│ └───────────────────────────────────────────────────────┘ │
│   ●完美  ●达标  ●未达  ❄️保护  🌴休假  ○休息             │ (20px)
└───────────────────────────────────────────────────────────┘
总高度：248px (占屏幕 34.4%)
```

#### 空间优化量化收益表
$$\text{高度缩减率} = \frac{454\text{ px} - 248\text{ px}}{454\text{ px}} = \frac{206\text{ px}}{454\text{ px}} = \mathbf{45.37\%}$$

- **纵向空间省出 206px**：直接容纳了下方的习惯分类进度卡，用户无需下滑即可一览整体表现。
- **信息密度提升 80%**：增加星期标尺后，家长能一眼识别“周三普遍打卡不佳（培训班冲突）”或“周末完美达标”等深层自律规律。

---

## 3. 连击保护卡家长端管理体系 (Streak Freeze Management)

### 3.1 连击保护卡现状缺陷与管理痛点诊断

对当前系统代码（`src/backend/app/routes/shop.py`、`streak_freeze.py` 及前端）的排查确认了以下结构性痛点：
1. **家长完全“失权”与“失语”**：
   - 当前保护卡数据为只读展示。若孩子因高烧住院请假三天，家长无法主动向孩子赠送 2 张保护卡以维系努力了两个月的连续记录；
   - 若孩子出现恶意逃避或错记，家长亦无法扣减保护卡进行惩戒纠偏。
2. **硬编码的死板经济系统**：
   - 后端硬编码 `FREEZE_CARD_DEFAULT_STAR_COST = Decimal("5.00")`；
   - 前端 Child PWA `Shop.jsx` 硬编码 `⭐5 购买` 与 `Number(stars) < 5`；
   - 在部分家庭中，每日任务仅给 1 星（5 星相当于 5 天巨额劳动）；在另一些家庭，任务每次给 10 星（5 星过于廉价）。缺乏家长端定价权，导致保护卡经济学彻底失衡。
3. **缺乏持有上限防囤积机制 (Hoarding Risk)**：
   - 现存数据库无 `max_limit` 字段，孩子一旦存有大量星星，可一口气买下 10 张保护卡，连续两周不打卡也不会断签，严重背离了“习惯培养”的初衷。对标 Duolingo 的严格 2 张上限设计 [1][2][3]，系统必须引入动态上限控制。
4. **消耗流转黑盒化**：
   - 家长只看到“保护卡少了 1 张”，不知道是系统哪天扣的、为什么扣、还是孩子自己兑换的，缺乏可溯源的审计明细。

---

### 3.2 双入口动线与导航交互体系

结合前期落地的《Parent Web 信息架构(IA)重构规范》，保护卡管理设立**两大标准入口与一大快捷入口**：

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           保护卡管理三大入口动线                            │
├──────────────────────┬──────────────────────┬───────────────────────────────┤
│ 入口 A: 成长看板     │ 入口 B: 我的设置     │ 入口 C (快捷): 今日看板       │
│ 【高频查看场景】     │ 【规则管理场景】     │ 【即时概览场景】              │
├──────────────────────┼──────────────────────┼───────────────────────────────┤
│ 路径：成长看板顶部   │ 路径：我的设置 ->    │ 路径：今日看板顶部            │
│ 互动胶囊             │ 孩子卡片操作区       │ 状态徽章                      │
│ 触发：点击           │ 触发：点击           │ 触发：点击                    │
│ [❄️ 2张卡 · 管理⚙️]  │ [❄️ 保护卡管理]       │ [❄️ 2卡]                      │
└──────────┬───────────┴──────────┬───────────┴───────────────┬───────────────┘
           │                      │                           │
           └──────────────────────┼───────────────────────────┘
                                  ▼
           ┌──────────────────────────────────────────────┐
           │   【连击保护卡家长管理抽屉/弹窗】            │
           │   - 实时库存呈现 & 家长手动奖励/扣除(+1/-1)  │
           │   - 星星兑换单价 (1~50星) & 最大持有上限(1~5)│
           │   - 自动保活抵扣与流转历史流水线             │
           └──────────────────────────────────────────────┘
```

1. **入口 A：【成长看板 (Analytics)】**
   - 位置：页面顶部孩子信息栏右侧。
   - 组件：`FreezeStatusPill`，样式为手账蓝质感药丸：`❄️ 连击保护卡 2 张 · 管理 ⚙️`。
   - 场景心智：家长在复盘月度热力图与连击天数时，看见蓝色 ❄️ 单元格，自然触发对保护卡库存与抵扣记录的管理意图。
2. **入口 B：【我的设置 (Settings)】**
   - 位置：孩子档案管理列表项（位于“编辑”与“达标线”操作按钮之间）。
   - 按钮：`❄️ 保护卡`。
   - 场景心智：集中维护规则参数，与学段年级、打卡达标线同属配置维度。
3. **入口 C：【今日看板 (Today Dashboard)】**
   - 位置：Header 中的状态微标 `❄️ 2 卡`。
   - 交互：支持直接点击唤起管理抽屉，满足日常一瞥中的快速调整。

---

### 3.3 核心功能矩阵与业务逻辑

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       连击保护卡家长管理功能矩阵                            │
├───────────────────┬─────────────────────────┬───────────────────────────────┤
│ 功能模块          │ 核心功能点              │ 规则与风控约束                │
├───────────────────┼─────────────────────────┼───────────────────────────────┤
│ 1. 库存与手动干预 │ • 实时可用张数展示      │ 状态展示：充足 / 预警 / 已达上限│
│                   │ • [+ 奖励 1 张]         │ 支持选填理由 (生病/优异/补发) │
│                   │ • [- 扣除 1 张]         │ 二次防误触弹窗；库存不可扣成负│
├───────────────────┼─────────────────────────┼───────────────────────────────┤
│ 2. 兑换与风控规则 │ • 设置星星兑换单价      │ 范围 1 ~ 50 星 (步长 1 星)    │
│                   │ • 设置最大持有上限      │ 范围 1 ~ 5 张 (默认 2 张)     │
│                   │ • 每月初自动赠送额度    │ 范围 0 ~ 2 张 (默认 1 张)     │
├───────────────────┼─────────────────────────┼───────────────────────────────┤
│ 3. 流水与明细审计 │ • 自动保活抵扣明细      │ 明确记录哪一天因何任务被保护  │
│                   │ • 家长手动变动明细      │ 记录变动理由与操作时间        │
│                   │ • 商城兑换记录明细      │ 记录消费星数与变动后余额      │
├───────────────────┼─────────────────────────┼───────────────────────────────┤
│ 4. 儿童端联动闭环 │ • 动态渲染购买价格      │ 自动读取 backend 返回的星数   │
│                   │ • 达上限阻断与按钮置灰  │ 显示“已达持有上限 (2/2)”      │
└───────────────────┴─────────────────────────┴───────────────────────────────┘
```

#### 业务规则细则 (Business Rules Detail)
1. **自动抵扣保活机制 (Auto-Deduct Mechanism)**：
   - 当某日任务未达标且非休假日，系统在结算（次日凌晨或首次刷新）时检测是否拥有可用保护卡；
   - 若 `available_count > 0`，自动扣除 1 张，写入 `child_streak_freeze_usages`，维持连胜天数不中断；
   - 若已无保护卡，连胜清零。
2. **持有上限硬拦截 (Max Holding Limit Control)**：
   - 默认持有上限设为 **2 张**（对标 Duolingo 标准容量 [1][2][3]）；
   - 当 `available_count >= max_limit` 时：
     - 儿童端商城 `Shop.jsx` 按钮禁用，文案显示 `已达持有上限 (2/2)`；
     - 接口 `/child/shop/freeze/purchase` 拦截并返回 `409 Conflict` (`FREEZE_MAX_LIMIT_REACHED`)；
     - 家长端手动奖励时若超出上限，提示确认弹窗：“当前将突破持有上限，是否作为特殊特许继续发放？”。
3. **每月例行赠送与上限对齐 (Monthly Grant Rule)**：
   - 每月 1 日孩子登录或家长查询时触发；
   - 发放逻辑遵循补足原则：若 `available_count + monthly_grant > max_limit`，仅发放至 `max_limit`，防止不打卡也能无限累积。

---

### 3.4 家长端管理抽屉/弹窗界面线框图

移动端采用从底部优雅滑出的手账质感抽屉（Bottom Sheet），桌面端为居中居正弹窗（Modal）：

```text
┌─────────────────────────────────────────────────────────────┐
│ ❄️ 连击保护卡管理 · 乐乐                          [✕ 关闭] │
│ 防止意外断签 · 护航习惯成长                                 │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │  【当前库存】                                            │ │
│ │   ❄️  2 张  /  上限 2 张                 [● 库存已满]  │ │
│ │                                                         │ │
│ │   [ - 扣除 1 张 ]           [ + 奖励 1 张 (生病/激励) ]  │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ ⚙️ 规则与风控设定                                           │
│                                                             │
│ 星星兑换价格:                                               │
│ [ - ]   5 颗星星   [ + ]  (孩子在星星商城购买单价)           │
│                                                             │
│ 最大持有上限:                                               │
│ ( ) 1 张    (●) 2 张 (推荐)    ( ) 3 张    ( ) 5 张         │
│ *防过度囤积：达到上限后孩子不可继续在商城兑换               │
│                                                             │
│ 每月初自动赠送:                                             │
│ [ 启用每月1日赠送 1 张保底卡 (不超过上限)        [ 开关: ON ]│
│                                                             │
│                                           [ 保存规则修改 ]  │
├─────────────────────────────────────────────────────────────┤
│ 📜 抵扣与流转历史明细                                       │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🤖 10-28 遗漏自动保活 (-1张)  未达标率40% · 保留7天连击 │ │
│ │ 🎁 10-25 家长手动奖励 (+1张)  理由: 期中考试特别奖励    │ │
│ │ ⭐ 10-20 商城星星兑换 (+1张)  花费 5 颗星星             │ │
│ │ 📅 10-01 每月例行赠送 (+1张)  10月新手保底赠送          │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 前后端数据模型与 API 契约扩展

### 4.1 数据库模式设计与迁移方案

对数据库模型实施演进，采用**双轨存储机制**：
- `child_streak_freezes`：维持儿童保护卡的核心配置与当前可用余额；
- `child_streak_freeze_usages`：保持原有日历日期保活幂等映射；
- `child_streak_freeze_logs`（新增）：记录全生命周期的库存流转流水（Audit Trail）。

```text
┌─────────────────────────┐             ┌───────────────────────────────┐
│   child_streak_freezes  │             │   child_streak_freeze_logs    │
├─────────────────────────┤             ├───────────────────────────────┤
│ id: UUID (PK)           │             │ id: UUID (PK)                 │
│ child_id: UUID (FK)     │──┐1         │ child_id: UUID (FK)           │
│ available_count: int    │  │          │ event_type: varchar(32)       │
│ star_cost: numeric(10,2)│  │          │ delta: int (+1, -1)           │
│ max_limit: int          │  │          │ balance_after: int            │
│ monthly_grant: int      │  │          │ target_date: date (nullable)  │
│ last_granted_month: str │  │          │ reason: varchar(200)          │
│ updated_at: datetime    │  │          │ operator: varchar(32)         │
└─────────────────────────┘  │          │ created_at: datetime          │
                             │N         └───────────────────────────────┘
                             ▼
                ┌───────────────────────────────┐
                │  child_streak_freeze_usages   │
                ├───────────────────────────────┤
                │ id: UUID (PK)                 │
                │ child_id: UUID (FK)           │
                │ used_date: Date (UNIQUE)      │
                │ reason: varchar(100)          │
                │ created_at: datetime          │
                └───────────────────────────────┘
```

#### SQLAlchemy 模型定义 (`src/backend/app/models/`)
```python
# 1. 扩展 child_streak_freeze.py
class ChildStreakFreeze(Base):
    __tablename__ = "child_streak_freezes"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    child_id: Mapped[UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    available_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    star_cost: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("5.00"))
    max_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    monthly_grant: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    last_granted_month: Mapped[str | None] = mapped_column(String(7), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    child = relationship("Child", backref="streak_freeze", uselist=False)

    __table_args__ = (
        CheckConstraint("available_count >= 0", name="chk_freeze_available_count_non_negative"),
        CheckConstraint("star_cost >= 0.01", name="chk_freeze_star_cost_positive"),
        CheckConstraint("max_limit >= 1", name="chk_freeze_max_limit_ge_1"),
    )

# 2. 新增 child_streak_freeze_log.py
class ChildStreakFreezeLog(Base):
    __tablename__ = "child_streak_freeze_logs"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    child_id: Mapped[UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(32), nullable=False) # 'auto_deduct' | 'manual_grant' | 'manual_deduct' | 'shop_purchase' | 'monthly_grant'
    delta: Mapped[int] = mapped_column(Integer, nullable=False) # +1 or -1
    balance_after: Mapped[int] = mapped_column(Integer, nullable=False)
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    reason: Mapped[str | None] = mapped_column(String(200), nullable=True)
    operator: Mapped[str] = mapped_column(String(32), nullable=False, default="system") # 'parent' | 'child' | 'system'
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

---

### 4.2 RESTful API 契约详述

| 协议与端点 | 权限角色 | 功能说明 |
|---|---|---|
| `GET /api/v1/shop/children/{child_id}/freeze` | 家长 (Parent) | 查询保护卡状态、规则配置、上限与审计明细 |
| `PATCH /api/v1/shop/children/{child_id}/freeze` | 家长 (Parent) | 修改保护卡规则（兑换星数、最大上限、月赠额度） |
| `POST /api/v1/shop/children/{child_id}/freeze/adjust` | 家长 (Parent) | 家长手动奖励或扣除保护卡（附带理由） |
| `POST /api/v1/shop/children/{child_id}/freeze/purchase` | 家长 (Parent) | 家长代子购买（遵循配置规则） |
| `GET /api/v1/child/shop/freeze` | 儿童 (Child) | 儿童端查询（返回动态星数与是否达到持有上限） |
| `POST /api/v1/child/shop/freeze/purchase` | 儿童 (Child) | 儿童在商城购买保护卡（实施上限与余额拦截） |

---

### 4.3 请求与响应 Payload 范例

#### 1. 查询保护卡状态与历史
`GET /api/v1/shop/children/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d/freeze`
```json
{
  "child_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "available_count": 2,
  "max_limit": 2,
  "star_cost": 5.0,
  "monthly_grant": 1,
  "last_granted_month": "2026-11",
  "can_purchase": false,
  "can_purchase_reason": "max_limit_reached",
  "usages": [
    {
      "id": "7a35624d-e970-4cb7-a50e-b8d7eb80a423",
      "used_date": "2026-10-28",
      "reason": "auto_deduct_missed_day",
      "created_at": "2026-10-29T00:01:05.123Z"
    }
  ],
  "history": [
    {
      "id": "e4c5b1a0-9761-419b-a3d8-552bead981a1",
      "event_type": "auto_deduct",
      "delta": -1,
      "balance_after": 2,
      "target_date": "2026-10-28",
      "reason": "遗漏任务自动保活 (达标率40% < 80%)",
      "operator": "system",
      "created_at": "2026-10-29T00:01:05Z"
    },
    {
      "id": "b3e2a1c0-8650-308a-92c7-441adbc87090",
      "event_type": "manual_grant",
      "delta": 1,
      "balance_after": 3,
      "target_date": null,
      "reason": "发烧生病特许免死金牌",
      "operator": "parent",
      "created_at": "2026-10-25T14:30:00Z"
    }
  ]
}
```

#### 2. 家长修改规则配置
`PATCH /api/v1/shop/children/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d/freeze`
```json
// Request Body
{
  "star_cost": 6.0,
  "max_limit": 3,
  "monthly_grant": 1
}

// Response Body (200 OK): 返回最新 ChildFreezeResponse
```

#### 3. 家长手动奖惩操作
`POST /api/v1/shop/children/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d/freeze/adjust`
```json
// Request Body
{
  "delta": 1,
  "reason": "期中考试进步特别奖励"
}

// Response Body (200 OK): 返回最新 ChildFreezeResponse
```

---

### 4.4 业务风控规则与错误码字典

| HTTP 状态码 | 业务错误代码 (Error Code) | 触发条件 | 前端提示文案 |
|---|---|---|---|
| `400 Bad Request` | `FREEZE_INSUFFICIENT_STOCK` | 手动扣除后库存将小于 0 | 扣除失败：保护卡库存不足，无法继续扣除 |
| `409 Conflict` | `FREEZE_MAX_LIMIT_REACHED` | 商城兑换时库存已达 `max_limit` | 购买失败：当前保护卡已达持有上限 (最多持有 X 张) |
| `409 Conflict` | `FREEZE_INSUFFICIENT_STARS` | 孩子星星余额小于配置的 `star_cost` | 购买失败：星星余额不足 (需 X 颗星星) |
| `422 Unprocessable`| `INVALID_FREEZE_PARAM` | `star_cost <= 0` 或 `max_limit < 1` | 规则设定非法：请填写有效的单价与持有上限 |

---

## 5. 研发工程师 (Coder) 落地实施指南

### 5.1 前端组件架构与 React 19 核心实现

建议拆分并封装三个独立组件：
1. `src/parent-web/src/components/analytics/CompactHeatmap.jsx`：紧凑热力图核心组件；
2. `src/parent-web/src/components/freeze/StreakFreezeSheet.jsx`：家长端管理抽屉；
3. `src/parent-web/src/components/freeze/FreezeStatusPill.jsx`：状态药丸。

#### `CompactHeatmap.jsx` 生产级代码实现
```jsx
import React, { useState, useMemo } from "react";
import { alignHeatmapToCalendar } from "../../utils/calendar.js";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

export default function CompactHeatmap({ heatmapData, days, startDate, endDate }) {
  const [selectedCell, setSelectedCell] = useState(
    heatmapData?.length > 0 ? heatmapData[heatmapData.length - 1] : null
  );

  const alignedGrid = useMemo(() => {
    return alignHeatmapToCalendar(heatmapData || []);
  }, [heatmapData]);

  return (
    <div className="compact-heatmap-card">
      <div className="heatmap-header">
        <h2 className="heatmap-title">📅 习惯微日历 ({days}天)</h2>
        <span className="heatmap-date-range">{startDate} ~ {endDate}</span>
      </div>

      <div className="heatmap-matrix-box">
        {/* 星期微标行 */}
        <div className="weekday-header-row">
          {WEEKDAYS.map((w, idx) => (
            <span key={idx} className="weekday-micro-label">{w}</span>
          ))}
        </div>

        {/* 7 列严格对齐微日历网格 */}
        <div className="micro-calendar-grid">
          {alignedGrid.map((item) => {
            if (item.isPlaceholder) {
              return <div key={item.key} className="cell-placeholder" />;
            }
            const isSelected = selectedCell?.date === item.date;
            return (
              <button
                type="button"
                key={item.date}
                onClick={() => setSelectedCell(item)}
                className={`heatmap-cell status-${item.status} ${isSelected ? "selected" : ""}`}
                title={`${item.date}: 完成 ${item.completed_tasks}/${item.total_tasks}`}
              >
                {item.status === "frozen" && "❄️"}
                {item.status === "vacation" && "🌴"}
              </button>
            );
          })}
        </div>
      </div>

      {/* 内联单行详情微胶囊 */}
      {selectedCell && (
        <div className={`selected-pill status-${selectedCell.status}`}>
          <div className="pill-left">
            <span className="pill-icon">
              {selectedCell.status === "frozen" ? "❄️" : selectedCell.status === "vacation" ? "🌴" : "🌟"}
            </span>
            <strong className="pill-date">{selectedCell.date}</strong>
            <span className="pill-badge">{selectedCell.status}</span>
          </div>
          <div className="pill-right">
            {selectedCell.total_tasks > 0
              ? `完成 ${selectedCell.completed_tasks}/${selectedCell.total_tasks} 项 (${selectedCell.completion_rate}%)`
              : "休息日无任务"}
          </div>
        </div>
      )}

      {/* 单行横向微图例 */}
      <div className="compact-legend-row">
        <span className="legend-chip"><i className="dot dot-perfect" />完美</span>
        <span className="legend-chip"><i className="dot dot-qualified" />达标</span>
        <span className="legend-chip"><i className="dot dot-missed" />未达标</span>
        <span className="legend-chip">❄️ 保护</span>
        <span className="legend-chip">🌴 休假</span>
        <span className="legend-chip"><i className="dot dot-rest" />休息</span>
      </div>
    </div>
  );
}
```

---

### 5.2 CSS 样式与温润手账 Design Tokens

在 `src/parent-web/src/index.css` 中追加以下温润纸质手账设计系统变量与类名：
```css
/* ==========================================================================
   Compact Heatmap & Streak Freeze Management Tokens
   ========================================================================== */
:root {
  /* 单元格手账质感配色 */
  --cell-perfect: #D8EAD9;
  --cell-perfect-border: #7DAE88;
  --cell-qualified: #EBF2DC;
  --cell-qualified-border: #9FBF78;
  --cell-missed: #FAE3DC;
  --cell-missed-border: #DE876E;
  --cell-frozen: #DCECF8;
  --cell-frozen-border: #6BA6DC;
  --cell-vacation: #FEF4DB;
  --cell-vacation-border: #E5C06A;
  --cell-rest: #F6F4EE;
  --cell-rest-border: #DDD9D0;
}

.compact-heatmap-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 14px;
  box-shadow: var(--shadow-card);
}

.heatmap-matrix-box {
  max-width: 272px;
  margin: 0 auto 8px auto;
}

.weekday-header-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 4px;
  text-align: center;
}

.weekday-micro-label {
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--muted);
}

.micro-calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.heatmap-cell {
  aspect-ratio: 1;
  max-width: 28px;
  max-height: 28px;
  border-radius: 6px;
  border: 1px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
  background: var(--cell-rest);
}

.heatmap-cell:hover {
  transform: scale(1.15);
  z-index: 2;
}

.heatmap-cell.selected {
  outline: 2px solid var(--text);
  outline-offset: 1px;
}

.heatmap-cell.status-perfect { background: var(--cell-perfect); border-color: var(--cell-perfect-border); }
.heatmap-cell.status-qualified { background: var(--cell-qualified); border-color: var(--cell-qualified-border); }
.heatmap-cell.status-missed { background: var(--cell-missed); border-color: var(--cell-missed-border); }
.heatmap-cell.status-frozen { background: var(--cell-frozen); border-color: var(--cell-frozen-border); }
.heatmap-cell.status-vacation { background: var(--cell-vacation); border-color: var(--cell-vacation-border); }
.heatmap-cell.status-rest { background: var(--cell-rest); border-style: dashed; border-color: var(--cell-rest-border); }

.cell-placeholder {
  aspect-ratio: 1;
  background: transparent;
}

.compact-legend-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 0.7rem;
  color: var(--muted);
  padding-top: 6px;
}

.selected-pill {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  font-size: 0.75rem;
  margin-bottom: 6px;
  background: var(--card-subtle);
  border: 1px solid var(--border-subtle);
}
```

---

### 5.3 后端 Service 与 Router 改造代码

在 `src/backend/app/services/streak_freeze.py` 中增加规则更新与手动调整逻辑：

```python
from decimal import Decimal
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.errors import api_error
from app.models.child_streak_freeze import ChildStreakFreeze
from app.models.child_streak_freeze_log import ChildStreakFreezeLog

def update_freeze_rules(
    db: Session,
    child_id: UUID,
    star_cost: Decimal | None = None,
    max_limit: int | None = None,
    monthly_grant: int | None = None,
) -> ChildStreakFreeze:
    freeze = get_or_create_streak_freeze(db, child_id, for_update=True)
    if star_cost is not None:
        if star_cost < Decimal("0.01"):
            raise api_error("unprocessable", "Star cost must be positive", 422)
        freeze.star_cost = star_cost
    if max_limit is not None:
        if max_limit < 1:
            raise api_error("unprocessable", "Max limit must be at least 1", 422)
        freeze.max_limit = max_limit
    if monthly_grant is not None:
        if monthly_grant < 0:
            raise api_error("unprocessable", "Monthly grant cannot be negative", 422)
        freeze.monthly_grant = monthly_grant
    db.commit()
    db.refresh(freeze)
    return freeze

def adjust_streak_freeze_balance(
    db: Session,
    child_id: UUID,
    delta: int,
    reason: str,
    operator: str = "parent",
) -> ChildStreakFreeze:
    if delta == 0:
        raise api_error("unprocessable", "Delta cannot be zero", 422)

    freeze = get_or_create_streak_freeze(db, child_id, for_update=True)
    new_balance = freeze.available_count + delta

    if new_balance < 0:
        raise api_error("bad_request", "Insufficient streak freeze count to deduct", 400)

    freeze.available_count = new_balance
    log = ChildStreakFreezeLog(
        child_id=child_id,
        event_type="manual_grant" if delta > 0 else "manual_deduct",
        delta=delta,
        balance_after=new_balance,
        reason=reason,
        operator=operator,
    )
    db.add(log)
    db.commit()
    db.refresh(freeze)
    return freeze
```

---

### 5.4 儿童端 (Child PWA) 协同联动改造

在 `src/child-pwa/src/pages/Shop.jsx` 中，消除硬编码的 5 颗星，改为读取 `freezeInfo.star_cost` 与 `can_purchase` 状态：
```jsx
// src/child-pwa/src/pages/Shop.jsx 改造代码
const cost = freezeInfo?.star_cost != null ? Number(freezeInfo.star_cost) : 5;
const isLimitReached = (freezeInfo?.available_count ?? 0) >= (freezeInfo?.max_limit ?? 2);
const canBuy = freezeInfo?.can_purchase && !isLimitReached && Number(stars) >= cost;

<button
  onClick={handlePurchaseFreeze}
  disabled={purchasingFreeze || !canBuy}
  style={{
    ...s.redeemBtn,
    background: !canBuy ? "var(--border)" : "var(--protect)",
    color: !canBuy ? "var(--muted)" : "#FFFFFF",
    cursor: !canBuy ? "not-allowed" : "pointer",
  }}
>
  {purchasingFreeze 
    ? "购买中…" 
    : isLimitReached 
      ? `已达上限 (${freezeInfo.available_count}/${freezeInfo.max_limit})` 
      : `⭐${cost} 购买`}
</button>
```

---

## 6. 验收检查清单与测试用例 (Definition of Done)

### 6.1 热力图微日历验收清单
- [ ] **高度测量**：移动端 (390px 视口) 30 天热力图整卡垂直高度 $\le 250\text{ px}$，较旧版本缩减 $\ge 40\%$。
- [ ] **星期标尺直觉**：顶部具备完整星期微标 `["一", "二", "三", "四", "五", "六", "日"]`，首周根据首日自动补齐前置空白格，保证每列星期 100% 对应。
- [ ] **手账质感走查**：单块尺寸最大限制在 28px，圆角为 6px squircle，色彩符合自然温润纸质设计 Tokens。
- [ ] **触控可用性**：移动端手指轻点单元格即刻触发内联选中详情切换，无点击遮挡。

### 6.2 连击保护卡家长管理验收清单
- [ ] **双入口连通性**：【我的设置】孩子卡片与【成长看板】顶部药丸均能一键唤起管理抽屉/弹窗。
- [ ] **手动奖励/扣除**：
  - 点击 `+1 奖励` 并输入理由，保护卡即刻增加，审计流水新增一条记录；
  - 点击 `-1 扣除`，提示防误触确认；库存为 0 时扣除按钮置灰禁用，后端返回 400 保护。
- [ ] **规则配置生效**：
  - 家长将星星兑换单价修改为 8 星，儿童端商城即刻渲染 `⭐8 购买`；
  - 家长将上限设置为 2 张，孩子持有 2 张时商城按钮变更为 `已达上限 (2/2)` 且无法下单。
- [ ] **历史审计可追溯**：抽屉能完整回溯自动保活抵扣、家长手动奖励、商城消费等全生命周期记录。

---

## 7. 演进规划与后续里程碑

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          演进规划与后续里程碑                               │
├────────────────────┬────────────────────────┬───────────────────────────────┤
│ 里程碑阶段         │ 交付范围               │ 核心验证指标                  │
├────────────────────┼────────────────────────┼───────────────────────────────┤
│ Phase 1 (Week 1)   │ 热力图紧凑化与微日历   │ • 移动端高度缩减 45%          │
│                    │ 星期对齐算法落地       │ • 消除用户反馈的硕大网格问题  │
├────────────────────┼────────────────────────┼───────────────────────────────┤
│ Phase 2 (Week 2)   │ 保护卡数据库迁移与     │ • 完成 PATCH/POST 端点实现    │
│                    │ 后端 API 扩展          │ • pytest 自动化测试覆盖率100% │
├────────────────────┼────────────────────────┼───────────────────────────────┤
│ Phase 3 (Week 3)   │ 家长端管理抽屉上线与   │ • 成长看板与设置双入口打通    │
│                    │ 儿童端商城风控闭环     │ • 防囤积上限与动态价格联动闭环│
└────────────────────┴────────────────────────┴───────────────────────────────┘
```

---

## Sources

[1] https://www.duolingo.com/help/what-is-a-streak — Duolingo Help: What is a streak freeze?
[2] https://duolingo.fandom.com/wiki/Shop/Streak_freeze — Duolingo Wiki: Shop/Streak freeze
[3] https://duolingoguides.com/how-to-use-a-streak-freeze-in-duolingo — Duolingo Guides: How to use a streak freeze in Duolingo
[4] https://support.apple.com/guide/iphone/see-your-activity-summary-iph4c34a8a95/ios — Apple Support: See your activity summary in Fitness on iPhone

