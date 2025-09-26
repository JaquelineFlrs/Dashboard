// Minimal app logic
let supa = null;

function getSettings(){
  return {
    url: localStorage.getItem('SUPABASE_URL') || '',
    key: localStorage.getItem('SUPABASE_ANON_KEY') || ''
  };
}

function ensureClient(){
  const { url, key } = getSettings();
  if(!url || !key){
    return null;
  }
  if(!supa){
    supa = window.supabase.createClient(url, key);
  }
  return supa;
}

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
  supa = null;
  loadAll();
};

async function createSprint(){
  const c = ensureClient();
  if(!c){ return {error: 'Configura SUPABASE en Ajustes'}; }
  const nombre = document.getElementById('sprintNombre').value.trim();
  const fi = document.getElementById('sprintInicio').value;
  const ff = document.getElementById('sprintFin').value;
  const { data, error } = await c.from('sprint').insert({ nombre, fecha_inicio: fi, fecha_fin: ff, estado: 'activo' }).select().single();
  return { data, error };
}

document.getElementById('btnCrearSprint').onclick = async () => {
  const res = await createSprint();
  document.getElementById('sprintMsg').textContent = res.error ? res.error.message : `Sprint creado: ${res.data?.id}`;
  await loadAll();
};

document.getElementById('btnAddParticipante').onclick = async () => {
  const c = ensureClient(); if(!c){ return; }
  const nombre = document.getElementById('partNombre').value.trim();
  const horas = parseFloat(document.getElementById('partHoras').value || '8');
  const { data, error } = await c.from('participante').insert({ nombre, horas_dia: horas }).select().single();
  if(error){ alert(error.message); return; }
  const { data: sp } = await c.rpc('set_participante_activo_default', { p_participante_id: data.id });
  await loadParticipantes();
};

document.getElementById('btnSync').onclick = async () => {
  const c = ensureClient(); if(!c){ return; }
  // get sprint activo (último)
  const { data: sprints } = await c.from('sprint').select('*').eq('estado', 'activo').order('id', { ascending: false }).limit(1);
  const sprint = sprints?.[0];
  if(!sprint){ document.getElementById('syncMsg').textContent = 'No hay sprint activo.'; return; }
  await c.rpc('fn_sync_historias', { p_sprint: sprint.id });
  await c.rpc('fn_sync_subtareas', { p_sprint: sprint.id });
  document.getElementById('syncMsg').textContent = 'Sincronización ejecutada.';
  await loadAll();
};

async function loadKPIs(){
  const c = ensureClient(); if(!c){ return; }
  const { data: sprints } = await c.from('sprint').select('*').eq('estado', 'activo').order('id', { ascending: false }).limit(1);
  const sprint = sprints?.[0]; if(!sprint){ return; }
  const { data } = await c.from('vw_kpis_top').select('*').eq('sprint_id', sprint.id).limit(1);
  const kpi = data?.[0];
  const planeadas = kpi?.horas_planeadas ?? 0;
  const terminadas = kpi?.horas_terminadas ?? 0;
  const pendientes = Math.max(0, planeadas - terminadas);
  document.getElementById('kpiPlaneadas').textContent = planeadas.toFixed(2);
  document.getElementById('kpiTerminadas').textContent = terminadas.toFixed(2);
  document.getElementById('kpiPendientes').textContent = pendientes.toFixed(2);

  // burndown
  const { data: est } = await c.from('vw_burndown_estimado').select('*').eq('sprint_id', sprint.id).order('dia_index');
  const { data: real } = await c.from('burndown_daily').select('*').eq('sprint_id', sprint.id).order('dia_index');
  const tbody = document.querySelector('#tblBurndown tbody');
  tbody.innerHTML = '';
  const len = Math.max(est?.length||0, real?.length||0);
  for(let i=0;i<len;i++){
    const e = est?.[i], r = real?.[i];
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="py-1">${i}</td><td>${(e?.fecha || r?.fecha || '')}</td><td>${r?.horas_reales ?? ''}</td><td>${e?.horas_estimadas ?? ''}</td>`;
    tbody.appendChild(tr);
  }
}

async function loadParticipantes(){
  const c = ensureClient(); if(!c){ return; }
  const { data } = await c.from('participante').select('*').order('id');
  document.getElementById('participantesList').textContent = (data||[]).map(p => `${p.nombre} (${p.horas_dia||8} h/día)`).join(' · ');
}

async function loadMgmt(){
  const c = ensureClient(); if(!c){ return; }
  const { data: sprints } = await c.from('sprint').select('*').eq('estado','activo').order('id', {ascending:false}).limit(1);
  const sprint = sprints?.[0]; if(!sprint){ return; }
  const { data } = await c.from('sprint_subtarea').select('subtarea_key, titulo, estado_zoho, visible, terminado_manual, lista').eq('sprint_id', sprint.id).order('titulo').limit(50);
  const box = document.getElementById('mgmtList');
  box.innerHTML = '';
  (data||[]).forEach(row => {
    const div = document.createElement('div');
    div.className = 'flex items-center gap-2 py-1 border-b';
    div.innerHTML = `<span class="grow">${row.titulo} <span class="text-slate-400">[${row.estado_zoho||''} · ${row.lista||''}]</span></span>`+
      `<label class="flex items-center gap-1 text-xs"><input type="checkbox" ${row.visible?'checked':''} data-k="${row.subtarea_key}" data-f="visible"/> Visible</label>`+
      `<label class="flex items-center gap-1 text-xs"><input type="checkbox" ${row.terminado_manual?'checked':''} data-k="${row.subtarea_key}" data-f="terminado_manual"/> Terminado</label>`;
    box.appendChild(div);
  });
  box.querySelectorAll('input[type=checkbox]').forEach(chk => {
    chk.addEventListener('change', async (e) => {
      const k = e.target.dataset.k;
      const f = e.target.dataset.f;
      const v = e.target.checked;
      await c.from('sprint_subtarea').update({ [f]: v }).eq('subtarea_key', k);
    });
  });
}

async function loadCotejo(){
  const c = ensureClient(); if(!c){ return; }
  const { data: sprints } = await c.from('sprint').select('*').eq('estado','activo').order('id',{ascending:false}).limit(1);
  const sprint = sprints?.[0]; if(!sprint){ return; }
  const { data: tot } = await c.from('vw_cotejo_totales').select('*').eq('sprint_id', sprint.id);
  const t = tot?.[0] || { horas_historias: 0, horas_subtareas: 0 };
  const diff = (t.horas_historias||0) - (t.horas_subtareas||0);
  document.getElementById('cotejoBox').textContent = `Totales → Historias: ${t.horas_historias||0}h, Subtareas: ${t.horas_subtareas||0}h, Diferencia: ${diff}h`;
}

async function loadEntrega(){
  const c = ensureClient(); if(!c){ return; }
  const { data: sprints } = await c.from('sprint').select('*').eq('estado','activo').order('id',{ascending:false}).limit(1);
  const sprint = sprints?.[0]; if(!sprint){ return; }
  const { data } = await c.from('sprint_historia').select('historia_key, codigo, titulo, aceptada_manual, observaciones').eq('sprint_id', sprint.id).order('codigo').limit(50);
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
      await c.from('sprint_historia').update({ [f]: v }).eq('historia_key', k);
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

async function loadAll(){
  await loadKPIs();
  await loadParticipantes();
  await loadMgmt();
  await loadCotejo();
  await loadEntrega();
}

loadAll();
