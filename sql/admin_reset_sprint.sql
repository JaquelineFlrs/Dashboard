
-- Run this in Supabase SQL editor (schema: public)

-- RPC: admin_reset_sprint
-- - TRUNCATE SUBTAREAS, HISTORIAS, sprints (reinicia IDs)
-- - Inserta un nuevo sprint
-- - Si existen las columnas total_horas y/o activo en sprints, las incluye.
create or replace function admin_reset_sprint(
  p_nombre text,
  p_inicio date,
  p_fin    date,
  p_total  numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  has_total boolean;
  has_activo boolean;
  sql text;
begin
  -- Detecta si existen columnas opcionales
  select exists(
    select 1 from information_schema.columns
     where table_schema='public' and table_name='sprints' and column_name='total_horas'
  ) into has_total;

  select exists(
    select 1 from information_schema.columns
     where table_schema='public' and table_name='sprints' and column_name='activo'
  ) into has_activo;

  -- Limpia tablas
  truncate table "SUBTAREAS" restart identity cascade;
  truncate table "HISTORIAS" restart identity cascade;
  truncate table sprints restart identity cascade;

  -- Construye INSERT dinámico según columnas disponibles
  if has_total and has_activo then
    sql := 'insert into sprints(nombre, fecha_inicio, fecha_fin, total_horas, activo) values ($1,$2,$3,$4,true)';
    execute sql using p_nombre, p_inicio, p_fin, coalesce(p_total,0);
  elsif has_total and not has_activo then
    sql := 'insert into sprints(nombre, fecha_inicio, fecha_fin, total_horas) values ($1,$2,$3,$4)';
    execute sql using p_nombre, p_inicio, p_fin, coalesce(p_total,0);
  elsif not has_total and has_activo then
    sql := 'insert into sprints(nombre, fecha_inicio, fecha_fin, activo) values ($1,$2,$3,true)';
    execute sql using p_nombre, p_inicio, p_fin;
  else
    sql := 'insert into sprints(nombre, fecha_inicio, fecha_fin) values ($1,$2,$3)';
    execute sql using p_nombre, p_inicio, p_fin;
  end if;
end;
$$;

-- Permisos de ejecución para el cliente (anon/authenticated)
revoke all on function admin_reset_sprint(text,date,date,numeric) from public;
grant execute on function admin_reset_sprint(text,date,date,numeric) to anon, authenticated;
