from app.core.config import settings


def ip_cliente(request) -> str:
    """IP real del cliente. En producción el backend solo es accesible a través de
    nginx, que pone X-Real-IP (y lo sobrescribe, así que no se puede falsificar);
    sin esto todos los usuarios compartirían el límite de la IP de nginx."""
    if settings.es_produccion:
        ip = request.headers.get("x-real-ip")
        if ip:
            return ip.strip()
    return request.client.host if request.client else "desconocido"


try:
    from slowapi import Limiter
    limiter = Limiter(key_func=ip_cliente)
    SLOWAPI_AVAILABLE = True
except ImportError:
    # slowapi no instalado — rate limiting deshabilitado hasta próximo rebuild
    SLOWAPI_AVAILABLE = False

    class _NoopLimiter:
        def limit(self, *_args, **_kwargs):
            def decorator(func):
                return func
            return decorator

    limiter = _NoopLimiter()  # type: ignore[assignment]
