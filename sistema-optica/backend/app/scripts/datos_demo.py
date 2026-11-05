"""Carga datos de DEMOSTRACIÓN para probar y mostrar el sistema.

Todos los datos son ficticios: nombres inventados, cédulas que empiezan con
"99" (no corresponden a ninguna provincia) y teléfonos con prefijo "0900".

Los datos se crean llamando a la propia API (en el mismo proceso), así el
stock, los cobros, los saldos de cuentas, los créditos y la numeración quedan
coherentes, igual que si alguien los hubiera cargado desde la pantalla.

Uso (dentro del contenedor):
    python -m app.scripts.seed          # usuarios y configuración base
    python -m app.scripts.datos_demo    # datos de prueba

Para empezar de cero:  docker compose down -v  y volver a levantar.
"""
from __future__ import annotations

import random
import sys
from datetime import date, timedelta
from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.core.db import SessionLocal
from app.core.security import create_access_token
from app.main import app
from app.models.configuracion import Configuracion
from app.models.paciente import Paciente
from app.models.user import User

rnd = random.Random(2026)
HOY = date.today()


def d(dias_atras: int) -> date:
    return HOY - timedelta(days=dias_atras)


# ── Cliente HTTP en proceso ────────────────────────────────────────────────────

class Api:
    def __init__(self) -> None:
        self.c = TestClient(app)
        self.token: str | None = None

    def como(self, user) -> "Api":
        self.token = create_access_token(user.id, user.role.value)
        return self

    def _h(self) -> dict:
        return {"Authorization": f"Bearer {self.token}"}

    def _check(self, r, metodo: str, url: str):
        if r.status_code >= 400:
            raise RuntimeError(f"{metodo} {url} → {r.status_code}: {r.text[:400]}")
        return r.json() if r.content else None

    def get(self, url: str, **params):
        return self._check(self.c.get(f"/api/v1{url}", headers=self._h(), params=params), "GET", url)

    def post(self, url: str, json: dict | None = None, **params):
        return self._check(self.c.post(f"/api/v1{url}", headers=self._h(), json=json, params=params), "POST", url)

    def put(self, url: str, json: dict):
        return self._check(self.c.put(f"/api/v1{url}", headers=self._h(), json=json), "PUT", url)

    def patch(self, url: str, **params):
        return self._check(self.c.patch(f"/api/v1{url}", headers=self._h(), params=params), "PATCH", url)


# ── Datos ficticios ────────────────────────────────────────────────────────────

CONFIG_DEMO = {
    "nombre_optica": "Óptica",
    "direccion_optica": "Av. Principal 123 y Calle Central",
    "telefono_optica": "0900 000 100",
    "telefono_optica_2": "0900 000 200",
}

NOMBRES_USUARIOS = {
    "admin@optica.local": "Administrador",
    "optometrista@optica.local": "Dra. Lucía Andrade",
    "vendedor@optica.local": "Carlos Mena",
    "cajero@optica.local": "Sofía Vega",
}

PROVEEDORES = [
    dict(nombre="Laboratorio Óptico Andes", tipo="laboratorio", ruc="9900000001001",
         telefono="0900 111 001", email="pedidos@lab-andes.demo", ciudad="Quito",
         contacto="Jorge Salazar", direccion="Calle Ficticia 10"),
    dict(nombre="Visiolab Demo S.A.", tipo="laboratorio", ruc="9900000002001",
         telefono="0900 111 002", email="ordenes@visiolab.demo", ciudad="Guayaquil",
         contacto="Paola Ruiz", direccion="Av. Ejemplo 450"),
    dict(nombre="Armazones del Pacífico", tipo="distribuidor", ruc="9900000003001",
         telefono="0900 111 003", email="ventas@armazones.demo", ciudad="Guayaquil",
         contacto="Esteban Mora", direccion="Parque Industrial Demo, bodega 3"),
    dict(nombre="LenteMax Distribuidora", tipo="distribuidor", ruc="9900000004001",
         telefono="0900 111 004", email="info@lentemax.demo", ciudad="Ambato",
         contacto="Andrea Paz", direccion="Calle Muestra 22"),
]

# (código, nombre, categoría, proveedor_idx, costo, venta, stock, mínimo)
PRODUCTOS = [
    ("ARM-001", "Armazón metálico clásico negro", "Monturas / Armaduras", 2, 18, 45, 14, 4),
    ("ARM-002", "Armazón acetato carey", "Monturas / Armaduras", 2, 22, 55, 10, 4),
    ("ARM-003", "Armazón TR90 deportivo azul", "Monturas / Armaduras", 2, 20, 50, 8, 3),
    ("ARM-004", "Armazón infantil flexible rojo", "Monturas / Armaduras", 2, 12, 35, 6, 3),
    ("ARM-005", "Armazón al aire (sin aro) titanio", "Monturas / Armaduras", 2, 35, 85, 5, 2),
    ("ARM-006", "Armazón cat-eye acetato rosa", "Monturas / Armaduras", 2, 24, 60, 2, 3),
    ("ARM-007", "Gafas de sol polarizadas aviador", "Monturas / Armaduras", 2, 25, 65, 7, 2),
    ("LUN-001", "Lunas CR-39 monofocal blancas (par)", "Lentes Oftálmicos", 0, 8, 25, 30, 10),
    ("LUN-002", "Lunas policarbonato antirreflejo (par)", "Lentes Oftálmicos", 0, 18, 45, 20, 8),
    ("LUN-003", "Lunas BlueCut antirreflejo (par)", "Lentes Oftálmicos", 0, 22, 55, 18, 6),
    ("LUN-004", "Lunas fotocromáticas (par)", "Lentes Oftálmicos", 1, 30, 75, 10, 4),
    ("LUN-005", "Lunas bifocales flat-top (par)", "Lentes Oftálmicos", 1, 25, 60, 8, 3),
    ("LUN-006", "Lunas progresivas digitales (par)", "Lentes Oftálmicos", 1, 70, 160, 6, 2),
    ("LUN-007", "Lunas alto índice 1.67 (par)", "Lentes Oftálmicos", 1, 45, 110, 3, 3),
    ("LC-001", "Lentes de contacto mensuales (caja x6)", "Lentes de Contacto", 3, 15, 35, 15, 5),
    ("LC-002", "Lentes de contacto diarios (caja x30)", "Lentes de Contacto", 3, 18, 40, 9, 4),
    ("LC-003", "Lentes de contacto tóricos (caja x6)", "Lentes de Contacto", 3, 28, 60, 1, 2),
    ("SOL-001", "Solución multipropósito 360 ml", "Soluciones y Accesorios LC", 3, 5, 12, 25, 8),
    ("SOL-002", "Gotas lubricantes 15 ml", "Soluciones y Accesorios LC", 3, 3, 8, 30, 10),
    ("ACC-001", "Estuche rígido para lentes", "Estuches y Accesorios", 3, 1.5, 5, 40, 10),
    ("ACC-002", "Paño de microfibra", "Estuches y Accesorios", 3, 0.5, 2, 80, 20),
    ("ACC-003", "Spray limpiador 60 ml", "Estuches y Accesorios", 3, 1.2, 4, 3, 10),
    ("ACC-004", "Cordón sujetador de gafas", "Estuches y Accesorios", 3, 0.8, 3, 35, 10),
    ("SER-001", "Examen visual completo", "Servicios Optométricos", None, 0, 15, 0, 0),
    ("SER-002", "Adaptación de lentes de contacto", "Servicios Optométricos", None, 0, 25, 0, 0),
    ("SER-003", "Ajuste y reparación de armazón", "Servicios Optométricos", None, 0, 5, 0, 0),
]

NOMBRES_F = ["María", "Ana", "Lucía", "Valentina", "Camila", "Gabriela", "Daniela", "Paula",
             "Fernanda", "Isabel", "Carmen", "Rosa", "Elena", "Sofía", "Andrea", "Patricia",
             "Mariana", "Verónica", "Natalia", "Julia"]
NOMBRES_M = ["José", "Luis", "Carlos", "Juan", "Miguel", "Andrés", "Diego", "Pedro", "Jorge",
             "Ricardo", "Fernando", "Pablo", "Mateo", "Sebastián", "Daniel", "Martín", "Óscar",
             "Raúl", "Esteban", "Tomás"]
APELLIDOS = ["Pérez", "López", "García", "Rodríguez", "Martínez", "Sánchez", "Ramírez", "Flores",
             "Castillo", "Vargas", "Romero", "Herrera", "Medina", "Aguilar", "Ortiz", "Delgado",
             "Navarro", "Ríos", "Suárez", "Molina", "Cabrera", "Paredes", "Villacís", "Benítez",
             "Cordero", "Salinas", "Espinoza", "Montalvo", "Jaramillo", "Guerrero"]
OCUPACIONES = ["Estudiante", "Docente", "Contador/a", "Ingeniero/a", "Comerciante", "Chofer",
               "Enfermero/a", "Jubilado/a", "Diseñador/a", "Abogado/a", "Programador/a",
               "Ama de casa", "Arquitecto/a", "Agricultor/a", "Secretario/a"]
CALLES = ["Calle Los Pinos", "Av. Las Américas", "Calle Bolívar", "Av. del Ejército", "Calle Sucre",
          "Calle Olmedo", "Av. Central", "Calle Las Flores", "Calle Rocafuerte", "Av. Solano"]
ORIGENES = ["Recomendación", "Facebook", "Instagram", "TikTok", "Google", "Publicidad", "Otro"]

MOTIVOS = [
    "Visión borrosa de lejos", "Dificultad para leer de cerca", "Dolor de cabeza al leer",
    "Control anual", "Cambio de lentes", "Ardor y ojo seco", "Quiere lentes de contacto",
    "Visión cansada al usar computadora", "Molestia con la luz", "Control post-adaptación",
]
DIAGNOSTICOS = [
    ("Miopía", "Miopía"), ("Hipermetropía", "Hipermetropía"), ("Astigmatismo miópico", "Astigmatismo miópico"),
    ("Presbicia", "Presbicia"), ("Astigmatismo hipermetrópico", "Astigmatismo hipermetrópico"),
    ("Emétrope", "Emétrope"), ("Miopía + astigmatismo", "Miopía"),
]
AV = ["20/20", "20/25", "20/30", "20/40", "20/50", "20/60", "20/80", "20/100", "20/200"]


def _cedula(i: int) -> str:
    # "99" no es un código de provincia válido → nunca coincide con una cédula real
    return f"99{rnd.randint(10_000_000, 99_999_999)}"


def _tel(i: int) -> str:
    return f"0900{200_000 + i:06d}"


def _q(x: float) -> float:
    """Redondea a pasos de 0.25 (como una graduación real)."""
    return round(round(x * 4) / 4, 2)


# ── Paso a paso ────────────────────────────────────────────────────────────────

def main() -> None:
    db = SessionLocal()
    try:
        if db.scalar(select(func.count(Paciente.id))):
            print("Ya hay pacientes cargados. Este script es para una base vacía.")
            print("Para reiniciar la demo:  docker compose down -v && docker compose up -d")
            sys.exit(1)

        users = {u.email: u for u in db.execute(select(User)).scalars().all()}
        faltan = [e for e in NOMBRES_USUARIOS if e not in users]
        if faltan:
            print("Primero ejecuta:  python -m app.scripts.seed")
            sys.exit(1)

        # Nombres de demo para los usuarios
        for email, nombre in NOMBRES_USUARIOS.items():
            users[email].full_name = nombre
            # En la demo se entra con las contraseñas conocidas: no pedir cambio
            users[email].debe_cambiar_password = False
        db.commit()

        def _plano(u: User) -> SimpleNamespace:
            return SimpleNamespace(id=u.id, role=u.role, full_name=u.full_name)

        admin = _plano(users["admin@optica.local"])
        optom = _plano(users["optometrista@optica.local"])
        vendedor = _plano(users["vendedor@optica.local"])
    finally:
        db.close()

    api = Api().como(admin)

    # 1. Configuración del negocio
    print("[1] Configuración")
    for clave, valor in CONFIG_DEMO.items():
        api.put(f"/configuracion/{clave}", {"valor": valor})

    # 2. Cuentas
    print("[2] Cuentas")
    cuentas = {c["nombre"]: c for c in api.get("/cuentas-bancarias")}
    if not any("datáfono" in n.lower() or "maquina" in n.lower() or "máquina" in n.lower() for n in cuentas):
        c = api.post("/cuentas-bancarias", {"nombre": "Máquina de tarjetas (datáfono)", "tipo": "otro"})
        cuentas[c["nombre"]] = c
    cta_efectivo = next(c for c in cuentas.values() if c["tipo"] == "efectivo")["id"]
    cta_banco = next(c for c in cuentas.values() if c["tipo"] == "banco")["id"]
    cta_maquina = next(c for c in cuentas.values() if c["tipo"] == "otro")["id"]
    cta_electronico = next((c for c in cuentas.values() if c["tipo"] == "electronico"), None)
    cta_electronico = cta_electronico["id"] if cta_electronico else cta_banco

    def cuenta_y_metodo() -> tuple[int, str]:
        r = rnd.random()
        if r < 0.50:
            return cta_efectivo, "efectivo"
        if r < 0.75:
            return cta_banco, "transferencia"
        if r < 0.90:
            return cta_maquina, "tarjeta_debito"
        return cta_electronico, "transferencia"

    # 3. Proveedores
    print("[3] Proveedores")
    provs = [api.post("/proveedores", p) for p in PROVEEDORES]

    # 4. Productos
    print("[4] Productos")
    cats = {c["nombre"]: c["id"] for c in api.get("/categorias")}
    productos: dict[str, dict] = {}
    for cod, nom, cat, pidx, costo, venta, stock, minimo in PRODUCTOS:
        productos[cod] = api.post("/productos", {
            "codigo": cod, "nombre": nom, "categoria_id": cats.get(cat),
            "proveedor_id": provs[pidx]["id"] if pidx is not None else None,
            "precio_costo": costo, "precio_venta": venta,
            # +6 porque las ventas de la demo descuentan stock; los de stock bajo quedan bajo a propósito
            "stock_actual": 0 if cod.startswith("SER") else (stock if stock <= minimo else stock + 6),
            "stock_minimo": minimo, "unidad": "servicio" if cod.startswith("SER") else "unidad",
        })

    # 5. Pacientes
    print("[5] Pacientes")
    pacientes: list[dict] = []
    for i in range(60):
        fem = rnd.random() < 0.55
        nombre = rnd.choice(NOMBRES_F if fem else NOMBRES_M)
        if rnd.random() < 0.3:
            nombre += " " + rnd.choice(NOMBRES_F if fem else NOMBRES_M)
        edad = rnd.choice([rnd.randint(7, 17), rnd.randint(18, 39), rnd.randint(40, 75)])
        nac = date(HOY.year - edad, rnd.randint(1, 12), rnd.randint(1, 28))
        if i == 3:   # alguien cumple años hoy → aparece en alertas de cumpleaños
            nac = date(HOY.year - 34, HOY.month, min(HOY.day, 28))
        p = api.post("/pacientes", {
            "cedula": _cedula(i),
            "nombres": nombre,
            "apellidos": f"{rnd.choice(APELLIDOS)} {rnd.choice(APELLIDOS)}",
            "fecha_nacimiento": nac.isoformat(),
            "genero": "Femenino" if fem else "Masculino",
            "telefono": _tel(i),
            "email": f"paciente{i + 1}@correo.demo" if rnd.random() < 0.5 else None,
            "direccion": f"{rnd.choice(CALLES)} {rnd.randint(1, 30)}-{rnd.randint(10, 99)}",
            "ocupacion": "Estudiante" if edad < 18 else rnd.choice(OCUPACIONES),
            "origen": rnd.choice(ORIGENES),
        })
        pacientes.append(p)

    # 6. Consultas (como optometrista) con receta
    print("[6] Consultas")
    api.como(optom)
    consultas: list[tuple[dict, dict, date]] = []   # (consulta, paciente, fecha)
    for i, pac in enumerate(pacientes[:52]):
        fecha = d(rnd.randint(0, 170)) if i > 2 else d(i)  # algunas de hoy/ayer
        edad = HOY.year - int(pac["fecha_nacimiento"][:4])
        diag_od, diag_oi = rnd.choice(DIAGNOSTICOS)
        esf = _q(rnd.uniform(-4.5, 2.5))
        cil = _q(-rnd.uniform(0, 2)) if "stigmat" in diag_od else _q(-rnd.uniform(0, 0.5))
        add = _q(rnd.uniform(1, 2.5)) if edad >= 42 else None
        eje = rnd.choice([0, 10, 15, 90, 170, 180, 175, 5])
        rx = dict(
            rx_od_esf=esf, rx_od_cil=cil, rx_od_eje=eje, rx_od_add=add, rx_od_av="20/20",
            rx_oi_esf=_q(esf + rnd.uniform(-0.5, 0.5)), rx_oi_cil=cil,
            rx_oi_eje=(eje + rnd.choice([0, 5, 10])) % 180, rx_oi_add=add, rx_oi_av="20/20",
        )
        tipo_lente = "Progresivo" if add and rnd.random() < 0.5 else ("Bifocal" if add else "Monofocal")
        body = {
            "fecha": fecha.isoformat(),
            "motivo_consulta": rnd.choice(MOTIVOS),
            "antecedentes": rnd.choice(["Ninguno", "Usa lentes hace 3 años", "Diabetes tipo 2",
                                        "Hipertensión", "Padres con miopía", "Cirugía refractiva previa: no"]),
            "avsc_od": rnd.choice(AV), "avsc_oi": rnd.choice(AV), "avsc_ao": rnd.choice(AV[:5]),
            "avcc_od": "20/20", "avcc_oi": rnd.choice(["20/20", "20/25"]), "avcc_ao": "20/20",
            **rx,
            "k_od_1": round(rnd.uniform(41.5, 44.5), 2), "k_od_2": round(rnd.uniform(42, 45), 2), "k_od_eje": eje,
            "k_oi_1": round(rnd.uniform(41.5, 44.5), 2), "k_oi_2": round(rnd.uniform(42, 45), 2), "k_oi_eje": eje,
            "pio_od": round(rnd.uniform(11, 19), 1), "pio_oi": round(rnd.uniform(11, 19), 1),
            "cover_test_vl": "Orto", "cover_test_vp": rnd.choice(["Orto", "Exoforia leve"]),
            "motilidad": "Normal", "estereopsis": "40\" de arco",
            "seg_anterior_od": "Sin alteraciones", "seg_anterior_oi": "Sin alteraciones",
            "fondo_od": "Papila de bordes nítidos, E/P 0.3", "fondo_oi": "Papila de bordes nítidos, E/P 0.3",
            "test_colores": "Normal (Ishihara)",
            "diag_od": diag_od, "diag_oi": diag_oi,
            "diagnostico": f"{diag_od} en ambos ojos" + (" + presbicia" if add else ""),
            "plan_tratamiento": rnd.choice(["Uso permanente de lentes", "Uso para visión de lejos",
                                            "Uso para lectura y computadora", "Lágrimas artificiales y control"]),
            "observaciones": rnd.choice(["", "Se recomienda filtro de luz azul", "Paciente refiere mejoría",
                                         "Control en 6 meses"]) or None,
            "proximo_control": (fecha + timedelta(days=rnd.choice([180, 365]))).isoformat(),
            "receta_lc": {
                "od_esf": rx["rx_od_esf"], "od_cil": rx["rx_od_cil"], "od_eje": rx["rx_od_eje"],
                "od_add": add, "od_dnp": round(rnd.uniform(29, 33), 1), "od_alt": 18 if add else None,
                "oi_esf": rx["rx_oi_esf"], "oi_cil": rx["rx_oi_cil"], "oi_eje": rx["rx_oi_eje"],
                "oi_add": add, "oi_dnp": round(rnd.uniform(29, 33), 1), "oi_alt": 18 if add else None,
                "tipo_lente": tipo_lente,
                "tipo_armadura": rnd.choice(["Completa", "Semi al aire", "Al aire"]),
            },
        }
        if i % 9 == 0:
            body["receta_cl"] = {
                "od_marca": "Mensual silicona hidrogel", "od_bc": 8.6, "od_diam": 14.2,
                "od_esf": rx["rx_od_esf"], "oi_marca": "Mensual silicona hidrogel",
                "oi_bc": 8.6, "oi_diam": 14.2, "oi_esf": rx["rx_oi_esf"],
            }
        c = api.post(f"/pacientes/{pac['id']}/consultas", body)
        consultas.append((c, pac, fecha))

    # Un par de controles próximos (aparecen en alertas)
    for c, pac, fecha in consultas[5:8]:
        api.put(f"/consultas/{c['id']}", {"proximo_control": (HOY + timedelta(days=rnd.randint(1, 10))).isoformat()})

    # 7. Ventas + cobros + créditos (como vendedor/admin)
    print("[7] Ventas, cobros y créditos")
    api.como(vendedor)
    armazones = [productos[k] for k in productos if k.startswith("ARM") and k != "ARM-007"]
    lunas = [productos[k] for k in productos if k.startswith("LUN")]
    accesorios = [productos[k] for k in ("ACC-001", "ACC-002", "ACC-004", "SOL-001", "SOL-002")]
    ventas: list[dict] = []
    pendientes_credito: list[tuple[dict, date]] = []

    consultas_ordenadas = sorted(consultas, key=lambda t: t[2])
    for n, (c, pac, fecha) in enumerate(consultas_ordenadas[-46:]):
        arm = rnd.choice(armazones)
        lun = rnd.choice(lunas)
        items = [
            {"producto_id": productos["SER-001"]["id"], "descripcion": productos["SER-001"]["nombre"],
             "cantidad": 1, "precio_unitario": productos["SER-001"]["precio_venta"]},
            {"producto_id": arm["id"], "descripcion": arm["nombre"], "cantidad": 1,
             "precio_unitario": arm["precio_venta"], "garantia_meses": 6},
            {"producto_id": lun["id"], "descripcion": lun["nombre"], "cantidad": 1,
             "precio_unitario": lun["precio_venta"], "garantia_meses": 12},
        ]
        if rnd.random() < 0.4:
            acc = rnd.choice(accesorios)
            items.append({"producto_id": acc["id"], "descripcion": acc["nombre"], "cantidad": 1,
                          "precio_unitario": acc["precio_venta"]})
        descuento = rnd.choice([0, 0, 0, 5, 10])
        v = api.post("/ventas", {
            "paciente_id": pac["id"], "fecha": fecha.isoformat(), "descuento": descuento,
            "notas": f"Receta {c['numero']}", "items": items,
        })
        ventas.append(v)

        total = v["total"]
        tipo = n % 8
        cta, metodo = cuenta_y_metodo()
        if tipo in (0, 1, 2, 3, 4):        # pagada completa
            api.post("/cobros", {"venta_id": v["id"], "paciente_id": pac["id"], "cuenta_bancaria_id": cta,
                                 "fecha": fecha.isoformat(), "concepto": f"Cobro venta {v['numero']}",
                                 "monto": total, "metodo_pago": metodo})
        elif tipo == 5:                     # abono parcial, saldo pendiente
            abono = round(total * 0.5, 2)
            api.post("/cobros", {"venta_id": v["id"], "paciente_id": pac["id"], "cuenta_bancaria_id": cta,
                                 "fecha": fecha.isoformat(), "concepto": f"Abono venta {v['numero']}",
                                 "monto": abono, "metodo_pago": metodo})
        elif tipo in (6, 7):                # a crédito
            pendientes_credito.append((v, fecha))

    # Ventas rápidas de mostrador (sin paciente)
    for k in range(26):
        # la mitad en el último mes para que el dashboard del mes actual tenga movimiento
        fecha = d(rnd.randint(0, min(HOY.day - 1, 25))) if k % 2 else d(rnd.randint(0, 150))
        prods = rnd.sample(accesorios + [productos["LC-001"], productos["LC-002"], productos["ARM-007"]], k=rnd.randint(1, 2))
        v = api.post("/ventas", {
            "paciente_id": None, "fecha": fecha.isoformat(),
            "items": [{"producto_id": p["id"], "descripcion": p["nombre"], "cantidad": 1,
                       "precio_unitario": p["precio_venta"]} for p in prods],
        })
        cta, metodo = cuenta_y_metodo()
        api.post("/cobros", {"venta_id": v["id"], "cuenta_bancaria_id": cta, "fecha": fecha.isoformat(),
                             "concepto": f"Cobro venta {v['numero']}", "monto": v["total"], "metodo_pago": metodo})
        ventas.append(v)

    # Créditos
    for v, fecha in pendientes_credito:
        abono = round(v["total"] * rnd.choice([0, 0.2, 0.3]), 2)
        if abono:
            api.post("/cobros", {"venta_id": v["id"], "paciente_id": v["paciente_id"], "cuenta_bancaria_id": cta_efectivo,
                                 "fecha": fecha.isoformat(), "concepto": f"Abono inicial crédito {v['numero']}",
                                 "monto": abono, "metodo_pago": "efectivo"})
        cr = api.post("/creditos", {
            "venta_id": v["id"], "paciente_id": v["paciente_id"], "monto_total": v["total"],
            "abono_inicial": abono, "numero_cuotas": rnd.choice([2, 3, 4]), "periodicidad": "mensual",
            "fecha_inicio": fecha.isoformat(), "notas": "Crédito directo (demo)",
        })
        # Pagar las cuotas ya vencidas (dejando alguna sin pagar para ver alertas)
        for q in cr["cuotas"]:
            venc = date.fromisoformat(q["fecha_vencimiento"])
            if venc <= HOY and rnd.random() < 0.75:
                api.post(f"/creditos/{cr['id']}/cuotas/{q['id']}/pagar", {
                    "monto": float(q["monto"]), "fecha_pago": venc.isoformat(),
                    "cuenta_bancaria_id": cta_efectivo, "metodo_pago": "efectivo",
                })

    # 8. Órdenes de laboratorio
    print("[8] Órdenes de trabajo")
    api.como(admin)
    estados = ["entregado"] * 6 + ["listo", "listo", "en_proceso", "en_proceso", "enviado", "pendiente", "rechazado"]
    ventas_con_pac = [v for v in ventas if v["paciente_id"]][-len(estados):]
    for est, v in zip(estados, ventas_con_pac):
        c, pac, fecha = next(t for t in consultas if t[1]["id"] == v["paciente_id"])
        lab = rnd.choice(provs[:2])
        arm = next((it for it in v["items"] if "Armazón" in it["descripcion"]), None)
        lun = next((it for it in v["items"] if "Lunas" in it["descripcion"]), None)
        rx = c
        desc = (
            f"OD: esf {rx['rx_od_esf']} cil {rx['rx_od_cil']} eje {rx['rx_od_eje']}"
            + (f" add {rx['rx_od_add']}" if rx['rx_od_add'] else "") + "\n"
            f"OI: esf {rx['rx_oi_esf']} cil {rx['rx_oi_cil']} eje {rx['rx_oi_eje']}"
            + (f" add {rx['rx_oi_add']}" if rx['rx_oi_add'] else "") + "\n"
            f"Material: {lun['descripcion'] if lun else 'CR-39'}"
        )
        f_envio = date.fromisoformat(v["fecha"])
        o = api.post("/ordenes", {
            "paciente_id": pac["id"], "consulta_id": c["id"], "venta_id": v["id"],
            "proveedor_id": lab["id"], "lab_proveedor": lab["nombre"], "lab_telefono": lab["telefono"],
            "fecha_envio": f_envio.isoformat(),
            "fecha_entrega_est": (f_envio + timedelta(days=rnd.randint(3, 7))).isoformat(),
            "tipo": "Lentes progresivos" if rx["rx_od_add"] else "Lentes monofocales",
            "descripcion": desc,
            "precio_lab": round((lun["precio_unitario"] if lun else 25) * 0.45, 2),
            "precio_armazon": arm["precio_unitario"] if arm else None,
            "precio_lunas": lun["precio_unitario"] if lun else None,
            "armazon_ref": arm["descripcion"] if arm else None,
            "armazon_color": rnd.choice(["Negro", "Carey", "Azul", "Plateado"]),
            "luna_material": rnd.choice(["CR-39 (Orgánico)", "Policarbonato", "Alto índice 1.60"]),
            "luna_tratamientos": rnd.choice(["Antirreflejo", "BlueCut", "Antirreflejo, UV400", "Fotocromático"]),
            "notas": "Orden de demostración",
        })
        if est != "pendiente":
            api.patch(f"/ordenes/{o['id']}/estado", estado=est)
            if est == "entregado":
                api.put(f"/ordenes/{o['id']}", {"fecha_entrega_real": (f_envio + timedelta(days=5)).isoformat()})

    # 8b. Órdenes SIN venta (para mostrar la pantalla "Órdenes sin venta"):
    #     2 con precio listas para cobrar y 1 sin precio (más antigua).
    sin_facturar = [
        # (días atrás, armazón, lunas, estado)
        (2, 65.0, 85.0, "en_proceso"),
        (5, 45.0, 120.0, "listo"),
        (12, None, None, "enviado"),
    ]
    for (dias, p_arm, p_lun, est), (c, pac, _f) in zip(sin_facturar, consultas[-3:]):
        lab = rnd.choice(provs[:2])
        o = api.post("/ordenes", {
            "paciente_id": pac["id"], "consulta_id": c["id"],
            "proveedor_id": lab["id"], "lab_proveedor": lab["nombre"], "lab_telefono": lab["telefono"],
            "fecha_envio": d(dias).isoformat(),
            "fecha_entrega_est": (d(dias) + timedelta(days=5)).isoformat(),
            "tipo": "Lentes progresivos" if c["rx_od_add"] else "Lentes monofocales",
            "descripcion": (
                f"OD: esf {c['rx_od_esf']} cil {c['rx_od_cil']} eje {c['rx_od_eje']}\n"
                f"OI: esf {c['rx_oi_esf']} cil {c['rx_oi_cil']} eje {c['rx_oi_eje']}"
            ),
            "precio_lab": round((p_lun or 60) * 0.45, 2),
            "precio_armazon": p_arm,
            "precio_lunas": p_lun,
            "precio_venta": (p_arm or 0) + (p_lun or 0) or None,
            "armazon_ref": "Armazón acetato" if p_arm else None,
            "luna_material": "Policarbonato",
            "luna_tratamientos": "Antirreflejo",
            "notas": "Pendiente de venta",
        })
        api.patch(f"/ordenes/{o['id']}/estado", estado=est)

    # 9. Turnos (agenda)
    print("[9] Turnos")
    horas = ["09:00", "09:30", "10:00", "11:00", "11:30", "15:00", "16:00", "17:30"]
    for dias in range(-5, 8):
        fecha = HOY + timedelta(days=dias)
        if fecha.weekday() == 6:
            continue
        for h in rnd.sample(horas, k=rnd.randint(1, 3) if dias else 4):
            pac = rnd.choice(pacientes)
            hh, mm = map(int, h.split(":"))
            fin = f"{hh + (1 if mm == 30 else 0):02d}:{(mm + 30) % 60:02d}"
            if dias < 0:
                estado = rnd.choice(["asistido", "asistido", "asistido", "no_asistio", "cancelado"])
            elif dias == 0:
                estado = rnd.choice(["confirmado", "pendiente", "asistido"])
            else:
                estado = rnd.choice(["pendiente", "confirmado"])
            api.post("/turnos", {
                "paciente_id": pac["id"], "optometrista_id": optom.id, "fecha": fecha.isoformat(),
                "hora_inicio": h, "hora_fin": fin, "estado": estado,
                "motivo": rnd.choice(["Examen visual", "Control", "Entrega de lentes", "Adaptación LC", "Ajuste de armazón"]),
            })

    # 10. Presupuestos (cotizaciones)
    print("[10] Presupuestos")
    for est in ["borrador", "enviado", "aceptado", "rechazado"]:
        pac = rnd.choice(pacientes[52:])
        p = api.post("/presupuestos", {
            "paciente_id": pac["id"], "fecha": d(rnd.randint(0, 20)).isoformat(), "validez_dias": 30,
            "notas": "Presupuesto de demostración",
            "items": [
                {"descripcion": "Armazón acetato carey", "cantidad": 1, "precio_unitario": 55},
                {"descripcion": "Lunas progresivas digitales (par)", "cantidad": 1, "precio_unitario": 160, "descuento": 10},
            ],
        })
        if est != "borrador":
            api.patch(f"/presupuestos/{p['id']}/estado", estado=est)

    # Un presupuesto ya convertido en venta (muestra el flujo completo)
    pac = rnd.choice(pacientes[52:])
    items_pre = [
        {"descripcion": "Armazón metálico liviano", "cantidad": 1, "precio_unitario": 70},
        {"descripcion": "Lunas monofocales policarbonato (par)", "cantidad": 1, "precio_unitario": 60},
    ]
    p = api.post("/presupuestos", {"paciente_id": pac["id"], "fecha": d(6).isoformat(),
                                   "validez_dias": 30, "notas": "Aceptado por el paciente", "items": items_pre})
    api.post("/ventas", {
        "paciente_id": pac["id"], "fecha": d(3).isoformat(), "descuento": 0, "presupuesto_id": p["id"],
        "notas": f"Basado en presupuesto {p['numero']}",
        "items": [{**it, "descuento_pct": 0} for it in items_pre],
    })

    # 11. Cuentas por pagar y egresos
    print("[11] Depósitos, egresos y cuentas por pagar")
    # Depósito del efectivo acumulado al banco (como se hace al cierre de semana)
    saldos = {c["id"]: c["saldo_actual"] for c in api.get("/cuentas-bancarias")}
    deposito = round(saldos[cta_efectivo] * 0.6, 2)
    if deposito > 0:
        api.post("/transferencias", {"fecha": d(15).isoformat(), "cuenta_origen_id": cta_efectivo,
                                     "cuenta_destino_id": cta_banco, "monto": deposito,
                                     "concepto": "Depósito de efectivo al banco"})
    # Liquidación de la máquina de tarjetas al banco (con comisión)
    liq = round(saldos[cta_maquina] * 0.8, 2)
    if liq > 0:
        api.post("/transferencias", {"fecha": d(7).isoformat(), "cuenta_origen_id": cta_maquina,
                                     "cuenta_destino_id": cta_banco, "monto": liq,
                                     "comision": round(liq * 0.045, 2),
                                     "concepto": "Liquidación datáfono"})
    cxps = []
    for prov, monto, dias in [(provs[0], 320.0, 40), (provs[1], 185.5, 20), (provs[2], 540.0, 10)]:
        cxps.append(api.post("/cxp", {
            "proveedor": prov["nombre"], "concepto": "Factura de laboratorio / mercadería (demo)",
            "monto_total": monto, "fecha_emision": d(dias).isoformat(),
            "fecha_vencimiento": (d(dias) + timedelta(days=30)).isoformat(),
            "referencia": f"FAC-001-{rnd.randint(100, 999)}",
        }))
    api.post(f"/cxp/{cxps[0]['id']}/pago", {"monto": 320.0, "cuenta_bancaria_id": cta_banco,
                                            "fecha": d(10).isoformat(), "metodo_pago": "transferencia"})
    api.post(f"/cxp/{cxps[1]['id']}/pago", {"monto": 100.0, "cuenta_bancaria_id": cta_banco,
                                            "fecha": d(5).isoformat(), "metodo_pago": "transferencia"})

    gastos = [
        ("Arriendo", "Arriendo del local", 250, cta_banco, "transferencia"),
        ("Luz / Agua / Internet", "Planilla de luz", 32.4, cta_efectivo, "efectivo"),
        ("Luz / Agua / Internet", "Internet mensual", 28, cta_banco, "transferencia"),
        ("Motorizado", "Envío de órdenes al laboratorio", 6, cta_efectivo, "efectivo"),
        ("Alimentación", "Refrigerios del personal", 12.5, cta_efectivo, "efectivo"),
        ("Compras / Insumos", "Paños y estuches", 40, cta_efectivo, "efectivo"),
        ("Publicidad", "Campaña en redes sociales", 35, cta_banco, "transferencia"),
        ("Mantenimiento", "Calibración de equipo", 45, cta_efectivo, "efectivo"),
        ("Bisel y Lunas", "Biselado de lunas", 18, cta_efectivo, "efectivo"),
    ]
    for mes in range(5, -1, -1):
        for cat, concepto, monto, cta, metodo in gastos:
            if cat != "Arriendo" and rnd.random() < 0.35:
                continue
            fecha = d(mes * 30 + rnd.randint(0, 25)) if mes else d(rnd.randint(0, max(HOY.day - 1, 0)))
            try:
                api.post("/egresos", {"cuenta_bancaria_id": cta, "fecha": fecha.isoformat(), "categoria": cat,
                                      "concepto": concepto, "monto": monto, "metodo_pago": metodo})
            except RuntimeError as e:
                if "Saldo insuficiente" not in str(e):
                    raise

    # 12. Sueldos
    print("[12] Sueldos")
    for u, monto in [(optom, 650), (vendedor, 480)]:
        api.post("/sueldos/config", {"usuario_id": u.id, "monto_mensual": monto, "dia_pago": 30})
    periodo = d(30).strftime("%Y-%m")
    try:
        api.post("/sueldos/pagar", {"usuario_id": vendedor.id, "periodo": HOY.strftime("%Y-%m"), "tipo": "adelanto",
                                    "monto": 100, "cuenta_bancaria_id": cta_efectivo, "fecha": d(3).isoformat(),
                                    "notas": "Adelanto de quincena"})
        api.post("/sueldos/pagar", {"usuario_id": optom.id, "periodo": periodo, "tipo": "sueldo",
                                    "monto": 650, "cuenta_bancaria_id": cta_banco, "fecha": d(5).isoformat()})
    except RuntimeError as e:
        print(f"    (sueldos omitidos: {e})")

    # 13. Notas de pacientes y caja del día
    print("[13] Notas y caja")
    for pac, texto in zip(pacientes[:5], [
        "Prefiere que lo llamen por la tarde.",
        "Interesada en lentes de contacto para deporte.",
        "Avisar cuando lleguen armazones infantiles nuevos.",
        "Cliente frecuente — ofrecer descuento en próxima compra.",
        "Retira los lentes su hija.",
    ]):
        api.post(f"/pacientes/{pac['id']}/notas", {"contenido": texto})
    try:
        api.post("/caja/apertura", {"fecha": HOY.isoformat(), "saldo_apertura": 50, "notas_apertura": "Apertura demo"})
    except RuntimeError:
        pass

    print("\n[OK] Datos de demostración cargados:")
    print(f"     {len(pacientes)} pacientes · {len(consultas)} consultas · {len(ventas)} ventas · "
          f"{len(pendientes_credito)} créditos · {len(PRODUCTOS)} productos · {len(provs)} proveedores")
    print("\nUsuarios para ingresar:")
    print("     admin@optica.local         / Admin2026!")
    print("     optometrista@optica.local  / Optom2026!")
    print("     vendedor@optica.local      / Vende2026!")
    print("     cajero@optica.local        / Caja2026!")


if __name__ == "__main__":
    main()
