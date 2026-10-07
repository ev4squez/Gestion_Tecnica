"""Store optional technician avatars without changing existing records."""
from alembic import op
import sqlalchemy as sa

revision = "0014_technician_avatars"
down_revision = "0013_intervention_followups"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("technicians", sa.Column("avatar_data", sa.LargeBinary(), nullable=True))
    op.add_column("technicians", sa.Column("avatar_content_type", sa.String(length=30), nullable=True))


def downgrade():
    op.drop_column("technicians", "avatar_content_type")
    op.drop_column("technicians", "avatar_data")
