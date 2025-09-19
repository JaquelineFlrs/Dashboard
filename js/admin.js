(function(){
'use strict';
const CM = window._commons;
// admin.js — crear sprint y cargas CSV

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
  CM.showLoading(true);
  try{
    await window.db.from(CM.TABLES.SUBTAREAS).delete().neq('id', -1);
    await window.db.from(CM.TABLES.HISTORIAS).delete().neq('id', -1);
    await window.db.from(CM.TABLES.SPRINTS).delete().neq('id', -1);

    const payload = { nombre, fecha_inicio: inicio, fecha_fin: fin, activo: true, total_hrs: totalHrs };
    const { error:insErr } = await window.db.from(CM.TABLES.SPRINTS).insert(payload);
    if(insErr){ throw insErr; }

    alert('Sprint guardado. Ahora puedes cargar CSV y sincronizar.');
  }catch(e){
    console.error(e);
    alert('No se pudo guardar el sprint: '+(e?.message||e));
  }finally{
    CM.showLoading(false);
  }
}

async function cargarCsvYSync(){
  const fSub = $a('csvSubtareas').files[0];
  const fHis = $a('csvHistorias').files[0];
  if(!fSub || !fHis){
    alert('Selecciona ambos CSV (Subtareas e Historias).');
    return;
  }
  CM.showLoading(true);
  $a('uploadMsg').textContent = 'Procesando CSV…';
  try{
    const parseCsv = (file)=> new Promise((resolve,reject)=>{
      Papa.parse(file,{header:true,skipEmptyLines:true,complete:(res)=>resolve(res.data),error:reject});
    });
    const [rowsSub, rowsHis] = await Promise.all([parseCsv(fSub), parseCsv(fHis)]);

    const upsertBatched = async (table, rows)=>{
      for(let i=0;i<rows.length;i+=500){
        const slice = rows.slice(i,i+500).map(r=>{
          const o={}; for(const k in r){ o[k] = (r[k]===''? null : r[k]); } return o;
        });
        const { error } = await window.db.from(table).upsert(slice);
        if(error) throw error;
      }
    };

    await upsertBatched(CM.TABLES.SUBTAREASACTUAL, rowsSub);
    await upsertBatched(CM.TABLES.HISTORIASACTUAL, rowsHis);

    const { error:rpcErr } = await window.db.rpc(CM.FN_SYNC_NAME);
    if(rpcErr) throw rpcErr;

    $a('uploadMsg').textContent = `Listo: ${rowsSub.length} subtareas + ${rowsHis.length} historias. Datos sincronizados.`;
    alert('Carga y sincronización completadas.');
  }catch(e){
    console.error(e);
    alert('Error durante la carga/sync: '+(e?.message||e));
    $a('uploadMsg').textContent = 'Ocurrió un error.';
  }finally{
    CM.showLoading(false);
  }
}

document.getElementById('frmSprint').addEventListener('submit', guardarSprint);
document.getElementById('btnCargarTodo').addEventListener('click', cargarCsvYSync);
// hook vacío por si luego quieres algo al entrar a admin
window._hooks['view-admin'] = ()=>{};

})();
