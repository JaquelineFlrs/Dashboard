// subtareas.js
// ==================================================
// Dashboard: Subtareas (terminada ↔ Fecha de terminación + terminada_fecha, y toggle Mostrar)
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
    TERMINADA_FECHA: 'terminada_fecha',   // 👈 nueva columna
    MOSTRAR: 'Mostrar'                    // 0 = mostrar, 1 = ocultar
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
  const getClient = () => window.db || window.supabase || (typeof sb !== 'undefined' ? sb : null);

  const isTerminada = (row) => {
    const a = row?.[COLS.FECHA_TERM];
    const b = row?.[COLS.TERMINADA_FECHA];
    return (a && String(a).trim() !== '') || (b && String(b).trim() !== '');
  };
  const isMarcadaMostrar = (row) => Number(row?.[COLS.MOSTRAR] ?? 0) === 0; // checked = se muestra (0)

  // ======= Render header (tu tabla usa theadSubSel) =======
  function renderHeader() {
    const thead = $('#theadSubSel');
    if (!thead) return;
    thead.innerHTML = `
      <tr>
        <th>Terminada</th>
        <th>Mostrar</th>
        <th>ID de Tarea</th>
        <th>Nombre</th>
        <th>Propietario</th>
        <th>Duración</th>
      </tr>
    `;
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

    // Traemos TODAS (sin filtrar Mostrar) para que el toggle funcione.
    const selectCols = [
      PK_COL,
      `"${COLS.ID_EXT}"`,
      `"${COLS.ID_PARENT}"`,
      `"${COLS.NOMBRE}"`,
      `"${COLS.PROPIETARIO}"`,
      `"${COLS.ESTADO}"`,
      `"${COLS.DURACION}"`,
      `"${COLS.FECHA_TERM}"`,
      `"${COLS.TERMINADA_FECHA}"`,   // 👈 incluimos terminada_fecha
      `"${COLS.MOSTRAR}"`
    ].join(',');

    const { data, error } = await client
      .from('SUBTAREAS')
      .select(selectCols)
      .order(PK_COL, { ascending: true });

    STATE.loading = false;

    if (error) {
      STATE.lastError = error.message || String(error);
      console.error('fetchSubtareas error:', error);
      return [];
    }

    STATE.rows = Array.isArray(data) ? data : [];
    window.subtareasRaw = STATE.rows; // por compatibilidad si tu app la usa
    return STATE.rows;
  }

  // ======= Updates =======
  // Terminada: actualiza AMBAS columnas (Fecha de terminación y terminada_fecha)
  async function updateTerminada(idOrExt, checked) {
    try {
      const value = checked ? new Date().toISOString().slice(0, 10) : null;
      const client = getClient(); if (!client) return false;

      const payload = { [COLS.FECHA_TERM]: value, [COLS.TERMINADA_FECHA]: value };

      let { data, error } = await client
        .from('SUBTAREAS')
        .update(payload)
        .eq(PK_COL, idOrExt)
        .select(PK_COL);

      if (!error && (!data || data.length === 0)) {
        ({ data, error } = await client
          .from('SUBTAREAS')
          .update(payload)
          .eq(COLS.ID_EXT, idOrExt)
          .select(COLS.ID_EXT));
      }

      if (error || !data || data.length === 0) return false;

      const r = STATE.rows.find(x => String(x[PK_COL])===String(idOrExt) || String(x[COLS.ID_EXT])===String(idOrExt));
      if (r) { r[COLS.FECHA_TERM] = value; r[COLS.TERMINADA_FECHA] = value; }

      return true;
    } catch(e) { console.error(e); return false; }
  }

  // Mostrar (0 = mostrar, 1 = ocultar)
  async function updateMostrar(idOrExt, checked) {
    try {
      const value = checked ? 0 : 1;
      const client = getClient(); if (!client) return false;

      let { data, error } = await client
        .from('SUBTAREAS')
        .update({ [COLS.MOSTRAR]: value })
        .eq(PK_COL, idOrExt)
        .select(PK_COL);

      if (!error && (!data || data.length === 0)) {
        ({ data, error } = await client
          .from('SUBTAREAS')
          .update({ [COLS.MOSTRAR]: value })
          .eq(COLS.ID_EXT, idOrExt)
          .select(COLS.ID_EXT));
      }

      if (error || !data || data.length === 0) return false;

      const r = STATE.rows.find(x => String(x[PK_COL])===String(idOrExt) || String(x[COLS.ID_EXT])===String(idOrExt));
      if (r) r[COLS.MOSTRAR] = value;

      return true;
    } catch(e) { console.error(e); return false; }
  }

  // ======= Handlers (con bloqueo para evitar flicker) =======
  async function onChangeChkTerminada(ev) {
    const el = ev?.target; if (!el || el.dataset.busy === '1') return;
    const id = el.getAttribute('data-id') || el.getAttribute('data-idexterno');
    const newChecked = !!el.checked;
    el.dataset.busy='1'; el.disabled=true;
    const ok = await updateTerminada(id, newChecked);
    if (!ok) { el.checked = !newChecked; alert('No se pudo guardar el cambio.'); }
    el.disabled=false; delete el.dataset.busy;
  }

  async function onChangeChkMostrar(ev) {
    const el = ev?.target; if (!el || el.dataset.busy === '1') return;
    const id = el.getAttribute('data-id') || el.getAttribute('data-idexterno');
    const newChecked = !!el.checked; // checked = mostrar(0), unchecked = ocultar(1)
    el.dataset.busy='1'; el.disabled=true;
    const ok = await updateMostrar(id, newChecked);
    if (!ok) { el.checked = !newChecked; alert('No se pudo guardar el cambio.'); }
    el.disabled=false; delete el.dataset.busy;

    // Si está activado "Ver solo marcadas", re-filtra al vuelo
    const onlyShown = $('#subOnlyShown')?.checked;
    if (onlyShown) renderRows(getFilteredRows());
  }

  // ======= Filtros (buscar y solo marcadas) =======
  function getFilteredRows() {
    const q = ($('#subSearch')?.value || '').trim().toLowerCase();
    const onlyShown = $('#subOnlyShown')?.checked;
    let rows = STATE.rows;

    if (q) {
      rows = rows.filter(r =>
        String(r[COLS.NOMBRE] ?? '').toLowerCase().includes(q) ||
        String(r[COLS.PROPIETARIO] ?? '').toLowerCase().includes(q) ||
        String(r[COLS.ID_EXT] ?? '').toLowerCase().includes(q)
      );
    }
    if (onlyShown) {
      rows = rows.filter(isMarcadaMostrar); // Mostrar = 0
    }
    return rows;
  }

  // ======= Render body (tu tabla usa tbodySubSel) =======
  function renderRows(rowsOrNull) {
    const tbody = $('#tbodySubSel');
    if (!tbody) { console.warn('No se encontró #tbodySubSel'); return; }

    const rows = Array.isArray(rowsOrNull) ? rowsOrNull : getFilteredRows();

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:12px;">Sin registros</td></tr>`;
      return;
    }

    const html = rows.map(row => {
      const idPk = row?.[PK_COL] ?? '';
      const idExt = row?.[COLS.ID_EXT] ?? '';
      const chkTerm = isTerminada(row) ? 'checked' : '';
      const chkMostrar = isMarcadaMostrar(row) ? 'checked' : ''; // checked => Mostrar=0

      return `
        <tr>
          <td style="text-align:center;">
            <input type="checkbox"
                   data-id="${esc(idPk)}"
                   data-idexterno="${esc(idExt)}"
                   onchange="Subtareas.onChangeChkTerminada(event)"
                   ${chkTerm}>
          </td>
          <td style="text-align:center;">
            <input type="checkbox"
                   data-id="${esc(idPk)}"
                   data-idexterno="${esc(idExt)}"
                   onchange="Subtareas.onChangeChkMostrar(event)"
                   ${chkMostrar}>
          </td>
          <td>${esc(idExt)}</td>
          <td>${esc(row[COLS.NOMBRE])}</td>
          <td>${esc(row[COLS.PROPIETARIO])}</td>
          <td style="text-align:right;">${esc(row[COLS.DURACION])}</td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = html;
  }

  // ======= API pública =======
  const API = {
    init: async function () {
      try {
        renderHeader();
        const rows = await fetchSubtareas();
        renderRows(rows);

        // Wire de filtros
        const search = $('#subSearch');
        const only = $('#subOnlyShown');
        search && search.addEventListener('input', () => renderRows(getFilteredRows()));
        only && only.addEventListener('change', () => renderRows(getFilteredRows()));
      } catch (e) {
        console.error('Subtareas.init error:', e);
      }
    },
    reload: async function () {
      const rows = await fetchSubtareas();
      renderRows(rows);
    },
    onChangeChkTerminada,
    onChangeChkMostrar
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
