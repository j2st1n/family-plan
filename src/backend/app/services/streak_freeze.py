from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import api_error
from app.models.child import Child
from app.models.child_streak_freeze import ChildStreakFreeze
from app.models.child_streak_freeze_log import ChildStreakFreezeLog
from app.models.child_streak_freeze_usage import ChildStreakFreezeUsage
from app.models.reward_ledger import RewardLedger

FREEZE_CARD_DEFAULT_STAR_COST = Decimal("5.00")
FREEZE_CARD_DEFAULT_MAX_LIMIT = 2
FREEZE_CARD_DEFAULT_MONTHLY_GRANT = 1


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
            star_cost=FREEZE_CARD_DEFAULT_STAR_COST,
            max_limit=FREEZE_CARD_DEFAULT_MAX_LIMIT,
            monthly_grant=FREEZE_CARD_DEFAULT_MONTHLY_GRANT,
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
        grant = getattr(freeze, "monthly_grant", FREEZE_CARD_DEFAULT_MONTHLY_GRANT)
        max_limit = getattr(freeze, "max_limit", FREEZE_CARD_DEFAULT_MAX_LIMIT)
        if grant > 0:
            to_add = min(grant, max(0, max_limit - freeze.available_count))
            if to_add > 0:
                freeze.available_count += to_add
                log = ChildStreakFreezeLog(
                    child_id=child_id,
                    event_type="monthly_grant",
                    delta=to_add,
                    balance_after=freeze.available_count,
                    reason=f"{current_month} 每月例行赠送",
                    operator="system",
                )
                db.add(log)
        freeze.last_granted_month = current_month
        db.commit()
        db.refresh(freeze)

    return freeze


def purchase_streak_freeze(
    db: Session,
    child_id: UUID,
    star_cost: Decimal | None = None,
    operator: str = "child",
) -> ChildStreakFreeze:
    child = db.scalar(select(Child).where(Child.id == child_id).with_for_update())
    if child is None:
        raise api_error("not_found", "Child not found", 404)

    freeze = get_or_create_streak_freeze(db, child_id, for_update=True)

    if freeze.available_count >= freeze.max_limit:
        raise api_error("conflict", "Freeze max limit reached", 409)

    actual_cost = star_cost if star_cost is not None else freeze.star_cost

    total_stars = db.scalar(
        select(func.coalesce(func.sum(RewardLedger.stars_delta), Decimal("0.00"))).where(
            RewardLedger.child_id == child_id
        )
    )
    current_balance = Decimal(total_stars or "0.00")
    if current_balance < actual_cost:
        raise api_error("conflict", "Not enough stars", 409)

    log_id = uuid4()
    db.add(
        RewardLedger(
            child_id=child_id,
            source_type="shop_redeem",
            source_id=log_id,
            stars_delta=-actual_cost,
            reason="购买连击保护卡",
        )
    )
    freeze.available_count += 1
    log = ChildStreakFreezeLog(
        id=log_id,
        child_id=child_id,
        event_type="shop_purchase",
        delta=1,
        balance_after=freeze.available_count,
        reason=f"花费 {actual_cost} 颗星星兑换",
        operator=operator,
    )
    db.add(log)
    db.commit()
    db.refresh(freeze)
    return freeze


def adjust_streak_freeze_balance(
    db: Session,
    child_id: UUID,
    delta: int,
    reason: str | None = None,
    operator: str = "parent",
) -> ChildStreakFreeze:
    if delta == 0:
        raise api_error("unprocessable", "Delta cannot be zero", 422)

    child = db.scalar(select(Child).where(Child.id == child_id).with_for_update())
    if child is None:
        raise api_error("not_found", "Child not found", 404)

    freeze = get_or_create_streak_freeze(db, child_id, for_update=True)
    new_balance = freeze.available_count + delta

    if new_balance < 0:
        raise api_error("bad_request", "Insufficient streak freeze count to deduct", 400)

    freeze.available_count = new_balance
    default_reason = "家长手动奖励" if delta > 0 else "家长手动扣除"
    log = ChildStreakFreezeLog(
        child_id=child_id,
        event_type="manual_grant" if delta > 0 else "manual_deduct",
        delta=delta,
        balance_after=new_balance,
        reason=reason or default_reason,
        operator=operator,
    )
    db.add(log)
    db.commit()
    db.refresh(freeze)
    return freeze


def update_freeze_rules(
    db: Session,
    child_id: UUID,
    star_cost: Decimal | None = None,
    max_limit: int | None = None,
    monthly_grant: int | None = None,
) -> ChildStreakFreeze:
    child = db.scalar(select(Child).where(Child.id == child_id).with_for_update())
    if child is None:
        raise api_error("not_found", "Child not found", 404)

    freeze = get_or_create_streak_freeze(db, child_id, for_update=True)

    if star_cost is not None:
        if star_cost < Decimal("0.01"):
            raise api_error("unprocessable", "Star cost must be positive", 422)
        freeze.star_cost = star_cost

    if max_limit is not None:
        if max_limit < 1:
            raise api_error("unprocessable", "Max limit must be at least 1", 422)
        freeze.max_limit = max_limit

    if monthly_grant is not None:
        if monthly_grant < 0:
            raise api_error("unprocessable", "Monthly grant cannot be negative", 422)
        freeze.monthly_grant = monthly_grant

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


def get_freeze_logs(db: Session, child_id: UUID) -> list[ChildStreakFreezeLog]:
    return list(
        db.scalars(
            select(ChildStreakFreezeLog)
            .where(ChildStreakFreezeLog.child_id == child_id)
            .order_by(ChildStreakFreezeLog.created_at.desc())
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
    log = ChildStreakFreezeLog(
        child_id=child_id,
        event_type="auto_deduct",
        delta=-1,
        balance_after=freeze.available_count,
        target_date=missed_date,
        reason="auto_deduct_missed_day",
        operator="system",
    )
    db.add(log)
    try:
        db.commit()
    except Exception:
        db.rollback()
        if is_date_frozen(db, child_id, missed_date):
            return True
        raise
    return True
