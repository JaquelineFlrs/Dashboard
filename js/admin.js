// js/admin.js
// ===========================================================
// Admin Dashboard helpers + cargas CSV + sincronización + sprint
// Requiere:
//  - window.db (creado en js/config.js con supabase.createClient(...))
//  - Papa (papaparse)
//  - #frmSprint, #btnGuardarSprint, #csvSubtareas, #csvHistorias,
//    #btnCargarSubtareas, #btnCargarHistorias, #btnSincronizar, #btnCargarTodo
// ===========================================================
(function () {
  'use strict';

  // -------------------------
  // Cliente y utilidades
  // -------------------------
  const sb = window.db || window.supabase;
  const $  = (s, r = document) => r.querySelector(s);

  function msg(txt, ok = true) {
    const el = $('#uploadMsg') || $('#alert');
    if (el) {
      el.style.display = 'block';
      el.style.color = ok ? '#065f46' : '#b91c1c';
      el.style.borderColor = ok ? '#6ee7b7' : '#fca5a5';
      el.style.background = ok ? '#ecfdf5' : '#fff1f2';
      el.textContent = txt;
    } else {
      if (!ok) console.error(txt);
      else console.log(txt);
      alert(txt);
    }
  }

  function setLoading(on) {
    const el = $('#loading');
    if (el) el.style.visibility = on ? 'visible' : 'hidden';
  }

  // -------------------------
  // CSV → array de objetos
  // -------------------------
  function parseCsv(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve({ data: [], meta: {} });
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => resolve(res),
        error: reject
      });
    });
  }

  // -------------------------
  // Inserción por lotes
  // -------------------------
  async function batchInsert(table, rows, chunkSize = 500) {
    let total = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const slice = rows.slice(i, i + chunkSize);
      const { error, data } = await sb.from(table).insert(slice);
      if (error) throw error;
      total += slice.length;
    }
    return total;
  }

  // -------------------------
  // Limpieza simple de filas vacías
  // -------------------------
  function compactRows(rows) {
    return rows.filter(r => {
      // quita filas totalmente vacías
      return Object.values(r).some(v => (v ?? '').toString().trim() !== '');
    });
  }

  // ===========================================================
  // CARGA CSV: SUBTAREASACTUAL
  // ===========================================================
  async function cargarSubtareasActual() {
    const fileInput = $('#csvSubtareas');
    const file = fileInput?.files?.[0];
    if (!file) {
      msg('Selecciona un CSV de subtareas.', false);
      return;
    }

    setLoading(true);
    try {
      const res = await parseCsv(file);
      let rows = compactRows(res.data);

      // Validación mínima: que traiga “ID de Tarea”
      const hasIdTarea = rows.length === 0 || Object.prototype.hasOwnProperty.call(rows[0], 'ID de Tarea');
      if (!hasIdTarea) {
        msg('El CSV de Subtareas debe contener la columna "ID de Tarea" (tal cual).', false);
        return;
      }

      const inserted = await batchInsert('SUBTAREASACTUAL', rows, 500);
      msg(`SUBTAREASACTUAL: cargadas ${inserted} filas.`, true);
    } catch (e) {
      msg(`Error cargando SUBTAREASACTUAL: ${e.message}`, false);
    } finally {
      setLoading(false);
    }
  }

  // ===========================================================
  // CARGA CSV: HISTORIASACTUAL
  // ===========================================================
  async function cargarHistoriasActual() {
    const fileInput = $('#csvHistorias');
    const file = fileInput?.files?.[0];
    if (!file) {
      msg('Selecciona un CSV de historias.', false);
      return;
    }

    setLoading(true);
    try {
      const res = await parseCsv(file);
      let rows = compactRows(res.data);

      // Validación mínima: idealmente “ID de Tarea”, pero no forzamos
      const inserted = await batchInsert('HISTORIASACTUAL', rows, 500);
      msg(`HISTORIASACTUAL: cargadas ${inserted} filas.`, true);
    } catch (e) {
      msg(`Error cargando HISTORIASACTUAL: ${e.message}`, false);
    } finally {
      setLoading(false);
    }
  }

  // ===========================================================
  // SINCRONIZAR: staging → productivo
  // ===========================================================
  async function sincronizar() {
    setLoading(true);
    try {
      // Subtareas
      let out = [];
      let { data, error } = await sb.rpc('sync_subtareas_from_actual');
      if (error) {
        // Si no existe el RPC, informa pero no truena toda la corrida
        console.warn('sync_subtareas_from_actual no disponible:', error.message);
        out.push('Subtareas: función no disponible.');
      } else {
        const r = Array.isArray(data) ? data[0] : data;
        out.push(`Subtareas: inserted=${r?.inserted_count ?? '—'} updated=${r?.updated_count ?? '—'} staging_deleted=${r?.deleted_staging ?? '—'}`);
      }

      // Historias (opcional, si existe en tu BD)
      const h = await sb.rpc('sync_historias_from_actual');
      if (h.error) {
        console.warn('sync_historias_from_actual no disponible:', h.error.message);
        out.push('Historias: función no disponible.');
      } else {
        const r2 = Array.isArray(h.data) ? h.data[0] : h.data;
        out.push(`Historias: ${JSON.stringify(r2)}`);
      }

      msg(`Sincronización finalizada. ${out.join(' | ')}`, true);
    } catch (e) {
      msg(`Error en sincronización: ${e.message}`, false);
    } finally {
      setLoading(false);
    }
  }

  // ===========================================================
  // CARGAR AMBOS CSV + SINCRONIZAR
  // ===========================================================
  async function cargarTodoYSincronizar() {
    const ok = confirm('Se cargarán CSV en SUBTAREASACTUAL y/o HISTORIASACTUAL y luego se sincronizará. ¿Continuar?');
    if (!ok) return;

    try {
      setLoading(true);
      // Cargar si hay archivo seleccionado
      if ($('#csvSubtareas')?.files?.length) {
        await cargarSubtareasActual();
      }
      if ($('#csvHistorias')?.files?.length) {
        await cargarHistoriasActual();
      }
      // Sincronizar
      await sincronizar();
    } catch (e) {
      msg(`Error en carga+sync: ${e.message}`, false);
    } finally {
      setLoading(false);
    }
  }

  // ===========================================================
  // CREAR SPRINT (BORRA TODO + INSERTA SPRINT)
  // ===========================================================
  async function guardarSprintAdmin() {
    const nombre = $('#spNombre')?.value?.trim();
    const inicio = $('#spInicio')?.value;
    const fin    = $('#spFin')?.value;
    const hrsStr = $('#spTotalHrs')?.value;
    const totalHrs = hrsStr === '' ? null : Number(hrsStr);

    if (!nombre || !inicio || !fin) {
      msg('Faltan datos: nombre/fecha inicio/fecha fin.', false);
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

    try {
      const { data, error } = await sb.rpc('create_sprint_and_reset', {
        p_nombre: nombre,
        p_fecha_inicio: inicio,
        p_fecha_fin: fin,
        p_activo: true,
        p_total_hrs: totalHrs
      });

      if (error) {
        msg(`Error al crear sprint: ${error.message}`, false);
        return;
      }

      const idSprint = Array.isArray(data) ? data[0] : data;
      msg(`Sprint creado (id: ${idSprint}). Se limpiaron las tablas.`, true);
      $('#frmSprint')?.reset();
    } catch (e) {
      msg(`Error inesperado al crear sprint: ${e.message}`, false);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = prev || 'Guardar sprint'; }
    }
  }

  // ===========================================================
  // EVENTOS UI
  // ===========================================================
  document.addEventListener('DOMContentLoaded', () => {
    // Botón guardar sprint (submit del form)
    const frm = $('#frmSprint');
    if (frm) frm.addEventListener('submit', (ev) => {
      ev.preventDefault();
      guardarSprintAdmin();
    });

    // Cargas y sync
    $('#btnCargarSubtareas')?.addEventListener('click', cargarSubtareasActual);
    $('#btnCargarHistorias')?.addEventListener('click', cargarHistoriasActual);
    $('#btnSincronizar')?.addEventListener('click', sincronizar);
    $('#btnCargarTodo')?.addEventListener('click', cargarTodoYSincronizar);
  });

})();
