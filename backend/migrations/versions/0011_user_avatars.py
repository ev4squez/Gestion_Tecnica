"""Store optional profile avatars on user accounts."""
from alembic import op
import sqlalchemy as sa

revision = "0011_user_avatars"
down_revision = "0010_email_settings"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("avatar_data", sa.LargeBinary(), nullable=True))
    op.add_column("users", sa.Column("avatar_content_type", sa.String(length=30), nullable=True))


def downgrade():
    op.drop_column("users", "avatar_content_type")
    op.drop_column("users", "avatar_data")
