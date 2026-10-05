# Seguimiento de mejoras y pendientes

Última actualización: 4 de octubre de 2026

Este documento resume los cambios recientes y los problemas que siguen abiertos para facilitar su consulta y continuidad.

## Mejoras implementadas

### Mantenimiento preventivo

- Se retiró la sección general **Agenda preventiva**.
- Se quitó el formulario general **Nuevo plan preventivo**; la creación se realiza desde el modal abierto al seleccionar una máquina.
- El modal muestra los planes preventivos de la máquina seleccionada y conserva las acciones de historial, ejecución, activar y pausar según permisos.
- En el modal se puede programar para una sola máquina o para toda su isla. Al elegir la isla, se informa cuántos planes se crearán y qué máquinas están incluidas.
- Se añadió una vista gráfica del estado del parque por isla y una distribución por estado de máquina.
- Los grupos de tarjetas del módulo **Máquinas** aparecen contraídos al cargar; cada isla se puede desplegar o contraer por separado.
- En Mantenimiento, los contadores **Próximos 3 días** y **Atrasados** filtran el mapa al pulsarlos y desplazan la vista hacia él. Los equipos filtrados quedan resaltados y se puede quitar el filtro.

### Marca del sistema

- Se agregó el logo de Ovalle Casino & Resort en el menú lateral, la pantalla de acceso y el portal de solicitudes.
- El archivo del logo quedó guardado localmente en `frontend/public/branding/casino-logo.png`.

## Pendiente sin resolver

### Error 500 al guardar consumos de inventario en un ticket

**Estado:** pendiente de diagnóstico y solución.

**Problema observado:** al guardar cambios de un ticket después de agregar un consumo de inventario, la interfaz muestra **Internal Server Error**. Se ha reportado con repuestos y también debe verificarse con insumos; los registros detallados compartidos muestran que ocurre al seleccionar un repuesto.

**Reproducción conocida:**

1. Abrir un ticket existente (en los registros se usó el ticket `#3`).
2. Agregar un repuesto o insumo en **Repuestos e insumos utilizados** e indicar cantidad.
3. Guardar los cambios del ticket.
4. La solicitud `PATCH /api/tickets/3` responde HTTP `500`.

**Evidencia disponible:**

- El frontend registró varias solicitudes `PATCH /api/tickets/3` con estado `500`.
- En la misma sesión, las solicitudes `GET /api/tickets/3/history`, `/comments`, `/attachments/1` e `/inventory` respondieron `200`; `/inventory` devolvió una lista vacía (`[]`) antes del intento de guardado observado.
- Los extractos de logs de backend entregados hasta ahora muestran arranque de la aplicación y un warning de SQLAlchemy, pero no el traceback correspondiente al `PATCH` fallido.
- Por falta del traceback y del cuerpo enviado, todavía no se conoce la causa exacta.
- Tampoco está confirmado si el stock quedó intacto en cada intento. Verificar el stock y los movimientos antes de repetir pruebas con datos reales.

**Información necesaria para continuar:**

1. Reproducir una vez con un repuesto y otra con un insumo; anotar código, cantidad e ID del ticket.
2. Capturar desde Network el cuerpo y la respuesta de `PATCH /api/tickets/{id}`. Ocultar tokens y otros datos sensibles.
3. Obtener el traceback del backend en el mismo momento del `PATCH`.
4. Confirmar el stock y los movimientos del artículo tras el fallo, para comprobar si hubo cambios parciales.
5. Revisar el manejador backend de `PATCH` del ticket: validación del tipo de artículo, disponibilidad de stock, creación del movimiento, asociaciones SQLAlchemy y límites transaccionales. La actualización del ticket y el descuento deben quedar confirmados juntos o revertirse juntos.

El warning de mapeo entre `Ticket.attachments` y `TicketAttachment.ticket` aparece durante el arranque, pero no hay evidencia de que cause este error. No atribuirle el HTTP 500 sin que el traceback lo confirme.

## Avisos observados

- `GET /api/auth/me/avatar` devolvió 404 en los logs compartidos; la interfaz también solicitó y recibió imágenes estáticas `/avatars/user-*.jpg`. Revisar si el endpoint se espera en el producto o si ese 404 es una solicitud opcional sin impacto.
- El warning de relaciones de adjuntos de SQLAlchemy sigue apareciendo durante el arranque. Puede limpiarse después revisando las relaciones y sus `back_populates`/`overlaps`, sin asumir que explique el fallo de inventario.

## Validación reciente

- `npm run build` en `frontend/` terminó correctamente tras los cambios recientes de interfaz.
- No se confirmó el comportamiento con una prueba de extremo a extremo en navegador.
