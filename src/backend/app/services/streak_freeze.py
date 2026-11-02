from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import api_error
from app.models.child import Child
from app.models.child_streak_freeze import ChildStreakFreeze
from app.models.child_streak_freeze_usage import ChildStreakFreezeUsage
from app.models.reward_ledger import RewardLedger

FREEZE_CARD_DEFAULT_STAR_COST = Decimal("5.00")


def get_or_create_streak_freeze(
    db: Session,
    child_id: UUID,
    for_update: bool = False,
) -> ChildStreakFreeze:
    stmt = select(ChildStreakFreeze).where(ChildStreakFreeze.child_id == child_id)
    if for_update:
        stmt = stmt.with_for_update()

    freeze = db.scalar(stmt)
    current_month = date.today().strftime("%Y-%m")

    if freeze is None:
        freeze = ChildStreakFreeze(
            child_id=child_id,
            available_count=0,
            last_granted_month=current_month,
        )
        db.add(freeze)
        try:
            db.commit()
            db.refresh(freeze)
        except Exception:
            db.rollback()
            stmt2 = select(ChildStreakFreeze).where(ChildStreakFreeze.child_id == child_id)
            if for_update:
                stmt2 = stmt2.with_for_update()
            freeze = db.scalar(stmt2)
            if freeze is None:
                raise
        return freeze

    if freeze.last_granted_month != current_month:
        freeze.available_count += 1
        freeze.last_granted_month = current_month
        db.commit()
        db.refresh(freeze)

    return freeze


def purchase_streak_freeze(
    db: Session,
    child_id: UUID,
    star_cost: Decimal = FREEZE_CARD_DEFAULT_STAR_COST,
) -> ChildStreakFreeze:
    child = db.scalar(select(Child).where(Child.id == child_id).with_for_update())
    if child is None:
        raise api_error("not_found", "Child not found", 404)

    freeze = get_or_create_streak_freeze(db, child_id, for_update=True)

    total_stars = db.scalar(
        select(func.coalesce(func.sum(RewardLedger.stars_delta), Decimal("0.00"))).where(
            RewardLedger.child_id == child_id
        )
    )
    current_balance = Decimal(total_stars or "0.00")
    if current_balance < star_cost:
        raise api_error("conflict", "Not enough stars", 409)

    db.add(
        RewardLedger(
            child_id=child_id,
            source_type="shop_redeem",
            source_id=freeze.id,
            stars_delta=-star_cost,
            reason="购买连击保护卡",
        )
    )
    freeze.available_count += 1
    db.commit()
    db.refresh(freeze)
    return freeze


def get_freeze_usages(db: Session, child_id: UUID) -> list[ChildStreakFreezeUsage]:
    return list(
        db.scalars(
            select(ChildStreakFreezeUsage)
            .where(ChildStreakFreezeUsage.child_id == child_id)
            .order_by(ChildStreakFreezeUsage.used_date.desc())
        )
    )


def is_date_frozen(db: Session, child_id: UUID, missed_date: date) -> bool:
    usage = db.scalar(
        select(ChildStreakFreezeUsage.id).where(
            ChildStreakFreezeUsage.child_id == child_id,
            ChildStreakFreezeUsage.used_date == missed_date,
        ).limit(1)
    )
    return usage is not None


def consume_freeze_for_date(db: Session, child_id: UUID, missed_date: date) -> bool:
    if is_date_frozen(db, child_id, missed_date):
        return True

    freeze = get_or_create_streak_freeze(db, child_id, for_update=True)
    if is_date_frozen(db, child_id, missed_date):
        return True

    if freeze.available_count <= 0:
        return False

    freeze.available_count -= 1
    usage = ChildStreakFreezeUsage(
        child_id=child_id,
        used_date=missed_date,
        reason="auto_deduct_missed_day",
    )
    db.add(usage)
    try:
        db.commit()
    except Exception:
        db.rollback()
        if is_date_frozen(db, child_id, missed_date):
            return True
        raise
    return True
