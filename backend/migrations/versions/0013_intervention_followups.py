"""Add append-only intervention shift handoff updates."""
from alembic import op
import sqlalchemy as sa

revision = "0013_intervention_followups"
down_revision = "0012_preventive_maintenance_sla"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "intervention_follow_ups",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("intervention_id", sa.Integer(), sa.ForeignKey("interventions.id"), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("note", sa.Text(), nullable=False, server_default=""),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
    )
    op.create_index("ix_intervention_follow_ups_intervention_id", "intervention_follow_ups", ["intervention_id"])
    op.create_index("ix_intervention_follow_ups_at", "intervention_follow_ups", ["at"])


def downgrade():
    op.drop_index("ix_intervention_follow_ups_at", table_name="intervention_follow_ups")
    op.drop_index("ix_intervention_follow_ups_intervention_id", table_name="intervention_follow_ups")
    op.drop_table("intervention_follow_ups")
