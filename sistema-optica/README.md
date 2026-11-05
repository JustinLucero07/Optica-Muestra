# Óptica — Sistema de gestión

Sistema completo de gestión para ópticas: pacientes, consultas e historia clínica, recetas,
órdenes de laboratorio, ventas, inventario, créditos, tesorería, turnos, sueldos y reportes.

El nombre, dirección, teléfonos y logo del negocio se configuran desde **Configuración**
dentro del sistema; aparecen automáticamente en PDF, órdenes, créditos y mensajes de WhatsApp.

## Stack

| Capa | Tecnología |
|---|---|
| Backend | FastAPI · SQLAlchemy 2 · Alembic · Postgres 16 · JWT |
| Frontend | React 18 · Vite · TypeScript · Tailwind · shadcn/ui · React Query · Zustand |
| Infra | Docker Compose · Redis · (Nginx en prod) |

## Estructura

```
sistema-optica/
├── backend/         FastAPI + SQLAlchemy + Alembic
├── frontend/        React + Vite + TS  (logo en frontend/public/logo.svg)
├── deploy/          instalación en una PC Windows del cliente (todo en un equipo)
├── nginx/           nginx para docker-compose.prod.yml (servidor / VPS)
├── docs/            guías de uso para el cliente y plantillas de WhatsApp
├── docker-compose.yml        desarrollo y demo
└── docker-compose.prod.yml   servidor Linux / VPS (usa .env.prod)
```

### Documentación de uso

- [`docs/GUIA_POR_PROCESO.md`](docs/GUIA_POR_PROCESO.md): el día a día paso a paso (paciente nuevo → consulta → orden → venta → cobro).
- [`docs/MANUAL_POR_MODULO.md`](docs/MANUAL_POR_MODULO.md): referencia de cada pantalla del sistema.
- [`docs/WHATSAPP_TEMPLATES.md`](docs/WHATSAPP_TEMPLATES.md): plantillas para aprobar en Meta.

### ¿Cuál docker-compose uso?

| Archivo | Para qué |
|---|---|
| `docker-compose.yml` | Desarrollo y demostraciones (recarga en caliente) |
| `deploy/docker-compose.prod.yml` | Instalar en la PC Windows de una óptica ([guía](../INSTALAR-WINDOWS.md)) |
| `docker-compose.prod.yml` | Servidor en la nube / VPS con dominio (copia `.env.prod.example` a `.env.prod`) |

## Arranque rápido con datos de demostración

Requisito: Docker + Docker Compose.

```bash
# 1) Levantar todo
docker compose up -d --build

# 2) Migraciones + usuarios y configuración base
docker compose exec backend alembic upgrade head
docker compose exec backend python -m app.scripts.seed

# 3) (Opcional) Datos de prueba ficticios para mostrar el sistema
docker compose exec backend python -m app.scripts.datos_demo
```

Los datos de demostración incluyen ~60 pacientes, ~50 consultas con receta, ~70 ventas,
cobros, créditos con cuotas, órdenes de laboratorio en distintos estados, turnos de la
semana, presupuestos, proveedores, inventario (con productos en stock bajo), gastos,
cuentas por pagar, sueldos y caja del día. Todo es ficticio: las cédulas empiezan con
`99` y los teléfonos con `0900`.

Para **reiniciar la demo** desde cero:

```bash
docker compose down -v && docker compose up -d
# y repetir el paso 2 y 3
```

Se queda corriendo:
- Frontend: http://localhost:5173
- Backend (FastAPI): http://localhost:8001 — docs en `/docs`
- Postgres: `localhost:5434` (user/pass: `optica` / `optica`, db: `optica`). Si ese puerto está ocupado, crea un `.env` junto a este README con `DB_PORT=5437` (u otro libre)

## Usuarios iniciales

| Email | Rol | Contraseña |
|---|---|---|
| admin@optica.local | admin | `Admin2026!` |
| optometrista@optica.local | optometrista | `Optom2026!` |
| vendedor@optica.local | vendedor | `Vende2026!` |
| cajero@optica.local | cajero | `Caja2026!` |

> En una instalación nueva (`seed`), **cada usuario debe crear su propia contraseña al primer ingreso**.
> Con los datos de demostración (`datos_demo`) ese paso se omite para poder mostrar el sistema con estas claves.
> Cuando el admin crea un usuario o le restablece la contraseña, esa contraseña es temporal y también se pide cambiarla.
> Cada usuario puede cambiar la suya en el menú lateral → **Cambiar contraseña**.

Las acciones sensibles (anular ventas, borrar cobros/egresos, cambios de precio o stock, cierre de caja, usuarios, configuración)
quedan registradas en **Administración → Historial de cambios**.

## Pruebas automáticas

Cubren lo que mueve dinero y stock: ventas, anulaciones, cobros, caja, órdenes, presupuestos, permisos por rol,
contraseñas e historial. Usan una base de datos aparte (`optica_test`) que se recrea en cada corrida:
**no tocan los datos reales**.

```bash
docker compose exec backend pytest
```

Correrlas antes de cada entrega a un cliente.

## Comandos útiles

```bash
# Migraciones
docker compose exec backend alembic upgrade head           # aplicar
docker compose exec backend alembic revision --autogenerate -m "msg"   # generar nueva
docker compose exec backend alembic downgrade -1           # bajar una

# Shell de la BD
docker compose exec db psql -U optica -d optica

# Logs en vivo
docker compose logs -f backend
docker compose logs -f frontend

# Detener todo
docker compose down

# Resetear BD (CUIDADO: borra datos)
docker compose down -v
```

Instalación en una PC Windows del cliente: ver [`../INSTALAR-WINDOWS.md`](../INSTALAR-WINDOWS.md).

## Roles y permisos

| Permiso | Admin | Optometrista | Vendedor | Cajero |
|---|:-:|:-:|:-:|:-:|
Qué ve cada rol. El menú lo oculta **y el backend lo bloquea** (lecturas y escrituras):

| Pantalla | Admin | Optometrista | Vendedor | Cajero |
|---|:-:|:-:|:-:|:-:|
| Inicio con ventas, ganancias y gráficos | ✅ | — | — | — |
| Inicio "mi día" (turnos, lentes listos, pendientes) | — | ✅ | ✅ | ✅ |
| Pacientes, Turnos, Órdenes de laboratorio | ✅ | ✅ | ✅ | ✅ |
| Consultas | ✅ | ✅ | ❌ | ❌ |
| Presupuestos | ✅ | ✅ | ✅ | ❌ |
| Ventas, Órdenes sin venta, Cuentas por cobrar, Créditos | ✅ | ❌ | ✅ | ✅ |
| Cobros | ✅ | ❌ | ✅ | ✅ |
| Egresos, deudas con proveedores, saldos de cuentas | ✅ | ❌ | ❌ | ✅ |
| Inventario | ✅ | ❌ | ✅ | ❌ |
| Reportes, Caja diaria, Proveedores, Sueldos, Usuarios, Configuración, Facturas SRI | ✅ | ❌ | ❌ | ❌ |

Borrar órdenes de laboratorio, cobros o presupuestos: solo admin (y una orden con venta no se puede borrar: primero se anula la venta).
