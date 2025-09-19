(function(){
'use strict';
const CM = window._commons;
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

const $sub = (id)=> document.getElementById(id);

function findKey(obj, list){ return list.find(k=> Object.prototype.hasOwnProperty.call(obj,k)); }
function normalizeBool(v){ return (v===true || v==='true' || v===1 || v==='1'); }
function escapeHtml(x){ if(x==null) return ''; return String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

async function loadSubtareas(){
  const { data, error } = await window.db.from(CM.TABLES.SUBTAREAS).select('*').limit(5000);
  if(error){ console.error('SUBTAREAS', error); return; }
  subtareasRaw = data || [];
  const sample = subtareasRaw.find(r=>r) || {};
  subKeys = {
    id: findKey(sample, CANDIDATES.ID) || 'id',
    nombre: findKey(sample, CANDIDATES.NOMBRE) || 'nombre',
    propietario: findKey(sample, CANDIDATES.PROPIETARIO),
    horas: findKey(sample, CANDIDATES.HORAS),
    mostrar: findKey(sample, CANDIDATES.MOSTRAR) || 'mostrar',
  };
  renderSubtareas();
}

function getFiltered(){
  const q = ($sub('subSearch').value||'').toLowerCase().trim();
  const onlyShown = $sub('subOnlyShown').checked;
  return subtareasRaw.filter(r=>{
    const txt = [r[subKeys.nombre], r[subKeys.propietario], r[subKeys.id]].filter(Boolean).join(' ').toLowerCase();
    const okQ = q ? txt.includes(q) : true;
    const okShown = onlyShown ? normalizeBool(r[subKeys.mostrar]) : true;
    return okQ && okShown;
  });
}

function renderSubtareas(){
  const head = $sub('theadSubSel'), body = $sub('tbodySubSel');
  const rows = getFiltered();
  head.innerHTML = `<tr>
    <th>Mostrar</th>
    <th>${subKeys.id}</th>
    <th>${subKeys.nombre}</th>
    ${subKeys.propietario? `<th>${subKeys.propietario}</th>`:''}
    ${subKeys.horas? `<th>${subKeys.horas}</th>`:''}
  </tr>`;
  if(rows.length===0){ body.innerHTML = '<tr><td colspan="5">Sin datos</td></tr>'; return; }
  body.innerHTML = rows.map(r=>{
    const checked = normalizeBool(r[subKeys.mostrar]) ? 'checked' : '';
    return `<tr data-id="${escapeHtml(r[subKeys.id])}">
      <td><input type="checkbox" class="chkMostrar" ${checked}></td>
      <td>${escapeHtml(r[subKeys.id])}</td>
      <td>${escapeHtml(r[subKeys.nombre])}</td>
      ${subKeys.propietario? `<td>${escapeHtml(r[subKeys.propietario])}</td>`:''}
      ${subKeys.horas? `<td>${escapeHtml(r[subKeys.horas])}</td>`:''}
    </tr>`;
  }).join('');

  document.querySelectorAll('.chkMostrar').forEach(chk=>{
    chk.addEventListener('change', async (ev)=>{
      const tr = ev.target.closest('tr');
      const id = tr?.getAttribute('data-id');
      if(!id) return;
      try{
        const payload={}; payload[subKeys.mostrar]=ev.target.checked;
        const { error } = await window.db.from(CM.TABLES.SUBTAREAS).update(payload).eq(subKeys.id, id);
        if(error) throw error;
        const row = subtareasRaw.find(x=> String(x[subKeys.id])===String(id));
        if(row) row[subKeys.mostrar]=ev.target.checked;
      }catch(e){
        console.error(e); alert('No se pudo actualizar "mostrar".'); ev.target.checked = !ev.target.checked;
      }
    });
  });
}

$sub('subSearch').addEventListener('input', renderSubtareas);
$sub('subOnlyShown').addEventListener('change', renderSubtareas);
$sub('btnMarkAll').addEventListener('click', async ()=>{
  const ids = Array.from(document.querySelectorAll('#tbodySubSel tr[data-id]')).map(tr=> tr.getAttribute('data-id'));
  if(!ids.length) return;
  await bulkSetMostrar(true, ids);
});
$sub('btnUnmarkAll').addEventListener('click', async ()=>{
  const ids = Array.from(document.querySelectorAll('#tbodySubSel tr[data-id]')).map(tr=> tr.getAttribute('data-id'));
  if(!ids.length) return;
  await bulkSetMostrar(false, ids);
});

async function bulkSetMostrar(value, ids){
  CM.showLoading(true);
  const chunk=500;
  try{
    for(let i=0;i<ids.length;i+=chunk){
      const slice = ids.slice(i,i+chunk);
      const payload={ mostrar:value };
      const { error } = await window.db.from(CM.TABLES.SUBTAREAS).update(payload).in('id', slice);
      if(error) throw error;
      // update local
      subtareasRaw.forEach(r=>{ if(slice.includes(String(r['id']))) r['mostrar']=value; });
    }
    renderSubtareas();
  }catch(e){
    console.error(e); alert('No se pudo aplicar el cambio masivo.');
  }finally{ CM.showLoading(false); }
}

// hook
window._hooks['view-subtareas'] = loadSubtareas;
loadSubtareas();

})();
