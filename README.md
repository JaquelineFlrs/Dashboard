# GM Sprints – FULL v4 (ES)

### Novedades
- **Real con nulos**: En `burndown_real`, los días futuros quedan con `NULL` para que **no se pinten** en la gráfica. Día 0 = estimado.
- **Botones en burndown**:
  - **Recalcular estimado**: refresca la línea Estimada (la vista ya recalcula por total de horas / días hábiles).
  - **Calcular hoy**: toma **Horas pendientes (KPI)** y las guarda como **Real** en el **día hábil actual**.
- **Tabla “Hrs Burndown”**: puedes editar `Real`. Si dejas el campo vacío, guarda `NULL` (y la gráfica no lo dibuja).
- Se mantiene **Avance por persona** debajo del burndown.

### Pasos
1) Ejecuta `supabase.sql` (nota: ahora `burndown_real.horas` acepta `NULL`).
2) En `app.js`, coloca tus credenciales Supabase.
3) Abrir `index.html` (o GitHub Pages).

### Detalles
- El **Estimado** se calcula con la vista `sprint_burndown_estimado` (total horas / días hábiles), por lo que el botón solo **refresca**.
- **Calcular hoy** valida que **hoy sea un día hábil** dentro del sprint (sin fines de semana ni festivos).

