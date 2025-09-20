// js/admin.js (drop-in)
(function(){
  'use strict';

  const sb = window.db || window.supabase;   // cliente supabase
  const $  = (s, r=document)=>r.querySelector(s);

  const STAGING = {
    SUB:  'SUBTAREASACTUAL',
    HIS:  'HISTORIASACTUAL'
  };

  function msg(txt, ok=true){
    const el = $('#uploadMsg');
    if(!el) return;
    el.style.color = ok ? '#065f46' : '#b91c1c';
    el.textContent = txt;
  }

  // ---- CSV → array de objetos
  function parseCsv(file){
    return new Promise((resolve,reject)=>{
      if(!file) return resolve({data:[], meta:{}});
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res)=> resolve(res),
        error: reject
      });
    });
  }

  // ---- Inserción por lotes (upsert si PK existe)
  async function batchUpsert(table, rows, onConflictCols, chunkSize=500){
    let total = 0;
    for(let i=0; i<rows.length; i+=chunkSize){
      const slice = rows.slice(i, i+chunkSize);
      const { error, count } = await sb
        .from(table)
        .upsert(slice, { onConflict: onConflictCols, ignoreDuplicates: false, count: 'exact' });
      if(error){ throw error; }
      total += (count ?? slice.length);
    }
    return total;
  }

  // ---- Limpia staging (opcional si prefieres hacerlo antes)
  async function clearStaging(table){
    const { error } = await sb.from(table).delete().neq('ID de Tarea', '__never__');
    if(error) console.warn('clearStaging', table, error);
  }

  // ---- Cargar CSV de SUBTAREAS → SUBTAREASACTUAL y luego sync
  async function handleCargarSubtareas(){
    try{
      msg('Procesando Subtareas…'); 
      const file = $('#csvSubtareas')?.files?.[0];
      if(!file){ msg('Selecciona un CSV de Subtareas.', false); return; }

      const { data, errors } = await parseCsv(file);
      if(errors?.length){ console.error(errors); msg('CSV con errores (Subtareas). Revisa columnas.', false); return; }
      if(!Array.isArray(data) || data.length===0){ msg('CSV vacío (Subtareas).', false); return; }

      // Limpia staging para evitar residuos
      await clearStaging(STAGING.SUB);

      // Upsert a staging (PK = "ID de Tarea")
      const inserted = await batchUpsert(STAGING.SUB, data, '"ID de Tarea"');
      msg(`Subtareas subidas a staging: ${inserted}. Traspasando…`);

      // RPC de sync
      const { data: sync, error } = await sb.rpc('fn_sync_subtareas');
      if(error){ throw error; }

      const u = sync?.[0]?.updated_count ?? 0;
      const ins = sync?.[0]?.inserted_count ?? 0;
      const del = sync?.[0]?.deleted_staging ?? 0;

      msg(`OK Subtareas → Final. Actualizadas: ${u}, Insertadas: ${ins}, Limpiadas staging: ${del}.`);
    }catch(e){
      console.error(e);
      msg('Error al cargar/sincronizar Subtareas.', false);
    }
  }

  // ---- Cargar CSV de HISTORIAS → HISTORIASACTUAL y luego sync
  async function handleCargarHistorias(){
    try{
      msg('Procesando Historias…'); 
      const file = $('#csvHistorias')?.files?.[0];
      if(!file){ msg('Selecciona un CSV de Historias.', false); return; }

      const { data, errors } = await parseCsv(file);
      if(errors?.length){ console.error(errors); msg('CSV con errores (Historias). Revisa columnas.', false); return; }
      if(!Array.isArray(data) || data.length===0){ msg('CSV vacío (Historias).', false); return; }

      await clearStaging(STAGING.HIS);

      // Upsert a staging (HISTORIASACTUAL no tiene PK explícita, pero usamos onConflict por "ID de Tarea" si está definido en BD)
      const inserted = await batchUpsert(STAGING.HIS, data, '"ID de Tarea"');
      msg(`Historias subidas a staging: ${inserted}. Traspasando…`);

      // RPC de sync
      const { data: sync, error } = await sb.rpc('fn_sync_historias');
      if(error){ throw error; }

      const ins = sync?.[0]?.inserted_count ?? 0;
      const del = sync?.[0]?.deleted_staging ?? 0;

      msg(`OK Historias → Final. Insertadas: ${ins}, Limpiadas staging: ${del}.`);
    }catch(e){
      console.error(e);
      msg('Error al cargar/sincronizar Historias.', false);
    }
  }

  // ---- Solo sincronizar (si ya cargaste antes)
  async function handleSincronizar(){
    try{
      msg('Sincronizando staging existente…');

      const res = [];

      // correr historias (si hay algo en staging)
      const { data: hcount, error: ehc } = await sb.from(STAGING.HIS).select('count', { count: 'exact', head: true });
      if(!ehc && (hcount?.length===0 || hcount === null)) {
        // Algunos clientes devuelven null con head:true. Consultemos una fila:
        const { data: h1 } = await sb.from(STAGING.HIS).select('ID de Tarea').limit(1);
        if ((h1?.length ?? 0) > 0) {
          const { data, error } = await sb.rpc('fn_sync_historias');
          if(!error) res.push(`Historias OK: +${data?.[0]?.inserted_count ?? 0}`);
        }
      } else {
        const { data: h1 } = await sb.from(STAGING.HIS).select('ID de Tarea').limit(1);
        if ((h1?.length ?? 0) > 0) {
          const { data, error } = await sb.rpc('fn_sync_historias');
          if(!error) res.push(`Historias OK: +${data?.[0]?.inserted_count ?? 0}`);
        }
      }

      // correr subtareas (si hay algo en staging)
      const { data: s1 } = await sb.from(STAGING.SUB).select('ID de Tarea').limit(1);
      if ((s1?.length ?? 0) > 0) {
        const { data, error } = await sb.rpc('fn_sync_subtareas');
        if(!error) res.push(`Subtareas OK: +${data?.[0]?.inserted_count ?? 0} / upd ${data?.[0]?.updated_count ?? 0}`);
      }

      msg(res.length ? res.join(' | ') : 'No había nada en staging.');
    }catch(e){
      console.error(e);
      msg('Error al sincronizar.', false);
    }
  }

  // ---- Cargar ambos (no obliga a tener los dos archivos)
  async function handleCargarTodo(){
    const hasSub = !!$('#csvSubtareas')?.files?.[0];
    const hasHis = !!$('#csvHistorias')?.files?.[0];

    if(!hasSub && !hasHis){
      msg('Selecciona al menos un CSV (Subtareas o Historias).', false);
      return;
    }
    if(hasSub) await handleCargarSubtareas();
    if(hasHis) await handleCargarHistorias();
  }

  // ---- Nuevo sprint (borra datos + crea sprint)
  async function handleNuevoSprint(ev){
    ev?.preventDefault?.();
    try{
      const nombre = $('#spNombre')?.value?.trim();
      const fIni   = $('#spInicio')?.value;
      const fFin   = $('#spFin')?.value;
      const total  = Number($('#spTotalHrs')?.value);

      if(!nombre || !fIni || !fFin || !isFinite(total)){
        msg('Completa nombre, fechas y total de horas.', false);
        return;
      }
      msg('Creando sprint y limpiando datos…');

      const { data, error } = await sb.rpc('fn_reset_sprint', {
        p_nombre: nombre,
        p_inicio: fIni,
        p_fin:    fFin,
        p_total:  total
      });
      if(error){ throw error; }

      const id  = data?.[0]?.new_sprint_id ?? '(?)';
      const ds  = data?.[0]?.subtareas_borradas ?? 0;
      const dh  = data?.[0]?.historias_borradas ?? 0;

      msg(`Sprint #${id} creado. Borradas: Subtareas=${ds}, Historias=${dh}.`);

      // (opcional) limpiar inputs
      // $('#frmSprint')?.reset();

      // (opcional) refrescar dashboard/burndown si manejas hooks globales
      if(window._hooks?.['view-dashboard']) window._hooks['view-dashboard']();
      if(window._hooks?.['view-burndown'])  window._hooks['view-burndown']();

    }catch(e){
      console.error(e);
      msg('Error al crear sprint.', false);
    }
  }

  // ---- Bind UI
  function bind(){
    $('#frmSprint')?.addEventListener('submit', handleNuevoSprint);
    $('#btnGuardarSprint')?.addEventListener('click', handleNuevoSprint);

    $('#btnCargarSubtareas')?.addEventListener('click', handleCargarSubtareas);
    $('#btnCargarHistorias')?.addEventListener('click', handleCargarHistorias);
    $('#btnSincronizar')?.addEventListener('click', handleSincronizar);
    $('#btnCargarTodo')?.addEventListener('click', handleCargarTodo);
  }

  if(document.readyState === 'complete' || document.readyState === 'interactive'){
    setTimeout(bind, 0);
  } else {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  }
})();
