// URL pública CSV de tu hoja "Invitados"
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR0rZ8Ja0766QxpTGYCCWu0dz07Oz5YUqj9dS9bxhD8Snl7WPyRSfj6gsq0mozaoaUtuC_gCtbiTSvA/pub?gid=82462936&single=true&output=csv";

let invitados = [];

document.addEventListener("DOMContentLoaded", () => {
  cargarDatos();

  document.getElementById("filterSector").addEventListener("change", render);
  document.getElementById("filterTipoPase").addEventListener("change", render);
  document.getElementById("filterEstadoPago").addEventListener("change", render);
});

async function cargarDatos() {
  try {
    const resp = await fetch(SHEET_URL);
    const text = await resp.text();

    // Google en ES suele separar por ";"
    const filas = text.trim().split("\n").map((r) => r.split(";"));
    const encabezados = filas[0];
    const data = filas.slice(1).filter((row) => row[0] && row[0].trim() !== "");

    const idx = {
      nombre: encabezados.indexOf("Nombre"),
      sector: encabezados.indexOf("Sector"),
      confirmo: encabezados.indexOf("Confirmó"),
      totalPersonas: encabezados.indexOf("Total Personas"),
      cena: encabezados.indexOf("Cena"),
      todoDia: encabezados.indexOf("Todo el día"),
      debePagar: encabezados.indexOf("Debe Pagar"),
      montoPagado: encabezados.indexOf("Monto Pagado"),
      faltaPagar: encabezados.indexOf("Falta Pagar"),
      observaciones: encabezados.indexOf("Observaciones"),
    };

    invitados = data.map((row) => ({
      nombre: row[idx.nombre] || "",
      sector: row[idx.sector] || "",
      confirmo: (row[idx.confirmo] || "").toLowerCase() === "si",
      totalPersonas: parseInt(row[idx.totalPersonas] || "0", 10) || 0,
      cena: parseInt(row[idx.cena] || "0", 10) || 0,
      todoDia: parseInt(row[idx.todoDia] || "0", 10) || 0,
      debePagar: parseMoney(row[idx.debePagar]),
      montoPagado: parseMoney(row[idx.montoPagado]),
      faltaPagar: parseMoney(row[idx.faltaPagar]),
      observaciones: row[idx.observaciones] || "",
    }));

    poblarFiltros();
    render();
  } catch (e) {
    console.error("Error cargando datos:", e);
  }
}

function parseMoney(str) {
  if (!str) return 0;
  const limpio = str.replace(/[^\d]/g, "");
  return limpio ? parseInt(limpio, 10) : 0;
}

function formatMoney(n) {
  return "$ " + n.toLocaleString("es-AR");
}

function poblarFiltros() {
  const selectSector = document.getElementById("filterSector");
  const sectores = Array.from(new Set(invitados.map((i) => i.sector).filter(Boolean))).sort();

  sectores.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    selectSector.appendChild(opt);
  });
}

function render() {
  const sectorSel = document.getElementById("filterSector").value;
  const tipoSel = document.getElementById("filterTipoPase").value;
  const estadoSel = document.getElementById("filterEstadoPago").value;

  let lista = [...invitados];

  if (sectorSel !== "Todos") {
    lista = lista.filter((i) => i.sector === sectorSel);
  }

  if (tipoSel !== "Todos") {
    lista = lista.filter((i) => {
      const esFull = i.todoDia > 0;
      const esCenaOnly = i.cena > 0 && i.todoDia === 0;
      if (tipoSel === "Full Pass") return esFull;
      if (tipoSel === "Solo Cena") return esCenaOnly;
      return true;
    });
  }

  if (estadoSel !== "Todos") {
    lista = lista.filter((i) => {
      const alDia = i.faltaPagar === 0;
      if (estadoSel === "Al día") return alDia;
      if (estadoSel === "Con saldo") return !alDia;
      return true;
    });
  }

  renderTabla(lista);
  renderKpis(); // KPIs siempre con el total global
}

function renderTabla(lista) {
  const tbody = document.getElementById("tablaInvitados");
  tbody.innerHTML = "";

  lista.forEach((i) => {
    const tr = document.createElement("tr");

    const estadoPago = i.faltaPagar === 0 ? "Al día" : "Con saldo";

    tr.innerHTML = `
      <td>${i.nombre}</td>
      <td>${i.sector}</td>
      <td>${i.confirmo ? "Sí" : "No"}</td>
      <td>${i.totalPersonas}</td>
      <td>${i.cena}</td>
      <td>${i.todoDia}</td>
      <td>${formatMoney(i.debePagar)}</td>
      <td>${formatMoney(i.montoPagado)}</td>
      <td>${formatMoney(i.faltaPagar)}</td>
      <td>${i.observaciones || ""}</td>
    `;

    tbody.appendChild(tr);
  });
}

function renderKpis() {
  // KPIs con TODOS los confirmados
  const confirmados = invitados.filter((i) => i.confirmo);

  const personasConfirmadas = confirmados.reduce(
    (acc, i) => acc + (i.totalPersonas || 0),
    0
  );
  const fullPass = confirmados.reduce((acc, i) => acc + (i.todoDia || 0), 0);
  const soloCena = confirmados.reduce(
    (acc, i) => acc + (i.cena || 0),
    0
  );
  const recaudado = confirmados.reduce(
    (acc, i) => acc + (i.montoPagado || 0),
    0
  );
  const pendiente = confirmados.reduce(
    (acc, i) => acc + (i.faltaPagar || 0),
    0
  );

  document.getElementById("kpiConfirmados").textContent = personasConfirmadas;
  document.getElementById("kpiFullPass").textContent = fullPass;
  document.getElementById("kpiSoloCena").textContent = soloCena;
  document.getElementById("kpiRecaudado").textContent = formatMoney(recaudado);
  document.getElementById("kpiPendiente").textContent = formatMoney(pendiente);
}