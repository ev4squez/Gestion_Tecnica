"""Store image attachments on tickets."""
from alembic import op
import sqlalchemy as sa

revision = "0007_ticket_attachments"
down_revision = "0006_inventory_type"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "ticket_attachments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ticket_id", sa.Integer(), sa.ForeignKey("tickets.id"), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=80), nullable=False),
        sa.Column("image_data", sa.LargeBinary(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ticket_attachments_ticket_id", "ticket_attachments", ["ticket_id"])


def downgrade():
    op.drop_index("ix_ticket_attachments_ticket_id", table_name="ticket_attachments")
    op.drop_table("ticket_attachments")
