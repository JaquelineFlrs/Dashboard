function qs(id){ return document.getElementById(id); }
async function api(path, opts){ const r = await fetch(path, opts); if(!r.ok) throw new Error(await r.text()); return r.json(); }
function fmt(n){ return (n==null?'':(+n).toFixed(2)); }
function tableFromRows(el, headers, rows){
  el.innerHTML = ''; const thead = document.createElement('thead');
  thead.innerHTML = '<tr>'+headers.map(h=>`<th class="text-left py-1 pr-4">${h}</th>`).join('')+'</tr>';
  const tbody = document.createElement('tbody');
  rows.forEach(r=>{ const tr = document.createElement('tr'); tr.innerHTML = headers.map(h=>`<td class="py-1 pr-4">${r[h]??''}</td>`).join(''); tbody.appendChild(tr); });
  el.appendChild(thead); el.appendChild(tbody);
}
function downloadCSV(filename, rows){ const headers = Object.keys(rows[0]||{});
  const csv = [headers.join(','), ...rows.map(r=>headers.map(h=>JSON.stringify(r[h]??'')).join(','))].join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); }
function downloadXLSX(filename, sheets){ const wb = XLSX.utils.book_new(); for(const [name, rows] of Object.entries(sheets)){ const ws = XLSX.utils.json_to_sheet(rows); XLSX.utils.book_append_sheet(wb, ws, name);} XLSX.writeFile(wb, filename); }

async function sprintActivo(){ const r = await api('/api/db',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({from:'sprint', action:'select', filters:[{col:'estado',op:'eq',val:'activo'}], order:{col:'id',ascending:false}, limit:1})}); return r.data?.[0]||null; }

qs('btnSync').onclick = async () => { const s = await sprintActivo(); if(!s){ alert('No hay sprint activo'); return; }
  await api('/api/rpc/fn_sync_historias', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ p_sprint: s.id })});
  await api('/api/rpc/fn_sync_subtareas', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ p_sprint: s.id })});
  await loadAll(); };

let burndownChart = null;
async function loadKPIs(){
  const s = await sprintActivo(); if(!s) return;
  const k = await api('/api/db',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({from:'vw_kpis_top', action:'select', filters:[{col:'sprint_id',op:'eq',val:s.id}], limit:1})});
  const v = k.data?.[0]||{}; const planeadas=v.horas_planeadas||0, terminadas=v.horas_terminadas||0; const pendientes=Math.max(0,planeadas-terminadas); const avance=planeadas? (terminadas/planeadas*100):0;
  qs('kpiPlaneadas').textContent=fmt(planeadas); qs('kpiTerminadas').textContent=fmt(terminadas); qs('kpiPendientes').textContent=fmt(pendientes); qs('kpiAvance').textContent=(avance||0).toFixed(1)+'%';
  qs('bdRange').textContent=`${s.fecha_inicio} → ${s.fecha_fin}`;
  const est = await api('/api/db',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({from:'vw_burndown_estimado', action:'select', filters:[{col:'sprint_id',op:'eq',val:s.id}], order:{col:'dia_index',ascending:true}, limit:500})});
  const real = await api('/api/db',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({from:'burndown_daily', action:'select', filters:[{col:'sprint_id',op:'eq',val:s.id}], order:{col:'dia_index',ascending:true}, limit:500})});
  const labels = (est.data||real.data||[]).map(e=>e.fecha); const dsEst = (est.data||[]).map(e=>e.horas_estimadas); const dsReal = (real.data||[]).map(r=>r.horas_reales);
  const ctx = document.getElementById('chartBurndown'); if(burndownChart) burndownChart.destroy(); burndownChart = new Chart(ctx, { type:'bar', data:{ labels, datasets:[ { type:'line', label:'Estimado', data:dsEst }, { type:'bar', label:'Real', data:dsReal } ] }, options:{ responsive:true, maintainAspectRatio:false } });
  const per = await api('/api/db',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({from:'vw_resumen_por_persona', action:'select', filters:[{col:'sprint_id',op:'eq',val:s.id}], order:{col:'persona',ascending:true}, limit:1000})});
  const rowsP = (per.data||[]).map(r=>({ Persona: r.persona, Planeadas: fmt(r.horas_planeadas), Terminadas: fmt(r.horas_terminadas) })); tableFromRows(qs('tblPorPersona'), ['Persona','Planeadas','Terminadas'], rowsP);
  const lis = await api('/api/db',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({from:'vw_resumen_por_lista', action:'select', filters:[{col:'sprint_id',op:'eq',val:s.id}], order:{col:'lista',ascending:true}, limit:1000})});
  const rowsL = (lis.data||[]).map(r=>({ Lista: r.lista, 'Horas totales': fmt(r.horas_total), 'Horas abiertas': fmt(r.horas_abiertas) })); tableFromRows(qs('tblPorLista'), ['Lista','Horas totales','Horas abiertas'], rowsL);
}

qs('btnCrearSprint').onclick = async () => {
  const nombre = qs('sprintNombre').value.trim(); const fi = qs('sprintInicio').value; const ff = qs('sprintFin').value;
  const r = await api('/api/db',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({from:'sprint', action:'insert', values:{ nombre, fecha_inicio: fi, fecha_fin: ff, estado:'activo' }})});
  qs('sprintMsg').textContent = r.data?.length? ('Sprint creado: '+r.data[0].id) : 'OK'; await loadAll();
};
qs('btnAddParticipante').onclick = async () => {
  const nombre = qs('partNombre').value.trim(); const horas = parseFloat(qs('partHoras').value || '8');
  const r = await api('/api/db',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({from:'participante', action:'insert', values:{ nombre, horas_dia: horas }})});
  const id = r.data?.[0]?.id; if(id) await api('/api/rpc/set_participante_activo_default', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ p_participante_id: id })});
  await loadParticipantes(); await loadAusencias();
};
qs('btnAddAusencia').onclick = async () => {
  const s = await sprintActivo(); if(!s) return;
  const nombre = qs('ausNombre').value.trim(); const fecha = qs('ausFecha').value; const horas = parseFloat(qs('ausHoras').value || '0');
  const p = await api('/api/db',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({from:'participante', action:'select', filters:[{col:'nombre',op:'ilike',val:nombre}], limit:1})});
  const pid = p.data?.[0]?.id; if(!pid){ alert('Participante no encontrado'); return; }
  await api('/api/db',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({from:'sprint_ausencia', action:'insert', values:{ sprint_id: s.id, participante_id: pid, fecha, horas }})});
  await loadAusencias();
};
qs('btnCerrarSprint').onclick = async () => {
  const s = await sprintActivo(); if(!s) return;
  await api('/api/db',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({from:'sprint', action:'update', values:{ estado:'cerrado' }, filters:[{col:'id',op:'eq',val:s.id}]})});
  await loadAll();
};
async function loadParticipantes(){
  const r = await api('/api/db',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({from:'participante', action:'select', order:{col:'id',ascending:true}, limit:1000})});
  qs('participantesList').textContent = (r.data||[]).map(p=>`${p.nombre} (${p.horas_dia||8} h/día)`).join(' · ');
}
async function loadAusencias(){
  const s = await sprintActivo(); if(!s) return;
  const r = await api('/api/db',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({from:'sprint_ausencia', action:'select', filters:[{col:'sprint_id',op:'eq',val:s.id}], order:{col:'fecha',ascending:true}, limit:1000, select:'fecha, horas, participante(nombre)' })});
  const rows = (r.data||[]).map(a => `${a.participante?.nombre||'¿?'}: ${a.fecha} (${a.horas}h)`); qs('ausenciasList').textContent = rows.join(' · ');
}

qs('btnUploadHistorias').onclick = async () => { await uploadCsv('hist','csvHistorias'); };
qs('btnUploadSubtareas').onclick = async () => { await uploadCsv('subt','csvSubtareas'); };
async function uploadCsv(kind, inputId){
  const s = await sprintActivo(); if(!s){ alert('No hay sprint activo'); return; }
  const el = qs(inputId); const f = el.files?.[0]; if(!f){ alert('Selecciona un archivo'); return; }
  const fd = new FormData(); fd.append('file', f); fd.append('sprint_id', s.id);
  const r = await fetch('/api/upload/'+kind,{method:'POST', body:fd}); if(!r.ok){ alert('Error al subir'); return; }
  const j = await r.json(); alert(`Cargado: ${j.count} filas`);
}
qs('btnSyncCsv').onclick = async () => {
  const s = await sprintActivo(); if(!s){ qs('syncMsg').textContent='No hay sprint activo.'; return; }
  await api('/api/rpc/fn_sync_historias', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ p_sprint: s.id })});
  await api('/api/rpc/fn_sync_subtareas', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ p_sprint: s.id })});
  qs('syncMsg').textContent = 'Sincronización ejecutada.'; await loadAll();
};

qs('btnFiltrarMgmt').onclick = loadMgmt;
qs('btnExportMgmt').onclick = async () => { const rows = await getMgmtRows(); if(rows.length) downloadCSV('management.csv', rows); };
async function getMgmtRows(){
  const s = await sprintActivo(); if(!s) return [];
  const body = {from:'sprint_subtarea', action:'select', filters:[{col:'sprint_id',op:'eq',val:s.id}], order:{col:'titulo',ascending:true}, limit:1000};
  const fl = qs('fLista').value.trim(); if(fl) body.filters.push({col:'lista',op:'ilike',val:`%${fl}%`});
  const fe = qs('fEstado').value.trim(); if(fe) body.filters.push({col:'estado_zoho',op:'ilike',val:`%${fe}%`});
  const fp = qs('fPersona').value.trim(); if(fp) body.filters.push({col:'propietario_zoho',op:'ilike',val:`%${fp}%`});
  const r = await api('/api/db',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
  return (r.data||[]).map(row => ({ Titulo: row.titulo, Lista: row.lista, Estado: row.estado_zoho, Persona: row.propietario_zoho, Horas: fmt(row.duracion_zoho), Visible: row.visible, Terminado: row.terminado_manual }));
}
async function loadMgmt(){
  const s = await sprintActivo(); if(!s) return;
  const r = await api('/api/db',{method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({from:'sprint_subtarea', action:'select', filters:[{col:'sprint_id',op:'eq',val:s.id}], order:{col:'titulo',ascending:true}, limit:200,
      select:'subtarea_key, titulo, estado_zoho, visible, terminado_manual, lista, propietario_zoho'})});
  const box = qs('mgmtList'); box.innerHTML='';
  (r.data||[]).forEach(row=>{
    const div = document.createElement('div');
    div.className = 'flex items-center gap-2 py-1 border-b';
    div.innerHTML = `<span class="grow">${row.titulo} <span class="text-slate-400">[${row.lista||''} · ${row.estado_zoho||''} · ${row.propietario_zoho||''}]</span></span>`+
      `<label class="flex items-center gap-1 text-xs"><input type="checkbox" ${row.visible?'checked':''} data-k="${row.subtarea_key}" data-f="visible"/> Visible</label>`+
      `<label class="flex items-center gap-1 text-xs"><input type="checkbox" ${row.terminado_manual?'checked':''} data-k="${row.subtarea_key}" data-f="terminado_manual"/> Terminado</label>`;
    box.appendChild(div);
  });
  box.querySelectorAll('input[type=checkbox]').forEach(chk => {
    chk.addEventListener('change', async (e) => {
      const k = e.target.dataset.k, f = e.target.dataset.f, v = e.target.checked;
      await api('/api/db',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({from:'sprint_subtarea', action:'update', values:{ [f]: v }, filters:[{col:'subtarea_key',op:'eq',val:k}]})});
    });
  });
}

qs('btnExportCotejo').onclick = async () => { const sheets = {}; const t = await getCotejoTotales(); sheets['Totales'] = [t]; sheets['Por lista'] = await getCotejoLista(); sheets['Por historia'] = await getCotejoHistoria(); downloadXLSX('cotejo.xlsx', sheets); };
async function getCotejoTotales(){ const s = await sprintActivo(); if(!s) return {};
  const r = await api('/api/db',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({from:'vw_cotejo_totales', action:'select', filters:[{col:'sprint_id',op:'eq',val:s.id}], limit:1})});
  const t = r.data?.[0] || { horas_historias:0, horas_subtareas:0 }; return { 'Horas historias': fmt(t.horas_historias), 'Horas subtareas': fmt(t.horas_subtareas), 'Diferencia': fmt((t.horas_historias||0)-(t.horas_subtareas||0)) }; }
async function getCotejoLista(){ const s = await sprintActivo(); if(!s) return [];
  const r = await api('/api/db',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({from:'vw_cotejo_por_lista', action:'select', filters:[{col:'sprint_id',op:'eq',val:s.id}], limit:1000})});
  return (r.data||[]).map(x=>({ Lista: x.lista, 'Horas subtareas': fmt(x.horas_subtareas) })); }
async function getCotejoHistoria(){ const s = await sprintActivo(); if(!s) return [];
  const r = await api('/api/db',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({from:'vw_cotejo_por_historia', action:'select', filters:[{col:'sprint_id',op:'eq',val:s.id}], limit:1000})});
  return (r.data||[]).map(x=>({ Codigo: x.codigo, Titulo: x.titulo, 'Horas historia': fmt(x.horas_historia), 'Horas subtareas': fmt(x.horas_subtareas), Diferencia: fmt(x.diferencia) })); }
async function loadCotejo(){ const t = await getCotejoTotales(); qs('cotejoBox').textContent = `Historias: ${t['Horas historias']}h · Subtareas: ${t['Horas subtareas']}h · Diferencia: ${t['Diferencia']}h`;
  const l = await getCotejoLista(); tableFromRows(qs('tblCotejoLista'), ['Lista','Horas subtareas'], l);
  const h = await getCotejoHistoria(); tableFromRows(qs('tblCotejoHistoria'), ['Codigo','Titulo','Horas historia','Horas subtareas','Diferencia'], h); }

async function loadEntrega(){
  const s = await sprintActivo(); if(!s) return;
  const r = await api('/api/db',{method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({from:'sprint_historia', action:'select', filters:[{col:'sprint_id',op:'eq',val:s.id}], order:{col:'codigo',ascending:true}, limit:1000,
      select:'historia_key, codigo, titulo, aceptada_manual, observaciones'})});
  const box = qs('entregaList'); box.innerHTML='';
  (r.data||[]).forEach(row=>{
    const div = document.createElement('div'); div.className = 'flex items-center gap-2 py-1 border-b';
    div.innerHTML = `<span class="grow">${row.codigo||''} — ${row.titulo}</span>`+
      `<label class="flex items-center gap-1 text-xs"><input type="checkbox" ${row.aceptada_manual?'checked':''} data-k="${row.historia_key}" data-f="aceptada_manual"/> Aceptada</label>`+
      `<input class="border rounded px-1 text-xs" placeholder="Observaciones" value="${row.observaciones||''}" data-k="${row.historia_key}" data-f="observaciones"/>`;
    box.appendChild(div);
  });
  box.querySelectorAll('input[type=checkbox]').forEach(chk => {
    chk.addEventListener('change', async (e) => {
      const k = e.target.dataset.k, f = e.target.dataset.f, v = e.target.checked;
      await api('/api/db',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({from:'sprint_historia', action:'update', values:{ [f]: v }, filters:[{col:'historia_key',op:'eq',val:k}]})});
    });
  });
  box.querySelectorAll('input[type=text],input:not([type])').forEach(inp => {
    let t = null; inp.addEventListener('input', e => {
      clearTimeout(t); const k = e.target.dataset.k, f = e.target.dataset.f, v = e.target.value;
      t = setTimeout(async () => { await api('/api/db',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({from:'sprint_historia', action:'update', values:{ [f]: v }, filters:[{col:'historia_key',op:'eq',val:k}]})}); }, 400);
    });
  });
}

async function loadAll(){ await loadKPIs(); await loadParticipantes(); await loadAusencias(); await loadMgmt(); await loadCotejo(); await loadEntrega(); }
loadAll();
