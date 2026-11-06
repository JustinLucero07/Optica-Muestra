# Zona horaria del negocio para TODO el backend ("hoy" en ventas, cobros, caja,
# recordatorios). Se fija aquí, al importar el paquete, para que funcione aunque
# el contenedor o el servidor no tengan la variable TZ (por defecto: Ecuador).
import os as _os
import time as _time

_os.environ["TZ"] = _os.environ.get("TZ") or "America/Guayaquil"
if hasattr(_time, "tzset"):  # no existe en Windows nativo; en Docker/Linux sí
    _time.tzset()
