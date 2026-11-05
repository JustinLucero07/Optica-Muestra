"""Cobros: saldos de cuentas, estado de la venta, reglas de método/cuenta y operaciones atómicas."""
from tests.conftest import HOY, item, ok, saldo, venta


def cobrar(api, venta_id, monto, cuenta_id, metodo="efectivo"):
    return api.post("/cobros", {"venta_id": venta_id, "cuenta_bancaria_id": cuenta_id, "fecha": HOY,
                                "concepto": "Cobro prueba", "monto": monto, "metodo_pago": metodo})


def test_cobro_suma_a_la_cuenta_y_marca_venta_cobrada(admin, paciente, cuentas):
    caja = cuentas["efectivo"]["id"]
    antes = saldo(admin, caja)
    v = ok(venta(admin, paciente["id"], [item("Lentes", 100)]))
    ok(cobrar(admin, v["id"], 40, caja))
    assert ok(admin.get(f"/ventas/{v['id']}"))["estado"] == "pendiente"
    ok(cobrar(admin, v["id"], 60, caja))
    assert ok(admin.get(f"/ventas/{v['id']}"))["estado"] == "cobrado"
    assert saldo(admin, caja) == antes + 100


def test_efectivo_no_va_a_cuenta_de_banco(admin, paciente, cuentas):
    banco = cuentas["banco"]["id"]
    antes = saldo(admin, banco)
    v = ok(venta(admin, paciente["id"], [item("Lentes", 50)]))
    r = cobrar(admin, v["id"], 50, banco, "efectivo")
    assert r.status_code == 422
    assert saldo(admin, banco) == antes                 # no se movió nada
    ok(cobrar(admin, v["id"], 50, banco, "transferencia"))
    assert saldo(admin, banco) == antes + 50


def test_eliminar_cobro_revierte_saldo_y_estado(admin, paciente, cuentas):
    caja = cuentas["efectivo"]["id"]
    v = ok(venta(admin, paciente["id"], [item("Lentes", 80)]))
    c = ok(cobrar(admin, v["id"], 80, caja))
    antes = saldo(admin, caja)
    ok(admin.delete(f"/cobros/{c['id']}"), 204)
    assert saldo(admin, caja) == antes - 80
    assert ok(admin.get(f"/ventas/{v['id']}"))["estado"] == "pendiente"


def test_solo_admin_elimina_cobros(admin, cajero, paciente, cuentas):
    v = ok(venta(admin, paciente["id"], [item("Lentes", 10)]))
    c = ok(cobrar(admin, v["id"], 10, cuentas["efectivo"]["id"]))
    assert cajero.delete(f"/cobros/{c['id']}").status_code == 403


def test_registrar_venta_de_orden_es_todo_o_nada(admin, paciente, cuentas):
    o = ok(admin.post("/ordenes", {"paciente_id": paciente["id"], "tipo": "Lentes", "descripcion": "rx", "lab_proveedor": "Lab",
                                   "fecha_envio": HOY, "precio_armazon": 40, "precio_lunas": 60, "precio_venta": 100}))
    banco, caja = cuentas["banco"]["id"], cuentas["efectivo"]["id"]
    n_ventas = len(ok(admin.get("/ventas", limit=5000)))
    # Cobro inválido (efectivo a banco) → no queda ni la venta ni la orden marcada
    r = admin.post(f"/ordenes/{o['id']}/facturar", {"cobro": {"cuenta_bancaria_id": banco, "metodo_pago": "efectivo"}})
    assert r.status_code == 422
    assert ok(admin.get(f"/ordenes/{o['id']}"))["venta_id"] is None
    assert len(ok(admin.get("/ventas", limit=5000))) == n_ventas
    # Cobro válido → venta cobrada, orden vinculada, plata en caja
    antes = saldo(admin, caja)
    res = ok(admin.post(f"/ordenes/{o['id']}/facturar", {"cobro": {"cuenta_bancaria_id": caja, "metodo_pago": "efectivo"}}))
    assert ok(admin.get(f"/ventas/{res['venta_id']}"))["estado"] == "cobrado"
    assert saldo(admin, caja) == antes + 100
    assert admin.post(f"/ordenes/{o['id']}/facturar", {}).status_code == 409


def test_cuentas_por_cobrar_incluye_ventas_a_medio_pagar(admin, paciente, cuentas):
    v = ok(venta(admin, paciente["id"], [item("Lentes", 150)]))
    ok(cobrar(admin, v["id"], 50, cuentas["efectivo"]["id"]))
    fila = next(x for x in ok(admin.get("/cxc/ventas"))["ventas"] if x["venta_id"] == v["id"])
    assert fila["saldo"] == 100
