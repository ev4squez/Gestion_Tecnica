# Gestión Técnica — proyecto Docker

| Servicio | Tecnología | URL |
|---|---|---|
| frontend | React + TS + Vite → nginx | http://localhost:8080 |
| backend | FastAPI + SQLAlchemy | http://localhost:8000/docs |
| db | PostgreSQL 16 (volumen `pgdata`) | interno |

## Arranque
```
cp .env.example .env     # editar claves y JWT_SECRET
make up                  # o: docker compose up -d --build
```
Login inicial: `ADMIN_USER` / `ADMIN_PASSWORD` del `.env`. Detener: `make down`. Borrar datos: `make reset`.

La configuración de correo se administra en **Configuración** (menú lateral, solo administradores): servidor SMTP, puerto, usuario, contraseña, remitente y destinatarios para avisos y reportes. La contraseña SMTP se guarda cifrada en la base de datos y nunca se vuelve a mostrar; déjala vacía al editar para conservarla. El cifrado deriva su clave de `JWT_SECRET`, por lo que al cambiar ese secreto se debe volver a ingresar la contraseña SMTP. La configuración de `.env` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_FROM_NAME`, `SMTP_USE_TLS`, `NOTIFICATION_EMAIL_TO`, `REPORT_EMAIL_TO`, `REPORT_EMAIL_CC`) sigue sirviendo como valor inicial mientras no se guarden ajustes desde la vista. `FRONTEND_URL` debe apuntar a la URL pública de la aplicación. Los cambios de estado y respuestas se envían al correo de la persona solicitante. La pantalla permite guardar los cambios y enviar un correo de prueba.

Los objetivos SLA se cuentan en tiempo corrido desde la creación: Crítica 5 horas, Alta 24 horas, Normal 120 horas y Baja 168 horas. El vencimiento queda fijado al crear el ticket y se recalcula desde su creación si se cambia la prioridad. Los tickets anteriores a esta migración quedan sin SLA para evitar marcarlos retroactivamente como incumplidos. El sistema revisa los vencimientos cada 15 minutos y envía un único aviso al equipo por ticket vencido; requiere SMTP y `NOTIFICATION_EMAIL_TO` o `REPORT_EMAIL_TO`.

El indicador de cumplimiento SLA toma tickets creados en los últimos 30 días, con SLA y estado resuelto o cerrado. Compara la primera marca de resolución del historial con su vencimiento; muestra `—` hasta que haya tickets suficientes para calcularlo.

## Respaldos

`make backup` genera un volcado SQL en `backups/` usando `pg_dump` dentro del contenedor de PostgreSQL. El directorio está excluido de Git; copia los archivos a almacenamiento externo protegido y programa este comando con el planificador del servidor para automatizarlo. Prueba periódicamente la restauración en una base separada:

Para validar una restauración, crea una base de prueba vacía y carga el volcado ahí (no lo restaures sobre la base activa):

```sh
docker compose exec db sh -c 'createdb -U "$POSTGRES_USER" gestion_tecnica_restore'
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d gestion_tecnica_restore' < backups/archivo.sql
```

El volumen `pgdata` por sí solo no es un respaldo.

## Ya implementado
Login JWT + bcrypt, RBAC por rol, máquinas, cambio de estado con historial append-only, downtime automático (FUERA_DE_SERVICIO → OPERATIVA), tickets paginados, auditoría, KPI MTTR (`null` si no hay datos). El portal de solicitantes permite crear una cuenta con correo y contraseña, enviar tickets, ver únicamente sus propias solicitudes y conversar con el equipo técnico en cada ticket. El acceso del equipo técnico conserva su panel de operación y puede responder desde la gestión del ticket.

Las cuentas solicitantes se registran desde la pantalla de inicio de sesión; se asigna el rol `USUARIO`. Para el equipo técnico, el campo de acceso acepta su usuario habitual o correo. Las contraseñas de cuentas nuevas deben tener al menos 8 caracteres.

## Siguiente
1. Completar catálogos, técnicos y repuestos. 2. Revisar los casos pendientes del importador Excel. 3. Portar las vistas restantes del mockup. 4. HTTPS (reverse proxy) antes de producción.

## Migraciones
Alembic aplica las migraciones al iniciar el backend. En bases existentes, el arranque reconoce el esquema previo creado con SQLAlchemy, registra la revisión base y aplica las revisiones posteriores sin borrar registros. Si detecta que faltan tablas o columnas del esquema anterior, se detiene para evitar asumir cómo reparar esa base. Para revisar el estado: `docker compose exec backend alembic current`; historial: `docker compose exec backend alembic history`. Para crear una revisión futura: `docker compose exec backend alembic revision --autogenerate -m "descripción del cambio"`; revisa el archivo generado antes de desplegarlo.
