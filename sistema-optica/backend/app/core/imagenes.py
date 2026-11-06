"""Validación de imágenes que llegan como data-URL (foto de paciente, firma, logo)."""
import re

from fastapi import HTTPException

_DATA_URL = re.compile(r"^data:image/(png|jpe?g|gif|webp|bmp|svg\+xml);base64,[A-Za-z0-9+/=\s]+$")


def validar_imagen(valor: str | None, max_mb: float = 4) -> str | None:
    """Acepta vacío/None o una imagen data:image/...;base64. Rechaza cualquier otra cosa
    (texto, HTML, javascript:, URLs externas) y archivos demasiado grandes."""
    if not valor:
        return None
    if len(valor) > max_mb * 1024 * 1024 * 4 / 3 + 100:
        raise HTTPException(413, detail=f"La imagen es demasiado grande (máximo {max_mb:g} MB)")
    if not _DATA_URL.match(valor):
        raise HTTPException(422, detail="Formato de imagen no válido (usa PNG, JPG o WEBP)")
    return valor
