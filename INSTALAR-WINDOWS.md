# Instalación en Windows — Óptica

Guía completa para instalar el sistema en una PC con Windows 10/11 y dejarlo corriendo automáticamente al encender.

---

## Resumen rápido (checklist)

- [ ] 1. Instalar Git
- [ ] 2. Instalar Docker Desktop
- [ ] 3. Habilitar WSL2 (Windows Subsystem for Linux)
- [ ] 4. Clonar el repositorio
- [ ] 5. Crear el archivo `.env`
- [ ] 6. Construir e iniciar el sistema
- [ ] 7. Ejecutar migraciones de base de datos
- [ ] 8. Crear usuarios y configuración inicial
- [ ] 9. (Opcional) Cargar datos de demostración
- [ ] 10. Configurar inicio automático con Windows

---

## Paso 1 — Instalar Git

1. Descargá Git desde: https://git-scm.com/download/win
2. Instalar con las opciones por defecto.
3. Verificar abriendo **Símbolo del sistema** y ejecutando:
   ```
   git --version
   ```

---

## Paso 2 — Instalar Docker Desktop

1. Descargá Docker Desktop desde: https://www.docker.com/products/docker-desktop/
2. Ejecutar el instalador (requiere reiniciar la PC).
3. Al abrir Docker Desktop por primera vez:
   - Aceptar los términos.
   - En **Settings → General**, marcar ✅ **"Start Docker Desktop when you sign in to Windows"**
   - En **Settings → General**, verificar que **"Use WSL 2 based engine"** esté activado.
4. Esperar a que el ícono de Docker en la barra de tareas quede en verde (puede tardar 1–2 minutos).

---

## Paso 3 — Habilitar WSL2 (si Docker lo pide)

Si Docker Desktop pide instalar WSL2, seguir estos pasos en PowerShell **como Administrador**:

```powershell
wsl --install
```

Reiniciar la PC y luego volver a abrir Docker Desktop.

---

## Paso 4 — Clonar el repositorio

Abrir **Símbolo del sistema** (cmd) o **PowerShell** y ejecutar:

```cmd
cd C:\
mkdir Optica
cd Optica
git clone https://github.com/TU_USUARIO/TU_REPO.git .
```

> Si el repositorio es privado, Git pedirá usuario y token de GitHub.
> El resultado final debe ser que la carpeta `C:\Optica\sistema-optica\` exista.

### Estructura esperada

```
C:\Optica\
└── sistema-optica\
    ├── backend\
    ├── frontend\
    ├── deploy\
    │   ├── docker-compose.prod.yml
    │   ├── nginx.prod.conf
    │   ├── .env.ejemplo
    │   └── iniciar-optica.bat
    └── README.md
```

---

## Paso 5 — Crear el archivo .env

1. Ir a la carpeta `deploy`:
   ```cmd
   cd C:\Optica\sistema-optica\deploy
   ```

2. Copiar el archivo de ejemplo:
   ```cmd
   copy .env.ejemplo .env
   ```

3. Abrir `.env` con el Bloc de notas y editar **al menos** estas variables:

   ```env
   DB_PASSWORD=UnaContrasenaMuySegura2024!
   REDIS_PASSWORD=OtraContrasenaRedis2024!
   JWT_SECRET=PegaAquiUnaCadenaMuyLargaYAleatoria...
   ```

   Para generar un JWT_SECRET seguro, en PowerShell ejecutar:
   ```powershell
   -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
   ```
   Copiar el resultado y pegarlo en `JWT_SECRET=`.

---

## Paso 6 — Construir e iniciar el sistema

En **Símbolo del sistema**, dentro de `C:\Optica\sistema-optica\deploy`:

```cmd
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

La primera vez tarda **5–15 minutos** descargando imágenes y compilando.  
Cuando termina, verificar que los contenedores estén corriendo:

```cmd
docker compose -f docker-compose.prod.yml ps
```

Deberías ver 4 servicios: `db`, `redis`, `backend`, `frontend` — todos en estado `running`.

Abrir el navegador en: **http://localhost**

---

## Paso 7 — Ejecutar migraciones de base de datos

Solo se hace **una vez** al instalar. Ejecutar en cmd desde la carpeta `deploy`:

```cmd
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

Si sale `INFO Running upgrade ... -> head` es correcto.

---

## Paso 8 — Crear usuarios y configuración inicial

```cmd
docker compose -f docker-compose.prod.yml exec backend python -m app.scripts.seed
```

Crea los usuarios iniciales. **Al entrar por primera vez, el sistema le pide a cada uno que cree su propia contraseña** (estas son solo temporales):

| Email | Rol | Contraseña |
|---|---|---|
| admin@optica.local | Administrador | `Admin2026!` |
| optometrista@optica.local | Optometrista | `Optom2026!` |
| vendedor@optica.local | Vendedor | `Vende2026!` |
| cajero@optica.local | Cajero | `Caja2026!` |

---

## Paso 9 — (Opcional) Cargar datos de demostración

Para mostrar o probar el sistema con datos ficticios (pacientes, consultas, ventas,
créditos, órdenes, turnos, inventario, gastos, etc.):

```cmd
docker compose -f docker-compose.prod.yml exec backend python -m app.scripts.datos_demo
```

> Solo funciona con la base vacía. **No** lo ejecutes en la instalación real de un cliente.
> Para borrar todo y volver a empezar: `docker compose -f docker-compose.prod.yml down -v`
> y repetir desde el Paso 6.

Después entrá a **Configuración** y poné el nombre, dirección, teléfonos y logo de la óptica:
esos datos salen automáticamente en los PDF, órdenes, créditos y mensajes de WhatsApp.

---

## Paso 10 — Inicio automático con Windows

El sistema debe arrancar solo cada vez que se enciende la computadora. Son dos configuraciones:

### 10a. Docker Desktop inicia automático (ya configurado en Paso 2)

Docker Desktop arranca con Windows porque marcamos esa opción. Verificar en:
- **Docker Desktop → Settings → General → Start Docker Desktop when you sign in to Windows** ✅

### 10b. Los contenedores arrancan automáticos con Docker

Los contenedores en `docker-compose.prod.yml` tienen `restart: always`, lo que significa que Docker los reinicia automáticamente apenas Docker Desktop esté corriendo.

Sin embargo, hay un pequeño período donde Docker Desktop está iniciando y los contenedores aún no están listos. Para cubrirlo, configurar una tarea en el Programador de tareas:

#### Configurar el Programador de tareas

1. Presionar `Windows + R` → escribir `taskschd.msc` → Enter
2. En el panel derecho, clic en **"Crear tarea básica…"**
3. Completar:
   - **Nombre:** `Óptica`
   - **Descripción:** `Inicia el sistema de gestión óptica`
4. **Desencadenador:** Al iniciar el equipo
5. **Acción:** Iniciar un programa
   - **Programa:** `C:\Optica\sistema-optica\deploy\iniciar-optica.bat`
6. En **"Finalizar"**, marcar ✅ **"Abrir el cuadro de diálogo Propiedades al hacer clic en Finalizar"**
7. En la ventana de Propiedades:
   - Pestaña **General**:
     - Marcar ✅ **"Ejecutar con los privilegios más altos"**
     - En "Configurar para:" elegir **Windows 10** (o Windows 11)
   - Pestaña **Condiciones**:
     - Desmarcar ❌ "Iniciar la tarea solo si el equipo está conectado a la corriente alterna"
8. Clic en **Aceptar**.

#### Probar que funciona

1. Reiniciar la PC.
2. Esperar ~1 minuto después de que cargue el escritorio.
3. Abrir **http://localhost** en el navegador.

---

## Acceso desde otros dispositivos en la red local

Si querés acceder desde el celular o desde otra computadora en la misma red:

1. Obtener la IP de la PC con Windows:
   ```cmd
   ipconfig
   ```
   Buscar `IPv4 Address` bajo el adaptador de red (ej. `192.168.1.100`)

2. Desde cualquier dispositivo en la misma red WiFi, abrir:
   ```
   http://192.168.1.100
   ```

3. Para que siempre tenga la misma IP, configurar una IP fija en el router o en Windows (opcional pero recomendado).

---

## Actualizar el sistema

Cuando haya cambios en el código (git pull):

```cmd
cd C:\Optica\sistema-optica
git pull

cd deploy
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

---

## Comandos útiles de mantenimiento

```cmd
:: Ver logs del backend (errores, etc.)
docker compose -f docker-compose.prod.yml logs backend --tail=50

:: Ver logs del frontend
docker compose -f docker-compose.prod.yml logs frontend --tail=20

:: Reiniciar un servicio específico
docker compose -f docker-compose.prod.yml restart backend

:: Detener todo el sistema
docker compose -f docker-compose.prod.yml down

:: Ver espacio que usa la base de datos
docker volume ls
docker system df
```

---

## Respaldos de la base de datos

**Son automáticos.** El sistema guarda una copia completa al arrancar y luego una vez al día en la carpeta:

```
sistema-optica\deploy\respaldos\optica_AAAA-MM-DD_HHMM.sql.gz
```

Se conservan los últimos 30 días (se cambia con `RESPALDO_DIAS` en `deploy\.env`).

> ⚠️ Esos archivos están en la misma PC. **Una vez por semana cópialos a un USB o a Google Drive/OneDrive**: si se daña el disco, es la única forma de recuperar los datos.

Para ver si se están creando:

```cmd
docker compose -f docker-compose.prod.yml logs respaldos --tail=5
```

Hacer un respaldo manual en este momento:

```cmd
docker compose -f docker-compose.prod.yml exec db pg_dump -U optica optica > respaldo_manual.sql
```

Para restaurar un respaldo (⚠️ reemplaza los datos actuales; hazlo con ayuda técnica):

```cmd
docker compose -f docker-compose.prod.yml exec -T db psql -U optica optica < respaldo_manual.sql
```

Si el respaldo es un `.sql.gz` automático, primero descomprímelo (por ejemplo con 7-Zip) para obtener el `.sql`.

---

## Solución de problemas frecuentes

### "No se puede conectar a http://localhost"
- Verificar que Docker Desktop esté corriendo (ícono verde en la barra de tareas).
- Ejecutar: `docker compose -f docker-compose.prod.yml ps` y verificar que todos estén `running`.
- Ver logs: `docker compose -f docker-compose.prod.yml logs frontend`.

### "Error de migración de base de datos"
- Verificar que el contenedor `db` esté sano: `docker compose -f docker-compose.prod.yml ps db`.
- Reintentar: `docker compose -f docker-compose.prod.yml exec backend alembic upgrade head`.

### Docker Desktop pide actualizar WSL
- Abrir PowerShell como Administrador y ejecutar: `wsl --update`

### Los datos de demostración no se cargan
- El script solo funciona con la base vacía. Si ya hay pacientes, borrá todo con
  `docker compose -f docker-compose.prod.yml down -v` y repetí desde el Paso 6.
- Antes de cargarlos hay que correr el Paso 8 (usuarios y configuración inicial).

---

## Archivos importantes

| Archivo | Descripción |
|---------|-------------|
| `deploy/.env` | Variables de entorno (contraseñas, tokens) — NO subir a Git |
| `deploy/docker-compose.prod.yml` | Configuración de producción |
| `deploy/iniciar-optica.bat` | Script de inicio automático |
| `backend/app/scripts/datos_demo.py` | Carga de datos de demostración |
| `backend/alembic/versions/` | Migraciones de base de datos |
