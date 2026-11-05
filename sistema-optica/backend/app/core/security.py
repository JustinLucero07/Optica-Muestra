from datetime import datetime, timedelta, timezone

import bcrypt
from jose import jwt

from app.core.config import settings


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(subject: str | int, role: str) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(subject),
        "role": role,
        "exp": expire,
        "iat": now,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALG)


def validar_password_nueva(pw: str) -> None:
    """Contraseña mínima razonable para un sistema con datos de pacientes y dinero."""
    from fastapi import HTTPException
    if len(pw or "") < 8:
        raise HTTPException(422, detail="La contraseña debe tener al menos 8 caracteres")
    if pw.isdigit() or pw.isalpha():
        raise HTTPException(422, detail="La contraseña debe combinar letras y números")
