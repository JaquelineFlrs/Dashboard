(function(){
'use strict';
const CM = window._commons;
const db = CM.db;

// subtareas.js — tabla de selección mostrar/no mostrar
const CANDIDATES = {
  ID: ['id','ID','ID de Subtarea','ID de subtarea','ID de Tarea','ID_de_Tarea','ID_subtarea','id_subtarea'],
  NOMBRE: ['Subtarea','subtarea','Nombre','nombre','Título','titulo'],
  PROPIETARIO: ['Propietario','propietario','Owner','owner','Asignado a','asignado'],
  HORAS: ['Horas','Duración (hrs)','Duracion (hrs)','Duración','Duracion','Horas estimadas','horas'],
  MOSTRAR: ['mostrar','Mostrar']
};

let subtareasRaw = [];
let subKeys = {};

function findKey(obj, candidates){
  for(const k of candidates){ if(k in obj) return k; }
  return null;
}

async function loadSubtareas(){
  try{
    CM.showLoading(true);
    const { data, error } = await db.from(CM.TABLES.SUBTAREAS).select('*').limit(5000);
    if(error){ console.error('SUBTAREAS', error); return; }
    subtareasRaw = data || [];
    const sample = subtareasRaw.find(r=>r) || {};
    subKeys = {
      id: findKey(sample, CANDIDATES.ID) || 'id',
      nombre: findKey(sample, CANDIDATES.NOMBRE) || 'nombre',
      propietario: findKey(sample, CANDIDATES.PROPIETARIO) || 'propietario',
      horas: findKey(sample, CANDIDATES.HORAS) || 'horas',
      mostrar: findKey(sample, CANDIDATES.MOSTRAR) || 'mostrar',
    };
    renderSubtareas();
  }catch(e){
    console.error(e);
  }finally{ CM.showLoading(false); }
}

function renderSubtareas(){
  const thead = document.getElementById('theadSubSel');
  const tbody = document.getElementById('tbodySubSel');
  const rows = subtareasRaw.map(r=> ({
    [subKeys.id]: r[subKeys.id],
    [subKeys.nombre]: r[subKeys.nombre],
    [subKeys.propietario]: r[subKeys.propietario],
    [subKeys.horas]: r[subKeys.horas],
    [subKeys.mostrar]: r[subKeys.mostrar] ? 'Sí':'No'
  }));
  CM.renderTable(thead, tbody, rows);

  // Insertar controles de cambio rápido
  const idIdx = Object.keys(rows[0]||{}).indexOf(subKeys.id);
  const mostrarIdx = Object.keys(rows[0]||{}).indexOf(subKeys.mostrar);
  const t = document.getElementById('tblSubSel');
  if(!t) return;
  Array.from(t.querySelectorAll('tbody tr')).forEach(tr=>{
    const id = tr.children[idIdx]?.textContent;
    const isYes = (tr.children[mostrarIdx]?.textContent||'').toLowerCase().startsWith('s');
    const btn = document.createElement('button');
    btn.className = 'btn small';
    btn.textContent = isYes? 'Ocultar':'Mostrar';
    btn.addEventListener('click', ()=> toggleMostrar(id, !isYes));
    tr.appendChild(document.createElement('td')).appendChild(btn);
  });
}

async function toggleMostrar(id, value){
  try{
    CM.showLoading(true);
    const { error } = await db.from(CM.TABLES.SUBTAREAS).update({ mostrar: value }).eq(subKeys.id, id);
    if(error) throw error;
    // local
    const row = subtareasRaw.find(r=> String(r[subKeys.id])===String(id));
    if(row){ row[subKeys.mostrar] = value; }
    renderSubtareas();
  }catch(e){
    console.error(e);
    alert('No se pudo actualizar.');
  }finally{ CM.showLoading(false); }
}

// hook
window._hooks = window._hooks || {};
window._hooks['view-subtareas'] = loadSubtareas;

})();