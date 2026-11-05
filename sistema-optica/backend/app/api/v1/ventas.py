from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_user, require_roles
from app.core.db import get_db
from app.core.auditoria import auditar, cambios
from app.core.numeradores import siguiente_numero
from app.models.agenda import OrdenTrabajo
from app.models.paciente import Paciente
from app.models.presupuesto import Presupuesto
from app.models.producto import MovimientoInventario, Producto
from app.models.tesoreria import Cobro
from app.models.user import User
from app.models.venta import Venta, VentaItem
from app.schemas.ventas import VentaCreate, VentaListItem, VentaOut

router = APIRouter(prefix="/ventas", tags=["ventas"])

_eager = selectinload(Venta.items)


@router.get("", response_model=list[VentaListItem])
def listar(
    desde: date | None = None,
    hasta: date | None = None,
    paciente_id: int | None = None,
    estado: str | None = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "cajero", "vendedor")),
):
    stmt = (
        select(Venta, Paciente)
        .outerjoin(Paciente, Venta.paciente_id == Paciente.id)
        .order_by(Venta.fecha.desc(), Venta.id.desc())
    )
    if desde:
        stmt = stmt.where(Venta.fecha >= desde)
    if hasta:
        stmt = stmt.where(Venta.fecha <= hasta)
    if paciente_id:
        stmt = stmt.where(Venta.paciente_id == paciente_id)
    if estado:
        stmt = stmt.where(Venta.estado == estado)
    rows = db.execute(stmt.offset(skip).limit(limit)).all()

    venta_ids = [v.id for v, _ in rows]
    abonos: dict[int, float] = {}
    if venta_ids:
        abono_rows = db.execute(
            select(Cobro.venta_id, func.sum(Cobro.monto))
            .where(Cobro.venta_id.in_(venta_ids))
            .group_by(Cobro.venta_id)
        ).all()
        abonos = {vid: float(total) for vid, total in abono_rows}

    return [
        VentaListItem(
            id=v.id, numero=v.numero, paciente_id=v.paciente_id,
            paciente_nombre=f"{p.apellidos} {p.nombres}" if p else None,
            fecha=v.fecha, total=v.total, abonado=abonos.get(v.id, 0), estado=v.estado, created_at=v.created_at,
        )
        for v, p in rows
    ]


def tomar_presupuesto(db: Session, pid: int) -> Presupuesto:
    """Bloquea el presupuesto y verifica que todavía se pueda convertir."""
    p = db.execute(
        select(Presupuesto).where(Presupuesto.id == pid).with_for_update(of=Presupuesto)
    ).scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    if p.estado == "convertido":
        raise HTTPException(status_code=409, detail=f"El presupuesto {p.numero} ya fue convertido")
    if p.estado == "rechazado":
        raise HTTPException(status_code=422, detail=f"El presupuesto {p.numero} está rechazado")
    return p


def registrar_venta(db: Session, data: VentaCreate, current: User) -> Venta:
    """Crea la venta, sus ítems y los movimientos de stock SIN hacer commit.

    Si viene `orden_id`, la orden de laboratorio queda vinculada en la misma
    transacción: o se guarda todo o no se guarda nada (evita órdenes que siguen
    "sin facturar" aunque ya tengan venta y se cobran dos veces).
    """
    orden = None
    if data.orden_id:
        orden = db.execute(
            select(OrdenTrabajo).where(OrdenTrabajo.id == data.orden_id).with_for_update(of=OrdenTrabajo)
        ).scalar_one_or_none()
        if not orden:
            raise HTTPException(status_code=404, detail="Orden no encontrada")
        if orden.venta_id:
            raise HTTPException(status_code=409, detail=f"La orden {orden.numero} ya está facturada")
        if data.paciente_id and orden.paciente_id != data.paciente_id:
            raise HTTPException(status_code=422, detail="La orden pertenece a otro paciente")

    presupuesto = tomar_presupuesto(db, data.presupuesto_id) if data.presupuesto_id else None

    if not data.items:
        raise HTTPException(status_code=422, detail="La venta debe tener al menos un ítem")

    numero = siguiente_numero(db, "numerador_venta", "VEN")

    subtotal = sum(it.subtotal for it in data.items)
    total = round(subtotal - data.descuento, 2)

    venta = Venta(
        numero=numero,
        paciente_id=data.paciente_id,
        usuario_id=current.id,
        fecha=data.fecha,
        subtotal=subtotal,
        descuento=data.descuento,
        total=total,
        referencia=data.referencia,
        notas=data.notas,
    )
    db.add(venta)
    db.flush()

    for it in data.items:
        garantia_vence = None
        if it.garantia_meses:
            from dateutil.relativedelta import relativedelta
            garantia_vence = data.fecha + relativedelta(months=it.garantia_meses)
        item = VentaItem(
            venta_id=venta.id,
            producto_id=it.producto_id,
            descripcion=it.descripcion,
            cantidad=it.cantidad,
            precio_unitario=it.precio_unitario,
            descuento_pct=it.descuento_pct,
            subtotal=it.subtotal,
            garantia_meses=it.garantia_meses,
            garantia_vence=garantia_vence,
        )
        db.add(item)

        if it.producto_id:
            prod = db.get(Producto, it.producto_id)
            # Los servicios (examen visual, ajustes…) no llevan stock
            if prod and prod.unidad != "servicio":
                antes = prod.stock_actual
                prod.stock_actual = float(antes) - it.cantidad
                db.add(MovimientoInventario(
                    producto_id=it.producto_id,
                    tipo="salida",
                    cantidad=it.cantidad,
                    stock_antes=antes,
                    stock_despues=prod.stock_actual,
                    motivo="Venta",
                    referencia=numero,
                    usuario_id=current.id,
                ))

    if orden:
        orden.venta_id = venta.id
    if presupuesto:
        presupuesto.estado = "convertido"
        presupuesto.venta_id = venta.id

    db.flush()
    return venta


@router.post("", response_model=VentaOut, status_code=status.HTTP_201_CREATED)
def crear_venta(
    data: VentaCreate,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin", "vendedor")),
):
    venta = registrar_venta(db, data, current)
    db.commit()
    return db.execute(select(Venta).options(_eager).where(Venta.id == venta.id)).scalar_one()


@router.get("/{vid}", response_model=VentaOut)
def obtener(vid: int, db: Session = Depends(get_db), _: User = Depends(require_roles("admin", "cajero", "vendedor"))):
    v = db.execute(select(Venta).options(_eager).where(Venta.id == vid)).scalar_one_or_none()
    if not v:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return v


@router.post("/{vid}/anular", response_model=VentaOut)
def anular_venta(
    vid: int,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin")),
):
    v = db.execute(select(Venta).options(_eager).where(Venta.id == vid)).scalar_one_or_none()
    if not v:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if v.estado == "anulado":
        raise HTTPException(status_code=409, detail="La venta ya está anulada")

    v.estado = "anulado"

    for item in v.items:
        if item.producto_id:
            prod = db.get(Producto, item.producto_id)
            if prod and prod.unidad != "servicio":
                antes = prod.stock_actual
                prod.stock_actual = float(antes) + float(item.cantidad)
                db.add(MovimientoInventario(
                    producto_id=item.producto_id,
                    tipo="entrada",
                    cantidad=item.cantidad,
                    stock_antes=antes,
                    stock_despues=prod.stock_actual,
                    motivo=f"Anulación {v.numero}",
                    referencia=v.numero,
                    usuario_id=current.id,
                ))

    # Si la venta era a crédito, el crédito se anula: deja de aparecer en
    # Cuentas por cobrar y de mandar recordatorios de cuotas.
    from app.models.credito import Credito
    for cred in db.execute(select(Credito).where(Credito.venta_id == v.id)).scalars():
        if cred.estado != "pagado":
            cred.estado = "anulado"
            for q in cred.cuotas:
                if q.estado in ("pendiente", "vencido"):
                    q.estado = "anulado"

    # La venta anulada libera lo que tenía vinculado:
    #  - órdenes de laboratorio → vuelven a "Órdenes sin venta"
    #  - presupuesto de origen → vuelve a "aceptado" (se puede convertir de nuevo)
    for o in db.execute(select(OrdenTrabajo).where(OrdenTrabajo.venta_id == v.id)).scalars():
        o.venta_id = None
    for p in db.execute(select(Presupuesto).where(Presupuesto.venta_id == v.id)).scalars():
        p.venta_id = None
        if not p.orden_id:
            p.estado = "aceptado"

    auditar(db, current, "anular", "venta", v.id, v.numero, f"Total {float(v.total):.2f}")
    db.commit()
    db.refresh(v)
    return v
