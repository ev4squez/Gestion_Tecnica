"""Add the interactive floor plan and machine map positions.

Revision ID: 0005_floorplan_machine_positions
"""
from alembic import op
import sqlalchemy as sa

revision = "0005_floorplan_machine_positions"
down_revision = "0004_user_technician_link"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("machines", sa.Column("position_x", sa.Float(), nullable=True))
    op.add_column("machines", sa.Column("position_y", sa.Float(), nullable=True))
    op.create_table(
        "floor_plans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("pdf_data", sa.LargeBinary(), nullable=False),
        sa.Column("image_data", sa.LargeBinary(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("uploaded_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
    )


def downgrade():
    op.drop_table("floor_plans")
    op.drop_column("machines", "position_y")
    op.drop_column("machines", "position_x")
