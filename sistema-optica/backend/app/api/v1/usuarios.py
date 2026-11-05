from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import require_roles
from app.core.auditoria import auditar
from app.core.security import hash_password, validar_password_nueva
from app.models.user import User
from app.schemas.auth import UserCreate, UserUpdate, UserOut

router = APIRouter(prefix="/usuarios", tags=["usuarios"])

@router.get("", response_model=list[UserOut])
def listar(db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    return db.execute(select(User).order_by(User.full_name)).scalars().all()

@router.post("", response_model=UserOut, status_code=201)
def crear(data: UserCreate, db: Session = Depends(get_db), me: User = Depends(require_roles("admin"))):
    if db.execute(select(User).where(User.email == data.email)).scalar_one_or_none():
        raise HTTPException(400, detail="El email ya existe")
    validar_password_nueva(data.password)
    user = User(
        email=data.email,
        full_name=data.full_name,
        role=data.role,
        password_hash=hash_password(data.password),
        is_active=True,
        debe_cambiar_password=True,  # la pone el admin: el usuario la cambia al entrar
    )
    db.add(user)
    db.flush()
    auditar(db, me, "crear", "usuario", user.id, user.email, f"Rol: {data.role.value}")
    db.commit()
    db.refresh(user)
    return user

@router.put("/{uid}", response_model=UserOut)
def actualizar(uid: int, data: UserUpdate, db: Session = Depends(get_db), me: User = Depends(require_roles("admin"))):
    user = db.get(User, uid)
    if not user:
        raise HTTPException(404, detail="Usuario no encontrado")
    detalle = []
    if data.role is not None and data.role != user.role:
        detalle.append(f"Rol: {user.role.value} → {data.role.value}")
    if data.is_active is not None and data.is_active != user.is_active:
        detalle.append("Activado" if data.is_active else "Desactivado")
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.role is not None:
        if uid == me.id:
            raise HTTPException(400, detail="No puedes cambiar tu propio rol")
        user.role = data.role
    if data.is_active is not None:
        if uid == me.id and not data.is_active:
            raise HTTPException(400, detail="No puedes desactivarte a ti mismo")
        user.is_active = data.is_active
    if data.password:
        validar_password_nueva(data.password)
        user.password_hash = hash_password(data.password)
        # Contraseña puesta por el admin = temporal (salvo que se la cambie a sí mismo)
        user.debe_cambiar_password = uid != me.id
        detalle.append("Contraseña restablecida")
    if data.firma_url is not None:
        user.firma_url = data.firma_url or None
    if detalle:
        auditar(db, me, "editar", "usuario", user.id, user.email, "; ".join(detalle))
    db.commit()
    db.refresh(user)
    return user

@router.delete("/{uid}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar(uid: int, db: Session = Depends(get_db), me: User = Depends(require_roles("admin"))):
    if uid == me.id:
        raise HTTPException(400, detail="No puedes eliminarte a ti mismo")
    user = db.get(User, uid)
    if not user:
        raise HTTPException(404)
    email = user.email
    db.delete(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, detail="Este usuario tiene ventas, turnos u otros registros. Desactívalo en lugar de eliminarlo.")
    auditar(db, me, "eliminar", "usuario", uid, email)
    db.commit()
