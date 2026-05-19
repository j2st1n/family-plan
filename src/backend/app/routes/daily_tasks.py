from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_child, get_current_parent
from app.db.session import get_db
from app.models.child import Child
from app.models.child_device import ChildDevice
from app.models.daily_task import DailyTask
from app.models.parent import Parent
from app.schemas.child import ChildBrief
from app.schemas.daily_task import (
    ChildScheduleRequest,
    ChildTaskCreate,
    ChildTodayResponse,
    DailyTaskItem,
    ManualDailyTasksCreate,
    ManualTaskItem,
    ParentDailyTasksResponse,
    RewardSummary,
    TaskCompleteRequest,
    TaskCompleteResponse,
)
from app.services.daily_tasks import (
    complete_task,
    create_child_task,
    create_manual_daily_tasks,
    delete_daily_task,
    get_reward_summary,
    get_todays_tasks,
    list_tasks_for_date,
    schedule_child_task,
    update_child_task,
    delete_child_task,
    schedule_child_task,
    update_child_task,
    update_daily_task,
)
from app.services.plans import get_plan_for_parent

router = APIRouter(prefix="/child", tags=["child tasks"])
parent_router = APIRouter(prefix="/plans", tags=["parent daily tasks"])


def _daily_to_item(task: DailyTask) -> DailyTaskItem:
    return DailyTaskItem.model_validate(task, from_attributes=True)


@router.get("/today", response_model=ChildTodayResponse)
def get_child_today(
    child_device: tuple[Child, ChildDevice] = Depends(get_current_child),
    db: Session = Depends(get_db),
) -> ChildTodayResponse:
    child, _ = child_device
    tasks = get_todays_tasks(db, child.id)
    summary = get_reward_summary(db, child.id)
    return ChildTodayResponse(
        date=date.today(),
        child=ChildBrief.model_validate(child, from_attributes=True),
        tasks=[_daily_to_item(t) for t in tasks],
        rewards=RewardSummary(
            stars_total=summary["stars_total"],
            current_streak_days=summary["current_streak_days"],
        ),
    )


@router.patch("/tasks/{task_id}/complete", response_model=TaskCompleteResponse)
def complete_child_task(
    task_id: UUID,
    payload: TaskCompleteRequest,
    child_device: tuple[Child, ChildDevice] = Depends(get_current_child),
    db: Session = Depends(get_db),
) -> TaskCompleteResponse:
    child, _ = child_device
    task = complete_task(db, task_id, child.id, payload.feedback)
    summary = get_reward_summary(db, child.id)
    return TaskCompleteResponse(
        task_id=task.id,
        status=task.status,
        stars_awarded=task.reward_stars,
        current_streak_days=summary["current_streak_days"],
    )


@parent_router.post("/{plan_id}/daily-tasks", status_code=201)
def add_manual_daily_tasks(
    plan_id: UUID,
    payload: ManualDailyTasksCreate,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
):
    plan = get_plan_for_parent(db, plan_id, parent.id)
    dailies = create_manual_daily_tasks(db, plan, payload.task_date, payload.tasks)
    return [_daily_to_item(t) for t in dailies]


@parent_router.get("/{plan_id}/daily-tasks", response_model=ParentDailyTasksResponse)
def get_daily_tasks_for_date(
    plan_id: UUID,
    task_date: date,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
):
    plan = get_plan_for_parent(db, plan_id, parent.id)
    tasks = list_tasks_for_date(db, plan.child_id, task_date)
    summary = get_reward_summary(db, plan.child_id)
    return ParentDailyTasksResponse(
        task_date=task_date,
        tasks=[_daily_to_item(t) for t in tasks],
        rewards=RewardSummary(
            stars_total=summary["stars_total"],
            current_streak_days=summary["current_streak_days"],
        ),
    )


@parent_router.patch("/{plan_id}/daily-tasks/{task_id}")
def edit_daily_task(
    plan_id: UUID,
    task_id: UUID,
    payload: ManualTaskItem,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
):
    plan = get_plan_for_parent(db, plan_id, parent.id)
    task = update_daily_task(db, task_id, plan, payload)
    return _daily_to_item(task)


@parent_router.delete("/{plan_id}/daily-tasks/{task_id}", status_code=204)
def remove_daily_task(
    plan_id: UUID,
    task_id: UUID,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
):
    plan = get_plan_for_parent(db, plan_id, parent.id)
    delete_daily_task(db, task_id, plan)


@router.post("/tasks", status_code=201)
def create_child_own_task(
    payload: ChildTaskCreate,
    child_device: tuple[Child, ChildDevice] = Depends(get_current_child),
    db: Session = Depends(get_db),
):
    child, _ = child_device
    plan = _get_child_plan(db, child.id)
    task = create_child_task(db, child.id, plan.id, payload)
    return _daily_to_item(task)


@router.patch("/tasks/{task_id}/schedule")
def set_child_task_schedule(
    task_id: UUID,
    payload: ChildScheduleRequest,
    child_device: tuple[Child, ChildDevice] = Depends(get_current_child),
    db: Session = Depends(get_db),
):
    child, _ = child_device
    task = schedule_child_task(db, task_id, child.id, payload)
    return _daily_to_item(task)


@router.patch("/tasks/{task_id}")
def edit_child_task(
    task_id: UUID,
    payload: ChildTaskCreate,
    child_device: tuple[Child, ChildDevice] = Depends(get_current_child),
    db: Session = Depends(get_db),
):
    child, _ = child_device
    task = update_child_task(db, task_id, child.id, payload)
    return _daily_to_item(task)


@router.delete("/tasks/{task_id}", status_code=204)
def remove_child_task(
    task_id: UUID,
    child_device: tuple[Child, ChildDevice] = Depends(get_current_child),
    db: Session = Depends(get_db),
):
    child, _ = child_device
    delete_child_task(db, task_id, child.id)


def _get_child_plan(db: Session, child_id: UUID):
    from app.models.plan import Plan
    plan = db.scalar(select(Plan).where(Plan.child_id == child_id, Plan.status == "active").order_by(Plan.created_at.desc()).limit(1))
    if plan is None:
        from app.core.errors import api_error
        raise api_error("not_found", "No active plan for this child", 404)
    return plan
