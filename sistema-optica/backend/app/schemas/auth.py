from datetime import datetime

from pydantic import BaseModel, Field

from app.models.user import UserRole


class LoginRequest(BaseModel):
    email: str = Field(..., max_length=255)  # el formato lo valida el frontend
    password: str = Field(..., max_length=200)


class UserPublic(BaseModel):
    id: int
    email: str
    full_name: str
    role: UserRole
    firma_url: str | None = None
    debe_cambiar_password: bool = False

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class CambioPassword(BaseModel):
    actual: str = Field(..., max_length=200)
    nueva: str = Field(..., max_length=200)


class UserCreate(BaseModel):
    email: str
    full_name: str
    password: str
    role: UserRole


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None
    password: str | None = None
    firma_url: str | None = None


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    firma_url: str | None = None
    debe_cambiar_password: bool = False
    created_at: datetime
    model_config = {"from_attributes": True}
