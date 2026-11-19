"use strict";

import {
    listarContenedores,
    buscarContenedor,
    eliminarContenedor
} from "../api/contenedores.js";

const $ = selector => document.querySelector(selector);
let paginaActual = 1;
const REGISTROS_POR_PAGINA = 15;
let registrosHistorial = null;


function claseEstado(estado) {
    return String(estado || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-");
}

function escaparHTML(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, caracter => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[caracter]);
}

function normalizarTexto(valor) {
    return String(valor ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function actualizarOpciones(select, registros, campo, textoInicial) {
    const valorActual = select.value;

    const valores = [...new Set(
        registros
            .map(registro => String(registro[campo] ?? "").trim())
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "es"));

    select.innerHTML = "";

    const opcionInicial = document.createElement("option");
    opcionInicial.value = "";
    opcionInicial.textContent = textoInicial;
    select.appendChild(opcionInicial);

    valores.forEach(valor => {
        const opcion = document.createElement("option");
        opcion.value = valor;
        opcion.textContent = valor;
        select.appendChild(opcion);
    });

    if (valores.includes(valorActual)) {
        select.value = valorActual;
    }
}

function obtenerFechaISO(registro) {
    const fecha = String(registro.fecha || "").trim();

    // Formato día/mes/año, por ejemplo 19/11/2026
    const formatoMX = fecha.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

    if (formatoMX) {
        const [, dia, mes, anio] = formatoMX;

        return `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
    }

    // Formato ISO, por ejemplo 2026-11-19
    const formatoISO = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (formatoISO) {
        return `${formatoISO[1]}-${formatoISO[2]}-${formatoISO[3]}`;
    }

    // Respaldo por si el registro no tiene fecha visible.
    const fechaRegistro = String(registro.fechaRegistro || "");

    const respaldoISO = fechaRegistro.match(/^(\d{4})-(\d{2})-(\d{2})/);

    return respaldoISO
        ? `${respaldoISO[1]}-${respaldoISO[2]}-${respaldoISO[3]}`
        : "";
}

function crearTabla(registros) {
    if (registros.length === 0) {
        return '<p class="empty-state">No se encontraron registros.</p>';
    }

    const filas = registros.map(registro => `
        <tr>
            <td><strong>${escaparHTML(registro.numero)}</strong></td>
            <td>${escaparHTML(registro.carrier)}</td>
            <td>
                <span class="status-pill ${claseEstado(registro.estado)}">
                    ${escaparHTML(registro.estado)}
                </span>
            </td>
            <td>${escaparHTML(registro.ubicacion)}</td>
            <td>${escaparHTML(registro.spot || "Sin Spot")}</td>
            <td>${escaparHTML(registro.patio)}</td>
            <td>
                ${escaparHTML(registro.fecha)}
                ${escaparHTML(registro.hora)}
            </td>
            <td>
                <div class="inventory-actions">
                    <button
                        type="button"
                        class="table-action"
                        data-detail="${escaparHTML(registro.id)}"
                    >
                        Consultar
                    </button>

                    <button
                        type="button"
                        class="btn-delete"
                        data-delete="${escaparHTML(registro.id)}"
                    >
                        Eliminar
                    </button>
                </div>
            </td>
        </tr>
    `).join("");

    return `
        <table class="data-table">
            <thead>
                <tr>
                    <th>CAJA</th>
                    <th>CARRIER</th>
                    <th>STATUS</th>
                    <th>UBICACIÓN</th>
                    <th>SPOT</th>
                    <th>PATIO</th>
                    <th>FECHA</th>
                    <th>ACCIONES</th>
                </tr>
            </thead>
            <tbody>${filas}</tbody>
        </table>
    `;
}

    export async function renderizarHistorial(forzarActualizacion = true) {
    if (registrosHistorial === null || forzarActualizacion) {
        registrosHistorial = await listarContenedores();
    }

    const registros = registrosHistorial;

    actualizarOpciones(
        $("#historyCarrier"),
        registros,
        "carrier",
        "Todos los carriers"
    );

    actualizarOpciones(
        $("#historyLocation"),
        registros,
        "ubicacion",
        "Todas las ubicaciones"
    );

    actualizarOpciones(
        $("#historyYard"),
        registros,
        "patio",
        "Todos los patios"
    );

    const numero = normalizarTexto($("#historyNumber").value);
    const carrier = $("#historyCarrier").value;
    const estado = $("#historyStatus").value;
    const ubicacion = $("#historyLocation").value;
    const patio = $("#historyYard").value;
    const fechaDesde = $("#historyDateFrom").value;
    const fechaHasta = $("#historyDateTo").value;

    const filtrados = registros.filter(registro => {
        const coincideNumero = normalizarTexto(registro.numero)
            .includes(numero);

        const coincideCarrier = !carrier ||
            registro.carrier === carrier;

        const coincideEstado = !estado ||
            registro.estado === estado;

        const coincideUbicacion = !ubicacion ||
            registro.ubicacion === ubicacion;

        const coincidePatio = !patio ||
            registro.patio === patio;

        const fechaRegistro = obtenerFechaISO(registro);

        const coincideDesde = !fechaDesde ||
            (fechaRegistro && fechaRegistro >= fechaDesde);

        const coincideHasta = !fechaHasta ||
            (fechaRegistro && fechaRegistro <= fechaHasta);

        return coincideNumero &&
            coincideCarrier &&
            coincideEstado &&
            coincideUbicacion &&
            coincidePatio &&
            coincideDesde &&
            coincideHasta;
    });

    // Calcular páginas
    const totalRegistros = filtrados.length;
    const totalPaginas = Math.ceil(
        totalRegistros / REGISTROS_POR_PAGINA
    );

    if (totalPaginas === 0) {
        paginaActual = 1;
    } else if (paginaActual > totalPaginas) {
        paginaActual = totalPaginas;
    }

    const inicio = (paginaActual - 1) * REGISTROS_POR_PAGINA;
    const fin = inicio + REGISTROS_POR_PAGINA;

    const registrosPagina = filtrados.slice(inicio, fin);

    // Mostrar únicamente los registros de la página actual
    $("#historyRecords").innerHTML = crearTabla(registrosPagina);

    // Crear el espacio de paginación si todavía no existe
    let paginacion = $("#historyPagination");

    if (!paginacion) {
        paginacion = document.createElement("div");
        paginacion.id = "historyPagination";
        paginacion.className = "history-pagination";

        $("#historyRecords").insertAdjacentElement(
            "afterend",
            paginacion
        );
    }

    // No mostrar controles si no se necesitan
    if (totalPaginas <= 1) {
        paginacion.innerHTML = "";
        paginacion.classList.add("hidden");
        return;
    }

    paginacion.classList.remove("hidden");

    const primerRegistro = inicio + 1;
    const ultimoRegistro = Math.min(fin, totalRegistros);

    paginacion.innerHTML = `
        <span class="history-pagination-info">
            Mostrando ${primerRegistro}–${ultimoRegistro}
            de ${totalRegistros} cajas
        </span>

        <div class="history-pagination-controls">
            <button
                type="button"
                class="history-page-button"
                data-history-page="${paginaActual - 1}"
                ${paginaActual === 1 ? "disabled" : ""}
                aria-label="Página anterior"
            >
                &#8592;
            </button>

            <span class="history-page-number">
                Página ${paginaActual} de ${totalPaginas}
            </span>

            <button
                type="button"
                class="history-page-button"
                data-history-page="${paginaActual + 1}"
                ${paginaActual === totalPaginas ? "disabled" : ""}
                aria-label="Página siguiente"
            >
                &#8594;
            </button>
        </div>
    `;
}

export async function renderizarRecientes() {
    const registros = (await listarContenedores()).slice(0, 5);
    const contenedor = $("#recentRecords");

    if (registros.length === 0) {
        contenedor.innerHTML =
            '<p class="empty-state">Todavía no hay registros.</p>';
        return;
    }

    const filas = registros.map(registro => `
        <tr>
            <td><strong>${escaparHTML(registro.numero)}</strong></td>
            <td>${escaparHTML(registro.carrier)}</td>
            <td>
                <span class="status-pill ${claseEstado(registro.estado)}">
                    ${escaparHTML(registro.estado)}
                </span>
            </td>
            <td>${escaparHTML(registro.ubicacion)}</td>
            <td>${escaparHTML(registro.spot || "Sin Spot")}</td>
            <td>${escaparHTML(registro.hora)}</td>
        </tr>
    `).join("");

    contenedor.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>CAJA</th>
                    <th>CARRIER</th>
                    <th>STATUS</th>
                    <th>UBICACIÓN</th>
                    <th>SPOT</th>
                    <th>HORA</th>
                </tr>
            </thead>
            <tbody>${filas}</tbody>
        </table>
    `;
}

// ----------------------------------
// DETALLE DEL CONTENEDOR
// ----------------------------------

export async function mostrarDetalle(id) {
    // Buscar primero en los registros que ya están cargados en memoria.
    // Solo consultar al servidor si no encontramos la caja.
    const registro = registrosHistorial?.find(
        item => String(item.id) === String(id)
    ) || await buscarContenedor(id);

    const contenedor = $("#recordDetail");

    if (!registro) {
        window.alert("No se encontró el contenedor.");
        return;
    }

    contenedor.classList.remove("hidden");

    const campos = [
        ["Número", registro.numero],
        ["Carrier", registro.carrier],
        ["Status", registro.estado],
        ["Ubicación", registro.ubicacion],
        ["Número de Spot", registro.spot || "Sin Spot"],
        ["Patio", registro.patio],
        ["Operador", registro.operador],
        ["Fecha", registro.fecha],
        ["Hora", registro.hora],
        ["Observaciones", registro.observaciones || "Sin observaciones"]
    ];

    const contenido = campos.map(([titulo, valor]) => `
        <div class="confirmation-item">
            <small>${escaparHTML(titulo)}</small>
            <strong>${escaparHTML(valor)}</strong>
        </div>
    `).join("");

    const fotografias = registro.fotografias || [];

    const fotos = fotografias.map((foto, indice) => `
        <div class="detail-photo-item">
            <img
                src="${escaparHTML(foto.data)}"
                alt="Evidencia ${indice + 1} de ${escaparHTML(registro.numero)}"
            >
            <small>
                ${escaparHTML(foto.nombre || `Fotografía ${indice + 1}`)}
            </small>
        </div>
    `).join("");

    const fotoSello = registro.fotografiaSello
        ? `
            <div class="detail-photo-item">
                <img
                    src="${escaparHTML(registro.fotografiaSello.data)}"
                    alt="Fotografía del sello de ${escaparHTML(registro.numero)}"
                >
                <small>
                    ${escaparHTML(
                        registro.fotografiaSello.nombre ||
                        "Fotografía del sello"
                    )}
                </small>
            </div>
        `
        : '<p class="empty-state">No se registró fotografía del sello.</p>';

    contenedor.innerHTML = `
    <div class="detail-heading">
        <h3>Detalle de ${escaparHTML(registro.numero)}</h3>

        <button
            type="button"
            class="detail-toggle-button"
            data-close-detail
        >
            Cerrar ↑
        </button>
    </div>

        <div class="confirmation-grid">
            ${contenido}
        </div>

        <h4>
            Evidencias fotográficas (${fotografias.length})
        </h4>

        <div class="detail-photos">
            ${fotos || '<p class="empty-state">Sin fotografías generales.</p>'}
        </div>

        <h4>Fotografía del sello</h4>

        <div class="detail-photos">
            ${fotoSello}
        </div>
    `;

    contenedor.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

// ----------------------------------
// ELIMINAR REGISTRO
// ----------------------------------

async function eliminarRegistroOperador(id) {
    const registro = await buscarContenedor(id);

    if (!registro) {
        window.alert("No se encontró el contenedor.");
        return;
    }

    const confirmar = window.confirm(
        `¿Estás seguro de eliminar la caja ${registro.numero}?\n\n` +
        "Esta acción no se puede deshacer."
    );

    if (!confirmar) return;

    await eliminarContenedor(id);

    await renderizarHistorial();
    await renderizarRecientes();

    const detalle = $("#recordDetail");

    if (detalle) {
        detalle.classList.add("hidden");
        detalle.innerHTML = "";
    }

    window.alert(
        `La caja ${registro.numero} fue eliminada correctamente.`
    );
}

// ----------------------------------
// INICIALIZAR HISTORIAL
// ----------------------------------

export function inicializarHistorial() {
    $("#applyHistoryFilters").addEventListener("click", () => {
    paginaActual = 1;

    renderizarHistorial().catch(error => {
        console.error("Error al filtrar registros:", error);
    });
    });

    $("#clearHistoryFilters").addEventListener("click", () => {
    $("#historyNumber").value = "";
    $("#historyCarrier").value = "";
    $("#historyStatus").value = "";
    $("#historyLocation").value = "";
    $("#historyYard").value = "";
    $("#historyDateFrom").value = "";
    $("#historyDateTo").value = "";

    paginaActual = 1;

    renderizarHistorial().catch(error => {
        console.error("Error al limpiar filtros:", error);
    });
    });

    $("#historialView").addEventListener("click", event => {
    const botonPagina = event.target.closest("[data-history-page]");

    if (!botonPagina || botonPagina.disabled) return;

    paginaActual = Number(botonPagina.dataset.historyPage);

    renderizarHistorial(false).catch(error => {
        console.error("Error al cambiar de página:", error);
    });
    });

    $("#historyRecords").addEventListener("click", event => {
        const botonDetalle = event.target.closest("[data-detail]");

        if (botonDetalle) {
            mostrarDetalle(botonDetalle.dataset.detail).catch(error => {
                console.error("Error al consultar contenedor:", error);
                window.alert(error.message);
            });
            return;
        }

        const botonEliminar = event.target.closest("[data-delete]");

        if (botonEliminar) {
            eliminarRegistroOperador(
                botonEliminar.dataset.delete
            ).catch(error => {
                console.error("Error al eliminar contenedor:", error);
                window.alert(error.message);
            });
        }
    });

    $("#recordDetail").addEventListener("click", event => {
    const botonCerrar = event.target.closest("[data-close-detail]");

    if (!botonCerrar) return;

    const detalle = $("#recordDetail");

    detalle.classList.add("hidden");
    detalle.innerHTML = "";
    });    
}