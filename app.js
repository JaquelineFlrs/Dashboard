// == Helpers ==
let supa = null;
// == Default Supabase (preset) ==
const DEFAULT_SUPABASE_URL = "https://yuqnnbqvjsccpnygdznj.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1cW5uYnF2anNjY3BueWdkem5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MTgwOTksImV4cCI6MjA3NDQ5NDA5OX0.DIkuViSv5I42s0fB4Y_RO9YLAC03qcV2P6iXtpOXysw";

function getSettings(){ return { url: localStorage.getItem('SUPABASE_URL') || DEFAULT_SUPABASE_URL, key: localStorage.getItem('SUPABASE_ANON_KEY') || DEFAULT_SUPABASE_ANON_KEY }; }
function ensureClient(){
  const { url, key } = getSettings();
  if(!url || !key){ return null; }
  if(!supa){ supa = window.supabase.createClient(url, key); }
  return supa;
}
function fmt(n){ return (n==null?'':(+n).toFixed(2)); }
function toHours(v){
  if(v==null || v==='') return null;
  if(typeof v==='number') return v;
  const s = String(v).trim();
  if(/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);        // decimal
  const m = s.match(/^(\d{1,2})[:hH](\d{1,2})$/);           // HH:MM
  if(m){ const h = parseInt(m[1],10), mm = parseInt(m[2],10); return h + mm/60; }
  return null;
}
function tableFromRows(el, headers, rows){
  el.innerHTML = '';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr>'+headers.map(h=>`<th class="text-left py-1 pr-4">${h}</th>`).join('')+'</tr>';
  const tbody = document.createElement('tbody');
  rows.forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = headers.map(h=>`<td class="py-1 pr-4">${r[h]??''}</td>`).join('');
    tbody.appendChild(tr);
  });
  el.appendChild(thead); el.appendChild(tbody);
}
function downloadCSV(filename, rows){
  const headers = Object.keys(rows[0]||{});
  const csv = [headers.join(','), ...rows.map(r=>headers.map(h=>JSON.stringify(r[h]??'')).join(','))].join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}
function downloadXLSX(filename, sheets){
  const wb = XLSX.utils.book_new();
  for(const [name, rows] of Object.entries(sheets)){
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  XLSX.writeFile(wb, filename);
}

// == Settings modal ==
document.getElementById('btnSettings').onclick = () => {
  const d = document.getElementById('dlgSettings');
  const {url, key} = getSettings();
  document.getElementById('inpUrl').value = url;
  document.getElementById('inpKey').value = key;
  d.showModal();
};
document.getElementById('btnSaveSettings').onclick = (e) => {
  e.preventDefault();
  localStorage.setItem('SUPABASE_URL', document.getElementById('inpUrl').value.trim());
  localStorage.setItem('SUPABASE_ANON_KEY', document.getElementById('inpKey').value.trim());
  document.getElementById('dlgSettings').close();
  supa = null; loadAll();
};

// == Configurador ==
async function getSprintActivo(){
  const c = ensureClient(); if(!c) return null;
  const { data } = await c.from('sprint').select('*').eq('estado','activo').order('id',{ascending:false}).limit(1);
  return data?.[0]||null;
}
document.getElementById('btnCrearSprint').onclick = async () => {
  const c = ensureClient(); if(!c){ document.getElementById('sprintMsg').textContent='Configura Supabase en Ajustes'; return; }
  const nombre = document.getElementById('sprintNombre').value.trim();
  const fi = document.getElementById('sprintInicio').value;
  const ff = document.getElementById('sprintFin').value;
  const { data, error } = await c.from('sprint').insert({ nombre, fecha_inicio: fi, fecha_fin: ff, estado: 'activo' }).select().single();
  document.getElementById('sprintMsg').textContent = error ? error.message : `Sprint creado: ${data?.id}`;
  await loadAll();
};
document.getElementById('btnAddParticipante').onclick = async () => {
  const c = ensureClient(); if(!c) return;
  const nombre = document.getElementById('partNombre').value.trim();
  const horas = parseFloat(document.getElementById('partHoras').value || '8');
  const { data, error } = await c.from('participante').insert({ nombre, horas_dia: horas }).select().single();
  if(error){ alert(error.message); return; }
  await c.rpc('set_participante_activo_default', { p_participante_id: data.id });
  await loadParticipantes();
};
document.getElementById('btnAddAusencia').onclick = async () => {
  const c = ensureClient(); if(!c) return;
  const sprint = await getSprintActivo(); if(!sprint) return;
  const nombre = document.getElementById('ausNombre').value.trim();
  const fecha = document.getElementById('ausFecha').value;
  const horas = parseFloat(document.getElementById('ausHoras').value || '0');
  const { data: pers } = await c.from('participante').select('*').ilike('nombre', nombre).limit(1);
  const p = pers?.[0]; if(!p){ alert('Participante no encontrado'); return; }
  await c.from('sprint_ausencia').insert({ sprint_id: sprint.id, participante_id: p.id, fecha, horas });
  await loadAusencias();
};
document.getElementById('btnCerrarSprint').onclick = async () => {
  const c = ensureClient(); if(!c) return;
  const s = await getSprintActivo(); if(!s) return;
  await c.from('sprint').update({ estado: 'cerrado' }).eq('id', s.id);
  await loadAll();
};

async function loadParticipantes(){
  const c = ensureClient(); if(!c) return;
  const { data } = await c.from('participante').select('*').order('id');
  document.getElementById('participantesList').textContent = (data||[]).map(p => `${p.nombre} (${p.horas_dia||8} h/día)`).join(' · ');
}
async function loadAusencias(){
  const c = ensureClient(); if(!c) return;
  const s = await getSprintActivo(); if(!s) return;
  const { data } = await c.from('sprint_ausencia').select('fecha, horas, participante(nombre)').eq('sprint_id', s.id).order('fecha');
  const txt = (data||[]).map(a => `${a.participante?.nombre||'¿?'}: ${a.fecha} (${a.horas}h)`).join(' · ');
  document.getElementById('ausenciasList').textContent = txt;
}

// == CSV Upload & Sync ==
let mapHist = null, mapSubt = null;
async function buildMapper(file, target, kind){
  const out = document.getElementById(target);
  const reader = new FileReader();
  reader.onload = (e) => {
    const wb = XLSX.read(e.target.result, {type:'binary'});
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, {defval:''});
    const headers = Object.keys(rows[0]||{});
    const needed = kind==='hist'? ['zoho_historia_id','codigo','titulo','lista','propietario','duracion']
                                 : ['zoho_subtarea_id','zoho_historia_id','titulo','propietario_zoho','estado_zoho','duracion_zoho'];
    const sel = (name) => `<div class="mb-2"><label class="text-xs text-slate-500">${name}</label><select class="map-${kind} border rounded px-2 py-1 w-full">${['(ninguna)',...headers].map(h=>`<option>${h}</option>`).join('')}</select></div>`;
    out.innerHTML = `<div class="grid grid-cols-2 gap-2">${needed.map(n=>sel(n)).join('')}</div>`;
    if(kind==='hist') mapHist = { headers, rows };
    else mapSubt = { headers, rows };
  };
  reader.readAsBinaryString(file);
}
document.getElementById('csvHistorias').addEventListener('change', (e)=>{
  if(e.target.files?.[0]) buildMapper(e.target.files[0], 'mapHistorias', 'hist');
});
document.getElementById('csvSubtareas').addEventListener('change', (e)=>{
  if(e.target.files?.[0]) buildMapper(e.target.files[0], 'mapSubtareas', 'subt');
});

async function uploadMapped(kind){
  const c = ensureClient(); if(!c){ alert('Configura Supabase'); return; }
  const sprint = await getSprintActivo(); if(!sprint){ alert('No hay sprint activo'); return; }
  const container = document.getElementById(kind==='hist'?'mapHistorias':'mapSubtareas');
  const selects = container.querySelectorAll(`.map-${kind}`);
  const needed = kind==='hist'? ['zoho_historia_id','codigo','titulo','lista','propietario','duracion']
                               : ['zoho_subtarea_id','zoho_historia_id','titulo','propietario_zoho','estado_zoho','duracion_zoho'];
  const map = {};
  selects.forEach((s, i)=>{ map[needed[i]] = s.value==='(ninguna)'? null : s.value; });
  const source = (kind==='hist'? mapHist : mapSubt);
  if(!source){ alert('Primero selecciona un archivo'); return; }
  const rows = source.rows.map(r=>{
    const o = { sprint_id: sprint.id };
    for(const [k,v] of Object.entries(map)){
      o[k] = v ? r[v] : null;
    }
    // normalizar duración
    if(kind==='hist' && o.duracion!=null) o.duracion = toHours(o.duracion);
    if(kind==='subt' && o.duracion_zoho!=null) o.duracion_zoho = toHours(o.duracion_zoho);
    return o;
  });
  // Insertar a tablas raw
  if(kind==='hist'){
    for(let i=0;i<rows.length;i+=500){
      const chunk = rows.slice(i,i+500);
      await c.from('zoho_historia_raw').upsert(chunk, { onConflict: 'sprint_id,zoho_historia_id' });
    }
  }else{
    for(let i=0;i<rows.length;i+=500){
      const chunk = rows.slice(i,i+500);
      await c.from('zoho_subtarea_raw').upsert(chunk, { onConflict: 'sprint_id,zoho_subtarea_id' });
    }
  }
  alert('Cargado correctamente');
}
document.getElementById('btnUploadHistorias').onclick = ()=>uploadMapped('hist');
document.getElementById('btnUploadSubtareas').onclick = ()=>uploadMapped('subt');

document.getElementById('btnSync').onclick = async () => {
  const c = ensureClient(); if(!c) return;
  const s = await getSprintActivo(); if(!s){ document.getElementById('syncMsg').textContent='No hay sprint activo.'; return; }
  await c.rpc('fn_sync_historias', { p_sprint: s.id });
  await c.rpc('fn_sync_subtareas', { p_sprint: s.id });
  document.getElementById('syncMsg').textContent = 'Sincronización ejecutada.';
  await loadAll();
};

// == Dashboard ==
let burndownChart = null;
async function loadKPIs(){
  const c = ensureClient(); if(!c) return;
  const s = await getSprintActivo(); if(!s) return;
  const { data: kpis } = await c.from('vw_kpis_top').select('*').eq('sprint_id', s.id).limit(1);
  const k = kpis?.[0]||{};
  const planeadas = k.horas_planeadas||0, terminadas = k.horas_terminadas||0, pendientes = Math.max(0, planeadas-terminadas);
  const avance = planeadas>0 ? (terminadas/planeadas*100) : 0;
  document.getElementById('kpiPlaneadas').textContent = fmt(planeadas);
  document.getElementById('kpiTerminadas').textContent = fmt(terminadas);
  document.getElementById('kpiPendientes').textContent = fmt(pendientes);
  document.getElementById('kpiAvance').textContent = `${fmt(avance)}%`;
  document.getElementById('bdRange').textContent = `${s.fecha_inicio} → ${s.fecha_fin}`;

  const { data: est } = await c.from('vw_burndown_estimado').select('*').eq('sprint_id', s.id).order('dia_index');
  const { data: real } = await c.from('burndown_daily').select('*').eq('sprint_id', s.id).order('dia_index');
  const labels = (est||real||[]).map(e=>e.fecha);
  const dsEst = (est||[]).map(e=>e.horas_estimadas);
  const dsReal = (real||[]).map(r=>r.horas_reales);
  const ctx = document.getElementById('chartBurndown');
  if(burndownChart) burndownChart.destroy();
  burndownChart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [
      { type: 'line', label: 'Estimado', data: dsEst, tension: .2 },
      { type: 'bar', label: 'Real', data: dsReal }
    ]},
    options: { responsive: true, maintainAspectRatio: false }
  });

  const { data: per } = await c.from('vw_resumen_por_persona').select('*').eq('sprint_id', s.id).order('persona');
  const rowsP = (per||[]).map(r=>({ Persona: r.persona, 'Planeadas': fmt(r.horas_planeadas), 'Terminadas': fmt(r.horas_terminadas) }));
  tableFromRows(document.getElementById('tblPorPersona'), ['Persona','Planeadas','Terminadas'], rowsP);

  const { data: lis } = await c.from('vw_resumen_por_lista').select('*').eq('sprint_id', s.id).order('lista');
  const rowsL = (lis||[]).map(r=>({ Lista: r.lista, 'Horas totales': fmt(r.horas_total), 'Horas abiertas': fmt(r.horas_abiertas) }));
  tableFromRows(document.getElementById('tblPorLista'), ['Lista','Horas totales','Horas abiertas'], rowsL);
}

// == Management ==
document.getElementById('btnFiltrarMgmt').onclick = loadMgmt;
document.getElementById('btnExportMgmt').onclick = async () => {
  const rows = await getMgmtRows();
  if(rows.length) downloadCSV('management.csv', rows);
};
async function getMgmtRows(){
  const c = ensureClient(); if(!c) return [];
  const s = await getSprintActivo(); if(!s) return [];
  let query = c.from('sprint_subtarea').select('subtarea_key, titulo, estado_zoho, visible, terminado_manual, lista, propietario_zoho, duracion_zoho').eq('sprint_id', s.id);
  const fl = document.getElementById('fLista').value.trim();
  const fe = document.getElementById('fEstado').value.trim();
  const fp = document.getElementById('fPersona').value.trim();
  if(fl) query = query.ilike('lista', `%${fl}%`);
  if(fe) query = query.ilike('estado_zoho', `%${fe}%`);
  if(fp) query = query.ilike('propietario_zoho', `%${fp}%`);
  const { data } = await query.order('titulo').limit(1000);
  return (data||[]).map(r=>({ Titulo: r.titulo, Lista: r.lista, Estado: r.estado_zoho, Persona: r.propietario_zoho, 'Horas': fmt(r.duracion_zoho), Visible: r.visible, Terminado: r.terminado_manual }));
}
async function loadMgmt(){
  const c = ensureClient(); if(!c) return;
  const s = await getSprintActivo(); if(!s) return;
  const { data } = await c.from('sprint_subtarea').select('subtarea_key, titulo, estado_zoho, visible, terminado_manual, lista, propietario_zoho').eq('sprint_id', s.id).order('titulo').limit(200);
  const box = document.getElementById('mgmtList');
  box.innerHTML = '';
  (data||[]).forEach(row => {
    const div = document.createElement('div');
    div.className = 'flex items-center gap-2 py-1 border-b';
    div.innerHTML = `<span class="grow">${row.titulo} <span class="text-slate-400">[${row.lista||''} · ${row.estado_zoho||''} · ${row.propietario_zoho||''}]</span></span>`+
      `<label class="flex items-center gap-1 text-xs"><input type="checkbox" ${row.visible?'checked':''} data-k="${row.subtarea_key}" data-f="visible"/> Visible</label>`+
      `<label class="flex items-center gap-1 text-xs"><input type="checkbox" ${row.terminado_manual?'checked':''} data-k="${row.subtarea_key}" data-f="terminado_manual"/> Terminado</label>`;
    box.appendChild(div);
  });
  box.querySelectorAll('input[type=checkbox]').forEach(chk => {
    chk.addEventListener('change', async (e) => {
      const k = e.target.dataset.k;
      const f = e.target.dataset.f;
      const v = e.target.checked;
      await ensureClient().from('sprint_subtarea').update({ [f]: v }).eq('subtarea_key', k);
    });
  });
}

// == Cotejo ==
document.getElementById('btnExportCotejo').onclick = async () => {
  const sheets = {};
  const t = await getCotejoTotales(); sheets['Totales'] = [t];
  sheets['Por lista'] = await getCotejoLista();
  sheets['Por historia'] = await getCotejoHistoria();
  downloadXLSX('cotejo.xlsx', sheets);
};
async function getCotejoTotales(){
  const c = ensureClient(); if(!c) return {};
  const s = await getSprintActivo(); if(!s) return {};
  const { data } = await c.from('vw_cotejo_totales').select('*').eq('sprint_id', s.id);
  const t = data?.[0] || { horas_historias: 0, horas_subtareas: 0 };
  return { 'Horas historias': fmt(t.horas_historias), 'Horas subtareas': fmt(t.horas_subtareas), 'Diferencia': fmt((t.horas_historias||0)-(t.horas_subtareas||0)) };
}
async function getCotejoLista(){
  const c = ensureClient(); if(!c) return [];
  const s = await getSprintActivo(); if(!s) return [];
  const { data } = await c.from('vw_cotejo_por_lista').select('*').eq('sprint_id', s.id);
  return (data||[]).map(r=>({ Lista: r.lista, 'Horas subtareas': fmt(r.horas_subtareas) }));
}
async function getCotejoHistoria(){
  const c = ensureClient(); if(!c) return [];
  const s = await getSprintActivo(); if(!s) return [];
  const { data } = await c.from('vw_cotejo_por_historia').select('*').eq('sprint_id', s.id);
  return (data||[]).map(r=>({ Codigo: r.codigo, Titulo: r.titulo, 'Horas historia': fmt(r.horas_historia), 'Horas subtareas': fmt(r.horas_subtareas), Diferencia: fmt(r.diferencia) }));
}
async function loadCotejo(){
  const t = await getCotejoTotales();
  document.getElementById('cotejoBox').textContent = `Historias: ${t['Horas historias']}h · Subtareas: ${t['Horas subtareas']}h · Diferencia: ${t['Diferencia']}h`;
  const l = await getCotejoLista();
  tableFromRows(document.getElementById('tblCotejoLista'), ['Lista','Horas subtareas'], l);
  const h = await getCotejoHistoria();
  tableFromRows(document.getElementById('tblCotejoHistoria'), ['Codigo','Titulo','Horas historia','Horas subtareas','Diferencia'], h);
}

// == Entrega ==
async function loadEntrega(){
  const c = ensureClient(); if(!c) return;
  const s = await getSprintActivo(); if(!s) return;
  const { data } = await c.from('sprint_historia').select('historia_key, codigo, titulo, aceptada_manual, observaciones').eq('sprint_id', s.id).order('codigo');
  const box = document.getElementById('entregaList');
  box.innerHTML = '';
  (data||[]).forEach(row => {
    const div = document.createElement('div');
    div.className = 'flex items-center gap-2 py-1 border-b';
    div.innerHTML = `<span class="grow">${row.codigo||''} — ${row.titulo}</span>`+
      `<label class="flex items-center gap-1 text-xs"><input type="checkbox" ${row.aceptada_manual?'checked':''} data-k="${row.historia_key}" data-f="aceptada_manual"/> Aceptada</label>`+
      `<input class="border rounded px-1 text-xs" placeholder="Observaciones" value="${row.observaciones||''}" data-k="${row.historia_key}" data-f="observaciones"/>`;
    box.appendChild(div);
  });
  box.querySelectorAll('input[type=checkbox]').forEach(chk => {
    chk.addEventListener('change', async (e) => {
      const k = e.target.dataset.k, f = e.target.dataset.f, v = e.target.checked;
      await ensureClient().from('sprint_historia').update({ [f]: v }).eq('historia_key', k);
    });
  });
  box.querySelectorAll('input[type=text],input:not([type])').forEach(inp => {
    let t = null;
    inp.addEventListener('input', e => {
      clearTimeout(t);
      const k = e.target.dataset.k, f = e.target.dataset.f, v = e.target.value;
      t = setTimeout(async () => {
        await ensureClient().from('sprint_historia').update({ [f]: v }).eq('historia_key', k);
      }, 500);
    });
  });
}

// == Load all ==
async function loadAll(){
  await loadKPIs();
  await loadParticipantes();
  await loadAusencias();
  await loadMgmt();
  await loadCotejo();
  await loadEntrega();
}
loadAll();
