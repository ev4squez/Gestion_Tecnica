"""Link technician profiles to system accounts.

Revision ID: 0004_user_technician_link
"""
from alembic import op
import sqlalchemy as sa

revision = "0004_user_technician_link"
down_revision = "0003_intervention_activity"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("technician_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_users_technician_id_technicians",
        "users", "technicians", ["technician_id"], ["id"],
    )
    op.create_unique_constraint("uq_users_technician_id", "users", ["technician_id"])
    op.execute(sa.text("""
        UPDATE users
        SET technician_id = technicians.id
        FROM technicians
        WHERE users.role = 'TECNICO'
          AND users.username = technicians.username
          AND technicians.username IS NOT NULL
    """))


def downgrade():
    op.drop_constraint("uq_users_technician_id", "users", type_="unique")
    op.drop_constraint("fk_users_technician_id_technicians", "users", type_="foreignkey")
    op.drop_column("users", "technician_id")
