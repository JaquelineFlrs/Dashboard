(function(){
'use strict';
const CM = window._commons;
const db = CM.db;

async function recalc(){
  const excludeW = document.getElementById('bdExcludeWeekends')?.checked ?? true;
  const excludeH = document.getElementById('bdExcludeMxHolidays')?.checked ?? true; // placeholder (no holidays calc here)
  const { data: sprint } = await db.from(CM.TABLES.SPRINTS).select('fecha_inicio, fecha_fin, total_hrs').eq('activo', true).limit(1).single();
  if(!sprint){ return; }
  const start = new Date(sprint.fecha_inicio);
  const end = new Date(sprint.fecha_fin);
  const days = CM.businessDays(start, end, excludeW);
  const series = CM.buildIdealBurndown(Number(sprint.total_hrs||0), days.length);

  // render tabla
  const rows = days.map((d,i)=> ({ fecha: CM.fmtDate(d), horas: series[i] }));
  CM.renderTable(document.getElementById('theadBD'), document.getElementById('tbodyBD'), rows);

  // render chart
  const ctx = document.getElementById('burndownCanvas')?.getContext('2d');
  if(!ctx) return;
  if(window._bdChart){ window._bdChart.destroy(); }
  window._bdChart = new Chart(ctx, {
    type: 'line',
    data: { labels: rows.map(r=>r.fecha), datasets: [{ label: 'Ideal', data: rows.map(r=>r.horas), tension: .25 }] },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });
}

document.getElementById('btnRecalcBurndown')?.addEventListener('click', recalc);
window._hooks = window._hooks || {};
window._hooks['view-burndown'] = recalc;

})();