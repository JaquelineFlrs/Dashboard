// ================== GUARDAR SPRINT (ADMIN) ==================
// Requiere: sb = window.db || window.supabase; y la RPC create_sprint_and_reset
// Campos esperados en el DOM:
//   #sprintNombre  (text)
//   #sprintInicio  (date, YYYY-MM-DD)
//   #sprintFin     (date, YYYY-MM-DD)
//   #sprintHoras   (number, opcional)
//   #sprintActivo  (checkbox, opcional)
// Botón:
//   #btnGuardarSprint

async function guardarSprintAdmin() {
  try {
    const $ = (s, r=document)=> r.querySelector(s);
    const nombre = $('#sprintNombre')?.value?.trim();
    const inicio = $('#sprintInicio')?.value;
    const fin    = $('#sprintFin')?.value;
    const horas  = $('#sprintHoras')?.value ? Number($('#sprintHoras').value) : null;
    const activo = $('#sprintActivo') ? $('#sprintActivo').checked : true;

    // Validaciones rápidas
    if (!nombre || !inicio || !fin) {
      if (typeof msg === 'function') msg('Faltan datos del sprint (nombre/fechas).', false);
      else alert('Faltan datos del sprint (nombre/fechas).');
      return;
    }

    // Confirmación
    const ok = confirm(
`Vas a BORRAR TODO el contenido de las tablas (excepto 'sprints' y festivos) y crear el sprint:
Nombre: ${nombre}
Inicio: ${inicio}
Fin:    ${fin}
¿Confirmas?`
    );
    if (!ok) return;

    // Deshabilitar botón mientras procesa
    const btn = $('#btnGuardarSprint');
    if (btn) { btn.disabled = true; btn.dataset.prevText = btn.textContent; btn.textContent = 'Guardando…'; }

    // Ejecuta RPC (borra todo + inserta sprint)
    const { data, error } = await sb.rpc('create_sprint_and_reset', {
      p_nombre: nombre,
      p_fecha_inicio: inicio,
      p_fecha_fin: fin,
      p_activo: activo,
      p_total_hrs: horas
    });

    if (error) {
      if (typeof msg === 'function') msg(`Error al crear sprint: ${error.message}`, false);
      else alert('Error al crear sprint: ' + error.message);
      return;
    }

    // Éxito
    const idSprint = Array.isArray(data) ? data[0] : data; // por si tu PostgREST devuelve array
    if (typeof msg === 'function') msg(`Sprint creado (id: ${idSprint}). Se limpiaron las tablas.`, true);
    else alert(`Sprint creado (id: ${idSprint}). Se limpiaron las tablas.`);

  } catch (e) {
    if (typeof msg === 'function') msg(`Error inesperado: ${e.message}`, false);
    else alert('Error inesperado: ' + e.message);
  } finally {
    const btn = document.querySelector('#btnGuardarSprint');
    if (btn) { btn.disabled = false; btn.textContent = btn.dataset.prevText || 'Guardar Sprint'; }
  }
}

// Hook al botón en la pestaña Admin
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.querySelector('#btnGuardarSprint');
  if (btn) btn.addEventListener('click', guardarSprintAdmin);
});
