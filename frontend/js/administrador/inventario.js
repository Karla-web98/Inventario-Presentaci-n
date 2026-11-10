"use strict";

// =========================================================
// INVENTARIO DEL ADMINISTRADOR
// =========================================================

import {
    listarContenedores,
    eliminarContenedor
} from "../api/contenedores.js";

// =========================================================
// OBTENER INVENTARIO DEL SERVIDOR
// =========================================================

async function obtenerInventario() {
    const registros = await listarContenedores();

    return Array.isArray(registros) ? registros : [];
}

// =========================================================
// UTILIDADES
// =========================================================

function escaparInventario(valor) {
    return String(valor ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function normalizarInventario(valor) {
    return String(valor ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

// =========================================================
// OBTENER DATOS
// =========================================================

function obtenerDatoInventario(registro, campos) {
    for (const campo of campos) {
        if (
            registro[campo] !== undefined &&
            registro[campo] !== null &&
            registro[campo] !== ""
        ) {
            return registro[campo];
        }
    }

    return "—";
}

function obtenerNumeroCaja(registro) {
    return obtenerDatoInventario(registro, [
        "numero",
        "numeroCaja",
        "caja",
        "identificador"
    ]);
}

function obtenerCarrierInventario(registro) {
    return obtenerDatoInventario(registro, [
        "carrier",
        "transportista"
    ]);
}

function obtenerEstadoInventario(registro) {
    return obtenerDatoInventario(registro, [
        "status",
        "estado"
    ]);
}

function obtenerUbicacionInventario(registro) {
    return obtenerDatoInventario(registro, [
        "ubicacion"
    ]);
}

function obtenerPatioInventario(registro) {
    return obtenerDatoInventario(registro, [
        "patio"
    ]);
}

function obtenerSpotInventario(registro) {
    return obtenerDatoInventario(registro, [
        "spot",
        "numeroSpot",
        "numero_spot"
    ]);
}

function obtenerFechaInventario(registro) {
    return obtenerDatoInventario(registro, [
        "fechaRegistro",
        "fecha_registro",
        "fecha",
        "createdAt"
    ]);
}

// =========================================================
// FORMATEAR FECHA
// =========================================================

function formatearFechaInventario(valor) {
    if (!valor || valor === "—") {
        return "—";
    }

    const fecha = new Date(valor);

    if (Number.isNaN(fecha.getTime())) {
        return escaparInventario(valor);
    }

    return fecha.toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}

// =========================================================
// ESTADOS
// =========================================================

function obtenerClaseEstadoInventario(estado) {
    const valor = normalizarInventario(estado);

    if (
        valor === "disponible" ||
        valor === "registrado" ||
        valor === "vacio" ||
        valor === "equipo vacio"
    ) {
        return "badge-success";
    }

    if (
        valor === "observado" ||
        valor === "observada" ||
        valor === "danado"
    ) {
        return "badge-warning";
    }

    if (
        valor === "retirado" ||
        valor === "inactivo"
    ) {
        return "badge-danger";
    }

    if (valor === "cargado prod") {
        return "badge-info";
    }

    return "";
}

// =========================================================
// FILTROS DE PATIO
// =========================================================

function actualizarFiltroPatios(registros) {
    const filtro = document.querySelector(
        "#inventoryPatioFilter"
    );

    if (!filtro) {
        return;
    }

    const patioActual = filtro.value;

    const patios = [
        ...new Set(
            registros
                .map(registro => obtenerPatioInventario(registro))
                .filter(patio => patio !== "—")
        )
    ].sort((a, b) =>
        String(a).localeCompare(String(b), "es")
    );

    filtro.innerHTML = `
        <option value="">Todos los patios</option>

        ${patios.map(patio => `
            <option value="${escaparInventario(patio)}">
                ${escaparInventario(patio)}
            </option>
        `).join("")}
    `;

    if (patios.includes(patioActual)) {
        filtro.value = patioActual;
    }
}

// =========================================================
// APLICAR FILTROS
// =========================================================

function filtrarInventario(registros) {
    const busqueda = normalizarInventario(
        document.querySelector("#inventorySearch")?.value || ""
    );

    const estado = normalizarInventario(
        document.querySelector("#inventoryStatusFilter")?.value || ""
    );

    const patio = normalizarInventario(
        document.querySelector("#inventoryPatioFilter")?.value || ""
    );

    return registros.filter(registro => {
        const numero = normalizarInventario(
            obtenerNumeroCaja(registro)
        );

        const carrier = normalizarInventario(
            obtenerCarrierInventario(registro)
        );

        const ubicacion = normalizarInventario(
            obtenerUbicacionInventario(registro)
        );

        const spot = normalizarInventario(
            obtenerSpotInventario(registro)
        );

        const estadoRegistro = normalizarInventario(
            obtenerEstadoInventario(registro)
        );

        const patioRegistro = normalizarInventario(
            obtenerPatioInventario(registro)
        );

        const coincideBusqueda =
            !busqueda ||
            numero.includes(busqueda) ||
            carrier.includes(busqueda) ||
            ubicacion.includes(busqueda) ||
            spot.includes(busqueda);

        const coincideEstado =
            !estado || estadoRegistro === estado;

        const coincidePatio =
            !patio || patioRegistro === patio;

        return (
            coincideBusqueda &&
            coincideEstado &&
            coincidePatio
        );
    });
}

// =========================================================
// ORDENAR INVENTARIO
// =========================================================

function ordenarInventario(registros) {
    return [...registros].sort((a, b) => {
        const fechaA = obtenerFechaInventario(a);
        const fechaB = obtenerFechaInventario(b);

        const tiempoA = new Date(fechaA).getTime() || 0;
        const tiempoB = new Date(fechaB).getTime() || 0;

        return tiempoB - tiempoA;
    });
}

// =========================================================
// MOSTRAR INVENTARIO
// =========================================================

async function mostrarInventario() {
    const tabla = document.querySelector("#inventoryTable");

    if (!tabla) {
        console.error("No se encontró la tabla #inventoryTable.");
        return;
    }

    const registros = await obtenerInventario();

    actualizarFiltroPatios(registros);

    const filtrados = ordenarInventario(
        filtrarInventario(registros)
    );

    if (!filtrados.length) {
        const mensaje = registros.length
            ? "No se encontraron contenedores con esos filtros."
            : "Todavía no hay contenedores registrados.";

        tabla.innerHTML = `
            <tr>
                <td colspan="8" class="admin-empty">
                    ${mensaje}
                </td>
            </tr>
        `;

        return;
    }

    tabla.innerHTML = filtrados.map(registro => {
        const numero = obtenerNumeroCaja(registro);
        const carrier = obtenerCarrierInventario(registro);
        const estado = obtenerEstadoInventario(registro);
        const ubicacion = obtenerUbicacionInventario(registro);
        const spot = obtenerSpotInventario(registro);
        const patio = obtenerPatioInventario(registro);
        const fecha = obtenerFechaInventario(registro);

        const identificador = obtenerDatoInventario(registro, [
            "id",
            "uuid",
            "registroId"
        ]);

        return `
            <tr>
                <td>
                    <strong>
                        ${escaparInventario(numero)}
                    </strong>
                </td>

                <td>
                    ${escaparInventario(carrier)}
                </td>

                <td>
                    <span class="badge ${obtenerClaseEstadoInventario(estado)}">
                        ${escaparInventario(estado)}
                    </span>
                </td>

                <td>
                    ${escaparInventario(ubicacion)}
                </td>

                <td>
                    ${escaparInventario(spot)}
                </td>

                <td>
                    ${escaparInventario(patio)}
                </td>

                <td>
                    ${formatearFechaInventario(fecha)}
                </td>

                <td>
                    <div class="inventory-actions">

                        <button
                            type="button"
                            class="btn btn-secondary"
                            data-detail-id="${escaparInventario(identificador)}"
                        >
                            Ver detalle
                        </button>

                        <button
                            type="button"
                            class="btn-delete"
                            data-delete-id="${escaparInventario(identificador)}"
                        >
                            Eliminar
                        </button>

                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

// =========================================================
// ABRIR DETALLE
// =========================================================

async function abrirDetalleContenedor(identificador) {
    const registros = await obtenerInventario();

    const registro = registros.find(item => {
        const id = obtenerDatoInventario(item, [
            "id",
            "uuid",
            "registroId"
        ]);

        return String(id) === String(identificador);
    });

    if (!registro) {
        alert("No se encontró el contenedor seleccionado.");
        return;
    }

    const contenedor = document.querySelector(
        "#containerDetail"
    );

    if (!contenedor) {
        return;
    }

    const numero = obtenerNumeroCaja(registro);
    const carrier = obtenerCarrierInventario(registro);
    const estado = obtenerEstadoInventario(registro);
    const ubicacion = obtenerUbicacionInventario(registro);
    const spot = obtenerSpotInventario(registro);
    const patio = obtenerPatioInventario(registro);
    const fecha = obtenerFechaInventario(registro);

    const observaciones = obtenerDatoInventario(registro, [
        "observaciones",
        "comentarios"
    ]);

    // Fotografías generales
    const fotos = Array.isArray(registro.fotografias)
        ? registro.fotografias
        : Array.isArray(registro.fotos)
            ? registro.fotos
            : [];

    // Fotografía del sello
    const fotografiaSello = registro.fotografiaSello || null;

    const fuenteSello = fotografiaSello
        ? (
            typeof fotografiaSello === "string"
                ? fotografiaSello
                : fotografiaSello.data ||
                  fotografiaSello.url ||
                  ""
        )
        : "";

    // Contenido del detalle
    contenedor.innerHTML = `
        <div class="card" style="margin-bottom: 20px;">

            <h3>Información general</h3>

            <div class="admin-detail-grid">

                <div>
                    <span>CAJA</span>
                    <strong>${escaparInventario(numero)}</strong>
                </div>

                <div>
                    <span>CARRIER</span>
                    <strong>${escaparInventario(carrier)}</strong>
                </div>

                <div>
                    <span>STATUS</span>
                    <strong>${escaparInventario(estado)}</strong>
                </div>

                <div>
                    <span>UBICACIÓN</span>
                    <strong>${escaparInventario(ubicacion)}</strong>
                </div>

                <div>
                    <span>NÚMERO DE SPOT</span>
                    <strong>${escaparInventario(spot)}</strong>
                </div>

                <div>
                    <span>PATIO</span>
                    <strong>${escaparInventario(patio)}</strong>
                </div>

                <div>
                    <span>FECHA DE REGISTRO</span>
                    <strong>${formatearFechaInventario(fecha)}</strong>
                </div>

            </div>

            <div class="admin-detail-observations">

                <span>OBSERVACIONES</span>

                <p>${escaparInventario(observaciones)}</p>

            </div>

        </div>

        <div class="card">

            <h3>Evidencias fotográficas</h3>

            ${
                fotos.length
                    ? `
                        <div class="admin-photos-grid">

                            ${fotos.map((foto, index) => {
                                const fuente =
                                    typeof foto === "string"
                                        ? foto
                                        : foto.data ||
                                          foto.url ||
                                          "";

                                return `
                                    <figure>
                                        <img
                                            src="${escaparInventario(fuente)}"
                                            alt="Fotografía ${index + 1}"
                                            data-admin-image
                                        >

                                        <figcaption>
                                            Fotografía ${index + 1}
                                        </figcaption>
                                    </figure>
                                `;
                            }).join("")}

                        </div>
                    `
                    : `
                        <p class="admin-detail-empty">
                            Este contenedor no tiene fotografías.
                        </p>
                    `
            }

        </div>

        <div class="card" style="margin-top: 20px;">

            <h3>Fotografía del sello</h3>

            ${
                fuenteSello
                    ? `
                        <div class="admin-photos-grid">

                            <figure>
                                <img
                                    src="${escaparInventario(fuenteSello)}"
                                    alt="Fotografía del sello"
                                    data-admin-image
                                >

                                <figcaption>
                                    Fotografía del sello
                                </figcaption>
                            </figure>

                        </div>
                    `
                    : `
                        <p class="admin-detail-empty">
                            No se registró fotografía del sello.
                        </p>
                    `
            }

        </div>
    `;

    cambiarVistaAdministrador("detalle");
}

// =========================================================
// VISUALIZADOR DE FOTOGRAFÍAS
// =========================================================

function crearVisualizadorFotografias() {
    let modal = document.querySelector("#adminImageModal");

    if (modal) {
        return modal;
    }

    modal = document.createElement("div");

    modal.id = "adminImageModal";
    modal.className = "admin-image-modal";

    modal.innerHTML = `
        <div class="admin-image-modal-content">

            <button
                type="button"
                class="admin-image-modal-close"
                aria-label="Cerrar fotografía"
            >
                &times;
            </button>

            <img
                class="admin-image-modal-preview"
                src=""
                alt="Fotografía ampliada"
            >

            <p class="admin-image-modal-caption"></p>

        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector(".admin-image-modal-close")
        .addEventListener("click", cerrarVisualizador);

    modal.addEventListener("click", evento => {
        if (evento.target === modal) {
            cerrarVisualizador();
        }
    });

    return modal;
}

function abrirVisualizador(imagen) {
    const modal = crearVisualizadorFotografias();

    const imagenAmpliada = modal.querySelector(
        ".admin-image-modal-preview"
    );

    const descripcion = modal.querySelector(
        ".admin-image-modal-caption"
    );

    imagenAmpliada.src = imagen.src;
    imagenAmpliada.alt = imagen.alt;

    descripcion.textContent = imagen.alt;

    modal.classList.add("active");

    document.body.classList.add("admin-image-modal-open");
}

function cerrarVisualizador() {
    const modal = document.querySelector("#adminImageModal");

    if (!modal) {
        return;
    }

    modal.classList.remove("active");

    document.body.classList.remove("admin-image-modal-open");

    modal.querySelector(".admin-image-modal-preview").src = "";
}

// =========================================================
// ELIMINAR CONTENEDOR
// =========================================================

async function eliminarRegistroInventario(id) {
    try {
        const registros = await obtenerInventario();

        const registro = registros.find(item =>
            String(item.id) === String(id)
        );

        if (!registro) {
            alert("No se encontró el contenedor.");
            return;
        }

        const numero = obtenerNumeroCaja(registro);

        const confirmar = window.confirm(
            `¿Estás seguro de eliminar la caja ${numero}?\n\n` +
            "Esta acción no se puede deshacer."
        );

        if (!confirmar) {
            return;
        }

        await eliminarContenedor(id);

        await mostrarInventario();

        const detalle = document.querySelector("#containerDetail");

        if (detalle) {
            detalle.innerHTML = "";
        }

        window.dispatchEvent(
            new CustomEvent("inventario:actualizado")
        );

        alert(
            `La caja ${numero} fue eliminada correctamente.`
        );

    } catch (error) {
        console.error("Error al eliminar contenedor:", error);

        alert(
            error.message ||
            "No fue posible eliminar el contenedor."
        );
    }
}

// =========================================================
// NAVEGACIÓN AL DETALLE
// =========================================================

function cambiarVistaAdministrador(nombreVista) {
    document.querySelectorAll(".admin-view").forEach(vista => {
        vista.classList.remove("active");
    });

    const destino = document.querySelector(
        `#view-${nombreVista}`
    );

    if (destino) {
        destino.classList.add("active");
    }

    document.querySelectorAll(".admin-nav-item").forEach(boton => {
        boton.classList.toggle(
            "active",
            boton.dataset.view === nombreVista
        );
    });

    const titulos = {
        dashboard: "Dashboard",
        inventario: "Inventario",
        historico: "Histórico",
        auditorias: "Auditorías",
        usuarios: "Usuarios",
        ubicaciones: "Ubicaciones",
        reportes: "Reportes",
        detalle: "Detalle del contenedor"
    };

    const titulo = document.querySelector("#adminPageTitle");

    if (titulo) {
        titulo.textContent =
            titulos[nombreVista] || "Administrador";
    }
}

// =========================================================
// EVENTOS
// =========================================================

function configurarEventosInventario() {
    const busqueda = document.querySelector(
        "#inventorySearch"
    );

    const estado = document.querySelector(
        "#inventoryStatusFilter"
    );

    const patio = document.querySelector(
        "#inventoryPatioFilter"
    );

    const tabla = document.querySelector(
        "#inventoryTable"
    );

    const detalle = document.querySelector(
        "#containerDetail"
    );

    // Actualizar tabla
    const actualizarInventario = () => {
        mostrarInventario().catch(error => {
            console.error("Error al actualizar inventario:", error);

            alert(
                error.message ||
                "No fue posible cargar el inventario."
            );
        });
    };

    busqueda?.addEventListener(
        "input",
        actualizarInventario
    );

    estado?.addEventListener(
        "change",
        actualizarInventario
    );

    patio?.addEventListener(
        "change",
        actualizarInventario
    );

    // ---------------------------------------------
    // EVENTOS DE LA TABLA
    // ---------------------------------------------

    tabla?.addEventListener("click", evento => {
        const botonDetalle = evento.target.closest(
            "[data-detail-id]"
        );

        if (botonDetalle) {
            abrirDetalleContenedor(
                botonDetalle.dataset.detailId
            ).catch(error => {
                console.error("Error al abrir detalle:", error);

                alert(
                    error.message ||
                    "No fue posible cargar el detalle."
                );
            });

            return;
        }

        const botonEliminar = evento.target.closest(
            "[data-delete-id]"
        );

        if (botonEliminar) {
            void eliminarRegistroInventario(
                botonEliminar.dataset.deleteId
            );
        }
    });

    // ---------------------------------------------
    // AMPLIAR FOTOGRAFÍAS
    // ---------------------------------------------

    detalle?.addEventListener("click", evento => {
        const imagen = evento.target.closest(
            "[data-admin-image]"
        );

        if (imagen) {
            abrirVisualizador(imagen);
        }
    });

    // ---------------------------------------------
    // CERRAR VISUALIZADOR CON ESCAPE
    // ---------------------------------------------

    document.addEventListener("keydown", evento => {
        if (evento.key === "Escape") {
            cerrarVisualizador();
        }
    });

    // ---------------------------------------------
    // ACTUALIZAR AL ABRIR INVENTARIO
    // ---------------------------------------------

    document
        .querySelectorAll('[data-view="inventario"]')
        .forEach(boton => {
            boton.addEventListener(
                "click",
                actualizarInventario
            );
        });
}

// =========================================================
// INICIALIZACIÓN
// =========================================================

function iniciarInventarioAdministrador() {
    configurarEventosInventario();

    mostrarInventario().catch(error => {
        console.error("Error al iniciar inventario:", error);

        const tabla = document.querySelector("#inventoryTable");

        if (tabla) {
            tabla.innerHTML = `
                <tr>
                    <td colspan="8" class="admin-empty">
                        No fue posible cargar el inventario.
                    </td>
                </tr>
            `;
        }

        alert(
            error.message ||
            "No fue posible cargar el inventario."
        );
    });

    console.log(
        "Inventario del administrador iniciado correctamente."
    );
}

document.addEventListener(
    "DOMContentLoaded",
    iniciarInventarioAdministrador
);