# Sprint Dashboard — Diagnóstico rápido

Si no ves datos en el Dashboard:

1) **Configura credenciales**
   - Edita `js/config.js` y pon tu `SUPABASE_URL` y `SUPABASE_ANON_KEY` reales.
   - El banner rojo arriba te avisará si faltan.

2) **Políticas (RLS) / Permisos** (modo simple para prueba):
```sql
-- SPRINTS (lectura + insertar nuevo sprint desde el front)
alter table public.sprints enable row level security;
create policy "read sprints anon" on public.sprints for select to anon using (true);
create policy "insert sprints anon" on public.sprints for insert to anon with check (true);
create policy "delete sprints anon" on public.sprints for delete to anon using (true);

-- Vistas: asegúrate que las tablas base tengan políticas de select equivalentes
-- o expón vistas seguras vía RPC.

-- SUBTAREAS (lectura + update de columna mostrar)
alter table public."SUBTAREAS" enable row level security;
create policy "read subtareas anon" on public."SUBTAREAS" for select to anon using (true);
create policy "update mostrar anon" on public."SUBTAREAS" for update to anon using (true) with check (true);
-- Restringe a columna 'mostrar':
revoke all on public."SUBTAREAS" from anon;
grant select on public."SUBTAREAS" to anon;
grant update (mostrar) on public."SUBTAREAS" to anon;

-- HISTORIAS (si el front las toca)
alter table public."HISTORIAS" enable row level security;
create policy "read historias anon" on public."HISTORIAS" for select to anon using (true);
create policy "delete historias anon" on public."HISTORIAS" for delete to anon using (true);

-- Tablas staging para CSV
alter table public."SUBTAREASACTUAL" enable row level security;
create policy "upsert subtareasactual anon" on public."SUBTAREASACTUAL" for insert to anon with check (true);
create policy "upsert subtareasactual anon upd" on public."SUBTAREASACTUAL" for update to anon using (true) with check (true);

alter table public."HISTORIASACTUAL" enable row level security;
create policy "upsert historiasactual anon" on public."HISTORIASACTUAL" for insert to anon with check (true);
create policy "upsert historiasactual anon upd" on public."HISTORIASACTUAL" for update to anon using (true) with check (true);
```

> **Producción:** es mejor hacer esto vía un backend o RPC `SECURITY DEFINER` en lugar de dar permisos de `delete/insert` al `anon`. Lo anterior es solo para validar.

3) **Datos mínimos**
```sql
-- Agrega columna si falta
alter table public.sprints add column if not exists total_hrs numeric;
-- Crea un sprint activo de prueba
insert into public.sprints (nombre, fecha_inicio, fecha_fin, total_hrs, activo)
values ('Sprint Demo', current_date, current_date + interval '10 day', 120, true);
```

4) **CORS / URL permitida**
- En Supabase, Settings → Auth → URL config: agrega la URL de tu sitio (ej. `https://usuario.github.io`).
- Confirma que tu proyecto corre en **HTTPS**.

5) **Consola del navegador**
Abre DevTools → Console. Si ves `Status 401/403`, es RLS/permiso. Si ves _CORS_ o `TypeError: Failed to fetch`, es red/URL/CORS.
