"use strict";

// =========================================================
// DASHBOARD DEL ADMINISTRADOR
// =========================================================

const STORAGE_KEY = "inventario_operador_registros";

// =========================================================
// UTILIDADES
// =========================================================

function obtenerRegistros() {
    try {
        const registros = JSON.parse(
            localStorage.getItem(STORAGE_KEY) || "[]"
        );

        return Array.isArray(registros) ? registros : [];

    } catch (error) {
        console.error(
            "No se pudieron leer los registros:",
            error
        );

        return [];
    }
}


function escaparHTML(valor) {

    return String(valor ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// =========================================================
// FECHA ACTUAL
// =========================================================

function mostrarFechaActual() {

    const elemento = document.querySelector("#currentDate");

    if (!elemento) {
        return;
    }

    const fecha = new Date();

    elemento.textContent = fecha.toLocaleDateString(
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

    // -----------------------------------------------------
    // CONTAR POR STATUS
    // -----------------------------------------------------

    const vacios = registros.filter(registro =>
        normalizarTexto(
            registro.status || registro.estado
        ) === "vacio"
    ).length;


    const cargadosProd = registros.filter(registro =>
        normalizarTexto(
            registro.status || registro.estado
        ) === "cargado prod"
    ).length;


    const equiposVacios = registros.filter(registro =>
        normalizarTexto(
            registro.status || registro.estado
        ) === "equipo vacio"
    ).length;


    const danados = registros.filter(registro =>
        normalizarTexto(
            registro.status || registro.estado
        ) === "danado"
    ).length;


    // -----------------------------------------------------
    // CONTAR FOTOGRAFÍAS
    // -----------------------------------------------------

    const fotografias = registros.reduce(
        (totalFotos, registro) => {

            const fotos = Array.isArray(registro.fotografias)
                ? registro.fotografias.length
                : Array.isArray(registro.fotos)
                    ? registro.fotos.length
                    : 0;

            return totalFotos + fotos;
        },
        0
    );


    // -----------------------------------------------------
    // ELEMENTOS DEL DASHBOARD
    // -----------------------------------------------------

    const elementoTotal =
        document.querySelector("#statTotal");

    const elementoVacios =
        document.querySelector("#statVacios");

    const elementoCargadosProd =
        document.querySelector("#statCargadosProd");

    const elementoEquiposVacios =
        document.querySelector("#statEquiposVacios");

    const elementoDanados =
        document.querySelector("#statDanados");

    const elementoFotos =
        document.querySelector("#statFotos");


    // -----------------------------------------------------
    // ACTUALIZAR VALORES
    // -----------------------------------------------------

    if (elementoTotal) {
        elementoTotal.textContent = total;
    }

    if (elementoVacios) {
        elementoVacios.textContent = vacios;
    }

    if (elementoCargadosProd) {
        elementoCargadosProd.textContent = cargadosProd;
    }

    if (elementoEquiposVacios) {
        elementoEquiposVacios.textContent = equiposVacios;
    }

    if (elementoDanados) {
        elementoDanados.textContent = danados;
    }

    if (elementoFotos) {
        elementoFotos.textContent = fotografias;
    }
}


// =========================================================
// NORMALIZAR TEXTO
// =========================================================

function normalizarTexto(valor) {

    return String(valor ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}


// =========================================================
// FECHA DEL REGISTRO
// =========================================================

function obtenerFechaRegistro(registro) {

    if (registro.fechaRegistro) {
        return registro.fechaRegistro;
    }

    if (registro.fecha_registro) {
        return registro.fecha_registro;
    }

    if (registro.fecha) {
        return registro.fecha;
    }

    if (registro.createdAt) {
        return registro.createdAt;
    }

    return "";
}


function obtenerHoraRegistro(registro) {

    if (registro.horaRegistro) {
        return registro.horaRegistro;
    }

    if (registro.hora_registro) {
        return registro.hora_registro;
    }

    if (registro.hora) {
        return registro.hora;
    }

    return "";
}


// =========================================================
// FORMATEAR FECHA
// =========================================================

function formatearFecha(valor) {

    if (!valor) {
        return "—";
    }

    const fecha = new Date(valor);

    if (Number.isNaN(fecha.getTime())) {
        return escaparHTML(valor);
    }

    return fecha.toLocaleDateString(
        "es-MX",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    );
}


// =========================================================
// OBTENER DATOS DEL REGISTRO
// =========================================================

function obtenerNumero(registro) {

    return (
        registro.numero ||
        registro.numeroCaja ||
        registro.caja ||
        registro.identificador ||
        "—"
    );
}


function obtenerCarrier(registro) {

    return (
        registro.carrier ||
        registro.transportista ||
        "—"
    );
}


function obtenerEstado(registro) {

    return (
        registro.status ||
        registro.estado ||
        "—"
    );
}


function obtenerUbicacion(registro) {

    return (
        registro.ubicacion ||
        "—"
    );
}


function obtenerPatio(registro) {

    return (
        registro.patio ||
        "—"
    );
}

function obtenerSpot(registro) {

    return (
        registro.spot ||
        registro.numeroSpot ||
        registro.numero_spot ||
        "—"
    );
}

// =========================================================
// ÚLTIMOS REGISTROS
// =========================================================

function mostrarUltimosRegistros(registros) {

    const tabla =
        document.querySelector("#dashboardRecentTable");

    if (!tabla) {
        return;
    }


    if (!registros.length) {

        tabla.innerHTML = `
            <tr>
                <td
                    colspan="7"
                    class="admin-empty"
                >
                    No hay registros todavía.
                </td>
            </tr>
        `;

        return;
    }


    // Ordenar del más reciente al más antiguo
    const ordenados = [...registros]
        .sort((a, b) => {

            const fechaA =
                obtenerFechaOrdenamiento(a);

            const fechaB =
                obtenerFechaOrdenamiento(b);

            return fechaB - fechaA;
        })
        .slice(0, 5);


    tabla.innerHTML = ordenados.map(registro => {

        const numero =
            obtenerNumero(registro);

        const carrier =
            obtenerCarrier(registro);

        const estado =
            obtenerEstado(registro);

        const ubicacion =
            obtenerUbicacion(registro);

        const spot =
            obtenerSpot(registro);

        const patio =
            obtenerPatio(registro);

        const fecha =
            obtenerFechaRegistro(registro);


        return `
            <tr>

                <td>
                    <strong>
                        ${escaparHTML(numero)}
                    </strong>
                </td>

                <td>
                    ${escaparHTML(carrier)}
                </td>

                <td>
                    <span class="badge ${obtenerClaseEstado(estado)}">
                        ${escaparHTML(estado)}
                    </span>
                </td>

                <td>
                    ${escaparHTML(ubicacion)}
                </td>

                <td>
                    ${escaparHTML(spot)}
                </td>

                <td>
                    ${escaparHTML(patio)}
                </td>

                <td>
                    ${formatearFecha(fecha)}
                </td>

            </tr>
        `;

    }).join("");
}


// =========================================================
// ORDENAMIENTO
// =========================================================

function obtenerFechaOrdenamiento(registro) {

    const fecha =
        obtenerFechaRegistro(registro);

    const hora =
        obtenerHoraRegistro(registro);

    if (!fecha && !hora) {
        return 0;
    }

    const valor = `${fecha} ${hora}`;

    const resultado =
        new Date(valor).getTime();

    if (Number.isNaN(resultado)) {
        return 0;
    }

    return resultado;
}


// =========================================================
// CLASE DEL ESTADO
// =========================================================

function obtenerClaseEstado(estado) {

    const estadoNormalizado =
        normalizarTexto(estado);


    if (estadoNormalizado === "vacio") {
        return "badge-success";
    }


    if (estadoNormalizado === "cargado prod") {
        return "badge-warning";
    }


    if (estadoNormalizado === "equipo vacio") {
        return "badge-success";
    }


    if (estadoNormalizado === "danado") {
        return "badge-danger";
    }


    return "";
}


// =========================================================
// NAVEGACIÓN
// =========================================================

function configurarNavegacion() {

    const botones =
        document.querySelectorAll("[data-view]");


    botones.forEach(boton => {

        boton.addEventListener(
            "click",
            () => {

                const vista =
                    boton.dataset.view;

                if (!vista) {
                    return;
                }

                cambiarVista(vista);
            }
        );

    });
}


// =========================================================
// CAMBIAR VISTA
// =========================================================

function cambiarVista(nombreVista) {

    const vistas =
        document.querySelectorAll(".admin-view");

    const botones =
        document.querySelectorAll(".admin-nav-item");


    vistas.forEach(vista => {

        vista.classList.remove("active");

    });


    const vistaSeleccionada =
        document.querySelector(
            `#view-${nombreVista}`
        );


    if (vistaSeleccionada) {

        vistaSeleccionada.classList.add("active");

    }


    botones.forEach(boton => {

        boton.classList.remove("active");

        if (
            boton.dataset.view === nombreVista
        ) {
            boton.classList.add("active");
        }

    });


    actualizarTitulo(nombreVista);
}


// =========================================================
// TÍTULO DEL HEADER
// =========================================================

function actualizarTitulo(nombreVista) {

    const titulo =
        document.querySelector("#adminPageTitle");

    if (!titulo) {
        return;
    }


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


    titulo.textContent =
        titulos[nombreVista] || "Administrador";
}


// =========================================================
// REFRESCAR DASHBOARD
// =========================================================

function cargarDashboard() {

    const registros =
        obtenerRegistros();

    mostrarFechaActual();

    actualizarEstadisticas(registros);

    mostrarUltimosRegistros(registros);
}


// =========================================================
// ACTUALIZACIÓN AUTOMÁTICA
// =========================================================

function escucharCambiosStorage() {

    window.addEventListener(
        "storage",
        evento => {

            if (
                evento.key === STORAGE_KEY
            ) {
                cargarDashboard();
            }

        }
    );
}


// =========================================================
// INICIALIZACIÓN
// =========================================================

function iniciarDashboard() {

    configurarNavegacion();

    escucharCambiosStorage();

    cargarDashboard();

    console.log(
        "Dashboard del administrador iniciado correctamente."
    );
}


document.addEventListener(
    "DOMContentLoaded",
    iniciarDashboard
);