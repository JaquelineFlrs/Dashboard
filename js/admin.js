// admin.js — crear sprint, cargas CSV y burndown
const { db, TABLES, FN_SYNC_NAME, showLoading, businessDays, buildIdealBurndown } = window._commons;

const $a = (id)=> document.getElementById(id);

async function guardarSprint(ev){
  ev.preventDefault();
  const nombre = $a('spNombre').value.trim();
  const inicio = $a('spInicio').value;
  const fin = $a('spFin').value;
  const totalHrs = parseFloat($a('spTotalHrs').value||'0');
  if(!nombre || !inicio || !fin || !Number.isFinite(totalHrs)){
    alert('Completa todos los campos.');
    return;
  }

  if(!confirm(`Vas a BORRAR SUBTAREAS, HISTORIAS y SPRINTS, y crear el sprint "${nombre}". ¿Seguro/a?`)){
    return;
  }
  showLoading(true);
  try{
    // Borra tablas (ajusta si requieres TRUNCATE mediante RPC)
    await db.from(TABLES.SUBTAREAS).delete().neq('id', -1);
    await db.from(TABLES.HISTORIAS).delete().neq('id', -1);
    await db.from(TABLES.SPRINTS).delete().neq('id', -1);

    // Inserta sprint nuevo (requiere que exista columna total_hrs en sprints)
    const payload = { nombre, fecha_inicio: inicio, fecha_fin: fin, activo: true, total_hrs: totalHrs };
    const { error:insErr } = await db.from(TABLES.SPRINTS).insert(payload);
    if(insErr){
      alert('Error al insertar sprint. Verifica que exista la columna total_hrs en sprints.');
      console.error(insErr);
      return;
    }

    alert('Sprint guardado. Ahora puedes cargar CSV y sincronizar.');
    // Actualiza burndown ideal
    dibujarBurndown();
  }catch(e){
    console.error(e);
    alert('Falló la operación de guardado.');
  }finally{
    showLoading(false);
  }
}

async function cargarCsvYSync(){
  const fSub = $a('csvSubtareas').files[0];
  const fHis = $a('csvHistorias').files[0];
  if(!fSub || !fHis){
    alert('Selecciona ambos CSV (Subtareas e Historias).');
    return;
  }
  showLoading(true);
  $a('uploadMsg').textContent = 'Procesando CSV…';
  try{
    const parseCsv = (file)=> new Promise((resolve,reject)=>{
      Papa.parse(file,{header:true,skipEmptyLines:true,complete:(res)=>resolve(res.data),error:reject});
    });
    const [rowsSub, rowsHis] = await Promise.all([parseCsv(fSub), parseCsv(fHis)]);

    // Upsert por lotes
    const upsertBatched = async (table, rows)=>{
      for(let i=0;i<rows.length;i+=500){
        const slice = rows.slice(i,i+500).map(r=>{
          const o={}; for(const k in r){ o[k] = (r[k]===''? null : r[k]); } return o;
        });
        const { error } = await db.from(table).upsert(slice);
        if(error) throw error;
      }
    };

    await upsertBatched(TABLES.SUBTAREASACTUAL, rowsSub);
    await upsertBatched(TABLES.HISTORIASACTUAL, rowsHis);

    // Ejecutar función de sincronización (mueve a SUBTAREAS/HISTORIAS)
    const { error:rpcErr } = await db.rpc(FN_SYNC_NAME);
    if(rpcErr) throw rpcErr;

    $a('uploadMsg').textContent = `Listo: ${rowsSub.length} subtareas + ${rowsHis.length} historias. Datos sincronizados.`;
    alert('Carga y sincronización completadas.');
  }catch(e){
    console.error(e);
    alert('Error durante la carga/sync. Revisa consola.');
    $a('uploadMsg').textContent = 'Ocurrió un error.';
  }finally{
    showLoading(false);
  }
}

// Burndown ideal usando el sprint activo
let bdChart = null;
async function dibujarBurndown(){
  // Lee sprint activo (usará total_hrs)
  const { data, error } = await db.from(TABLES.SPRINTS).select('fecha_inicio, fecha_fin, total_hrs').eq('activo',true).limit(1).maybeSingle();
  if(error || !data){ console.warn('Sin sprint activo para burndown.'); return; }
  const totalHrs = parseFloat(data.total_hrs||'0');
  if(!Number.isFinite(totalHrs) || totalHrs<=0){ console.warn('total_hrs no válido.'); return; }

  const excludeWeekends = $a('spExcluirFines').checked;
  const excludeHolidays = $a('spExcluirFestivos').checked;

  const days = businessDays(data.fecha_inicio, data.fecha_fin, {excludeWeekends, excludeHolidays});
  const series = buildIdealBurndown(totalHrs, days);

  const ctx = document.getElementById('burndown').getContext('2d');
  if(bdChart){ bdChart.destroy(); }
  bdChart = new Chart(ctx, {
    type:'line',
    data:{ labels: series.labels, datasets:[{ label:'Ideal', data: series.data, tension:0.2 }]},
    options:{ responsive:true, plugins:{legend:{display:true}}, scales:{ y:{ beginAtZero:true }} }
  });
}

// Recalcular burndown al cambiar las opciones
['spExcluirFines','spExcluirFestivos'].forEach(id=>{
  document.getElementById(id).addEventListener('change', dibujarBurndown);
});

document.getElementById('frmSprint').addEventListener('submit', guardarSprint);
document.getElementById('btnCargarTodo').addEventListener('click', cargarCsvYSync);

// Dibuja burndown al entrar a Admin (si ya hay sprint activo)
dibujarBurndown();
