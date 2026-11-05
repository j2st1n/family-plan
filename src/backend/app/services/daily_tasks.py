from datetime import UTC, date, datetime, time
from decimal import Decimal
from uuid import UUID

from sqlalchemy import CursorResult, Date, cast, func, select, update
from sqlalchemy.orm import Session

from app.core.errors import api_error
from app.models.child import Child
from app.models.child_reward_settings import ChildRewardSettings
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


def _has_missed_task_day(
    db: Session,
    child_id: UUID,
    after_date: date,
    before_date: date,
    threshold: int,
) -> bool:
    tasks = db.execute(
        select(DailyTask.task_date, DailyTask.status).where(
            DailyTask.child_id == child_id,
            DailyTask.task_date > after_date,
            DailyTask.task_date < before_date,
            DailyTask.approved.is_(True),
            DailyTask.status != "deleted",
            # Legacy history views could create tasks after their assigned day.
            # Such rows must not retroactively turn a rest day into a missed day.
            # Production uses UTC calendar dates; do not use the DB session zone.
            cast(func.timezone("UTC", DailyTask.created_at), Date) <= DailyTask.task_date,
        )
    ).all()

    tasks_by_date: dict[date, list[str]] = {}
    for task_date, status in tasks:
        tasks_by_date.setdefault(task_date, []).append(status)

    for statuses in tasks_by_date.values():
        completed = sum(1 for status in statuses if status == "completed")
        if threshold <= 0:
            if completed == 0:
                return True
        elif int((completed / len(statuses)) * 100) < threshold:
            return True
    return False


def _has_new_historical_deletion(db: Session, streak: Streak) -> bool:
    return db.scalar(select(DailyTask.id).where(
        DailyTask.child_id == streak.child_id,
        DailyTask.task_date < date.today(),
        DailyTask.status == "deleted",
        DailyTask.approved.is_(True),
        cast(func.timezone("UTC", DailyTask.created_at), Date) <= DailyTask.task_date,
        DailyTask.updated_at > streak.updated_at,
    ).limit(1)) is not None


def generate_todays_tasks(db: Session, child_id: UUID) -> list[DailyTask]:
    return _generate_tasks_for_date(db, child_id, date.today())


def get_todays_tasks(db: Session, child_id: UUID) -> list[DailyTask]:
    return generate_todays_tasks(db, child_id)


def complete_task(db: Session, task_id: UUID, child_id: UUID, feedback: str | None) -> DailyTask:
    task = db.scalar(
        select(DailyTask).where(
            DailyTask.id == task_id, DailyTask.child_id == child_id, DailyTask.status != "deleted"
        )
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
    if _has_new_historical_deletion(db, streak):
        streak = _recalculate_streak_from_tasks(db, child_id)
    today = date.today()

    # Always track that a task was completed today (for get_reward_summary)
    previous_date = streak.streak_updated_date or streak.last_completed_date
    streak.last_completed_date = today

    threshold = get_or_create_reward_settings(db, child_id).streak_threshold

    # Only parent-approved tasks count toward the daily completion rate.
    if streak.streak_updated_date != today:
        tasks = list(db.scalars(
            select(DailyTask).where(
                DailyTask.child_id == child_id,
                DailyTask.task_date == today,
                DailyTask.approved.is_(True),
                DailyTask.status != "deleted",
            )
        ))
        if tasks:
            completed = sum(1 for t in tasks if t.status == "completed")
            rate = int((completed / len(tasks)) * 100)
            qualifies = completed > 0 if threshold <= 0 else rate >= threshold
            if qualifies:
                if previous_date and not _has_missed_task_day(
                    db, child_id, previous_date, today, threshold
                ):
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
    # streak. Fall back to last_completed_date for legacy rows. Dates without
    # approved tasks are rest days and do not break the streak.
    effective_date = streak.streak_updated_date or streak.last_completed_date
    today = date.today()
    threshold = get_or_create_reward_settings(db, child_id).streak_threshold
    if _has_new_historical_deletion(db, streak):
        streak = _recalculate_streak_from_tasks(db, child_id)
        db.commit()
    elif effective_date and _has_missed_task_day(db, child_id, effective_date, today, threshold):
        streak.current_days = 0
        db.commit()
    return {"stars_total": stars_total, "current_streak_days": streak.current_days}


def _recalculate_streak_from_tasks(db: Session, child_id: UUID) -> Streak:
    """Rebuild corrected history atomically with its edit, without changing rewards."""
    streak = db.scalar(select(Streak).where(Streak.child_id == child_id).with_for_update())
    if streak is None:
        streak = Streak(child_id=child_id, current_days=0, longest_days=0)
        db.add(streak)
        db.flush()
    threshold = db.scalar(select(ChildRewardSettings.streak_threshold).where(
        ChildRewardSettings.child_id == child_id,
    ))
    if threshold is None:
        child = db.get(Child, child_id)
        threshold = (child.streak_threshold or 80) if child else 80
    today = date.today()
    rows = db.execute(select(DailyTask.task_date, DailyTask.status).where(
        DailyTask.child_id == child_id,
        DailyTask.task_date <= today,
        DailyTask.approved.is_(True),
        DailyTask.status != "deleted",
        cast(func.timezone("UTC", DailyTask.created_at), Date) <= DailyTask.task_date,
    )).all()
    days: dict[date, list[str]] = {}
    for task_date, status in rows:
        days.setdefault(task_date, []).append(status)
    current = longest = 0
    last_qualified = None
    for task_date, statuses in sorted(days.items()):
        completed = sum(status == "completed" for status in statuses)
        qualifies = completed > 0 if threshold <= 0 else completed * 100 >= len(statuses) * threshold
        if qualifies:
            current += 1
            longest = max(longest, current)
            last_qualified = task_date
        elif task_date < today:
            current = 0
    streak.current_days = current
    streak.longest_days = max(streak.longest_days, longest)
    streak.streak_updated_date = last_qualified
    # Acknowledge corrections even when their resulting count is unchanged.
    streak.updated_at = datetime.now(UTC)
    return streak


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
    return _generate_tasks_for_date(db, child_id, task_date)


def update_daily_task(db: Session, task_id: UUID, plan: Plan, data: ManualTaskItem) -> DailyTask:
    task = db.scalar(
        select(DailyTask).where(
            DailyTask.id == task_id, DailyTask.plan_id == plan.id, DailyTask.status != "deleted"
        ).with_for_update()
    )
    if task is None:
        raise api_error("not_found", "Task not found", 404)
    if task.status == "completed":
        raise api_error("conflict", "Cannot edit completed task", 409)
    was_approved = task.approved
    if data.approved is not None:
        task.approved = data.approved
    if task.created_by == "child" and not task.approved:
        task.approved = True
    task.title = data.title
    if "description" in data.model_fields_set:
        task.description = data.description
    if "expected_minutes" in data.model_fields_set:
        task.expected_minutes = data.expected_minutes
    if "reward_stars" in data.model_fields_set:
        task.reward_stars = data.reward_stars
    if "scheduled_start" in data.model_fields_set:
        task.scheduled_start = _parse_time(data.scheduled_start)
    if "scheduled_end" in data.model_fields_set:
        task.scheduled_end = _parse_time(data.scheduled_end)
    if task.approved != was_approved and task.task_date <= date.today() and task.created_at.astimezone(UTC).date() <= task.task_date:
        db.flush()
        _recalculate_streak_from_tasks(db, task.child_id)
    db.commit()
    db.refresh(task)
    return task


def delete_daily_task(db: Session, task_id: UUID, plan: Plan) -> None:
    task = db.scalar(
        select(DailyTask).where(
            DailyTask.id == task_id, DailyTask.plan_id == plan.id, DailyTask.status != "deleted"
        ).with_for_update()
    )
    if task is None:
        raise api_error("not_found", "Task not found", 404)
    if task.status == "completed":
        raise api_error("conflict", "Cannot delete completed task", 409)
    task.status = "deleted"
    if task.approved and task.task_date <= date.today() and task.created_at.astimezone(UTC).date() <= task.task_date:
        db.flush()
        _recalculate_streak_from_tasks(db, task.child_id)
    db.commit()


def _generate_tasks_for_date(db: Session, child_id: UUID, task_date: date) -> list[DailyTask]:
    if task_date < date.today():
        return _list_existing_tasks_for_date(db, child_id, task_date)

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

    return _list_existing_tasks_for_date(db, child_id, task_date)


def _list_existing_tasks_for_date(db: Session, child_id: UUID, task_date: date) -> list[DailyTask]:
    return list(
        db.scalars(
            select(DailyTask)
            .where(
                DailyTask.child_id == child_id,
                DailyTask.task_date == task_date,
                DailyTask.status != "deleted",
            )
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
        select(DailyTask).where(
            DailyTask.id == task_id, DailyTask.child_id == child_id, DailyTask.status != "deleted"
        ).with_for_update()
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
        select(DailyTask).where(
            DailyTask.id == task_id, DailyTask.child_id == child_id, DailyTask.status != "deleted"
        ).with_for_update()
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
        select(DailyTask).where(
            DailyTask.id == task_id, DailyTask.child_id == child_id, DailyTask.status != "deleted"
        ).with_for_update()
    )
    if task is None:
        raise api_error("not_found", "Task not found", 404)
    if task.created_by != "child" or task.approved:
        raise api_error("conflict", "Cannot delete this task", 409)
    task.status = "deleted"
    db.commit()


def _parse_time(value: str | None) -> time | None:
    if not value:
        return None
    return time.fromisoformat(value)
