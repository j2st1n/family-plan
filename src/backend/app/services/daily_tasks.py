from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import CursorResult, func, select, update
from sqlalchemy.orm import Session

from app.core.errors import api_error
from app.models.child import Child
from app.models.daily_task import DailyTask
from app.models.plan import Plan
from app.models.reward_ledger import RewardLedger
from app.models.streak import Streak
from app.models.task_template import TaskTemplate
from app.schemas.daily_task import ChildScheduleRequest, ChildTaskCreate, ManualTaskItem
from app.services.reward_settings import get_or_create_reward_settings


def _get_or_create_streak(db: Session, child_id: UUID) -> Streak:
    streak = db.scalar(select(Streak).where(Streak.child_id == child_id))
    if streak is None:
        streak = Streak(child_id=child_id)
        db.add(streak)
        db.commit()
        db.refresh(streak)
    return streak


def _get_stars_total(db: Session, child_id: UUID) -> Decimal:
    result = db.scalar(
        select(func.coalesce(func.sum(RewardLedger.stars_delta), Decimal("0.00"))).where(
            RewardLedger.child_id == child_id
        )
    )
    return Decimal(result or "0.00")


def generate_todays_tasks(db: Session, child_id: UUID) -> list[DailyTask]:
    return _generate_tasks_for_date(db, child_id, date.today())


def get_todays_tasks(db: Session, child_id: UUID) -> list[DailyTask]:
    today = date.today()
    dailies = list(
        db.scalars(
            select(DailyTask)
            .where(DailyTask.child_id == child_id, DailyTask.task_date == today)
            .order_by(DailyTask.sort_order, DailyTask.created_at)
        )
    )
    if not dailies:
        dailies = generate_todays_tasks(db, child_id)
    return dailies


def complete_task(db: Session, task_id: UUID, child_id: UUID, feedback: str | None) -> DailyTask:
    task = db.scalar(
        select(DailyTask).where(DailyTask.id == task_id, DailyTask.child_id == child_id)
    )
    if task is None:
        raise api_error("not_found", "Task not found", 404)
    if task.status != "pending":
        raise api_error("conflict", "Task already completed", 409)
    if task.created_by == "child" and not task.approved:
        raise api_error("conflict", "Task not yet approved by parent", 409)

    result = db.execute(
        update(DailyTask)
        .where(DailyTask.id == task_id, DailyTask.status == "pending")
        .values(status="completed", completed_at=datetime.now(UTC), child_feedback=feedback)
    )
    cursor_result: CursorResult = result  # type: ignore[assignment]
    if cursor_result.rowcount != 1:
        db.rollback()
        raise api_error("conflict", "Task already completed", 409)
    db.refresh(task)

    stars = task.reward_stars
    if stars > 0:
        db.add(
            RewardLedger(
                child_id=child_id,
                source_type="daily_task",
                source_id=task.id,
                stars_delta=stars,
                reason=task.title,
            )
        )
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise api_error("conflict", "Task already completed", 409)

    streak = _get_or_create_streak(db, child_id)
    today = date.today()

    # Always track that a task was completed today (for get_reward_summary)
    streak.last_completed_date = today

    threshold = get_or_create_reward_settings(db, child_id).streak_threshold

    if threshold <= 0:
        # threshold=0: every completion counts, maintain existing intent
        yesterday = today - timedelta(days=1)
        if streak.streak_updated_date == today:
            pass
        elif streak.streak_updated_date == yesterday:
            streak.current_days += 1
        else:
            streak.current_days = 1
        streak.streak_updated_date = today
    else:
        # threshold > 0: only increment when rate meets threshold, at most once/day
        if streak.streak_updated_date != today:
            tasks = list(db.scalars(
                select(DailyTask).where(
                    DailyTask.child_id == child_id,
                    DailyTask.task_date == today,
                )
            ))
            if tasks:
                completed = sum(1 for t in tasks if t.status == "completed")
                rate = int((completed / len(tasks)) * 100)
                if rate >= threshold:
                    yesterday = today - timedelta(days=1)
                    if streak.streak_updated_date == yesterday:
                        streak.current_days += 1
                    else:
                        streak.current_days = 1
                    streak.streak_updated_date = today

    if streak.current_days > streak.longest_days:
        streak.longest_days = streak.current_days

    db.commit()
    db.refresh(task)
    return task


def get_reward_summary(db: Session, child_id: UUID) -> dict:
    stars_total = _get_stars_total(db, child_id)
    streak = _get_or_create_streak(db, child_id)

    # Use streak_updated_date as the authoritative date that counted toward the
    # streak.  Fall back to last_completed_date for legacy rows where
    # streak_updated_date is null.  A streak stays alive across a one-day gap
    # (yesterday → today); it only resets when the effective date is older than
    # yesterday, i.e. at least two calendar days without a qualifying day.
    effective_date = streak.streak_updated_date or streak.last_completed_date
    yesterday = date.today() - timedelta(days=1)
    if effective_date and effective_date < yesterday:
        streak.current_days = 0
        db.commit()
    return {"stars_total": stars_total, "current_streak_days": streak.current_days}


def create_manual_daily_tasks(
    db: Session, plan: Plan, task_date: date, task_payloads: list[ManualTaskItem]
) -> list[DailyTask]:
    dailies = []
    for i, item in enumerate(task_payloads):
        dt = DailyTask(
            child_id=plan.child_id,
            plan_id=plan.id,
            task_date=task_date,
            title=item.title,
            description=item.description,
            expected_minutes=item.expected_minutes,
            reward_stars=item.reward_stars,
            sort_order=i,
            scheduled_start=_parse_time(item.scheduled_start),
            scheduled_end=_parse_time(item.scheduled_end),
        )
        db.add(dt)
        dailies.append(dt)
    db.commit()
    return dailies


def list_tasks_for_date(db: Session, child_id: UUID, task_date: date) -> list[DailyTask]:
    dailies = list(
        db.scalars(
            select(DailyTask)
            .where(DailyTask.child_id == child_id, DailyTask.task_date == task_date)
            .order_by(DailyTask.sort_order, DailyTask.created_at)
        )
    )
    dailies = _generate_tasks_for_date(db, child_id, task_date)
    return dailies


def update_daily_task(db: Session, task_id: UUID, plan: Plan, data: ManualTaskItem) -> DailyTask:
    task = db.scalar(
        select(DailyTask).where(DailyTask.id == task_id, DailyTask.plan_id == plan.id)
    )
    if task is None:
        raise api_error("not_found", "Task not found", 404)
    if task.status == "completed":
        raise api_error("conflict", "Cannot edit completed task", 409)
    if data.approved is not None:
        task.approved = data.approved
    if task.created_by == "child" and not task.approved:
        task.approved = True
    task.title = data.title
    task.description = data.description
    task.expected_minutes = data.expected_minutes
    task.reward_stars = data.reward_stars
    task.scheduled_start = _parse_time(data.scheduled_start)
    task.scheduled_end = _parse_time(data.scheduled_end)
    db.commit()
    db.refresh(task)
    return task


def delete_daily_task(db: Session, task_id: UUID, plan: Plan) -> None:
    task = db.scalar(
        select(DailyTask).where(DailyTask.id == task_id, DailyTask.plan_id == plan.id)
    )
    if task is None:
        raise api_error("not_found", "Task not found", 404)
    db.delete(task)
    db.commit()


def _generate_tasks_for_date(db: Session, child_id: UUID, task_date: date) -> list[DailyTask]:
    weekday = task_date.isoweekday()
    existing_ids = set(
        db.scalars(
            select(DailyTask.task_template_id).where(
                DailyTask.child_id == child_id,
                DailyTask.task_date == task_date,
                DailyTask.task_template_id.isnot(None),
            )
        )
    )
    active_templates = db.scalars(
        select(TaskTemplate)
        .join(Plan, TaskTemplate.plan_id == Plan.id)
        .where(
            Plan.child_id == child_id,
            Plan.status == "active",
            Plan.start_date <= task_date,
            (Plan.end_date.is_(None)) | (Plan.end_date >= task_date),
            TaskTemplate.status == "active",
        )
    ).all()

    new_dailies: list[DailyTask] = []
    for tpl in active_templates:
        if tpl.id in existing_ids:
            continue
        if tpl.weekdays and weekday not in tpl.weekdays:
            continue
        daily = DailyTask(
            child_id=child_id,
            plan_id=tpl.plan_id,
            task_template_id=tpl.id,
            task_date=task_date,
            title=tpl.title,
            description=tpl.description,
            expected_minutes=tpl.expected_minutes,
            reward_stars=tpl.reward_stars,
            sort_order=tpl.sort_order,
        )
        db.add(daily)
        new_dailies.append(daily)

    if new_dailies:
        db.commit()

    return list(
        db.scalars(
            select(DailyTask)
            .where(DailyTask.child_id == child_id, DailyTask.task_date == task_date)
            .order_by(DailyTask.status.asc(), DailyTask.scheduled_start.isnot(None).desc(), DailyTask.scheduled_start.asc(), DailyTask.sort_order, DailyTask.created_at)
        )
    )


def create_child_task(db: Session, child_id: UUID, plan_id: UUID, data) -> DailyTask:
    task = DailyTask(
        child_id=child_id,
        plan_id=plan_id,
        task_date=date.today(),
        title=data.title,
        expected_minutes=data.expected_minutes,
        reward_stars=data.reward_stars,
        status="pending",
        created_by="child",
        approved=False,
        schedule_by="child" if data.scheduled_start else None,
        scheduled_start=_parse_time(data.scheduled_start),
        scheduled_end=_parse_time(data.scheduled_end),
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def schedule_child_task(db: Session, task_id: UUID, child_id: UUID, data) -> DailyTask:
    task = db.scalar(
        select(DailyTask).where(DailyTask.id == task_id, DailyTask.child_id == child_id)
    )
    if task is None:
        raise api_error("not_found", "Task not found", 404)
    if task.status == "completed":
        raise api_error("conflict", "Task already completed", 409)
    task.scheduled_start = _parse_time(data.scheduled_start)
    task.scheduled_end = _parse_time(data.scheduled_end)
    task.schedule_by = "child"
    db.commit()
    db.refresh(task)
    return task


def update_child_task(db: Session, task_id: UUID, child_id: UUID, data) -> DailyTask:
    task = db.scalar(
        select(DailyTask).where(DailyTask.id == task_id, DailyTask.child_id == child_id)
    )
    if task is None:
        raise api_error("not_found", "Task not found", 404)
    if task.status == "completed":
        raise api_error("conflict", "Task already completed", 409)
    if task.created_by != "child" or task.approved:
        raise api_error("conflict", "Cannot edit this task", 409)
    task.title = data.title
    task.expected_minutes = data.expected_minutes
    task.reward_stars = data.reward_stars
    task.scheduled_start = _parse_time(data.scheduled_start)
    task.scheduled_end = _parse_time(data.scheduled_end)
    task.schedule_by = "child" if data.scheduled_start else None
    db.commit()
    db.refresh(task)
    return task


def delete_child_task(db: Session, task_id: UUID, child_id: UUID) -> None:
    task = db.scalar(
        select(DailyTask).where(DailyTask.id == task_id, DailyTask.child_id == child_id)
    )
    if task is None:
        raise api_error("not_found", "Task not found", 404)
    if task.created_by != "child" or task.approved:
        raise api_error("conflict", "Cannot delete this task", 409)
    db.delete(task)
    db.commit()


def _parse_time(value: str | None) -> time | None:
    if not value:
        return None
    return time.fromisoformat(value)
