(function(){
'use strict';
const CM = window._commons || {};
const $id = (id)=> document.getElementById(id);

// === Guardar sprint ===

async function guardarSprint(ev){
  ev.preventDefault();
  const nombre   = $id('spNombre').value.trim();
  const inicio   = $id('spInicio').value;
  const fin      = $id('spFin').value;
  const totalHrs = parseFloat($id('spTotalHrs').value||'0');

  if(!nombre || !inicio || !fin || !Number.isFinite(totalHrs)){
    alert('Completa todos los campos del sprint.');
    return;
  }

  if(!confirm(`¡ATENCIÓN! Esto TRUNCATE: SUBTAREAS, HISTORIAS y SPRINTS, y creará un nuevo sprint ACTIVO.
¿Deseas continuar?`)) return;

  try{
    CM.showLoading?.(true);

    // Ajusta a tu flujo real (RPC o deletes directos)
    await window.db.from('SUBTAREAS').delete();
    await window.db.from('HISTORIAS').delete();
    await window.db.from('sprints').delete();

    const { error } = await window.db.from('sprints').insert([{
      nombre,
      fecha_inicio: inicio,
      fecha_fin: fin,
      total_horas: totalHrs
    }]);
    if(error) throw error;

    alert('Sprint guardado.');
  }catch(e){
    console.error(e);
    alert('No se pudo guardar el sprint: '+(e.message||e));
  }finally{
    CM.showLoading?.(false);
  }
}

  if(!confirm(`¡ATENCIÓN! Esto TRUNCATE: SUBTAREAS, HISTORIAS y SPRINTS, y creará un nuevo sprint ACTIVO.
¿Deseas continuar?`)) return;

  try{
    CM.showLoading?.(true);

    // Borra datos existentes
    await window.db.from('SUBTAREAS').delete();
    await window.db.from('HISTORIAS').delete();
    await window.db.from('sprints').delete();

    // Inserta sprint nuevo
    const { error } = await window.db.from('sprints').insert([{
      nombre,
      fecha_inicio: inicio,
      fecha_fin: fin,
      total_horas: totalHrs
    }]);
    if(error) throw error;

    alert('Sprint guardado.');
  }catch(e){
    console.error(e);
    alert('No se pudo guardar el sprint: '+(e.message||e));
  }finally{
    CM.showLoading?.(false);
  }
}

// === Helpers para CSV ===

function parseCsvFile(file){
  return new Promise((resolve, reject)=>{
    if(!file) return resolve([]);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => (h||'').replace(/\ufeff/g,'').trim(),
      transform: v => (typeof v === 'string' ? v.trim() : v),
      complete: (res)=> resolve(res.data),
      error: reject
    });
  });
}

function normalizeRows(rows){
  return rows.map(r=>{
    const out = {};
    for(const k in r){
      const v = r[k];
      if(v === '') out[k] = null;
      else if(typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) out[k] = Number(v);
      else out[k] = v;
    }
    return out;
  });
}
    return out;
  });
}

// === Cargar CSVs ===

async async function cargarSubtareas(){
  const file = $id('csvSubtareas').files[0];
  if(!file){ alert('Selecciona un CSV de Subtareas.'); return; }
  try{
    CM.showLoading?.(true);
// TODO: moved into async function ->     const raw = await parseCsvFile(file);
    const rows = normalizeRows(raw);
    const valid = [];
    const skipped = [];
    for(const r of rows){
      const idVal = r["ID de Tarea"];
      if(idVal === null || idVal === undefined || idVal === '') skipped.push(r);
      else valid.push(r);
    }
    if(valid.length === 0){
      alert('Ninguna fila tiene "ID de Tarea". Revisa los encabezados del CSV.');
      return;
    }
// TODO: moved into async function ->     await window.db.from('SUBTAREASACTUAL').delete();
// TODO: moved into async function ->     const { error } = await window.db.from('SUBTAREASACTUAL').insert(valid);
    if(error) throw error;
    $id('uploadMsg').textContent = `Subtareas cargadas: ${valid.length}. Omitidas por falta de "ID de Tarea": ${skipped.length}`;
  }catch(e){
    console.error(e);
    alert('Error cargando Subtareas: '+(e.message||e));
  }finally{ CM.showLoading?.(false); }
}

async async function cargarHistorias(){
  const file = $id('csvHistorias').files[0];
  if(!file){ alert('Selecciona un CSV de Historias.'); return; }
  try{
    CM.showLoading?.(true);
// TODO: moved into async function ->     const rows = normalizeRows(await parseCsvFile(file));
// TODO: moved into async function ->     await window.db.from('HISTORIASACTUAL').delete().neq('x','y');
// TODO: moved into async function ->     const { error } = await window.db.from('HISTORIASACTUAL').insert(rows);
    if(error) throw error;
    $id('uploadMsg').textContent = `Historias cargadas: ${rows.length}`;
  }catch(e){
    console.error(e);
    alert('Error cargando Historias: '+(e.message||e));
  }finally{ CM.showLoading?.(false); }
}

async async function sincronizar(){
  try{
    CM.showLoading?.(true);
    if(window.db.rpc){
      const { error } = await window.db.rpc('fn_sync_simple');
      if(error) throw error;
      alert('Sincronización ejecutada.');
    }else{
      alert('Sincronización omitida (no hay RPC disponible).');
    }
  }catch(e){
    console.warn(e);
    alert('No se pudo sincronizar: '+(e.message||e));
  }finally{ CM.showLoading?.(false); }
}

async async function cargarAmbosYSync(){
// TODO: moved into async function ->   if($id('csvSubtareas').files[0]) await cargarSubtareas();
// TODO: moved into async function ->   if($id('csvHistorias').files[0]) await cargarHistorias();
// TODO: moved into async function ->   await sincronizar();
}

// === Eventos ===
$id('frmSprint').addEventListener('submit', guardarSprint);
$id('btnCargarSubtareas').addEventListener('click', cargarSubtareas);
$id('btnCargarHistorias').addEventListener('click', cargarHistorias);
$id('btnSincronizar').addEventListener('click', sincronizar);
$id('btnCargarTodo').addEventListener('click', cargarAmbosYSync);

// Hook al entrar
window._hooks = window._hooks || {};
window._hooks['view-admin'] = ()=>{};

})();