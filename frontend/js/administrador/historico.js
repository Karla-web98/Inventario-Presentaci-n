
"use strict";

import { listarContenedores } from "../api/contenedores.js";

const API_CORTES = "/api/cortes";

let cortesHistoricos = [];

// =========================================================
// UTILIDADES
// =========================================================

function escaparHistorico(valor) {
    return String(valor ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function normalizarHistorico(valor) {
    return String(valor ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function obtenerCampoHistorico(registro, campos) {
    for (const campo of campos) {
        if (
            registro[campo] !== undefined &&
            registro[campo] !== null &&
            registro[campo] !== ""
        ) {
            return registro[campo];
        }
    }

    return "";
}

// =========================================================
// FECHAS
// =========================================================

function obtenerFechaLocalHistorico() {
    const ahora = new Date();

    const anio = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, "0");
    const dia = String(ahora.getDate()).padStart(2, "0");

    return `${anio}-${mes}-${dia}`;
}

function formatearFechaHistorico(valor) {
    if (!valor) return "—";

    const coincidencia = String(valor).match(
        /^(\d{4})-(\d{2})-(\d{2})$/
    );

    if (coincidencia) {
        return `${coincidencia[3]}/${coincidencia[2]}/${coincidencia[1]}`;
    }

    const fecha = new Date(valor);

    if (Number.isNaN(fecha.getTime())) {
        return escaparHistorico(valor);
    }

    return fecha.toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}

// =========================================================
// DATOS DEL INVENTARIO
// =========================================================

function obtenerEstadoHistorico(registro) {
    return obtenerCampoHistorico(registro, [
        "estado",
        "status"
    ]) || "Sin estado";
}

function obtenerNumeroHistorico(registro) {
    return obtenerCampoHistorico(registro, [
        "numero",
        "numeroCaja",
        "caja",
        "identificador"
    ]) || "—";
}

function obtenerCarrierHistorico(registro) {
    return obtenerCampoHistorico(registro, [
        "carrier",
        "transportista"
    ]) || "—";
}

function obtenerUbicacionHistorico(registro) {
    return obtenerCampoHistorico(registro, [
        "ubicacion"
    ]) || "—";
}

function obtenerPatioHistorico(registro) {
    return obtenerCampoHistorico(registro, [
        "patio"
    ]) || "—";
}

function obtenerSpotHistorico(registro) {
    return obtenerCampoHistorico(registro, [
        "spot",
        "numeroSpot",
        "numero_spot"
    ]) || "—";
}

function obtenerFotosHistorico(registro) {
    const fotos = registro.fotografias ?? registro.fotos ?? [];
    return Array.isArray(fotos) ? fotos : [];
}

// =========================================================
// RESUMEN
// =========================================================

function calcularResumenHistorico(registros) {
    let disponibles = 0;
    let observadas = 0;
    let fotografias = 0;

    registros.forEach(registro => {
        const estado = normalizarHistorico(
            obtenerEstadoHistorico(registro)
        );

        if (estado === "disponible") disponibles++;

        if (
            estado === "observado" ||
            estado === "observada"
        ) {
            observadas++;
        }

        fotografias += obtenerFotosHistorico(registro).length;

        if (registro.fotografiaSello) {
            fotografias++;
        }
    });

    return {
        total: registros.length,
        disponibles,
        observadas,
        fotografias
    };
}

// =========================================================
// API DE CORTES
// =========================================================

async function consultarCortesHistoricos() {
    const respuesta = await fetch(API_CORTES);

    const resultado = await respuesta.json();

    if (!respuesta.ok || resultado.ok === false) {
        throw new Error(
            resultado.error || "No fue posible consultar los cortes."
        );
    }

    cortesHistoricos = Array.isArray(resultado.cortes)
        ? resultado.cortes
        : [];

    return cortesHistoricos;
}

async function guardarCorteServidor(corte) {
    const respuesta = await fetch(API_CORTES, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(corte)
    });

    const resultado = await respuesta.json();

    if (!respuesta.ok || resultado.ok === false) {
        throw new Error(
            resultado.error || "No fue posible guardar el corte."
        );
    }

    return resultado.corte;
}

// =========================================================
// CREAR CORTE DIARIO
// =========================================================

async function crearCorteDiario() {
    const fechaHoy = obtenerFechaLocalHistorico();

    const existente = cortesHistoricos.find(
        corte => corte.fecha === fechaHoy
    );

    if (existente) return existente;

    const registros = await listarContenedores();

    // Copia independiente para conservar el estado y las URL
    // de las fotografías en el momento de generar el corte.
    const copiaRegistros = JSON.parse(
        JSON.stringify(registros)
    );

    const nuevoCorte = {
        id: `corte-${fechaHoy}`,
        fecha: fechaHoy,
        fechaHora: new Date().toISOString(),
        resumen: calcularResumenHistorico(copiaRegistros),
        registros: copiaRegistros
    };

    const corteGuardado = await guardarCorteServidor(nuevoCorte);

    await consultarCortesHistoricos();

    console.log(
        "Corte histórico diario sincronizado:",
        corteGuardado
    );

    return corteGuardado;
}

// =========================================================
// PREPARAR INTERFAZ
// =========================================================

function prepararInterfazHistorico() {
    const vista = document.querySelector("#view-historico");

    if (!vista) return;

    const encabezado = vista.querySelector(".admin-page-heading");

    if (encabezado && !document.querySelector("#historyCutInfo")) {
        const informacion = document.createElement("p");

        informacion.id = "historyCutInfo";
        informacion.className = "admin-history-info";
        informacion.textContent =
            "Cada corte conserva una copia completa del inventario de ese día.";

        encabezado.appendChild(informacion);
    }

    const tabla = document.querySelector("#historyTable");

    if (!tabla) return;

    const tarjeta = tabla.closest(".admin-table-card");

    if (tarjeta && !document.querySelector("#historyDetail")) {
        const detalle = document.createElement("div");

        detalle.id = "historyDetail";
        detalle.className = "admin-history-detail hidden";

        tarjeta.insertAdjacentElement("afterend", detalle);
    }

    const encabezados = tabla
        .closest("table")
        ?.querySelectorAll("thead th");

    if (encabezados && encabezados.length >= 5) {
        const titulos = [
            "FECHA DEL CORTE",
            "TOTAL DE CAJAS",
            "DISPONIBLES",
            "OBSERVADAS",
            "FOTOGRAFÍAS"
        ];

        titulos.forEach((titulo, indice) => {
            encabezados[indice].textContent = titulo;
        });
    }
}

// =========================================================
// MOSTRAR CORTES
// =========================================================

function mostrarCortesHistoricos() {
    const tabla = document.querySelector("#historyTable");

    if (!tabla) return;

    if (!cortesHistoricos.length) {
        tabla.innerHTML = `
            <tr>
                <td colspan="5" class="admin-empty">
                    Todavía no hay cortes históricos.
                </td>
            </tr>
        `;
        return;
    }

    tabla.innerHTML = cortesHistoricos.map(corte => {
        const resumen = corte.resumen || {};

        return `
            <tr>
                <td>
                    <strong>${formatearFechaHistorico(corte.fecha)}</strong>
                </td>

                <td>${Number(resumen.total) || 0}</td>
                <td>${Number(resumen.disponibles) || 0}</td>
                <td>${Number(resumen.observadas) || 0}</td>

                <td>
                    <div class="admin-history-photo-count">
                        <span>${Number(resumen.fotografias) || 0}</span>

                        <button
                            type="button"
                            class="btn btn-secondary"
                            data-history-detail="${escaparHistorico(corte.id)}"
                        >
                            Ver corte
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

// =========================================================
// DETALLE DEL CORTE
// =========================================================

function mostrarDetalleCorte(identificador) {
    const corte = cortesHistoricos.find(
        item => String(item.id) === String(identificador)
    );

    if (!corte) {
        alert("No se encontró el corte histórico.");
        return;
    }

    const contenedor = document.querySelector("#historyDetail");

    if (!contenedor) return;

    const registros = Array.isArray(corte.registros)
        ? corte.registros
        : [];

    const resumen = corte.resumen || {};

    contenedor.classList.remove("hidden");

    contenedor.innerHTML = `
        <div class="admin-history-detail-header">
            <div>
                <h3>Inventario del ${formatearFechaHistorico(corte.fecha)}</h3>
                <p>
                    Este es el estado completo del inventario
                    conservado en este corte.
                </p>
            </div>

            <button
                type="button"
                class="btn btn-secondary"
                id="closeHistoryDetail"
            >
                Cerrar
            </button>
        </div>

        <div class="admin-history-summary">
            <div>
                <span>Total de cajas</span>
                <strong>${Number(resumen.total) || 0}</strong>
            </div>

            <div>
                <span>Disponibles</span>
                <strong>${Number(resumen.disponibles) || 0}</strong>
            </div>

            <div>
                <span>Observadas</span>
                <strong>${Number(resumen.observadas) || 0}</strong>
            </div>

            <div>
                <span>Fotografías</span>
                <strong>${Number(resumen.fotografias) || 0}</strong>
            </div>
        </div>

        <div class="admin-table-wrapper">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>CAJA</th>
                        <th>CARRIER</th>
                        <th>STATUS</th>
                        <th>UBICACIÓN</th>
                        <th>PATIO</th>
                        <th>SPOT</th>
                        <th>FOTOS</th>
                    </tr>
                </thead>

                <tbody>
                    ${
                        registros.length
                            ? registros.map(registro => `
                                <tr>
                                    <td><strong>${escaparHistorico(obtenerNumeroHistorico(registro))}</strong></td>
                                    <td>${escaparHistorico(obtenerCarrierHistorico(registro))}</td>
                                    <td>${escaparHistorico(obtenerEstadoHistorico(registro))}</td>
                                    <td>${escaparHistorico(obtenerUbicacionHistorico(registro))}</td>
                                    <td>${escaparHistorico(obtenerPatioHistorico(registro))}</td>
                                    <td>${escaparHistorico(obtenerSpotHistorico(registro))}</td>
                                    <td>${obtenerFotosHistorico(registro).length + (registro.fotografiaSello ? 1 : 0)}</td>
                                </tr>
                            `).join("")
                            : `
                                <tr>
                                    <td colspan="7" class="admin-empty">
                                        El inventario estaba vacío en este corte.
                                    </td>
                                </tr>
                            `
                    }
                </tbody>
            </table>
        </div>
    `;

    contenedor.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

// =========================================================
// EVENTOS
// =========================================================

function configurarEventosHistorico() {
    const tabla = document.querySelector("#historyTable");
    const detalle = document.querySelector("#historyDetail");

    tabla?.addEventListener("click", evento => {
        const boton = evento.target.closest("[data-history-detail]");

        if (!boton) return;

        mostrarDetalleCorte(boton.dataset.historyDetail);
    });

    detalle?.addEventListener("click", evento => {
        if (evento.target.closest("#closeHistoryDetail")) {
            detalle.classList.add("hidden");
            detalle.innerHTML = "";
        }
    });

    window.addEventListener("inventario:actualizado", async () => {
        try {
            await consultarCortesHistoricos();
            mostrarCortesHistoricos();
        } catch (error) {
            console.error("Error al actualizar el histórico:", error);
        }
    });
}

// =========================================================
// INICIALIZACIÓN
// =========================================================

async function iniciarHistoricoAdministrador() {
    prepararInterfazHistorico();
    configurarEventosHistorico();

    const tabla = document.querySelector("#historyTable");

    try {
        await consultarCortesHistoricos();
        await crearCorteDiario();
        mostrarCortesHistoricos();

        console.log(
            "Histórico del administrador sincronizado con PostgreSQL."
        );

    } catch (error) {
        console.error("Error al iniciar el histórico:", error);

        if (tabla) {
            tabla.innerHTML = `
                <tr>
                    <td colspan="5" class="admin-empty">
                        No fue posible cargar el histórico.
                        ${escaparHistorico(error.message)}
                    </td>
                </tr>
            `;
        }
    }
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        iniciarHistoricoAdministrador
    );
} else {
    iniciarHistoricoAdministrador();
}