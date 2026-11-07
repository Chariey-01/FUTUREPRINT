"""record which scenario engine created each session's state

Revision ID: 0002_session_engine_id
Revises: feeaee01f485
Create Date: 2026-11-07

Existing sessions can only have been created by the reference engine, so
they are backfilled with 'app.engine.reference'. The server default is then
dropped so the application must always state the engine explicitly.
"""
from alembic import op
import sqlalchemy as sa

revision = '0002_session_engine_id'
down_revision = 'feeaee01f485'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('anonymous_sessions', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('engine_id', sa.String(length=255), nullable=False, server_default='app.engine.reference')
        )
    with op.batch_alter_table('anonymous_sessions', schema=None) as batch_op:
        batch_op.alter_column('engine_id', server_default=None)


def downgrade():
    with op.batch_alter_table('anonymous_sessions', schema=None) as batch_op:
        batch_op.drop_column('engine_id')
