const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR0rZ8Ja0766QxpTGYCCWu0dz07Oz5YUqj9dS9bxhD8Snl7WPyRSfj6gsq0mozaoaUtuC_gCtbiTSvA/pub?gid=82462936&single=true&output=csv";

let allGuests = [];

// Helper: parsear número desde string con $ y puntos
function parseNumber(value) {
  if (!value) return 0;
  const clean = value.toString().replace(/[^\d.-]/g, "");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

// Helper: formatear pesos argentinos
function formatCurrency(value) {
  return value.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

// Tipo de pase para filtros / KPI
function getTipoPase(row) {
  const cena = parseNumber(row.cena);
  const todoDia = parseNumber(row.todoDia);
  if (todoDia > 0) return "full";
  if (cena > 0) return "cena";
  return "ninguno";
}

async function loadGuests() {
  try {
    const res = await fetch(SHEET_CSV_URL);
    const csvText = await res.text();

    const lines = csvText.trim().split("\n");
    const headers = lines[0].split(",");

    const guests = lines.slice(1).map((line) => {
      const cols = line.split(",");

      // ajustá índices según el orden REAL en tu Sheet
      return {
        nombre: cols[0]?.trim() || "",
        sector: cols[1]?.trim() || "",
        confirmo: cols[2]?.trim() || "",
        totalPersonas: parseNumber(cols[3]),
        cena: parseNumber(cols[4]),
        todoDia: parseNumber(cols[5]),
        debePagar: parseNumber(cols[6]),
        montoPagado: parseNumber(cols[7]),
        faltaPagar: parseNumber(cols[8]),
        observaciones: cols[9] || "",
      };
    });

    allGuests = guests;

    // Render global (sin filtros)
    renderKPIs(allGuests);
    renderGuests(allGuests);
    populateFilters(allGuests);
    attachFilterEvents();
  } catch (err) {
    console.error("Error cargando CSV:", err);
  }
}

// KPI globales (no cambian con los filtros)
function renderKPIs(guests) {
  const confirmados = guests.filter((g) =>
    g.confirmo.toLowerCase().startsWith("s")
  );

  const fullPass = confirmados.filter((g) => getTipoPase(g) === "full");
  const soloCena = confirmados.filter((g) => getTipoPase(g) === "cena");

  const recaudado = confirmados.reduce(
    (acc, g) => acc + g.montoPagado,
    0
  );
  const pendiente = confirmados.reduce(
    (acc, g) => acc + g.faltaPagar,
    0
  );

  document.getElementById("kpiConfirmados").textContent =
    confirmados.length.toString();
  document.getElementById("kpiFullPass").textContent =
    fullPass.length.toString();
  document.getElementById("kpiSoloCena").textContent =
    soloCena.length.toString();
  document.getElementById("kpiRecaudado").textContent =
    formatCurrency(recaudado);
  document.getElementById("kpiPendiente").textContent =
    formatCurrency(pendiente);
}

// Render tabla (sí cambia con los filtros)
function renderGuests(guests) {
  const tbody = document.getElementById("tablaBody");
  tbody.innerHTML = "";

  guests.forEach((g) => {
    const tr = document.createElement("tr");

    if (g.faltaPagar > 0) {
      tr.classList.add("row-pendiente");
    }

    tr.innerHTML = `
      <td>${g.nombre}</td>
      <td>${g.sector}</td>
      <td>${g.confirmo}</td>
      <td>${g.totalPersonas || ""}</td>
      <td>${g.cena || ""}</td>
      <td>${g.todoDia || ""}</td>
      <td>${g.debePagar ? formatCurrency(g.debePagar) : "-"}</td>
      <td>${g.montoPagado ? formatCurrency(g.montoPagado) : "-"}</td>
      <td>${g.faltaPagar ? formatCurrency(g.faltaPagar) : "-"}</td>
      <td>${g.observaciones}</td>
    `;

    tbody.appendChild(tr);
  });
}

// Poblar opciones de Sector dinámicamente
function populateFilters(guests) {
  const sectorSelect = document.getElementById("filterSector");
  const sectores = Array.from(
    new Set(
      guests
        .map((g) => g.sector)
        .filter((s) => s && s.trim() !== "")
    )
  ).sort();

  sectores.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    sectorSelect.appendChild(opt);
  });
}

// Conectar filtros con evento change
function attachFilterEvents() {
  document
    .getElementById("filterSector")
    .addEventListener("change", applyFilters);
  document
    .getElementById("filterTipo")
    .addEventListener("change", applyFilters);
  document
    .getElementById("filterPago")
    .addEventListener("change", applyFilters);
}

// Aplicar filtros sobre allGuests -> renderGuests
function applyFilters() {
  const sectorVal = document.getElementById("filterSector").value;
  const tipoVal = document.getElementById("filterTipo").value;
  const pagoVal = document.getElementById("filterPago").value;

  let filtered = [...allGuests];

  // Sector
  if (sectorVal !== "todos") {
    filtered = filtered.filter((g) => g.sector === sectorVal);
  }

  // Tipo de pase
  if (tipoVal !== "todos") {
    filtered = filtered.filter((g) => getTipoPase(g) === tipoVal);
  }

  // Estado de pago
  if (pagoVal === "sin-deuda") {
    filtered = filtered.filter((g) => g.faltaPagar <= 0);
  } else if (pagoVal === "con-deuda") {
    filtered = filtered.filter((g) => g.faltaPagar > 0);
  }

  renderGuests(filtered);
}

// Iniciar
loadGuests();