// common.js — configuración, helpers, navegación horizontal, loading y utilidades
(function(){
  'use strict';

  const SUPABASE_URL = (window.CONFIG||{}).SUPABASE_URL;
  const SUPABASE_ANON_KEY = (window.CONFIG||{}).SUPABASE_ANON_KEY;
  if(!SUPABASE_URL){ console.error('Falta SUPABASE_URL'); }
  if(!SUPABASE_ANON_KEY){ console.warn('Falta SUPABASE_ANON_KEY — solo podrás leer tablas públicas.'); }

  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const VIEWS = {
    TOTALES_SPRINT:'vw_totales_sprint',
    AVANCE_LISTA:'vw_avance_por_lista',
    TOTALES_PROP:'vw_totales_por_propietario',
  };

  const TABLES = {
    SPRINTS:'sprints',
    SUBTAREAS:'SUBTAREAS',
    HISTORIAS:'HISTORIAS',
    SUBTAREAS_ACTUAL:'SUBTAREASACTUAL',
    HISTORIAS_ACTUAL:'HISTORIASACTUAL',
  };

  const FN_SYNC_NAME = 'fn_sync_simple'; // cambia aquí si tu función se llama distinto

  // Helpers
  const $  = (sel)=> document.querySelector(sel);
  const $$ = (sel)=> Array.from(document.querySelectorAll(sel));
  function fmtNum(n){ n = Number(n||0); return n.toLocaleString('es-MX'); }
  function fmtPct(p){ p = Number(p||0); return (Math.round(p*1000)/10)+'%'; }
  function fmtDate(d){
    if(!d) return '';
    const dt = (d instanceof Date)? d : new Date(d);
    return dt.toLocaleDateString('es-MX', {year:'numeric', month:'2-digit', day:'2-digit'});
  }

  // Loading overlay
  const $loading = document.getElementById('loading');
  function showLoading(v){ if(!$loading) return; $loading.style.visibility = v? 'visible':'hidden'; }

  // Navegación entre vistas
  function setActive(viewId){
    $$('.view').forEach(v=> v.classList.remove('active'));
    const sec = document.getElementById(viewId);
    if(sec){ sec.classList.add('active'); }
    $$('.menu-item').forEach(btn=> btn.classList.toggle('active', btn.getAttribute('data-view')===viewId ));
    if(window._hooks && typeof window._hooks[viewId]==='function'){ window._hooks[viewId](); }
  }

  // Utilidades burndown (simples)
  function businessDays(start, end, excludeWeekends=true){
    const days = [];
    let cur = new Date(start);
    while(cur <= end){
      const dow = cur.getDay();
      if(!excludeWeekends || (dow!==0 && dow!==6)) days.push(new Date(cur));
      cur.setDate(cur.getDate()+1);
    }
    return days;
  }
  function buildIdealBurndown(totalHours, daysCount){
    if(daysCount<=0) return [];
    const step = totalHours / (daysCount-1);
    return Array.from({length:daysCount}, (_,i)=> Math.max(0, Math.round((totalHours - i*step)*100)/100));
  }

  // Render tabla helper (dashboard/subtareas)
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

  // Exponer en global
  window._commons = { db, VIEWS, TABLES, FN_SYNC_NAME, fmtDate, fmtNum, fmtPct, showLoading, businessDays, buildIdealBurndown, setActive, renderTable };
  // Activa dashboard por defecto
  $$('.menu-item').forEach(btn=> btn.addEventListener('click', ()=> setActive(btn.getAttribute('data-view')) ));
  setActive('view-dashboard');
})();
