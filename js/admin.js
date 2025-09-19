(function(){
'use strict';
const CM = window._commons;
const db = CM.db;

// admin.js — crear sprint y cargas CSV

const $a = (id)=> document.getElementById(id);

async function confirmarReset(){
  return confirm('Esto borrará SUBTAREAS, HISTORIAS y SPRINTS y creará el nuevo sprint. ¿Continuar?');
}

async function limpiarTablas(){
  // Borra tablas (si tu RLS lo permite). Usa neq('id', -1) como guard.
  await db.from(CM.TABLES.SUBTAREAS).delete().neq('id', -1);
  await db.from(CM.TABLES.HISTORIAS).delete().neq('id', -1);
  await db.from(CM.TABLES.SPRINTS).delete().neq('id', -1);
}

async function guardarSprint(ev){
  ev.preventDefault();
  const nombre = $a('spNombre').value.trim();
  const inicio = $a('spInicio').value;
  const fin = $a('spFin').value;
  const totalHrs = parseFloat($a('spTotalHrs').value||'0');
  if(!nombre || !inicio || !fin || !Number.isFinite(totalHrs)){
    alert('Completa todos los campos.');
    return;
  }
  if(!(await confirmarReset())) return;

  CM.showLoading(true);
  try{
    await limpiarTablas();
    const { error } = await db.from(CM.TABLES.SPRINTS).insert({
      nombre, fecha_inicio: inicio, fecha_fin: fin, total_hrs: totalHrs, activo: true
    });
    if(error) throw error;
    alert('Sprint creado.');
  }catch(e){
    console.error(e);
    alert('No se pudo crear el sprint: '+(e?.message||e));
  }finally{ CM.showLoading(false); }
}

// CSV -> array de objetos
function readCsv(file){
  return new Promise((resolve, reject)=>{
    if(!file) return resolve({rows:[], headers:[]});
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transform: (v)=> v===undefined? null : v,
      complete: (res)=> resolve({rows: res.data||[], headers: res.meta?.fields||[]}),
      error: (err)=> reject(err)
    });
  });
}

async function chunkedUpsert(table, rows, chunkSize=500){
  for(let i=0;i<rows.length;i+=chunkSize){
    const slice = rows.slice(i, i+chunkSize);
    const { error } = await db.from(table).upsert(slice);
    if(error) throw error;
  }
}

async function cargarCsvYSync(ev){
  ev.preventDefault();
  const fileSub = $a('csvSubtareas').files[0] || null;
  const fileHis = $a('csvHistorias').files[0] || null;
  if(!fileSub && !fileHis){
    alert('Selecciona al menos un CSV.');
    return;
  }

  CM.showLoading(true);
  $a('uploadMsg').textContent = 'Leyendo CSV…';
  try{
    let msg = [];
    if(fileSub){
      const {rows} = await readCsv(fileSub);
      if(rows.length){
        await chunkedUpsert(CM.TABLES.SUBTAREAS_ACTUAL, rows);
        msg.push(`Subtareas: ${rows.length} filas → SUBTAREASACTUAL`);
      }else{
        msg.push('Subtareas: 0 filas (sin cambios)');
      }
    }
    if(fileHis){
      const {rows} = await readCsv(fileHis);
      if(rows.length){
        await chunkedUpsert(CM.TABLES.HISTORIAS_ACTUAL, rows);
        msg.push(`Historias: ${rows.length} filas → HISTORIASACTUAL`);
      }else{
        msg.push('Historias: 0 filas (sin cambios)');
      }
    }
    $a('uploadMsg').textContent = msg.join(' · ');

    // Intentar correr función de sincronización si existe
    try{
      const { data, error } = await db.rpc(CM.FN_SYNC_NAME);
      if(error) throw error;
      $a('uploadMsg').textContent += ' · Sincronización OK';
    }catch(syncErr){
      console.warn('No se pudo ejecutar RPC de sincronización:', syncErr?.message||syncErr);
      $a('uploadMsg').textContent += ' · (No se ejecutó la sincronización — revisa el nombre de la función)';
    }

    alert('Carga finalizada.');
  }catch(e){
    console.error(e);
    alert('Error durante la carga/sync: '+(e?.message||e));
    $a('uploadMsg').textContent = 'Ocurrió un error.';
  }finally{
    CM.showLoading(false);
  }
}

document.getElementById('frmSprint').addEventListener('submit', guardarSprint);
document.getElementById('btnCargarTodo').addEventListener('click', cargarCsvYSync);
// hook vacío por si luego quieres algo al entrar a admin
window._hooks = window._hooks || {};
window._hooks['view-admin'] = ()=>{};

})();