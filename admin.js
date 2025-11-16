// URL del CSV público de Google Sheets
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR0rZ8Ja0766QxpTGYCCWu0dz07Oz5YUqj9dS9bxhD8Snl7WPyRSfj6gsq0mozaoaUtuC_gCtbiTSvA/pub?gid=82462936&single=true&output=csv";

let allInvitados = [];
let filteredInvitados = [];

// Elements
const tablaBody = document.getElementById("tablaInvitados");
const kpiTotal = document.getElementById("kpiTotalInvitados");
const kpiFull = document.getElementById("kpiFullPass");
const kpiCena = document.getElementById("kpiSoloCena");
const kpiRecaudado = document.getElementById("kpiRecaudado");
const kpiPendiente = document.getElementById("kpiPendiente");
const tableCount = document.getElementById("tableCount");

const filterSector = document.getElementById("filterSector");
const filterPase = document.getElementById("filterPase");
const filterPago = document.getElementById("filterPago");
const reloadBtn = document.getElementById("reloadBtn");

const moneyFormatter = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

function formatMoney(num) {
  return "$ " + moneyFormatter.format(Math.round(num || 0));
}

function parseMoney(str) {
  if (!str) return 0;
  let text = String(str).trim();
  // quitar símbolos y espacios
  text = text.replace(/[^\d.,-]/g, "");
  // quitar puntos de miles
  text = text.replace(/\./g, "");
  // coma a punto
  text = text.replace(",", ".");
  const value = parseFloat(text);
  return isNaN(value) ? 0 : value;
}

// Parser CSV sencillo (soporta comillas)
function parseCSV(text) {
  const rows = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");

  for (const line of lines) {
    const cells = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        cells.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current);
    rows.push(cells.map((c) => c.trim()));
  }

  return rows;
}

async function loadInvitados() {
  const res = await fetch(CSV_URL);
  const text = await res.text();
  const rows = parseCSV(text);

  // Primera fila = encabezados
  const dataRows = rows.slice(1);

  allInvitados = dataRows.map((row) => {
    return {
      nombre: row[0] || "",
      sector: row[1] || "",
      cena: Number(row[2] || 0),
      todoDia: Number(row[3] || 0),
      debePagar: parseMoney(row[4]),
      montoPagado: parseMoney(row[5]),
      faltaPagar: parseMoney(row[6]),
      observaciones: row[7] || ""
    };
  });

  // Inicialmente, todos
  filteredInvitados = [...allInvitados];

  buildSectorFilter();
  renderEverything();
}

/* ====== FILTROS ====== */

function buildSectorFilter() {
  const sectors = Array.from(new Set(allInvitados.map((i) => i.sector).filter(Boolean))).sort();

  // limpiar excepto "Todos"
  while (filterSector.options.length > 1) {
    filterSector.remove(1);
  }

  sectors.forEach((sector) => {
    const opt = document.createElement("option");
    opt.value = sector;
    opt.textContent = sector;
    filterSector.appendChild(opt);
  });
}

function applyFilters() {
  const sectorVal = filterSector.value;
  const paseVal = filterPase.value;
  const pagoVal = filterPago.value;

  filteredInvitados = allInvitados.filter((inv) => {
    // filtro sector
    if (sectorVal !== "todos" && inv.sector !== sectorVal) return false;

    // filtro tipo de pase
    const isFull = inv.todoDia > 0;
    const isCenaSolo = inv.cena > 0 && inv.todoDia === 0;

    if (paseVal === "full" && !isFull) return false;
    if (paseVal === "cena" && !isCenaSolo) return false;

    // filtro estado de pago
    const pagado = inv.faltaPagar <= 0 && inv.montoPagado >= inv.debePagar && inv.debePagar > 0;
    const pendiente = inv.montoPagado <= 0 && inv.faltaPagar >= inv.debePagar && inv.debePagar > 0;
    const parcial =
      inv.montoPagado > 0 &&
      inv.montoPagado < inv.debePagar &&
      inv.faltaPagar > 0;

    if (pagoVal === "pagado" && !pagado) return false;
    if (pagoVal === "pendiente" && !pendiente) return false;
    if (pagoVal === "parcial" && !parcial) return false;

    return true;
  });
}

/* ====== RENDER ====== */

function renderKPIs() {
  const totalInvitados = filteredInvitados.length;

  const fullPass = filteredInvitados.filter((i) => i.todoDia > 0).length;
  const soloCena = filteredInvitados.filter(
    (i) => i.cena > 0 && i.todoDia === 0
  ).length;

  const recaudado = filteredInvitados.reduce(
    (sum, i) => sum + i.montoPagado,
    0
  );
  const pendiente = filteredInvitados.reduce(
    (sum, i) => sum + i.faltaPagar,
    0
  );

  kpiTotal.textContent = totalInvitados;
  kpiFull.textContent = fullPass;
  kpiCena.textContent = soloCena;
  kpiRecaudado.textContent = formatMoney(recaudado);
  kpiPendiente.textContent = formatMoney(pendiente);
}

function renderTable() {
  tablaBody.innerHTML = "";

  filteredInvitados.forEach((i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i.nombre}</td>
      <td>${i.sector}</td>
      <td>${i.cena || ""}</td>
      <td>${i.todoDia || ""}</td>
      <td>${formatMoney(i.debePagar)}</td>
      <td>${formatMoney(i.montoPagado)}</td>
      <td>${formatMoney(i.faltaPagar)}</td>
      <td>${i.observaciones}</td>
    `;
    tablaBody.appendChild(tr);
  });

  tableCount.textContent = `${filteredInvitados.length} registro${
    filteredInvitados.length === 1 ? "" : "s"
  }`;
}

function renderEverything() {
  applyFilters();
  renderKPIs();
  renderTable();
}

/* ====== EVENTOS ====== */

document.addEventListener("DOMContentLoaded", () => {
  // cargar datos
  loadInvitados().catch((err) => {
    console.error("Error cargando invitados:", err);
  });

  [filterSector, filterPase, filterPago].forEach((el) => {
    el.addEventListener("change", () => {
      renderEverything();
    });
  });

  if (reloadBtn) {
    reloadBtn.addEventListener("click", () => {
      loadInvitados().catch((err) => console.error(err));
    });
  }
});