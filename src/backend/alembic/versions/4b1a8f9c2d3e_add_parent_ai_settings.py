"""add_parent_ai_settings

Revision ID: 4b1a8f9c2d3e
Revises: 3a5fe7ec5daf
Create Date: 2026-11-04 01:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "4b1a8f9c2d3e"
down_revision: str | None = "3a5fe7ec5daf"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "parent_ai_settings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("parent_id", sa.Uuid(), nullable=False),
        sa.Column("provider", sa.String(length=32), server_default="deepseek", nullable=False),
        sa.Column("base_url", sa.String(length=255), nullable=True),
        sa.Column("api_key_encrypted", sa.Text(), nullable=True),
        sa.Column("model", sa.String(length=64), server_default="deepseek-chat", nullable=False),
        sa.Column("is_enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["parent_id"], ["parents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("parent_id", name="uq_parent_ai_settings_parent_id"),
    )
    op.create_index(
        op.f("ix_parent_ai_settings_parent_id"),
        "parent_ai_settings",
        ["parent_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_parent_ai_settings_parent_id"), table_name="parent_ai_settings")
    op.drop_table("parent_ai_settings")
