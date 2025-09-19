(function(){
'use strict';
const CM = window._commons;
// dashboard.js — header, KPIs y tablas del dashboard


async function loadSprintHeader(){
  const { data, error } = await window.db.from(CM.TABLES.SPRINTS).select('nombre, fecha_inicio, fecha_fin').eq('activo',true).limit(1).maybeSingle();
  if(error){ console.error(error); return; }
  if(!data){ return; }
  document.getElementById('sprintTitle').textContent = data.nombre || 'Sprint activo';
  document.getElementById('sprintDates').textContent = `${fmtDate(data.fecha_inicio)} → ${fmtDate(data.fecha_fin)}`;
  const today = new Date(); today.setHours(0,0,0,0);
  const end = new Date(data.fecha_fin+'T00:00:00');
  const diff = Math.ceil((end - today)/(1000*60*60*24));
  document.getElementById('chipDias').innerHTML = `Días restantes: <b>${diff}</b>`;
}

async function loadKpis(){
  const { data, error } = await window.db.from(CM.VIEWS.TOTALES_SPRINT).select('*').limit(1).maybeSingle();
  if(error){ console.error(error); return; }
  if(!data) return;
  document.getElementById('kpiAvance').textContent = fmtPct(data.avance_pct ?? data.pct_avance ?? 0);
  document.getElementById('kpiHorasTotales').textContent = fmtNum(data.horas_totales ?? data.total_hrs ?? 0);
  document.getElementById('kpiHorasCerradas').textContent = fmtNum(data.horas_cerradas ?? 0);
  document.getElementById('kpiHorasAbiertas').textContent = fmtNum(data.horas_abiertas ?? 0);
  document.getElementById('kpiSubCerradas').textContent = fmtNum(data.subtareas_cerradas ?? 0);
  document.getElementById('kpiSubAbiertas').textContent = fmtNum(data.subtareas_abiertas ?? 0);
}

async function loadTabla(view, theadId, tbodyId){
  const { data, error } = await window.db.from(view).select('*');
  if(error){ console.error(view, error); return; }
  renderTable(document.getElementById(theadId), document.getElementById(tbodyId), data);
}

async function refreshDashboard(){
  try{
    showLoading(true);
    await loadSprintHeader();
    await loadKpis();
    await loadTabla(CM.VIEWS.AVANCE_LISTA, 'theadLista', 'tbodyLista');
    await loadTabla(CM.VIEWS.TOTALES_PROP, 'theadProp', 'tbodyProp');
  } finally {
    showLoading(false);
  }
}

document.getElementById('btnRefreshDashboard').addEventListener('click', refreshDashboard);
refreshDashboard();
// hook
window._hooks['view-dashboard'] = refreshDashboard;

})();
