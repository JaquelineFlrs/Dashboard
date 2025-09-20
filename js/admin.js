// js/admin.js — SLIM sin DELETE en cliente
(function(){
  'use strict';

  const sb = window.db || window.supabase;
  const $  = (s, r=document)=>r.querySelector(s);

  function msg(txt, ok=true){
    const el = $('#uploadMsg');
    if(!el) return;
    el.style.color = ok ? '#065f46' : '#b91c1c';
    el.textContent = txt;
  }

  // CSV → array de objetos
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

  // Inserción por lotes (INSERT plano)
  async function batchInsert(table, rows, chunkSize=500){
    let total = 0;
    for(let i=0; i<rows.length; i+=chunkSize){
      const slice = rows.slice(i, i+chunkSize);
      const { error, count } = await sb.from(table).insert(slice, { count: 'exact' });
      if(error){ throw error; }
      total += (count ?? slice.length);
    }
    return total;
  }

  // Upsert por lotes (para SUBTAREASACTUAL que sí tiene PK "ID de Tarea")
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

  // === Acciones ===

  // 1) Cargar SOLO Subtareas CSV → SUBTAREASACTUAL (UPSERT) → sync (RPC)
  async function handleCargarSubtareas(){
    try{
      msg('Procesando Subtareas…'); 
      const file = $('#csvSubtareas')?.files?.[0];
      if(!file){ msg('Selecciona un CSV de Subtareas.', false); return; }

      const { data, errors } = await parseCsv(file);
      if(errors?.length){ console.error(errors); msg('CSV con errores (Subtareas).', false); return; }
      if(!Array.isArray(data) || data.length===0){ msg('CSV vacío (Subtareas).', false); return; }

      // SUBTAREASACTUAL tiene PK "ID de Tarea" → podemos upsert
      const inserted = await batchUpsert('SUBTAREASACTUAL', data, '"ID de Tarea"');
      msg(`Subtareas staging: ${inserted}. Traspasando…`);

      const { data: sync, error } = await sb.rpc('fn_sync_subtareas');
      if(error) throw error;

      const u   = sync?.[0]?.updated_count ?? 0;
      const ins = sync?.[0]?.inserted_count ?? 0;
      const del = sync?.[0]?.deleted_staging ?? 0;
      msg(`OK Subtareas → Final. Actualizadas: ${u}, Insertadas: ${ins}, Limpiadas staging: ${del}.`);
    }catch(e){
      console.error(e);
      msg('Error al cargar/sincronizar Subtareas.', false);
    }
  }

  // 2) Cargar SOLO Historias CSV → HISTORIASACTUAL (INSERT) → sync (RPC)
  async function handleCargarHistorias(){
    try{
      msg('Procesando Historias…'); 
      const file = $('#csvHistorias')?.files?.[0];
      if(!file){ msg('Selecciona un CSV de Historias.', false); return; }

      const { data, errors } = await parseCsv(file);
      if(errors?.length){ console.error(errors); msg('CSV con errores (Historias).', false); return; }
      if(!Array.isArray(data) || data.length===0){ msg('CSV vacío (Historias).', false); return; }

      // HISTORIASACTUAL NO tiene índice único → usa INSERT, no upsert
      const inserted = await batchInsert('HISTORIASACTUAL', data);
      msg(`Historias staging: ${inserted}. Traspasando…`);

      const { data: sync, error } = await sb.rpc('fn_sync_historias');
      if(error) throw error;

      const ins = sync?.[0]?.inserted_count ?? 0;
      const del = sync?.[0]?.deleted_staging ?? 0;
      msg(`OK Historias → Final. Insertadas: ${ins}, Limpiadas staging: ${del}.`);
    }catch(e){
      console.error(e);
      msg('Error al cargar/sincronizar Historias.', false);
    }
  }

  // 3) Solo sincronizar lo que ya está en staging
  async function handleSincronizar(){
    try{
      msg('Sincronizando staging existente…');

      const res = [];

      const { data: h1 } = await sb.from('HISTORIASACTUAL').select('ID de Tarea').limit(1);
      if ((h1?.length ?? 0) > 0) {
        const { data, error } = await sb.rpc('fn_sync_historias');
        if(!error) res.push(`Historias OK: +${data?.[0]?.inserted_count ?? 0}`);
      }

      const { data: s1 } = await sb.from('SUBTAREASACTUAL').select('ID de Tarea').limit(1);
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

  // 4) Cargar ambos (si existe cada archivo), luego syncs correspondientes
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

  // 5) Nuevo sprint → RPC que limpia e inserta sprint
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
      if(error) throw error;

      const id  = data?.[0]?.new_sprint_id ?? '(?)';
      const ds  = data?.[0]?.subtareas_borradas ?? 0;
      const dh  = data?.[0]?.historias_borradas ?? 0;

      msg(`Sprint #${id} creado. Borradas: Subtareas=${ds}, Historias=${dh}.`);

      // refrescar vistas si tienes hooks
      if(window._hooks?.['view-dashboard']) window._hooks['view-dashboard']();
      if(window._hooks?.['view-burndown'])  window._hooks['view-burndown']();

    }catch(e){
      console.error(e);
      msg('Error al crear sprint.', false);
    }
  }

  // Bind UI
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
