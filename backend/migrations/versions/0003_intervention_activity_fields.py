"""Add daily activity fields to interventions.

Revision ID: 0003_intervention_activity
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_intervention_activity"
down_revision = "0002_ticket_comments"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("interventions", sa.Column("island", sa.String(length=64), nullable=False, server_default=""))
    op.add_column("interventions", sa.Column("jira_number", sa.String(length=64), nullable=False, server_default=""))
    op.add_column("interventions", sa.Column("pending", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.alter_column("interventions", "island", server_default=None)
    op.alter_column("interventions", "jira_number", server_default=None)
    op.alter_column("interventions", "pending", server_default=None)
    op.create_index("ix_interventions_pending", "interventions", ["pending"])


def downgrade():
    op.drop_index("ix_interventions_pending", table_name="interventions")
    op.drop_column("interventions", "pending")
    op.drop_column("interventions", "jira_number")
    op.drop_column("interventions", "island")
