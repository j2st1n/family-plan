"""add_reward_settings_and_decimal_stars

Revision ID: 6d4f8a2b1c9e
Revises: 3a1b5c7d9e2f
Create Date: 2026-05-24 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "6d4f8a2b1c9e"
down_revision: str | None = "3a1b5c7d9e2f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


DEFAULT_TIERS = '[{"days": 7, "discount_percent": 90}, {"days": 14, "discount_percent": 85}, {"days": 21, "discount_percent": 80}]'


def upgrade() -> None:
    op.create_table(
        "child_reward_settings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("child_id", sa.Uuid(), nullable=False),
        sa.Column("streak_threshold", sa.Integer(), nullable=False, server_default="80"),
        sa.Column("streak_discount_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("streak_discount_tiers", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text(f"'{DEFAULT_TIERS}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["child_id"], ["children.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("child_id"),
    )
    op.create_index(op.f("ix_child_reward_settings_child_id"), "child_reward_settings", ["child_id"], unique=True)
    op.alter_column("shop_items", "star_cost", existing_type=sa.Integer(), type_=sa.Numeric(10, 2), existing_nullable=False)
    op.alter_column("reward_ledger", "stars_delta", existing_type=sa.Integer(), type_=sa.Numeric(10, 2), existing_nullable=False)
    op.add_column("redemptions", sa.Column("original_star_cost", sa.Numeric(10, 2), nullable=True))
    op.add_column("redemptions", sa.Column("final_star_cost", sa.Numeric(10, 2), nullable=True))
    op.add_column("redemptions", sa.Column("discount_percent", sa.Integer(), nullable=True))
    op.add_column("redemptions", sa.Column("streak_days_at_redeem", sa.Integer(), nullable=True))
    op.alter_column("child_reward_settings", "streak_threshold", server_default=None)
    op.alter_column("child_reward_settings", "streak_discount_enabled", server_default=None)
    op.alter_column("child_reward_settings", "streak_discount_tiers", server_default=None)


def downgrade() -> None:
    op.drop_column("redemptions", "streak_days_at_redeem")
    op.drop_column("redemptions", "discount_percent")
    op.drop_column("redemptions", "final_star_cost")
    op.drop_column("redemptions", "original_star_cost")
    op.alter_column("reward_ledger", "stars_delta", existing_type=sa.Numeric(10, 2), type_=sa.Integer(), existing_nullable=False)
    op.alter_column("shop_items", "star_cost", existing_type=sa.Numeric(10, 2), type_=sa.Integer(), existing_nullable=False)
    op.drop_index(op.f("ix_child_reward_settings_child_id"), table_name="child_reward_settings")
    op.drop_table("child_reward_settings")
