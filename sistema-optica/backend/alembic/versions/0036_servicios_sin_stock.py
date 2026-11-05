"""Los servicios (unidad = "servicio") no llevan stock.

Antes cada venta de "Examen visual" restaba stock y el producto quedaba en negativo
y aparecía como agotado en las alertas. El código ya no los descuenta; aquí se
deja su stock en 0.

Revision ID: 0036
Revises: 0035
Create Date: 2026-11-05
"""
from alembic import op

revision = "0036"
down_revision = "0035"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("UPDATE productos SET stock_actual = 0, stock_minimo = 0 WHERE unidad = 'servicio'")


def downgrade():
    pass
