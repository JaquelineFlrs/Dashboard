# GM Sprints – FULL v5 (ES)

Incluye TODO lo construido hasta ahora + **Avance por proyecto** (vista + UI).

## 1) Instalación
1. En Supabase, ejecuta `supabase.sql` (estructura completa: tablas, vistas, funciones y RLS de pruebas).
2. En `app.js`, coloca tus credenciales:
```js
const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-KEY";
```
3. Abre `index.html` o súbelo a GitHub Pages.

## 2) Destacados
- **Burndown**
  - Real: día 0 = estimado, días futuros = `NULL` (no se pinta).
  - Botones: “Recalcular estimado” (refresca vista) y “Calcular hoy” (Real = KPI horas pendientes del día).
  - Índices únicos `(sprint_id, dia)` y `(sprint_id, fecha)` para upserts seguros.
- **Dashboard**
  - KPIs generales.
  - Gráficas (Chart.js): Estimado vs Real y barras de horas terminadas.
  - **Avance por persona** (RPC con capacidad 7h/día).
  - **Avance por proyecto** (vista con totales, terminadas, pendientes y % avance).
- **Configuración**
  - Tabla de subtareas con filtros (texto/propietario/estado), switches de Terminado y Ocultar.
- **Cargas diarias**
  - Uploader de subtareas e historias con **parser de Zoho** `dd/mm/yyyy ...` (ignora hora).

## 3) Consultas útiles
- Avance por persona (vista): `select * from avance_por_persona where sprint_id=:p_sprint;`
- Avance por persona extendido: `select * from avance_por_persona_extendido(:p_sprint);`
- Avance por proyecto: `select * from avance_por_proyecto where sprint_id=:p_sprint;`

## 4) Notas
- La tabla `capacidad_persona` es opcional (para personalizar horas/día por propietario).
- Festivos de MX de ejemplo incluidos.
