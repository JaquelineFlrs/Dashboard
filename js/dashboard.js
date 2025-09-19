(function(){
'use strict';
const CM = window._commons;
const db = CM.db;

async function loadHeader(){
  try{
    const { data, error } = await db.from(CM.TABLES.SPRINTS)
      .select('nombre, fecha_inicio, fecha_fin')
      .eq('activo', true).limit(1).maybeSingle();
    if(error){ throw error; }
    const hoy = new Date();
    if(data){
      const dias_restantes = Math.ceil((new Date(data.fecha_fin) - hoy)/(1000*60*60*24));
      document.getElementById('sprintTitle').textContent = data.nombre || 'Sprint activo';
      document.getElementById('sprintDates').textContent = `${CM.fmtDate(data.fecha_inicio)} → ${CM.fmtDate(data.fecha_fin)}`;
      document.getElementById('daysLeft').textContent = String(dias_restantes);
    }else{
      document.getElementById('sprintTitle').textContent = 'Sin sprint activo';
      document.getElementById('sprintDates').textContent = '—';
      document.getElementById('daysLeft').textContent = '—';
    }
  }catch(e){ console.warn('header:', e); }
}

async function loadKPIs(){
  // Consulta a la vista de totales de sprint si existe
  try{
    const { data } = await db.from(CM.VIEWS.TOTALES_SPRINT).select('*').limit(1);
    const k = (data && data[0]) || {};
    document.getElementById('kpiPctSprint').textContent = (k.pct_avance!=null? (Math.round(k.pct_avance*1000)/10)+'%':'—');
    document.getElementById('kpiHorasSubtarea').textContent = k.total_x_sub!=null? CM.fmtNum(k.total_x_sub):'—';
    document.getElementById('kpiTotalPendientes').textContent = k.total_pendientes!=null? CM.fmtNum(k.total_pendientes):'—';
    document.getElementById('kpiHorasTerminadas').textContent = k.total_terminadas!=null? CM.fmtNum(k.total_terminadas):'—';
  }catch(_){ /* ignora si no existe la vista */ }
}

async function loadTables(){
  async function q(view){ try{ const { data } = await db.from(view).select('*').limit(1000); return data||[]; }catch(_){ return []; } }
  const porLista = await q(CM.VIEWS.AVANCE_LISTA);
  CM.renderTable(document.getElementById('theadLista'), document.getElementById('tbodyLista'), porLista);
  const porProp = await q(CM.VIEWS.TOTALES_PROP);
  CM.renderTable(document.getElementById('theadProp'), document.getElementById('tbodyProp'), porProp);
}

window._hooks = window._hooks || {};
window._hooks['view-dashboard'] = ()=>{ loadHeader(); loadKPIs(); loadTables(); };
// precargar
loadHeader(); loadKPIs(); loadTables();

})();