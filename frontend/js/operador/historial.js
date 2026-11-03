"use strict";

import {
    listarContenedores,
    buscarContenedor,
    eliminarContenedor
} from "../api/contenedores.js";

const $ = selector => document.querySelector(selector);

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

export function renderizarHistorial() {
    const registros = listarContenedores();
    const busqueda = $("#historySearch").value.trim().toLowerCase();
    const estado = $("#historyStatus").value;

    const filtrados = registros.filter(registro => {
        const texto = [
            registro.numero,
            registro.carrier,
            registro.ubicacion,
            registro.patio,
            registro.spot
        ].join(" ").toLowerCase();

        return texto.includes(busqueda) &&
            (!estado || registro.estado === estado);
    });

    $("#historyRecords").innerHTML = crearTabla(filtrados);
}

export function renderizarRecientes() {
    const registros = listarContenedores().slice(0, 5);
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

export function mostrarDetalle(id) {
    const registro = buscarContenedor(id);
    const contenedor = $("#recordDetail");

    if (!registro) return;

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

    // Fotografías generales.
    const fotografias = registro.fotografias || [];

    const fotos = fotografias.map((foto, indice) => `
        <div class="detail-photo-item">
            <img
                src="${foto.data}"
                alt="Evidencia ${indice + 1} de ${escaparHTML(registro.numero)}"
            >
            <small>
                ${escaparHTML(foto.nombre || `Fotografía ${indice + 1}`)}
            </small>
        </div>
    `).join("");

    // Fotografía del sello.
    const fotoSello = registro.fotografiaSello
        ? `
            <div class="detail-photo-item">
                <img
                    src="${registro.fotografiaSello.data}"
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
        <h3>Detalle de ${escaparHTML(registro.numero)}</h3>

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

function eliminarRegistroOperador(id) {
    const registro = buscarContenedor(id);

    if (!registro) {
        alert("No se encontró el contenedor.");
        return;
    }

    const confirmar = window.confirm(
        `¿Estás seguro de eliminar la caja ${registro.numero}?\n\n` +
        "Esta acción no se puede deshacer."
    );

    if (!confirmar) return;

    eliminarContenedor(id);

    renderizarHistorial();
    renderizarRecientes();

    const detalle = $("#recordDetail");

    if (detalle) {
        detalle.classList.add("hidden");
        detalle.innerHTML = "";
    }

    window.dispatchEvent(
        new StorageEvent("storage", {
            key: "inventario_operador_registros"
        })
    );

    alert(
        `La caja ${registro.numero} fue eliminada correctamente.`
    );
}

// ----------------------------------
// INICIALIZAR HISTORIAL
// ----------------------------------

export function inicializarHistorial() {
    $("#historySearch").addEventListener(
        "input",
        renderizarHistorial
    );

    $("#historyStatus").addEventListener(
        "change",
        renderizarHistorial
    );

    $("#historyRecords").addEventListener("click", event => {
        const botonDetalle = event.target.closest("[data-detail]");

        if (botonDetalle) {
            mostrarDetalle(botonDetalle.dataset.detail);
            return;
        }

        const botonEliminar = event.target.closest("[data-delete]");

        if (botonEliminar) {
            eliminarRegistroOperador(
                botonEliminar.dataset.delete
            );
        }
    });
}