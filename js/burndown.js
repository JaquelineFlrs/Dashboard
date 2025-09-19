(function(){
'use strict';
const CM = window._commons;
// burndown.js — pestaña aparte

let bdChart = null;

async function buildBurndown(){
  CM.showLoading(true);
  try{
    let { data, error } = await window.db.from(CM.TABLES.SPRINTS)
  .select('fecha_inicio, fecha_fin, total_hrs')
  .or('activo.eq.true,activo.eq.1')
  .limit(1)
  .maybeSingle();
if((error || !data)){
  const today = new Date().toISOString().slice(0,10);
  const q = await window.db.from(CM.TABLES.SPRINTS)
    .select('fecha_inicio, fecha_fin, total_hrs')
    .lte('fecha_inicio', today)
    .gte('fecha_fin', today)
    .order('fecha_inicio', { ascending:false })
    .limit(1)
    .maybeSingle();
  data = q.data; error = q.error;
}

    if(error || !data){ console.warn('Sin sprint activo para burndown.'); return; }
    const totalHrs = Number(data.total_hrs || 0);
    const excludeWeekends = document.getElementById('bdExcludeWeekends').checked;
    const excludeHolidays = document.getElementById('bdExcludeMxHolidays').checked;

    const days = CM.businessDays(data.fecha_inicio, data.fecha_fin, {excludeWeekends, excludeHolidays});
    const series = CM.buildIdealBurndown(totalHrs, days);

    const ctx = document.getElementById('burndownCanvas').getContext('2d');
    if(bdChart){ bdChart.destroy(); }
    bdChart = new Chart(ctx, {
      type:'line',
      data:{ labels: series.labels, datasets:[{ label:'Ideal', data: series.data, tension:0.2 }]},
      options:{ responsive:true, plugins:{legend:{display:true}}, scales:{ y:{ beginAtZero:true }} }
    });

    // Tabla detalle (plan por día = total/días)
    const head = document.getElementById('theadBD');
    const body = document.getElementById('tbodyBD');
    head.innerHTML = '<tr><th>Fecha</th><th>Horas plan por día</th></tr>';
    const perDay = days.length ? (totalHrs / days.length) : 0;
    body.innerHTML = days.map(d=> `<tr><td>${d}</td><td>${perDay.toFixed(2)}</td></tr>`).join('');
  } finally {
    CM.showLoading(false);
  }
}

document.getElementById('btnRecalcBurndown').addEventListener('click', buildBurndown);
// hook para refrescar al entrar a burndown
window._hooks = window._hooks || {}; window._hooks['view-burndown'] = buildBurndown;
// carga inicial si se abre directo
buildBurndown();

})();
