from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.child_streak_freeze_usage import ChildStreakFreezeUsage
from app.models.child_vacation import ChildVacation
from app.models.daily_task import DailyTask
from app.models.reward_ledger import RewardLedger
from app.models.streak import Streak
from app.services.reward_settings import get_or_create_reward_settings

CATEGORIES = ["学习思考", "体育运动", "生活自理", "家务协助"]

CATEGORY_KEYWORDS = {
    "学习思考": [
        "学习", "作业", "读", "写", "算术", "英语", "数学", "语文", "背诵", "练字",
        "画画", "思考", "编程", "实验", "考", "课", "阅读", "书", "乐高", "拼图",
        "奥数", "复习", "预习", "古诗", "日记", "练琴", "钢琴", "小提琴", "围棋",
        "科学", "地理", "历史", "诗词",
    ],
    "体育运动": [
        "运动", "跑", "跳", "绳", "球", "泳", "骑", "操", "步", "体能", "拉伸",
        "羽毛球", "乒乓球", "篮球", "足球", "游泳", "滑板", "轮滑", "武术", "跆拳道",
        "瑜伽", "散步", "爬山", "单杠", "俯卧撑", "仰卧起坐", "开合跳",
    ],
    "生活自理": [
        "起床", "睡觉", "睡", "刷牙", "洗脸", "洗澡", "穿衣", "喝水", "吃饭", "早睡",
        "早起", "午睡", "护眼", "防晒", "防蛀", "洗手", "吃药", "自理", "作息",
        "梳头", "剪指甲",
    ],
    "家务协助": [
        "家务", "洗碗", "扫地", "拖地", "擦桌", "倒垃圾", "收衣服", "叠被", "收拾",
        "整理", "做饭", "浇花", "喂宠物", "洗菜", "摆餐具", "协助", "帮妈妈", "帮爸爸",
        "擦窗", "扔垃圾", "洗衣服",
    ],
}


def classify_task_category(title: str, description: str | None = None) -> str:
    text = f"{title} {description or ''}"
    best_cat = "学习思考"
    best_score = 0
    for cat, keywords in CATEGORY_KEYWORDS.items():
        score = sum(len(kw) for kw in keywords if kw in text)
        if score > best_score:
            best_score = score
            best_cat = cat
    return best_cat


def get_child_analytics(db: Session, child_id: UUID, days: int = 30) -> dict:
    bounded_days = max(1, min(days, 365))
    today = date.today()
    start_date = today - timedelta(days=bounded_days - 1)

    threshold = get_or_create_reward_settings(db, child_id).streak_threshold

    # 1. Fetch daily tasks in range
    tasks = list(
        db.scalars(
            select(DailyTask).where(
                DailyTask.child_id == child_id,
                DailyTask.task_date >= start_date,
                DailyTask.task_date <= today,
                DailyTask.approved.is_(True),
                DailyTask.status != "deleted",
            )
        )
    )

    tasks_by_date: dict[date, list[DailyTask]] = {}
    for t in tasks:
        tasks_by_date.setdefault(t.task_date, []).append(t)

    # 2. Fetch vacations overlapping date range
    vacations = list(
        db.scalars(
            select(ChildVacation).where(
                ChildVacation.child_id == child_id,
                ChildVacation.start_date <= today,
                ChildVacation.end_date >= start_date,
            )
        )
    )
    vacation_dates: set[date] = set()
    for v in vacations:
        curr = max(v.start_date, start_date)
        v_end = min(v.end_date, today)
        while curr <= v_end:
            vacation_dates.add(curr)
            curr += timedelta(days=1)

    # 3. Fetch freeze usages in range
    freeze_usages = list(
        db.scalars(
            select(ChildStreakFreezeUsage).where(
                ChildStreakFreezeUsage.child_id == child_id,
                ChildStreakFreezeUsage.used_date >= start_date,
                ChildStreakFreezeUsage.used_date <= today,
            )
        )
    )
    frozen_dates: set[date] = {u.used_date for u in freeze_usages}

    # 4. Generate heatmap
    heatmap: list[dict] = []
    for i in range(bounded_days):
        d = start_date + timedelta(days=i)
        day_tasks = tasks_by_date.get(d, [])
        total = len(day_tasks)
        completed = sum(1 for t in day_tasks if t.status == "completed")
        rate = int((completed / total) * 100) if total > 0 else 0

        if d in vacation_dates:
            status = "vacation"
        elif d in frozen_dates:
            status = "frozen"
        elif total == 0:
            status = "rest"
        elif rate == 100:
            status = "perfect"
        elif completed > 0 if threshold <= 0 else rate >= threshold:
            status = "qualified"
        else:
            status = "missed"

        heatmap.append({
            "date": d.isoformat(),
            "total_tasks": total,
            "completed_tasks": completed,
            "completion_rate": rate,
            "status": status,
        })

    # 5. Category breakdown
    category_counts: dict[str, dict[str, int]] = {c: {"total": 0, "completed": 0} for c in CATEGORIES}
    for day_tasks in tasks_by_date.values():
        for t in day_tasks:
            cat = classify_task_category(t.title, t.description)
            category_counts[cat]["total"] += 1
            if t.status == "completed":
                category_counts[cat]["completed"] += 1

    categories: list[dict] = []
    for c in CATEGORIES:
        tot = category_counts[c]["total"]
        comp = category_counts[c]["completed"]
        c_rate = int((comp / tot) * 100) if tot > 0 else 0
        categories.append({
            "category": c,
            "total_tasks": tot,
            "completed_tasks": comp,
            "completion_rate": c_rate,
        })

    # 6. Self-discipline insights
    task_stats: dict[str, dict[str, int]] = {}
    for day_tasks in tasks_by_date.values():
        for t in day_tasks:
            stat = task_stats.setdefault(t.title, {"total": 0, "completed": 0})
            stat["total"] += 1
            if t.status == "completed":
                stat["completed"] += 1

    best_habit: dict | None = None
    attention_needed: dict | None = None

    if task_stats:
        # best habit: highest completion rate, then most completed count
        completed_habits = [
            (title, s["completed"], s["total"], int((s["completed"] / s["total"]) * 100))
            for title, s in task_stats.items()
            if s["completed"] > 0
        ]
        if completed_habits:
            completed_habits.sort(key=lambda x: (x[3], x[1]), reverse=True)
            best_habit = {
                "title": completed_habits[0][0],
                "completed_count": completed_habits[0][1],
                "total_count": completed_habits[0][2],
                "completion_rate": completed_habits[0][3],
            }

        # attention needed: tasks with lowest completion rate or missed tasks
        missed_habits = [
            (title, s["completed"], s["total"], int((s["completed"] / s["total"]) * 100))
            for title, s in task_stats.items()
            if s["completed"] < s["total"]
        ]
        if missed_habits:
            missed_habits.sort(key=lambda x: (x[3], -(x[2] - x[1])))
            attention_needed = {
                "title": missed_habits[0][0],
                "completed_count": missed_habits[0][1],
                "total_count": missed_habits[0][2],
                "completion_rate": missed_habits[0][3],
            }

    # 7. Streak & Stars
    streak = db.scalar(select(Streak).where(Streak.child_id == child_id))
    current_streak = streak.current_days if streak else 0
    longest_streak = streak.longest_days if streak else 0

    range_start_dt = datetime.combine(start_date, time.min, tzinfo=UTC)

    earned = db.scalar(
        select(func.coalesce(func.sum(RewardLedger.stars_delta), Decimal("0.00")))
        .where(
            RewardLedger.child_id == child_id,
            RewardLedger.stars_delta > 0,
            RewardLedger.created_at >= range_start_dt,
        )
    ) or Decimal("0.00")

    spent = db.scalar(
        select(func.coalesce(func.sum(func.abs(RewardLedger.stars_delta)), Decimal("0.00")))
        .where(
            RewardLedger.child_id == child_id,
            RewardLedger.stars_delta < 0,
            RewardLedger.created_at >= range_start_dt,
        )
    ) or Decimal("0.00")

    current_balance = db.scalar(
        select(func.coalesce(func.sum(RewardLedger.stars_delta), Decimal("0.00")))
        .where(RewardLedger.child_id == child_id)
    ) or Decimal("0.00")

    return {
        "child_id": child_id,
        "days": bounded_days,
        "start_date": start_date.isoformat(),
        "end_date": today.isoformat(),
        "heatmap": heatmap,
        "categories": categories,
        "insights": {
            "best_habit": best_habit,
            "attention_needed": attention_needed,
            "streak": {
                "current_streak_days": current_streak,
                "longest_streak_days": longest_streak,
                "freeze_usages_count": len(frozen_dates),
                "vacation_days_count": len(vacation_dates),
            },
            "stars": {
                "stars_earned": Decimal(earned),
                "stars_spent": Decimal(spent),
                "current_stars": Decimal(current_balance),
            },
        },
    }
