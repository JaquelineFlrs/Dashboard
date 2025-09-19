(function(){
'use strict';
const CM = window._commons;

let bdChart = null;

async function buildBurndown(){
  CM.showLoading(true);
  try{
    // Consultar dataset real desde vista burndown_dataset
    const { data: serie, error } = await window.db
      .from('burndown_dataset')
      .select('dia, horas_restantes_real, horas_restantes_ideal')
      .order('dia', { ascending: true });

    if(error || !serie){ console.warn('Error cargando dataset burndown', error); return; }

    const labels = serie.map(r => r.dia);
    const ideal  = serie.map(r => Number(r.horas_restantes_ideal ?? 0));
    const real   = serie.map(r => Number(r.horas_restantes_real ?? 0));

    const ctx = document.getElementById('burndownCanvas').getContext('2d');
    if(bdChart){ bdChart.destroy(); }
    bdChart = new Chart(ctx, {
      type:'line',
      data:{
        labels: labels,
        datasets:[
          { label:'Ideal', data: ideal, borderColor:'rgba(0,0,255,0.6)', tension:0.2 },
          { label:'Real', data: real, borderColor:'rgba(255,0,0,0.8)', tension:0.2 }
        ]
      },
      options:{ responsive:true, plugins:{legend:{display:true}}, scales:{ y:{ beginAtZero:true }} }
    });

    // Tabla detalle
    const head = document.getElementById('theadBD');
    const body = document.getElementById('tbodyBD');
    head.innerHTML = '<tr><th>Fecha</th><th>Ideal restante</th><th>Real restante</th></tr>';
    body.innerHTML = serie.map(r=> 
      `<tr><td>${r.dia}</td><td>${Number(r.horas_restantes_ideal).toFixed(2)}</td><td>${Number(r.horas_restantes_real).toFixed(2)}</td></tr>`
    ).join('');
  } finally {
    CM.showLoading(false);
  }
}

document.getElementById('btnRecalcBurndown').addEventListener('click', buildBurndown);
window._hooks = window._hooks || {}; 
window._hooks['view-burndown'] = buildBurndown;
buildBurndown();

})();