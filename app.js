// URL del CSV público de Google Sheets (hoja "Invitados")
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR0rZ8Ja0766QxpTGYCCWu0dz07Oz5YUqj9dS9bxhD8Snl7WPyRSfj6gsq0mozaoaUtuC_gCtbiTSvA/pub?gid=82462936&single=true&output=csv";

let allInvitados = [];
let filteredInvitados = [];

// Elementos del DOM
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

// Formateo de dinero
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
  text = text.replace(/[^\d.,-]/g, ""); // solo números, coma, punto
  text = text.replace(/\./g, ""); // sacar puntos de miles
  text = text.replace(",", "."); // coma -> punto
  const value = parseFloat(text);
  return isNaN(value) ? 0 : value;
}

// Parser CSV simple (maneja comillas)
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

// Carga de datos desde Google Sheets
async function loadInvitados() {
  try {
    const res = await fetch(CSV_URL);
    const text = await res.text();
    const rows = parseCSV(text);

    const dataRows = rows.slice(1); // saltar encabezados

    allInvitados = dataRows.map((row) => ({
      nombre: row[0] || "",
      sector: row[1] || "",
      cena: Number(row[2] || 0),
      todoDia: Number(row[3] || 0),
      debePagar: parseMoney(row[4]),
      montoPagado: parseMoney(row[5]),
      faltaPagar: parseMoney(row[6]),
      observaciones: row[7] || ""
    }));

    filteredInvitados = [...allInvitados];

    buildSectorFilter();
    renderEverything();
  } catch (err) {
    console.error("Error cargando invitados:", err);
  }
}

/* ===== FILTROS ===== */

function buildSectorFilter() {
  const sectors = Array.from(
    new Set(allInvitados.map((i) => i.sector).filter(Boolean))
  ).sort();

  // limpiar opciones excepto "Todos"
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
    // Sector
    if (sectorVal !== "todos" && inv.sector !== sectorVal) return false;

    // Tipo de pase
    const isFull = inv.todoDia > 0;
    const isCenaSolo = inv.cena > 0 && inv.todoDia === 0;

    if (paseVal === "full" && !isFull) return false;
    if (paseVal === "cena" && !isCenaSolo) return false;

    // Estado de pago
    const pagado =
      inv.faltaPagar <= 0 &&
      inv.montoPagado >= inv.debePagar &&
      inv.debePagar > 0;

    const pendiente =
      inv.montoPagado <= 0 &&
      inv.faltaPagar >= inv.debePagar &&
      inv.debePagar > 0;

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

/* ===== RENDER ===== */

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

/* ===== INICIO ===== */

document.addEventListener("DOMContentLoaded", () => {
  loadInvitados();

  [filterSector, filterPase, filterPago].forEach((el) => {
    el.addEventListener("change", () => {
      renderEverything();
    });
  });

  if (reloadBtn) {
    reloadBtn.addEventListener("click", () => {
      loadInvitados();
    });
  }
});