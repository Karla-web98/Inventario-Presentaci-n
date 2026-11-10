"use strict";

import { listarContenedores } from "../api/contenedores.js";

// =====================================================
// CONFIGURACIÓN
// =====================================================

const API_CORTES = "/api/cortes";

let graficosReportes = {
    scac: null,
    estados: null,
    scacStatus: null,
    antiguedadScac: null
};

let registrosActuales = [];
let cortesExportables = [];

// =====================================================
// 1. CONSULTAR DATOS DEL SERVIDOR
// =====================================================

async function obtenerRegistrosActuales() {
    return await listarContenedores();
}

async function obtenerCortesHistoricos() {
    const response = await fetch(API_CORTES);
    const resultado = await response.json();

    if (!response.ok || resultado.ok === false) {
        throw new Error(
            resultado.error || "No fue posible consultar los cortes históricos."
        );
    }

    return Array.isArray(resultado.cortes)
        ? resultado.cortes
        : [];
}

function obtenerFotografias(registro) {
    const fotografias = Array.isArray(registro.fotografias)
        ? registro.fotografias
        : Array.isArray(registro.fotos)
            ? registro.fotos
            : [];

    const tieneSello = Boolean(
        registro.fotografiaSello ||
        registro.fotoSello
    );

    return fotografias.length + (tieneSello ? 1 : 0);
}

function normalizarTexto(valor) {
    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function obtenerEstado(registro) {
    return String(
        registro.estado ||
        registro.status ||
        "Sin estado"
    ).trim();
}

function obtenerFechaRegistro(registro) {
    const fecha = registro.fechaRegistro || registro.fecha || "";

    if (!fecha) return "Sin fecha";

    const fechaValida = new Date(fecha);

    if (Number.isNaN(fechaValida.getTime())) {
        return String(fecha).slice(0, 10);
    }

    // Si ya viene como fecha YYYY-MM-DD, conservarla.
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(fecha))) {
        return String(fecha);
    }

    return fechaValida.toISOString().slice(0, 10);
}

// =====================================================
// DATOS PARA ANÁLISIS POR SCAC
// =====================================================

function obtenerScac(registro) {
    const valor =
        registro.scac ??
        registro.SCAC ??
        registro.codigoScac ??
        registro.codigo_scac ??
        "";

    const scac = String(valor).trim();

    return /^\d{4}$/.test(scac)
        ? scac
        : "Pendiente de asignación";
}

function obtenerFechaParaAntiguedad(registro) {
    const valor =
        registro.fechaRegistro ||
        registro.fecha_registro ||
        registro.fecha ||
        registro.createdAt ||
        "";

    if (!valor) return null;

    // Evitar diferencias de día por interpretación UTC.
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(valor))) {
        const fecha = new Date(`${valor}T00:00:00`);
        return Number.isNaN(fecha.getTime()) ? null : fecha;
    }

    const fecha = new Date(valor);

    return Number.isNaN(fecha.getTime())
        ? null
        : fecha;
}

function obtenerRangoAntiguedad(registro) {
    const fecha = obtenerFechaParaAntiguedad(registro);

    if (!fecha) return "Sin fecha";

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    fecha.setHours(0, 0, 0, 0);

    const dias = Math.max(
        0,
        Math.floor((hoy - fecha) / 86400000)
    );

    if (dias <= 7) return "0–7 días";
    if (dias <= 15) return "8–15 días";
    if (dias <= 30) return "16–30 días";

    return "Más de 30 días";
}

function obtenerEstadosReporte() {
    return [
        "Vacío",
        "Cargado Prod",
        "Equipo vacío",
        "Dañado"
    ];
}

function obtenerEstadoNormalizado(registro) {
    const estado = normalizarTexto(obtenerEstado(registro));

    return obtenerEstadosReporte().find(
        elemento => normalizarTexto(elemento) === estado
    ) || "Sin estado";
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
        "SPOT",
        "OPERADOR",
        "FECHA",
        "HORA",
        "OBSERVACIONES"
    ];
}

function prepararRegistroExcel(registro) {
    return [
        registro.numero ?? registro.contenedor ?? "",
        registro.carrier ?? "",
        obtenerEstado(registro),
        registro.ubicacion ?? "",
        registro.patio ?? "",
        registro.spot ?? registro.numeroSpot ?? registro.numero_spot ?? "",
        registro.operador ?? "",
        registro.fecha ?? obtenerFechaRegistro(registro),
        registro.hora ?? "",
        registro.observaciones ?? ""
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
        const estadoNormalizado = normalizarTexto(
            obtenerEstado(registro)
        );

        const estadoCoincidente = estados.find(
            estado => normalizarTexto(estado) === estadoNormalizado
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
            (total, registro) => total + obtenerFotografias(registro),
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
        scac: null,
        estados: null,
        scacStatus: null,
        antiguedadScac: null
    };
}

function obtenerOpcionesEjes() {
    return {
        responsive: true,
        maintainAspectRatio: false,

        plugins: {
            legend: {
                position: "bottom"
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
    };
}

function obtenerScacsOrdenados() {
    const scacs = [
        ...new Set(registrosActuales.map(obtenerScac))
    ];

    return scacs.sort((a, b) => {
        if (a === "Pendiente de asignación") return 1;
        if (b === "Pendiente de asignación") return -1;

        return a.localeCompare(b);
    });
}

function crearGraficoTotalScac(scacs) {
    const canvas = document.querySelector("#chartScac");

    if (!canvas) return;

    const cantidades = scacs.map(scac =>
        registrosActuales.filter(
            registro => obtenerScac(registro) === scac
        ).length
    );

    graficosReportes.scac = new Chart(canvas, {
        type: "bar",

        data: {
            labels: scacs,

            datasets: [{
                label: "Total de cajas",
                data: cantidades,

                backgroundColor: "#2563eb",
                borderRadius: 6
            }]
        },

        options: {
            ...obtenerOpcionesEjes(),

            indexAxis: "y",

            plugins: {
                legend: {
                    display: false
                }
            },

            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
}

function crearGraficoEstados() {
    const canvas = document.querySelector("#chartEstados");

    if (!canvas) return;

    const estados = obtenerEstadosReporte();

    const cantidades = estados.map(estado =>
        registrosActuales.filter(
            registro =>
                obtenerEstadoNormalizado(registro) === estado
        ).length
    );

    graficosReportes.estados = new Chart(canvas, {
        type: "doughnut",

        data: {
            labels: estados,

            datasets: [{
                data: cantidades,

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
}

function crearGraficoScacStatus(scacs) {
    const canvas = document.querySelector("#chartScacStatus");

    if (!canvas) return;

    const estados = obtenerEstadosReporte();

    const colores = [
        "#16a34a",
        "#f59e0b",
        "#6366f1",
        "#dc2626"
    ];

    const datasets = estados.map((estado, indice) => ({
        label: estado,

        data: scacs.map(scac =>
            registrosActuales.filter(registro =>
                obtenerScac(registro) === scac &&
                obtenerEstadoNormalizado(registro) === estado
            ).length
        ),

        backgroundColor: colores[indice],
        borderRadius: 4
    }));

    graficosReportes.scacStatus = new Chart(canvas, {
        type: "bar",

        data: {
            labels: scacs,
            datasets
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            plugins: {
                legend: {
                    position: "bottom"
                }
            },

            scales: {
                x: {
                    stacked: true
                },

                y: {
                    stacked: true,
                    beginAtZero: true,

                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
}

function crearGraficoAntiguedadScac(scacs) {
    const canvas = document.querySelector("#chartAntiguedadScac");

    if (!canvas) return;

    const rangos = [
        "0–7 días",
        "8–15 días",
        "16–30 días",
        "Más de 30 días",
        "Sin fecha"
    ];

    const colores = [
        "#16a34a",
        "#3b82f6",
        "#f59e0b",
        "#dc2626",
        "#94a3b8"
    ];

    const datasets = rangos.map((rango, indice) => ({
        label: rango,

        data: scacs.map(scac =>
            registrosActuales.filter(registro =>
                obtenerScac(registro) === scac &&
                obtenerRangoAntiguedad(registro) === rango
            ).length
        ),

        backgroundColor: colores[indice],
        borderRadius: 4
    }));

    graficosReportes.antiguedadScac = new Chart(canvas, {
        type: "bar",

        data: {
            labels: scacs,
            datasets
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            plugins: {
                legend: {
                    position: "bottom"
                }
            },

            scales: {
                x: {
                    stacked: true
                },

                y: {
                    stacked: true,
                    beginAtZero: true,

                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
}

function crearGraficosReportes() {
    if (typeof Chart === "undefined") {
        console.error("No se pudo cargar Chart.js.");
        return;
    }

    const canvasScac = document.querySelector("#chartScac");
    const canvasEstados = document.querySelector("#chartEstados");
    const canvasScacStatus = document.querySelector("#chartScacStatus");
    const canvasAntiguedad = document.querySelector("#chartAntiguedadScac");

    if (
        !canvasScac ||
        !canvasEstados ||
        !canvasScacStatus ||
        !canvasAntiguedad
    ) {
        return;
    }

    destruirGraficos();

    const scacs = obtenerScacsOrdenados();

    crearGraficoTotalScac(scacs);
    crearGraficoEstados();
    crearGraficoScacStatus(scacs);
    crearGraficoAntiguedadScac(scacs);
}

// =====================================================
// 5. GENERAR HOJAS DE EXCEL
// =====================================================

function aplicarFormatoExcel(hoja, anchos) {
    hoja.columns = anchos.map(width => ({ width }));

    const encabezado = hoja.getRow(1);
    encabezado.height = 30;

    encabezado.eachCell(celda => {
        celda.font = {
            bold: true,
            color: { argb: "FFFFFFFF" },
            size: 11
        };

        celda.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF2563EB" }
        };

        celda.alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true
        };
    });

    for (let fila = 2; fila <= hoja.rowCount; fila++) {
        const row = hoja.getRow(fila);

        row.eachCell(celda => {
            celda.font = {
                color: { argb: "FF334155" },
                size: 10
            };

            celda.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: {
                    argb: fila % 2 === 0 ? "FFEFF6FF" : "FFFFFFFF"
                }
            };

            celda.alignment = {
                vertical: "middle",
                wrapText: true
            };

            celda.border = {
                bottom: {
                    style: "thin",
                    color: { argb: "FFE2E8F0" }
                }
            };
        });
    }

    if (hoja.rowCount > 1) {
        hoja.autoFilter = {
            from: "A1",
            to: `${hoja.getColumn(hoja.columnCount).letter}${hoja.rowCount}`
        };
    }

    hoja.views = [{ state: "frozen", ySplit: 1 }];
}

function crearHojaResumen(hoja, estadisticas) {
    hoja.addRows([
        ["RESUMEN DEL INVENTARIO", "CANTIDAD"],
        ["Total de cajas", estadisticas.total],
        ["Total de fotografías", estadisticas.totalFotos],
        ["Vacío", estadisticas.estados["Vacío"]],
        ["Cargado Prod", estadisticas.estados["Cargado Prod"]],
        ["Equipo vacío", estadisticas.estados["Equipo vacío"]],
        ["Dañado", estadisticas.estados["Dañado"]]
    ]);

    aplicarFormatoExcel(hoja, [30, 20]);
}

function crearHojaInventario(hoja, registros) {
    hoja.addRow(obtenerEncabezadosInventario());

    registros.forEach(registro => {
        hoja.addRow(prepararRegistroExcel(registro));
    });

    aplicarFormatoExcel(
        hoja,
        [22, 18, 18, 22, 18, 14, 22, 16, 14, 35, 24]
    );
}

function crearHojaEstadisticas(hoja, estadisticas) {
    hoja.addRow(["ESTADO", "CANTIDAD"]);

    Object.entries(estadisticas.estados).forEach(([estado, cantidad]) => {
        hoja.addRow([estado, cantidad]);
    });

    aplicarFormatoExcel(hoja, [25, 18]);
}

function crearHojaPatios(hoja, estadisticas) {
    hoja.addRow(["PATIO", "CANTIDAD DE CAJAS"]);

    Object.entries(estadisticas.patios).forEach(([patio, cantidad]) => {
        hoja.addRow([patio, cantidad]);
    });

    aplicarFormatoExcel(hoja, [25, 22]);
}

// =====================================================
// 6. PREPARAR TODAS LAS EVIDENCIAS
// =====================================================

function obtenerEvidencias(registros) {
    const evidencias = [];

    registros.forEach(registro => {
        const numero = registro.numero || registro.contenedor || "Sin número";

        const fotografias = Array.isArray(registro.fotografias)
            ? registro.fotografias
            : Array.isArray(registro.fotos)
                ? registro.fotos
                : [];

        fotografias.forEach((foto, indice) => {
            evidencias.push({
                numero,
                tipo: `Foto del contenedor ${indice + 1}`,
                nombre: foto.nombre || `Fotografía ${indice + 1}`,
                url: foto.data || foto.url || ""
            });
        });

        const sello = registro.fotografiaSello || registro.fotoSello;

        if (sello) {
            evidencias.push({
                numero,
                tipo: "Foto del sello",
                nombre: sello.nombre || "Fotografía del sello",
                url: sello.data || sello.url || ""
            });
        }

        if (fotografias.length === 0 && !sello) {
            evidencias.push({
                numero,
                tipo: "Sin fotografías",
                nombre: "Sin evidencias registradas",
                url: ""
            });
        }
    });

    return evidencias;
}

// =====================================================
// 7. RECUPERAR Y OPTIMIZAR IMÁGENES
// =====================================================

async function prepararImagenExcel(url) {
    let response;

    if (url.startsWith("data:image/")) {
        response = await fetch(url);
    } else {
        const proxy = `/api/fotografias/proxy?url=${encodeURIComponent(url)}`;
        response = await fetch(proxy);
    }

    if (!response.ok) {
        throw new Error("No se pudo descargar la fotografía.");
    }

    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    // Reducir tamaño para evitar que el Excel sea excesivamente pesado.
    const maxDimension = 1000;

    const escala = Math.min(
        1,
        maxDimension / Math.max(bitmap.width, bitmap.height)
    );

    const canvas = document.createElement("canvas");

    canvas.width = Math.max(1, Math.round(bitmap.width * escala));
    canvas.height = Math.max(1, Math.round(bitmap.height * escala));

    const contexto = canvas.getContext("2d");

    if (!contexto) {
        bitmap.close();
        throw new Error("No fue posible procesar la fotografía.");
    }

    contexto.drawImage(
        bitmap,
        0,
        0,
        canvas.width,
        canvas.height
    );

    bitmap.close();

    return canvas.toDataURL("image/jpeg", 0.72);
}

// =====================================================
// 8. CREAR HOJA DE EVIDENCIAS FOTOGRÁFICAS
// =====================================================

async function crearHojaEvidencias(libro, registros) {
    const hoja = libro.addWorksheet("Evidencias fotográficas");

    hoja.columns = [
        { header: "NUMERO DE CONTENEDOR", key: "numero", width: 25 },
        { header: "TIPO DE EVIDENCIA", key: "tipo", width: 28 },
        { header: "NOMBRE DEL ARCHIVO", key: "nombre", width: 32 },
        { header: "FOTOGRAFÍA", key: "imagen", width: 25 }
    ];

    const encabezado = hoja.getRow(1);

    encabezado.height = 30;

    encabezado.eachCell(celda => {
        celda.font = {
            bold: true,
            color: { argb: "FFFFFFFF" },
            size: 11
        };

        celda.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF2563EB" }
        };

        celda.alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true
        };
    });

    const evidencias = obtenerEvidencias(registros);

    // Primero crear las filas para mantener el orden de los registros.
    evidencias.forEach(evidencia => {
        const fila = hoja.addRow({
            numero: evidencia.numero,
            tipo: evidencia.tipo,
            nombre: evidencia.nombre,
            imagen: evidencia.url ? "" : "Sin imagen"
        });

        fila.height = 75;

        fila.eachCell(celda => {
            celda.alignment = {
                vertical: "middle",
                wrapText: true
            };

            celda.border = {
                bottom: {
                    style: "thin",
                    color: { argb: "FFE2E8F0" }
                }
            };

            celda.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: {
                    argb: fila.number % 2 === 0
                        ? "FFEFF6FF"
                        : "FFFFFFFF"
                }
            };
        });
    });
    // Recuperar fotografías en grupos para controlar el consumo de memoria.
    const evidenciasConImagen = evidencias
        .map((evidencia, indice) => ({
            ...evidencia,
            fila: indice + 2
        }))
        .filter(evidencia => evidencia.url);
    const tamanoLote = 6;
    for (let inicio = 0; inicio < evidenciasConImagen.length; inicio += tamanoLote) {
        const lote = evidenciasConImagen.slice(
            inicio,
            inicio + tamanoLote
        );
        const imagenes = await Promise.all(
            lote.map(async evidencia => {
                try {
                    return {
                        evidencia,
                        imagen: await prepararImagenExcel(evidencia.url)
                    };
                } catch (error) {
                    throw new Error(
                        `Contenedor ${evidencia.numero}, archivo ${evidencia.nombre}: ${error.message}`
                    );
                }
            })
        );
        imagenes.forEach(({ evidencia, imagen }) => {
            const imagenId = libro.addImage({
                base64: imagen,
                extension: "jpeg"
            });
            hoja.addImage(imagenId, {
                tl: {
                    col: 3,
                    row: evidencia.fila - 1
                },
                ext: {
                    width: 150,
                    height: 90
                }
            });
        });
    }
    hoja.views = [{ state: "frozen", ySplit: 1 }];
    hoja.autoFilter = {
        from: "A1",
        to: `D${hoja.rowCount}`
    };
}

// 9. DESCARGA EL LIBRO EXCEL COMPLETO

async function descargarLibroExcel(nombreArchivo, registros) {
    if (typeof ExcelJS === "undefined") {
        throw new Error("No se pudo cargar la biblioteca ExcelJS.");
    }

    const libro = new ExcelJS.Workbook();

    libro.creator = "Inventario Digitalizado";
    libro.subject = "Reporte de inventario";
    libro.title = "Inventario";
    libro.created = new Date();

    // Única hoja del archivo.
    const hoja = libro.addWorksheet("Inventario");

    crearHojaInventario(hoja, registros);

    const contenido = await libro.xlsx.writeBuffer();

    const blob = new Blob(
        [contenido],
        {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }
    );

    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");

    enlace.href = url;
    enlace.download = nombreArchivo;

    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();

    URL.revokeObjectURL(url);
}


// =====================================================
// EXPORTAR GRÁFICAS INDIVIDUALES A EXCEL
// =====================================================

async function exportarGraficaExcel(tipo, grafico, boton, nombreArchivo) {
    const textoOriginal = boton?.textContent || "Exportar a Excel";

    try {
        if (!grafico || !grafico.data) {
            throw new Error("La gráfica todavía no está disponible.");
        }

        const labels = grafico.data.labels || [];

        const datasets = grafico.data.datasets.map((dataset, indice) => ({
            label: dataset.label || `Serie ${indice + 1}`,
            data: Array.from(dataset.data || [])
        }));

        if (!labels.length || !datasets.length) {
            throw new Error("La gráfica no contiene datos para exportar.");
        }

        if (boton) {
            boton.disabled = true;
            boton.textContent = "Preparando Excel...";
        }

        const response = await fetch("/api/reportes/exportar-grafica", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                tipo,
                labels,
                datasets
            })
        });

        if (!response.ok) {
            let resultado = {};

            try {
                resultado = await response.json();
            } catch (error) {
                // La respuesta no contiene JSON.
            }

            throw new Error(
                resultado.error || "No fue posible generar el archivo Excel."
            );
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = nombreArchivo;

        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1000);

    } catch (error) {
        console.error("Error al exportar gráfica:", error);
        alert(error.message);

    } finally {
        if (boton) {
            boton.disabled = false;
            boton.textContent = textoOriginal;
        }
    }
}

// 10. EXPORTAR INVENTARIO ACTUAL
async function exportarInventarioActual() {
    const boton = document.querySelector("#exportCurrentInventory");
    try {
        if (boton) {
            boton.disabled = true;
            boton.textContent = "Preparando Excel...";
        }
        const registros = await obtenerRegistrosActuales();
        if (registros.length === 0) {
            alert("No hay registros para exportar.");
            return;
        }
        const fecha = new Date().toISOString().slice(0, 10);
        await descargarLibroExcel(
            `inventario_actual_${fecha}.xlsx`,
            registros
        );
    } catch (error) {
        console.error("Error al exportar inventario:", error);
        alert(
            "No fue posible completar la exportación.\n\n" +
            error.message
        );
    } finally {
        if (boton) {
            boton.disabled = false;
            boton.textContent = "Descargar Excel";
        }
    }
}

// 11. EXPORTAR CORTE HISTÓRICO
async function exportarCorteHistorico(idCorte) {
    const boton = document.querySelector("#exportHistoryButton");
    try {
        if (boton) {
            boton.disabled = true;
            boton.textContent = "Preparando Excel...";
        }
        const cortes = await obtenerCortesHistoricos();
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
        await descargarLibroExcel(
            `inventario_historico_${fecha}.xlsx`,
            registros
        );
    } catch (error) {
        console.error("Error al exportar corte histórico:", error);
        alert(
            "No fue posible completar la exportación.\n\n" +
            error.message
        );
    } finally {
        if (boton) {
            boton.disabled = !document.querySelector(
                "#exportHistorySelect"
            )?.value;
            boton.textContent = "Descargar Excel";
        }
    }
}

// 12. CARGAR CORTES EN EL SELECTOR
async function cargarSelectorCortes() {
    const selector = document.querySelector("#exportHistorySelect");
    const boton = document.querySelector("#exportHistoryButton");
    if (!selector || !boton) return;
    selector.innerHTML = `
        <option value="">Cargando cortes históricos...</option>
    `;
    boton.disabled = true;
    try {
        cortesExportables = await obtenerCortesHistoricos();
        selector.innerHTML = "";
        if (cortesExportables.length === 0) {
            selector.innerHTML = `
                <option value="">No hay cortes históricos disponibles</option>
            `;
            return;
        }
        selector.innerHTML = `
            <option value="">Selecciona un corte histórico</option>
        `;
        cortesExportables.forEach((corte, indice) => {
            const opcion = document.createElement("option");
            opcion.value = corte.id;
            const fecha = corte.fecha ||
                corte.fecha_hora ||
                corte.fechaHora ||
                `Corte ${indice + 1}`;
            opcion.textContent = `${fecha} — ${
                Array.isArray(corte.registros)
                    ? corte.registros.length
                    : 0
            } contenedores`;
            selector.appendChild(opcion);
        });
    } catch (error) {
        console.error("Error al cargar cortes:", error);
        selector.innerHTML = `
            <option value="">Error al consultar los cortes</option>
        `;
    }
    boton.disabled = !selector.value;
}
// 13. ACTUALIZAR ESTADÍSTICAS DE REPORTES
function actualizarResumenReportes() {
    const estadisticas = calcularEstadisticas(registrosActuales);
    const total = document.querySelector("#reportTotal");
    const totalFotos = document.querySelector("#reportTotalFotos");
    if (total) {
        total.textContent = estadisticas.total;
    }
    if (totalFotos) {
        totalFotos.textContent = estadisticas.totalFotos;
    }
}
// 14. INICIALIZAR EXPORTACIONES
function inicializarExportaciones() {
    const botonInventario = document.querySelector(
        "#exportCurrentInventory"
    );
    const selectorHistorico = document.querySelector(
        "#exportHistorySelect"
    );
    const botonHistorico = document.querySelector(
        "#exportHistoryButton"
    );
    if (botonInventario) {
        botonInventario.addEventListener(
            "click",
            exportarInventarioActual
        );
    }
    if (selectorHistorico && botonHistorico) {
        selectorHistorico.addEventListener("change", () => {
            botonHistorico.disabled = !selectorHistorico.value;
        });
        botonHistorico.addEventListener("click", () => {
            const idCorte = selectorHistorico.value;
            if (!idCorte) {
                alert("Selecciona un corte histórico.");
                return;
            }
            exportarCorteHistorico(idCorte);
        });
    }
    
    // Conectar botones de exportación de gráficas.
    const botonesGraficas = [
        {
            id: "#exportChartScac",
            tipo: "scac",
            obtenerGrafica: () => graficosReportes.scac,
            nombre: "Reporte_SCAC.xlsx"
        },
        {
            id: "#exportChartEstados",
            tipo: "estados",
            obtenerGrafica: () => graficosReportes.estados,
            nombre: "Reporte_Estados.xlsx"
        },
        {
            id: "#exportChartScacStatus",
            tipo: "scacStatus",
            obtenerGrafica: () => graficosReportes.scacStatus,
            nombre: "Reporte_SCAC_Status.xlsx"
        },
        {
            id: "#exportChartAntiguedadScac",
            tipo: "antiguedadScac",
            obtenerGrafica: () => graficosReportes.antiguedadScac,
            nombre: "Reporte_Antiguedad_SCAC.xlsx"
        }
    ];

    botonesGraficas.forEach(configuracion => {
        const boton = document.querySelector(configuracion.id);

        if (!boton) return;

        boton.addEventListener("click", () => {
            exportarGraficaExcel(
                configuracion.tipo,
                configuracion.obtenerGrafica(),
                boton,
                configuracion.nombre
            );
        });
    });

    // Cargar datos del servidor.
        Promise.all([
        obtenerRegistrosActuales(),
        cargarSelectorCortes()
    ])
        .then(([registros]) => {
            registrosActuales = Array.isArray(registros)
                ? registros
                : [];
            actualizarResumenReportes();
            if (
                document.querySelector("#view-reportes")?.classList.contains("active")
            ) {
                crearGraficosReportes();
            }
        })
        .catch(error => {
            console.error(
                "No fue posible cargar los datos de reportes:",
                error
            );
        });
    // Mantener los reportes actualizados cuando cambia el inventario.
    window.addEventListener("inventario:actualizado", async () => {
        try {
            const registros = await obtenerRegistrosActuales();
            registrosActuales = Array.isArray(registros)
                ? registros
                : [];
            actualizarResumenReportes();
            if (
                document.querySelector("#view-reportes")?.classList.contains("active")
            ) {
                crearGraficosReportes();
            }
        } catch (error) {
            console.error(
                "No fue posible actualizar las gráficas:",
                error
            );
        }
    });
    // Crear gráficos cuando se abra la sección Reportes.
    document.querySelectorAll('[data-view="reportes"]').forEach(boton => {
        boton.addEventListener("click", () => {
            setTimeout(() => {
                crearGraficosReportes();
            }, 150);
        });
    });
}

// 15. INICIO
if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        inicializarExportaciones
    );
} else {
    inicializarExportaciones();
}