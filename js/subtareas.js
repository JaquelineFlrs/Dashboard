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
// --- ENHANCEMENTS START ---
// Estado UI persistente
const SUB_UI_KEY = 'subtareas_ui_v1';
let ui = { q:'', onlyShown:false, sort:{ key:null, dir:1 } };
try{ ui = Object.assign(ui, JSON.parse(localStorage.getItem(SUB_UI_KEY)||'{}')); }catch{}
// util debounce
function debounce(fn,ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }
// CSV export helper
function toCsv(rows, headers){
  const esc=(v)=>{
    if(v==null) return '';
    const s=String(v).replaceAll('"','""');
    return /[",\n]/.test(s) ? '"'+s+'"' : s;
  };
  const lines=[];
  lines.push(headers.map(h=>esc(h.label)).join(','));
  for(const r of rows){
    lines.push(headers.map(h=> esc(r[h.key])).join(','));
  }
  return lines.join('\n');
}
// --- ENHANCEMENTS END ---


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
  renderSubtareas(); updateCounter();
}

function getFiltered(){
  const q = (ui.q||'').toLowerCase().trim();
  const onlyShown = !!ui.onlyShown;
    const res = subtareasRaw.filter(r=>{
    const txt = [r[subKeys.nombre], r[subKeys.propietario], r[subKeys.id]].filter(Boolean).join(' ').toLowerCase();
    const okQ = q ? txt.includes(q) : true;
    const okShown = onlyShown ? normalizeBool(r[subKeys.mostrar]) : true;
    return okQ && okShown;
  });
  return applySort(res);
}


function isTerminada(row){
  const v = row[subKeys.fecha_cierre_marcada];
  return v !== null && v !== undefined && String(v).trim() !== '';
}
function applySort(arr){
  const s = ui.sort;
  if(!s.key) return arr;
  const key = s.key;
  const dir = s.dir;
  return arr.slice().sort((a,b)=>{
    const av = (a[key] ?? '').toString().toLowerCase();
    const bv = (b[key] ?? '').toString().toLowerCase();
    if(av<bv) return -1*dir;
    if(av>bv) return 1*dir;
    return 0;
  });
  return applySort(res);
}

async function updateTerminada(id, checked){
  try{
    const today = new Date();
    // Format YYYY-MM-DD in local timezone
    const y = today.getFullYear();
    const m = String(today.getMonth()+1).padStart(2,'0');
    const d = String(today.getDate()).padStart(2,'0');
    const value = checked ? `${y}-${m}-${d}` : null;

    const client = (typeof sb!=='undefined' && sb) ? sb : (window.supabase || null);
    if(!client){ console.warn('Supabase client not found'); return; }

    const { data, error } = await client
      .from('SUBTAREAS')
      .update({ fecha_cierre_marcada: value })
      .eq('ID de Tarea', id);

    if(error){ console.error(error); alert('Error al actualizar Terminada'); return; }

    // Sync in-memory row too
    const row = subtareasRaw.find(x=> x[subKeys.id]===id);
    if(row){ row[subKeys.fecha_cierre_marcada] = value; }
  }catch(e){
    console.error(e);
  }
}
async function bulkSetTerminada(checked, ids){
  // Batch update
  const client = (typeof sb!=='undefined' && sb) ? sb : (window.supabase || null);
  if(!client){ console.warn('Supabase client not found'); return; }
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth()+1).padStart(2,'0');
  const d = String(today.getDate()).padStart(2,'0');
  const value = checked ? `${y}-${m}-${d}` : null;
  const { data, error } = await client
    .from('SUBTAREAS')
    .update({ fecha_cierre_marcada: value })
    .in('ID de Tarea', ids);
  if(error){ console.error(error); alert('Error en marcado masivo'); return; }
  // Update in-memory
  subtareasRaw.forEach(r=>{ if(ids.includes(r[subKeys.id])) r[subKeys.fecha_cierre_marcada=value]; });
}

function updateCounter(){
  const total = subtareasRaw.length;
  const filtered = getFiltered().length;
  const shown = getFiltered().filter(r=> normalizeBool(r[subKeys.mostrar])).length;
  const el = $sub('subCounter');
  if(el) el.textContent = `Filtradas: ${filtered.toLocaleString('es-MX')} · Mostradas: ${shown.toLocaleString('es-MX')} / Total: ${total.toLocaleString('es-MX')}`;
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
      <td><input type="checkbox" class="chkTerminada" ${isTerminada(r)?'checked':''} data-id="${r[subKeys.id]}"></td><td><input type="checkbox" class="chkMostrar" ${checked}></td>
      <td>${escapeHtml(r[subKeys.id])}</td>
      <td>${escapeHtml(r[subKeys.nombre])}</td>
      ${subKeys.propietario? `<td>${escapeHtml(r[subKeys.propietario])}</td>`:''}
      ${subKeys.horas? `<td>${escapeHtml(r[subKeys.horas])}</td>`:''}
    </tr>`;
  }).join('');


  // Master checkbox toggles all currently filtered rows
  const chkAll = document.getElementById('chkAll');
  if(chkAll){
    chkAll.addEventListener('change', async (ev)=>{
      const ids = Array.from(document.querySelectorAll('#tbodySubSel tr[data-id]')).map(tr=> tr.getAttribute('data-id'));
      if(!ids.length) return;
      await bulkSetMostrar(ev.target.checked, ids);
    });
  }
  // Header sorting
  document.querySelectorAll('#theadSubSel th.sortable').forEach(th=>{
    th.addEventListener('click', ()=>{
      const key = th.getAttribute('data-key');
      if(ui.sort.key===key){ ui.sort.dir *= -1; } else { ui.sort.key=key; ui.sort.dir=1; }
      localStorage.setItem(SUB_UI_KEY, JSON.stringify(ui));
      renderSubtareas(); updateCounter();
    });
  });
  updateCounter();

  document.querySelectorAll('.chkTerminada').forEach(chk=>{
    chk.addEventListener('change', async (ev)=>{
      const id = ev.target.getAttribute('data-id');
      await updateTerminada(id, ev.target.checked);
      renderSubtareas();
    });
  });
  document.querySelectorAll('.chkMostrar').forEach(chk=>{
    chk.addEventListener('change', async (ev)=>{
      const tr = ev.target.closest('tr');
      const id = tr?.getAttribute('data-id');
      if(!id) return;
      try{
        const payload={}; payload[subKeys.mostrar] = ev.target.checked ? 1 : 0;
        const { error } = await window.db.from(CM.TABLES.SUBTAREAS).update(payload).eq(subKeys.id, id);
        if(error) throw error;
        const row = subtareasRaw.find(x=> String(x[subKeys.id])===String(id));
        if(row) row[subKeys.mostrar]=ev.target.checked;
      }catch(e){
        console.error(e); alert('No se pudo actualizar "mostrar".'); ev.target.checked = !ev.target.checked;
      }
    });
  });
  return applySort(res);
}

const onSearch = debounce(()=>{ ui.q = $sub('subSearch').value||''; localStorage.setItem(SUB_UI_KEY, JSON.stringify(ui)); renderSubtareas(); updateCounter(); }, 200);
$sub('subSearch').addEventListener('input', onSearch);
$sub('subOnlyShown').addEventListener('change', ()=>{ ui.onlyShown = $sub('subOnlyShown').checked; localStorage.setItem(SUB_UI_KEY, JSON.stringify(ui)); renderSubtareas(); updateCounter(); });
$sub('btnMarkAll').addEventListener('click', async ()=>{
  const ids = Array.from(document.querySelectorAll('#tbodySubSel tr[data-id]')).map(tr=> tr.getAttribute('data-id'));
  if(!ids.length) return;
  await bulkSetMostrar(true, ids);
});

// Export CSV de las filas filtradas (incluye columnas dinámicas detectadas)
$sub('btnExportCsv')?.addEventListener('click', ()=>{
  const rows = getFiltered();
  const headers = [
    { key: subKeys.id, label: subKeys.id },
    { key: subKeys.nombre, label: subKeys.nombre },
  ];
  if(subKeys.propietario) headers.push({ key: subKeys.propietario, label: subKeys.propietario });
  if(subKeys.horas) headers.push({ key: subKeys.horas, label: subKeys.horas });
  headers.push({ key: subKeys.mostrar, label: subKeys.mostrar }); headers.push({ key: subKeys.fecha_cierre_marcada, label: 'fecha_cierre_marcada' });
  const csv = toCsv(rows, headers);
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'subtareas_filtrado.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
});
// Restaurar estado UI (query/checkbox)
(function restoreUI(){
  if(ui.q) $sub('subSearch').value = ui.q;
  if(ui.onlyShown) $sub('subOnlyShown').checked = true;
})();

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
      const payload = { mostrar: value ? 1 : 0 };
      const { error } = await window.db.from(CM.TABLES.SUBTAREAS).update(payload).in('id', slice);
      if(error) throw error;
      // update local
      subtareasRaw.forEach(r=>{ if(slice.includes(String(r['id']))) r['mostrar']=value; });
    }
    renderSubtareas(); updateCounter();
  }catch(e){
    console.error(e); alert('No se pudo aplicar el cambio masivo.');
  }finally{ CM.showLoading(false); }
}

// hook
window._hooks = window._hooks || {}; window._hooks['view-subtareas'] = loadSubtareas;
loadSubtareas();

})();
