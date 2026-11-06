"""Persist optional completion duration and retry identity; preserve existing business columns."""
from alembic import op
import sqlalchemy as sa
revision = "7c11a6d0e921"
down_revision = "4b1a8f9c2d3e"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("daily_tasks", sa.Column("actual_seconds", sa.Integer(), nullable=True))
    op.add_column("daily_tasks", sa.Column("completion_operation_id", sa.Uuid(), nullable=True))
    op.add_column("daily_tasks", sa.Column("completion_version", sa.Integer(), nullable=False, server_default="0"))

def downgrade():
    op.drop_column("daily_tasks", "completion_version")
    op.drop_column("daily_tasks", "completion_operation_id")
    op.drop_column("daily_tasks", "actual_seconds")
