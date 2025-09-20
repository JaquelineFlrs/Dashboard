// subtareas.js
// ==================================================
// Dashboard: Subtareas (carga, render y checkbox "terminada")
// ==================================================
(function () {
  'use strict';

  // ======= Config =======
  const PK_COL = 'id'; // PK real en SUBTAREAS (bigint)
  const COLS = {
    ID_EXT: 'ID de Tarea',
    ID_PARENT: 'ID de Tarea principal',
    NOMBRE: 'Nombre de Tarea',
    PROPIETARIO: 'Propietario',
    ESTADO: 'Estado personalizado',
    DURACION: 'Duración',
    FECHA_TERM: 'Fecha de terminación',
    MOSTRAR: 'Mostrar'
  };

  // ======= Estado =======
  const STATE = {
    rows: [],
    loading: false,
    lastError: null
  };

  // ======= Helpers =======
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function getClient() {
    return window.db || window.supabase || (typeof sb !== 'undefined' ? sb : null);
  }

  function isTerminada(row) {
    try {
      const v = row?.[COLS.FECHA_TERM];
      return v !== null && v !== undefined && String(v).trim() !== '';
    } catch {
      return false;
    }
  }

  // ======= Data =======
  async function fetchSubtareas() {
    STATE.loading = true;
    STATE.lastError = null;
    const client = getClient();
    if (!client) {
      STATE.loading = false;
      STATE.lastError = 'No supabase client';
      console.warn('Supabase client not found');
      return [];
    }

    const selectCols = [
      PK_COL,
      `"${COLS.ID_EXT}"`,
      `"${COLS.ID_PARENT}"`,
      `"${COLS.NOMBRE}"`,
      `"${COLS.PROPIETARIO}"`,
      `"${COLS.ESTADO}"`,
      `"${COLS.DURACION}"`,
      `"${COLS.FECHA_TERM}"`,
      `"${COLS.MOSTRAR}"`
    ].join(',');

    // Trae solo las visibles (Mostrar = 0). Ajusta si tu lógica es distinta.
    const query = client
      .from('SUBTAREAS')
      .select(selectCols)
      .eq(COLS.MOSTRAR, 0)
      .order(PK_COL, { ascending: true });

    const { data, error } = await query;
    STATE.loading = false;

    if (error) {
      STATE.lastError = error.message || String(error);
      console.error('fetchSubtareas error:', error);
      return [];
    }

    STATE.rows = Array.isArray(data) ? data : [];
    window.subtareasRaw = STATE.rows; // si tu sistema la usa
    return STATE.rows;
  }

  // ======= Update: checkbox terminada =======
  async function updateTerminada(idOrExt, checked) {
    try {
      const value = checked ? new Date().toISOString().slice(0, 10) : null;
      const client = getClient();
      if (!client) {
        console.warn('Supabase client not found');
        return false;
      }

      // 1) Intentar por PK real (id)
      let { data, error } = await client
        .from('SUBTAREAS')
        .update({ [COLS.FECHA_TERM]: value })
        .eq(PK_COL, idOrExt)
        .select(PK_COL);

      // 2) Si no encontró nada, intentar por "ID de Tarea" externo
      if (!error && (!data || data.length === 0)) {
        ({ data, error } = await client
          .from('SUBTAREAS')
          .update({ [COLS.FECHA_TERM]: value })
          .eq(COLS.ID_EXT, idOrExt)
          .select(COLS.ID_EXT));
      }

      if (error) {
        console.error('Error updating Fecha de terminación:', error);
        return false;
      }
      if (!data || data.length === 0) {
        console.warn('No rows updated');
        return false;
      }

      // Sincronizar cache local
      const r = STATE.rows.find(
        (x) => String(x[PK_COL]) === String(idOrExt) || String(x[COLS.ID_EXT]) === String(idOrExt)
      );
      if (r) r[COLS.FECHA_TERM] = value;

      return true;
    } catch (e) {
      console.error('updateTerminada exception:', e);
      return false;
    }
  }

  async function onChangeChkTerminada(ev) {
    const el = ev?.target;
    if (!el) return;
    const id = el.getAttribute('data-id') || el.getAttribute('data-idexterno'); // admite PK o "ID de Tarea"
    const checked = !!el.checked;
    const ok = await updateTerminada(id, checked);
    if (!ok) {
      el.checked = !checked;
      alert('No se pudo guardar el cambio.');
    }
  }

  // ======= Render =======
  function renderRows(rows) {
    const tbody = $('#tblSubtareasBody');
    if (!tbody) {
      console.warn('No se encontró #tblSubtareasBody');
      return;
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:12px;">Sin registros</td></tr>`;
      return;
    }

    const html = rows
      .map((row) => {
        const idPk = row?.[PK_COL] ?? '';
        const idExt = row?.[COLS.ID_EXT] ?? '';
        const checked = isTerminada(row) ? 'checked' : '';
        return `
          <tr>
            <td>${esc(row[COLS.NOMBRE])}</td>
            <td>${esc(row[COLS.PROPIETARIO])}</td>
            <td>${esc(row[COLS.ESTADO])}</td>
            <td style="text-align:right;">${esc(row[COLS.DURACION])}</td>
            <td>${esc(row[COLS.FECHA_TERM] ?? '')}</td>
            <td style="text-align:center;">
              <input type="checkbox"
                     data-id="${esc(idPk)}"
                     data-idexterno="${esc(idExt)}"
                     onchange="Subtareas.onChangeChkTerminada(event)"
                     ${checked}>
            </td>
          </tr>
        `;
      })
      .join('');
    tbody.innerHTML = html;
  }

  // ======= API pública =======
  const API = {
    init: async function () {
      try {
        const rows = await fetchSubtareas();
        renderRows(rows);
      } catch (e) {
        console.error('Subtareas.init error:', e);
      }
    },
    reload: async function () {
      const rows = await fetchSubtareas();
      renderRows(rows);
    },
    onChangeChkTerminada
  };

  // Exponer en window
  window.Subtareas = API;

  // Auto-init
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(API.init, 0);
  } else {
    document.addEventListener('DOMContentLoaded', API.init, { once: true });
  }
})();
