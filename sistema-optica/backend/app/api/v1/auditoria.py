"""Historial de acciones sensibles (solo admin)."""
from datetime import date, datetime, time

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import require_roles
from app.models.auditoria import Auditoria
from app.models.user import User

router = APIRouter(prefix="/auditoria", tags=["auditoria"])


@router.get("")
def listar(
    desde: date | None = None,
    hasta: date | None = None,
    usuario_id: int | None = None,
    entidad: str | None = None,
    accion: str | None = None,
    q: str | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    filtros = []
    if desde:
        filtros.append(Auditoria.fecha >= datetime.combine(desde, time.min))
    if hasta:
        filtros.append(Auditoria.fecha <= datetime.combine(hasta, time.max))
    if usuario_id:
        filtros.append(Auditoria.usuario_id == usuario_id)
    if entidad:
        filtros.append(Auditoria.entidad == entidad)
    if accion:
        filtros.append(Auditoria.accion == accion)
    if q:
        like = f"%{q}%"
        filtros.append(or_(Auditoria.referencia.ilike(like), Auditoria.detalle.ilike(like), Auditoria.usuario_nombre.ilike(like)))

    total = db.execute(select(func.count()).select_from(Auditoria).where(*filtros)).scalar_one()
    filas = db.execute(
        select(Auditoria).where(*filtros).order_by(Auditoria.fecha.desc(), Auditoria.id.desc()).offset(skip).limit(limit)
    ).scalars().all()
    return {
        "total": total,
        "items": [
            {
                "id": a.id, "fecha": a.fecha.isoformat(timespec="seconds"),
                "usuario_id": a.usuario_id, "usuario_nombre": a.usuario_nombre,
                "accion": a.accion, "entidad": a.entidad, "entidad_id": a.entidad_id,
                "referencia": a.referencia, "detalle": a.detalle,
            }
            for a in filas
        ],
    }
