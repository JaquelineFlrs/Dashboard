# GM Sprints – FULL (ES)

Listo para GitHub Pages, con Supabase (RLS abierta), CSV (PapaParse) y Chart.js.

## Pasos rápidos

1) Crea tu proyecto en Supabase y en el editor SQL pega **supabase.sql** (todo de una).
2) En **app.js**, reemplaza:
```js
const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-KEY";
```
3) Abre `index.html` o súbelo a GitHub Pages (Settings → Pages).

## Flujo

- **Sprint**: crea/selecciona un sprint activo (se guarda en localStorage).
- **Cargas diarias**:
  - Historias CSV → `upsert_historia`
  - Subtareas CSV → `upsert_subtarea` (conversión HH:MM → horas enteras)
- **Hrs Burndown**:
  - Lee `sprint_burndown_estimado` y `burndown_real`.
  - Edita “Real” → guarda con `set_burndown_real`.
  - Botones Recalcular: conservar o sobrescribir “Real”.
- **Dashboard**:
  - KPIs desde `sprint_kpis`.
  - Línea Estimado vs Real.
  - Barras: horas terminadas por día (vista `horas_terminadas_por_dia`).

## CSV esperados (Zoho)

- **Historias**: columnas clave
  - `ID de Tarea` (clave natural), `Nombre de la lista de tareas`, `Nombre de Tarea`
- **Subtareas**: columnas clave
  - `ID de Tarea principal`, `Nombre de Tarea`, `Propietario`, `Duración`, `Estado personalizado`, `Hora de creación`, `Fecha de terminación`

> Mantén los encabezados tal cual exporta Zoho. Si cambian, edita los mapeos en `app.js` (sección Cargas Diarias).

## Nota RLS
RLS abierta solo para pruebas públicas (GitHub Pages). Para producción, cambia a políticas con `auth.uid`.
