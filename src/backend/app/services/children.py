from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.errors import api_error
from app.models.child import Child
from app.models.child_access_code import ChildAccessCode
from app.models.child_device import ChildDevice
from app.models.daily_task import DailyTask
from app.models.plan import Plan
from app.models.redemption import Redemption
from app.models.reward_ledger import RewardLedger
from app.models.shop_item import ShopItem
from app.models.streak import Streak
from app.models.task_template import TaskTemplate
from app.schemas.child import ChildCreate, ChildUpdate


def list_children(db: Session, parent_id: UUID) -> list[Child]:
    return list(db.scalars(select(Child).where(Child.parent_id == parent_id).order_by(Child.created_at.desc())))


def create_child(db: Session, parent_id: UUID, data: ChildCreate) -> Child:
    child = Child(parent_id=parent_id, name=data.name, grade_label=data.grade_label)
    db.add(child)
    db.commit()
    db.refresh(child)
    return child


def get_child_for_parent(db: Session, child_id: UUID, parent_id: UUID) -> Child:
    child = db.get(Child, child_id)
    if child is None or child.parent_id != parent_id:
        raise api_error("not_found", "Child not found", 404)
    return child


def update_child(db: Session, child_id: UUID, parent_id: UUID, data: ChildUpdate) -> Child:
    child = get_child_for_parent(db, child_id, parent_id)
    if data.name is not None:
        child.name = data.name
    if data.grade_label is not None:
        child.grade_label = data.grade_label
    if data.streak_threshold is not None:
        child.streak_threshold = data.streak_threshold
    db.commit()
    db.refresh(child)
    return child


def delete_child(db: Session, child_id: UUID, parent_id: UUID) -> None:
    get_child_for_parent(db, child_id, parent_id)
    db.execute(delete(Redemption).where(Redemption.child_id == child_id))
    db.execute(delete(ShopItem).where(ShopItem.child_id == child_id))
    db.execute(delete(RewardLedger).where(RewardLedger.child_id == child_id))
    db.execute(delete(Streak).where(Streak.child_id == child_id))
    db.execute(delete(DailyTask).where(DailyTask.child_id == child_id))
    db.execute(delete(ChildAccessCode).where(ChildAccessCode.child_id == child_id))
    db.execute(delete(ChildDevice).where(ChildDevice.child_id == child_id))
    db.execute(delete(TaskTemplate).where(TaskTemplate.plan_id.in_(select(Plan.id).where(Plan.child_id == child_id))))
    db.execute(delete(Plan).where(Plan.child_id == child_id))
    db.execute(delete(Child).where(Child.id == child_id))
    db.commit()
