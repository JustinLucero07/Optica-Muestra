"""Permisos por rol, contraseñas e historial de cambios."""
from tests.conftest import HOY, item, ok, venta


def test_cada_rol_lee_solo_lo_suyo(optometrista, vendedor, cajero):
    for url in ("/ventas", "/cobros", "/creditos", "/cxc/aging", "/reportes/dashboard"):
        assert optometrista.get(url).status_code == 403, url
    for url in ("/egresos", "/cxp", "/reportes/dashboard", "/usuarios", "/auditoria"):
        assert vendedor.get(url).status_code == 403, url
    assert cajero.get("/presupuestos").status_code == 403
    assert optometrista.get("/pacientes").status_code == 200


def test_busqueda_no_muestra_ventas_a_quien_no_cobra(optometrista):
    assert ok(optometrista.get("/buscar", q="VEN"))["ventas"] == []


def test_orden_con_venta_no_se_borra(admin, vendedor, paciente):
    o = ok(admin.post("/ordenes", {"paciente_id": paciente["id"], "tipo": "Lentes", "descripcion": "rx",
                                   "lab_proveedor": "Lab", "fecha_envio": HOY, "precio_venta": 10}))
    assert vendedor.delete(f"/ordenes/{o['id']}").status_code == 403
    ok(venta(admin, paciente["id"], [item("x", 10)], orden_id=o["id"]))
    assert admin.delete(f"/ordenes/{o['id']}").status_code == 409


def test_contrasena_temporal_y_cambio(client, admin):
    r = admin.post("/usuarios", {"email": "temp@optica.local", "full_name": "Temporal", "password": "corta", "role": "cajero"})
    assert r.status_code == 422                                   # política mínima
    ok(admin.post("/usuarios", {"email": "temp@optica.local", "full_name": "Temporal", "password": "Temporal123", "role": "cajero"}))
    login = ok(client.post("/api/v1/auth/login", json={"email": "temp@optica.local", "password": "Temporal123"}))
    assert login["user"]["debe_cambiar_password"] is True
    h = {"Authorization": f"Bearer {login['access_token']}"}
    # Con la temporal no puede usar el sistema hasta cambiarla
    assert client.get("/api/v1/pacientes", headers=h).status_code == 403
    assert client.get("/api/v1/auth/me", headers=h).status_code == 200
    assert client.post("/api/v1/auth/cambiar-password", json={"actual": "mal", "nueva": "Nueva2026x"}, headers=h).status_code == 400
    assert client.post("/api/v1/auth/cambiar-password", json={"actual": "Temporal123", "nueva": "12345678"}, headers=h).status_code == 422
    r = ok(client.post("/api/v1/auth/cambiar-password", json={"actual": "Temporal123", "nueva": "Nueva2026x"}, headers=h))
    assert r["user"]["debe_cambiar_password"] is False
    # El token viejo queda anulado; el nuevo funciona
    assert client.get("/api/v1/auth/me", headers=h).status_code == 401
    h2 = {"Authorization": f"Bearer {r['access_token']}"}
    assert client.get("/api/v1/pacientes", headers=h2).status_code == 200
    # Email sin importar mayúsculas
    assert client.post("/api/v1/auth/login", json={"email": " TEMP@optica.local ", "password": "Nueva2026x"}).status_code == 200


def test_login_robusto(client):
    for pw in ("x" * 100, "", "' OR '1'='1"):
        assert client.post("/api/v1/auth/login", json={"email": "admin@optica.local", "password": pw}).status_code == 401
    r = client.post("/api/v1/auth/login", json={"email": "' OR 1=1 --", "password": "' OR '1'='1"})
    assert r.status_code == 401


def test_tokens_falsos_rechazados(client, tokens):
    from jose import jwt
    uid, real = tokens["admin"]
    # firmado con otra clave
    falso = jwt.encode({"sub": str(uid), "aud": "optica-frontend", "iss": "optica-api", "pv": "x"}, "otra-clave", algorithm="HS256")
    # algoritmo "none"
    cab, cuerpo, _ = real.split(".")
    import base64, json
    sin_firma = base64.urlsafe_b64encode(json.dumps({"alg": "none", "typ": "JWT"}).encode()).decode().rstrip("=") + "." + cuerpo + "."
    for t in (falso, sin_firma, "basura", real[:-3] + "abc"):
        assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {t}"}).status_code == 401, t
    assert client.get("/api/v1/pacientes").status_code == 401


def test_acciones_sensibles_quedan_en_el_historial(admin, paciente):
    v = ok(venta(admin, paciente["id"], [item("Lentes", 30)]))
    ok(admin.post(f"/ventas/{v['id']}/anular"))
    hist = ok(admin.get("/auditoria", entidad="venta", accion="anular"))["items"]
    reg = next(h for h in hist if h["referencia"] == v["numero"])
    assert reg["usuario_nombre"] == "Administrador"
