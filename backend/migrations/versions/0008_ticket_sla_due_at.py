"""Store an SLA deadline on tickets created after the SLA policy rollout."""
from alembic import op
import sqlalchemy as sa

revision = "0008_ticket_sla_due_at"
down_revision = "0007_ticket_attachments"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("tickets", sa.Column("sla_due_at", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column("tickets", "sla_due_at")
