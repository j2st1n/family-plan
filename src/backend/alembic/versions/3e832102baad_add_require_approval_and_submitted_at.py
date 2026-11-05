"""add_require_approval_and_submitted_at

Revision ID: 3e832102baad
Revises: 6d4f8a2b1c9e
Create Date: 2026-11-02 02:56:32.101120
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = '3e832102baad'
down_revision: str | None = '6d4f8a2b1c9e'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'daily_tasks',
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        'daily_tasks',
        sa.Column('require_approval', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )
    op.add_column(
        'task_templates',
        sa.Column('require_approval', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )


def downgrade() -> None:
    op.drop_column('task_templates', 'require_approval')
    op.drop_column('daily_tasks', 'require_approval')
    op.drop_column('daily_tasks', 'submitted_at')
