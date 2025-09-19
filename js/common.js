// common.js — configuración, helpers, navegación, loading, festivos y burndown
const SUPABASE_URL = 'https://hvdfzdkugkukwoctnpoa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2ZGZ6ZGt1Z2t1a3dvY3RucG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3MzM4ODgsImV4cCI6MjA3MzMwOTg4OH0.8RSq7GAN7Oh9mJOCP9lUndJyLIt';

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
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (sel)=> document.querySelector(sel);
const $$ = (sel)=> Array.from(document.querySelectorAll(sel));
const showLoading = (on)=>{ $('#loading').style.visibility = on ? 'visible' : 'hidden'; };

// Navegación entre vistas
$$('.menu-item').forEach(btn=>{
  btn.addEventListener('click',()=>{
    $$('.menu-item').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.getAttribute('data-view');
    $$('.view').forEach(v=>v.classList.remove('active'));
    document.getElementById(view).classList.add('active');
  });
});

// Formatos
const fmtDate = (d)=> new Date(d+'T00:00:00').toLocaleDateString('es-MX',{year:'numeric',month:'short',day:'2-digit'});
const fmtNum = (n)=> (n==null||isNaN(n))? '—' : Number(n).toLocaleString('es-MX');
const fmtPct = (n)=> (n==null||isNaN(n))? '—%' : (Number(n).toFixed(1)+'%');

// Festivos México (ley federal del trabajo, con lunes cívicos)
function mxHolidays(year){
  const d = (m,day)=> new Date(Date.UTC(year,m-1,day));
  const nthMonday = (month,n)=>{
    let date = new Date(Date.UTC(year,month-1,1));
    while(date.getUTCDay()!==1) date.setUTCDate(date.getUTCDate()+1);
    date.setUTCDate(date.getUTCDate()+(n-1)*7);
    return date;
  };
  const thirdMonday = (month)=> nthMonday(month,3);
  const firstMonday = (month)=> nthMonday(month,1);

  return [
    d(1,1),                       // Año Nuevo
    firstMonday(2),               // Constitución (primer lunes de febrero)
    thirdMonday(3),               // Natalicio de Benito Juárez (tercer lunes de marzo)
    d(5,1),                       // Día del Trabajo
    d(9,16),                      // Independencia
    thirdMonday(11),              // Revolución (tercer lunes de noviembre)
    d(12,25),                     // Navidad
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

// Burndown ideal -> labels + remaining array
function buildIdealBurndown(totalHours, days){
  if(!days.length) return {labels:[], data:[]};
  const step = totalHours / days.length;
  const data = [];
  for(let i=0;i<days.length;i++){
    const remaining = Math.max(0, totalHours - step*i);
    data.push(Number(remaining.toFixed(2)));
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

// Export commons needed elsewhere
window._commons = { db, VIEWS, TABLES, FN_SYNC_NAME, fmtDate, fmtNum, fmtPct, showLoading, businessDays, buildIdealBurndown };
