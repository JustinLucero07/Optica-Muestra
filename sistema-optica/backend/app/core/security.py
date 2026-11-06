import hashlib
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import jwt

from app.core.config import settings


# bcrypt solo usa los primeros 72 bytes (y bcrypt>=4.1 lanza error si son más)
_MAX_BYTES = 72


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


# Hash de relleno: si el email no existe igual se calcula un bcrypt, así el tiempo
# de respuesta no delata qué emails están registrados.
_HASH_RELLENO = hash_password("relleno-para-igualar-tiempos")


def verify_password(plain: str, hashed: str | None) -> bool:
    datos = (plain or "").encode()
    if len(datos) > _MAX_BYTES:
        datos = datos[:_MAX_BYTES]
    try:
        return bcrypt.checkpw(datos, (hashed or _HASH_RELLENO).encode()) and hashed is not None
    except ValueError:
        return False


def huella_password(password_hash: str) -> str:
    """Huella corta del hash actual. Va dentro del token: al cambiar o restablecer la
    contraseña, la huella cambia y todos los tokens anteriores dejan de servir."""
    return hashlib.sha256(password_hash.encode()).hexdigest()[:16]


def create_access_token(subject: str | int, role: str, password_hash: str) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(subject),
        "role": role,
        "exp": expire,
        "iat": now,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "pv": huella_password(password_hash),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALG)


def validar_password_nueva(pw: str) -> None:
    """Contraseña mínima razonable para un sistema con datos de pacientes y dinero."""
    from fastapi import HTTPException
    if len(pw or "") < 8:
        raise HTTPException(422, detail="La contraseña debe tener al menos 8 caracteres")
    if len(pw.encode()) > _MAX_BYTES:
        raise HTTPException(422, detail="La contraseña es demasiado larga (máximo 72 caracteres)")
    if pw.isdigit() or pw.isalpha():
        raise HTTPException(422, detail="La contraseña debe combinar letras y números")
    if pw.lower() in _COMUNES:
        raise HTTPException(422, detail="Esa contraseña es demasiado común; elige otra")


_COMUNES = {
    "password1", "password123", "contraseña1", "contrasena1", "contrasena123", "qwerty123",
    "abc12345", "abcd1234", "admin123", "admin1234", "admin2026", "optica123", "optica2026",
    "12345678a", "a12345678", "1q2w3e4r", "asdf1234", "clave123", "usuario1",
}
