// ========= Guardar Sprint (Admin) =========
// Requiere: sb = window.db || window.supabase  (ya lo usas en admin.js)
// y la función RPC en BD: public.create_sprint_and_reset(...)

(function(){
  'use strict';

  const sb = window.db || window.supabase;
  const $  = (s, r=document)=> r.querySelector(s);

  function say(txt, ok=true){
    if (typeof window.msg === 'function') return window.msg(txt, ok);
    // fallback
    if (!ok) console.error(txt); else console.log(txt);
    alert(txt);
  }

  const frm = $('#frmSprint');
  if (!frm) return;

  frm.addEventListener('submit', async (ev)=>{
    ev.preventDefault();

    const nombre = $('#spNombre')?.value?.trim();
    const inicio = $('#spInicio')?.value;
    const fin    = $('#spFin')?.value;
    const totalHrsStr = $('#spTotalHrs')?.value;
    const totalHrs = totalHrsStr === '' ? null : Number(totalHrsStr);

    if (!nombre || !inicio || !fin) {
      say('Faltan datos: nombre/fecha inicio/fecha fin.', false);
      return;
    }

    const ok = confirm(
`Vas a BORRAR TODO el contenido de las tablas (excepto 'sprints' y festivos) y crear este sprint:
• Nombre: ${nombre}
• Inicio: ${inicio}
• Fin:    ${fin}
• Horas:  ${totalHrs ?? '—'}
¿Confirmas?`
    );
    if (!ok) return;

    const btn = $('#btnGuardarSprint');
    const prev = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

    try{
      const { data, error } = await sb.rpc('create_sprint_and_reset', {
        p_nombre: nombre,
        p_fecha_inicio: inicio,
        p_fecha_fin: fin,
        p_activo: true,          // lo marcamos activo por defecto
        p_total_hrs: totalHrs
      });

      if (error) {
        say(`Error al crear sprint: ${error.message}`, false);
        return;
      }

      const idSprint = Array.isArray(data) ? data[0] : data;
      say(`Sprint creado (id: ${idSprint}). Se limpiaron las tablas.`, true);

      // Opcional: limpia el formulario
      frm.reset();

    } catch(e){
      say(`Error inesperado: ${e.message}`, false);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = prev || 'Guardar sprint'; }
    }
  });
})();
