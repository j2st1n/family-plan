# Family Plan 智能 AI 能力全景方案与系统架构设计

> **版本**：v1.0.0  
> **状态**：Architecture Proposal / RFC  
> **编写者**：Family Plan 研发团队 (@researcher)  
> **目标工程**：Family Plan (`src/backend`, `src/parent-web`, `src/child-pwa`)  
> **执行标准**：WCAG 2.2 AA、中华人民共和国《未成年人网络保护条例》、Self-Determination Theory (SDT)

---

## 目录
1. [执行摘要与全景架构蓝图](#1-执行摘要与全景架构蓝图)
2. [行业实践与真伪需求深度剖析](#2-行业实践与真伪需求深度剖析)
   - [2.1 全球标杆产品形态与心理学机制对标](#21-全球标杆产品形态与心理学机制对标)
   - [2.2 自我决定理论（SDT）与儿童自律行为建模](#22-自我决定理论sdt与儿童自律行为建模)
   - [2.3 四大核心 AI 场景的真伪需求辨析与决策矩阵](#23-四大核心-ai-场景的真伪需求辨析与决策矩阵)
3. [系统架构与技术选型设计](#3-系统架构与技术选型设计)
   - [3.1 统一 OpenAI 兼容 AIService 网关抽象](#31-统一-openai-兼容-aiservice-网关抽象)
   - [3.2 严格结构化输出保证（Pydantic & JSON Schema）](#32-严格结构化输出保证pydantic--json-schema)
   - [3.3 离线容灾与 2 秒超时熔断降级架构](#33-离线容灾与-2-秒超时熔断降级架构)
   - [3.4 未成年人数据脱敏与本地回环通信合规](#34-未成年人数据脱敏与本地回环通信合规)
4. [API 契约与数据模型定义](#4-api-契约与数据模型定义)
   - [4.1 Pydantic 核心数据模型](#41-pydantic-核心数据模型)
   - [4.2 RESTful 端点与网关契约](#42-restful-端点与网关契约)
   - [4.3 数据库模型演进（Alembic Migration）](#43-数据库模型演进alembic-migration)
5. [前端交互流程与双端体验规范](#5-前端交互流程与双端体验规范)
   - [5.1 家长端（Parent Web）：Copilot 建任务与智能审批流](#51-家长端parent-webcopilot-建任务与智能审批流)
   - [5.2 孩子端（Child iPad PWA）：乐观打卡与即时情绪激励气泡](#52-孩子端child-ipad-pwa乐观打卡与即时情绪激励气泡)
6. [分期实施路线（Sprint 规划）](#6-分期实施路线sprint-规划)
7. [参考文献与引用清单](#7-参考文献与引用清单)

---

## 1. 执行摘要与全景架构蓝图

Family Plan 作为一套轻量、高可坚持的现代亲子数字化计划系统，在经历 Sprint 1（iPad 触控与 Web Audio 音效升级）、Sprint 2（双端任务审批状态机）以及 Sprint 3（度假豁免、免死金牌与 90 天成长看板）迭代后，核心打卡闭环已高度成熟。为进一步降低家长任务录入与审核的心智负担，同时强化对儿童内在驱动力的正向激活，本方案系统性引入 **AI 智能化能力**。

### 1.1 核心设计哲学
1. **智能辅佐者（Scaffolding），绝非冷酷监工（Surveillance Judge）**：AI 不替代父母的真实关注，不充当粗暴评判儿童的审判者，而是作为亲子协作的桥梁与“情绪催化剂”。
2. **打卡链路 100% Snappy，AI 永不阻塞核心体验**：儿童端完成任务的反馈延迟必须严格维持在 100ms 级别（触控戳印章 + Web Audio 和弦），AI 即时激励与多模态核验必须全链路异步化与乐观更新，坚决杜绝“转圈等待”。
3. **严格 2 秒超时熔断与离线确定性保底**：网络抖动、模型超载或云端故障时，系统自动在 2 秒内静默熔断，无缝回退至本地启发式规则库，核心业务指标零受损。
4. **隐私第一与物理级本地回环隔离**：严格遵循《未成年人网络保护条例》[9]，家庭图像去 EXIF、面部脱敏，支持纯本地 Ollama/vLLM 回环部署，敏感数据杜绝跨境与第三方训练泄露。

### 1.2 全景架构图 (C4 Model - System Context & Container Level)

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENT TIER (前端双端应用)                                      │
├────────────────────────────────────────────────┬────────────────────────────────────────────────┤
│           Parent Web App (React 19 + Vite)     │          Child iPad PWA (React 19 + Vite)      │
│  - Copilot 语音/文本建任务抽屉 (自然语言交互)      │  - 72x72px 触控戳 + 乐观即时打卡 (零等待)         │
│  - 智能审核队列 (AI 识别建议 Chip + 1键批准)     │  - 动态萌宠/气泡即时激励 (AI/本地规则驱动)        │
│  - 深度成长周报 (雷达归因 + 心理学引导建议)       │  - 拍照凭证上传 (EXIF 自动剔除 + 隐私轻量压缩)     │
└───────────────────────┬────────────────────────┴───────────────────────┬────────────────────────┘
                        │ HTTPS / RESTful                                │ HTTPS / RESTful
                        ▼                                                ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              FASTAPI BACKEND & GATEWAY TIER (后端核心网关)                         │
│  ┌───────────────────────┐   ┌───────────────────────┐   ┌───────────────────────────────────┐  │
│  │  Auth & Token Limiter │   │  Plans & Tasks Core   │   │  SSE Realtime Hub (SSE 通知引擎)  │  │
│  └───────────────────────┘   └───────────┬───────────┘   └───────────────────────────────────┘  │
│                                          │                                                      │
│                                          ▼                                                      │
│  ┌───────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              AI SERVICE ORCHESTRATOR (智能服务编排层)                       │  │
│  │                                                                                           │  │
│  │   ┌─────────────────────┐   ┌─────────────────────┐   ┌────────────────────────────────┐  │  │
│  │   │  Task Copilot Parse │   │  Instant Encourage  │   │  Multimodal Proof Soft-Verify  │  │  │
│  │   └──────────┬──────────┘   └──────────┬──────────┘   └───────────────┬────────────────┘  │  │
│  │              │                         │                              │                   │  │
│  │              ▼                         ▼                              ▼                   │  │
│  │   ┌────────────────────────────────────────────────────────────────────────────────────┐  │  │
│  │   │             Resilience Layer: 2-Second Timeout & 3-State Circuit Breaker           │  │  │
│  │   │             (CLOSED / OPEN / HALF-OPEN, Fast Failure & Degrade) [10]               │  │  │
│  │   └────────────────────────────────────────┬───────────────────────────────────────────┘  │  │
│  │                                            │                                              │  │
│  │                    ┌───────────────────────┴───────────────────────┐                      │  │
│  │                    │ [Normal Operation]                            │ [Circuit Tripped /   │  │
│  │                    │                                               │  Timeout / Offline]  │  │
│  │                    ▼                                               ▼                      │  │
│  │   ┌──────────────────────────────────┐            ┌──────────────────────────────────┐    │  │
│  │   │ Unified OpenAI-Compatible Client │            │ Deterministic Local Rule Fallback│    │  │
│  │   │ (Structured Outputs / JSON Mode) │            │ (离线确定性启发式规则与离线语料库)  │    │  │
│  │   └────────────────┬─────────────────┘            └──────────────────────────────────┘    │  │
│  └────────────────────┼──────────────────────────────────────────────────────────────────────┘  │
└───────────────────────┼─────────────────────────────────────────────────────────────────────────┘
                        │
                        ▼ (HTTP / Unix Domain Socket Loopback)
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 MODEL PROVIDER TIER (多模型供应适配层)                              │
│                                                                                                 │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐  ┌───────────────────────┐  │
│  │  Local Edge: Ollama / vLLM   │  │  Direct Cloud: DeepSeek      │  │  CPA Gateway / LiteLLM │  │
│  │  - Qwen2.5-7B-Instruct (NLP) │  │  - deepseek-chat (V3) [8]    │  │  - OneAPI / NewAPI     │  │
│  │  - Qwen2.5-VL-7B (Vision) [7]│  │  - deepseek-reasoner (R1)    │  │  - 统一密钥与跨通道分流 │  │
│  │  (127.0.0.1 严格本地回环通信) │  │  (高性价比高遵循云端API)      │  │  - 支持 OpenAI/Claude  │  │
│  └──────────────────────────────┘  └──────────────────────────────┘  └───────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 行业实践与真伪需求深度剖析

### 2.1 全球标杆产品形态与心理学机制对标

深入调研全球数字化习惯与自律领域代表性产品，其在 AI 与游戏化上的底层机制差异巨大：

| 标杆产品 | 核心机制与定位 | AI 落地形态 | 激励模式 | 儿童/家庭场景局限性与风险 |
| :--- | :--- | :--- | :--- | :--- |
| **Finch** [1][4] | 照料型虚拟宠物（Care-based Self-Care Pet）[3] | 情绪日记标签归因分析、温和育儿式日常对话与抚慰[2] | **纯正向强化**（无失败惩罚、无血条扣除、连击免责）[4] | 缺乏亲子协同与家长审批闭环，任务深度不足[4] |
| **Habitica** [4] | RPG 冒险地下城任务清单（像素地牢打怪） | 社区任务推荐、无深度生成式 AI | **双刃剑**（完成得金币经验；漏卡扣 HP、波及队伍受创） | **极高挫败风险**：扣血惩罚在儿童群体中易引发“羞耻螺旋”而退坑 |
| **Duolingo** [5] | 多邻国 IP 驱动外语学习与习惯养成 | Duolingo Max: *Roleplay*（情景对话）与 *Explain My Answer*（AI 纠错）[5] | 连击里程碑、冷暖激将法提醒、免死金牌（Streak Freeze） | 偏单向学习，对非知识性行为（如做家务、跳绳、整理房间）缺少物理现实连接 |
| **斑马 / 叫叫** | 国内儿童数字启蒙与习惯伴读 | 绘本语音识别评测、AI 伴读虚拟形象、鼓励式星级评价 | 徽章图鉴、实物盲盒兑换、拟人化角色语音鼓励 | 强商业化与封闭生态，家长无法自定义家庭自律规则 |
| **作业帮 / 小猿口算** | K12 学业辅助与作业拍照批改 | 垂直端到端 OCR + 视觉大模型（单道题/整页识别批改） | 错题本重练、秒级判定对错 | 仅针对标准化作业，对开放式习惯打卡（如“整理书桌”、“帮妈妈洗碗”）无能为力 |

### 2.2 自我决定理论（SDT）与儿童自律行为建模

美国心理学家爱德华·德西（Edward L. Deci）与理查德·瑞安（Richard M. Ryan）提出的**自我决定理论（Self-Determination Theory, SDT）**表明，人类行为的持久坚持依赖于三种基本心理需求的满足：**自主感（Autonomy）**、**胜任感（Competence）**与**归属感（Relatedness）** [11]。

1. **自主感（Autonomy）**：孩子必须感受到自己是行动的主导者，而非被外在工具严格监控与强迫的客体[11]。如果引入严苛的“AI 判官”拒绝打卡，孩子的自主感将被彻底剥夺，产生强烈的对抗心理。
2. **胜任感（Competence）**：孩子需要获得“我能做好”的清晰正反馈[11]。即时、具体的正向语言（如“你把书本按从大到小摆整齐了，非常有条理！”）远比抽象的“真棒”更能构建胜任感。
3. **归属感（Relatedness）**：家庭自律的本质是亲子之间的关爱与信任[11]。AI 不应介入并阻隔亲子互动，而应赋能父母，通过数据洞察让父母更理解孩子的辛劳与成长。

### 2.3 四大核心 AI 场景的真伪需求辨析与决策矩阵

针对 Family Plan 系统拟引入的 4 项 AI 能力，经过深层业务场景推演与风险推演，形成以下真伪需求研判：

```text
需求价值高 ▲
          │  [强真需求]                           [强真需求]
          │  自然语言建任务 Copilot                 正向情绪即时激励
          │  (Parent Copilot)                     (Kid Emotion Boost)
          │  - 极大幅度削减录入摩擦                  - 强化胜任感与内驱力
          │  - 98%+ 结构化准确度                   - 毫秒级异步触发/离线保底
          │
          │  [强真需求]                           [强伪需求陷阱]
          │  自律趋势深度周报                       多模态硬性拦截核验
          │  (Weekly Growth Insight)              (Hard Multimodal Gate)
          │  - 跨周期心理学归因分析                  - 假阳性误判毁掉信任
          │  - 异步非阻塞生成                       - 5秒 VLM 延迟破坏爽感
          │                                       - 隐私泄露隐患
          └──────────────────────────────────────────────────────────► 技术可行性/风险控制
```

#### ①【自然语言建任务 Copilot】：强真需求（Strong True Need）
* **现状痛点**：当前家长在 Parent Web 创建任务需经历：选择孩子 → 填写标题 → 设定预估时长 → 选择星星奖励 → 开关审核状态 → 设定起始与截止时间。为多孩创建一天的 5-8 项任务需要点按 30+ 次，输入阻力极高，成为阻碍家长持续使用系统的第一大漏斗。
* **AI 价值**：家长仅需输入一段口语：“*明天让小明早上 8 点背 20 分钟古诗，下午 4 点跳绳 500 下给 2 颗星，晚上 7 点做数学口算需要我拍照审核*”。AI 解析器将其秒级转换为结构化任务草稿数组，支持一键确认或单项微调。
* **可行性结论**：基于现代 LLM 的 Function Calling 或 Structured Outputs，结合 Pydantic 校验，准确度超过 98%。失败或超时时可直接退回自由文本框，风险极低。

#### ②【多模态打卡拍照核验】：硬拦截为“强伪需求”，软核验为“强真需求”
* **硬核验之死（The Fallacy of Hard Verification）**：
  1. *假阳性误判引发亲子矛盾*：儿童拍照常伴随手抖、逆光、角度偏斜或局部遮挡。若 VLM 严格判定“未识别到跳绳动作”或“书本未摊开”而直接驳回打卡，孩子会产生强烈的委屈与被冤枉感（“我明明跳了，凭什么说我没做！”），直接摧毁打卡动力。
  2. *作弊对抗陷阱*：试图用 AI 解决信任问题是本末倒置。儿童很容易学会拍电脑屏幕、拍昨天的旧作业甚至假装摆拍。将家庭关系引向“作弊与反作弊的警察小偷游戏”彻底违背了亲子自律的初衷。
  3. *5 秒延迟破坏心流*：高参数量多模态模型（如 GPT-4o、Qwen2.5-VL）图像推理通常需要 2.5s - 6s。孩子打完卡需要手捧 iPad 焦躁等待转圈，Sprint 1 建立的 72px 触控戳与 Web Audio 即时多巴胺反馈被完全破坏。
* **软核验正解（Soft Verification & Emotional Feedback）**：
  - **儿童端零等待**：孩子打卡与拍照上传后，客户端立刻执行乐观更新（印章盖下、庆祝音效响声起），不等待 AI 返回。
  - **后台异步智能提炼**：VLM 异步解析照片，提取两项产物：
    - 给孩子的“情绪彩蛋”：贴合画面的鼓励徽章或俏皮话（如“看到写得整整齐齐的算草纸啦，真棒！”）。
    - 给家长的“防疲劳摘要”：在家长待审批列表直接展示结论标签（如“`[AI已识别] 数学作业完成，清晰度高，置信度 95%`”），家长无需点开大图即可单键批量批准，极大缓解家长的审核疲劳。

#### ③【正向情绪即时激励】：强真需求（Strong True Need）
* **价值**：儿童心理学表明，具体的正向反馈能有效强化神经回路。Family Plan 在 Sprint 2 已收集打卡情绪反馈（`relaxed` / `tired` / `happy`）。AI 根据当前任务类型（如“克服困难完成了枯燥的背诵”）、连击天数（如“连续第 7 天”）以及情绪反馈（如孩子勾选了“累”），生成极其暖心、定制化的萌宠对话：“*虽然今天背诗有点累，但你还是坚持完成了，你的毅力小树又长大了一截！休息一下喝杯水吧！*”。
* **可行性结论**：完全异步触发或预生成，不阻断核心主流程；配置 2 秒超时，超时直接回退至本地 200+ 条经过教育学专家审阅的优质固定鼓励文案库。

#### ④【自律趋势深度周报】：强真需求（Strong True Need）
* **现状痛点**：Sprint 3 虽然提供了 30/90 天 GitHub 风格热力图和分类柱状图，但多数家长面对纯数字无法获得可落地的教育洞察。
* **AI 价值**：每周日晚异步综合全周打卡数据、超时率、情绪疲惫分布以及度假卡使用情况，生成具备**成长型思维（Growth Mindset）**的深度建议：
  - 发现隐性阻力：“*小明在周三晚上出现连续 3 次‘疲惫’反馈，建议将周三晚的奥数任务从 45 分钟拆分为两段 20 分钟*”。
  - 发现坚持闪光点：“*本周在没有家长催促下自主完成了 4 次晨读，建议在周末兑换愿望时给予专项口头表扬*”。
* **可行性结论**：周报属于离线非实时计算，可在后台以低优先级定时任务执行，容错窗口极大。

---

## 3. 系统架构与技术选型设计

### 3.1 统一 OpenAI 兼容 AIService 网关抽象

为了兼顾开发体验、运行成本与数据主权，系统设计完全标准化的 `AIService` 抽象接口，采用业内事实标准的 **OpenAI Wire Protocol (`/v1/chat/completions`)** 作为统一底层通信协议[6][8]。

#### 3.1.1 模型后端多源适配策略
后端通过统一接口无缝支持三种部署形态，可通过 `.env` 环境变量无缝热切换：

1. **本地私有化引擎（Local Edge）**：
   - 适配器：**Ollama** (`http://127.0.0.1:11434/v1`) 或 **vLLM** (`http://127.0.0.1:8000/v1`)。
   - 核心模型：`Qwen2.5-7B-Instruct`（中文理解与指令遵循优异）与 `Qwen2.5-VL-7B`（轻量多模态）。
   - 核心优势：**物理级本地回环，零外部网络依赖，数据 100% 不出家庭服务器，零 Token 费用**。
2. **直连云端主流大模型（Direct Cloud）**：
   - 适配器：**DeepSeek API** (`https://api.deepseek.com/v1`) [8] 与 **OpenAI API** (`https://api.openai.com/v1`) [6]。
   - 核心模型：`deepseek-chat` (DeepSeek-V3) 与 `deepseek-reasoner` (DeepSeek-R1)。
   - 核心优势：极致的推理能力与极低成本（DeepSeek 输入 1-2 元/百万 Token），具备出色的复杂逻辑分析能力。
3. **企业级聚合网关（CPA Gateway / Reverse Proxy）**：
   - 适配器：OneAPI / NewAPI / LiteLLM。
   - 核心优势：支持跨渠道故障转移（Fallback Routing）、多 Key 负载均衡与配额治理。

#### 3.1.2 抽象基类与网关工厂架构实现

```python
# src/backend/app/services/ai/base.py
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from app.schemas.ai import (
    CopilotParseResult,
    EncouragementResult,
    ProofVerificationResult,
    WeeklyInsightResult,
)

class BaseAIService(ABC):
    """统一 AI 服务抽象基类"""

    @abstractmethod
    async def parse_task_copilot(
        self, prompt: str, current_date_str: str, child_context: Dict[str, Any]
    ) -> CopilotParseResult:
        """自然语言解析生成任务草稿清单"""
        pass

    @abstractmethod
    async def generate_instant_encouragement(
        self, task_title: str, feedback_mood: Optional[str], current_streak: int, child_nickname: str
    ) -> EncouragementResult:
        """打卡后正向情绪即时激励生成"""
        pass

    @abstractmethod
    async def verify_multimodal_proof(
        self, image_bytes: bytes, mime_type: str, task_title: str, task_desc: Optional[str]
    ) -> ProofVerificationResult:
        """多模态打卡凭证软核验"""
        pass

    @abstractmethod
    async def generate_weekly_insight(
        self, weekly_stats_summary: Dict[str, Any]
    ) -> WeeklyInsightResult:
        """自律趋势深度周报生成"""
        pass
```

### 3.2 严格结构化输出保证（Pydantic & JSON Schema）

大语言模型原生输出自由文本的不确定性是工程落地的最大隐患。Family Plan 采用 **Pydantic v2 + 双轨结构化保证策略**：

```text
                  ┌──────────────────────────────────────────────┐
                  │          Pydantic v2 Schema 定义             │
                  └──────────────────────┬───────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
     [OpenAI / vLLM 最新版本]                         [DeepSeek / Ollama / CPA 兼容模式]
 ┌──────────────────────────────────────┐        ┌──────────────────────────────────────┐
 │  原生 Structured Outputs 模式 [6]     │        │  JSON Object Mode + Schema 注入 [8]  │
 │  response_format={                   │        │  response_format={"type":            │
 │    "type": "json_schema",            │        │                     "json_object"}   │
 │    "json_schema": {                  │        │  System Prompt 显式嵌入 JSON Schema   │
 │      "strict": True,                 │        │  + 强制要求输出以 { 开始以 } 结束     │
 │      "schema": Model.model_json_...  │        │                                      │
 │    }                                 │        │                                      │
 │  }                                   │        │                                      │
 └──────────────────┬───────────────────┘        └──────────────────┬───────────────────┘
                    │                                               │
                    ▼                                               ▼
 ┌──────────────────────────────────────────────────────────────────────────────────────┐
 │             TypeAdapter(TargetSchema).validate_json(raw_text) 运行时强校验            │
 │             - 若校验失败：正则自动提取最外层 {...} 进行 1 次修复校验                    │
 │             - 若二次失败：立即触发 Circuit Breaker 降级引擎，回退确定性结果              │
 └──────────────────────────────────────────────────────────────────────────────────────┘
```

1. **轨 A（原生 Structured Outputs）**：对于官方支持 `response_format={"type": "json_schema", ...}` 且 `strict: true` 的服务商（如 OpenAI gpt-4o 系列及支持约束采样的最新推理引擎），API 在 Token 采样阶段通过有限状态自动机（FSM/GBNF 文法）强制约束输出，实现 100% 格式对齐[6][7]。
2. **轨 B（JSON Object Mode + 强校验防御体系）**：对于 DeepSeek 等目前稳定支持 `{"type": "json_object"}` 的端点[8]，系统在 System Prompt 中自动插入由 `Model.model_json_schema()` 生成的格式规范，并在代码层通过 `TypeAdapter(Model).validate_json()` 进行严格反序列化与边界防御。

### 3.3 离线容灾与 2 秒超时熔断降级架构

在家庭打卡场景下，**系统的可用性与响应速度高于 AI 的表现力**。若因外网中断、云端宕机或模型过载导致主流程悬挂，用户体验将遭受毁灭性打击。

#### 3.3.1 三态熔断器状态机（Circuit Breaker Pattern）
借鉴生产级异步容灾设计（Nygard Resilience Patterns）[10]，实现内存级异步三态熔断器：
- **CLOSED（闭合/健康）**：请求正常流向模型后端。若在时间窗口内连续失败达 `MAX_FAILURES`（默认 3 次）或平均超时率超过阈值，熔断器立即跳变为 **OPEN**。
- **OPEN（跳闸/熔断）**：拦截所有对模型的外部调用，**零等待**直接路由至本地降级引擎。熔断状态持续 `RESET_TIMEOUT_SECONDS`（默认 60 秒）。
- **HALF-OPEN（半开/试探）**：经过 60 秒后，放行 1 笔金丝雀请求。若成功则恢复为 **CLOSED**；若再次失败则迅速回到 **OPEN** 并重新计时。

```python
# 核心超时与熔断控制代码示例
import asyncio
from app.services.ai.circuit_breaker import ai_circuit_breaker
from app.services.ai.fallback import LocalRuleFallbackEngine

async def execute_with_resilience(coroutine_func, fallback_func, *args, **kwargs):
    if ai_circuit_breaker.is_open():
        logger.warning("AI Circuit Breaker is OPEN. Directly invoking local fallback.")
        return await fallback_func(*args, **kwargs)

    try:
        # 严格执行 2.0 秒超时熔断控制
        async with asyncio.timeout(2.0):
            result = await coroutine_func(*args, **kwargs)
            ai_circuit_breaker.record_success()
            return result
    except (asyncio.TimeoutError, Exception) as exc:
        ai_circuit_breaker.record_failure(exc)
        logger.error(f"AI Call failed or timed out (2.0s limit): {exc}. Invoking fallback.")
        return await fallback_func(*args, **kwargs)
```

#### 3.3.2 四大能力的确定性本地降级矩阵 (Deterministic Fallback Matrix)

| 场景 | AI 正常运行表现 | 熔断/离线降级后表现（Local Rule Fallback） | 业务与用户感知 |
| :--- | :--- | :--- | :--- |
| **Copilot 建任务** | 智能推断学科、建议时长、规划合理起止时间与奖励星数 | 启发式规则：基于结巴/正则切分句子，标题取提取词，默认 20 分钟、1 颗星、需审核 | 标记 `is_degraded: true`，提示“已使用离线极速模式解析”，完全可用 |
| **打卡即时激励** | 结合任务名、连击数、心情（疲惫/轻松）生成动态萌宠私语 | 离线预置语料库：根据 `[心情 × 连击天数]` 索引的高质量教育专家鼓励语 | **0 毫秒感知差**，孩子完全察觉不到模型离线，仍获热烈鼓励 |
| **拍照软核验** | 识别作业整洁度、内容匹配度、生成家长摘要与置信度评分 | 跳过视觉识别，标记 `ai_verify_status: "skipped"`，直接送入待家长人工确认队列 | 打卡依然成功，家长照常审核照片，流程不中断 |
| **自律趋势周报** | 深度心理学归因分析、识别周三疲劳阻碍、定制亲子沟通指南 | 本地统计汇总模板：“本周共完成 X 项任务，完成率 Y%，获得 Z 颗星” | 纯本地纯数值报告展示，周看板依然丰富可用 |

### 3.4 未成年人数据脱敏与本地回环通信合规

家庭场景涉及未成年人的极度敏感信息，系统必须满足《中华人民共和国个人信息保护法》与《未成年人网络保护条例》（2024 年 1 月 1 日施行）[9]的严格合规要求：

#### 3.4.1 数据脱敏规范（PII Sanitization）
1. **真实身份隔离**：在组装送往外部大模型的 Prompt 之前，儿童真实姓名、出生年月日、家庭住址、学校名称全部进行脱敏清洗。儿童统一使用匿名化标签（如 `child_nickname` 或通用指代 `“一位 8 岁的小朋友”`）。
2. **照片 EXIF 元数据物理剥离**：手机与 iPad 拍摄的照片普遍包含 GPS 经纬度、拍摄具体精确时间戳、设备硬件序列号。前端 Canvas 压缩与后端 FastAPI 接收时，强制对图像执行 EXIF 清理：
   ```python
   from PIL import Image
   import io

   def strip_exif_and_sanitize_image(image_bytes: bytes) -> bytes:
       """物理剥离所有 EXIF 元数据并标准化为安全 RGB 格式"""
       with Image.open(io.BytesIO(image_bytes)) as img:
           data = list(img.getdata())
           clean_img = Image.new(img.mode, img.size)
           clean_img.putdata(data)
           out_io = io.BytesIO()
           clean_img.save(out_io, format="JPEG", quality=85)
           return out_io.getvalue()
   ```
3. **图像未成年人面部与敏感区域保护**：多模态 VLM Prompt 严格设定安全边界：*“仅核对桌面陈列、书写本册与任务实物完成度；若画面出现人物面部，不得分析或描述面部生理特征，重点聚焦于完成结果本身”*。

#### 3.4.2 严格网络通信拓扑（Local Loopback Isolation）
- **本地部署优先**：对于具备本地算力的家庭主机，Ollama / vLLM 监听接口绑定于 `127.0.0.1`，后端仅通过本地回环地址通信，拒绝外网入站，实现真正的物理级隐私不出门。
- **云端零留存策略（Zero Data Retention）**：若选用 DeepSeek 或 OpenAI API，调用时配置协议头声明不参与任何模型微调训练，请求数据在推理完成后立即从内存销毁。

---

## 4. API 契约与数据模型定义

### 4.1 Pydantic 核心数据模型

```python
# src/backend/app/schemas/ai.py
from datetime import date, time
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field

# ----------------- 1. Copilot Task Parser -----------------
class ParsedTaskItem(BaseModel):
    title: str = Field(..., max_length=160, description="任务标题，如：口算练习一页")
    description: Optional[str] = Field(None, description="任务补充说明")
    expected_minutes: Optional[int] = Field(20, ge=1, le=240, description="预估时长(分钟)")
    reward_stars: int = Field(1, ge=0, le=5, description="奖励星星数")
    require_approval: bool = Field(False, description="是否需要家长审核")
    scheduled_start: Optional[time] = Field(None, description="建议开始时间")
    scheduled_end: Optional[time] = Field(None, description="建议结束时间")
    category: Optional[str] = Field("learning", description="分类：learning, sport, chore, habit")

class CopilotParseRequest(BaseModel):
    prompt: str = Field(..., min_length=2, max_length=1000, description="家长口语录入文本")
    child_id: UUID = Field(..., description="目标孩子ID")
    target_date: Optional[date] = Field(None, description="目标任务日期，缺省为今日")

class CopilotParseResult(BaseModel):
    tasks: List[ParsedTaskItem] = Field(default_factory=list, description="解析出的任务列表")
    raw_summary: str = Field(..., description="AI 意图理解与友好反馈话术")
    is_degraded: bool = Field(False, description="是否触发离线规则降级")

# ----------------- 2. Instant Encouragement -----------------
class EncouragementRequest(BaseModel):
    task_id: UUID = Field(..., description="打卡完成的任务ID")
    child_id: UUID = Field(..., description="孩子ID")
    feedback_mood: Optional[str] = Field(None, description="孩子提交的情绪反馈：relaxed, tired, happy")
    current_streak: int = Field(0, ge=0, description="当前连续打卡天数")

class EncouragementResult(BaseModel):
    message: str = Field(..., description="正向激励文案")
    mascot_mood: str = Field("cheer", description="萌宠展示状态：cheer, proud, sparkle, warm")
    sound_effect: str = Field("chime", description="推荐前端播放音效：chime, fanfare, harp")
    is_degraded: bool = Field(False, description="是否使用离线语料库")

# ----------------- 3. Multimodal Proof Verify -----------------
class ProofVerificationResult(BaseModel):
    match_score: int = Field(..., ge=0, le=100, description="任务匹配度(0-100)")
    ai_summary: str = Field(..., description="供家长快速审批参考的 1 句话提炼")
    kid_comment: str = Field(..., description="给孩子的趣味鼓励贴纸文案")
    detected_elements: List[str] = Field(default_factory=list, description="画面识别出的核心要素")
    is_degraded: bool = Field(False, description="是否降级跳过")

# ----------------- 4. Weekly Growth Insight -----------------
class WeeklyInsightResult(BaseModel):
    headline: str = Field(..., description="周报核心总结一句话")
    growth_highlights: List[str] = Field(..., description="本周闪光点与自律突破")
    friction_observations: List[str] = Field(..., description="发现的困难与打卡摩擦点")
    parenting_tips: List[str] = Field(..., description="基于心理学自主感引导的家长沟通建议")
    recommended_reward_action: Optional[str] = Field(None, description="建议家长给予的具体非物质/物质奖励")
    is_degraded: bool = Field(False, description="是否降级模板")

# ----------------- 5. AI Service Health -----------------
class AIHealthStatus(BaseModel):
    status: str = Field(..., description="healthy, degraded, disabled")
    provider: str = Field(..., description="ollama, deepseek, openai, local_fallback")
    circuit_breaker_state: str = Field(..., description="closed, open, half_open")
    latency_ms: Optional[float] = Field(None, description="最近单次探针延迟(毫秒)")
```

### 4.2 RESTful 端点与网关契约

| 方法 | 路径 | 鉴权主体 | 速率限制 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/ai/copilot/parse-tasks` | 家长 Bearer JWT | 10次/分钟 | 自然语言解析生成结构化任务清单草稿 |
| `POST` | `/api/v1/ai/tasks/{task_id}/encourage` | 孩子 Device Token / 家长 | 30次/分钟 | 任务打卡后即时获取正向情绪激励（支持乐观拉取） |
| `POST` | `/api/v1/ai/tasks/{task_id}/verify-proof` | 孩子 Device Token | 5次/分钟 | 上传打卡图片凭证并触发多模态异步软核验 |
| `GET` | `/api/v1/ai/children/{child_id}/weekly-insight` | 家长 Bearer JWT | 5次/分钟 | 获取当前或指定周的深度自律趋势与亲子洞察 |
| `GET` | `/api/v1/ai/health` | 公开/管理员 | 60次/分钟 | 探测 AI 服务通道与熔断器健康状态 |

### 4.3 数据库模型演进（Alembic Migration）

为了支撑多模态凭据回溯与周报持久化，扩展数据库表结构：

```text
daily_tasks 表扩展字段：
┌────────────────────────┬──────────────────┬─────────────┬─────────────────────────────────────┐
│ 字段名                  │ 类型             │ 可空        │ 说明                                │
├────────────────────────┼──────────────────┼─────────────┼─────────────────────────────────────┤
│ proof_image_url        │ VARCHAR(512)     │ NULL        │ 打卡完成凭据照片本地/对象存储路径     │
│ ai_verify_status       │ VARCHAR(20)      │ NULL        │ pending, verified, suspicious, skip │
│ ai_verify_summary      │ VARCHAR(255)     │ NULL        │ AI 提炼的 1 句话审批参考标签        │
│ ai_verify_score        │ INTEGER          │ NULL        │ 匹配置信度 (0-100)                  │
│ encouragement_text     │ VARCHAR(255)     │ NULL        │ 缓存生成的正向激励文案               │
└────────────────────────┴──────────────────┴─────────────┴─────────────────────────────────────┘

新建 ai_weekly_reports 表：
┌────────────────────────┬──────────────────┬─────────────┬─────────────────────────────────────┐
│ 字段名                  │ 类型             │ 约束        │ 说明                                │
├────────────────────────┼──────────────────┼─────────────┼─────────────────────────────────────┤
│ id                     │ UUID             │ PK          │ 唯一标识                            │
│ child_id               │ UUID             │ FK          │ 关联孩子 ID                         │
│ week_start_date        │ DATE             │ NOT NULL    │ 自然周起始日（周一）                 │
│ headline               │ VARCHAR(255)     │ NOT NULL    │ 周报一句话导语                      │
│ report_json            │ JSONB / TEXT     │ NOT NULL    │ 完整结构化结果 (亮点、摩擦点、建议)   │
│ is_degraded            │ BOOLEAN          │ DEFAULT F   │ 是否降级生成                        │
│ created_at             │ TIMESTAMPTZ      │ DEFAULT NOW │ 生成时间戳                          │
└────────────────────────┴──────────────────┴─────────────┴─────────────────────────────────────┘
```

---

## 5. 前端交互流程与双端体验规范

### 5.1 家长端（Parent Web）：Copilot 建任务与智能审批流

#### 5.1.1 自然语言 Copilot 交互抽屉设计
1. **轻量入口**：在 TaskManage 和 Home 页面右上角常驻 `✨ AI 智能建任务` 按钮（采用系统纸张复古色系 `--accent: #436A54`）。
2. **渐进式录入**：支持快捷语音输入或键盘键入。
3. **透明可编辑草稿箱**：AI 返回解析任务后，以交互卡片形式呈现；家长可直观微调时长、星星与审核开关；点击 `一键加入今日计划` 完成批量事务写入。

```text
Parent Web Copilot Drawer 视觉原型示意：
┌─────────────────────────────────────────────────────────────┐
│ ✨ AI 任务助手 (Copilot)                              [✕]   │
├─────────────────────────────────────────────────────────────┤
│ 输入口令或想让孩子做的事：                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 明天上午读绘本20分钟，下午跳绳500下(2星)，晚上口算拍照审核│ │
│ └─────────────────────────────────────────────────────────┘ │
│ [ 🎙️ 语音输入 ]                       [ ⚡ 开始智能解析 ]     │
├─────────────────────────────────────────────────────────────┤
│ 💡 已为你生成 3 项任务草稿（可直接微调）：                    │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📖 晨读绘本 20 分钟                ⏱️ 20m  ⭐ 1星 [审核:关]│ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 🏃 户外跳绳 500 下                 ⏱️ 15m  ⭐ 2星 [审核:关]│ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 🔢 数学口算一页                    ⏱️ 15m  ⭐ 1星 [审核:开]│ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [ 取消 ]                              [ 确认一键发布 (3) ]  │
└─────────────────────────────────────────────────────────────┘
```

#### 5.1.2 智能审批流（AI Triage Badge）
在家长待审批列表中，凡上传了凭据照片的任务，直接在缩略图右侧展示 AI 预审 Chip：
- `🟢 AI匹配优秀 (96%)：已书写完成一页数学练习`
- `🟡 建议人工复核 (65%)：画面较为模糊，请确认作业页码`
家长一目了然，审批单项任务由以往的 30 秒核验缩短至 1 秒决策。

### 5.2 孩子端（Child iPad PWA）：乐观打卡与即时情绪激励气泡

#### 5.2.1 极速乐观打卡原则（Zero Latency）
遵循 Sprint 1 确立的 iPad 交互体系，打卡按钮维持 72x72px 触控戳。点击打卡瞬间：
1. **< 50ms**：播放 Web Audio 预热印章和弦，按钮产生物理弹性缩放动画。
2. **< 100ms**：页面任务状态置为已完成或待审核，星星数飞入右上角徽标。
3. **异步并行**：向 `/api/v1/ai/tasks/{id}/encourage` 发起异步请求；若 2 秒未返回，前端静默使用内置的预设激励库弹出气泡。

#### 5.2.2 萌宠正向情绪气泡组件设计
打卡完成后，任务卡片顶部滑出暖萌动态气泡，带来如 Finch 般的陪伴感：

```jsx
// src/child-pwa/src/components/EncouragementBubble.jsx 示意
export function EncouragementBubble({ message, mascotMood = "cheer" }) {
  return (
    <div className="mascot-bubble-container" role="status" aria-live="polite">
      <div className={`mascot-avatar mood-${mascotMood}`} aria-hidden="true">
        {mascotMood === "sparkle" ? "🌟" : mascotMood === "proud" ? "🦁" : "🦉"}
      </div>
      <div className="mascot-speech-bubble">
        <p className="mascot-text">{message}</p>
      </div>
    </div>
  );
}
```

---

## 6. 分期实施路线（Sprint 规划）

遵循敏捷演进与小步快跑原则，将全景方案拆解为 3 个独立交付的 Sprint：

```text
Sprint 4 (底层网关 + Copilot)  ───► Sprint 5 (情绪激励 + 周报洞察) ───► Sprint 6 (多模态软核验 + 隐私合规)
├── AIService 统一协议网关          ├── 即时正向情绪激励引擎              ├── 客户端 EXIF 剥离与压缩
├── 2秒熔断降级中间件              ├── Child PWA 萌宠动态气泡            ├── VLM 多模态软核验管线
├── Pydantic 结构化解析器          ├── 自律趋势深度周报引擎              ├── 家长端智能审核 Chip
└── Parent Web Copilot 建任务抽屉   └── Parent Web 心理学洞察卡片         └── 未成年人数据合规审计
```

### Sprint 4：AIService 基础底座与自然语言建任务 Copilot（目标工期：3-4 天）
* **核心目标**：搭设 AI 服务底座，攻克家长录入高摩擦痛点。
* **Backend 交付**：
  1. `app/core/config.py` 扩充 AI 网关配置项（`AI_BACKEND`, `AI_BASE_URL`, `AI_API_KEY`, `AI_TIMEOUT_SECONDS` 等）。
  2. 实现统一 `BaseAIService`、`OpenAICompatibleAIService` 及内存三态熔断器 `CircuitBreaker`。
  3. 实现 `POST /api/v1/ai/copilot/parse-tasks`，支持多任务口语意图解析与本地正则/启发式降级。
* **Frontend 交付**：
  1. Parent Web 新增 `TaskCopilotModal` 抽屉组件，支持口语输入、即时解析预览、单项编辑与一键批量保存。
* **验收准则（DoD）**：
  - 测试用例覆盖率：云端模型正常、超时 2s 触发降级、断网自动回退启发式解析等单元测试 100% 通过。
  - 自然语言解析常规输入（包含时间、星数、审核说明）准确率 $\ge 95\%$。

### Sprint 5：正向情绪即时激励引擎与自律趋势深度周报（目标工期：3-4 天）
* **核心目标**：落地儿童端正向情感反馈机制，输出高价值亲子深度洞察。
* **Backend 交付**：
  1. 实现 `POST /api/v1/ai/tasks/{task_id}/encourage`，关联打卡任务、心情、连击天数生成具体表扬。
  2. 实现 `LocalRuleFallbackEngine` 内置的 200+ 条离线结构化教育学鼓励语料库。
  3. 实现 `GET /api/v1/ai/children/{child_id}/weekly-insight`，整合 7 天完成度、放弃率与情绪分布，生成符合 SDT 自我决定理论的成长建议。
  4. 数据库新增 `ai_weekly_reports` 表及对应 Alembic Migration。
* **Frontend 交付**：
  1. Child PWA 集成 `EncouragementBubble` 萌宠对话气泡，打卡后顺滑弹出，零延迟阻断。
  2. Parent Web 成长看板（Analytics/Report）嵌入“AI 亲子自律周洞察”卡片，提供摩擦点诊断与表扬话术建议。
* **验收准则（DoD）**：
  - 核心打卡交互端到端延迟保持 $\le 100\text{ms}$，激励拉取完全异步。
  - 周报包含清晰的“闪光点”、“阻力摩擦点”与“行动建议”，拒绝假大空套话。

### Sprint 6：多模态打卡软核验与未成年人隐私合规体系（目标工期：3-4 天）
* **核心目标**：引入视觉辅助核验，打通家长防疲劳审批闭环，确立数据安全红线。
* **Backend 交付**：
  1. 实现 `strip_exif_and_sanitize_image` 图像清洗管线。
  2. 实现 `POST /api/v1/ai/tasks/{task_id}/verify-proof` 多模态软核验端点，产出家长决策 Chip 与儿童趣味点评。
  3. 数据库 `daily_tasks` 扩充 `proof_image_url`, `ai_verify_summary` 等字段。
* **Frontend 交付**：
  1. Child PWA 在需要审核的任务完成卡片中加入“📸 拍照凭证（可选）”小底单，上传即完成，不阻塞后续操作。
  2. Parent Web 待审批专区渲染缩略图与 AI 辅助标记，支持“一键批准所有 AI 判定优秀项”。
* **验收准则（DoD）**：
  - 上传图片的所有 EXIF GPS/时间戳元数据在服务端与客户端双重剥离。
  - 视觉模型不可用时静默跳过，绝无打卡卡死或误判阻拦情况。

---

## 7. 参考文献与引用清单

## Sources

[1] https://apps.apple.com/us/app/finch-self-care-pet/id1528595748 — Finch: Self-Care Pet App
[2] https://slate.com/technology/2026/09/finch-app-self-care-wellness-review.html — Slate: Finch App Review and Gamified Self-Care
[3] https://dl.acm.org/doi/full/10.1145/3821402.3830132 — ACM: Long-Term Lived Experiences with Gamified Self-Care App Finch
[4] https://habitbox.app/blog/finch-app-review — HabitBox: Finch vs Habitica Gamification Comparison
[5] https://openai.com/index/duolingo — OpenAI Customer Stories: Duolingo Max
[6] https://platform.openai.com/docs/guides/structured-outputs — OpenAI Structured Outputs Guide
[7] https://docs.ollama.com/capabilities/structured-outputs — Ollama Structured Outputs Documentation
[8] https://api-docs.deepseek.com/guides/json_mode — DeepSeek API JSON Output Guide
[9] https://xzfg.moj.gov.cn/front/law/detail?LawID=1694 — 未成年人网络保护条例 (中华人民共和国国务院令第766号)
[10] https://github.com/tsayin4/async-circuit-breaker — Async Circuit Breaker Implementation in Python Asyncio
[11] https://www.apa.org/research-practice/conduct-research/self-determination-theory — APA: Self-Determination Theory (Ryan & Deci)
