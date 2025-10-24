-- SUPABASE – FULL v4 (ES) – Real null en futuros, calcular hoy y recálculo
create extension if not exists pgcrypto;

-- ===================
-- Tablas
-- ===================
create table if not exists sprints (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  fecha_inicio  date not null,
  fecha_fin     date not null,
  creado_en     timestamptz default now(),
  creado_por    uuid null
);

create table if not exists historias (
  id             uuid primary key default gen_random_uuid(),
  sprint_id      uuid not null references sprints(id) on delete cascade,
  tarea_id       text unique not null,
  proyecto       text not null,
  nombre         text not null,
  actualizado_en timestamptz default now()
);

create table if not exists subtareas (
  id                   uuid primary key default gen_random_uuid(),
  sprint_id            uuid not null references sprints(id) on delete cascade,
  historia_tarea_id    text not null,
  nombre               text not null,
  propietario          text not null,
  duracion_h           int not null check (duracion_h >= 0),
  estado_personalizado text,
  fecha_creacion       timestamptz,
  fecha_terminacion    timestamptz,
  terminado_manual     boolean default false,
  oculto               boolean default false
);
create unique index if not exists subtareas_unique_historia_nombre on subtareas(historia_tarea_id, nombre);

create table if not exists festivos_mx (
  fecha        date primary key,
  descripcion  text
);

create table if not exists burndown_real (
  id        uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references sprints(id) on delete cascade,
  dia       int  not null,
  fecha     date not null,
  horas     int  null, -- ahora permite NULL para no pintar futuros
  unique (sprint_id, fecha),
  unique (sprint_id, dia)
);

-- Ajuste por si viene de versiones anteriores
do $$ begin
  if exists (select 1 from information_schema.columns where table_name='burndown_real' and column_name='horas' and is_nullable='NO') then
    alter table burndown_real alter column horas drop not null;
  end if;
end $$;

-- ===================
-- Vistas
-- ===================
create or replace view subtareas_v2 as
select
  s.*,
  h.nombre   as nombre_historia,
  h.proyecto as proyecto,
  (s.terminado_manual
    or (s.estado_personalizado ilike '%completado%')
    or (s.fecha_terminacion is not null)
  ) as terminado
from subtareas s
left join historias h
  on h.tarea_id = s.historia_tarea_id
where s.oculto = false;

create or replace view sprint_kpis as
select
  sp.id as sprint_id,
  coalesce(sum(st.duracion_h),0) as total_horas,
  coalesce(sum(case when (st.terminado_manual or (st.estado_personalizado ilike '%completado%' ) or (st.fecha_terminacion is not null)) then st.duracion_h else 0 end),0) as horas_terminadas,
  coalesce(sum(st.duracion_h),0) - coalesce(sum(case when (st.terminado_manual or (st.estado_personalizado ilike '%completado%' ) or (st.fecha_terminacion is not null)) then st.duracion_h else 0 end),0) as horas_pendientes,
  case when coalesce(sum(st.duracion_h),0)=0 then 0
       else round((coalesce(sum(case when (st.terminado_manual or (st.estado_personalizado ilike '%completado%' ) or (st.fecha_terminacion is not null)) then st.duracion_h else 0 end),0)::numeric * 100)
           / nullif(coalesce(sum(st.duracion_h),0),0), 2) end as porcentaje_avance
from sprints sp
left join subtareas st on st.sprint_id = sp.id and st.oculto = false
group by sp.id;

create or replace view sprint_dias_habiles as
select sp.id as sprint_id,
       d::date as fecha,
       row_number() over (partition by sp.id order by d) - 1 as dia
from sprints sp
join lateral (
  select gs::date as d
  from generate_series(sp.fecha_inicio, sp.fecha_fin, interval '1 day') gs
  where extract(isodow from gs) < 6
    and gs::date not in (select fecha from festivos_mx)
) dd on true;

create or replace view sprint_burndown_estimado as
with base as (
  select k.sprint_id, k.total_horas, count(*) as dias
  from sprint_kpis k
  join sprint_dias_habiles dh on dh.sprint_id = k.sprint_id
  group by k.sprint_id, k.total_horas
)
select dh.sprint_id, dh.dia, dh.fecha,
       greatest(0, round( b.total_horas - (b.total_horas::numeric / nullif(b.dias,0)) * dh.dia )::int) as horas_estimadas
from sprint_dias_habiles dh
join base b on b.sprint_id = dh.sprint_id
order by dh.sprint_id, dh.dia;

create or replace view horas_terminadas_por_dia as
select
  sp.id as sprint_id,
  coalesce(st.fecha_terminacion::date, st.fecha_creacion::date) as fecha,
  sum(case when (st.terminado_manual or (st.estado_personalizado ilike '%completado%') or (st.fecha_terminacion is not null))
           then st.duracion_h else 0 end) as horas_terminadas
from sprints sp
left join subtareas st on st.sprint_id = sp.id and st.oculto = false
group by sp.id, coalesce(st.fecha_terminacion::date, st.fecha_creacion::date)
order by fecha;

create or replace view avance_por_persona as
select 
  sp.id as sprint_id,
  st.propietario,
  sum(st.duracion_h) as horas_totales,
  sum(case 
        when (st.terminado_manual 
              or st.estado_personalizado ilike '%completado%' 
              or st.fecha_terminacion is not null)
        then st.duracion_h else 0 end) as horas_terminadas,
  sum(st.duracion_h) 
    - sum(case 
            when (st.terminado_manual 
                  or st.estado_personalizado ilike '%completado%' 
                  or st.fecha_terminacion is not null)
            then st.duracion_h else 0 end) as horas_pendientes
from sprints sp
left join subtareas st on st.sprint_id = sp.id and st.oculto = false
group by sp.id, st.propietario;

-- ===================
-- Funciones
-- ===================
create or replace function upsert_historia(p_sprint uuid, p_tarea_id text, p_proyecto text, p_nombre text) returns void as $$
begin
  insert into historias (sprint_id, tarea_id, proyecto, nombre)
  values (p_sprint, p_tarea_id, p_proyecto, p_nombre)
  on conflict (tarea_id)
  do update set proyecto = excluded.proyecto,
                nombre   = excluded.nombre,
                actualizado_en = now();
end; $$ language plpgsql;

create or replace function upsert_subtarea(
  p_sprint uuid,
  p_historia_tarea_id text,
  p_nombre text,
  p_propietario text,
  p_duracion_h int,
  p_estado text,
  p_creacion timestamptz,
  p_terminacion timestamptz
) returns void as $$
begin
  insert into subtareas (sprint_id, historia_tarea_id, nombre, propietario, duracion_h, estado_personalizado, fecha_creacion, fecha_terminacion)
  values (p_sprint, p_historia_tarea_id, p_nombre, p_propietario, p_duracion_h, p_estado, p_creacion, p_terminacion)
  on conflict (historia_tarea_id, nombre)
  do update set propietario = excluded.propietario,
                duracion_h  = excluded.duracion_h,
                estado_personalizado = excluded.estado_personalizado,
                fecha_creacion       = excluded.fecha_creacion,
                fecha_terminacion    = excluded.fecha_terminacion;
end; $$ language plpgsql;

create or replace function set_subtarea_terminada(p_id uuid, p_val boolean) returns void as $$
begin
  update subtareas set terminado_manual = p_val where id = p_id;
end; $$ language plpgsql;

create or replace function set_subtarea_oculta(p_id uuid, p_val boolean) returns void as $$
begin
  update subtareas set oculto = p_val where id = p_id;
end; $$ language plpgsql;

create or replace function set_burndown_real(p_sprint uuid, p_fecha date, p_dia int, p_horas int) returns void as $$
begin
  insert into burndown_real (sprint_id, fecha, dia, horas)
  values (p_sprint, p_fecha, p_dia, p_horas)
  on conflict (sprint_id, dia) do update set fecha = excluded.fecha, horas = excluded.horas;
end; $$ language plpgsql;

-- Variante que acepta NULL para horas (para borrar/limpiar)
create or replace function set_burndown_real_nullable(p_sprint uuid, p_fecha date, p_dia int, p_horas int) returns void as $$
begin
  insert into burndown_real (sprint_id, fecha, dia, horas)
  values (p_sprint, p_fecha, p_dia, p_horas)
  on conflict (sprint_id, dia) do update set fecha = excluded.fecha, horas = excluded.horas;
end; $$ language plpgsql;

-- Inicializa burndown_real: día 0 = estimado día 0; resto = NULL (no pintar)
create or replace function init_burndown_real(p_sprint uuid) returns void as $$
declare
  rec record;
begin
  if exists (select 1 from burndown_real where sprint_id = p_sprint) then
    return;
  end if;

  for rec in
    select dia, fecha, horas_estimadas
    from sprint_burndown_estimado
    where sprint_id = p_sprint
    order by dia
  loop
    insert into burndown_real (sprint_id, dia, fecha, horas)
    values (p_sprint, rec.dia, rec.fecha, case when rec.dia=0 then rec.horas_estimadas else null end);
  end loop;
end; $$ language plpgsql;

-- Avance por persona con capacidad y diferencia
create or replace function avance_por_persona_extendido(p_sprint uuid)
returns table(
  propietario text,
  horas_totales int,
  horas_terminadas int,
  horas_pendientes int,
  dias_restantes int,
  capacidad int,
  diferencia int
) as $$
declare
  ff date; hoy date := current_date;
  dias int; horas_dia int := 7;
begin
  select fecha_fin into ff from sprints where id = p_sprint;
  select greatest(0, count(*))
  into dias
  from generate_series(hoy, ff, interval '1 day') gs
  where extract(isodow from gs) < 6
    and gs::date not in (select fecha from festivos_mx);

  return query
  select 
    a.propietario,
    a.horas_totales,
    a.horas_terminadas,
    a.horas_pendientes,
    dias as dias_restantes,
    dias * horas_dia as capacidad,
    (a.horas_pendientes - dias * horas_dia) as diferencia
  from avance_por_persona a
  where a.sprint_id = p_sprint;
end; $$ language plpgsql;

-- ===================
-- RLS abierta para pruebas
-- ===================
alter table sprints enable row level security;
alter table historias enable row level security;
alter table subtareas enable row level security;
alter table festivos_mx enable row level security;
alter table burndown_real enable row level security;

-- reset políticas
drop policy if exists sprints_select_all on sprints;
drop policy if exists sprints_insert_all on sprints;
drop policy if exists sprints_update_all on sprints;
drop policy if exists sprints_delete_all on sprints;
create policy sprints_select_all on sprints for select using (true);
create policy sprints_insert_all on sprints for insert with check (true);
create policy sprints_update_all on sprints for update using (true);
create policy sprints_delete_all on sprints for delete using (true);

drop policy if exists historias_select_all on historias;
drop policy if exists historias_insert_all on historias;
drop policy if exists historias_update_all on historias;
drop policy if exists historias_delete_all on historias;
create policy historias_select_all on historias for select using (true);
create policy historias_insert_all on historias for insert with check (true);
create policy historias_update_all on historias for update using (true);
create policy historias_delete_all on historias for delete using (true);

drop policy if exists subtareas_select_all on subtareas;
drop policy if exists subtareas_insert_all on subtareas;
drop policy if exists subtareas_update_all on subtareas;
drop policy if exists subtareas_delete_all on subtareas;
create policy subtareas_select_all on subtareas for select using (true);
create policy subtareas_insert_all on subtareas for insert with check (true);
create policy subtareas_update_all on subtareas for update using (true);
create policy subtareas_delete_all on subtareas for delete using (true);

drop policy if exists burndown_real_select_all on burndown_real;
drop policy if exists burndown_real_insert_all on burndown_real;
drop policy if exists burndown_real_update_all on burndown_real;
drop policy if exists burndown_real_delete_all on burndown_real;
create policy burndown_real_select_all on burndown_real for select using (true);
create policy burndown_real_insert_all on burndown_real for insert with check (true);
create policy burndown_real_update_all on burndown_real for update using (true);
create policy burndown_real_delete_all on burndown_real for delete using (true);

drop policy if exists festivos_mx_select_all on festivos_mx;
drop policy if exists festivos_mx_insert_all on festivos_mx;
drop policy if exists festivos_mx_update_all on festivos_mx;
drop policy if exists festivos_mx_delete_all on festivos_mx;
create policy festivos_mx_select_all on festivos_mx for select using (true);
create policy festivos_mx_insert_all on festivos_mx for insert with check (true);
create policy festivos_mx_update_all on festivos_mx for update using (true);
create policy festivos_mx_delete_all on festivos_mx for delete using (true);

-- Festivos (ejemplo)
insert into festivos_mx (fecha, descripcion) values
  ('2025-01-01','Año Nuevo'),
  ('2025-02-03','Constitución (trasladado)'),
  ('2025-03-17','Natalicio Benito Juárez (trasladado)'),
  ('2025-05-01','Día del Trabajo'),
  ('2025-09-16','Independencia de México'),
  ('2025-11-17','Revolución Mexicana (trasladado)'),
  ('2025-12-25','Navidad')
on conflict (fecha) do nothing;
