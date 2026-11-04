import asyncio
import json
import logging
import re
import time
from datetime import date, timedelta
from typing import Any, Optional
import httpx

from app.core.config import settings
from app.schemas.ai import AIHealthStatus, CopilotParseResult, ParsedTaskItem
from app.services.analytics import classify_task_category

logger = logging.getLogger(__name__)


class CircuitBreakerState:
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreaker:
    """
    三态内存熔断器：
    - CLOSED: 正常放行请求。连续失败达到阈值后进入 OPEN。
    - OPEN: 快速失败跳过模型请求，静默降级为本地规则。超过重置冷却时间后进入 HALF_OPEN。
    - HALF_OPEN: 允许单次探测请求。成功则恢复 CLOSED，失败则重新回到 OPEN。
    """

    def __init__(self, failure_threshold: int = 3, reset_timeout: float = 60.0):
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self._state = CircuitBreakerState.CLOSED
        self._failure_count = 0
        self._last_state_change = time.time()
        self._half_open_in_flight = False

    @property
    def state(self) -> str:
        if self._state == CircuitBreakerState.OPEN:
            if time.time() - self._last_state_change >= self.reset_timeout:
                self._state = CircuitBreakerState.HALF_OPEN
                self._last_state_change = time.time()
                self._half_open_in_flight = False
        return self._state

    def can_attempt(self) -> bool:
        current_state = self.state
        if current_state == CircuitBreakerState.CLOSED:
            return True
        if current_state == CircuitBreakerState.HALF_OPEN:
            if not self._half_open_in_flight:
                self._half_open_in_flight = True
                return True
            return False
        return False

    def record_success(self) -> None:
        self._failure_count = 0
        self._state = CircuitBreakerState.CLOSED
        self._last_state_change = time.time()
        self._half_open_in_flight = False

    def record_failure(self, exc: Optional[Exception] = None) -> None:
        self._failure_count += 1
        self._last_state_change = time.time()
        self._half_open_in_flight = False

        if self._state == CircuitBreakerState.HALF_OPEN:
            self._state = CircuitBreakerState.OPEN
            logger.warning("AI CircuitBreaker: half-open probe failed, tripping back to OPEN.")
        elif self._state == CircuitBreakerState.CLOSED:
            if self._failure_count >= self.failure_threshold:
                self._state = CircuitBreakerState.OPEN
                logger.warning(
                    "AI CircuitBreaker tripped to OPEN after %d consecutive failures.",
                    self._failure_count,
                )

    def reset(self) -> None:
        self._state = CircuitBreakerState.CLOSED
        self._failure_count = 0
        self._last_state_change = time.time()
        self._half_open_in_flight = False


# 全局单例熔断器
ai_circuit_breaker = CircuitBreaker(
    failure_threshold=settings.ai_circuit_breaker_max_failures,
    reset_timeout=settings.ai_circuit_breaker_reset_timeout,
)


def _parse_time_from_text(text: str) -> tuple[Optional[str], Optional[str], int]:
    """
    解析文本中的时间与分钟，返回 (start_time, end_time, minutes)
    例如：“每天晚上7点练琴20分钟” -> start="19:00", end="19:20", minutes=20
    """
    # 1. 提取用时分钟数
    minutes = 20  # 缺省 20 分钟
    min_match = re.search(r"(\d+)\s*(?:个?小时|h|hr)\s*(?:(?:和|零)?(\d+)\s*(?:分钟|分|mins?|m)?)?", text, re.I)
    if min_match:
        hours = int(min_match.group(1))
        extra_m = int(min_match.group(2)) if min_match.group(2) else 0
        minutes = hours * 60 + extra_m
    else:
        m_match = re.search(r"(\d+)\s*(?:分钟|分|mins?|m)(?!点)", text, re.I)
        if m_match:
            minutes = int(m_match.group(1))
        elif "半小时" in text:
            minutes = 30
        elif "一刻钟" in text:
            minutes = 15

    # 限制分钟范围在 1-240
    minutes = max(1, min(240, minutes))

    # 2. 提取开始时间点
    # 模式 A: 晚上7点 / 下午4:30 / 早上8点半 / 19:00
    start_time: Optional[str] = None
    end_time: Optional[str] = None

    time_match = re.search(
        r"(?:每[天日])?\s*(早上|早晨|上午|中午|下午|傍晚|晚上|夜间)?\s*(\d{1,2})\s*(?:[点时:：]\s*(\d{1,2})?(?:分)?)?(半)?",
        text,
    )
    if time_match and (time_match.group(1) or ":" in time_match.group(0) or "点" in time_match.group(0)):
        period = time_match.group(1) or ""
        hour = int(time_match.group(2))
        minute = int(time_match.group(3)) if time_match.group(3) else (30 if time_match.group(4) else 0)

        if period in {"下午", "傍晚", "晚上", "夜间"}:
            if hour < 12:
                hour += 12
        elif period in {"早上", "早晨", "上午"}:
            if hour == 12:
                hour = 0
        elif period == "中午":
            if hour < 11:
                hour += 12

        if 0 <= hour <= 23 and 0 <= minute <= 59:
            start_time = f"{hour:02d}:{minute:02d}"
            end_total = (hour * 60 + minute + minutes) % 1440
            end_time = f"{end_total // 60:02d}:{end_total % 60:02d}"

    return start_time, end_time, minutes


def _parse_single_task_segment(raw_segment: str) -> Optional[ParsedTaskItem]:
    """启发式解析单段口语文本为任务项"""
    segment = raw_segment.strip()
    if not segment or len(segment) < 2:
        return None

    # 1. 审核标记检测
    require_approval = bool(
        re.search(
            r"(?:需(?:要)?(?:家长)?(?:确认|审核|检查|批准)|拍照(?:审核|确认)?|待(?:审核|确认)|需复核|拍照打卡)",
            segment,
        )
    )

    # 2. 星星奖励检测
    reward_stars = 1
    star_match = re.search(r"\((\d+)\s*星\)|（(\d+)\s*星）", segment)
    if star_match:
        reward_stars = int(star_match.group(1) or star_match.group(2))
    else:
        # 支持“10星”、“奖励2颗星”、“给3星”等
        star_match2 = re.search(r"(?:给|得|奖励|奖)?\s*(\d+)\s*(?:颗|个)?(?:星|star)", segment, re.I)
        if star_match2:
            # 避免将“8点”、“10点”中的数字误识别为星数
            val_str = star_match2.group(1)
            # 如果匹配位置紧跟着点/时，则跳过
            reward_stars = int(val_str)
    reward_stars = max(0, min(5, reward_stars))

    # 3. 时间与用时解析
    start_time, end_time, expected_minutes = _parse_time_from_text(segment)

    # 4. 清理标题
    clean_title = segment
    # 剔除常见前缀
    clean_title = re.sub(
        r"^(?:今天|明天|后天|每天|每日|每晚|早上|早晨|上午|中午|下午|傍晚|晚上|夜间|请让|让孩子|让小明|督促孩子|\s)+",
        "",
        clean_title,
    )
    # 剔除时间描述
    clean_title = re.sub(
        r"(?:早上|早晨|上午|中午|下午|傍晚|晚上|夜间)?\s*\d{1,2}\s*[点时:：]\s*(?:\d{1,2}\s*分?)?半?",
        "",
        clean_title,
    )
    # 剔除时长描述
    clean_title = re.sub(r"\d+\s*(?:个?小时|h|hr)\s*(?:(?:和|零)?\d+\s*(?:分钟|分|mins?|m)?)?", "", clean_title)
    clean_title = re.sub(r"\d+\s*(?:分钟|分|mins?|m)", "", clean_title)
    clean_title = re.sub(r"(?:半小时|一刻钟)", "", clean_title)
    # 剔除星星与审核描述
    clean_title = re.sub(
        r"(?:给|得|奖励|奖)?\s*(?:\(?\s*\d+\s*星\s*\)?|（?\s*\d+\s*星\s*）?|\d+\s*(?:颗|个)?(?:星|star))",
        "",
        clean_title,
        flags=re.I,
    )
    clean_title = re.sub(
        r"(?:需(?:要)?(?:家长)?(?:确认|审核|检查|批准)|拍照(?:审核|确认)?|待(?:审核|确认)|需复核|拍照打卡)",
        "",
        clean_title,
    )
    # 剔除句首残留连接词与标点
    clean_title = re.sub(r"^[,，;；。、\s\-—]+|[,，;；。、\s\-—]+$", "", clean_title)
    clean_title = re.sub(r"^(?:并|且|然后|接着|还需要|还要|再|去)\s*", "", clean_title)
    clean_title = re.sub(r"[给得奖励奖]+$", "", clean_title)
    clean_title = clean_title.strip()

    if not clean_title or len(clean_title) < 2:
        # 如果清洗后过短，回退保留基础动作词
        m = re.search(r"([\u4e00-\u9fa5A-Za-z0-9]{2,12})", segment)
        clean_title = m.group(1) if m else "每日任务"

    # 截断最长 160 字
    clean_title = clean_title[:160]

    # 5. 分类自动推断
    category = classify_task_category(clean_title)

    return ParsedTaskItem(
        title=clean_title,
        expected_minutes=expected_minutes,
        reward_stars=reward_stars,
        category=category,
        start=start_time,
        end=end_time,
        scheduled_start=start_time,
        scheduled_end=end_time,
        require_approval=require_approval,
    )


def extract_relative_date(prompt: str, base_date: Optional[date] = None) -> date:
    """从口语文本中识别相对或绝对日期（如：明天、后天、周三、11月5日）"""
    base = base_date or date.today()
    if re.search(r"大后天", prompt):
        return base + timedelta(days=3)
    if re.search(r"后天", prompt):
        return base + timedelta(days=2)
    if re.search(r"明天|次日|明儿|明晨", prompt):
        return base + timedelta(days=1)
    if re.search(r"今天|当日|今日|今晚|今晨", prompt):
        return base

    # 识别特定日期如 11月3日 / 11-03 / 11.03
    m = re.search(r"(\d{1,2})[月\.\-](\d{1,2})[日号]?", prompt)
    if m:
        try:
            month = int(m.group(1))
            day = int(m.group(2))
            return date(base.year, month, day)
        except ValueError:
            pass

    return base


def heuristic_parse_tasks(prompt: str, target_date: Optional[date] = None) -> CopilotParseResult:
    """
    确定性离线启发式正则降级解析引擎：
    在模型网络不可用、未配置 API Key 或请求超时 (2.5s) 时无缝接管，保证可用性。
    """
    # 切分子任务：支持换行、分号、顿号、以及含明显分割特征的逗号
    segments = re.split(r"[\r\n；;]+", prompt)
    final_segments: list[str] = []
    for s in segments:
        s = s.strip()
        if not s:
            continue
        # 如果一段内部包含明显的并列时间短语（例如“上午读绘本20分钟，下午跳绳500下”），进一步按逗号/句号切分
        sub_parts = re.split(r"[,，。]+", s)
        for sp in sub_parts:
            sp = sp.strip()
            if sp:
                final_segments.append(sp)

    parsed_items: list[ParsedTaskItem] = []
    for seg in final_segments:
        item = _parse_single_task_segment(seg)
        if item:
            parsed_items.append(item)

    if not parsed_items:
        # 兜底生成一项任务
        item = _parse_single_task_segment(prompt)
        if item:
            parsed_items.append(item)
        else:
            cat = classify_task_category(prompt[:30])
            parsed_items.append(
                ParsedTaskItem(
                    title=prompt[:60].strip() or "新习惯任务",
                    expected_minutes=20,
                    reward_stars=1,
                    category=cat,
                    require_approval=False,
                )
            )

    resolved_date = extract_relative_date(prompt, target_date)
    summary = f"已使用启发式规则为您极速生成 {len(parsed_items)} 项任务草稿，可自由微调后一键发布。"
    return CopilotParseResult(
        tasks=parsed_items,
        raw_summary=summary,
        resolved_date=resolved_date,
        is_degraded=True,
    )


class AIService:
    """
    统一 AI 服务层：
    - 集成 2.5s 严格超时
    - 集成三态内存熔断器 (CLOSED -> OPEN -> HALF-OPEN)
    - 统一兼容 OpenAI Wire Protocol (/v1/chat/completions)
    - 失败/超时/断网自动降级回退启发式解析
    """

    def __init__(self):
        self.circuit_breaker = ai_circuit_breaker

    async def parse_tasks_copilot(
        self,
        prompt: str,
        child_id: Optional[Any] = None,
        target_date: Optional[date] = None,
        parent: Optional[Any] = None,
        db: Optional[Any] = None,
    ) -> CopilotParseResult:
        # 1. 优先检查家长个性化模型配置，未配置则回退全局环境变量
        parent_settings = None
        if parent is not None:
            if hasattr(parent, "ai_settings") and parent.ai_settings is not None:
                parent_settings = parent.ai_settings
            elif db is not None and hasattr(parent, "id"):
                from app.models.parent_ai_settings import ParentAISettings
                parent_settings = db.query(ParentAISettings).filter(ParentAISettings.parent_id == parent.id).first()

        if parent_settings is not None:
            if not parent_settings.is_enabled:
                logger.info("AI Copilot is disabled in parent settings. Using deterministic fallback.")
                return heuristic_parse_tasks(prompt, target_date)

            provider = (parent_settings.provider or "deepseek").lower()
            base_url = (parent_settings.base_url or "").strip().rstrip("/")
            if not base_url:
                if provider == "deepseek":
                    base_url = "https://api.deepseek.com/v1"
                elif provider == "openai":
                    base_url = "https://api.openai.com/v1"
                elif provider == "ollama":
                    base_url = "http://localhost:11434/v1"
                else:
                    base_url = "https://api.deepseek.com/v1"

            model = parent_settings.model or "deepseek-chat"
            from app.core.ai_crypto import decrypt_ai_api_key
            api_key = decrypt_ai_api_key(parent_settings.api_key_encrypted) or ""

            # 本地 Ollama 无需 API Key；其他提供商如无 Key 则尝试系统 Key，最终回退离线规则
            if provider != "ollama" and not api_key:
                if settings.ai_api_key and settings.ai_backend != "local_fallback":
                    api_key = settings.ai_api_key.strip()
                else:
                    logger.info("No AI API Key configured for parent. Downgrading to deterministic fallback.")
                    return heuristic_parse_tasks(prompt, target_date)
        else:
            api_key = settings.ai_api_key.strip()
            base_url = (settings.ai_base_url or "").rstrip("/")
            model = settings.ai_model or "deepseek-chat"
            if not api_key or settings.ai_backend == "local_fallback":
                logger.info("AI Service disabled or unconfigured. Using deterministic fallback.")
                return heuristic_parse_tasks(prompt, target_date)

        if not self.circuit_breaker.can_attempt():
            logger.warning("AI CircuitBreaker is OPEN. Skipping model call, invoking fallback.")
            return heuristic_parse_tasks(prompt, target_date)

        # 2. 组装 OpenAI 兼容协议请求
        today_date = target_date or date.today()
        system_prompt = (
            "你是一个专业的家庭亲子习惯养成助手。请将家长的口语任务描述精准解析为结构化任务列表。\n"
            f"今天基准日期是：{today_date.isoformat()}。\n"
            "输出必须是严格合法的 JSON 对象，格式如下：\n"
            "{\n"
            '  "raw_summary": "一句话友好反馈，如：已为您安排了练琴和跳绳任务",\n'
            f'  "resolved_date": "YYYY-MM-DD（若口语中提及“明天”、“后天”、“周三”等日期，请推算为标准公历日期；若未提及则填 {today_date.isoformat()}）",\n'
            '  "tasks": [\n'
            "    {\n"
            '      "title": "任务名称（简洁明确，如：练琴20分钟）",\n'
            '      "expected_minutes": 20,\n'
            '      "reward_stars": 1,\n'
            '      "category": "学习思考 | 体育运动 | 生活自理 | 家务协助 四选一",\n'
            '      "start": "19:00 (HH:MM格式，未提及则留 null)",\n'
            '      "end": "19:20 (HH:MM格式，未提及则留 null)",\n'
            '      "require_approval": false (文本提及确认、审核、拍照时为 true，否则为 false)\n'
            "    }\n"
            "  ]\n"
            "}\n"
            "注意：分类必须严格属于['学习思考', '体育运动', '生活自理', '家务协助']之一。"
        )

        user_content = f"家长录入内容：{prompt}\n当前基准日期：{today_date.isoformat()}"

        clean_base = base_url.rstrip("/") if base_url else "https://api.deepseek.com/v1"
        if clean_base.endswith("/chat/completions"):
            endpoint = clean_base
        elif clean_base.endswith("/v1"):
            endpoint = f"{clean_base}/chat/completions"
        else:
            endpoint = f"{clean_base}/v1/chat/completions"

        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        }

        headers = {
            "Content-Type": "application/json",
        }
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        # 3. 严格执行超时请求与熔断保护 (网络模型生成通常需要 8-15s，给予充足响应时间)
        timeout_s = settings.ai_timeout_seconds or 15.0
        try:
            async with httpx.AsyncClient(timeout=timeout_s) as client:
                resp = await client.post(endpoint, json=payload, headers=headers)
                if resp.status_code != 200:
                    raise RuntimeError(f"Model returned status {resp.status_code}: {resp.text[:200]}")
                data = resp.json()
                content_str = data["choices"][0]["message"]["content"]

                # 提取 JSON 块
                parsed_json = json.loads(content_str)
                raw_summary = parsed_json.get("raw_summary", f"已为您解析生成 {len(parsed_json.get('tasks', []))} 项任务")
                raw_tasks = parsed_json.get("tasks", [])

                # 解析目标日期
                resolved_date_val = parsed_json.get("resolved_date")
                final_resolved_date = extract_relative_date(prompt, today_date)
                if resolved_date_val and isinstance(resolved_date_val, str):
                    try:
                        final_resolved_date = date.fromisoformat(resolved_date_val[:10])
                    except Exception:
                        pass

                task_items: list[ParsedTaskItem] = []
                for rt in raw_tasks:
                    task_items.append(
                        ParsedTaskItem(
                            title=rt.get("title", "").strip() or "每日任务",
                            description=rt.get("description"),
                            expected_minutes=rt.get("expected_minutes") or 20,
                            reward_stars=rt.get("reward_stars", 1),
                            category=rt.get("category", "学习思考"),
                            start=rt.get("start"),
                            end=rt.get("end"),
                            scheduled_start=rt.get("start"),
                            scheduled_end=rt.get("end"),
                            require_approval=bool(rt.get("require_approval", False)),
                        )
                    )

                if not task_items:
                    raise ValueError("Model parsed 0 tasks")

                self.circuit_breaker.record_success()
                return CopilotParseResult(
                    tasks=task_items,
                    raw_summary=raw_summary,
                    resolved_date=final_resolved_date,
                    is_degraded=False,
                )

        except (TimeoutError, asyncio.TimeoutError, httpx.TimeoutException) as exc:
            logger.warning("AI request timed out after %.1fs: %s. Tripping failure and invoking fallback.", timeout_s, exc)
            self.circuit_breaker.record_failure(exc)
            return heuristic_parse_tasks(prompt, target_date)
        except Exception as exc:
            logger.warning("AI request failed: %s. Tripping failure and invoking fallback.", exc)
            self.circuit_breaker.record_failure(exc)
            return heuristic_parse_tasks(prompt, target_date)

    def get_health(self) -> AIHealthStatus:
        cb_state = self.circuit_breaker.state
        has_key = bool(settings.ai_api_key.strip())
        if not has_key:
            status = "disabled"
        elif cb_state == CircuitBreakerState.OPEN:
            status = "degraded"
        else:
            status = "healthy"

        return AIHealthStatus(
            status=status,
            backend=settings.ai_backend,
            circuit_breaker_state=cb_state,
            timeout_seconds=settings.ai_timeout_seconds,
        )


# 全局单例 AI 服务实例
ai_service = AIService()
