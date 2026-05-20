from datetime import date as dt_date
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, joinedload

from app.core.errors import api_error
from app.models.child import Child
from app.models.daily_task import DailyTask
from app.models.plan import Plan
from app.models.task_template import TaskTemplate
from app.schemas.plan import PlanCreate, TaskTemplateCreate
from app.services.daily_tasks import get_reward_summary


def _verify_child_ownership(db: Session, child_id: UUID, parent_id: UUID) -> Child:
    child = db.get(Child, child_id)
    if child is None or child.parent_id != parent_id:
        raise api_error("not_found", "Child not found", 404)
    return child


def create_plan(db: Session, parent_id: UUID, data: PlanCreate) -> Plan:
    _verify_child_ownership(db, data.child_id, parent_id)
    plan = Plan(
        parent_id=parent_id,
        child_id=data.child_id,
        title=data.title,
        description=data.description,
        start_date=data.start_date,
        end_date=data.end_date,
    )
    db.add(plan)
    db.flush()

    for task_data in data.tasks:
        template = TaskTemplate(
            plan_id=plan.id,
            title=task_data.title,
            description=task_data.description,
            expected_minutes=task_data.expected_minutes,
            weekdays=task_data.weekdays,
            sort_order=task_data.sort_order,
            reward_stars=task_data.reward_stars,
        )
        db.add(template)

    db.commit()
    plan = db.scalar(
        select(Plan).options(joinedload(Plan.task_templates)).where(Plan.id == plan.id)
    )
    assert plan is not None
    return plan


def list_plans_for_parent(
    db: Session,
    parent_id: UUID,
    child_id: UUID | None = None,
    status: str | None = None,
) -> list[Plan]:
    stmt = select(Plan).options(joinedload(Plan.task_templates)).where(Plan.parent_id == parent_id)
    if child_id is not None:
        stmt = stmt.where(Plan.child_id == child_id)
    if status is not None:
        stmt = stmt.where(Plan.status == status)
    stmt = stmt.order_by(Plan.created_at.desc())
    return list(db.scalars(stmt).unique())


def get_plan_for_parent(db: Session, plan_id: UUID, parent_id: UUID) -> Plan:
    plan = db.scalar(
        select(Plan)
        .options(joinedload(Plan.task_templates))
        .where(Plan.id == plan_id, Plan.parent_id == parent_id)
    )
    if plan is None:
        raise api_error("not_found", "Plan not found", 404)
    return plan


def add_task_template(db: Session, plan: Plan, data: TaskTemplateCreate) -> TaskTemplate:
    template = TaskTemplate(
        plan_id=plan.id,
        title=data.title,
        description=data.description,
        expected_minutes=data.expected_minutes,
        weekdays=data.weekdays,
        sort_order=data.sort_order,
        reward_stars=data.reward_stars,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


def get_child_dashboard(db: Session, child_id: UUID, parent_id: UUID) -> dict:
    _verify_child_ownership(db, child_id, parent_id)
    from datetime import date
    today = date.today()
    tasks_today = list(
        db.scalars(
            select(DailyTask).where(DailyTask.child_id == child_id, DailyTask.task_date == today)
        )
    )
    completed = sum(1 for t in tasks_today if t.status == "completed")
    summary = get_reward_summary(db, child_id)
    return {
        "today": {"total_tasks": len(tasks_today), "completed_tasks": completed},
        "rewards": summary,
    }


def update_task_template(db: Session, plan: Plan, template_id: UUID, data: TaskTemplateCreate) -> TaskTemplate:
    template = db.scalar(select(TaskTemplate).where(TaskTemplate.id == template_id, TaskTemplate.plan_id == plan.id))
    if template is None:
        raise api_error("not_found", "Task template not found", 404)
    template.title = data.title
    template.description = data.description
    template.expected_minutes = data.expected_minutes
    template.weekdays = data.weekdays
    template.reward_stars = data.reward_stars
    db.commit()
    db.refresh(template)
    today = dt_date.today()
    db.execute(
        delete(DailyTask).where(
            DailyTask.task_template_id == template.id,
            DailyTask.task_date > today,
            DailyTask.status == "pending",
        )
    )
    db.commit()
    return template


def delete_task_template(db: Session, plan: Plan, template_id: UUID) -> None:
    template = db.scalar(select(TaskTemplate).where(TaskTemplate.id == template_id, TaskTemplate.plan_id == plan.id))
    if template is None:
        raise api_error("not_found", "Task template not found", 404)
    template.status = "inactive"
    today = dt_date.today()
    db.execute(
        delete(DailyTask).where(
            DailyTask.task_template_id == template.id,
            DailyTask.task_date > today,
            DailyTask.status == "pending",
        )
    )
    db.commit()
