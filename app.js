// --- Supabase client (GH Pages) ---
let supa = null;
const DEFAULT_SUPABASE_URL = "https://yuqnnbqvjsccpnygdznj.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1cW5uYnF2anNjY3BueWdkem5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MTgwOTksImV4cCI6MjA3NDQ5NDA5OX0.DIkuViSv5I42s0fB4Y_RO9YLAC03qcV2P6iXtpOXysw";
function getSettings(){
  return {
    url: localStorage.getItem('SUPABASE_URL') || DEFAULT_SUPABASE_URL,
    key: localStorage.getItem('SUPABASE_ANON_KEY') || DEFAULT_SUPABASE_ANON_KEY
  };
}
function ensureClient(){
  if(supa) return supa;
  if(!window.supabase || !window.supabase.createClient) throw new Error('Supabase UMD no cargó');
  const s = getSettings();
  supa = window.supabase.createClient(s.url, s.key);
  return supa;
}
document.getElementById('btnGuardar').onclick = () => {
  localStorage.setItem('SUPABASE_URL', document.getElementById('inUrl').value.trim());
  localStorage.setItem('SUPABASE_ANON_KEY', document.getElementById('inKey').value.trim());
  alert('Guardado. Recarga la página.');
};
window.addEventListener('load', () => {
  const s = getSettings();
  document.getElementById('inUrl').value = s.url;
  document.getElementById('inKey').value = s.key;
});

// --- Helpers ---
function qs(id){ return document.getElementById(id); }
async function apiSelect(from, filters=[], order=null, limit=1000, select='*'){ ensureClient(); let q = supa.from(from).select(select); filters.forEach(f=>{ if(f.op==='eq') q=q.eq(f.col,f.val); else if(f.op==='ilike') q=q.ilike(f.col,f.val); }); if(order) q=q.order(order.col,{ascending:!!order.ascending}); q=q.limit(limit); const { data, error } = await q; if(error) throw error; return data; }
async function apiInsert(from, values){ ensureClient(); const { data, error } = await supa.from(from).insert(values).select(); if(error) throw error; return data; }
async function apiUpdate(from, values, filters){ ensureClient(); let q = supa.from(from).update(values); filters.forEach(f=>{ if(f.op==='eq') q=q.eq(f.col,f.val); }); const { data, error } = await q.select(); if(error) throw error; return data; }
async function callRpc(fn, params={}){ ensureClient(); const { data, error } = await supa.rpc(fn, params); if(error) throw error; return data; }

function normalizeHeader(h){ return String(h||'').toLowerCase().replace(/\s+/g,' ').replace(/[^\wáéíóúüñ ]/g,'').trim(); }
function pick(headers, aliases){ const hnorm = headers.map(normalizeHeader); for(const a of aliases){ const i=hnorm.indexOf(a); if(i>=0) return headers[i]; } return null; }
function hhmmToHours(val){ if(val==null||val==='') return null; const s=String(val).trim(); if(/^\d+(\.\d+)?$/.test(s)) return parseFloat(s); const m=s.match(/^(\d{1,2})[:hH](\d{1,2})$/); if(m){ const h=parseInt(m[1],10), mm=parseInt(m[2],10); return h+mm/60; } return null; }

async function sprintActivo(){ const d=await apiSelect('sprint',[{col:'estado',op:'eq',val:'activo'}],{col:'id',ascending:false},1); return d?.[0]||null; }

qs('btnCrearSprint').onclick = async ()=>{ const nombre=qs('sprintNombre').value.trim(); const fi=qs('sprintInicio').value; const ff=qs('sprintFin').value; await apiInsert('sprint',{nombre,fecha_inicio:fi,fecha_fin:ff,estado:'activo'}); qs('sprintMsg').textContent='Sprint creado'; await loadAll(); };
qs('btnAddParticipante').onclick = async ()=>{ const nombre=qs('partNombre').value.trim(); const horas=parseFloat(qs('partHoras').value||'8'); await apiInsert('participante',{nombre,horas_dia:horas}); await loadParticipantes(); };
qs('btnAddAusencia').onclick = async ()=>{ const s=await sprintActivo(); if(!s) return; const nombre=qs('ausNombre').value.trim(); const fecha=qs('ausFecha').value; const horas=parseFloat(qs('ausHoras').value||'0'); const p=(await apiSelect('participante',[{col:'nombre',op:'ilike',val:nombre}],null,1))[0]; if(!p) return alert('Participante no encontrado'); await apiInsert('sprint_ausencia',{sprint_id:s.id,participante_id:p.id,fecha,horas}); await loadAusencias(); };
qs('btnCerrarSprint').onclick = async ()=>{ const s=await sprintActivo(); if(!s) return; await apiUpdate('sprint',{estado:'cerrado'},[{col:'id',op:'eq',val:s.id}]); await loadAll(); };

qs('btnUploadHistorias').onclick = ()=> uploadCsv('hist','csvHistorias');
qs('btnUploadSubtareas').onclick = ()=> uploadCsv('subt','csvSubtareas');
qs('btnSyncCsv').onclick = async ()=>{ const s=await sprintActivo(); if(!s) return qs('syncMsg').textContent='No hay sprint activo.'; await callRpc('fn_sync_historias',{p_sprint:s.id}); await callRpc('fn_sync_subtareas',{p_sprint:s.id}); qs('syncMsg').textContent='Sincronización ejecutada.'; await loadAll(); };
qs('btnFiltrarMgmt').onclick = loadMgmt;
qs('btnExportMgmt').onclick = async ()=>{ const rows = await getMgmtRows(); if(rows.length) downloadCSV('management.csv', rows); };
qs('btnExportCotejo').onclick = async ()=>{ const sheets={}; const t=await getCotejoTotales(); sheets['Totales']=[t]; sheets['Por lista']=await getCotejoLista(); sheets['Por historia']=await getCotejoHistoria(); downloadXLSX('cotejo.xlsx', sheets); };

function parseCSV(text){ const lines=text.split(/\r?\n/); const rows=lines.map(l=>l.split(/,|;|\t/)); return rows.filter(r=>r.length>1 || (r.length===1 && r[0].trim()!=='')); }

async function uploadCsv(kind, inputId){
  const s=await sprintActivo(); if(!s) return alert('No hay sprint activo');
  const f = qs(inputId).files?.[0]; if(!f) return alert('Selecciona un archivo');
  const text = await f.text(); const rows = parseCSV(text); const headers=(rows.shift()||[]).map(h=>h.trim());
  const map={};
  if(kind==='hist'){ map.zoho_historia_id=pick(headers,['zoho historia id','id','id historia']); map.codigo=pick(headers,['codigo','code','clave']); map.titulo=pick(headers,['titulo','título','title','asunto']); map.lista=pick(headers,['lista','list','tablero','board']); map.propietario=pick(headers,['propietario','owner','asignado a','responsable']); map.duracion=pick(headers,['duracion','duración','duration','horas','hhmm','estimado']); }
  else { map.zoho_subtarea_id=pick(headers,['zoho subtarea id','id subtarea','id']); map.zoho_historia_id=pick(headers,['zoho historia id','id historia','historia id']); map.titulo=pick(headers,['titulo','título','title','asunto']); map.propietario_zoho=pick(headers,['propietario','owner','asignado a','responsable']); map.estado_zoho=pick(headers,['estado','status','situacion','situación']); map.duracion_zoho=pick(headers,['duracion','duración','duration','horas','hhmm','estimado']); }
  const out=[];
  for(const r of rows){ const obj={sprint_id:s.id}; for(const [k,col] of Object.entries(map)){ const idx=headers.indexOf(col); obj[k] = (idx>=0? r[idx]: null); } if(kind==='hist' && obj.duracion!=null) obj.duracion = hhmmToHours(obj.duracion); if(kind==='subt' && obj.duracion_zoho!=null) obj.duracion_zoho = hhmmToHours(obj.duracion_zoho); out.push(obj); }
  const table = (kind==='hist')? 'zoho_historia_raw' : 'zoho_subtarea_raw';
  // chunked inserts
  for(let i=0;i<out.length;i+=500){ const chunk = out.slice(i,i+500); await apiInsert(table, chunk); }
  alert('Cargado: '+out.length+' filas');
}

function downloadCSV(filename, rows){ const headers=Object.keys(rows[0]||{}); const csv=[headers.join(','), ...rows.map(r=>headers.map(h=>JSON.stringify(r[h]??'')).join(','))].join('\n'); const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); }
function downloadXLSX(filename, sheets){ const wb=XLSX.utils.book_new(); for(const [name,rows] of Object.entries(sheets)){ const ws=XLSX.utils.json_to_sheet(rows); XLSX.utils.book_append_sheet(wb,ws,name); } XLSX.writeFile(wb, filename); }

async function loadKPIs(){
  const s=await sprintActivo(); if(!s) return;
  const k=(await apiSelect('vw_kpis_top',[{col:'sprint_id',op:'eq',val:s.id}],null,1))[0]||{};
  const planeadas=k.horas_planeadas||0, terminadas=k.horas_terminadas||0, pendientes=Math.max(0,planeadas-terminadas), avance=planeadas? (terminadas/planeadas*100):0;
  qs('kpiPlaneadas').textContent=planeadas.toFixed(2); qs('kpiTerminadas').textContent=terminadas.toFixed(2); qs('kpiPendientes').textContent=pendientes.toFixed(2); qs('kpiAvance').textContent=(avance||0).toFixed(1)+'%';
  qs('bdRange').textContent=`${s.fecha_inicio} → ${s.fecha_fin}`;
  const est=await apiSelect('vw_burndown_estimado',[{col:'sprint_id',op:'eq',val:s.id}],{col:'dia_index',ascending:true},500);
  const real=await apiSelect('burndown_daily',[{col:'sprint_id',op:'eq',val:s.id}],{col:'dia_index',ascending:true},500);
  const labels=(est||real||[]).map(e=>e.fecha); const dsEst=(est||[]).map(e=>e.horas_estimadas); const dsReal=(real||[]).map(e=>e.horas_reales);
  const ctx=document.getElementById('chartBurndown'); if(window._bd) window._bd.destroy(); window._bd=new Chart(ctx,{type:'bar',data:{labels,datasets:[{type:'line',label:'Estimado',data:dsEst},{type:'bar',label:'Real',data:dsReal}]},options:{responsive:true,maintainAspectRatio:false}});
}
async function loadParticipantes(){
  const r=await apiSelect('participante',[],{col:'id',ascending:true},1000); qs('participantesList').textContent=(r||[]).map(p=>`${p.nombre} (${p.horas_dia||8} h/día)`).join(' · ');
}
async function loadAusencias(){
  const s=await sprintActivo(); if(!s) return; const r=await apiSelect('sprint_ausencia',[{col:'sprint_id',op:'eq',val:s.id}],{col:'fecha',ascending:true},1000,'fecha, horas, participante(nombre)'); const rows=(r||[]).map(a=>`${a.participante?.nombre||'¿?'}: ${a.fecha} (${a.horas}h)`); qs('ausenciasList').textContent=rows.join(' · ');
}
async function getMgmtRows(){
  const s=await sprintActivo(); if(!s) return []; const filters=[{col:'sprint_id',op:'eq',val:s.id}];
  const fl=qs('fLista').value.trim(); if(fl) filters.push({col:'lista',op:'ilike',val:`%${fl}%`});
  const fe=qs('fEstado').value.trim(); if(fe) filters.push({col:'estado_zoho',op:'ilike',val:`%${fe}%`});
  const fp=qs('fPersona').value.trim(); if(fp) filters.push({col:'propietario_zoho',op:'ilike',val:`%${fp}%`});
  const r=await apiSelect('sprint_subtarea',filters,{col:'titulo',ascending:true},1000);
  return (r||[]).map(row=>({Titulo:row.titulo, Lista:row.lista, Estado:row.estado_zoho, Persona:row.propietario_zoho, Horas:row.duracion_zoho, Visible:row.visible, Terminado:row.terminado_manual}));
}
async function loadMgmt(){
  const s=await sprintActivo(); if(!s) return; const r=await apiSelect('sprint_subtarea',[{col:'sprint_id',op:'eq',val:s.id}],{col:'titulo',ascending:true},200,'subtarea_key, titulo, estado_zoho, visible, terminado_manual, lista, propietario_zoho');
  const box=qs('mgmtList'); box.innerHTML=''; (r||[]).forEach(row=>{ const div=document.createElement('div'); div.className='flex items-center gap-2 py-1 border-b'; div.innerHTML=`<span class="grow">${row.titulo} <span class="text-slate-400">[${row.lista||''} · ${row.estado_zoho||''} · ${row.propietario_zoho||''}]</span></span>`+`<label class="flex items-center gap-1 text-xs"><input type="checkbox" ${row.visible?'checked':''} data-k="${row.subtarea_key}" data-f="visible"/> Visible</label>`+`<label class="flex items-center gap-1 text-xs"><input type="checkbox" ${row.terminado_manual?'checked':''} data-k="${row.subtarea_key}" data-f="terminado_manual"/> Terminado</label>`; box.appendChild(div); });
  box.querySelectorAll('input[type=checkbox]').forEach(chk=>{ chk.addEventListener('change', async e=>{ const k=e.target.dataset.k, f=e.target.dataset.f, v=e.target.checked; await apiUpdate('sprint_subtarea',{[f]:v},[{col:'subtarea_key',op:'eq',val:k}]); }); });
}
async function getCotejoTotales(){ const s=await sprintActivo(); if(!s) return {}; const r=(await apiSelect('vw_cotejo_totales',[{col:'sprint_id',op:'eq',val:s.id}],null,1))[0]||{horas_historias:0,horas_subtareas:0}; return {'Horas historias':(r.horas_historias||0).toFixed(2),'Horas subtareas':(r.horas_subtareas||0).toFixed(2),'Diferencia':(((r.horas_historias||0)-(r.horas_subtareas||0))||0).toFixed(2)}; }
async function getCotejoLista(){ const s=await sprintActivo(); if(!s) return []; const r=await apiSelect('vw_cotejo_por_lista',[{col:'sprint_id',op:'eq',val:s.id}]); return (r||[]).map(x=>({Lista:x.lista,'Horas subtareas':(x.horas_subtareas||0).toFixed(2)})); }
async function getCotejoHistoria(){ const s=await sprintActivo(); if(!s) return []; const r=await apiSelect('vw_cotejo_por_historia',[{col:'sprint_id',op:'eq',val:s.id}]); return (r||[]).map(x=>({Codigo:x.codigo,Titulo:x.titulo,'Horas historia':(x.horas_historia||0).toFixed(2),'Horas subtareas':(x.horas_subtareas||0).toFixed(2),Diferencia:(x.diferencia||0).toFixed(2)})); }
async function loadCotejo(){ const t=await getCotejoTotales(); qs('cotejoBox').textContent=`Historias: ${t['Horas historias']}h · Subtareas: ${t['Horas subtareas']}h · Dif: ${t['Diferencia']}h`; tableFromRows(document.getElementById('tblCotejoLista'),['Lista','Horas subtareas'],await getCotejoLista()); tableFromRows(document.getElementById('tblCotejoHistoria'),['Codigo','Titulo','Horas historia','Horas subtareas','Diferencia'],await getCotejoHistoria()); }

qs('btnSync').onclick = async ()=>{ const s=await sprintActivo(); if(!s) return alert('No hay sprint activo'); await callRpc('fn_sync_historias',{p_sprint:s.id}); await callRpc('fn_sync_subtareas',{p_sprint:s.id}); await loadAll(); };

async function loadAll(){ await loadKPIs(); await loadParticipantes(); await loadAusencias(); await loadMgmt(); await loadCotejo(); await loadEntrega(); }
async function loadEntrega(){ const s=await sprintActivo(); if(!s) return; const r=await apiSelect('sprint_historia',[{col:'sprint_id',op:'eq',val:s.id}],{col:'codigo',ascending:true},1000,'historia_key, codigo, titulo, aceptada_manual, observaciones'); const box=qs('entregaList'); box.innerHTML=''; (r||[]).forEach(row=>{ const div=document.createElement('div'); div.className='flex items-center gap-2 py-1 border-b'; div.innerHTML=`<span class="grow">${row.codigo||''} — ${row.titulo}</span>`+`<label class="flex items-center gap-1 text-xs"><input type="checkbox" ${row.aceptada_manual?'checked':''} data-k="${row.historia_key}" data-f="aceptada_manual"/> Aceptada</label>`+`<input class="border rounded px-1 text-xs" placeholder="Observaciones" value="${row.observaciones||''}" data-k="${row.historia_key}" data-f="observaciones"/>`; box.appendChild(div); }); box.querySelectorAll('input[type=checkbox]').forEach(chk=>{ chk.addEventListener('change', async e=>{ const k=e.target.dataset.k, f=e.target.dataset.f, v=e.target.checked; await apiUpdate('sprint_historia',{[f]:v},[{col:'historia_key',op:'eq',val:k}]); }); }); box.querySelectorAll('input[type=text],input:not([type])').forEach(inp=>{ let t=null; inp.addEventListener('input', e=>{ clearTimeout(t); const k=e.target.dataset.k, f=e.target.dataset.f, v=e.target.value; t=setTimeout(async()=>{ await apiUpdate('sprint_historia',{[f]:v},[{col:'historia_key',op:'eq',val:k}]); },400); }); }); }

loadAll();
