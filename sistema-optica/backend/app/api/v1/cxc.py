"""
Cuentas por Cobrar — análisis de cartera y aging.
Endpoints:
  GET /cxc/aging   → cuotas de créditos pendientes, agrupadas por antigüedad
  GET /cxc/ventas  → ventas al contado con saldo pendiente (abonos parciales)
"""
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user, require_roles
from app.models.credito import Credito, CuotaCredito
from app.models.paciente import Paciente
from app.models.tesoreria import Cobro
from app.models.user import User
from app.models.venta import Venta

router = APIRouter(prefix="/cxc", tags=["cxc"])


@router.get("/aging")
def aging(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "cajero", "vendedor")),
):
    hoy = date.today()

    rows = db.execute(
        select(CuotaCredito, Credito, Paciente)
        .join(Credito, CuotaCredito.credito_id == Credito.id)
        .outerjoin(Paciente, Credito.paciente_id == Paciente.id)
        .where(CuotaCredito.estado.in_(["pendiente", "vencido"]))
        .order_by(CuotaCredito.fecha_vencimiento)
    ).all()

    buckets: dict[str, dict] = {
        "corriente": {"total": 0.0, "count": 0},
        "dias_1_30":  {"total": 0.0, "count": 0},
        "dias_31_60": {"total": 0.0, "count": 0},
        "dias_61_90": {"total": 0.0, "count": 0},
        "mas_90":     {"total": 0.0, "count": 0},
    }

    cuotas_out = []
    for cuota, credito, paciente in rows:
        saldo = round(float(cuota.monto) - float(cuota.monto_pagado), 2)
        if saldo <= 0:
            continue
        dias = (hoy - cuota.fecha_vencimiento).days
        if dias <= 0:
            bucket = "corriente"
        elif dias <= 30:
            bucket = "dias_1_30"
        elif dias <= 60:
            bucket = "dias_31_60"
        elif dias <= 90:
            bucket = "dias_61_90"
        else:
            bucket = "mas_90"

        buckets[bucket]["total"] += saldo
        buckets[bucket]["count"] += 1

        cuotas_out.append({
            "cuota_id": cuota.id,
            "credito_id": credito.id,
            "credito_numero": credito.numero,
            "cuota_numero": cuota.numero_cuota,
            "total_cuotas": credito.numero_cuotas,
            "paciente_id": credito.paciente_id,
            "paciente_nombre": f"{paciente.apellidos} {paciente.nombres}" if paciente else "—",
            "paciente_telefono": paciente.telefono if paciente else None,
            "venta_id": credito.venta_id,
            "fecha_vencimiento": cuota.fecha_vencimiento.isoformat(),
            "monto": float(cuota.monto),
            "monto_pagado": float(cuota.monto_pagado),
            "saldo": saldo,
            "dias_vencido": dias,
            "estado": cuota.estado,
            "bucket": bucket,
        })

    total_cxc = sum(b["total"] for b in buckets.values())
    total_vencido = sum(b["total"] for k, b in buckets.items() if k != "corriente")

    return {
        "resumen": {
            "total_cxc": round(total_cxc, 2),
            "total_vencido": round(total_vencido, 2),
            "corriente": {**buckets["corriente"], "total": round(buckets["corriente"]["total"], 2)},
            "dias_1_30":  {**buckets["dias_1_30"],  "total": round(buckets["dias_1_30"]["total"], 2)},
            "dias_31_60": {**buckets["dias_31_60"], "total": round(buckets["dias_31_60"]["total"], 2)},
            "dias_61_90": {**buckets["dias_61_90"], "total": round(buckets["dias_61_90"]["total"], 2)},
            "mas_90":     {**buckets["mas_90"],     "total": round(buckets["mas_90"]["total"], 2)},
        },
        "cuotas": cuotas_out,
    }


@router.get("/ventas")
def ventas_con_saldo(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "cajero", "vendedor")),
):
    """Ventas no anuladas, sin crédito asociado, a las que aún les falta cobrar.

    Las ventas con crédito se excluyen: su deuda ya aparece cuota por cuota en /cxc/aging.
    La antigüedad se cuenta desde la fecha de la venta.
    """
    hoy = date.today()
    cobrado = (
        select(Cobro.venta_id, func.coalesce(func.sum(Cobro.monto), 0).label("abonado"))
        .where(Cobro.venta_id.is_not(None))
        .group_by(Cobro.venta_id)
        .subquery()
    )
    con_credito = select(Credito.venta_id).where(Credito.venta_id.is_not(None))
    rows = db.execute(
        select(Venta, Paciente, func.coalesce(cobrado.c.abonado, 0))
        .outerjoin(Paciente, Venta.paciente_id == Paciente.id)
        .outerjoin(cobrado, cobrado.c.venta_id == Venta.id)
        .where(Venta.estado != "anulado", Venta.id.not_in(con_credito))
        .order_by(Venta.fecha)
    ).all()

    buckets = {k: {"total": 0.0, "count": 0} for k in ("dias_0_30", "dias_31_60", "dias_61_90", "mas_90")}
    out = []
    for v, pac, abonado in rows:
        saldo = round(float(v.total) - float(abonado), 2)
        if saldo <= 0.009:
            continue
        dias = (hoy - v.fecha).days
        bucket = ("dias_0_30" if dias <= 30 else "dias_31_60" if dias <= 60
                  else "dias_61_90" if dias <= 90 else "mas_90")
        buckets[bucket]["total"] += saldo
        buckets[bucket]["count"] += 1
        out.append({
            "venta_id": v.id,
            "venta_numero": v.numero,
            "fecha": v.fecha.isoformat(),
            "paciente_id": v.paciente_id,
            "paciente_nombre": f"{pac.apellidos} {pac.nombres}" if pac else "Consumidor final",
            "paciente_telefono": pac.telefono if pac else None,
            "total": float(v.total),
            "abonado": round(float(abonado), 2),
            "saldo": saldo,
            "dias": dias,
            "bucket": bucket,
        })

    return {
        "resumen": {
            "total": round(sum(b["total"] for b in buckets.values()), 2),
            **{k: {"total": round(b["total"], 2), "count": b["count"]} for k, b in buckets.items()},
        },
        "ventas": out,
    }
