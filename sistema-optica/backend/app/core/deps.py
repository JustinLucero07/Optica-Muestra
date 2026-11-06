from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.core.security import huella_password
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

_TOKEN_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Sesión inválida o expirada",
    headers={"WWW-Authenticate": "Bearer", "X-Auth-Error": "token_invalid"},
)


# Con contraseña temporal solo se puede ver el perfil y cambiarla
_PERMITIDO_CON_TEMPORAL = ("/api/v1/auth/me", "/api/v1/auth/cambiar-password", "/api/v1/configuracion")


def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALG],
            audience=settings.JWT_AUDIENCE,
            issuer=settings.JWT_ISSUER,
        )
        user_id = int(payload["sub"])
        huella = payload["pv"]
    except (JWTError, ValueError, TypeError, KeyError):
        raise _TOKEN_ERROR

    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise _TOKEN_ERROR
    # La contraseña cambió después de emitir el token → sesión anulada
    if huella != huella_password(user.password_hash):
        raise _TOKEN_ERROR
    if user.debe_cambiar_password and request.url.path not in _PERMITIDO_CON_TEMPORAL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Debes cambiar tu contraseña temporal antes de continuar",
            headers={"X-Auth-Error": "cambiar_password"},
        )
    return user


def require_roles(*roles: str):
    def _checker(user: User = Depends(get_current_user)) -> User:
        if user.role.value not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin permisos")
        return user

    return _checker
