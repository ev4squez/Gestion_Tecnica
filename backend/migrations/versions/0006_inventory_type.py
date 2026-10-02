"""Separate supplies from spare parts in the warehouse catalog."""
from alembic import op
import sqlalchemy as sa

revision = "0006_inventory_type"
down_revision = "0005_floorplan_machine_positions"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "parts",
        sa.Column("inventory_type", sa.String(length=20), server_default="REPUESTO", nullable=False),
    )
    op.create_index("ix_parts_inventory_type", "parts", ["inventory_type"])


def downgrade():
    op.drop_index("ix_parts_inventory_type", table_name="parts")
    op.drop_column("parts", "inventory_type")
