import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.core.deps import get_current_user
from app.core.limiter import limiter
from app.core.auditoria import auditar
from app.core.security import create_access_token, hash_password, validar_password_nueva, verify_password
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserPublic, CambioPassword

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

# ── Lockout store ──────────────────────────────────────────────────────────────
# Usa Redis si REDIS_URL está configurado (multi-worker safe).
# Fallback a dict en memoria (solo funciona con un solo worker).

_LOCK_KEY = "login_fails:{}"
_MAX_ATTEMPTS = settings.LOGIN_MAX_ATTEMPTS
_LOCKOUT_TTL = settings.LOGIN_LOCKOUT_SECONDS
_LOCK_MSG = "Demasiados intentos fallidos. Intenta de nuevo en 15 minutos."

_mem_store: dict[str, int] = {}
_redis_client = None
_redis_unavailable = False


def _get_redis():
    global _redis_client, _redis_unavailable
    if _redis_unavailable or not settings.REDIS_URL:
        return None
    if _redis_client is None:
        try:
            import redis

            _redis_client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=2,
            )
            _redis_client.ping()
            logger.info("Auth lockout: Redis activo (%s)", settings.REDIS_URL)
        except Exception as exc:
            logger.warning("Redis no disponible para lockout, usando memoria: %s", exc)
            _redis_unavailable = True
            return None
    return _redis_client


def _check_lockout(email: str) -> None:
    r = _get_redis()
    if r:
        attempts = int(r.get(_LOCK_KEY.format(email)) or 0)
    else:
        attempts = _mem_store.get(email, 0)
    if attempts >= _MAX_ATTEMPTS:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=_LOCK_MSG)


def _record_failure(email: str) -> None:
    r = _get_redis()
    if r:
        key = _LOCK_KEY.format(email)
        r.incr(key)
        r.expire(key, _LOCKOUT_TTL)
    else:
        _mem_store[email] = _mem_store.get(email, 0) + 1


def _clear_attempts(email: str) -> None:
    r = _get_redis()
    if r:
        r.delete(_LOCK_KEY.format(email))
    else:
        _mem_store.pop(email, None)


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
@limiter.limit("20/minute")
def login(request: Request, data: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    _check_lockout(data.email)

    user = db.execute(select(User).where(User.email == data.email)).scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        _record_failure(data.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo. Contacta al administrador.",
        )

    _clear_attempts(data.email)
    token = create_access_token(user.id, user.role.value)
    return TokenResponse(access_token=token, user=UserPublic.model_validate(user))


@router.get("/me", response_model=UserPublic)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.get("/users")
def listar_personal(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Personal activo (solo id, nombre y rol) para selectores como
    "Optometrista" en Turnos o "Referido a" en Pacientes. Cualquier rol puede verlo;
    la gestión completa de usuarios sigue en /usuarios (solo admin)."""
    rows = db.execute(select(User).where(User.is_active.is_(True)).order_by(User.full_name)).scalars().all()
    return [{"id": u.id, "full_name": u.full_name, "role": u.role, "is_active": u.is_active} for u in rows]



@router.post("/cambiar-password", response_model=UserPublic)
@limiter.limit("10/minute")
def cambiar_password(
    request: Request,
    data: CambioPassword,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Cada usuario cambia su propia contraseña (también la temporal que le dio el admin)."""
    if not verify_password(data.actual, user.password_hash):
        raise HTTPException(status_code=400, detail="La contraseña actual no es correcta")
    if data.nueva == data.actual:
        raise HTTPException(status_code=422, detail="La contraseña nueva debe ser distinta de la actual")
    validar_password_nueva(data.nueva)
    user.password_hash = hash_password(data.nueva)
    user.debe_cambiar_password = False
    auditar(db, user, "cambiar_password", "usuario", user.id, user.email)
    db.commit()
    db.refresh(user)
    return user
