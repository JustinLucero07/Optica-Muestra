"""Unifica cotizaciones: las "proformas" (órdenes marcadas) pasan a ser Presupuestos.

- presupuestos.venta_id / presupuestos.orden_id: a qué se convirtió el presupuesto.
- Cada orden con es_proforma = true y sin venta se copia como presupuesto
  (ítems armazón / lunas, receta en las notas).
  · Si la orden nunca salió al laboratorio (estado "pendiente") se elimina:
    era solo una cotización → presupuesto "enviado".
  · Si ya estaba en el laboratorio, se conserva como orden normal y el
    presupuesto queda "convertido" apuntando a ella.
- Se elimina la columna ordenes_trabajo.es_proforma.

Revision ID: 0035
Revises: 0034
Create Date: 2026-11-05
"""
import sqlalchemy as sa
from alembic import op

revision = "0035"
down_revision = "0034"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("presupuestos", sa.Column(
        "venta_id", sa.Integer, sa.ForeignKey("ventas.id", ondelete="SET NULL"), nullable=True))
    op.add_column("presupuestos", sa.Column(
        "orden_id", sa.Integer, sa.ForeignKey("ordenes_trabajo.id", ondelete="SET NULL"), nullable=True))

    conn = op.get_bind()
    proformas = conn.execute(sa.text("""
        SELECT id, numero, paciente_id, fecha_envio, estado, tipo, descripcion,
               precio_armazon, precio_lunas, precio_venta, armazon_ref
        FROM ordenes_trabajo
        WHERE es_proforma = true AND venta_id IS NULL
        ORDER BY id
    """)).mappings().all()

    for o in proformas:
        # Número correlativo de presupuesto (misma lógica que siguiente_numero)
        conn.execute(sa.text("""
            INSERT INTO configuraciones (clave, valor) VALUES ('numerador_presupuesto', '0')
            ON CONFLICT (clave) DO NOTHING
        """))
        nuevo = conn.execute(sa.text("""
            UPDATE configuraciones SET valor = (valor::int + 1)::text
            WHERE clave = 'numerador_presupuesto' RETURNING valor
        """)).scalar_one()
        numero = f"PRE-{str(nuevo).zfill(5)}"

        items = []
        p_arm = float(o["precio_armazon"] or 0)
        p_lun = float(o["precio_lunas"] or 0)
        total = float(o["precio_venta"] or 0) or (p_arm + p_lun)
        if p_arm > 0:
            items.append((f"Armazón{f' ({o['armazon_ref']})' if o['armazon_ref'] else ''}", p_arm))
        if p_lun > 0:
            items.append((f"Lunas {o['tipo']}", p_lun))
        resto = round(total - p_arm - p_lun, 2)
        if resto > 0 or not items:
            items.append((f"{o['tipo']} (orden {o['numero']})", max(resto, 0)))
        total = round(sum(m for _, m in items), 2)

        elimina = o["estado"] == "pendiente"
        notas = f"Migrado desde la proforma {o['numero']}."
        if o["descripcion"]:
            notas += f"\nReceta:\n{o['descripcion']}"

        pid = conn.execute(sa.text("""
            INSERT INTO presupuestos (numero, paciente_id, fecha, estado, notas, total, validez_dias,
                                      orden_id, created_at, updated_at)
            VALUES (:numero, :pac, :fecha, :estado, :notas, :total, 30, :orden, now(), now())
            RETURNING id
        """), {
            "numero": numero, "pac": o["paciente_id"], "fecha": o["fecha_envio"], "notas": notas,
            "total": total, "orden": None if elimina else o["id"],
            # Si la orden ya estaba en el laboratorio, la cotización ya se convirtió en esa orden
            "estado": "enviado" if elimina else "convertido",
        }).scalar_one()
        for desc, monto in items:
            conn.execute(sa.text("""
                INSERT INTO presupuesto_items (presupuesto_id, descripcion, cantidad, precio_unitario, descuento, subtotal)
                VALUES (:pid, :d, 1, :m, 0, :m)
            """), {"pid": pid, "d": desc, "m": monto})

        if elimina:
            conn.execute(sa.text("DELETE FROM ordenes_trabajo WHERE id = :id"), {"id": o["id"]})

    op.drop_column("ordenes_trabajo", "es_proforma")


def downgrade():
    op.add_column("ordenes_trabajo", sa.Column(
        "es_proforma", sa.Boolean, nullable=False, server_default=sa.false()))
    op.drop_column("presupuestos", "orden_id")
    op.drop_column("presupuestos", "venta_id")
