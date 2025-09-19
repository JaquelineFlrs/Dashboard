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

  if(!confirm('¡ATENCIÓN! Esto borrará SUBTAREAS, HISTORIAS y SPRINTS.\n¿Deseas continuar?')) return;

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

// === Cargar CSVs ===
async function cargarSubtareas(){
  const file = $id('csvSubtareas').files[0];
  if(!file){ alert('Selecciona un CSV de Subtareas.'); return; }
  try{
    CM.showLoading?.(true);
    const rows = normalizeRows(await parseCsvFile(file));
    await window.db.from('SUBTAREASACTUAL').delete().neq('x','y');
    const { error } = await window.db.from('SUBTAREASACTUAL').insert(rows);
    if(error) throw error;
    $id('uploadMsg').textContent = `Subtareas cargadas: ${rows.length}`;
  }catch(e){
    console.error(e);
    alert('Error cargando Subtareas: '+(e.message||e));
  }finally{ CM.showLoading?.(false); }
}

async function cargarHistorias(){
  const file = $id('csvHistorias').files[0];
  if(!file){ alert('Selecciona un CSV de Historias.'); return; }
  try{
    CM.showLoading?.(true);
    const rows = normalizeRows(await parseCsvFile(file));
    await window.db.from('HISTORIASACTUAL').delete().neq('x','y');
    const { error } = await window.db.from('HISTORIASACTUAL').insert(rows);
    if(error) throw error;
    $id('uploadMsg').textContent = `Historias cargadas: ${rows.length}`;
  }catch(e){
    console.error(e);
    alert('Error cargando Historias: '+(e.message||e));
  }finally{ CM.showLoading?.(false); }
}

async function sincronizar(){
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

async function cargarAmbosYSync(){
  if($id('csvSubtareas').files[0]) await cargarSubtareas();
  if($id('csvHistorias').files[0]) await cargarHistorias();
  await sincronizar();
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