"""Track one-time notifications for overdue SLA tickets."""
from alembic import op
import sqlalchemy as sa

revision = "0009_sla_overdue_notification"
down_revision = "0008_ticket_sla_due_at"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("tickets", sa.Column("sla_overdue_notified_at", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column("tickets", "sla_overdue_notified_at")
