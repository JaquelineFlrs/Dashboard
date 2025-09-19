// common.js bootstrap (normalized)
window.CONFIG = window.CONFIG || {};
const SUPABASE_URL = window.CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.CONFIG.SUPABASE_ANON_KEY;
window._hooks = window._hooks || {};



// common.js — configuración, helpers, navegación horizontal, loading y utilidades


const VIEWS = {
  TOTALES_SPRINT:'vw_totales_sprint',
  AVANCE_LISTA:'vw_avance_por_lista',
  TOTALES_PROP:'vw_totales_por_propietario',
};
const TABLES = {
  SUBTAREASACTUAL:'SUBTAREASACTUAL',
  HISTORIASACTUAL:'HISTORIASACTUAL',
  SUBTAREAS:'SUBTAREAS',
  HISTORIAS:'HISTORIAS',
  SPRINTS:'sprints'
};
const FN_SYNC_NAME = 'fn_sync_simple'; // ajusta si tu función tiene otro nombre

const { createClient } = supabase;
// instancia global única
if(!SUPABASE_URL || !SUPABASE_ANON_KEY){
  showAlert('Falta configurar SUPABASE_URL o SUPABASE_ANON_KEY en js/config.js');
}

try{ window.db = (window.supabase?.createClient||createClient)(SUPABASE_URL, SUPABASE_ANON_KEY); }catch(e){ showAlert('Error creando cliente de Supabase. Revisa tu URL y Key.'); console.error(e); }

const $ = (sel)=> document.querySelector(sel);
const $$ = (sel)=> Array.from(document.querySelectorAll(sel));

// Alert helpers
function showAlert(msg){
  const box = document.getElementById('alert');
  if(!box) return;
  box.style.display = 'block';
  box.innerText = msg;
}
function hideAlert(){
  const box = document.getElementById('alert');
  if(!box) return;
  box.style.display = 'none';
  box.innerText = '';
}

const showLoading = (on)=>{ $('#loading').style.visibility = on ? 'visible' : 'hidden'; };

// Ping conexión (consola)
window.db.from('sprints').select('count', { count: 'exact', head: true }).then(({error,status})=>{
  if(error){ console.warn('⚠️ Supabase no respondió. Status:', status, ' Detalle:', error.message); showAlert('No se pudo leer la tabla "sprints". Verifica URL/Key, CORS y RLS. Status '+status); }
  else { console.log('✅ Conectado a Supabase'); }
});

// Router horizontal + hooks por vista
const hooks = {}; // cada vista puede registrar su "refresh" con window._hooks['view-xxx']=fn
window._hooks = hooks;

function setActive(viewId){
  $$('.menu-item').forEach(b=> b.classList.remove('active'));
  $(`.menu-item[data-view="${viewId}"]`)?.classList.add('active');
  $$('.view').forEach(v=> v.classList.remove('active'));
  document.getElementById(viewId)?.classList.add('active');
  if(hooks[viewId]) hooks[viewId]();
}
window.setActive = setActive;

// Formatos
const fmtDate = (d)=> new Date(d+'T00:00:00').toLocaleDateString('es-MX',{year:'numeric',month:'short',day:'2-digit'});
const fmtNum = (n)=> (n==null||isNaN(n))? '—' : Number(n).toLocaleString('es-MX');
const fmtPct = (n)=> (n==null||isNaN(n))? '—%' : (Number(n).toFixed(1)+'%');

// Festivos México
function mxHolidays(year){
  const d = (m,day)=> new Date(Date.UTC(year,m-1,day));
  const nthMonday = (month,n)=>{
    let date = new Date(Date.UTC(year,month-1,1));
    while(date.getUTCDay()!==1) date.setUTCDate(date.getUTCDate()+1);
    date.setUTCDate(date.getUTCDate()+(n-1)*7);
    return date;
  };
  const thirdMonday = (m)=> nthMonday(m,3);
  const firstMonday = (m)=> nthMonday(m,1);
  return [
    d(1,1), firstMonday(2), thirdMonday(3), d(5,1), d(9,16), thirdMonday(11), d(12,25)
  ].map(x=> x.toISOString().slice(0,10));
}
function businessDays(startStr,endStr,{excludeWeekends=true, excludeHolidays=true}={}){
  const start = new Date(startStr+'T00:00:00Z');
  const end = new Date(endStr+'T00:00:00Z');
  const holidays = excludeHolidays ? new Set(mxHolidays(start.getUTCFullYear()).concat(mxHolidays(end.getUTCFullYear()))) : new Set();
  const days = [];
  for(let t=new Date(start); t<=end; t.setUTCDate(t.getUTCDate()+1)){
    const ymd = t.toISOString().slice(0,10);
    const wd = t.getUTCDay();
    if(excludeWeekends && (wd===0 || wd===6)) continue;
    if(holidays.has(ymd)) continue;
    days.push(ymd);
  }
  return days;
}
function buildIdealBurndown(totalHours, days){
  if(!days.length) return {labels:[], data:[]};
  const step = totalHours / days.length;
  const data = [];
  for(let i=0;i<days.length;i++){
    data.push(Number(Math.max(0, totalHours - step*i).toFixed(2)));
  }
  return { labels: days.map(d=> d.slice(5)), data };
}

// Tablas genéricas
function renderTable(elThead, elTbody, rows){
  elThead.innerHTML = '';
  elTbody.innerHTML = '';
  if(!rows || rows.length===0){
    elThead.innerHTML = '<tr><th>Sin datos</th></tr>';
    return;
  }
  const cols = Object.keys(rows[0]);
  elThead.innerHTML = '<tr>'+cols.map(c=>`<th>${c}</th>`).join('')+'</tr>';
  elTbody.innerHTML = rows.map(r=>'<tr>'+cols.map(c=>`<td>${(r[c]??'')}</td>`).join('')+'</tr>').join('');
}

window._commons = { VIEWS, TABLES, FN_SYNC_NAME, fmtDate, fmtNum, fmtPct, showLoading, businessDays, buildIdealBurndown };
// activa dashboard al cargar
$$('.menu-item').forEach(btn=> btn.addEventListener('click', ()=> setActive(btn.getAttribute('data-view')) ));
setActive('view-dashboard');
