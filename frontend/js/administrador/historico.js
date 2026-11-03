"use strict";

// =========================================================
// HISTÓRICO DEL ADMINISTRADOR
// Cada corte conserva una copia completa del inventario.
// =========================================================

const HISTORICO_REGISTROS_KEY = "inventario_operador_registros";
const HISTORICO_CORTES_KEY = "inventario_admin_cortes";

// =========================================================
// UTILIDADES
// =========================================================

function obtenerRegistrosHistorico() {
    try {
        const datos = JSON.parse(
            localStorage.getItem(HISTORICO_REGISTROS_KEY) || "[]"
        );

        return Array.isArray(datos) ? datos : [];
    } catch (error) {
        console.error("Error al leer el inventario:", error);
        return [];
    }
}

function obtenerCortesHistorico() {
    try {
        const datos = JSON.parse(
            localStorage.getItem(HISTORICO_CORTES_KEY) || "[]"
        );

        return Array.isArray(datos) ? datos : [];
    } catch (error) {
        console.error("Error al leer los cortes históricos:", error);
        return [];
    }
}

function guardarCortesHistorico(cortes) {
    localStorage.setItem(
        HISTORICO_CORTES_KEY,
        JSON.stringify(cortes)
    );
}

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
    if (!valor) {
        return "—";
    }

    // Evita desfases de día al interpretar fechas YYYY-MM-DD.
    const coincidencia = String(valor).match(/^(\d{4})-(\d{2})-(\d{2})$/);

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

function formatearHoraHistorico(valor) {
    if (!valor) {
        return "—";
    }

    return escaparHistorico(valor);
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

function obtenerFotosHistorico(registro) {
    // El módulo Operador guarda las fotos en "fotografias".
    // Se contempla "fotos" para registros de versiones anteriores.
    const fotos = registro.fotografias ?? registro.fotos ?? [];

    return Array.isArray(fotos) ? fotos : [];
}

// =========================================================
// RESUMEN DEL CORTE
// =========================================================

function calcularResumenHistorico(registros) {
    let disponibles = 0;
    let observadas = 0;
    let fotografias = 0;

    registros.forEach(registro => {
        const estado = normalizarHistorico(
            obtenerEstadoHistorico(registro)
        );

        if (estado === "disponible") {
            disponibles++;
        }

        if (estado === "observado" || estado === "observada") {
            observadas++;
        }

        fotografias += obtenerFotosHistorico(registro).length;
    });

    return {
        total: registros.length,
        disponibles,
        observadas,
        fotografias
    };
}

// =========================================================
// CREAR CORTE DIARIO
// =========================================================

function crearCorteDiario() {
    const fechaHoy = obtenerFechaLocalHistorico();
    const cortes = obtenerCortesHistorico();

    // Solo se genera un corte automático por día.
    const corteExistente = cortes.find(
        corte => corte.fecha === fechaHoy
    );

    if (corteExistente) {
        return corteExistente;
    }

    const registros = obtenerRegistrosHistorico();

    // Se realiza una copia independiente de los registros y fotos.
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

    cortes.unshift(nuevoCorte);
    guardarCortesHistorico(cortes);

    console.log("Corte histórico diario creado:", nuevoCorte);

    return nuevoCorte;
}

// =========================================================
// PREPARAR INTERFAZ DEL HISTÓRICO
// =========================================================

function prepararInterfazHistorico() {
    const vista = document.querySelector("#view-historico");

    if (!vista) {
        return;
    }

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

    if (!tabla) {
        return;
    }

    const tarjeta = tabla.closest(".admin-table-card");

    if (tarjeta && !document.querySelector("#historyDetail")) {
        const detalle = document.createElement("div");

        detalle.id = "historyDetail";
        detalle.className = "admin-history-detail hidden";

        tarjeta.insertAdjacentElement("afterend", detalle);
    }

    // Cambiar los encabezados originales, que correspondían a movimientos.
    const encabezados = tabla.closest("table")?.querySelectorAll("thead th");

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

    if (!tabla) {
        return;
    }

    const cortes = obtenerCortesHistorico();

    if (!cortes.length) {
        tabla.innerHTML = `
            <tr>
                <td colspan="5" class="admin-empty">
                    Todavía no hay cortes históricos.
                </td>
            </tr>
        `;

        return;
    }

    tabla.innerHTML = cortes.map(corte => {
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
// MOSTRAR DETALLE DE UN CORTE
// =========================================================

function mostrarDetalleCorte(identificador) {
    const cortes = obtenerCortesHistorico();

    const corte = cortes.find(
        item => String(item.id) === String(identificador)
    );

    if (!corte) {
        alert("No se encontró el corte histórico.");
        return;
    }

    const contenedor = document.querySelector("#historyDetail");

    if (!contenedor) {
        return;
    }

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
                        <th>FOTOS</th>
                    </tr>
                </thead>

                <tbody>
                    ${
                        registros.length
                            ? registros.map(registro => `
                                <tr>
                                    <td>
                                        <strong>
                                            ${escaparHistorico(obtenerNumeroHistorico(registro))}
                                        </strong>
                                    </td>

                                    <td>
                                        ${escaparHistorico(obtenerCarrierHistorico(registro))}
                                    </td>

                                    <td>
                                        ${escaparHistorico(obtenerEstadoHistorico(registro))}
                                    </td>

                                    <td>
                                        ${escaparHistorico(obtenerUbicacionHistorico(registro))}
                                    </td>

                                    <td>
                                        ${escaparHistorico(obtenerPatioHistorico(registro))}
                                    </td>

                                    <td>
                                        ${obtenerFotosHistorico(registro).length}
                                    </td>
                                </tr>
                            `).join("")
                            : `
                                <tr>
                                    <td colspan="6" class="admin-empty">
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

        if (!boton) {
            return;
        }

        mostrarDetalleCorte(boton.dataset.historyDetail);
    });

    detalle?.addEventListener("click", evento => {
        if (evento.target.closest("#closeHistoryDetail")) {
            detalle.classList.add("hidden");
            detalle.innerHTML = "";
        }
    });

    // Actualizar la tabla si otra pestaña crea o modifica cortes.
    window.addEventListener("storage", evento => {
        if (evento.key === HISTORICO_CORTES_KEY) {
            mostrarCortesHistoricos();
        }
    });
}

// =========================================================
// INICIALIZACIÓN
// =========================================================

function iniciarHistoricoAdministrador() {
    prepararInterfazHistorico();

    // Crear el corte del día si todavía no existe.
    crearCorteDiario();

    mostrarCortesHistoricos();

    configurarEventosHistorico();

    console.log("Histórico del administrador iniciado correctamente.");
}

document.addEventListener(
    "DOMContentLoaded",
    iniciarHistoricoAdministrador
);