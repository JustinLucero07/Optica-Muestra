"""Pruebas automáticas del backend.

Usan una base de datos APARTE (`optica_test`, en el mismo Postgres) que se
recrea en cada corrida con todas las migraciones: nunca tocan los datos reales.

Correr (desde la carpeta sistema-optica):
    docker compose exec backend pytest
"""
import itertools
import os
import uuid
from datetime import date

import pytest

URL_PRUEBAS = os.environ.get("TEST_DATABASE_URL", "postgresql+psycopg://optica:optica@db:5432/optica_test")
# Debe definirse ANTES de importar la app: el engine se crea al importar app.core.db
os.environ["DATABASE_URL"] = URL_PRUEBAS


def _recrear_base():
    import psycopg
    from sqlalchemy.engine import make_url

    url = make_url(URL_PRUEBAS)
    nombre = url.database
    assert nombre and nombre.endswith("_test"), "Por seguridad la base de pruebas debe terminar en _test"
    with psycopg.connect(host=url.host, port=url.port or 5432, user=url.username,
                         password=url.password, dbname="postgres", autocommit=True) as con:
        con.execute(f'DROP DATABASE IF EXISTS "{nombre}" WITH (FORCE)')
        con.execute(f'CREATE DATABASE "{nombre}"')


@pytest.fixture(scope="session", autouse=True)
def base_de_pruebas():
    _recrear_base()
    from alembic import command
    from alembic.config import Config

    cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(os.path.dirname(__file__), "..", "alembic"))
    cfg.set_main_option("sqlalchemy.url", URL_PRUEBAS)
    command.upgrade(cfg, "head")

    from app.core.db import SessionLocal
    from app.scripts.seed import seed_configuraciones, seed_usuarios

    with SessionLocal() as db:
        seed_usuarios(db)
        seed_configuraciones(db)
        db.commit()
    yield


@pytest.fixture(scope="session")
def client(base_de_pruebas):
    from fastapi.testclient import TestClient
    from app.main import app

    # Sin "with": no se arrancan las tareas programadas (recordatorios, etc.)
    return TestClient(app)


@pytest.fixture(scope="session")
def tokens(base_de_pruebas):
    from sqlalchemy import select
    from app.core.db import SessionLocal
    from app.core.security import create_access_token
    from app.models.user import User

    with SessionLocal() as db:
        users = db.execute(select(User)).scalars().all()
        return {u.role.value: (u.id, create_access_token(u.id, u.role.value)) for u in users}


class Api:
    """Cliente con el token de un rol: api.post(...) devuelve la respuesta tal cual."""

    def __init__(self, client, token):
        self.c, self.h = client, {"Authorization": f"Bearer {token}"}

    def get(self, url, **params):
        return self.c.get("/api/v1" + url, params=params, headers=self.h)

    def post(self, url, json=None, **params):
        return self.c.post("/api/v1" + url, json=json, params=params, headers=self.h)

    def put(self, url, json=None):
        return self.c.put("/api/v1" + url, json=json, headers=self.h)

    def delete(self, url):
        return self.c.delete("/api/v1" + url, headers=self.h)


@pytest.fixture(scope="session")
def admin(client, tokens):
    return Api(client, tokens["admin"][1])


@pytest.fixture(scope="session")
def vendedor(client, tokens):
    return Api(client, tokens["vendedor"][1])


@pytest.fixture(scope="session")
def cajero(client, tokens):
    return Api(client, tokens["cajero"][1])


@pytest.fixture(scope="session")
def optometrista(client, tokens):
    return Api(client, tokens["optometrista"][1])


_seq = itertools.count(1)
HOY = date.today().isoformat()


def ok(r, codigo=(200, 201)):
    """Falla con el detalle del backend si la respuesta no es la esperada."""
    codigos = codigo if isinstance(codigo, tuple) else (codigo,)
    assert r.status_code in codigos, f"{r.status_code}: {r.text}"
    return r.json() if r.content else None


@pytest.fixture
def paciente(admin):
    n = next(_seq)
    return ok(admin.post("/pacientes", {"nombres": f"Prueba{n}", "apellidos": "Test", "cedula": f"99{uuid.uuid4().int % 10**8:08d}"}))


@pytest.fixture
def producto(admin):
    def crear(stock=10, unidad="unidad", precio=50.0):
        n = next(_seq)
        return ok(admin.post("/productos", {"codigo": f"T-{uuid.uuid4().hex[:8]}", "nombre": f"Producto prueba {n}",
                                            "precio_costo": 20, "precio_venta": precio, "stock_actual": stock,
                                            "stock_minimo": 0, "unidad": unidad}))
    return crear


@pytest.fixture(scope="session")
def cuentas(admin):
    caja = ok(admin.post("/cuentas-bancarias", {"nombre": "Efectivo pruebas", "tipo": "efectivo", "saldo_inicial": 0}))
    banco = ok(admin.post("/cuentas-bancarias", {"nombre": "Banco pruebas", "tipo": "banco", "saldo_inicial": 0}))
    return {"efectivo": caja, "banco": banco}


def saldo(admin, cuenta_id):
    return float(next(c for c in ok(admin.get("/cuentas-bancarias")) if c["id"] == cuenta_id)["saldo_actual"])


def stock(admin, producto_id):
    return float(next(p for p in ok(admin.get("/productos", limit=5000)) if p["id"] == producto_id)["stock_actual"])


def venta(api, paciente_id, items, **extra):
    return api.post("/ventas", {"paciente_id": paciente_id, "fecha": HOY, "descuento": 0, "items": items, **extra})


def item(descripcion="Ítem", precio=100.0, cantidad=1, producto_id=None):
    return {"producto_id": producto_id, "descripcion": descripcion, "cantidad": cantidad,
            "precio_unitario": precio, "descuento_pct": 0}
