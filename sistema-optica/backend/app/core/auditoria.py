"""Registro de acciones sensibles (ver modelo Auditoria).

Uso dentro de un endpoint, ANTES del commit para que quede en la misma transacción:
    auditar(db, current, "anular", "venta", v.id, v.numero, f"Total {v.total}")
"""
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.auditoria import Auditoria
from app.models.user import User


def auditar(db: Session, usuario: User | None, accion: str, entidad: str,
            entidad_id: int | None = None, referencia: str | None = None, detalle: str | None = None) -> None:
    db.add(Auditoria(
        usuario_id=usuario.id if usuario else None,
        usuario_nombre=usuario.full_name if usuario else "Sistema",
        accion=accion, entidad=entidad, entidad_id=entidad_id,
        referencia=(referencia or None) and str(referencia)[:60],
        detalle=detalle,
    ))


def _fmt(v) -> str:
    if v is None:
        return "—"
    if isinstance(v, (float, Decimal)):
        return f"{float(v):.2f}"
    return str(v.value if hasattr(v, "value") else v)


def cambios(antes: dict, despues: dict, campos: dict[str, str]) -> str | None:
    """Texto "Precio venta: 45.00 → 50.00; Stock mínimo: 2 → 3" con solo lo que cambió.
    campos = {"precio_venta": "Precio venta", ...}"""
    partes = []
    for k, etiqueta in campos.items():
        a, d = _fmt(antes.get(k)), _fmt(despues.get(k))
        if a != d:
            partes.append(f"{etiqueta}: {a} → {d}")
    return "; ".join(partes) or None
