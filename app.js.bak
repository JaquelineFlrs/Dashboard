/* GM Sprints – FULL v5 (ES)
   Incluye:
   - Burndown: Real día 0 = estimado, futuros = NULL (no se pinta)
   - Botones: Recalcular estimado / Calcular hoy (Real = KPI horas pendientes)
   - Dashboard: Avance por persona + Avance por proyecto
   - Configuración: tabla con filtros, switches terminado/oculto
   - Cargas Diarias: historias y subtareas (parser Zoho dd/mm/yyyy ...)
   - Supabase: usar vistas/RPC declaradas en supabase.sql
*/
const { useState, useEffect, useMemo } = React;
const NAV = [
  { key: 'dashboard', icon: 'fa-solid fa-gauge', label: 'Dashboard' },
  { key: 'sprint',    icon: 'fa-solid fa-flag-checkered', label: 'Sprint' },
  { key: 'cargas',    icon: 'fa-solid fa-upload', label: 'Cargas diarias' },
  { key: 'hrs',       icon: 'fa-solid fa-fire', label: 'Hrs Burndown' },
  { key: 'config',    icon: 'fa-solid fa-gear', label: 'Configuración' },
];

// ---------- Supabase ----------
const SUPABASE_URL = "https://xsmtmnypjbrgnuqtnsda.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzbXRtbnlwamJyZ251cXRuc2RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyNzUzNTYsImV4cCI6MjA3Njg1MTM1Nn0.S9lgld-poDLv9QMevxQHXVFAM-QUG4JNOnR6Ao_oUgw";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// ---------- Helpers ----------
function cls(...xs){return xs.filter(Boolean).join(' ');}
function useDarkMode(){
  const [isDark,setIsDark]=useState(false);
  useEffect(()=>{
    const r=document.documentElement;
    if(isDark) r.classList.add('dark'); else r.classList.remove('dark');
  },[isDark]);
  return { isDark, setIsDark };
}
function toast(msg){ alert(msg); }
function parseIntHours(hhmm){
  if(!hhmm) return 0;
  const [hh] = String(hhmm).trim().split(':');
  const v = parseInt(hh,10);
  return Number.isFinite(v) ? Math.max(0,v) : 0;
}
function fmtDMY(iso){ const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}`; }
// "22/10/2025  04:04:00 p. m." -> "2025-10-22"
function parseZohoDateToISO(dateStr){
  if(!dateStr) return null;
  const s = String(dateStr).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(!m) return null;
  const dd = m[1].padStart(2,'0');
  const mm = m[2].padStart(2,'0');
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

async function getDiaActualDelSprint(sprintId){
  const hoy = new Date().toISOString().slice(0,10);
  const { data, error } = await supabase
    .from('sprint_dias_habiles')
    .select('dia,fecha')
    .eq('sprint_id', sprintId)
    .eq('fecha', hoy)
    .maybeSingle();
  if(error) return { dia: null, fecha: null };
  return { dia: data?.dia ?? null, fecha: data?.fecha ?? null };
}

function App(){
  const { isDark, setIsDark } = useDarkMode();
  const [tab, setTab] = useState('dashboard');
  const [sprintId, setSprintId] = useState(localStorage.getItem('sprint_id') || '');
  const [sprintNombre, setSprintNombre] = useState(localStorage.getItem('sprint_nombre') || '');
  const sprintActivo = sprintNombre ? `${sprintNombre}` : '—';

  return (
    React.createElement('div', {className:'min-h-screen'},
      React.createElement('div', {className:'flex'},
        // Sidebar
        React.createElement('aside', {className:'hidden md:flex w-64 min-h-screen flex-col gap-2 border-r border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/60 backdrop-blur'},
          React.createElement('div', {className:'px-5 py-4 text-lg font-semibold tracking-tight'}, 'GM Sprints'),
          React.createElement('nav', {className:'flex-1 px-3'},
            NAV.map(({key, icon, label}) =>
              React.createElement('button', {key, onClick:()=>setTab(key),
                className:cls('w-full flex items-center gap-3 px-3 py-2 rounded-xl mb-1 transition', tab===key?'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900':'hover:bg-zinc-100 dark:hover:bg-zinc-800')},
                React.createElement('i',{className:cls(icon,'text-sm')}),
                React.createElement('span',{className:'text-sm font-medium'},label)
              )
            )
          ),
          React.createElement('div',{className:'p-3'},
            React.createElement('button',{onClick:()=>setIsDark(!isDark), className:'w-full flex items-center justify-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800'},
              React.createElement('i',{className:cls(isDark?'fa-solid fa-sun':'fa-solid fa-moon')}),
              React.createElement('span',{className:'text-sm'}, isDark?'Light':'Dark',' mode')
            )
          )
        ),
        // Main
        React.createElement('main',{className:'flex-1'},
          React.createElement('header',{className:'sticky top-0 z-10 border-b border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur'},
            React.createElement('div',{className:'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between'},
              React.createElement('div',{className:'flex items-center gap-3'},
                React.createElement('div',{className:'text-sm text-zinc-500 capitalize'}, NAV.find(n=>n.key===tab)?.label),
                React.createElement('div',{className:'text-zinc-400'}, '/'),
                React.createElement('div',{className:'font-semibold'}, 'Home')
              ),
              React.createElement('div',{className:'flex items-center gap-3 text-sm'},
                React.createElement('span',{className:'text-zinc-500'}, 'Sprint activo:'),
                React.createElement('span',{className:'font-medium'}, sprintActivo)
              )
            )
          ),
          React.createElement('div',{className:'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6'},
            tab==='dashboard' && React.createElement(Dashboard,{sprintId}),
            tab==='sprint' && React.createElement(SprintAdmin,{sprintId,setSprintId,setSprintNombre}),
            tab==='cargas' && React.createElement(CargasDiarias,{sprintId}),
            tab==='hrs' && React.createElement(HrsBurndown,{sprintId}),
            tab==='config' && React.createElement(Configuracion,{sprintId})
          )
        )
      )
    )
  );
}

// ---------- Sprint ----------
function SprintAdmin({sprintId,setSprintId,setSprintNombre}){
  const [nombre,setNombre]=useState('');
  const [fi,setFi]=useState('');
  const [ff,setFf]=useState('');
  const [sprints,setSprints]=useState([]);

  async function crearSprint(){
    if(!nombre || !fi || !ff){ toast('Completa nombre, inicio y fin'); return; }
    const { data, error } = await supabase.from('sprints').insert({nombre,fecha_inicio:fi,fecha_fin:ff}).select('*').single();
    if(error){ toast('Error creando sprint: '+error.message); return; }
    setSprintId(data.id); setSprintNombre(data.nombre);
    localStorage.setItem('sprint_id', data.id);
    localStorage.setItem('sprint_nombre', data.nombre);
    toast('Sprint creado ✅');
    cargarSprints();
  }
  async function cargarSprints(){
    const { data, error } = await supabase.from('sprints').select('id,nombre,fecha_inicio,fecha_fin').order('creado_en',{ascending:false});
    if(!error) setSprints(data||[]);
  }
  useEffect(()=>{cargarSprints();},[]);

  return (
    React.createElement(React.Fragment,null,
      React.createElement('section',{className:'rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6'},
        React.createElement('h3',{className:'font-semibold mb-4'},'Sprint'),
        React.createElement('div',{className:'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'},
          React.createElement('div',null,
            React.createElement('label',{className:'text-sm text-zinc-500'},'Nombre del sprint'),
            React.createElement('input',{value:nombre,onChange:e=>setNombre(e.target.value),className:'mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent',placeholder:'Sprint 12 — Mis Viajes'})
          ),
          React.createElement('div',null,
            React.createElement('label',{className:'text-sm text-zinc-500'},'Fecha inicio'),
            React.createElement('input',{type:'date',value:fi,onChange:e=>setFi(e.target.value),className:'mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent'})
          ),
          React.createElement('div',null,
            React.createElement('label',{className:'text-sm text-zinc-500'},'Fecha fin'),
            React.createElement('input',{type:'date',value:ff,onChange:e=>setFf(e.target.value),className:'mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent'})
          )
        ),
        React.createElement('div',{className:'mt-4 flex items-center gap-2'},
          React.createElement('button',{onClick:crearSprint,className:'px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'},'Crear sprint')
        )
      ),
      React.createElement('section',{className:'mt-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6'},
        React.createElement('h4',{className:'font-semibold mb-3'},'Seleccionar sprint activo'),
        React.createElement('div',{className:'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'},
          (sprints||[]).map(sp =>
            React.createElement('button',{key:sp.id,onClick:()=>{setSprintId(sp.id); setSprintNombre(sp.nombre); localStorage.setItem('sprint_id',sp.id); localStorage.setItem('sprint_nombre',sp.nombre); toast('Sprint activo cambiado');}, className: 'text-left p-3 rounded-xl border hover:bg-zinc-100 dark:hover:bg-zinc-800'},
              React.createElement('div',{className:'font-medium'}, sp.nombre),
              React.createElement('div',{className:'text-xs text-zinc-500'}, `${sp.fecha_inicio} → ${sp.fecha_fin}`)
            )
          )
        )
      )
    )
  );
}

// ---------- Cargas Diarias ----------
function CargasDiarias({sprintId}){
  const [subtareasRows,setSubtareasRows]=useState([]);
  const [historiasRows,setHistoriasRows]=useState([]);

  function papaParse(file, onDone){
    Papa.parse(file,{ header:true, skipEmptyLines:true, complete: (res)=> onDone(res.data) });
  }

  async function subirHistorias(){
    if(!sprintId){ toast('Selecciona/crea un sprint'); return; }
    for(const row of historiasRows){
      try{
        const tarea_id = row['ID de Tarea'] || row['Id de Tarea'] || row['ID_TAREA'];
        const proyecto = row['Nombre de la lista de tareas'] || row['Proyecto'];
        const nombre   = row['Nombre de Tarea'] || row['Historia'] || row['Nombre'];
        if(!tarea_id || !proyecto || !nombre) continue;
        const { error } = await supabase.rpc('upsert_historia', { p_sprint: sprintId, p_tarea_id: tarea_id, p_proyecto: proyecto, p_nombre: nombre });
        if(error) console.warn('upsert_historia err', error);
      }catch(e){ console.warn('row historia err',e); }
    }
    toast('Historias cargadas ✅');
  }

  async function subirSubtareas(){
    if(!sprintId){ toast('Selecciona/crea un sprint'); return; }
    for(const row of subtareasRows){
      try{
        const historia_id = row['ID de Tarea principal'] || row['ID tarea principal'] || row['ID_TAREA_PRINCIPAL'];
        const nombre      = row['Nombre de Tarea'] || row['Subtarea'] || row['Nombre'];
        const propietario = row['Propietario'] || row['Owner'] || '—';
        const duracion_h  = parseIntHours(row['Duración'] || row['Duracion'] || row['DURACION']);
        const estado      = row['Estado personalizado'] || row['Estado'] || '';
        const fcISO       = parseZohoDateToISO(row['Hora de creación']);
        const ftISO       = parseZohoDateToISO(row['Fecha de terminación']);
        if(!historia_id || !nombre) continue;
        const { error } = await supabase.rpc('upsert_subtarea', {
          p_sprint: sprintId, p_historia_tarea_id: historia_id, p_nombre: nombre,
          p_propietario: propietario, p_duracion_h: duracion_h, p_estado: estado,
          p_creacion: fcISO ? (fcISO+'T00:00:00Z') : null,
          p_terminacion: ftISO ? (ftISO+'T00:00:00Z') : null
        });
        if(error) console.warn('upsert_subtarea err', error);
      }catch(e){ console.warn('w subtarea err', e); }
    }
    toast('Subtareas cargadas ✅');
  }

  return (
    React.createElement(React.Fragment,null,
      React.createElement('section',{className:'rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6'},
        React.createElement('h3',{className:'font-semibold mb-3'},'Cargas diarias – Subtareas'),
        React.createElement('input',{type:'file', accept:'.csv,.txt', onChange:e=> papaParse(e.target.files[0], setSubtareasRows)}),
        React.createElement('div',{className:'mt-2 text-xs text-zinc-500'},'Formato Zoho. La primera fila debe ser encabezados.'),
        React.createElement('div',{className:'mt-3'},
          React.createElement('button',{onClick: subirSubtareas, className:'px-3 py-1.5 rounded-xl border hover:bg-zinc-100 dark:hover:bg-zinc-800'},'Subir subtareas')
        )
      ),
      React.createElement('section',{className:'mt-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6'},
        React.createElement('h3',{className:'font-semibold mb-3'},'Cargas diarias – Actualización de historias'),
        React.createElement('input',{type:'file', accept:'.csv,.txt', onChange:e=> papaParse(e.target.files[0], setHistoriasRows)}),
        React.createElement('p',{className:'mt-2 text-xs text-zinc-500'},'Upsert por "ID de Tarea" (sin modificar columnas).'),
        React.createElement('div',{className:'mt-3'},
          React.createElement('button',{onClick: subirHistorias, className:'px-3 py-1.5 rounded-xl border hover:bg-zinc-100 dark:hover:bg-zinc-800'},'Subir historias')
        )
      )
    )
  );
}

// ---------- Dashboard ----------
function Dashboard({sprintId}){
  const [kpi,setKpi]=useState(null);
  const [estimado,setEstimado]=useState([]);
  const [real,setReal]=useState([]);
  const [terminadasByDia,setTerminadasByDia]=useState([]);
  const [avance,setAvance]=useState([]);
  const [proyectos,setProyectos]=useState([]);

  async function cargarTodo(){
    if(!sprintId){ return; }
    let { data:kpis } = await supabase.from('sprint_kpis').select('*').eq('sprint_id', sprintId).maybeSingle();
    setKpi(kpis||{total_horas:0,horas_terminadas:0,horas_pendientes:0,porcentaje_avance:0});

    let { data:est } = await supabase.from('sprint_burndown_estimado').select('*').eq('sprint_id',sprintId).order('dia',{ascending:true});
    setEstimado(est||[]);

    // Asegura burndown_real inicial si no hay
    let { data:reales } = await supabase.from('burndown_real').select('*').eq('sprint_id',sprintId).order('dia',{ascending:true});
    if(!reales || reales.length===0){
      await supabase.rpc('init_burndown_real',{ p_sprint: sprintId });
      let r2 = await supabase.from('burndown_real').select('*').eq('sprint_id',sprintId).order('dia',{ascending:true});
      reales = r2.data||[];
    }
    setReal(reales||[]);

    let { data:bars } = await supabase.from('horas_terminadas_por_dia').select('*').eq('sprint_id',sprintId).order('fecha',{ascending:true});
    setTerminadasByDia(bars||[]);

    let { data:av } = await supabase.rpc('avance_por_persona_extendido', { p_sprint: sprintId });
    setAvance(av || []);

    let { data:ap } = await supabase.from('avance_por_proyecto').select('*').eq('sprint_id',sprintId).order('porcentaje_avance',{ascending:false});
    setProyectos(ap||[]);
  }
  useEffect(()=>{ cargarTodo(); },[sprintId]);

  useEffect(()=>{
    const ctxL = document.getElementById('chart-line');
    const ctxB = document.getElementById('chart-bars');
    if(!ctxL || !ctxB) return;

    const labels = (estimado||[]).map(x=>`Día ${x.dia}`);
    const dataEst = (estimado||[]).map(x=>x.horas_estimadas);

    // Real: null para días sin captura (no dibujar)
    const mapRealByDia = new Map((real||[]).map(r=>[r.dia, r.horas]));
    const dataReal = (estimado||[]).map(x=> {
      const h = mapRealByDia.get(x.dia);
      return (h === null || h === undefined) ? null : h;
    });

    const line = new Chart(ctxL,{type:'line',data:{labels,datasets:[
      {label:'Estimado', data:dataEst, borderColor:'#16a34a', spanGaps:true, tension:0},
      {label:'Real', data:dataReal, borderColor:'#2563eb', spanGaps:true, tension:0}
    ]}, options:{responsive:true}});

    const bar = new Chart(ctxB,{type:'bar',data:{
      labels:(terminadasByDia||[]).map(x=>x.fecha),
      datasets:[{label:'Horas terminadas', data:(terminadasByDia||[]).map(x=>x.horas_terminadas), backgroundColor:'#0ea5e9'}]
    }, options:{responsive:true}});
    return ()=> { line.destroy(); bar.destroy(); };
  },[estimado,real,terminadasByDia]);

  return (
    React.createElement(React.Fragment,null,
      React.createElement('section',{className:'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'},
        React.createElement(KpiCard,{title:'Total de horas', value:kpi? kpi.total_horas:'—', icon:'fa-solid fa-clock'}),
        React.createElement(KpiCard,{title:'Horas terminadas', value:kpi? kpi.horas_terminadas:'—', icon:'fa-solid fa-circle-check'}),
        React.createElement(KpiCard,{title:'Horas pendientes', value:kpi? kpi.horas_pendientes:'—', icon:'fa-solid fa-gauge'}),
        React.createElement(KpiCard,{title:'% Avance', value:kpi? `${kpi.porcentaje_avance}%`:'—', icon:'fa-solid fa-chart-line'}),
      ),
      React.createElement('section',{className:'mt-6 grid grid-cols-1 lg:grid-cols-12 gap-4'},
        React.createElement('div',{className:'lg:col-span-12 rounded-2xl border p-4 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'},
          React.createElement('div',{className:'flex items-center justify-between mb-3'},
            React.createElement('h3',{className:'font-semibold'},'Burndown – Estimado vs Real'),
            React.createElement('div',{className:'flex items-center gap-2'},
              React.createElement('button',{onClick: cargarTodo, className:'px-3 py-1.5 rounded-xl border hover:bg-zinc-100 dark:hover:bg-zinc-800'}, 'Recalcular estimado'),
              React.createElement('button',{
                onClick: async ()=>{
                  if(!sprintId) return;
                  const { data:kpis } = await supabase.from('sprint_kpis').select('*').eq('sprint_id',sprintId).maybeSingle();
                  const horasPend = kpis?.horas_pendientes ?? null;
                  if(horasPend===null){ toast('No se pudo obtener KPI de horas pendientes'); return; }
                  const { dia, fecha } = await getDiaActualDelSprint(sprintId);
                  if(dia===null){ toast('Hoy no es un día hábil del sprint (o está fuera del rango/festivo)'); return; }
                  const { error } = await supabase.rpc('set_burndown_real', { p_sprint: sprintId, p_fecha: fecha, p_dia: dia, p_horas: horasPend });
                  if(error){ toast('Error al guardar real de hoy: '+error.message); return; }
                  toast(`Real del día ${dia} actualizado a ${horasPend} h`);
                  const r2 = await supabase.from('burndown_real').select('*').eq('sprint_id',sprintId).order('dia',{ascending:true});
                  setReal(r2.data||[]);
                },
                className:'px-3 py-1.5 rounded-xl border hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }, 'Calcular hoy (Real = horas pendientes)')
            )
          ),
          React.createElement('div',{className:'h-64 w-full rounded-xl border border-dashed flex items-center justify-center text-zinc-400 dark:border-zinc-700'},
            React.createElement('canvas',{id:'chart-line',className:'w-full h-full'})
          )
        ),
        React.createElement('div',{className:'lg:col-span-12 rounded-2xl border p-4 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'},
          React.createElement('div',{className:'flex items-center justify-between mb-3'},
            React.createElement('h3',{className:'font-semibold'},'Horas terminadas por día')
          ),
          React.createElement('div',{className:'h-64 w-full rounded-xl border border-dashed flex items-center justify-center text-zinc-400 dark:border-zinc-700'},
            React.createElement('canvas',{id:'chart-bars',className:'w-full h-full'})
          )
        )
      ),
      // Avance por persona
      React.createElement('section',{className:'mt-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4'},
        React.createElement('h3',{className:'font-semibold mb-3'},'Avance por persona'),
        React.createElement('div',{className:'overflow-x-auto'},
          React.createElement('table',{className:'w-full text-sm'},
            React.createElement('thead',null,
              React.createElement('tr',{className:'text-left text-zinc-500'},
                React.createElement('th',{className:'py-2 pr-4'},'Propietario'),
                React.createElement('th',{className:'py-2 pr-4'},'Totales'),
                React.createElement('th',{className:'py-2 pr-4'},'Terminadas'),
                React.createElement('th',{className:'py-2 pr-4'},'Pendientes'),
                React.createElement('th',{className:'py-2 pr-4'},'Capacidad'),
                React.createElement('th',{className:'py-2 pr-4'},'Diferencia')
              )
            ),
            React.createElement('tbody',null,
              (avance||[]).map((r,i)=>
                React.createElement('tr',{key:i,className:'border-t border-zinc-100 dark:border-zinc-800'},
                  React.createElement('td',{className:'py-2 pr-4'}, r.propietario || '—'),
                  React.createElement('td',{className:'py-2 pr-4'}, r.horas_totales || 0),
                  React.createElement('td',{className:'py-2 pr-4'}, r.horas_terminadas || 0),
                  React.createElement('td',{className:'py-2 pr-4'}, r.horas_pendientes || 0),
                  React.createElement('td',{className:'py-2 pr-4'}, r.capacidad || 0),
                  React.createElement('td',{className: cls('py-2 pr-4 font-medium', (r.diferencia||0)<=0 ? 'text-green-600 dark:text-green-400' : 'text-red-500')},
                    (r.diferencia||0)<=0 ? '✅ A tiempo' : `⚠️ +${r.diferencia} hrs`
                  )
                )
              )
            )
          )
        )
      ),
      // Avance por proyecto
      React.createElement('section',{className:'mt-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4'},
        React.createElement('h3',{className:'font-semibold mb-3'},'Avance por proyecto'),
        React.createElement('div',{className:'overflow-x-auto'},
          React.createElement('table',{className:'w-full text-sm'},
            React.createElement('thead',null,
              React.createElement('tr',{className:'text-left text-zinc-500'},
                React.createElement('th',{className:'py-2 pr-4'},'Proyecto'),
                React.createElement('th',{className:'py-2 pr-4'},'Horas totales'),
                React.createElement('th',{className:'py-2 pr-4'},'Horas terminadas'),
                React.createElement('th',{className:'py-2 pr-4'},'Horas pendientes'),
                React.createElement('th',{className:'py-2 pr-4'},'% Avance')
              )
            ),
            React.createElement('tbody',null,
              (proyectos||[]).map((r,i)=>
                React.createElement('tr',{key:i,className:'border-t border-zinc-100 dark:border-zinc-800'},
                  React.createElement('td',{className:'py-2 pr-4'}, r.proyecto || '—'),
                  React.createElement('td',{className:'py-2 pr-4'}, r.horas_totales || 0),
                  React.createElement('td',{className:'py-2 pr-4'}, r.horas_terminadas || 0),
                  React.createElement('td',{className:'py-2 pr-4'}, r.horas_pendientes || 0),
                  React.createElement('td',{className:'py-2 pr-4'}, `${r.porcentaje_avance || 0}%`)
                )
              )
            )
          )
        )
      )
    )
  );
}

function KpiCard({title,value,icon}){
  return React.createElement('div',{className:'rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm'},
    React.createElement('div',{className:'flex items-center justify-between mb-2'},
      React.createElement('div',{className:'text-sm text-zinc-500'},title),
      React.createElement('div',{className:'p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800'},
        React.createElement('i',{className:icon})
      )
    ),
    React.createElement('div',{className:'text-2xl font-semibold tracking-tight'}, value)
  );
}

// ---------- Hrs Burndown (editable Real) ----------
function HrsBurndown({sprintId}){
  const [rows,setRows]=useState([]);
  const [totalHoras,setTotalHoras]=useState(0);
  const [fi,setFi]=useState(''); const [ff,setFf]=useState('');

  async function cargarBase(){
    if(!sprintId){ return; }
    const [{data:sp},{data:est}]= await Promise.all([
      supabase.from('sprints').select('fecha_inicio,fecha_fin').eq('id',sprintId).single(),
      supabase.from('sprint_burndown_estimado').select('*').eq('sprint_id',sprintId).order('dia',{ascending:true})
    ]);
    setFi(sp?.fecha_inicio||''); setFf(sp?.fecha_fin||'');

    // asegúrate de tener 'real' inicial
    let { data:reales } = await supabase.from('burndown_real').select('*').eq('sprint_id',sprintId).order('dia',{ascending:true});
    if(!reales || reales.length===0){
      await supabase.rpc('init_burndown_real',{ p_sprint: sprintId });
      let r2 = await supabase.from('burndown_real').select('*').eq('sprint_id',sprintId).order('dia',{ascending:true});
      reales = r2.data||[];
    }

    const realByDia = new Map((reales||[]).map(r=>[r.dia, r.horas]));
    const tabla = (est||[]).map(e=> ({
      dia: e.dia, fecha: e.fecha, fecha_dmy: fmtDMY(e.fecha),
      estimado: e.horas_estimadas, real: (realByDia.get(e.dia) ?? null)
    }));
    setRows(tabla);
    const total = (est||[])[0]?.horas_estimadas || 0;
    setTotalHoras(total);
  }

  async function onEdit(i, val){
    const row = rows[i]; if(!row) return;
    const n = (val === '' ? null : Number(val));
    if(n !== null && (Number.isNaN(n) || n < 0)) return;
    setRows(prev=>{ const c=[...prev]; c[i]={...row, real:n}; return c; });
    const { error } = await supabase.rpc('set_burndown_real_nullable', {
      p_sprint: sprintId, p_fecha: row.fecha, p_dia: row.dia, p_horas: n
    });
    if(error) toast('Error guardando Real: '+error.message);
  }

  return (
    React.createElement('section',{className:'rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6'},
      React.createElement('div',{className:'flex items-center justify-between mb-3'},
        React.createElement('h3',{className:'font-semibold'},'Hrs Burndown'),
        React.createElement('div',{className:'flex items-center gap-2'},
          React.createElement('button',{onClick:cargarBase,className:'px-3 py-1.5 rounded-xl border hover:bg-zinc-100 dark:hover:bg-zinc-800'}, 'Recalcular estimado'),
          React.createElement('button',{
            onClick: async ()=>{
              if(!sprintId) return;
              const { data:kpis } = await supabase.from('sprint_kpis').select('*').eq('sprint_id',sprintId).maybeSingle();
              const horasPend = kpis?.horas_pendientes ?? null;
              if(horasPend===null){ toast('No se pudo obtener KPI de horas pendientes'); return; }
              const { dia, fecha } = await getDiaActualDelSprint(sprintId);
              if(dia===null){ toast('Hoy no es un día hábil del sprint (o está fuera del rango/festivo)'); return; }
              const { error } = await supabase.rpc('set_burndown_real', { p_sprint: sprintId, p_fecha: fecha, p_dia: dia, p_horas: horasPend });
              if(error){ toast('Error al guardar real de hoy: '+error.message); return; }
              toast(`Real del día ${dia} actualizado a ${horasPend} h`);
              cargarBase();
            },
            className:'px-3 py-1.5 rounded-xl border hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }, 'Calcular hoy (Real = horas pendientes)')
        )
      ),
      React.createElement('div',{className:'grid grid-cols-1 md:grid-cols-3 gap-3 mb-4'},
        React.createElement('div',null,
          React.createElement('label',{className:'text-xs text-zinc-500'},'Fecha inicio'),
          React.createElement('input',{type:'date',value:fi,readOnly:true,className:'mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-800/40'})
        ),
        React.createElement('div',null,
          React.createElement('label',{className:'text-xs text-zinc-500'},'Fecha fin'),
          React.createElement('input',{type:'date',value:ff,readOnly:true,className:'mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-800/40'})
        ),
        React.createElement('div',null,
          React.createElement('label',{className:'text-xs text-zinc-500'},'Total de horas estimadas (día 0)'),
          React.createElement('input',{value:totalHoras,readOnly:true,className:'mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-800/40'})
        )
      ),
      React.createElement('div',{className:'overflow-x-auto'},
        React.createElement('table',{className:'w-full text-sm'},
          React.createElement('thead',null,
            React.createElement('tr',{className:'text-left text-zinc-500'},
              React.createElement('th',{className:'py-2 pr-4'},'Día'),
              React.createElement('th',{className:'py-2 pr-4'},'Fecha'),
              React.createElement('th',{className:'py-2 pr-4'},'Estimado'),
              React.createElement('th',{className:'py-2 pr-4'},'Real')
            )
          ),
          React.createElement('tbody',null,
            rows.map((r,i)=>
              React.createElement('tr',{key:i,className:'border-t border-zinc-100 dark:border-zinc-800'},
                React.createElement('td',{className:'py-2 pr-4'}, r.dia),
                React.createElement('td',{className:'py-2 pr-4'}, r.fecha_dmy),
                React.createElement('td',{className:'py-2 pr-4'}, r.estimado),
                React.createElement('td',{className:'py-2 pr-4'},
                  React.createElement('input',{
                    type:'number', min:0, step:1,
                    value:(r.real===null || r.real===undefined) ? '' : r.real,
                    onChange:e=>onEdit(i,e.target.value),
                    className:'w-24 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent'
                  })
                )
              )
            )
          )
        )
      )
    )
  );
}

// ---------- Configuración con filtros ----------
function Configuracion({sprintId}){
  const [rows,setRows]=useState([]);
  const [q,setQ]=useState('');
  const [propSel,setPropSel]=useState('');
  const [estadoSel,setEstadoSel]=useState(''); // terminado/pendiente

  async function cargar(){
    if(!sprintId){ setRows([]); return; }
    const { data } = await supabase.from('subtareas_v2').select('*').eq('sprint_id',sprintId).limit(5000);
    setRows(data||[]);
  }
  useEffect(()=>{ cargar(); },[sprintId]);

  const propietarios = useMemo(()=> Array.from(new Set(rows.map(r=>r.propietario).filter(Boolean))).sort(), [rows]);

  const filtradas = useMemo(()=>{
    const t = (q||'').toLowerCase().trim();
    return rows.filter(r => {
      const okQ = !t || (
        (r.nombre||'').toLowerCase().includes(t) ||
        (r.proyecto||'').toLowerCase().includes(t) ||
        (r.nombre_historia||'').toLowerCase().includes(t) ||
        (r.propietario||'').toLowerCase().includes(t)
      );
      const okProp = !propSel || r.propietario===propSel;
      const term = (r.terminado===true);
      const okEstado = !estadoSel || (estadoSel==='terminado' ? term : !term);
      return okQ && okProp && okEstado;
    });
  },[rows,q,propSel,estadoSel]);

  async function setTerminado(id, val){
    const { error } = await supabase.rpc('set_subtarea_terminada',{p_id:id,p_val:val});
    if(!error) cargar();
  }
  async function setOculto(id, val){
    const { error } = await supabase.rpc('set_subtarea_oculta',{p_id:id,p_val:val});
    if(!error) cargar();
  }

  return (
    React.createElement(React.Fragment,null,
      React.createElement('section',{className:'rounded-2xl border p-4 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'},
        React.createElement('div',{className:'flex flex-col md:flex-row md:items-center md:justify-between gap-3'},
          React.createElement('h3',{className:'font-semibold'},'Subtareas'),
          React.createElement('div',{className:'flex flex-col md:flex-row gap-2 items-stretch'},
            React.createElement('div',{className:'relative'}, React.createElement('i',{className:'fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400'}),
              React.createElement('input',{value:q,onChange:e=>setQ(e.target.value),className:'pl-9 pr-3 py-1.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-700', placeholder:'Buscar historia, subtarea, proyecto o propietario'})
            ),
            React.createElement('select',{value:propSel,onChange:e=>setPropSel(e.target.value),className:'px-3 py-1.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent'},
              React.createElement('option',{value:''},'Todos los propietarios'),
              propietarios.map(p=> React.createElement('option',{key:p,value:p},p))
            ),
            React.createElement('select',{value:estadoSel,onChange: e => setEstadoSel(e.target.value),className:'px-3 py-1.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent'},
              React.createElement('option',{value:''},'Todos los estados'),
              React.createElement('option',{value:'pendiente'},'Pendiente'),
              React.createElement('option',{value:'terminado'},'Terminado')
            )
          )
        )
      ),
      React.createElement('section',{className:'mt-4 rounded-2xl border p-4 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'},
        React.createElement('div',{className:'overflow-x-auto'},
          React.createElement('table',{className:'w-full text-sm'},
            React.createElement('thead',null,
              React.createElement('tr',{className:'text-left text-zinc-500'},
                React.createElement('th',{className:'py-2 pr-4'},'Historia (Proyecto)'),
                React.createElement('th',{className:'py-2 pr-4'},'Subtarea'),
                React.createElement('th',{className:'py-2 pr-4'},'Propietario'),
                React.createElement('th',{className:'py-2 pr-4'},'Duración'),
                React.createElement('th',{className:'py-2 pr-4'},'Terminado'),
                React.createElement('th',{className:'py-2 pr-0'},'Ocultar')
              )
            ),
            React.createElement('tbody',null,
              filtradas.map(r=>
                React.createElement('tr',{key:r.id,className:'border-t border-zinc-100 dark:border-zinc-800'},
                  React.createElement('td',{className:'py-3 pr-4'}, `${r.nombre_historia||'—'} (${r.proyecto||'—'})`),
                  React.createElement('td',{className:'py-3 pr-4'}, r.nombre),
                  React.createElement('td',{className:'py-3 pr-4'}, r.propietario),
                  React.createElement('td',{className:'py-3 pr-4'}, `${r.duracion_h} h`),
                  React.createElement('td',{className:'py-3 pr-4'},
                    React.createElement('input',{type:'checkbox',checked:!!r.terminado,onChange:e=>setTerminado(r.id,e.target.checked),className:'h-4 w-4 accent-zinc-900 dark:accent-zinc-100'})
                  ),
                  React.createElement('td',{className:'py-3 pr-0'},
                    React.createElement('input',{type:'checkbox',checked:!!r.oculto,onChange=e=>setOculto(r.id,e.target.checked),className:'h-4 w-4 accent-zinc-900 dark:accent-zinc-100'})
                  )
                )
              )
            )
          )
        )
      )
    )
  );
}

// Render
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));

(() => {
  const { createElement: h, useEffect, useRef, useState } = React;
  const root = document.getElementById('root');

  // Register Chart.js components
  const Chart = window.Chart;
  if (!Chart) {
    root.innerHTML = '<div class="p-6 text-red-600">Error: Chart.js no está cargado.</div>';
    return;
  }
  Chart.register(...(Chart?.registerables || []));

  function useChart(canvasRef, configFactory, deps = []) {
    const chartRef = useRef(null);
    useEffect(() => {
      const ctx = canvasRef.current.getContext('2d');
      // create chart
      const cfg = configFactory();
      chartRef.current = new Chart(ctx, cfg);

      // redraw on resize to recreate gradients
      const ro = new ResizeObserver(() => chartRef.current && chartRef.current.resize());
      ro.observe(canvasRef.current);

      return () => {
        ro.disconnect();
        chartRef.current.destroy();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
    return chartRef;
  }

  function makeGradient(ctx, area, colorStart, colorEnd) {
    const grad = ctx.createLinearGradient(0, area.top, 0, area.bottom || 300);
    grad.addColorStop(0, colorStart);
    grad.addColorStop(1, colorEnd);
    return grad;
  }

  function formatNumber(v) {
    if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
    return v;
  }

  function BurndownChart({ labels, estimated, actual }) {
    const canvasRef = useRef(null);

    const configFactory = () => {
      const ctx = canvasRef.current.getContext('2d');
      // create temporary chart to get chartArea later? We'll use gradients in afterLayout plugin
      return {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Estimado',
              data: estimated,
              borderWidth: 3,
              borderColor: '#06b6d4',
              pointBackgroundColor: '#ffffff',
              pointBorderColor: '#06b6d4',
              pointRadius: 5,
              tension: 0.36,
              fill: true,
              backgroundColor: (ctx) => {
                const chart = ctx.chart;
                const area = chart.chartArea || { top: 0, bottom: 200 };
                return makeGradient(chart.ctx, area, 'rgba(6,182,212,0.18)', 'rgba(6,182,212,0.03)');
              },
              clip: 20,
            },
            {
              label: 'Real',
              data: actual,
              borderWidth: 3,
              borderColor: '#f97316',
              pointBackgroundColor: '#ffffff',
              pointBorderColor: '#f97316',
              pointRadius: 5,
              tension: 0.36,
              fill: true,
              backgroundColor: (ctx) => {
                const chart = ctx.chart;
                const area = chart.chartArea || { top: 0, bottom: 200 };
                return makeGradient(chart.ctx, area, 'rgba(249,115,22,0.16)', 'rgba(249,115,22,0.03)');
              },
              borderDash: [6, 4],
              clip: 20,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 12, padding: 12 } },
            tooltip: {
              backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--tw-bg-opacity') ? undefined : undefined,
              padding: 10,
              titleFont: { weight: '600' },
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${ctx.formattedValue}`,
              },
            },
            title: {
              display: true,
              text: 'Burndown ',
              padding: { top: 6, bottom: 12 },
              font: { size: 16, weight: '600' },
            },
          },
          scales: {
            x: {
              ticks: { color: getComputedStyle(document.documentElement).color },
              grid: { display: false },
            },
            y: {
              beginAtZero: true,
              ticks: {
                callback: (v) => formatNumber(v),
                color: getComputedStyle(document.documentElement).color,
              },
              grid: {
                color: (ctx) => {
                  const c = getComputedStyle(document.documentElement).color;
                  return Chart.helpers.color(c).alpha(0.08).rgbString();
                },
              },
            },
          },
        },
        plugins: [{
          id: 'resize-gradient-fix',
          afterLayout: (chart) => {
            // force update of backgroundColor if it's a function (to recreate gradient with proper area)
            chart.data.datasets.forEach((ds, i) => {
              if (typeof ds.backgroundColor === 'function') ds.backgroundColor = ds.backgroundColor({ chart, index: i });
            });
          }
        }]
      };
    };

    useChart(canvasRef, configFactory, [labels.join(','), estimated.join(','), actual.join(',')]);

    return h('div', { className: 'bg-white dark:bg-zinc-900 shadow-md rounded-lg p-4 h-[360px]' },
      h('canvas', { ref: canvasRef, style: { width: '100%', height: '100%' } })
    );
  }

  function HoursPerDayChart({ labels, hours }) {
    const canvasRef = useRef(null);

    const configFactory = () => ({
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Horas terminadas',
          data: hours,
          backgroundColor: (ctx) => {
            const chart = ctx.chart;
            const area = chart.chartArea || { top: 0, bottom: 200 };
            return makeGradient(chart.ctx, area, 'rgba(99,102,241,0.22)', 'rgba(99,102,241,0.02)');
          },
          borderRadius: 6,
          barThickness: 'flex',
          maxBarThickness: 28,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.formattedValue} hrs`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: getComputedStyle(document.documentElement).color },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: (v) => formatNumber(v),
              color: getComputedStyle(document.documentElement).color,
            },
            grid: {
              color: (ctx) => {
                const c = getComputedStyle(document.documentElement).color;
                return Chart.helpers.color(c).alpha(0.08).rgbString();
              },
            },
          },
        },
      };
    };

    useChart(canvasRef, configFactory, [labels.join(','), hours.join(',')]);

    return h('div', { className: 'bg-white dark:bg-zinc-900 shadow-md rounded-lg p-4 h-[360px]' },
      h('canvas', { ref: canvasRef, style: { width: '100%', height: '100%' } })
    );
  }

  // Render charts on Dashboard
  const dashboardRoot = document.getElementById('root');
  if (dashboardRoot) {
    const observer = new MutationObserver(() => {
      const chartsContainer = dashboardRoot.querySelector('.mx-auto.max-w-7xl.px-4.sm\\:px-6.lg\\:px-8.py-6');
      if (!chartsContainer) return;

      // Unobserve after first execution
      observer.disconnect();

      // Find and render BurndownChart
      const burndownChartEl = chartsContainer.querySelector('#chart-line');
      if (burndownChartEl) {
        const labels = Array.from(burndownChartEl.querySelectorAll('tbody tr')).map(row => row.children[0].innerText);
        const estimated = Array.from(burndownChartEl.querySelectorAll('tbody tr')).map(row => parseFloat(row.children[2].innerText.replace(',', '.')));
        const actual = Array.from(burndownChartEl.querySelectorAll('tbody tr')).map(row => parseFloat(row.children[3].innerText.replace(',', '.')));

        ReactDOM.createRoot(burndownChartEl).render(
          React.createElement(BurndownChart, { labels, estimated, actual })
        );
      }

      // Find and render HoursPerDayChart
      const hoursPerDayChartEl = chartsContainer.querySelector('#chart-bars');
      if (hoursPerDayChartEl) {
        const labels = Array.from(hoursPerDayChartEl.querySelectorAll('tbody tr')).map(row => row.children[0].innerText);
        const hours = Array.from(hoursPerDayChartEl.querySelectorAll('tbody tr')).map(row => parseFloat(row.children[1].innerText.replace(',', '.')));

        ReactDOM.createRoot(hoursPerDayChartEl).render(
          React.createElement(HoursPerDayChart, { labels, hours })
        );
      }
    });

    observer.observe(dashboardRoot, { childList: true, subtree: true });
  }
})();
