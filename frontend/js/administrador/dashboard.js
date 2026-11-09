
"use strict";

// =========================================================
// DASHBOARD DEL ADMINISTRADOR
// =========================================================

import { listarContenedores } from "../api/contenedores.js";

// =========================================================
// OBTENER REGISTROS DEL SERVIDOR
// =========================================================

async function obtenerRegistros() {
    const registros = await listarContenedores();

    return Array.isArray(registros) ? registros : [];
}

// =========================================================
// UTILIDADES
// =========================================================

function escaparHTML(valor) {
    return String(valor ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function normalizarTexto(valor) {
    return String(valor ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

// =========================================================
// FECHA ACTUAL
// =========================================================

function mostrarFechaActual() {
    const elemento = document.querySelector("#currentDate");

    if (!elemento) return;

    elemento.textContent = new Date().toLocaleDateString(
        "es-MX",
        {
            day: "2-digit",
            month: "long",
            year: "numeric"
        }
    );
}

// =========================================================
// ESTADÍSTICAS
// =========================================================

function actualizarEstadisticas(registros) {
    const total = registros.length;

    const vacios = registros.filter(registro =>
        normalizarTexto(registro.status || registro.estado) === "vacio"
    ).length;

    const cargadosProd = registros.filter(registro =>
        normalizarTexto(registro.status || registro.estado) === "cargado prod"
    ).length;

    const equiposVacios = registros.filter(registro =>
        normalizarTexto(registro.status || registro.estado) === "equipo vacio"
    ).length;

    const danados = registros.filter(registro =>
        normalizarTexto(registro.status || registro.estado) === "danado"
    ).length;

    const fotografias = registros.reduce((totalFotos, registro) => {
        const fotos = Array.isArray(registro.fotografias)
            ? registro.fotografias.length
            : Array.isArray(registro.fotos)
                ? registro.fotos.length
                : 0;

        return totalFotos + fotos;
    }, 0);

    const estadisticas = {
        "#statTotal": total,
        "#statVacios": vacios,
        "#statCargadosProd": cargadosProd,
        "#statEquiposVacios": equiposVacios,
        "#statDanados": danados,
        "#statFotos": fotografias
    };

    Object.entries(estadisticas).forEach(([selector, valor]) => {
        const elemento = document.querySelector(selector);

        if (elemento) {
            elemento.textContent = valor;
        }
    });
}

// =========================================================
// OBTENER DATOS DEL REGISTRO
// =========================================================

function obtenerNumero(registro) {
    return registro.numero ||
        registro.numeroCaja ||
        registro.caja ||
        registro.identificador ||
        "—";
}

function obtenerCarrier(registro) {
    return registro.carrier ||
        registro.transportista ||
        "—";
}

function obtenerEstado(registro) {
    return registro.status ||
        registro.estado ||
        "—";
}

function obtenerUbicacion(registro) {
    return registro.ubicacion || "—";
}

function obtenerPatio(registro) {
    return registro.patio || "—";
}

function obtenerSpot(registro) {
    return registro.spot ||
        registro.numeroSpot ||
        registro.numero_spot ||
        "—";
}

function obtenerFechaRegistro(registro) {
    return registro.fechaRegistro ||
        registro.fecha_registro ||
        registro.fecha ||
        registro.createdAt ||
        "";
}

function obtenerHoraRegistro(registro) {
    return registro.horaRegistro ||
        registro.hora_registro ||
        registro.hora ||
        "";
}

// =========================================================
// FORMATEAR FECHA
// =========================================================

function formatearFecha(valor) {
    if (!valor) return "—";

    const fecha = new Date(valor);

    if (Number.isNaN(fecha.getTime())) {
        return escaparHTML(valor);
    }

    return fecha.toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}

// =========================================================
// ORDENAMIENTO
// =========================================================

function obtenerFechaOrdenamiento(registro) {
    const fecha = obtenerFechaRegistro(registro);

    if (!fecha) return 0;

    // Primero intenta interpretar la fecha directamente.
    const fechaDirecta = new Date(fecha).getTime();

    if (!Number.isNaN(fechaDirecta)) {
        return fechaDirecta;
    }

    // Compatibilidad con fechas y horas separadas.
    const hora = obtenerHoraRegistro(registro);
    const fechaConHora = new Date(`${fecha} ${hora}`).getTime();

    return Number.isNaN(fechaConHora) ? 0 : fechaConHora;
}

// =========================================================
// CLASE DEL ESTADO
// =========================================================

function obtenerClaseEstado(estado) {
    const valor = normalizarTexto(estado);

    if (valor === "vacio" || valor === "equipo vacio") {
        return "badge-success";
    }

    if (valor === "cargado prod") {
        return "badge-warning";
    }

    if (valor === "danado") {
        return "badge-danger";
    }

    return "";
}

// =========================================================
// ÚLTIMOS REGISTROS
// =========================================================

function mostrarUltimosRegistros(registros) {
    const tabla = document.querySelector("#dashboardRecentTable");

    if (!tabla) return;

    if (!registros.length) {
        tabla.innerHTML = `
            <tr>
                <td colspan="8" class="admin-empty">
                    No hay registros todavía.
                </td>
            </tr>
        `;

        return;
    }

    const ordenados = [...registros]
        .sort((a, b) =>
            obtenerFechaOrdenamiento(b) -
            obtenerFechaOrdenamiento(a)
        )
        .slice(0, 5);

    tabla.innerHTML = ordenados.map(registro => {
        const numero = obtenerNumero(registro);
        const carrier = obtenerCarrier(registro);
        const estado = obtenerEstado(registro);
        const ubicacion = obtenerUbicacion(registro);
        const spot = obtenerSpot(registro);
        const patio = obtenerPatio(registro);
        const fecha = obtenerFechaRegistro(registro);

        return `
            <tr>
                <td>
                    <strong>${escaparHTML(numero)}</strong>
                </td>

                <td>${escaparHTML(carrier)}</td>

                <td>
                    <span class="badge ${obtenerClaseEstado(estado)}">
                        ${escaparHTML(estado)}
                    </span>
                </td>

                <td>${escaparHTML(ubicacion)}</td>

                <td>${escaparHTML(spot)}</td>

                <td>${escaparHTML(patio)}</td>

                <td>${formatearFecha(fecha)}</td>

                <td></td>
            </tr>
        `;
    }).join("");
}

// =========================================================
// NAVEGACIÓN
// =========================================================

function configurarNavegacion() {
    const botones = document.querySelectorAll("[data-view]");

    botones.forEach(boton => {
        boton.addEventListener("click", () => {
            const vista = boton.dataset.view;

            if (!vista) return;

            cambiarVista(vista);

            if (vista === "dashboard") {
                void cargarDashboard();
            }
        });
    });
}

// =========================================================
// CAMBIAR VISTA
// =========================================================

function cambiarVista(nombreVista) {
    document.querySelectorAll(".admin-view").forEach(vista => {
        vista.classList.remove("active");
    });

    const vistaSeleccionada = document.querySelector(
        `#view-${nombreVista}`
    );

    if (vistaSeleccionada) {
        vistaSeleccionada.classList.add("active");
    }

    document.querySelectorAll(".admin-nav-item").forEach(boton => {
        boton.classList.toggle(
            "active",
            boton.dataset.view === nombreVista
        );
    });

    actualizarTitulo(nombreVista);
}

// =========================================================
// TÍTULO DEL HEADER
// =========================================================

function actualizarTitulo(nombreVista) {
    const titulo = document.querySelector("#adminPageTitle");

    if (!titulo) return;

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

    titulo.textContent = titulos[nombreVista] || "Administrador";
}

// =========================================================
// REFRESCAR DASHBOARD
// =========================================================

async function cargarDashboard() {
    try {
        const registros = await obtenerRegistros();

        mostrarFechaActual();
        actualizarEstadisticas(registros);
        mostrarUltimosRegistros(registros);

    } catch (error) {
        console.error("Error al cargar el dashboard:", error);

        const tabla = document.querySelector("#dashboardRecentTable");

        if (tabla) {
            tabla.innerHTML = `
                <tr>
                    <td colspan="8" class="admin-empty">
                        No fue posible conectar con el servidor.
                    </td>
                </tr>
            `;
        }

        [
            "#statTotal",
            "#statVacios",
            "#statCargadosProd",
            "#statEquiposVacios",
            "#statDanados",
            "#statFotos"
        ].forEach(selector => {
            const elemento = document.querySelector(selector);

            if (elemento) {
                elemento.textContent = "—";
            }
        });
    }
}

// =========================================================
// INICIALIZACIÓN
// =========================================================

function iniciarDashboard() {
    configurarNavegacion();

    void cargarDashboard();

    window.addEventListener("inventario:actualizado", () => {
        void cargarDashboard();
    });

    console.log("Dashboard del administrador iniciado correctamente.");
}

document.addEventListener(
    "DOMContentLoaded",
    iniciarDashboard
);
