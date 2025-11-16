// URL pública del CSV de Google Sheets
const sheetURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR0rZ8Ja0766QxpTGYCCWu0dz07Oz5YUqj9dS9bxhD8Snl7WPyRSfj6gsq0mozaoaUtuC_gCtbiTSvA/pub?gid=82462936&single=true&output=csv";

// --- Utilidad: parsear CSV respetando comas dentro de comillas ---
function parseCSV(text) {
    const rows = [];
    let current = [];
    let value = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (char === '"' && inQuotes && next === '"') {
            // comilla escapada
            value += '"';
            i++;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
            current.push(value);
            value = "";
        } else if ((char === "\n" || char === "\r") && !inQuotes) {
            if (value !== "" || current.length > 0) {
                current.push(value);
                rows.push(current);
                current = [];
                value = "";
            }
        } else {
            value += char;
        }
    }
    if (value !== "" || current.length > 0) {
        current.push(value);
        rows.push(current);
    }

    return rows.filter(r => r.length > 0);
}

async function loadInvitados() {
    const response = await fetch(sheetURL);
    const text = await response.text();
    const rows = parseCSV(text);
    return rows;
}

async function renderPanel() {
    const rows = await loadInvitados();
    if (!rows || rows.length === 0) return;

    const headers = rows[0].map(h => h.trim());
    const dataRows = rows.slice(1).filter(r => r[0].trim() !== "");

    // Índices de columnas según encabezados
    const idx = {
        nombre: headers.indexOf("Nombre"),
        sector: headers.indexOf("Sector"),
        confirmo: headers.indexOf("Confirmó"),
        totalPersonas: headers.indexOf("Total Personas"),
        cena: headers.indexOf("Cena"),
        todoDia: headers.indexOf("Todo el día"),
        debePagar: headers.indexOf("Debe Pagar"),
        montoPagado: headers.indexOf("Monto Pagado"),
        faltaPagar: headers.indexOf("Falta Pagar"),
        observaciones: headers.indexOf("Observaciones")
    };

    // ---- KPIs ----
    let totalInvitados = 0;
    let totalFullPass = 0;
    let totalSoloCena = 0;
    let totalRecaudado = 0;
    let totalPendiente = 0;

    const invitadosConfirmados = dataRows.filter(r => {
        const v = idx.confirmo >= 0 ? (r[idx.confirmo] || "").toString().toLowerCase() : "";
        return v === "si" || v === "sí";
    });

    invitadosConfirmados.forEach(r => {
        const personas = idx.totalPersonas >= 0 ? Number(r[idx.totalPersonas] || 0) : 1;
        totalInvitados += personas;

        const esFull = idx.todoDia >= 0 ? Number(r[idx.todoDia] || 0) : 0;
        const esCena = idx.cena >= 0 ? Number(r[idx.cena] || 0) : 0;

        totalFullPass += esFull;
        totalSoloCena += esCena;

        const pagado = idx.montoPagado >= 0 ? Number((r[idx.montoPagado] || "0").toString().replace(/[^0-9.-]/g, "")) : 0;
        const falta = idx.faltaPagar >= 0 ? Number((r[idx.faltaPagar] || "0").toString().replace(/[^0-9.-]/g, "")) : 0;

        totalRecaudado += pagado;
        totalPendiente += falta;
    });

    // Pintar KPIs
    const fmt = n => n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

    document.getElementById("kpi-total-invitados").textContent = totalInvitados;
    document.getElementById("kpi-full-pass").textContent = totalFullPass;
    document.getElementById("kpi-solo-cena").textContent = totalSoloCena;
    document.getElementById("kpi-recaudado").textContent = fmt(totalRecaudado);
    document.getElementById("kpi-pendiente").textContent = fmt(totalPendiente);

    // ---- Tabla de invitados ----
    const headEl = document.getElementById("tabla-head");
    const bodyEl = document.getElementById("tabla-body");
    headEl.innerHTML = "";
    bodyEl.innerHTML = "";

    // Encabezados
    const trHead = document.createElement("tr");
    headers.forEach(h => {
        const th = document.createElement("th");
        th.textContent = h;
        trHead.appendChild(th);
    });
    headEl.appendChild(trHead);

    // Filas
    dataRows.forEach(r => {
        const tr = document.createElement("tr");

        // marcar visualmente si tiene saldo pendiente
        let pendiente = 0;
        if (idx.faltaPagar >= 0) {
            pendiente = Number((r[idx.faltaPagar] || "0").toString().replace(/[^0-9.-]/g, ""));
        }
        if (pendiente > 0) tr.classList.add("row-pendiente");

        r.forEach(cell => {
            const td = document.createElement("td");
            td.textContent = (cell || "").toString();
            tr.appendChild(td);
        });

        bodyEl.appendChild(tr);
    });
}

// Ejecutar al cargar la página
document.addEventListener("DOMContentLoaded", renderPanel);