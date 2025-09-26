
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bodyParser = require('body-parser');
const { createClient } = require('@supabase/supabase-js');
const app = express();
const upload = multer();
app.use(cors());
app.use(bodyParser.json({limit: '10mb'}));
app.use(bodyParser.urlencoded({ extended: true }));
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
app.get('/api/health', (req,res)=>res.json({ok:true, at: new Date().toISOString()}));
const ALLOWED_TABLES = new Set(['sprint','participante','sprint_participante','sprint_ausencia','zoho_historia_raw','zoho_subtarea_raw','sprint_historia','sprint_subtarea','historia_plan_persona','burndown_daily']);
const ALLOWED_VIEWS = new Set(['vw_kpis_top','vw_burndown_estimado','vw_resumen_por_persona','vw_resumen_por_lista','vw_cotejo_totales','vw_cotejo_por_lista','vw_cotejo_por_historia']);
const ALLOWED_RPCS = new Set(['set_participante_activo_default','fn_sync_historias','fn_sync_subtareas']);
app.post('/api/db', async (req,res) => {
  try{
    const { from, action, values, filters=[], order, limit=200, single=false, select='*' } = req.body||{};
    if(!ALLOWED_TABLES.has(from) && !ALLOWED_VIEWS.has(from)) return res.status(400).json({error:'table/view not allowed'});
    let q = supa.from(from);
    if(action==='select'){
      q = q.select(select);
      for(const f of filters){
        const { col, op, val } = f;
        if(op==='eq') q = q.eq(col, val);
        else if(op==='ilike') q = q.ilike(col, val);
      }
      if(order) q = q.order(order.col, { ascending: !!order.ascending });
      q = q.limit(limit);
      const { data, error } = await q;
      if(error) return res.status(400).json({error: error.message});
      return res.json({ data: single ? (data?.[0]||null) : data });
    }else if(action==='insert'){
      const { data, error } = await q.insert(values).select();
      if(error) return res.status(400).json({error: error.message});
      return res.json({ data });
    }else if(action==='upsert'){
      const { onConflict } = req.body;
      const { data, error } = await q.upsert(values, { onConflict }).select();
      if(error) return res.status(400).json({error: error.message});
      return res.json({ data });
    }else if(action==='update'){
      for(const f of filters){ if(f.op==='eq') q = q.eq(f.col, f.val); }
      const { data, error } = await q.update(values).select();
      if(error) return res.status(400).json({error: error.message});
      return res.json({ data });
    }else{
      return res.status(400).json({error:'unsupported action'});
    }
  }catch(e){ return res.status(500).json({error:String(e)}); }
});
app.post('/api/rpc/:fn', async (req,res) => {
  const fn = req.params.fn;
  if(!ALLOWED_RPCS.has(fn)) return res.status(400).json({error:'rpc not allowed'});
  try{
    const { data, error } = await supa.rpc(fn, req.body||{});
    if(error) return res.status(400).json({error:error.message});
    return res.json({ data });
  }catch(e){ return res.status(500).json({error:String(e)}); }
});
function normalizeHeader(h){ return String(h||'').toLowerCase().replace(/\s+/g,' ').replace(/[^\wáéíóúüñ ]/g,'').trim(); }
function pick(headers, aliases){ const hnorm = headers.map(normalizeHeader); for(const alias of aliases){ const i = hnorm.indexOf(alias); if(i>=0) return headers[i]; } return null; }
function hhmmToHours(val){ if(val==null || val==='') return null; const s = String(val).trim(); if(/^\d+(\.\d+)?$/.test(s)) return parseFloat(s); const m = s.match(/^(\d{1,2})[:hH](\d{1,2})$/); if(m){ const h = parseInt(m[1],10), mm = parseInt(m[2],10); return h + mm/60; } return null; }
const multerUpload = require('multer')();
app.post('/api/upload/:kind', multerUpload.single('file'), async (req,res)=>{
  try{
    const kind = req.params.kind; const sprint_id = parseInt(req.body.sprint_id,10);
    if(!req.file) return res.status(400).json({error:'missing file'});
    const csv = req.file.buffer.toString('utf8');
    const rows = csv.split(/\r?\n/).map(l=>l.split(/,|;|\t/));
    const headers = (rows.shift()||[]).map(h=>h.trim());
    const map = {};
    if(kind==='hist'){
      map.zoho_historia_id = pick(headers, ['zoho historia id','id','id historia']);
      map.codigo = pick(headers, ['codigo','code','clave']);
      map.titulo = pick(headers, ['titulo','título','title','asunto']);
      map.lista = pick(headers, ['lista','list','tablero','board']);
      map.propietario = pick(headers, ['propietario','owner','asignado a','responsable']);
      map.duracion = pick(headers, ['duracion','duración','duration','horas','hhmm','estimado']);
    }else{
      map.zoho_subtarea_id = pick(headers, ['zoho subtarea id','id subtarea','id']);
      map.zoho_historia_id = pick(headers, ['zoho historia id','id historia','historia id']);
      map.titulo = pick(headers, ['titulo','título','title','asunto']);
      map.propietario_zoho = pick(headers, ['propietario','owner','asignado a','responsable']);
      map.estado_zoho = pick(headers, ['estado','status','situacion','situación']);
      map.duracion_zoho = pick(headers, ['duracion','duración','duration','horas','hhmm','estimado']);
    }
    const out = [];
    for(const r of rows){
      if(r.length===1 && r[0]==='') continue;
      const obj = { sprint_id };
      for(const [k, col] of Object.entries(map)){ if(!col){ obj[k]=null; continue; } const idx = headers.indexOf(col); obj[k] = idx>=0 ? r[idx] : null; }
      if(kind==='hist' && obj.duracion!=null) obj.duracion = hhmmToHours(obj.duracion);
      if(kind==='subt' && obj.duracion_zoho!=null) obj.duracion_zoho = hhmmToHours(obj.duracion_zoho);
      out.push(obj);
    }
    if(kind==='hist'){ for(let i=0;i<out.length;i+=500){ const chunk = out.slice(i,i+500); const { error } = await supa.from('zoho_historia_raw').upsert(chunk, { onConflict: 'sprint_id,zoho_historia_id' }); if(error) return res.status(400).json({error:error.message}); } }
    else { for(let i=0;i<out.length;i+=500){ const chunk = out.slice(i,i+500); const { error } = await supa.from('zoho_subtarea_raw').upsert(chunk, { onConflict: 'sprint_id,zoho_subtarea_id' }); if(error) return res.status(400).json({error:error.message}); } }
    return res.json({ ok:true, count: out.length, map });
  }catch(e){ return res.status(500).json({error:String(e)}); }
});
app.use(express.static('web'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log('Server running on :' + PORT));
