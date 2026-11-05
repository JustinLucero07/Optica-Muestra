"""Caja diaria: apertura, cierre con diferencia y reglas de acceso."""
from datetime import date, timedelta

from tests.conftest import ok


def test_apertura_y_cierre_calcula_diferencia(admin):
    # Fecha propia para no chocar con otras pruebas (la caja es única por día)
    fecha = (date.today() - timedelta(days=400)).isoformat()
    caja = ok(admin.post("/caja/apertura", {"fecha": fecha, "saldo_apertura": 50}))
    assert caja["estado"] == "abierta"
    assert admin.post("/caja/apertura", {"fecha": fecha, "saldo_apertura": 10}).status_code in (400, 409)
    # Sin cobros ese día: lo declarado es todo diferencia
    cerrada = ok(admin.post(f"/caja/{caja['id']}/cierre", {"total_efectivo": 20, "total_tarjeta": 0, "total_transferencia": 0}))
    assert cerrada["estado"] == "cerrada"
    assert float(cerrada["diferencia"]) == 20.0
    assert float(cerrada["saldo_cierre"]) == 70.0      # 50 apertura + 20 declarado
    assert admin.post(f"/caja/{caja['id']}/cierre", {"total_efectivo": 0}).status_code == 400


def test_solo_admin_maneja_la_caja(cajero, vendedor):
    assert cajero.get("/caja/hoy").status_code == 403
    assert vendedor.get("/caja").status_code == 403
