// =============================
// DATA DEL EVENTO (EDITABLE)
// =============================

const eventData = {
  fecha: "Domingo 14 de diciembre 2025",
  precioNoche: 55000,
  precioFull: 65000,

  // Invitados (podés sincronizar estos números con tu Excel)
  invitados: [
    // nombre, tipo, total, señaPagada, saldo, estado
    { nombre: "Santiago Cogorno", tipo: "Full Pass", total: 65000, senia: 32500, saldo: 32500 },
    { nombre: "Luciana Pérez", tipo: "Noche", total: 55000, senia: 55000, saldo: 0 },
    { nombre: "Carlos López", tipo: "Noche", total: 55000, senia: 30000, saldo: 25000 },
    { nombre: "Ana García", tipo: "Full Pass", total: 65000, senia: 65000, saldo: 0 },
    { nombre: "Denis Silva", tipo: "Noche", total: 55000, senia: 0, saldo: 55000 },
  ],

  // Costos resumidos (traelos de tu Excel)
  costosFijos: 510000 + 60000 + 60000, // quincho + DJ + flete DJ (ejemplo)
  costosVariablesEstimados: 800000, // acá ponés lo que te dé la hoja de variables
};

// =============================
// HELPERS
// =============================

function formatMoney(num) {
  if (isNaN(num)) return "$0";
  return "$" + num.toLocaleString("es-AR");
}

// =============================
// CÁLCULOS BASE
// =============================

function calcularResumenInvitados(data) {
  const total = data.invitados.length;
  const full = data.invitados.filter((i) => i.tipo === "Full Pass").length;
  const noche = data.invitados.filter((i) => i.tipo === "Noche").length;
  const porcentajeFull = total > 0 ? Math.round((full / total) * 100) : 0;
  return { total, full, noche, porcentajeFull };
}

function calcularFinanciero(data) {
  const ingresos = data.invitados.reduce((acc, inv) => acc + inv.total, 0);
  const costosFijos = data.costosFijos || 0;
  const costosVariables = data.costosVariablesEstimados || 0;
  const resultado = ingresos - costosFijos - costosVariables;
  return { ingresos, costosFijos, costosVariables, resultado };
}

function calcularPagos(data) {
  const totalTeorico = data.invitados.reduce((acc, inv) => acc + inv.total, 0);
  const seniaCobrada = data.invitados.reduce((acc, inv) => acc + inv.senia, 0);
  const saldoPendiente = data.invitados.reduce((acc, inv) => acc + inv.saldo, 0);
  const conSenia = data.invitados.filter((i) => i.senia > 0).length;
  const porcentajeCubierto =
    totalTeorico > 0 ? Math.round((seniaCobrada / totalTeorico) * 100) : 0;
  return { seniaCobrada, saldoPendiente, conSenia, porcentajeCubierto };
}

// =============================
// RENDER DE KPIs
// =============================

function renderKPIs() {
  const inv = calcularResumenInvitados(eventData);
  const fin = calcularFinanciero(eventData);
  const pagos = calcularPagos(eventData);

  // Fecha
  const eventDateEl = document.getElementById("eventDate");
  if (eventDateEl) eventDateEl.textContent = eventData.fecha;

  // Invitados
  document.getElementById("kpiTotalInvitados").textContent = inv.total;
  document.getElementById("kpiFullPass").textContent = inv.full;
  document.getElementById("kpiSoloCena").textContent = inv.noche;
  document.getElementById("kpiPorcentajeFull").textContent =
    inv.porcentajeFull + "%";

  // Financieros
  document.getElementById("kpiIngresos").textContent = formatMoney(fin.ingresos);
  document.getElementById("kpiCostosFijos").textContent = formatMoney(
    fin.costosFijos
  );
  document.getElementById("kpiCostosVariables").textContent = formatMoney(
    fin.costosVariables
  );
  const resEl = document.getElementById("kpiResultado");
  resEl.textContent = formatMoney(fin.resultado);
  resEl.classList.toggle("positivo", fin.resultado >= 0);

  // Pagos
  document.getElementById("kpiSeniaCobrada").textContent = formatMoney(
    pagos.seniaCobrada
  );
  document.getElementById("kpiSaldoPendiente").textContent = formatMoney(
    pagos.saldoPendiente
  );
  document.getElementById("kpiConSenia").textContent = pagos.conSenia;
  document.getElementById("kpiPorcentajeCubierto").textContent =
    pagos.porcentajeCubierto + "%";
}

// =============================
// TABLA INVITADOS + FILTROS
// =============================

function getEstado(inv) {
  return inv.saldo <= 0 ? "Pagado" : "Pendiente";
}

function renderTablaInvitados() {
  const tbody = document.getElementById("tablaInvitados");
  const filterTipo = document.getElementById("filterTipo").value;
  const filterPago = document.getElementById("filterPago").value;

  tbody.innerHTML = "";

  eventData.invitados.forEach((inv) => {
    const estado = getEstado(inv);

    if (filterTipo !== "todos" && inv.tipo !== filterTipo) return;
    if (filterPago !== "todos" && estado !== filterPago) return;

    const tr = document.createElement("tr");

    const tdNombre = document.createElement("td");
    tdNombre.textContent = inv.nombre;

    const tdTipo = document.createElement("td");
    tdTipo.textContent = inv.tipo;

    const tdTotal = document.createElement("td");
    tdTotal.textContent = formatMoney(inv.total);

    const tdSenia = document.createElement("td");
    tdSenia.textContent = formatMoney(inv.senia);

    const tdSaldo = document.createElement("td");
    tdSaldo.textContent = formatMoney(inv.saldo);

    const tdEstado = document.createElement("td");
    const spanEstado = document.createElement("span");
    spanEstado.textContent = estado;
    spanEstado.className =
      "estado-pill " + (estado === "Pagado" ? "pagado" : "pendiente");
    tdEstado.appendChild(spanEstado);

    tr.appendChild(tdNombre);
    tr.appendChild(tdTipo);
    tr.appendChild(tdTotal);
    tr.appendChild(tdSenia);
    tr.appendChild(tdSaldo);
    tr.appendChild(tdEstado);

    tbody.appendChild(tr);
  });
}

// =============================
// INIT
// =============================

document.addEventListener("DOMContentLoaded", () => {
  renderKPIs();
  renderTablaInvitados();

  document
    .getElementById("filterTipo")
    .addEventListener("change", renderTablaInvitados);
  document
    .getElementById("filterPago")
    .addEventListener("change", renderTablaInvitados);
});