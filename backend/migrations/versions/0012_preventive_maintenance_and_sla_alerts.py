"""Add preventive maintenance plans and approaching SLA notifications."""
from alembic import op
import sqlalchemy as sa

revision = "0012_preventive_maintenance_sla"
down_revision = "0011_user_avatars"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("tickets", sa.Column("sla_approaching_notified_at", sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        "preventive_maintenance_plans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("machine_id", sa.Integer(), sa.ForeignKey("machines.id"), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("interval_days", sa.Integer(), nullable=False),
        sa.Column("next_due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("notified_for_due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
    )
    op.create_index("ix_preventive_maintenance_plans_machine_id", "preventive_maintenance_plans", ["machine_id"])
    op.create_index("ix_preventive_maintenance_plans_next_due_at", "preventive_maintenance_plans", ["next_due_at"])
    op.create_index("ix_preventive_maintenance_plans_active", "preventive_maintenance_plans", ["active"])
    op.create_table(
        "preventive_maintenance_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("plan_id", sa.Integer(), sa.ForeignKey("preventive_maintenance_plans.id"), nullable=False),
        sa.Column("machine_id", sa.Integer(), sa.ForeignKey("machines.id"), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("technician", sa.String(length=120), nullable=True),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
    )
    op.create_index("ix_preventive_maintenance_logs_plan_id", "preventive_maintenance_logs", ["plan_id"])
    op.create_index("ix_preventive_maintenance_logs_machine_id", "preventive_maintenance_logs", ["machine_id"])
    op.create_index("ix_preventive_maintenance_logs_completed_at", "preventive_maintenance_logs", ["completed_at"])


def downgrade():
    op.drop_index("ix_preventive_maintenance_logs_completed_at", table_name="preventive_maintenance_logs")
    op.drop_index("ix_preventive_maintenance_logs_machine_id", table_name="preventive_maintenance_logs")
    op.drop_index("ix_preventive_maintenance_logs_plan_id", table_name="preventive_maintenance_logs")
    op.drop_table("preventive_maintenance_logs")
    op.drop_index("ix_preventive_maintenance_plans_active", table_name="preventive_maintenance_plans")
    op.drop_index("ix_preventive_maintenance_plans_next_due_at", table_name="preventive_maintenance_plans")
    op.drop_index("ix_preventive_maintenance_plans_machine_id", table_name="preventive_maintenance_plans")
    op.drop_table("preventive_maintenance_plans")
    op.drop_column("tickets", "sla_approaching_notified_at")
