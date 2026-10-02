"""Initial schema managed by Alembic.

Revision ID: 0001_initial
"""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "areas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=60), nullable=False, unique=True),
    )
    op.create_table(
        "islands",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("number", sa.String(length=10), nullable=False, unique=True),
        sa.Column("hall", sa.String(length=60), nullable=True),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(length=50), nullable=False, unique=True),
        sa.Column("full_name", sa.String(length=120), nullable=False),
        sa.Column("password_hash", sa.String(length=100), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
    )
    op.create_table(
        "machines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("number", sa.String(length=20), nullable=False, unique=True),
        sa.Column("island_id", sa.Integer(), sa.ForeignKey("islands.id"), nullable=True),
        sa.Column("area_id", sa.Integer(), sa.ForeignKey("areas.id"), nullable=True),
        sa.Column("manufacturer", sa.String(length=80), nullable=True),
        sa.Column("model", sa.String(length=80), nullable=True),
        sa.Column("serial", sa.String(length=80), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
    )
    op.create_index("ix_machines_status", "machines", ["status"])
    op.create_table(
        "technicians",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("first_name", sa.String(length=80), nullable=False),
        sa.Column("last_name", sa.String(length=80), nullable=False),
        sa.Column("position", sa.String(length=80), nullable=True),
        sa.Column("username", sa.String(length=50), nullable=True, unique=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("shift", sa.String(length=20), nullable=True),
        sa.Column("contracted_hours", sa.Integer(), nullable=True),
        sa.Column("specialties", sa.Text(), nullable=True),
        sa.Column("hire_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
    )
    op.create_index("ix_technicians_status", "technicians", ["status"])
    op.create_table(
        "parts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=True),
        sa.Column("brand", sa.String(length=80), nullable=True),
        sa.Column("model", sa.String(length=80), nullable=True),
        sa.Column("stock", sa.Integer(), nullable=False),
        sa.Column("minimum_stock", sa.Integer(), nullable=False),
        sa.Column("location", sa.String(length=120), nullable=True),
        sa.Column("unit_cost", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("supplier", sa.String(length=120), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
    )
    op.create_index("ix_parts_code", "parts", ["code"], unique=True)
    op.create_index("ix_parts_name", "parts", ["name"])
    op.create_index("ix_parts_status", "parts", ["status"])
    op.create_table(
        "tickets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("area_id", sa.Integer(), sa.ForeignKey("areas.id"), nullable=True),
        sa.Column("machine_id", sa.Integer(), sa.ForeignKey("machines.id"), nullable=True),
        sa.Column("task", sa.String(length=200), nullable=False),
        sa.Column("detail", sa.Text(), nullable=False),
        sa.Column("technician", sa.String(length=120), nullable=True),
        sa.Column("shift", sa.String(length=20), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("priority", sa.String(length=10), nullable=False),
        sa.Column("jira_number", sa.String(length=30), nullable=True),
        sa.Column("result", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
    )
    op.create_index("ix_tickets_created_at", "tickets", ["created_at"])
    op.create_index("ix_tickets_machine_id", "tickets", ["machine_id"])
    op.create_index("ix_tickets_status", "tickets", ["status"])
    op.create_table(
        "part_movements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("part_id", sa.Integer(), sa.ForeignKey("parts.id"), nullable=False),
        sa.Column("movement_type", sa.String(length=20), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("stock_after", sa.Integer(), nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("ticket_id", sa.Integer(), sa.ForeignKey("tickets.id"), nullable=True),
        sa.Column("machine_id", sa.Integer(), sa.ForeignKey("machines.id"), nullable=True),
        sa.Column("technician", sa.String(length=120), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
    )
    op.create_index("ix_part_movements_at", "part_movements", ["at"])
    op.create_index("ix_part_movements_machine_id", "part_movements", ["machine_id"])
    op.create_index("ix_part_movements_part_id", "part_movements", ["part_id"])
    op.create_index("ix_part_movements_ticket_id", "part_movements", ["ticket_id"])
    op.create_table(
        "machine_status_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("machine_id", sa.Integer(), sa.ForeignKey("machines.id"), nullable=False),
        sa.Column("old_status", sa.String(length=30), nullable=False),
        sa.Column("new_status", sa.String(length=30), nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("ticket_id", sa.Integer(), sa.ForeignKey("tickets.id"), nullable=True),
        sa.Column("downtime_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("downtime_minutes", sa.Integer(), nullable=True),
    )
    op.create_index("ix_machine_status_history_machine_id", "machine_status_history", ["machine_id"])
    op.create_table(
        "ticket_status_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ticket_id", sa.Integer(), sa.ForeignKey("tickets.id"), nullable=False),
        sa.Column("old_status", sa.String(length=30), nullable=False),
        sa.Column("new_status", sa.String(length=30), nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
    )
    op.create_index("ix_ticket_status_history_ticket_id", "ticket_status_history", ["ticket_id"])
    op.create_table(
        "interventions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ticket_id", sa.Integer(), sa.ForeignKey("tickets.id"), nullable=True),
        sa.Column("machine_id", sa.Integer(), sa.ForeignKey("machines.id"), nullable=True),
        sa.Column("area_id", sa.Integer(), sa.ForeignKey("areas.id"), nullable=True),
        sa.Column("technician", sa.String(length=120), nullable=True),
        sa.Column("shift", sa.String(length=20), nullable=True),
        sa.Column("work_type", sa.String(length=80), nullable=True),
        sa.Column("task", sa.String(length=200), nullable=False),
        sa.Column("detail", sa.Text(), nullable=False),
        sa.Column("result", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
    )
    op.create_index("ix_interventions_machine_id", "interventions", ["machine_id"])
    op.create_index("ix_interventions_occurred_at", "interventions", ["occurred_at"])
    op.create_index("ix_interventions_ticket_id", "interventions", ["ticket_id"])
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("action", sa.String(length=60), nullable=False),
        sa.Column("entity", sa.String(length=60), nullable=False),
        sa.Column("old_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
    )


def downgrade():
    op.drop_table("audit_logs")
    op.drop_index("ix_interventions_ticket_id", table_name="interventions")
    op.drop_index("ix_interventions_occurred_at", table_name="interventions")
    op.drop_index("ix_interventions_machine_id", table_name="interventions")
    op.drop_table("interventions")
    op.drop_index("ix_ticket_status_history_ticket_id", table_name="ticket_status_history")
    op.drop_table("ticket_status_history")
    op.drop_index("ix_machine_status_history_machine_id", table_name="machine_status_history")
    op.drop_table("machine_status_history")
    op.drop_index("ix_part_movements_ticket_id", table_name="part_movements")
    op.drop_index("ix_part_movements_part_id", table_name="part_movements")
    op.drop_index("ix_part_movements_machine_id", table_name="part_movements")
    op.drop_index("ix_part_movements_at", table_name="part_movements")
    op.drop_table("part_movements")
    op.drop_index("ix_tickets_status", table_name="tickets")
    op.drop_index("ix_tickets_machine_id", table_name="tickets")
    op.drop_index("ix_tickets_created_at", table_name="tickets")
    op.drop_table("tickets")
    op.drop_index("ix_parts_status", table_name="parts")
    op.drop_index("ix_parts_name", table_name="parts")
    op.drop_index("ix_parts_code", table_name="parts")
    op.drop_table("parts")
    op.drop_index("ix_technicians_status", table_name="technicians")
    op.drop_table("technicians")
    op.drop_index("ix_machines_status", table_name="machines")
    op.drop_table("machines")
    op.drop_table("users")
    op.drop_table("islands")
    op.drop_table("areas")
