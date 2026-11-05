import os
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


def _ahora_local() -> datetime:
    """Hora del negocio (TZ, por defecto Ecuador) aunque el contenedor esté en UTC."""
    return datetime.now(ZoneInfo(os.environ.get("TZ") or "America/Guayaquil")).replace(tzinfo=None)


class Auditoria(Base):
    """Historial de acciones sensibles: quién anuló, borró o cambió qué, y cuándo.

    Se guarda el nombre del usuario además del id para que el registro siga siendo
    legible aunque el usuario se desactive o se borre.
    """
    __tablename__ = "auditoria"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Hora del backend (zona horaria del negocio, TZ), no la de Postgres (UTC)
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False, default=_ahora_local,
                                            server_default=func.now(), index=True)
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    usuario_nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    accion: Mapped[str] = mapped_column(String(40), nullable=False, index=True)    # anular, eliminar, editar, ...
    entidad: Mapped[str] = mapped_column(String(40), nullable=False, index=True)   # venta, cobro, producto, ...
    entidad_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    referencia: Mapped[str | None] = mapped_column(String(60), nullable=True)      # VEN-0012, nombre del producto…
    detalle: Mapped[str | None] = mapped_column(Text, nullable=True)               # qué cambió
