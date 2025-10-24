-- SUPABASE – FULL (ES) – Tablas, Vistas, Funciones, RLS abierta
create extension if not exists pgcrypto;

-- Tablas
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
  horas     int  not null check (horas >= 0),
  unique (sprint_id, fecha)
);

-- Vista de subtareas visibles + columna terminado unificada
create or replace view subtareas_v as
select
  s.*,
  (s.terminado_manual or (s.estado_personalizado ilike '%completado%') or (s.fecha_terminacion is not null)) as terminado
from subtareas s
where s.oculto = false;

-- KPI por sprint
create or replace view sprint_kpis as
select
  sp.id as sprint_id,
  coalesce(sum(st.duracion_h),0) as total_horas,
  coalesce(sum(case when st.terminado then st.duracion_h else 0 end),0) as horas_terminadas,
  coalesce(sum(st.duracion_h),0) - coalesce(sum(case when st.terminado then st.duracion_h else 0 end),0) as horas_pendientes,
  case when coalesce(sum(st.duracion_h),0)=0 then 0
       else round((coalesce(sum(case when st.terminado then st.duracion_h else 0 end),0)::numeric * 100)
           / nullif(coalesce(sum(st.duracion_h),0),0), 2) end as porcentaje_avance
from sprints sp
left join subtareas_v st on st.sprint_id = sp.id
group by sp.id;

-- Días hábiles (excluye fines + festivos)
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

-- Burndown estimado
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

-- Horas terminadas por día (para barras del dashboard)
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

-- Funciones
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
  on conflict (sprint_id, fecha) do update set dia = excluded.dia, horas = excluded.horas;
end; $$ language plpgsql;

-- RLS (abierta para pruebas en GitHub Pages)
alter table sprints enable row level security;
alter table historias enable row level security;
alter table subtareas enable row level security;
alter table festivos_mx enable row level security;
alter table burndown_real enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='sprints' and policyname='sprints_select_all') then
    create policy sprints_select_all on sprints for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='historias' and policyname='historias_select_all') then
    create policy historias_select_all on historias for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='subtareas' and policyname='subtareas_select_all') then
    create policy subtareas_select_all on subtareas for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='festivos_mx' and policyname='festivos_select_all') then
    create policy festivos_select_all on festivos_mx for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='burndown_real' and policyname='burndown_real_select_all') then
    create policy burndown_real_select_all on burndown_real for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='burndown_real' and policyname='burndown_real_write') then
    create policy burndown_real_write on burndown_real for insert with check (true);
    create policy burndown_real_update on burndown_real for update using (true);
  end if;
end $$;

-- Festivos MX (ejemplo)
insert into festivos_mx (fecha, descripcion) values
  ('2025-01-01','Año Nuevo'),
  ('2025-02-03','Constitución (trasladado)'),
  ('2025-03-17','Natalicio Benito Juárez (trasladado)'),
  ('2025-05-01','Día del Trabajo'),
  ('2025-09-16','Independencia de México'),
  ('2025-11-17','Revolución Mexicana (trasladado)'),
  ('2025-12-25','Navidad')
on conflict (fecha) do nothing;
