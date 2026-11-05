from datetime import date
from uuid import UUID

from sqlalchemy import and_, delete, select
from sqlalchemy.orm import Session

from app.core.errors import api_error
from app.models.child import Child
from app.models.child_vacation import ChildVacation
from app.schemas.vacation import VacationCreate


def verify_child_ownership(db: Session, child_id: UUID, parent_id: UUID) -> Child:
    child = db.get(Child, child_id)
    if child is None or child.parent_id != parent_id:
        raise api_error("not_found", "Child not found", 404)
    return child


def list_vacations(db: Session, child_id: UUID) -> list[ChildVacation]:
    return list(
        db.scalars(
            select(ChildVacation)
            .where(ChildVacation.child_id == child_id)
            .order_by(ChildVacation.start_date.desc(), ChildVacation.created_at.desc())
        )
    )


def create_vacation(db: Session, child_id: UUID, data: VacationCreate) -> ChildVacation:
    if data.start_date > data.end_date:
        raise api_error("validation_error", "End date must be on or after start date", 422)

    vacation = ChildVacation(
        child_id=child_id,
        start_date=data.start_date,
        end_date=data.end_date,
        reason=data.reason,
    )
    db.add(vacation)
    db.commit()
    db.refresh(vacation)
    return vacation


def delete_vacation(db: Session, child_id: UUID, vacation_id: UUID) -> None:
    vacation = db.scalar(
        select(ChildVacation).where(
            ChildVacation.id == vacation_id,
            ChildVacation.child_id == child_id,
        )
    )
    if vacation is None:
        raise api_error("not_found", "Vacation not found", 404)

    db.delete(vacation)
    db.commit()


def is_child_on_vacation(db: Session, child_id: UUID, check_date: date | None = None) -> bool:
    target_date = check_date or date.today()
    match = db.scalar(
        select(ChildVacation.id).where(
            ChildVacation.child_id == child_id,
            ChildVacation.start_date <= target_date,
            ChildVacation.end_date >= target_date,
        ).limit(1)
    )
    return match is not None
