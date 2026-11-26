"""add assessment primary key

Revision ID: a3fbc790493b
Revises: d5179464153a
Create Date: 2026-11-26 17:45:23.442755

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3fbc790493b'
down_revision: Union[str, Sequence[str], None] = 'd5179464153a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "github_assessment",
        sa.Column(
            "assessment_id",
            sa.Uuid(),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
    )
    op.create_primary_key(
        "github_assessment_pkey", "github_assessment", ["assessment_id"]
    )
    op.create_unique_constraint(
        "github_assessment_clerk_user_id_key", "github_assessment", ["clerk_user_id"]
    )
    op.alter_column("github_assessment", "assessment_id", server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        "github_assessment_clerk_user_id_key", "github_assessment", type_="unique"
    )
    op.drop_constraint("github_assessment_pkey", "github_assessment", type_="primary")
    op.drop_column("github_assessment", "assessment_id")
