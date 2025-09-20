# Sprint Dashboard — Limpieza rápida

Este paquete incluye:
- `js/subtareas.js` **corregido** para actualizar `Fecha de terminación` por la PK real (`id`), sin depender de `subKeys`.
- `scripts/sql/create_views_clean.sql` con **todas** las vistas consolidadas usando `CREATE OR REPLACE` y `FILTER` en agregaciones.
- `scripts/sql/indexes.sql` con índices recomendados para acelerar consultas.

## Cómo aplicar
1) Subir los cambios del frontend
   - Reemplaza tu `js/subtareas.js` con el de esta carpeta.
   - Asegúrate de que los checkboxes de “terminada” llamen a `onChangeChkTerminada` y tengan `data-id="{id}"` (el `id` PK de SUBTAREAS).

2) Actualizar la BD (Supabase / Postgres)
   - Ejecuta `scripts/sql/create_views_clean.sql` en el editor SQL.
   - Ejecuta `scripts/sql/indexes.sql` para crear índices.

## Notas
- La lógica del dashboard usa `vw_subtareas_visibles` (filtra por `"Mostrar" = 0"`). Cambia este criterio si tu definición de “visible” es otra.
- Todas las agregaciones normalizan horas con `to_num_safe(...)`. Asegúrate de tener esa función definida.
- Si marcas/desmarcas “terminada” y no se guarda, revisa RLS/permisos de la tabla `SUBTAREAS` en Supabase.

¡Listo para usar!