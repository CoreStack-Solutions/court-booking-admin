# CanchasApp Admin

Aplicación web  para operar una sede deportiva: canchas, horarios, calendario,
clientes, reservas, tarifas y auditoría. Está construida como un monolito
modular con TanStack Start, server functions tipadas, Drizzle ORM y SQLite.

## Estado actual

Implementado en desarrollo:

- Autenticación con sesiones, roles, rate limiting y Argon2.
- CRUD de canchas y horarios, más calendario de disponibilidad.
- Alta y búsqueda de clientes.
- Creación, detalle, edición, cancelación y ciclo de vida de reservas.
- Protección transaccional contra solapamientos e idempotencia de creación.
- Reglas tarifarias, cotización por bloques de 30 minutos y snapshots de precio.
- Dashboard operativo conectado a reservas, ocupación y auditoría.
- Fundaciones de pagos en esquema y validación, sin registrar pagos todavía.

Todavía no están implementados el cobro, caja, quiosco, inventario, reportes
financieros, pruebas end-to-end ni el endurecimiento de producción.

## Desarrollo local

Requisitos: Node.js compatible con las dependencias del proyecto y `pnpm`.

```bash
pnpm install
```

Para preparar una base local:

```bash
cp .env.example .env
# Edit .env and set AUTH_ADMIN_EMAIL and AUTH_ADMIN_PASSWORD (12+ chars)
pnpm db:migrate
pnpm db:seed
```

Después inicia la aplicación:

```bash
pnpm dev
```

La aplicación se sirve en `http://localhost:2000`.

El seed requiere `NODE_ENV=development`, `AUTH_ADMIN_EMAIL` y
`AUTH_ADMIN_PASSWORD` de al menos 12 caracteres. Crea el administrador,
cuatro canchas, horarios y tarifas base.

## Verificación

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm test
pnpm build
```

Las pruebas usan SQLite real para migraciones y concurrencia de reservas.

## Estructura

- `src/routes`: pantallas y loaders de TanStack Router.
- `src/features`: server functions, esquemas y reglas por funcionalidad.
- `src/db`: esquema Drizzle y migraciones versionadas.
- `src/lib`: autenticación, errores y utilidades transversales.
- `docs/plan.md`: alcance, entregas y criterios de aceptación.
- `docs/arch.md`: decisiones arquitectónicas y límites del sistema.

Las server functions validan entradas y permisos en el servidor. La interfaz
puede previsualizar disponibilidad o precios, pero la base de datos vuelve a
validar las invariantes antes de confirmar cualquier cambio.
