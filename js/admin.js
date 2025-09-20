// js/admin.js
// ===========================================================
// Admin: Crear sprint, cargas CSV, sincronización
// Requiere:
//  - window.db (creado en js/config.js con supabase.createClient(...))
//  - Papa (papaparse) ya cargado
//  - Elementos en HTML (ids):
//    #frmSprint, #spNombre, #spInicio, #spFin, #spTotalHrs, #btnGuardarSprint
//    #csvSubtareas, #csvHistorias
//    #btnCargarSubtareas, #btnCargarHistorias, #btnCargarTodo, #btnSincronizar
//    #uploadMsg, #alert, #loading
// ===========================================================
(function () {
  'use strict';

  // -------------------------
  // Cliente y utilidades
  // -------------------------
  const sb = window.db;                            // <- client Supabase
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
      if (!ok) console.error(txt); else console.log(txt);
      alert(txt);
    }
  }

  function setLoading(on) {
    const el = $('#loading');
    if (el) el.style.visibility = on ? 'visible' : 'hidden';
  }

  // -------------------------
  // Helpers CSV / batch
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

  function compactRows(rows) {
    return rows.filter(r =>
      Object.values(r).some(v => (v ?? '').toString().trim() !== '')
    );
  }

  function dedupByKey(rows, key) {
    const m = new Map();
    for (const r of rows) {
      const k = (r[key] ?? '').toString().trim();
      if (!k) continue;
      m.set(k, r); // si se repite, conserva la última
    }
    return Array.from(m.values());
  }

  async function batchUpsert(table, rows, conflictCol, chunkSize = 500) {
    let total = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const slice = rows.slice(i, i + chunkSize);
      // Intento sin comillas
      let { error } = await sb.from(table).upsert(slice, { onConflict: conflictCol });
      // Si falla por columna, reintento con comillas (nombres con espacios)
      if (error && /column .* does not exist/i.test(error.message)) {
        ({ error } = await sb.from(table).upsert(slice, { onConflict: `"${conflictCol}"` }));
      }
      if (error) throw error;
      total += slice.length;
    }
    return total;
  }

  async function batchInsert(table, rows, chunkSize = 500) {
    let total = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const slice = rows.slice(i, i + chunkSize);
      const { error } = await sb.from(table).insert(slice);
      if (error) throw error;
      total += slice.length;
    }
    return total;
  }

  // ===========================================================
  // 1) Crear Sprint (borra todo + inserta)
  // ===========================================================
  (function bindSprintForm() {
    const frm = $('#frmSprint');
    if (!frm) return;

    frm.addEventListener('submit', async (ev) => {
      ev.preventDefault();

      // Validación nativa (required, min...) + lectura confiable desde el form
      if (!frm.reportValidity()) return;

      const nombre = (frm.querySelector('#spNombre')?.value || '').trim();
      const inicio = (frm.querySelector('#spInicio')?.value || '').trim();
      const fin    = (frm.querySelector('#spFin')?.value || '').trim();
      const horasStr = (frm.querySelector('#spTotalHrs')?.value ?? '').trim();
      const totalHrs = horasStr === '' ? null : Number(horasStr);

      if (!nombre) { msg('Falta el nombre del sprint.', false); frm.querySelector('#spNombre')?.focus(); return; }
      if (!inicio) { msg('Falta la fecha de inicio.', false);  frm.querySelector('#spInicio')?.focus(); return; }
      if (!fin)    { msg('Falta la fecha de fin.', false);     frm.querySelector('#spFin')?.focus();    return; }

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
        // Opción 1: firma posicional
        const { data, error } = await sb.rpc('create_sprint_and_reset', {
          p_nombre: nombre,
          p_fecha_inicio: inicio,
          p_fecha_fin: fin,
          p_activo: true,
          p_total_hrs: totalHrs
        });

        // // Opción 2 (si usas la versión JSON):
        // const { data, error } = await sb.rpc('create_sprint_and_reset_json', {
        //   payload: { nombre, fecha_inicio: inicio, fecha_fin: fin, activo: true, total_hrs: totalHrs }
        // });

        if (error) { msg(`Error al crear sprint: ${error.message}`, false); return; }

        const idSprint = Array.isArray(data) ? data[0] : data;
        msg(`Sprint creado (id: ${idSprint}). Se limpiaron las tablas.`, true);
        frm.reset();

      } catch (e) {
        msg(`Error inesperado: ${e.message}`, false);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = prev || 'Guardar sprint'; }
      }
    });
  })();

  // ===========================================================
  // 2) Cargar Subtareas → SUBTAREASACTUAL y sincronizar
  // ===========================================================
  async function cargarSubtareasActualYSync() {
    const file = $('#csvSubtareas')?.files?.[0];
    if (!file) { msg('Selecciona un CSV de subtareas.', false); return; }

    setLoading(true);
    try {
      const res = await parseCsv(file);
      let rows = compactRows(res.data || []);

      if (rows.length && !Object.prototype.hasOwnProperty.call(rows[0], 'ID de Tarea')) {
        msg('El CSV de Subtareas debe contener la columna "ID de Tarea".', false);
        return;
      }
      // Dedup por "ID de Tarea" para evitar PK conflict en staging
      rows = dedupByKey(rows, 'ID de Tarea');

      // UPSERT al staging (por si re-subes un mismo CSV)
      const inserted = await batchUpsert('SUBTAREASACTUAL', rows, 'ID de Tarea', 500);
      msg(`SUBTAREASACTUAL: upsert de ${inserted} filas OK.`, true);

      // Ejecutar sincronización a SUBTAREAS
      const { data, error: errSync } = await sb.rpc('sync_subtareas_from_actual');
      if (errSync) { msg(`Error en sincronización: ${errSync.message}`, false); return; }

      const r = Array.isArray(data) ? data[0] : data;
      msg(`Sincronizado → SUBTAREAS: inserted=${r?.inserted_count ?? 0}, updated=${r?.updated_count ?? 0}, staging_deleted=${r?.deleted_staging ?? 0}`, true);

    } catch (e) {
      msg(`Error cargando/sincronizando subtareas: ${e.message}`, false);
    } finally {
      setLoading(false);
    }
  }

  // ===========================================================
  // 3) Cargar Historias → HISTORIASACTUAL (y sincronizar si tienes RPC)
  // ===========================================================
  async function cargarHistoriasActualYSync() {
    const file = $('#csvHistorias')?.files?.[0];
    if (!file) { msg('Selecciona un CSV de historias.', false); return; }

    setLoading(true);
    try {
      const res = await parseCsv(file);
      let rows = compactRows(res.data || []);

      // Si tienes una PK lógica, puedes dedup igual que subtareas (ajusta la columna):
      // rows = dedupByKey(rows, 'ID de Tarea');

      const inserted = await batchInsert('HISTORIASACTUAL', rows, 500);
      msg(`HISTORIASACTUAL: insert de ${inserted} filas OK.`, true);

      // Si tienes RPC de sync para historias, descomenta:
      // const { data, error: errSyncH } = await sb.rpc('sync_historias_from_actual');
      // if (errSyncH) { msg(`Historias: error en sincronización: ${errSyncH.message}`, false); }
      // else { msg('Historias: sincronización OK.', true); }

    } catch (e) {
      msg(`Error cargando historias: ${e.message}`, false);
    } finally {
      setLoading(false);
    }
  }

  // ===========================================================
  // 4) Sincronizar manual (solo subtareas; agrega historias si aplica)
  // ===========================================================
  async function sincronizarSolo() {
    setLoading(true);
    try {
      const { data, error } = await sb.rpc('sync_subtareas_from_actual');
      if (error) { msg(`Error en sincronización: ${error.message}`, false); return; }
      const r = Array.isArray(data) ? data[0] : data;
      msg(`Sincronizado → SUBTAREAS: inserted=${r?.inserted_count ?? 0}, updated=${r?.updated_count ?? 0}, staging_deleted=${r?.deleted_staging ?? 0}`, true);

      // Historias si tienes RPC:
      // const h = await sb.rpc('sync_historias_from_actual');
      // if (h.error) msg(`Historias: error en sincronización: ${h.error.message}`, false);
      // else msg('Historias: sincronización OK.', true);

    } catch (e) {
      msg(`Error en sincronización: ${e.message}`, false);
    } finally {
      setLoading(false);
    }
  }

  // ===========================================================
  // 5) Cargar ambos y sincronizar
  // ===========================================================
  async function cargarTodoYSincronizar() {
    const ok = confirm('Se cargarán los CSV seleccionados y luego se sincronizará. ¿Continuar?');
    if (!ok) return;

    setLoading(true);
    try {
      if ($('#csvSubtareas')?.files?.length) {
        await cargarSubtareasActualYSync(); // ya incluye sync
      } else {
        msg('No hay CSV de subtareas seleccionado. Se omite.', true);
      }

      if ($('#csvHistorias')?.files?.length) {
        await cargarHistoriasActualYSync();
        // Si tienes RPC de historias, puedes llamarla aquí después
      } else {
        msg('No hay CSV de historias seleccionado. Se omite.', true);
      }
    } catch (e) {
      msg(`Error en carga+sync: ${e.message}`, false);
    } finally {
      setLoading(false);
    }
  }

  // ===========================================================
  // Eventos UI
  // ===========================================================
  document.addEventListener('DOMContentLoaded', () => {
    $('#btnCargarSubtareas')?.addEventListener('click', cargarSubtareasActualYSync);
    $('#btnCargarHistorias')?.addEventListener('click', cargarHistoriasActualYSync);
    $('#btnSincronizar')?.addEventListener('click', sincronizarSolo);
    $('#btnCargarTodo')?.addEventListener('click', cargarTodoYSincronizar);
    // submit de sprint ya quedó enlazado más arriba
  });

})();
