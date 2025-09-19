(function(){
'use strict';
const CM = window._commons;

// Estado global para evitar duplicados y carreras
window.__bd = window.__bd || { chart: null, bound: false, inflight: false };

async function buildBurndown(){
  if (window.__bd.inflight) return;      // evita llamadas simultáneas
  window.__bd.inflight = true;
  CM.showLoading(true);
  try{
    const { data: serie, error } = await window.db
      .from('burndown_dataset')
      .select('dia, horas_restantes_real, horas_restantes_ideal')
      .order('dia', { ascending: true });

    if (error) { console.error('burndown_dataset:', error); return; }
    if (!Array.isArray(serie)) return;

    const labels = serie.map(r => r.dia);
    const ideal  = serie.map(r => (r?.horas_restantes_ideal ?? null));
    const real   = serie.map(r => (r?.horas_restantes_real  ?? null)); // NULL → corte en fechas futuras

    // Destruir cualquier chart previo para este canvas
    const canvas = document.getElementById('burndownCanvas');
    if (!canvas) { console.warn('No existe #burndownCanvas'); return; }
    const existing = (typeof Chart.getChart === 'function')
      ? Chart.getChart(canvas)
      : (Chart.instances ? Object.values(Chart.instances).find(c => c.canvas === canvas) : null);
    if (existing) existing.destroy();
    if (window.__bd.chart) { try{ window.__bd.chart.destroy(); }catch(e){} window.__bd.chart = null; }

    const ctx = canvas.getContext('2d');
    window.__bd.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Estimado',
            data: ideal,
            borderColor: 'rgba(0, 102, 255, 0.85)',
            backgroundColor: 'rgba(0, 102, 255, 0.08)',
            fill: 'origin',
            tension: 0.25
          },
          {
            label: 'Real',
            data: real,
            borderColor: 'rgba(220, 0, 0, 0.9)',
            backgroundColor: 'rgba(220, 0, 0, 0.08)',
            fill: 'origin',
            spanGaps: false,  // deja hueco donde es NULL (futuro)
            tension: 0.25
          }
        ]
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Horas (Suma)' } },
          x: { title: { display: true, text: 'Día' } }
        },
        plugins: {
          legend: { display: true },
          tooltip: { callbacks:{
            label: (ctx) => `${ctx.dataset.label}: ${ctx.formattedValue ?? ''}`
          }}
        }
      }
    });

    // Tabla estilo "como la imagen"
    const head = document.getElementById('theadBD');
    const body = document.getElementById('tbodyBD');
    if (head) head.innerHTML = '<tr><th>Fecha</th><th>Horas</th><th>Tipo</th></tr>';
    if (body) {
      const filas = [];
      // Estimado (todas las fechas)
      serie.forEach(r => filas.push({
        fecha: r.dia,
        horas: r.horas_restantes_ideal,
        tipo:  'Estimado'
      }));
      // Real (solo donde hay dato)
      serie.forEach(r => {
        if (r.horas_restantes_real !== null) {
          filas.push({ fecha: r.dia, horas: r.horas_restantes_real, tipo: 'Real' });
        }
      });
      // Ordena por fecha y luego por tipo (Estimado primero)
      filas.sort((a,b) => (a.fecha<b.fecha? -1 : a.fecha>b.fecha? 1 : (a.tipo>b.tipo?1:-1)));
      body.innerHTML = filas.map(f =>
        `<tr><td>${f.fecha}</td><td>${Number(f.horas).toFixed(2)}</td>
             <td><span class="tag ${f.tipo==='Estimado'?'is-info':'is-danger'}">${f.tipo}</span></td></tr>`
      ).join('');
    }

  } finally {
    window.__bd.inflight = false;
    CM.showLoading(false);
  }
}

// Enlaza botón solo una vez
if (!window.__bd.bound) {
  const btn = document.getElementById('btnRecalcBurndown');
  if (btn) btn.addEventListener('click', buildBurndown);
  window.__bd.bound = true;
}

// Hook + carga inicial
window._hooks = window._hooks || {};
window._hooks['view-burndown'] = buildBurndown;
buildBurndown();

})();
