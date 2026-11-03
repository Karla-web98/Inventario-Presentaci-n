
"use strict";

// =====================================================
// CONFIGURACIÓN
// =====================================================

const EXPORTAR_INVENTARIO_KEY = "inventario_operador_registros";
const EXPORTAR_CORTES_KEY = "inventario_admin_cortes";

let graficosReportes = {
    estados: null,
    patios: null,
    fechas: null
};

// =====================================================
// 1. LECTURA Y NORMALIZACIÓN
// =====================================================

function leerDatosExportacion(clave) {
    try {
        const datos = JSON.parse(localStorage.getItem(clave) || "[]");
        return Array.isArray(datos) ? datos : [];
    } catch (error) {
        console.error(`Error al leer ${clave}:`, error);
        return [];
    }
}

function obtenerRegistrosActuales() {
    return leerDatosExportacion(EXPORTAR_INVENTARIO_KEY);
}

function obtenerFotografias(registro) {
    if (Array.isArray(registro.fotografias)) {
        return registro.fotografias;
    }

    if (Array.isArray(registro.fotos)) {
        return registro.fotos;
    }

    return [];
}

function normalizarTexto(valor) {
    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function obtenerEstado(registro) {
    return String(registro.estado || registro.status || "Sin estado").trim();
}

function obtenerFechaRegistro(registro) {
    const fecha = registro.fechaRegistro || registro.fecha || "";

    if (!fecha) return "Sin fecha";

    const fechaValida = new Date(fecha);

    if (Number.isNaN(fechaValida.getTime())) {
        return String(fecha).slice(0, 10);
    }

    return fechaValida.toISOString().slice(0, 10);
}

// =====================================================
// 2. PREPARAR DATOS PARA EXCEL
// =====================================================

function obtenerEncabezadosInventario() {
    return [
        "NUMERO DE CAJA",
        "CARRIER",
        "ESTADO",
        "UBICACION",
        "PATIO",
        "OPERADOR",
        "FECHA",
        "HORA",
        "OBSERVACIONES",
        "CANTIDAD DE FOTOGRAFIAS"
    ];
}

function prepararRegistroExcel(registro) {
    return [
        registro.numero ?? registro.contenedor ?? "",
        registro.carrier ?? "",
        obtenerEstado(registro),
        registro.ubicacion ?? "",
        registro.patio ?? "",
        registro.operador ?? "",
        registro.fecha ?? obtenerFechaRegistro(registro),
        registro.hora ?? "",
        registro.observaciones ?? "",
        obtenerFotografias(registro).length
    ];
}

// =====================================================
// 3. CALCULAR ESTADÍSTICAS
// =====================================================

function calcularEstadisticas(registros) {
    const estados = [
        "Vacío",
        "Cargado Prod",
        "Equipo vacío",
        "Dañado"
    ];

    const conteoEstados = {};
    estados.forEach(estado => {
        conteoEstados[estado] = 0;
    });

    const conteoPatios = {};
    const conteoFechas = {};

    registros.forEach(registro => {
        const estado = obtenerEstado(registro);
        const estadoNormalizado = normalizarTexto(estado);

        const estadoCoincidente = estados.find(
            item => normalizarTexto(item) === estadoNormalizado
        );

        if (estadoCoincidente) {
            conteoEstados[estadoCoincidente]++;
        }

        const patio = String(registro.patio || "Sin patio").trim();
        conteoPatios[patio] = (conteoPatios[patio] || 0) + 1;

        const fecha = obtenerFechaRegistro(registro);
        conteoFechas[fecha] = (conteoFechas[fecha] || 0) + 1;
    });

    return {
        total: registros.length,
        totalFotos: registros.reduce(
            (total, registro) => total + obtenerFotografias(registro).length,
            0
        ),
        estados: conteoEstados,
        patios: conteoPatios,
        fechas: conteoFechas
    };
}

// =====================================================
// 4. CREAR GRÁFICOS
// =====================================================

function destruirGraficos() {
    Object.values(graficosReportes).forEach(grafico => {
        if (grafico) grafico.destroy();
    });

    graficosReportes = {
        estados: null,
        patios: null,
        fechas: null
    };
}

function crearGraficosReportes() {
    const registros = obtenerRegistrosActuales();
    const estadisticas = calcularEstadisticas(registros);

    const canvasEstados = document.querySelector("#chartEstados");
    const canvasPatios = document.querySelector("#chartPatios");
    const canvasFechas = document.querySelector("#chartFechas");

    if (!canvasEstados || !canvasPatios || !canvasFechas) return;

    if (typeof Chart === "undefined") {
        console.error("No se pudo cargar Chart.js.");
        return;
    }

    destruirGraficos();

    // Gráfico de estados
    graficosReportes.estados = new Chart(canvasEstados, {
        type: "doughnut",
        data: {
            labels: Object.keys(estadisticas.estados),
            datasets: [{
                data: Object.values(estadisticas.estados),
                backgroundColor: [
                    "#16a34a",
                    "#f59e0b",
                    "#6366f1",
                    "#dc2626"
                ],
                borderWidth: 2,
                borderColor: "#ffffff"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom"
                }
            }
        }
    });

    // Gráfico de cajas por patio
    graficosReportes.patios = new Chart(canvasPatios, {
        type: "bar",
        data: {
            labels: Object.keys(estadisticas.patios),
            datasets: [{
                label: "Cajas registradas",
                data: Object.values(estadisticas.patios),
                backgroundColor: "#3b82f6",
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });

    // Gráfico de registros por fecha
    const fechasOrdenadas = Object.keys(estadisticas.fechas).sort();

    graficosReportes.fechas = new Chart(canvasFechas, {
        type: "line",
        data: {
            labels: fechasOrdenadas,
            datasets: [{
                label: "Registros",
                data: fechasOrdenadas.map(
                    fecha => estadisticas.fechas[fecha]
                ),
                borderColor: "#6366f1",
                backgroundColor: "rgba(99, 102, 241, 0.15)",
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
}

// =====================================================
// 5. GENERAR HOJAS DE EXCEL
// =====================================================

function aplicarFormatoHoja(hoja, anchos) {
    if (!hoja["!ref"]) return;

    hoja["!cols"] = anchos.map(ancho => ({ wch: ancho }));
    hoja["!rows"] = [{ hpt: 30 }];

    const rango = XLSX.utils.decode_range(hoja["!ref"]);

    for (let columna = rango.s.c; columna <= rango.e.c; columna++) {
        const celda = XLSX.utils.encode_cell({
            r: 0,
            c: columna
        });

        if (hoja[celda]) {
            hoja[celda].s = {
                font: {
                    bold: true,
                    color: { rgb: "FFFFFF" },
                    sz: 11
                },
                fill: {
                    patternType: "solid",
                    fgColor: { rgb: "2563EB" }
                },
                alignment: {
                    horizontal: "center",
                    vertical: "center",
                    wrapText: true
                }
            };
        }
    }

    for (let fila = 1; fila <= rango.e.r; fila++) {
        for (let columna = rango.s.c; columna <= rango.e.c; columna++) {
            const celda = XLSX.utils.encode_cell({
                r: fila,
                c: columna
            });

            if (hoja[celda]) {
                hoja[celda].s = {
                    font: {
                        color: { rgb: "334155" },
                        sz: 10
                    },
                    fill: {
                        patternType: "solid",
                        fgColor: {
                            rgb: fila % 2 === 0 ? "EFF6FF" : "FFFFFF"
                        }
                    },
                    alignment: {
                        vertical: "center",
                        wrapText: true
                    },
                    border: {
                        bottom: {
                            style: "thin",
                            color: { rgb: "E2E8F0" }
                        }
                    }
                };
            }
        }
    }

    hoja["!autofilter"] = {
        ref: XLSX.utils.encode_range(rango)
    };
}

function crearHojaResumen(estadisticas) {
    const filas = [
        ["RESUMEN DEL INVENTARIO", "CANTIDAD"],
        ["Total de cajas", estadisticas.total],
        ["Total de fotografías", estadisticas.totalFotos],
        ["Vacío", estadisticas.estados["Vacío"]],
        ["Cargado Prod", estadisticas.estados["Cargado Prod"]],
        ["Equipo vacío", estadisticas.estados["Equipo vacío"]],
        ["Dañado", estadisticas.estados["Dañado"]]
    ];

    const hoja = XLSX.utils.aoa_to_sheet(filas);
    aplicarFormatoHoja(hoja, [30, 20]);

    return hoja;
}

function crearHojaEstadisticas(estadisticas) {
    const filas = [
        ["ESTADO", "CANTIDAD"],
        ...Object.entries(estadisticas.estados)
    ];

    const hoja = XLSX.utils.aoa_to_sheet(filas);
    aplicarFormatoHoja(hoja, [25, 18]);

    return hoja;
}

function crearHojaPatios(estadisticas) {
    const filas = [
        ["PATIO", "CANTIDAD DE CAJAS"],
        ...Object.entries(estadisticas.patios)
    ];

    const hoja = XLSX.utils.aoa_to_sheet(filas);
    aplicarFormatoHoja(hoja, [25, 22]);

    return hoja;
}

function descargarLibroExcel(nombreArchivo, registros) {
    if (typeof XLSX === "undefined") {
        alert("No se pudo cargar la librería de Excel. Verifica tu conexión a internet.");
        return;
    }

    const estadisticas = calcularEstadisticas(registros);
    const libro = XLSX.utils.book_new();

    // Hoja 1: Resumen
    XLSX.utils.book_append_sheet(
        libro,
        crearHojaResumen(estadisticas),
        "Resumen"
    );

    // Hoja 2: Inventario completo
    const filasInventario = [
        obtenerEncabezadosInventario(),
        ...registros.map(prepararRegistroExcel)
    ];

    const hojaInventario = XLSX.utils.aoa_to_sheet(filasInventario);

    aplicarFormatoHoja(
        hojaInventario,
        [22, 18, 18, 22, 18, 22, 16, 14, 35, 24]
    );

    XLSX.utils.book_append_sheet(
        libro,
        hojaInventario,
        "Inventario"
    );

    // Hoja 3: Estadísticas por estado
    XLSX.utils.book_append_sheet(
        libro,
        crearHojaEstadisticas(estadisticas),
        "Estadisticas"
    );

    // Hoja 4: Cajas por patio
    XLSX.utils.book_append_sheet(
        libro,
        crearHojaPatios(estadisticas),
        "Por patio"
    );

    XLSX.writeFile(libro, nombreArchivo, {
        compression: true
    });
}

// =====================================================
// 6. EXPORTAR INVENTARIO ACTUAL
// =====================================================

function exportarInventarioActual() {
    const registros = obtenerRegistrosActuales();

    if (registros.length === 0) {
        alert("No hay registros para exportar.");
        return;
    }

    const fecha = new Date().toISOString().slice(0, 10);

    descargarLibroExcel(
        `inventario_actual_${fecha}.xlsx`,
        registros
    );
}

// =====================================================
// 7. EXPORTAR CORTE HISTÓRICO
// =====================================================

function exportarCorteHistorico(idCorte) {
    const cortes = leerDatosExportacion(EXPORTAR_CORTES_KEY);

    const corte = cortes.find(
        item => String(item.id) === String(idCorte)
    );

    if (!corte) {
        alert("No se encontró el corte histórico seleccionado.");
        return;
    }

    const registros = Array.isArray(corte.registros)
        ? corte.registros
        : [];

    const fecha = String(corte.fecha || "sin_fecha")
        .replace(/[^\w-]/g, "_");

    descargarLibroExcel(
        `inventario_historico_${fecha}.xlsx`,
        registros
    );
}

// =====================================================
// 8. CONSTRUIR INTERFAZ DE REPORTES
// =====================================================

function prepararInterfazExportacion() {
    const seccion = document.querySelector("#view-reportes");

    if (!seccion) return;

    seccion.innerHTML = `
        <div class="admin-page-heading">
            <div>
                <h2>Reportes y estadísticas</h2>
                <p>
                    Consulta el comportamiento del inventario
                    y descarga la información en Excel.
                </p>
            </div>
        </div>

        <div class="report-summary-grid">
            <article class="report-summary-card">
                <span>Total de cajas</span>
                <strong id="reportTotal">0</strong>
            </article>

            <article class="report-summary-card">
                <span>Fotografías</span>
                <strong id="reportFotos">0</strong>
            </article>
        </div>

        <div class="admin-section-header">
            <div>
                <h2>Estadísticas del inventario</h2>
                <p>Distribución de cajas según su estado y ubicación.</p>
            </div>
        </div>

        <div class="reports-charts-grid">
            <article class="report-chart-card">
                <h3>Cajas por estado</h3>
                <div class="report-chart-container">
                    <canvas id="chartEstados"></canvas>
                </div>
            </article>

            <article class="report-chart-card">
                <h3>Cajas por patio</h3>
                <div class="report-chart-container">
                    <canvas id="chartPatios"></canvas>
                </div>
            </article>

            <article class="report-chart-card report-chart-wide">
                <h3>Registros por fecha</h3>
                <div class="report-chart-container">
                    <canvas id="chartFechas"></canvas>
                </div>
            </article>
        </div>

        <div class="admin-section-header">
            <div>
                <h2>Exportar información</h2>
                <p>Descarga el inventario y sus estadísticas en un archivo Excel.</p>
            </div>
        </div>

        <div class="export-section">
            <article class="export-card">
                <div class="export-card-icon">📦</div>

                <div class="export-card-content">
                    <h3>Inventario actual</h3>
                    <p>
                        Incluye resumen, inventario completo,
                        estadísticas por estado y cajas por patio.
                    </p>

                    <button
                        type="button"
                        id="exportCurrentInventory"
                        class="btn-export"
                    >
                        Descargar Excel
                    </button>
                </div>
            </article>

            <article class="export-card">
                <div class="export-card-icon">📅</div>

                <div class="export-card-content">
                    <h3>Histórico de inventario</h3>
                    <p>
                        Selecciona un corte histórico para
                        descargar los registros que contenía.
                    </p>

                    <div class="export-history-controls">
                        <select id="exportHistorySelect">
                            <option value="">
                                Selecciona un corte histórico
                            </option>
                        </select>

                        <button
                            type="button"
                            id="exportHistoryButton"
                            class="btn-export"
                            disabled
                        >
                            Descargar Excel
                        </button>
                    </div>
                </div>
            </article>
        </div>

        <p class="export-note">
            El archivo Excel incluye la información y los datos
            utilizados para generar los gráficos. Las fotografías
            no se insertan en el archivo.
        </p>
    `;

    document.querySelector("#exportCurrentInventory")
        ?.addEventListener("click", exportarInventarioActual);

    const selector = document.querySelector("#exportHistorySelect");
    const boton = document.querySelector("#exportHistoryButton");

    selector?.addEventListener("change", () => {
        if (boton) boton.disabled = !selector.value;
    });

    boton?.addEventListener("click", () => {
        if (selector?.value) {
            exportarCorteHistorico(selector.value);
        }
    });
}

// =====================================================
// 9. ACTUALIZAR REPORTES
// =====================================================

function actualizarReportes() {
    const registros = obtenerRegistrosActuales();
    const estadisticas = calcularEstadisticas(registros);

    const total = document.querySelector("#reportTotal");
    const fotos = document.querySelector("#reportFotos");

    if (total) total.textContent = estadisticas.total;
    if (fotos) fotos.textContent = estadisticas.totalFotos;

    crearGraficosReportes();
    cargarCortesExportables();
}

function cargarCortesExportables() {
    const selector = document.querySelector("#exportHistorySelect");
    const boton = document.querySelector("#exportHistoryButton");

    if (!selector || !boton) return;

    const valorAnterior = selector.value;
    const cortes = leerDatosExportacion(EXPORTAR_CORTES_KEY);

    selector.innerHTML = `
        <option value="">Selecciona un corte histórico</option>
    `;

    cortes.forEach(corte => {
        const opcion = document.createElement("option");

        opcion.value = corte.id;
        opcion.textContent = corte.fecha || "Corte sin fecha";

        selector.appendChild(opcion);
    });

    if (cortes.some(corte => String(corte.id) === valorAnterior)) {
        selector.value = valorAnterior;
    }

    boton.disabled = !selector.value;
}

// =====================================================
// 10. INICIALIZACIÓN
// =====================================================

function iniciarExportacion() {
    prepararInterfazExportacion();
    actualizarReportes();

    window.addEventListener("storage", event => {
        if (
            event.key === EXPORTAR_INVENTARIO_KEY ||
            event.key === EXPORTAR_CORTES_KEY
        ) {
            actualizarReportes();
        }
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarExportacion);
} else {
    iniciarExportacion();
}