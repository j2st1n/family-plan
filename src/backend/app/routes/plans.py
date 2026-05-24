from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_parent
from app.db.session import get_db
from app.models.parent import Parent
from app.schemas.plan import PlanCreate, PlanResponse, TaskTemplateCreate, TaskTemplateResponse
from app.services.event_hub import event_hub
from app.services.plans import add_task_template, create_plan, delete_task_template, get_plan_for_parent, list_plans_for_parent, update_task_template

router = APIRouter(prefix="/plans", tags=["plans"])


@router.post("", response_model=PlanResponse, status_code=201)
def create_parent_plan(
    payload: PlanCreate,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
) -> PlanResponse:
    plan = create_plan(db, parent.id, payload)
    event_hub.publish(parent.id, "tasks", "plan_created", plan.child_id)
    return PlanResponse.model_validate(plan, from_attributes=True)


@router.get("", response_model=list[PlanResponse])
def list_parent_plans(
    child_id: UUID | None = Query(default=None),
    status: str | None = Query(default=None),
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
) -> list[PlanResponse]:
    plans = list_plans_for_parent(db, parent.id, child_id=child_id, status=status)
    return [PlanResponse.model_validate(p, from_attributes=True) for p in plans]


@router.get("/{plan_id}", response_model=PlanResponse)
def get_parent_plan(
    plan_id: UUID,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
) -> PlanResponse:
    plan = get_plan_for_parent(db, plan_id, parent.id)
    return PlanResponse.model_validate(plan, from_attributes=True)


@router.post("/{plan_id}/task-templates", response_model=TaskTemplateResponse, status_code=201)
def add_plan_task_template(
    plan_id: UUID,
    payload: TaskTemplateCreate,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
) -> TaskTemplateResponse:
    plan = get_plan_for_parent(db, plan_id, parent.id)
    template = add_task_template(db, plan, payload)
    event_hub.publish(parent.id, "tasks", "routine_created", plan.child_id)
    return TaskTemplateResponse.model_validate(template, from_attributes=True)


@router.patch("/{plan_id}/task-templates/{template_id}", response_model=TaskTemplateResponse)
def edit_task_template(
    plan_id: UUID,
    template_id: UUID,
    payload: TaskTemplateCreate,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
) -> TaskTemplateResponse:
    plan = get_plan_for_parent(db, plan_id, parent.id)
    template = update_task_template(db, plan, template_id, payload)
    event_hub.publish(parent.id, "tasks", "routine_updated", plan.child_id)
    return TaskTemplateResponse.model_validate(template, from_attributes=True)


@router.delete("/{plan_id}/task-templates/{template_id}", status_code=204)
def remove_task_template(
    plan_id: UUID,
    template_id: UUID,
    parent: Parent = Depends(get_current_parent),
    db: Session = Depends(get_db),
):
    plan = get_plan_for_parent(db, plan_id, parent.id)
    delete_task_template(db, plan, template_id)
    event_hub.publish(parent.id, "tasks", "routine_deleted", plan.child_id)
