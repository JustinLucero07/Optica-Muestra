"""Ventas: totales, stock, anulación y vínculos con orden / presupuesto / crédito."""
from tests.conftest import HOY, item, ok, stock, venta


def test_venta_calcula_total_y_descuenta_stock(admin, paciente, producto):
    p = producto(stock=10)
    v = ok(venta(admin, paciente["id"], [item("Armazón", 50, 2, p["id"]), item("Ajuste", 10)], descuento=5))
    assert float(v["total"]) == 105.0          # 2×50 + 10 − 5
    assert stock(admin, p["id"]) == 8


def test_servicios_no_llevan_stock(admin, paciente, producto):
    s = producto(stock=0, unidad="servicio")
    ok(venta(admin, paciente["id"], [item("Examen visual", 20, 3, s["id"])]))
    assert stock(admin, s["id"]) == 0          # antes quedaba en negativo


def test_anular_devuelve_stock_y_no_se_anula_dos_veces(admin, paciente, producto):
    p = producto(stock=5)
    v = ok(venta(admin, paciente["id"], [item("Armazón", 50, 1, p["id"])]))
    assert stock(admin, p["id"]) == 4
    ok(admin.post(f"/ventas/{v['id']}/anular"))
    assert stock(admin, p["id"]) == 5
    assert admin.post(f"/ventas/{v['id']}/anular").status_code == 409


def test_anular_venta_anula_su_credito(admin, paciente, cuentas):
    v = ok(venta(admin, paciente["id"], [item("Lentes", 90)]))
    cred = ok(admin.post("/creditos", {"venta_id": v["id"], "paciente_id": paciente["id"], "monto_total": 90,
                                       "abono_inicial": 0, "numero_cuotas": 3, "fecha_inicio": HOY}))
    ok(admin.post(f"/ventas/{v['id']}/anular"))
    d = ok(admin.get(f"/creditos/{cred['id']}"))
    assert d["estado"] == "anulado"
    assert {q["estado"] for q in d["cuotas"]} == {"anulado"}
    cuota = d["cuotas"][0]
    r = admin.post(f"/creditos/{cred['id']}/cuotas/{cuota['id']}/pagar",
                   {"monto": 30, "metodo_pago": "efectivo", "cuenta_bancaria_id": cuentas["efectivo"]["id"], "fecha_pago": HOY})
    assert r.status_code == 409                # ya no se le puede cobrar


def test_venta_desde_orden_la_vincula_y_no_se_factura_dos_veces(admin, paciente):
    o = ok(admin.post("/ordenes", {"paciente_id": paciente["id"], "tipo": "Lentes monofocales", "descripcion": "rx",
                                   "lab_proveedor": "Lab", "fecha_envio": HOY, "precio_venta": 120}))
    v = ok(venta(admin, paciente["id"], [item("Lentes", 120)], orden_id=o["id"]))
    assert ok(admin.get(f"/ordenes/{o['id']}"))["venta_id"] == v["id"]
    assert venta(admin, paciente["id"], [item("Lentes", 120)], orden_id=o["id"]).status_code == 409


def test_presupuesto_convertido_no_se_convierte_dos_veces(admin, paciente):
    pre = ok(admin.post("/presupuestos", {"paciente_id": paciente["id"], "fecha": HOY, "items": [
        {"descripcion": "Armazón", "cantidad": 1, "precio_unitario": 60}]}))
    ok(venta(admin, paciente["id"], [item("Armazón", 60)], presupuesto_id=pre["id"]))
    assert ok(admin.get(f"/presupuestos/{pre['id']}"))["estado"] == "convertido"
    assert venta(admin, paciente["id"], [item("Armazón", 60)], presupuesto_id=pre["id"]).status_code == 409
    assert admin.put(f"/presupuestos/{pre['id']}", {"notas": "cambio"}).status_code == 409


def test_venta_sin_items_rechazada(admin, paciente):
    assert venta(admin, paciente["id"], []).status_code == 422


def test_lista_de_ventas_no_se_corta(admin, paciente):
    for _ in range(3):
        ok(venta(admin, paciente["id"], [item("x", 1)]))
    todas = ok(admin.get("/ventas", limit=5000))
    assert len(todas) >= 3 and len(todas) == len({v["id"] for v in todas})
