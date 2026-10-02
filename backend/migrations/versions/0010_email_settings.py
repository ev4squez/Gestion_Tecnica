"""Persist SMTP and notification settings managed by administrators."""
from alembic import op
import sqlalchemy as sa

revision = "0010_email_settings"
down_revision = "0009_sla_overdue_notification"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "email_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("smtp_host", sa.String(length=255), nullable=True),
        sa.Column("smtp_port", sa.Integer(), nullable=False, server_default="587"),
        sa.Column("smtp_user", sa.String(length=255), nullable=True),
        sa.Column("smtp_password_encrypted", sa.Text(), nullable=True),
        sa.Column("smtp_from", sa.String(length=255), nullable=True),
        sa.Column("smtp_from_name", sa.String(length=120), nullable=False, server_default="Gestión Técnica"),
        sa.Column("smtp_use_tls", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("notification_email_to", sa.Text(), nullable=False, server_default=""),
        sa.Column("report_email_to", sa.Text(), nullable=False, server_default=""),
        sa.Column("report_email_cc", sa.Text(), nullable=False, server_default=""),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
    )


def downgrade():
    op.drop_table("email_settings")
