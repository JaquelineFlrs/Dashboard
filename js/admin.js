// ========= Guardar Sprint (Admin) — robusto =========
(function () {
  'use strict';

  const sb = window.db;                             // cliente Supabase creado en js/config.js
  const $  = (s, r=document)=> r.querySelector(s);

  function say(txt, ok=true){
    if (typeof window.msg === 'function') return window.msg(txt, ok);
    if (!ok) console.error(txt); else console.log(txt);
    alert(txt);
  }

  const frm = $('#frmSprint');
  if (!frm) return;

  frm.addEventListener('submit', async (ev) => {
    ev.preventDefault();

    // 1) Forzar validación nativa (required, min, etc.)
    if (!frm.reportValidity()) {
      // El navegador ya marcará el campo faltante
      return;
    }

    // 2) Leer valores DESDE EL FORM (más confiable)
    const nombreEl = frm.querySelector('#spNombre');
    const inicioEl = frm.querySelector('#spInicio');
    const finEl    = frm.querySelector('#spFin');
    const horasEl  = frm.querySelector('#spTotalHrs');

    const nombre = (nombreEl?.value || '').trim();
    const inicio = (inicioEl?.value || '').trim();
    const fin    = (finEl?.value || '').trim();
    const horasStr = (horasEl?.value ?? '').trim();
    const totalHrs = horasStr === '' ? null : Number(horasStr);

    // 3) Validación adicional con mensajes claros
    if (!nombre) { say('Falta el nombre del sprint.', false); nombreEl?.focus(); return; }
    if (!inicio) { say('Falta la fecha de inicio.', false);  inicioEl?.focus(); return; }
    if (!fin)    { say('Falta la fecha de fin.', false);     finEl?.focus();    return; }
    // Si también quieres forzar horas (tu input tiene required), ya lo cubre reportValidity()

    // Log de depuración (puedes quitarlo cuando confirmes que lee bien)
    console.log('[DEBUG sprint]', { nombre, inicio, fin, totalHrs });

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

    try {
      // 4) RPC — crea sprint y resetea tablas
      const { data, error } = await sb.rpc('create_sprint_and_reset', {
        p_nombre: nombre,
        p_fecha_inicio: inicio,
        p_fecha_fin: fin,
        p_activo: true,
        p_total_hrs: totalHrs
      });

      if (error) { say(`Error al crear sprint: ${error.message}`, false); return; }

      const idSprint = Array.isArray(data) ? data[0] : data;
      say(`Sprint creado (id: ${idSprint}). Se limpiaron las tablas.`, true);
      frm.reset();

    } catch (e) {
      say(`Error inesperado: ${e.message}`, false);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = prev || 'Guardar sprint'; }
    }
  });
})();
