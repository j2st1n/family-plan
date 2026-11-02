"""expand_streak_freeze_and_add_logs

Revision ID: 3a5fe7ec5daf
Revises: 8a40a7180f93
Create Date: 2026-11-02 14:26:19.720794
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "3a5fe7ec5daf"
down_revision: str | None = "8a40a7180f93"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "child_streak_freezes",
        sa.Column("star_cost", sa.Numeric(precision=10, scale=2), server_default="5.00", nullable=False),
    )
    op.add_column(
        "child_streak_freezes",
        sa.Column("max_limit", sa.Integer(), server_default="2", nullable=False),
    )
    op.add_column(
        "child_streak_freezes",
        sa.Column("monthly_grant", sa.Integer(), server_default="1", nullable=False),
    )
    op.create_check_constraint("chk_freeze_star_cost_positive", "child_streak_freezes", "star_cost >= 0.01")
    op.create_check_constraint("chk_freeze_max_limit_ge_1", "child_streak_freezes", "max_limit >= 1")

    op.create_table(
        "child_streak_freeze_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("child_id", sa.Uuid(), nullable=False),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("delta", sa.Integer(), nullable=False),
        sa.Column("balance_after", sa.Integer(), nullable=False),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("reason", sa.String(length=200), nullable=True),
        sa.Column("operator", sa.String(length=32), server_default="system", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["child_id"], ["children.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_child_streak_freeze_logs_child_id"),
        "child_streak_freeze_logs",
        ["child_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_child_streak_freeze_logs_child_id"), table_name="child_streak_freeze_logs")
    op.drop_table("child_streak_freeze_logs")
    op.drop_constraint("chk_freeze_max_limit_ge_1", "child_streak_freezes", type_="check")
    op.drop_constraint("chk_freeze_star_cost_positive", "child_streak_freezes", type_="check")
    op.drop_column("child_streak_freezes", "monthly_grant")
    op.drop_column("child_streak_freezes", "max_limit")
    op.drop_column("child_streak_freezes", "star_cost")
