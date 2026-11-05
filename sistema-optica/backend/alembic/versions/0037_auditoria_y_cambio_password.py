"""Historial de acciones sensibles + obligar a cambiar la contraseña temporal.

- Tabla auditoria (quién anuló/borró/cambió qué y cuándo).
- users.debe_cambiar_password: true cuando el admin crea un usuario o le pone
  una contraseña nueva; el usuario debe cambiarla al entrar. Los usuarios
  existentes quedan en false para no bloquear instalaciones en uso.

Revision ID: 0037
Revises: 0036
Create Date: 2026-11-05
"""
import sqlalchemy as sa
from alembic import op

revision = "0037"
down_revision = "0036"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "auditoria",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("fecha", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("usuario_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("usuario_nombre", sa.String(150), nullable=False),
        sa.Column("accion", sa.String(40), nullable=False),
        sa.Column("entidad", sa.String(40), nullable=False),
        sa.Column("entidad_id", sa.Integer, nullable=True),
        sa.Column("referencia", sa.String(60), nullable=True),
        sa.Column("detalle", sa.Text, nullable=True),
    )
    op.create_index("ix_auditoria_fecha", "auditoria", ["fecha"])
    op.create_index("ix_auditoria_usuario_id", "auditoria", ["usuario_id"])
    op.create_index("ix_auditoria_accion", "auditoria", ["accion"])
    op.create_index("ix_auditoria_entidad", "auditoria", ["entidad"])
    op.add_column("users", sa.Column("debe_cambiar_password", sa.Boolean, nullable=False, server_default=sa.false()))


def downgrade():
    op.drop_column("users", "debe_cambiar_password")
    op.drop_table("auditoria")
