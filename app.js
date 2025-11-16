// app.js
// Dashboard Evento 14D – conectado a Google Sheets (solo lectura)

// URL pública del CSV (hoja Invitados)
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR0rZ8Ja0766QxpTGYCCWu0dz07Oz5YUqj9dS9bxhD8Snl7WPyRSfj6gsq0mozaoaUtuC_gCtbiTSvA/pub?gid=82462936&single=true&output=csv";

// Elementos de la UI
const kpiConfirmadosEl = document.getElementById("kpi-confirmados");
const kpiFullPassEl = document.getElementById("kpi-fullpass");
const kpiSoloCenaEl = document.getElementById("kpi-solo-cena");
const kpiRecaudadoEl = document.getElementById("kpi-recaudado");
const kpiPendienteEl = document.getElementById("kpi-pendiente");

const filterSectorEl = document.getElementById("filter-sector");
const filterTipoPaseEl = document.getElementById("filter-tipo-pase");
const filterEstadoPagoEl = document.getElementById("filter-estado-pago");

const tablaBodyEl = document.getElementById("tabla-invitados-body");
const reloadBtn = document.getElementById("reload-btn");
const recordsCountEl = document.getElementById("records-count");

let allRows = []; // todas las filas normalizadas

// -------------------- Utils --------------------

// Normaliza encabezados: "Todo el día" -> "todoeldia"
function normalizeHeader(header) {
  return header
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

// Convierte string de dinero en número (ej: "65.000,00" -> 65000)
function parseMoney(value) {
  if (value === null || value === undefined) return 0;
  const str = String(value).trim();
  if (!str) return 0;

  // quitamos símbolo $, espacios y puntos de miles
  const clean = str
    .replace(/\$/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", "."); // si hubiera coma decimal

  const num = Number(clean);
  return isNaN(num) ? 0 : num;
}

// Formatea número a $ 182.500
function formatMoney(num) {
  const n = Number(num) || 0;
  return `$ ${n.toLocaleString("es-AR")}`;
}

// Determina estado de pago a partir de MontoPagado y FaltaPagar
function getEstadoPago(row) {
  const pagado = parseMoney(row.montopagado);
  const falta = parseMoney(row.faltapagar);

  if (pagado <= 0 && falta > 0) return "pendiente";
  if (pagado > 0 && falta > 0) return "parcial";
  if (pagado > 0 && falta <= 0) return "pagado";
  return "pendiente";
}

// -------------------- CSV Parser --------------------

// Parser simple de CSV que respeta comillas
function parseCSV(text) {
  const rows = [];
  let current = [];
  let value = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      // comillas escapadas ""
      value += '"';
      i++;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      current.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (value !== "" || current.length) {
        current.push(value);
        rows.push(current);
        current = [];
        value = "";
      }
      continue;
    }

    value += char;
  }

  // última celda/última fila
  if (value !== "" || current.length) {
    current.push(value);
    rows.push(current);
  }

  return rows;
}

// Convierte texto CSV en array de objetos normalizados
function csvToObjects(text) {
  const rawRows = parseCSV(text);
  if (!rawRows.length) return [];

  const headers = rawRows[0].map((h) => normalizeHeader(h || ""));
  const dataRows = rawRows.slice(1);

  return dataRows
    .filter((r) => r.some((cell) => String(cell).trim() !== ""))
    .map((cells) => {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = cells[idx] !== undefined ? cells[idx] : "";
      });
      return obj;
    });
}

// -------------------- Datos y filtros --------------------

async function fetchData() {
  const res = await fetch(SHEET_CSV_URL + "&t=" + Date.now()); // cache-buster
  if (!res.ok) {
    throw new Error("No se pudo leer la hoja de cálculo.");
  }
  const text = await res.text();
  const rows = csvToObjects(text);

  // Normalizamos nombres esperados
  // (para evitar errores por cambios pequeños en los encabezados)
  return rows.map((r) => ({
    nombre: r.nombre || "",
    sector: r.sector || "",
    cena: r.cena || "0",
    todoeldia: r.todoeldia || "0",
    debepagar: r.debepagar || "0",
    montopagado: r.montopagado || "0",
    faltapagar: r.faltapagar || "0",
    observaciones: r.observaciones || "",
  }));
}

function applyFilters() {
  const sectorValue = filterSectorEl?.value || "todos";
  const tipoPaseValue = filterTipoPaseEl?.value || "todos";
  const estadoPagoValue = filterEstadoPagoEl?.value || "todos";

  const filtered = allRows.filter((row) => {
    const sector = (row.sector || "").trim();

    const cenaNum = Number(row.cena) || 0;
    const fullNum = Number(row.todoeldia) || 0;

    // Sector
    if (sectorValue !== "todos" && sector !== sectorValue) return false;

    // Tipo de pase
    if (tipoPaseValue === "full" && fullNum <= 0) return false;
    if (tipoPaseValue === "solo-cena" && cenaNum <= 0) return false;

    // Estado de pago
    if (estadoPagoValue !== "todos") {
      const estado = getEstadoPago(row); // pendiente, parcial, pagado
      if (estado !== estadoPagoValue) return false;
    }

    return true;
  });

  renderKPIs(filtered);
  renderTable(filtered);
}

// -------------------- Render KPIs y tabla --------------------

function renderKPIs(rows) {
  // Sumamos personas, no filas
  const kpi = rows.reduce(
    (acc, row) => {
      const cenaNum = Number(row.cena) || 0;
      const fullNum = Number(row.todoeldia) || 0;

      acc.totalPersonas += cenaNum + fullNum;
      acc.fullPass += fullNum;
      acc.soloCena += cenaNum;

      acc.recaudado += parseMoney(row.montopagado);
      acc.pendiente += parseMoney(row.faltapagar);

      return acc;
    },
    { totalPersonas: 0, fullPass: 0, soloCena: 0, recaudado: 0, pendiente: 0 }
  );

  if (kpiConfirmadosEl)
    kpiConfirmadosEl.textContent = kpi.totalPersonas.toString();
  if (kpiFullPassEl) kpiFullPassEl.textContent = kpi.fullPass.toString();
  if (kpiSoloCenaEl) kpiSoloCenaEl.textContent = kpi.soloCena.toString();

  if (kpiRecaudadoEl) kpiRecaudadoEl.textContent = formatMoney(kpi.recaudado);
  if (kpiPendienteEl) kpiPendienteEl.textContent = formatMoney(kpi.pendiente);
}

function renderTable(rows) {
  if (!tablaBodyEl) return;

  tablaBodyEl.innerHTML = "";

  rows.forEach((row) => {
    const tr = document.createElement("tr");

    const cenaNum = Number(row.cena) || 0;
    const fullNum = Number(row.todoeldia) || 0;

    const tdNombre = document.createElement("td");
    tdNombre.textContent = row.nombre;
    tr.appendChild(tdNombre);

    const tdSector = document.createElement("td");
    tdSector.textContent = row.sector;
    tr.appendChild(tdSector);

    const tdCena = document.createElement("td");
    tdCena.textContent = cenaNum || "";
    tr.appendChild(tdCena);

    const tdFull = document.createElement("td");
    tdFull.textContent = fullNum || "";
    tr.appendChild(tdFull);

    const tdDebe = document.createElement("td");
    tdDebe.textContent = formatMoney(parseMoney(row.debepagar));
    tr.appendChild(tdDebe);

    const tdPagado = document.createElement("td");
    tdPagado.textContent = formatMoney(parseMoney(row.montopagado));
    tr.appendChild(tdPagado);

    const tdFalta = document.createElement("td");
    tdFalta.textContent = formatMoney(parseMoney(row.faltapagar));
    tr.appendChild(tdFalta);

    const tdObs = document.createElement("td");
    tdObs.textContent = row.observaciones || "-";
    tr.appendChild(tdObs);

    tablaBodyEl.appendChild(tr);
  });

  if (recordsCountEl) {
    recordsCountEl.textContent = `${rows.length} registros`;
  }
}

// -------------------- Filtros dinámicos --------------------

function populateFilters() {
  if (!filterSectorEl) return;

  // Sectores únicos
  const sectores = Array.from(
    new Set(
      allRows
        .map((r) => (r.sector || "").trim())
        .filter((v) => v && v !== "")
    )
  ).sort();

  filterSectorEl.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "todos";
  optAll.textContent = "Todos";
  filterSectorEl.appendChild(optAll);

  sectores.forEach((sector) => {
    const opt = document.createElement("option");
    opt.value = sector;
    opt.textContent = sector;
    filterSectorEl.appendChild(opt);
  });

  // Tipo de pase (fijo)
  if (filterTipoPaseEl) {
    filterTipoPaseEl.innerHTML = "";
    const optT1 = document.createElement("option");
    optT1.value = "todos";
    optT1.textContent = "Todos";
    const optT2 = document.createElement("option");
    optT2.value = "full";
    optT2.textContent = "Full Pass";
    const optT3 = document.createElement("option");
    optT3.value = "solo-cena";
    optT3.textContent = "Solo Cena";

    filterTipoPaseEl.appendChild(optT1);
    filterTipoPaseEl.appendChild(optT2);
    filterTipoPaseEl.appendChild(optT3);
  }

  // Estado de pago (fijo)
  if (filterEstadoPagoEl) {
    filterEstadoPagoEl.innerHTML = "";
    const optE1 = document.createElement("option");
    optE1.value = "todos";
    optE1.textContent = "Todos";

    const optE2 = document.createElement("option");
    optE2.value = "pendiente";
    optE2.textContent = "Pendiente";

    const optE3 = document.createElement("option");
    optE3.value = "parcial";
    optE3.textContent = "Parcial";

    const optE4 = document.createElement("option");
    optE4.value = "pagado";
    optE4.textContent = "Pagado";

    filterEstadoPagoEl.appendChild(optE1);
    filterEstadoPagoEl.appendChild(optE2);
    filterEstadoPagoEl.appendChild(optE3);
    filterEstadoPagoEl.appendChild(optE4);
  }
}

// -------------------- Init --------------------

async function initDashboard() {
  try {
    if (reloadBtn) {
      reloadBtn.disabled = true;
      reloadBtn.textContent = "Cargando...";
    }

    allRows = await fetchData();
    populateFilters();
    applyFilters();
  } catch (err) {
    console.error(err);
    alert("Hubo un problema al cargar los datos del evento.");
  } finally {
    if (reloadBtn) {
      reloadBtn.disabled = false;
      reloadBtn.textContent = "Cargar datos de nuevo";
    }
  }
}

// Eventos
document.addEventListener("DOMContentLoaded", () => {
  initDashboard();

  if (reloadBtn) {
    reloadBtn.addEventListener("click", () => initDashboard());
  }

  if (filterSectorEl) filterSectorEl.addEventListener("change", applyFilters);
  if (filterTipoPaseEl) filterTipoPaseEl.addEventListener("change", applyFilters);
  if (filterEstadoPagoEl)
    filterEstadoPagoEl.addEventListener("change", applyFilters);
});