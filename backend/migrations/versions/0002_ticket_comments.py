"""Add ticket conversations.

Revision ID: 0002_ticket_comments
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0002_ticket_comments"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade():
    inspector = inspect(op.get_bind())
    if "ticket_comments" not in inspector.get_table_names():
        op.create_table(
            "ticket_comments",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("ticket_id", sa.Integer(), sa.ForeignKey("tickets.id"), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("body", sa.Text(), nullable=False),
        )
    existing_indexes = {index["name"] for index in inspector.get_indexes("ticket_comments")}
    for name, column in (
        ("ix_ticket_comments_at", "at"),
        ("ix_ticket_comments_ticket_id", "ticket_id"),
        ("ix_ticket_comments_user_id", "user_id"),
    ):
        if name not in existing_indexes:
            op.create_index(name, "ticket_comments", [column])


def downgrade():
    if "ticket_comments" not in inspect(op.get_bind()).get_table_names():
        return
    op.drop_index("ix_ticket_comments_user_id", table_name="ticket_comments")
    op.drop_index("ix_ticket_comments_ticket_id", table_name="ticket_comments")
    op.drop_index("ix_ticket_comments_at", table_name="ticket_comments")
    op.drop_table("ticket_comments")
