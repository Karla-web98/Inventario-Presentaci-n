"use strict";

import { listarContenedores } from "../api/contenedores.js";

// =====================================================
// CONFIGURACIÓN
// =====================================================

const API_CORTES = "/api/cortes";

let graficosReportes = {
    estados: null,
    patios: null,
    fechas: null
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
        registro.spot ?? registro.numeroSpot ?? registro.numero_spot ?? "",
        registro.operador ?? "",
        registro.fecha ?? obtenerFechaRegistro(registro),
        registro.hora ?? "",
        registro.observaciones ?? "",
        obtenerFotografias(registro)
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
        estados: null,
        patios: null,
        fechas: null
    };
}

function crearGraficosReportes() {
    const estadisticas = calcularEstadisticas(registrosActuales);

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

// =====================================================
// 9. DESCARGAR LIBRO EXCEL COMPLETO
// =====================================================

async function descargarLibroExcel(nombreArchivo, registros) {
    if (typeof ExcelJS === "undefined") {
        throw new Error("No se pudo cargar la biblioteca ExcelJS.");
    }

    const libro = new ExcelJS.Workbook();

    libro.creator = "Inventario Digitalizado";
    libro.subject = "Reporte de inventario y evidencias fotográficas";
    libro.title = "Reporte de inventario";
    libro.created = new Date();

    const estadisticas = calcularEstadisticas(registros);

    // Hoja 1: Resumen
    crearHojaResumen(
        libro.addWorksheet("Resumen"),
        estadisticas
    );

    // Hoja 2: Inventario
    crearHojaInventario(
        libro.addWorksheet("Inventario"),
        registros
    );

    // Hoja 3: Estadísticas
    crearHojaEstadisticas(
        libro.addWorksheet("Estadisticas"),
        estadisticas
    );

    // Hoja 4: Por patio
    crearHojaPatios(
        libro.addWorksheet("Por patio"),
        estadisticas
    );

    // Hoja 5: Todas las evidencias fotográficas
    await crearHojaEvidencias(libro, registros);

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
// 10. EXPORTAR INVENTARIO ACTUAL
// =====================================================

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

// =====================================================
// 11. EXPORTAR CORTE HISTÓRICO
// =====================================================

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
// =====================================================
// 12. CARGAR CORTES EN EL SELECTOR
// =====================================================

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

// =====================================================
// 13. ACTUALIZAR ESTADÍSTICAS DE REPORTES
// =====================================================

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

// =====================================================
// 14. INICIALIZAR EXPORTACIONES
// =====================================================

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
        })
        .catch(error => {
            console.error(
                "No fue posible cargar los datos de reportes:",
                error
            );
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

// =====================================================
// 15. INICIO
// =====================================================

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        inicializarExportaciones
    );
} else {
    inicializarExportaciones();
}