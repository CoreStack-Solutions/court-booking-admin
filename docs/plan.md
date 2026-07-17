# Plan de Implementacion: Court Booking

Sistema para administrar canchas deportivas, reservas, pagos, quiosco, inventario y cierre de caja.

Este plan reemplaza el backlog original por entregas verticales verificables. El objetivo no es completar muchas pantallas, sino entregar un sistema pequeño que pueda reservar, cobrar, auditar y operar sin perder datos ni dinero.

## 1. Objetivos

### Objetivo principal

Permitir que un administrador gestione la operacion diaria de un complejo con cuatro canchas:

- Configurar canchas, horarios y tarifas.
- Crear, consultar, modificar y cancelar reservas.
- Evitar reservas solapadas incluso bajo concurrencia.
- Calcular y congelar el precio de una reserva.
- Registrar pagos de reservas y ventas del quiosco.
- Controlar inventario mediante movimientos auditables.
- Consultar ingresos por fecha y metodo de pago.
- Cerrar caja con trazabilidad.

### Objetivos no funcionales

- No perder ni duplicar reservas o cobros ante reintentos.
- Mantener un historial de cambios relevantes.
- Proteger las rutas administrativas y los datos personales.
- Poder desplegar una version reproducible a staging y produccion.
- Poder restaurar la base de datos a partir de un backup probado.
- Funcionar correctamente en escritorio, tablet y movil.

### Fuera de alcance para la primera version

- App movil nativa.
- Reservas publicas con pago online mediante tarjeta.
- Integracion automatica con Yape o Plin.
- Facturacion electronica.
- Programa de membresias, puntos o promociones complejas.
- Multi-sede.
- Compras a proveedores y cuentas por pagar.
- Impresion fiscal o integracion con una caja registradora.

## 2. Decisiones de dominio

Estas decisiones deben aprobarse antes de escribir las migraciones.

### Tiempo y zona horaria

- Zona horaria operativa: `America/Lima`.
- La base de datos almacena instantes en `timestamptz`.
- La interfaz recibe y muestra hora local.
- Las reservas se modelan como rangos semiabiertos: `[inicio, fin)`.
- La duracion minima es de 30 minutos.
- Las horas de inicio y fin deben alinearse a bloques de 30 minutos.
- El cierre de caja usa la fecha local de Lima, no UTC.

### Estados de cancha

- `active`: disponible para reservar.
- `maintenance`: no se pueden crear reservas nuevas.
- `inactive`: oculta de la operacion.

Cambiar una cancha a mantenimiento no cancela reservas existentes. El sistema debe advertir sobre conflictos y exigir una accion explicita para reprogramar o cancelar.

### Estados de reserva

- `pending`: creada pero pendiente de confirmacion o pago, si aplica.
- `confirmed`: reserva vigente.
- `completed`: horario terminado y operacion finalizada.
- `cancelled`: cancelada antes del inicio.
- `no_show`: el cliente no se presento.

Solo `pending` y `confirmed` bloquean horario. Una reserva cancelada no se elimina.

### Estados de pago

- `pending`.
- `paid`.
- `voided`.
- `refunded`.

Una reserva puede tener como maximo un pago vigente para la primera version. Las anulaciones y devoluciones se registran como operaciones nuevas o cambios auditados, nunca eliminando el pago original.

### Metodos de pago

- `cash` - efectivo.
- `yape`.
- `plin`.
- `bank_transfer` - transferencia.

Yape, Plin y transferencia son metodos manuales. El sistema registra el metodo y la referencia escrita por el operador, pero no afirma que el pago haya sido verificado automaticamente.

### Moneda y dinero

- Moneda: `PEN`.
- Usar `numeric(12,2)` en PostgreSQL, nunca `float`.
- Los precios de una reserva y de una linea de venta se congelan al confirmar la operacion.
- Todos los importes deben ser no negativos salvo ajustes internos expresamente modelados.

### Clientes

Un cliente no es lo mismo que un usuario del sistema. La primera version puede tener clientes con nombre y telefono opcional, sin login. Los usuarios son operadores o administradores.

## 3. Roles y permisos

### Roles

- `admin`: configuracion, usuarios, tarifas, inventario, anulaciones, descuentos y cierres.
- `operator`: reservas, cobros y ventas del quiosco.
- `viewer`: lectura de calendario, reportes e inventario.

### Reglas

- El frontend oculta acciones no permitidas, pero la autorizacion real vive en el backend.
- Cada endpoint administrativo valida autenticacion y permiso.
- Un descuento manual requiere permiso `reservation:override_price`.
- Una anulacion o devolucion requiere permiso especifico y motivo.
- Las acciones financieras guardan usuario, fecha, motivo y valores anterior/nuevo cuando corresponda.

## 4. Modelo de datos minimo

Todas las tablas deben incluir `id`, `created_at`, `updated_at` cuando aplique. Usar UUID o bigint consistentemente; preferir UUID si el sistema tendra integraciones futuras.

### `users`

- `id`
- `name`
- `email` unico, normalizado en minusculas
- `password_hash`
- `role`
- `is_active`
- `last_login_at`

Nunca almacenar contrasenas en texto plano.

### `courts`

- `id`
- `name`
- `color`
- `status`
- `sort_order`

### `customers`

- `id`
- `name`
- `phone`
- `notes`
- `is_active`

### `court_hours`

- `id`
- `court_id`
- `day_of_week`
- `opens_at`
- `closes_at`
- `is_closed`

Si en la primera version el horario es global, puede comenzar como configuracion de sede, pero no duplicar reglas en el frontend.

### `rate_rules`

- `id`
- `court_id` nullable si la tarifa es global
- `name`
- `day_of_week` nullable
- `starts_at`
- `ends_at`
- `price_per_hour`
- `effective_from`
- `effective_to` nullable
- `is_active`

Las reglas no deben solaparse ambiguamente para la misma cancha, dia y periodo de vigencia.

### `reservations`

- `id`
- `court_id`
- `customer_id`
- `starts_at`
- `ends_at`
- `status`
- `base_amount`
- `discount_amount`
- `final_amount`
- `override_reason` nullable
- `created_by`
- `cancelled_by` nullable
- `cancelled_at` nullable
- `cancellation_reason` nullable

La base de datos debe impedir solapamientos para reservas en estados `pending` y `confirmed`. Implementar una restriccion `EXCLUDE USING gist` sobre un rango de tiempo y `court_id`, con una condicion por estado.

### `payments`

- `id`
- `reservation_id` nullable
- `sale_id` nullable
- `amount`
- `method`
- `status`
- `reference` nullable
- `paid_at`
- `received_by`
- `void_reason` nullable

Debe existir exactamente un origen: reserva o venta. Se puede imponer con un `CHECK`.

### `categories`

- `id`
- `name` unico
- `is_active`

### `products`

- `id`
- `category_id`
- `sku` nullable y unico si existe
- `name`
- `sale_price`
- `low_stock_threshold`
- `is_active`

El stock actual no debe ser la unica fuente de verdad.

### `stock_movements`

- `id`
- `product_id`
- `type`: `initial`, `sale`, `adjustment`, `return`, `void`
- `quantity_delta`
- `quantity_after`
- `sale_id` nullable
- `reason`
- `created_by`

La cantidad disponible puede derivarse de movimientos o mantenerse en `products.current_stock` actualizado dentro de la misma transaccion. Si se mantiene, ambas cosas deben cambiar atomica y consistentemente.

### `sales`

- `id`
- `total_amount`
- `status`: `completed`, `voided`, `refunded`
- `sold_at`
- `created_by`

### `sale_items`

- `id`
- `sale_id`
- `product_id`
- `product_name_snapshot`
- `unit_price`
- `quantity`
- `line_total`

Los snapshots evitan que editar un producto reescriba el historial financiero.

### `cash_registers`

- `id`
- `business_date`
- `opened_by`
- `opened_at`
- `opening_amount`
- `closed_by` nullable
- `closed_at` nullable
- `status`: `open`, `closed`
- `closing_note` nullable

### `cash_movements`

- `id`
- `cash_register_id`
- `type`: `sale`, `reservation_payment`, `refund`, `manual_in`, `manual_out`
- `method`
- `amount`
- `source_id` nullable
- `reason` nullable
- `created_by`

### `audit_logs`

- `id`
- `actor_user_id`
- `action`
- `entity_type`
- `entity_id`
- `before_json` nullable
- `after_json` nullable
- `reason` nullable
- `created_at`
- `request_id`

No guardar secretos ni contrasenas en la auditoria.

## 5. Arquitectura tecnica

### Backend

- Node.js con TypeScript.
- Framework HTTP ya elegido por el equipo; no mezclar estilos.
- PostgreSQL como fuente de verdad.
- Migraciones versionadas y ejecutadas en CI/deploy.
- Validacion de request con un esquema centralizado.
- Capas simples: rutas, validacion, servicio de dominio, repositorio/queries.
- Errores con formato uniforme y `request_id`.

### Frontend

- React con TypeScript.
- Router con rutas protegidas por permiso.
- Cliente HTTP centralizado.
- Estado remoto separado del estado local del carrito y formularios.
- Formularios con validacion compartida con el contrato de API cuando sea viable.
- Fechas y dinero formateados en un unico modulo.

### Infraestructura

- Docker Compose para desarrollo local.
- PostgreSQL separado del proceso de aplicacion.
- Nginx sirviendo frontend y haciendo proxy al backend.
- HTTPS con renovacion automatica.
- Variables de entorno fuera del repositorio.
- Staging separado de produccion.

## 6. Contratos de API

Todos los endpoints deben documentarse con OpenAPI o equivalente. El formato de error minimo:

```json
{
  "error": {
    "code": "RESERVATION_CONFLICT",
    "message": "La cancha ya esta reservada en ese horario",
    "details": {},
    "requestId": "..."
  }
}
```

### Autenticacion

- `POST /auth/login`
- `POST /auth/refresh` si se usan refresh tokens
- `POST /auth/logout`
- `GET /me`
- `POST /users` admin
- `GET /users` admin
- `PATCH /users/:id` admin

El access token debe tener expiracion corta. El almacenamiento del token en frontend debe seguir una decision documentada; evitar exponer refresh tokens a JavaScript si se usan cookies httpOnly.

### Canchas y configuracion

- `GET /courts`
- `POST /courts` admin
- `PATCH /courts/:id` admin
- `GET /courts/:id/availability`
- `GET /court-hours`
- `PUT /court-hours` admin
- `GET /rate-rules`
- `POST /rate-rules` admin
- `PATCH /rate-rules/:id` admin
- `POST /rate-rules/quote`

`quote` calcula una cotizacion, pero el backend vuelve a calcular el precio al crear o confirmar la reserva. El frontend nunca es autoridad financiera.

### Clientes y reservas

- `GET /customers?search=`
- `POST /customers`
- `PATCH /customers/:id`
- `GET /reservations?from=&to=&courtId=&status=`
- `GET /reservations/:id`
- `POST /reservations`
- `PATCH /reservations/:id`
- `POST /reservations/:id/confirm`
- `POST /reservations/:id/cancel`
- `POST /reservations/:id/complete`
- `POST /reservations/:id/no-show`

Crear reserva debe aceptar una clave de idempotencia. La respuesta de conflicto debe ser `409 Conflict`, no un `500` generico.

### Ventas e inventario

- `GET /categories`
- `POST /categories` admin
- `PATCH /categories/:id` admin
- `GET /products?active=true`
- `POST /products` admin
- `PATCH /products/:id` admin
- `POST /products/:id/stock-adjustments` admin
- `GET /stock-movements` admin/viewer
- `POST /sales`
- `GET /sales?from=&to=&status=`
- `GET /sales/:id`
- `POST /sales/:id/void` admin

`POST /sales` debe recibir lineas, metodo de pago, referencia opcional e idempotency key. Producto, precio y stock se validan en backend.

### Caja y reportes

- `POST /cash-registers/open`
- `GET /cash-registers/current`
- `GET /cash-registers/:id/summary`
- `POST /cash-registers/:id/close`
- `GET /reports/revenue?businessDate=`
- `GET /reports/revenue?from=&to=&groupBy=method`
- `GET /audit-logs?entityType=&entityId=` admin

El reporte debe distinguir ventas completadas, anulaciones y devoluciones. Una suma simple de tablas no es suficiente.

## 7. Reglas transaccionales criticas

### Crear reserva

1. Validar identidad, permisos y payload.
2. Resolver la fecha/hora en `America/Lima`.
3. Validar horario operativo y estado de cancha.
4. Calcular cotizacion usando reglas vigentes.
5. Iniciar transaccion.
6. Insertar reserva.
7. Dejar que PostgreSQL rechace solapamientos mediante exclusion constraint.
8. Registrar auditoria.
9. Confirmar transaccion.

No implementar anti-cruces solo con un `SELECT` previo.

### Confirmar pago de reserva

1. Bloquear la reserva con `FOR UPDATE`.
2. Verificar que el estado permita confirmacion.
3. Verificar que el monto coincida con el monto vigente.
4. Crear pago y movimiento de caja.
5. Cambiar reserva a `confirmed`.
6. Registrar auditoria.
7. Confirmar transaccion.

### Registrar venta

1. Validar lineas no vacias y cantidades enteras positivas.
2. Bloquear productos involucrados con `FOR UPDATE` en orden estable.
3. Verificar stock suficiente.
4. Copiar nombres y precios a `sale_items`.
5. Crear venta y pago.
6. Crear movimientos de stock.
7. Actualizar stock actual si se usa esa columna.
8. Crear movimiento de caja.
9. Registrar auditoria.
10. Confirmar transaccion.

Si se recibe la misma idempotency key, devolver la operacion original en vez de crear otra.

### Anular venta o pago

- Nunca borrar registros financieros.
- Revertir stock en una operacion compensatoria.
- Crear movimiento de caja de tipo devolucion/anulacion.
- Exigir permiso y motivo.
- Mantener el total original visible en el historial.

## 8. Plan de entregas

Los sprints son objetivos de entrega, no excusas para dividir trabajo en silos. Cada sprint termina con una demostracion funcional y criterios de aceptacion ejecutados.

### Sprint 0: Descubrimiento y contrato

Duracion sugerida: 3 a 5 dias.

#### Tareas

- Confirmar reglas de horario, duracion minima, cancelaciones y no-show.
- Confirmar si se cobra reserva completa o adelanto.
- Confirmar si puede haber mas de una sede en el futuro.
- Aprobar roles y permisos.
- Aprobar metodos de pago y significado de “verificado”.
- Aprobar zona horaria y moneda.
- Dibujar estados de reserva, pago, venta y caja.
- Crear diagrama de entidades y migraciones iniciales.
- Definir OpenAPI y formato de errores.
- Crear repositorio, convenciones, ramas y reglas de pull request.
- Configurar linter, formatter, TypeScript estricto y hooks de calidad.

#### Salida

- Documento de decisiones.
- Modelo de datos revisado.
- Contrato API inicial.
- Wireframes de flujo de reserva y venta.
- Riesgos conocidos y decisiones pendientes.

### Sprint 1: Base tecnica, login y despliegue de staging

#### Tareas Dev A

- Crear estructura base del frontend.
- Crear layout, navegacion y manejo de sesion.
- Crear pantalla de login y estados de carga/error.
- Crear componentes base de formulario, tabla, modal y alerta.

#### Tareas Dev B

- Crear backend base y health check.
- Configurar PostgreSQL local y migraciones.
- Crear tablas de usuarios, auditoria y configuracion.
- Implementar hash de contrasenas y login.
- Implementar middleware de autenticacion y autorizacion.
- Crear manejo uniforme de errores y request id.

#### Tareas compartidas

- Docker Compose local.
- Seed de usuario admin solo para desarrollo.
- Pipeline de lint, typecheck, tests y build.
- Ambiente staging con secretos independientes.

#### Criterios de aceptacion

- Un usuario puede iniciar sesion y cerrar sesion.
- Una ruta protegida rechaza requests sin autenticacion.
- Un operador no puede ejecutar una accion de admin.
- `GET /health` verifica aplicacion y base de datos.
- El mismo commit puede levantar localmente con instrucciones documentadas.

### Sprint 2: Canchas, horarios y calendario de lectura

#### Tareas Dev A

- Crear shell de navegacion y selector de fecha.
- Implementar estados visuales de cancha.
- Crear calendario responsive con estados de carga, vacio y error.

#### Tareas Dev B

- Crear tablas y endpoints de canchas.
- Crear configuracion de horarios.
- Crear endpoints de disponibilidad.
- Crear pruebas de permisos y validacion.

#### Criterios de aceptacion

- Admin puede crear y editar cuatro canchas.
- Operador puede ver solo canchas activas en el calendario.
- Una cancha en mantenimiento se identifica claramente.
- La disponibilidad se consulta por rango, no descargando toda la historia.
- La grilla muestra bloques de 30 minutos sin inventar datos en frontend.

### Sprint 3: Reservas end-to-end

#### Tareas Dev A

- Modal de nueva reserva.
- Busqueda/alta de cliente.
- Edicion de reserva con validaciones.
- Acciones de confirmar, cancelar, completar y no-show.
- Vista de detalle de reserva.

#### Tareas Dev B

- Tablas de clientes y reservas.
- Restriccion PostgreSQL contra solapamientos.
- Endpoints de ciclo de vida.
- Idempotencia para creacion.
- Auditoria de cambios.
- Pruebas de concurrencia.

#### Criterios de aceptacion

- Se crea una reserva valida desde el calendario.
- Dos requests simultaneos para el mismo rango no producen dos reservas.
- Una reserva en mantenimiento no puede crearse.
- Cancelar no elimina el registro.
- El usuario ve un error accionable ante conflicto `409`.
- La reserva conserva quien la creo y sus cambios relevantes.

### Sprint 4: Tarifas y cobro de reservas

#### Tareas Dev A

- Mostrar cotizacion antes de confirmar.
- Mostrar precio base, descuento y total.
- Modal de pago con metodo y referencia.
- Estados de pago y confirmacion visual.

#### Tareas Dev B

- Tablas y CRUD de reglas tarifarias.
- Motor de cotizacion por segmentos de 30 minutos.
- Soporte para cambio de tarifa dentro del rango.
- Congelamiento del precio al confirmar.
- Endpoint transaccional de pago.

#### Criterios de aceptacion

- Una reserva que cruza dia/noche calcula cada segmento correctamente.
- Editar una tarifa no cambia reservas ya confirmadas.
- El backend recalcula el precio y no confia en el total del frontend.
- Un pago repetido con la misma idempotency key no duplica ingresos.
- Todo descuento requiere permiso y motivo.

### Sprint 5: Quiosco e inventario

#### Tareas Dev A

- CRUD de categorias y productos.
- Panel de inventario con stock actual y umbral.
- Grilla POS tactil.
- Carrito con cantidades, subtotal y total.
- Alertas de stock bajo.
- Modal de pago y comprobante interno de venta.

#### Tareas Dev B

- Tablas de categorias, productos, ventas, lineas y movimientos.
- Endpoints de catalogo.
- Ajustes de stock con motivo.
- Endpoint transaccional de venta.
- Anulacion de venta y reversa de stock.
- Pruebas de concurrencia de stock.

#### Criterios de aceptacion

- Una venta guarda lineas, cantidades, precios y snapshots.
- Nunca se permite vender stock negativo.
- Dos ventas concurrentes no consumen mas stock del disponible.
- Reintentar una venta no duplica venta ni descuento de stock.
- Anular una venta deja trazabilidad y revierte el stock correctamente.

### Sprint 6: Caja, reportes y auditoria operativa

#### Tareas Dev A

- Pantalla de apertura y cierre de caja.
- Resumen por metodo de pago.
- Filtros por fecha y origen.
- Detalle de ventas, reservas, anulaciones y devoluciones.
- Exportacion CSV si es necesaria para operacion.

#### Tareas Dev B

- Modelo de caja y movimientos.
- Apertura unica por fecha/sede.
- Calculo de totales desde movimientos validos.
- Reglas para cierre y reapertura administrativa.
- Endpoints de reportes y auditoria.

#### Criterios de aceptacion

- No se puede cerrar una caja inexistente o ya cerrada.
- El reporte distingue quiosco y alquileres.
- La fecha usa hora local de Lima.
- Anulaciones no cuentan como ingresos netos.
- El cierre guarda usuario, hora, observacion y totales.
- Se puede rastrear cada total hasta sus operaciones fuente.

### Sprint 7: Endurecimiento y salida a produccion

#### Tareas

- Pruebas end-to-end de flujos criticos.
- Pruebas de carga basicas de calendario y reservas.
- Revisión de permisos por endpoint.
- Validacion de entradas, limites y rate limiting en login.
- Headers de seguridad, CORS restringido y cookies seguras si aplica.
- Backups automaticos y restauracion en ambiente temporal.
- Logs estructurados y monitoreo de errores.
- Health checks y reinicio controlado.
- Migraciones de produccion probadas en staging.
- Nginx, HTTPS, dominio y renovacion de certificado.
- Runbook de despliegue, rollback y recuperacion.
- Capacitacion del operador y manual breve.

#### Go-live solo si

- Las pruebas criticas pasan.
- Se probo restaurar un backup.
- Existe un usuario admin recuperable sin tocar la base manualmente.
- Hay forma de inspeccionar errores con request id.
- El rollback esta escrito y probado.
- Los operadores conocen como abrir/cerrar caja y anular operaciones.

## 9. Asignacion de trabajo

### Dev A: experiencia operativa

- Frontend de autenticacion, calendario, reservas, POS, inventario y caja.
- Integracion con contratos API.
- Validaciones de formulario y estados de interfaz.
- Pruebas de componentes y flujos de usuario.

Dev A no debe duplicar reglas de precios, permisos o stock en frontend. Puede mostrar una previsualizacion, pero el backend decide.

### Dev B: dominio, datos y operacion

- Migraciones, constraints e indices.
- Backend de autenticacion, canchas, reservas, tarifas, ventas y caja.
- Servicios transaccionales e idempotencia.
- Auditoria, pruebas de integracion y concurrencia.
- CI/CD, staging, backups y despliegue.

### Responsabilidades compartidas

- Contratos API antes de integrar.
- Revisión cruzada de pull requests.
- Decisiones de dominio.
- Pruebas end-to-end.
- Documentacion de operacion.

Cada tarea debe tener un unico responsable y un revisor distinto. “Compartido” no significa “de nadie”.

## 10. Estrategia de pruebas

### Unitarias

- Segmentacion tarifaria.
- Validacion de rangos.
- Transiciones de estados.
- Calculo de totales, descuentos y redondeos.
- Formateo de dinero y fechas.

### Integracion

- Permisos por rol.
- Migraciones en una base limpia.
- Creacion y cancelacion de reservas.
- Restriccion de solapamiento.
- Venta con stock suficiente e insuficiente.
- Anulacion y reversa.
- Apertura y cierre de caja.

### Concurrencia

- Dos reservas para misma cancha y rango.
- Dos ventas consumiendo la ultima unidad.
- Doble click o reintento de pago.
- Dos cierres de caja simultaneos.

### End-to-end

1. Login de operador.
2. Crear cliente.
3. Crear reserva.
4. Ver cotizacion.
5. Registrar pago.
6. Consultar reserva confirmada.
7. Registrar venta de quiosco.
8. Cerrar caja.
9. Verificar reporte y auditoria.

### Casos de borde obligatorios

- Reserva que termina exactamente cuando empieza otra: permitida.
- Reserva que comparte solo el inicio: rechazada.
- Cruce de medianoche: rechazado inicialmente o soportado de forma explicita; no dejarlo ambiguo.
- Tarifa sin regla aplicable.
- Producto inactivo con carrito viejo.
- Precio cambiado mientras el POS esta abierto.
- Stock ajustado mientras otra venta esta en curso.
- Usuario desactivado con sesion existente.
- Caja cerrada con request repetido.
- Fecha local cercana a medianoche UTC.

## 11. Indices y restricciones

- Indice en `reservations(court_id, starts_at, ends_at)`.
- Restriccion de exclusion para rangos bloqueantes.
- Indice en `reservations(status, starts_at)`.
- Indice en `payments(paid_at, method, status)`.
- Indice en `sales(sold_at, status)`.
- Indice en `stock_movements(product_id, created_at)`.
- Unicidad de email de usuario sin distinguir mayusculas.
- Unicidad de nombre de categoria activa o regla equivalente.
- `CHECK` para montos y cantidades positivas.
- `CHECK` para estados permitidos.
- Foreign keys con politica explicita; no usar cascadas destructivas sobre historial financiero.

## 12. Seguridad

- Hash de contrasenas con Argon2id o bcrypt configurado adecuadamente.
- No registrar tokens, contrasenas ni datos sensibles.
- Rate limit para login.
- Mensajes de login que no revelen si el email existe.
- Validacion de payload, query params y path params.
- CORS limitado al dominio conocido.
- HTTPS obligatorio en produccion.
- Cookies `httpOnly`, `secure` y `sameSite` si se usa autenticacion por cookie.
- Rotacion de secretos documentada.
- Principio de minimo privilegio para la base de datos.
- Backups cifrados y acceso restringido.
- Auditoria de operaciones financieras y administrativas.

## 13. Operacion y DevOps

### Ambientes

- `local`: datos descartables y seed de desarrollo.
- `staging`: replica de configuracion de produccion con datos ficticios.
- `production`: datos reales, secretos separados y acceso limitado.

### Pipeline

En cada pull request:

- Instalar dependencias de forma reproducible.
- Ejecutar lint.
- Ejecutar typecheck.
- Ejecutar pruebas unitarias.
- Ejecutar pruebas de integracion con PostgreSQL temporal.
- Construir backend y frontend.

En despliegue:

- Crear backup o verificar backup reciente.
- Ejecutar migraciones compatibles.
- Desplegar version.
- Ejecutar health check.
- Verificar endpoint critico.
- Mantener rollback a la version anterior.

### Observabilidad

- Logs JSON con `request_id`, usuario, endpoint, estado y duracion.
- Error tracking.
- Metricas de errores 5xx, latencia, logins fallidos y conflictos de reserva.
- Alertas de disco, memoria, backup fallido y certificado por vencer.
- Endpoint `/health` sin filtrar secretos.

### Backup

- Backup diario automatico.
- Retencion definida por el negocio.
- Copia fuera del VPS.
- Prueba de restauracion al menos mensual.
- Runbook con pasos y tiempos esperados.

## 14. Definition of Ready

Una tarea puede iniciar solo si:

- Tiene objetivo y criterios de aceptacion.
- Se conocen sus dependencias.
- El contrato de API o modelo de datos esta definido.
- Tiene responsable y revisor.
- Se conocen permisos, errores y estados vacios.
- Tiene una estrategia de pruebas.

## 15. Definition of Done

Una tarea esta terminada solo si:

- El codigo esta integrado y revisado.
- Pasa lint, typecheck y pruebas relevantes.
- Tiene migracion reversible o politica de rollback documentada.
- Valida permisos en backend.
- Maneja carga, error, vacio y reintento cuando aplique.
- Tiene auditoria si cambia dinero, stock, permisos o estados.
- La interfaz funciona en movil y escritorio cuando corresponda.
- La documentacion de API/operacion fue actualizada.
- Se demostro el criterio de aceptacion en staging.

## 16. Riesgos y mitigaciones

### Doble reserva

Riesgo: dos operadores crean el mismo horario.

Mitigacion: exclusion constraint en PostgreSQL, transaccion y prueba concurrente.

### Doble cobro

Riesgo: doble click, timeout o reintento del navegador.

Mitigacion: idempotency key, indice unico y respuesta de operacion original.

### Stock negativo

Riesgo: ventas simultaneas o carrito desactualizado.

Mitigacion: bloqueo de filas, validacion en transaccion y movimientos auditables.

### Reportes incorrectos

Riesgo: sumar filas anuladas o mezclar fechas UTC/locales.

Mitigacion: movimientos de caja, estados explicitos, zona horaria unica y casos de prueba en medianoche.

### Cambios tarifarios retroactivos

Riesgo: reservas historicas cambian de importe.

Mitigacion: snapshots de importe y reglas de vigencia.

### Operacion sin acceso

Riesgo: perdida de contrasena o usuario desactivado.

Mitigacion: procedimiento seguro de recuperacion y dos cuentas admin controladas.

### VPS como punto unico de fallo

Riesgo: servidor caido o disco perdido.

Mitigacion: backups fuera del servidor, restauracion probada y documentacion de reconstruccion.

## 17. Preguntas que deben resolverse antes del Sprint 1

- ¿Se cobra el total al reservar o solo un adelanto?
- ¿Se permite reservar el mismo dia hasta cuantos minutos antes?
- ¿Que politica de cancelacion y devolucion aplica?
- ¿El horario cruza medianoche?
- ¿Las tarifas dependen de cancha, dia, hora o temporada?
- ¿Una cancha en mantenimiento bloquea reservas existentes?
- ¿Se necesita comprobante para cada venta?
- ¿Como se verifica Yape, Plin y transferencia?
- ¿Puede una caja estar abierta por mas de un usuario?
- ¿Se opera una sola sede?
- ¿Quien puede modificar precios y anular ventas?
- ¿Cuanto tiempo deben conservarse los datos y auditorias?
- ¿Que volumen esperado de reservas y ventas debe soportar el sistema?

## 18. Orden recomendado de lanzamiento

### Lanzamiento interno 1

- Login.
- Canchas y calendario.
- Reservas con anti-cruce.
- Auditoria basica.

### Lanzamiento interno 2

- Tarifas.
- Cobro de reservas.
- Caja basica.

### Lanzamiento interno 3

- Productos.
- Stock.
- POS.
- Anulacion de ventas.

### Lanzamiento operativo

- Reportes completos.
- Backups y restauracion probada.
- Monitoreo.
- Manual de operacion.
- Pruebas end-to-end y aceptacion del negocio.

No habilitar el quiosco ni el cierre financiero en produccion solo porque las pantallas “se ven listas”. La salida depende de invariantes, pruebas y recuperacion operativa.

## 19. Checklist de go-live

- [ ] Reglas de negocio aprobadas.
- [ ] Migraciones probadas desde base vacia.
- [ ] Usuario admin creado mediante procedimiento seguro.
- [ ] Roles probados por endpoint.
- [ ] Solapamiento probado bajo concurrencia.
- [ ] Doble cobro probado con reintento.
- [ ] Stock negativo imposible bajo concurrencia.
- [ ] Tarifas y redondeos aprobados por negocio.
- [ ] Anulacion y devolucion probadas.
- [ ] Cierre de caja reconciliado manualmente.
- [ ] Zona horaria probada alrededor de medianoche.
- [ ] Backup restaurado con exito.
- [ ] HTTPS, CORS y headers revisados.
- [ ] Logs y alertas visibles.
- [ ] Rollback probado.
- [ ] Runbook entregado.
- [ ] Operadores capacitados.
- [ ] Criterios de aceptacion firmados.

## Resultado esperado

La primera version no debe intentar ser un marketplace ni un sistema contable completo. Debe ser un sistema operativo confiable para una sede: reservar una cancha sin cruces, cobrar una operacion una sola vez, controlar stock con historial y explicar de donde sale cada sol del cierre de caja.

