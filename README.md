# GM Sprints – FULL v2 (ES)

Cambios clave:
- Parser de fechas Zoho `dd/mm/yyyy ...` (ignora hora) para evitar `RangeError: invalid date`.
- Inserta todos los renglones de subtareas/historias aunque haya fechas vacías.
- Burndown por índice de día (dia) para una línea recta (sin “escalera” por fecha).
- Vista `subtareas_v2` incluye `nombre_historia` y `proyecto`.
- Removidos botones de navegación extra y “ID:” en topbar.
- Filtros en Configuración: búsqueda, propietario y estado.

## Uso
1) Ejecuta `supabase.sql` en Supabase.
2) En `app.js`, pega tus credenciales.
3) Abre `index.html` (o publica en GitHub Pages).

## CSVs Zoho
- Historias: `ID de Tarea`, `Nombre de la lista de tareas`, `Nombre de Tarea`.
- Subtareas: `ID de Tarea principal`, `Nombre de Tarea`, `Propietario`, `Duración`, `Estado personalizado`, `Hora de creación`, `Fecha de terminación`.
