"""add conversion_rate to products and is_debt supplier total_amount to import_receipts

Revision ID: a1b2c3d4e5f6
Revises: 50e49a7cde5b
Create Date: 2026-04-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "50e49a7cde5b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add conversion_rate to products
    with op.batch_alter_table("products") as batch_op:
        batch_op.add_column(sa.Column("conversion_rate", sa.Integer(), nullable=False, server_default="1"))

    # Add supplier, is_debt, total_amount to import_receipts
    with op.batch_alter_table("import_receipts") as batch_op:
        batch_op.add_column(sa.Column("supplier", sa.String(255), nullable=True))
        batch_op.add_column(sa.Column("is_debt", sa.Boolean(), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("total_amount", sa.Numeric(14, 2), nullable=False, server_default="0"))


def downgrade() -> None:
    with op.batch_alter_table("import_receipts") as batch_op:
        batch_op.drop_column("total_amount")
        batch_op.drop_column("is_debt")
        batch_op.drop_column("supplier")

    with op.batch_alter_table("products") as batch_op:
        batch_op.drop_column("conversion_rate")
