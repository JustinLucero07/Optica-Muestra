# Ideas de usabilidad pendientes — Óptica

Lista de mejoras que **todavía no están en el sistema**. Al implementar una, muévela a la sección «Ya implementado» del final.

Revisado: noviembre 2026.

---

## Pendientes

### 1. Exportar a Excel en todas las tablas
Hoy solo exportan **Ventas** (CSV) y **Reportes** (Excel). Faltan Cobros, Egresos, Créditos, Cuentas por cobrar e Inventario. Útil para el contador: botón «Exportar» que descargue lo filtrado como `.xlsx`.

### 2. Columnas ordenables en todas las tablas
Ya funciona en **Pacientes** y **Ventas**. Falta en Cobros, Órdenes, Presupuestos, Cuentas por cobrar e Inventario (clic en el encabezado → ascendente/descendente).

### 3. Atajos de teclado en formularios
`Esc` ya cierra las ventanas. Faltan:
- `Ctrl+S` guarda el formulario abierto.
- `Ctrl+P` imprime el documento de la vista actual.
- `Enter` en el buscador de pacientes elige el primer resultado.

### 4. Cierre de caja en ticket de 80 mm
La pantalla **Caja diaria** ya calcula cobros − egresos = neto, pero no se puede imprimir en formato de impresora térmica (80 mm) para archivar el cierre del día.

### 5. Cambiar el estado de una orden arrastrándola
La vista de tarjetas (kanban) de **Órdenes de laboratorio** ya agrupa por estado; falta poder arrastrar una tarjeta de «En proceso» a «Listo» en vez de usar el menú.

### 6. Seguimiento después de la entrega
X días después de marcar una orden como «Entregado», sugerir un WhatsApp de seguimiento («¿Cómo le va con sus lentes nuevos?»). Mejora la fidelización y detecta problemas de adaptación.

### 7. Nota para el próximo turno del paciente
Ya existen notas en el perfil del paciente; falta que el optometrista pueda dejar una nota que **aparezca al abrir el siguiente turno** («revisar presión ocular»).

### 8. Precio sugerido de lunas por graduación
En la orden, calcular el precio de las lunas según rangos de la óptica (ej.: hasta −4.00 = precio A, hasta −8.00 = precio B). Evita errores al cotizar.

### 9. Confirmar turnos respondiendo por WhatsApp
Si el paciente responde «SÍ» o «NO» al recordatorio, actualizar el turno solo. Requiere WhatsApp Business API con webhook (servidor accesible desde internet).

---

## Ya implementado

Buscador global (`Ctrl+K`) · alertas en Inicio y campana · botón flotante «+» que abre los formularios · historial de actividad del paciente · modo oscuro · recordatorio automático de cuotas por WhatsApp · vista mensual de turnos · foto del paciente · armazón preferido en el perfil · duplicar ventas y presupuestos · etiqueta del lente · saldo pendiente en la lista de ventas · filtro de créditos con cuotas vencidas · contadores en el menú · buscador de pacientes con cédula y foto · vista kanban de órdenes · tour de bienvenida.
