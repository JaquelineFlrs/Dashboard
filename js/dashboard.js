(function(){
'use strict';
const CM = window._commons;

let bdChart = null;            // referencia global del chart
let bdBound = false;           // evita ligar el click más de una vez

async function buildBurndown(){
  CM.showLoading(true);
  try{
    const { data: serie, error } = await window.db
      .from('burndown_dataset')
      .select('dia, horas_restantes_real, horas_restantes_ideal')
      .order('dia', { ascending: true });

    if (error) { console.error('Error burndown_dataset:', error); return; }
    if (!serie) { return; }

    const labels = serie.map(r => r.dia);
    const ideal  = serie.map(r => (r.horas_restantes_ideal ?? null));
    const real   = serie.map(r => (r.horas_restantes_real ?? null)); // NULL -> huecos (fechas futuras)

    // 💥 FIX: destruye cualquier chart previo en este canvas
    const canvas = document.getElementById('burndownCanvas');
    const existing = Chart.getChart(canvas); // Chart.js v3/v4
    if (existing) { existing.destroy(); }
    if (bdChart)   { bdChart.destroy(); bdChart = null; }

    const ctx = canvas.getContext('2d');
    bdChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Ideal', data: ideal, borderColor: 'rgba(0,0,255,0.6)', tension: 0.2 },
          { label: 'Real',  data: real,  borderColor: 'rgba(255,0,0,0.8)', tension: 0.2, spanGaps: false }
        ]
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        scales: { y: { beginAtZero: true } },
        plugins: { legend: { display: true } }
      }
    });

    // Tabla
    const head = document.getElementById('theadBD');
    const body = document.getElementById('tbodyBD');
    head.innerHTML = '<tr><th>Fecha</th><th>Ideal restante</th><th>Real restante</th></tr>';
    body.innerHTML = serie.map(r =>
      `<tr><td>${r.dia}</td><td>${r.horas_restantes_ideal?.toFixed?.(2) ?? ''}</td><td>${r.horas_restantes_real?.toFixed?.(2) ?? ''}</td></tr>`
    ).join('');

  } finally {
    CM.showLoading(false);
  }
}

// Evita duplicar el listener
if (!bdBound) {
  const btn = document.getElementById('btnRecalcBurndown');
  if (btn) btn.addEventListener('click', buildBurndown, { once: false });
  bdBound = true;
}

// Hook de navegación
window._hooks = window._hooks || {};
window._hooks['view-burndown'] = buildBurndown;

// Carga inicial
buildBurndown();

// (Opcional) si tu app tiene un router propio y destruye vistas, puedes limpiar así:
window._cleanup = window._cleanup || {};
window._cleanup['view-burndown'] = () => { if (bdChart) { bdChart.destroy(); bdChart = null; } };

})();
