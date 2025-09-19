-- ==============================================
-- MODIFICACIONES PARA BURNDOWN CON AVANCE DIARIO
-- ==============================================

-- 1) Columna nueva
ALTER TABLE "SUBTAREAS"
ADD COLUMN IF NOT EXISTS fecha_cierre_marcada date;

CREATE INDEX IF NOT EXISTS ix_subtareas_fecha_cierre_marcada
ON "SUBTAREAS"(fecha_cierre_marcada);

-- 2) Backfill inicial: copia Fecha de terminación a fecha_cierre_marcada
UPDATE "SUBTAREAS"
SET fecha_cierre_marcada = "Fecha de terminación"
WHERE "Fecha de terminación" IS NOT NULL
  AND fecha_cierre_marcada IS NULL;

-- 3) Función fn_sync_simple modificada
create or replace function fn_sync_simple()
returns void
language plpgsql
as $$
begin
  create temporary table tmp_norm on commit drop as
  select
    sa."ID de Tarea",
    sa."Nombre de Tarea",
    sa."Hora de creación",
    sa."Tipo de tarea",
    sa."Propietario",
    sa."Estado personalizado",
    sa."Duración",
    sa."ID de Tarea principal",
    case
      when trim(coalesce(sa."Fecha de terminación"::text,'')) = '' then null
      when sa."Fecha de terminación" ~ '^\d{4}-\d{2}-\d{2}$'
        then (sa."Fecha de terminación")::date
      when sa."Fecha de terminación" ~ '^\d{2}/\d{2}/\d{4}$'
        then to_date(sa."Fecha de terminación",'DD/MM/YYYY')
      when sa."Fecha de terminación" ~ '^\d{2}-\d{2}-\d{4}$'
        then to_date(sa."Fecha de terminación",'DD-MM-YYYY')
      else null
    end as fecha_term_date
  from "SUBTAREASACTUAL" sa;

  update "SUBTAREAS" t
     set "Nombre de Tarea"        = n."Nombre de Tarea",
         "Hora de creación"       = n."Hora de creación",
         "Tipo de tarea"          = n."Tipo de tarea",
         "Propietario"            = n."Propietario",
         "Estado personalizado"   = n."Estado personalizado",
         "Duración"               = n."Duración",
         "ID de Tarea principal"  = n."ID de Tarea principal",
         "Fecha de terminación"   = n.fecha_term_date,
         fecha_cierre_marcada     = case
                                      when t."Fecha de terminación" is null
                                       and n.fecha_term_date is not null
                                       and t.fecha_cierre_marcada is null
                                      then current_date
                                      else t.fecha_cierre_marcada
                                    end,
         es_nuevo                 = 0
  from tmp_norm n
  where t."ID de Tarea" = n."ID de Tarea";

  insert into "SUBTAREAS" (
    "Nombre de Tarea","Hora de creación","Tipo de tarea","Propietario",
    "Estado personalizado","Duración","Fecha de terminación",
    "ID de Tarea principal","ID de Tarea",
    fecha_cierre_marcada
  )
  select
    n."Nombre de Tarea",
    n."Hora de creación",
    n."Tipo de tarea",
    n."Propietario",
    n."Estado personalizado",
    n."Duración",
    n.fecha_term_date,
    n."ID de Tarea principal",
    n."ID de Tarea",
    case when n.fecha_term_date is not null then current_date else null end
  from tmp_norm n
  left join "SUBTAREAS" t on t."ID de Tarea" = n."ID de Tarea"
  where t."ID de Tarea" is null;

end;
$$;

-- 4) Vista de avance diario
create or replace view burndown_avance_diario as
with horas as (
  select
    fecha_cierre_marcada::date as fecha,
    nullif(regexp_replace(coalesce("Duración",''), '[^0-9\.,]', '', 'g'), '')::numeric as horas
  from "SUBTAREAS"
  where fecha_cierre_marcada is not null
)
select
  fecha,
  sum(coalesce(horas, 0)) as horas_cerradas,
  count(*) as tareas_cerradas
from horas
group by fecha
order by fecha;

-- 5) Vista dataset del burndown
create or replace view burndown_dataset as
with sprint as (
  select fecha_inicio, fecha_fin, coalesce(total_hrs,total_horas) as total
  from sprints
  where activo is true or activo = true
  limit 1
),
dias as (
  select generate_series(s.fecha_inicio, s.fecha_fin, interval '1 day')::date as dia,
         s.total
  from sprint s
),
avance as (
  select fecha, sum(horas_cerradas) as horas_cerradas
  from burndown_avance_diario
  group by fecha
),
acum as (
  select d.dia,
         d.total,
         coalesce(sum(a.horas_cerradas) over (order by d.dia
                  rows between unbounded preceding and current row), 0) as horas_cerradas_acum
  from dias d
  left join avance a on a.fecha = d.dia
),
serie as (
  select
    dia,
    total - horas_cerradas_acum as horas_restantes_real,
    case when (select count(*) from dias)>1
         then total * (1 - (row_number() over (order by dia)-1)::numeric / ((select count(*) from dias)-1))
         else total end as horas_restantes_ideal
  from acum
)
select * from serie order by dia;
