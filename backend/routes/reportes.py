
from io import BytesIO
from math import isfinite

import xlsxwriter

from flask import Blueprint, jsonify, request, send_file


reportes_bp = Blueprint("reportes", __name__)


# ============================================================
# CONFIGURACIÓN DE LAS GRÁFICAS
# ============================================================

CONFIGURACION_GRAFICAS = {
    "scac": {
        "nombre": "Reporte_SCAC.xlsx",
        "titulo": "Total de contenedores por SCAC",
        "tipo": "bar",
        "bar_dir": "bar",
        "subtipo": None,
        "eje_categoria": "SCAC",
        "eje_valor": "Cantidad de contenedores",
    },
    "estados": {
        "nombre": "Reporte_Estados.xlsx",
        "titulo": "Distribución por estado",
        "tipo": "doughnut",
        "bar_dir": None,
        "subtipo": None,
        "eje_categoria": "",
        "eje_valor": "",
    },
    "scacStatus": {
        "nombre": "Reporte_SCAC_Status.xlsx",
        "titulo": "Contenedores por SCAC y estado",
        "tipo": "bar",
        "bar_dir": "col",
        "subtipo": "stacked",
        "eje_categoria": "SCAC",
        "eje_valor": "Cantidad de contenedores",
    },
    "antiguedadScac": {
        "nombre": "Reporte_Antiguedad_SCAC.xlsx",
        "titulo": "Antigüedad de contenedores por SCAC",
        "tipo": "bar",
        "bar_dir": "col",
        "subtipo": "stacked",
        "eje_categoria": "SCAC",
        "eje_valor": "Cantidad de contenedores",
    },
}


# ============================================================
# EXPORTACIÓN INDIVIDUAL DE GRÁFICAS A EXCEL
# ============================================================

@reportes_bp.route(
    "/api/reportes/exportar-grafica",
    methods=["POST"]
)
def exportar_grafica():

    datos = request.get_json(silent=True) or {}

    tipo = datos.get("tipo")
    configuracion = CONFIGURACION_GRAFICAS.get(tipo)

    # --------------------------------------------------------
    # VALIDAR TIPO DE GRÁFICA
    # --------------------------------------------------------

    if not configuracion:
        return jsonify({
            "ok": False,
            "error": "El tipo de gráfica no es válido."
        }), 400

    etiquetas = datos.get("labels")
    conjuntos = datos.get("datasets")

    # --------------------------------------------------------
    # VALIDAR ESTRUCTURA DE LOS DATOS
    # --------------------------------------------------------

    if (
        not isinstance(etiquetas, list)
        or not isinstance(conjuntos, list)
        or not etiquetas
        or not conjuntos
        or len(etiquetas) > 500
        or len(conjuntos) > 10
    ):
        return jsonify({
            "ok": False,
            "error": "Los datos de la gráfica no son válidos."
        }), 400

    if any(
        not isinstance(etiqueta, (str, int, float))
        or isinstance(etiqueta, bool)
        for etiqueta in etiquetas
    ):
        return jsonify({
            "ok": False,
            "error": "Las etiquetas de la gráfica no son válidas."
        }), 400

    for conjunto in conjuntos:

        if (
            not isinstance(conjunto, dict)
            or not isinstance(conjunto.get("data"), list)
            or len(conjunto["data"]) != len(etiquetas)
        ):
            return jsonify({
                "ok": False,
                "error": "La estructura de los datos está incompleta."
            }), 400

        for valor in conjunto["data"]:

            if (
                isinstance(valor, bool)
                or not isinstance(valor, (int, float))
                or not isfinite(valor)
            ):
                return jsonify({
                    "ok": False,
                    "error": "La gráfica contiene valores numéricos no válidos."
                }), 400

    # --------------------------------------------------------
    # CREAR ARCHIVO EXCEL EN MEMORIA
    # --------------------------------------------------------

    salida = BytesIO()

    try:

        libro = xlsxwriter.Workbook(
            salida,
            {
                "in_memory": True
            }
        )

        hoja_grafica = libro.add_worksheet("Gráfica")
        hoja_datos = libro.add_worksheet("Datos")

        # ----------------------------------------------------
        # FORMATOS
        # ----------------------------------------------------

        formato_titulo = libro.add_format({
            "bold": True,
            "font_size": 16,
            "font_color": "#1E3A8A"
        })

        formato_encabezado = libro.add_format({
            "bold": True,
            "font_color": "#FFFFFF",
            "bg_color": "#2563EB",
            "align": "center",
            "valign": "vcenter",
            "border": 1
        })

        formato_numero = libro.add_format({
            "num_format": "0",
            "align": "center"
        })

        # ----------------------------------------------------
        # HOJA DE DATOS
        # ----------------------------------------------------

        hoja_datos.write(
            0,
            0,
            "Categoría",
            formato_encabezado
        )

        for indice, conjunto in enumerate(conjuntos, start=1):

            nombre = str(
                conjunto.get("label") or f"Serie {indice}"
            )

            hoja_datos.write(
                0,
                indice,
                nombre,
                formato_encabezado
            )

        for fila, etiqueta in enumerate(etiquetas, start=1):

            hoja_datos.write(
                fila,
                0,
                str(etiqueta)
            )

            for columna, conjunto in enumerate(conjuntos, start=1):

                numero = conjunto["data"][fila - 1]

                hoja_datos.write_number(
                    fila,
                    columna,
                    numero,
                    formato_numero
                )

        hoja_datos.set_column(0, 0, 25)
        hoja_datos.set_column(1, len(conjuntos), 20)

        hoja_datos.freeze_panes(1, 1)

        hoja_datos.autofilter(
            0,
            0,
            len(etiquetas),
            len(conjuntos)
        )

        # ----------------------------------------------------
        # CONFIGURAR GRÁFICA NATIVA DE EXCEL
        # ----------------------------------------------------

        opciones_grafica = {
            "type": configuracion["tipo"],
            "title": {
                "name": configuracion["titulo"]
            },
            "style": 10,
            "size": {
                "width": 900,
                "height": 520
            }
        }

        if configuracion["tipo"] == "bar":

            opciones_grafica["bar_dir"] = (
                configuracion["bar_dir"]
            )

            if configuracion["subtipo"]:
                opciones_grafica["subtype"] = (
                    configuracion["subtipo"]
                )

        grafica = libro.add_chart(opciones_grafica)

        # ----------------------------------------------------
        # COLORES DE LAS SERIES
        # ----------------------------------------------------

        colores = [
            "#2563EB",
            "#16A34A",
            "#F59E0B",
            "#DC2626",
            "#6366F1"
        ]

        # ----------------------------------------------------
        # AGREGAR SERIES DE DATOS
        # ----------------------------------------------------

        for indice, conjunto in enumerate(conjuntos, start=1):

            serie = {
                "name": ["Datos", 0, indice],

                "categories": [
                    "Datos",
                    1,
                    0,
                    len(etiquetas),
                    0
                ],

                "values": [
                    "Datos",
                    1,
                    indice,
                    len(etiquetas),
                    indice
                ],

                "data_labels": {
                    "value": True
                }
            }

            if configuracion["tipo"] != "doughnut":

                serie["fill"] = {
                    "color": colores[
                        (indice - 1) % len(colores)
                    ]
                }

            grafica.add_series(serie)

        # ----------------------------------------------------
        # CONFIGURAR TIPO Y EJES DE LA GRÁFICA
        # ----------------------------------------------------

        if configuracion["tipo"] == "doughnut":

            grafica.set_hole_size(60)

            grafica.set_legend({
                "position": "bottom"
            })

        else:

            grafica.set_legend({
                "position": "bottom"
            })

            if configuracion["bar_dir"] == "bar":

                # SCAC:
                # Gráfica horizontal.
                # Eje X = cantidades.
                # Eje Y = categorías SCAC.

                grafica.set_x_axis({
                    "name": configuracion["eje_valor"],
                    "major_gridlines": {
                        "visible": True
                    }
                })

                grafica.set_y_axis({
                    "name": configuracion["eje_categoria"],
                    "reverse": True
                })

            else:

                # SCAC por Status y Antigüedad:
                # Gráficas verticales apiladas.
                # Eje X = categorías SCAC.
                # Eje Y = cantidades.

                grafica.set_x_axis({
                    "name": configuracion["eje_categoria"]
                })

                grafica.set_y_axis({
                    "name": configuracion["eje_valor"],
                    "major_gridlines": {
                        "visible": True
                    }
                })

        # ----------------------------------------------------
        # INSERTAR GRÁFICA EN LA HOJA
        # ----------------------------------------------------

        hoja_grafica.write(
            "A1",
            configuracion["titulo"],
            formato_titulo
        )

        hoja_grafica.insert_chart(
            "A3",
            grafica
        )

        hoja_grafica.set_column("A:A", 18)

        # ----------------------------------------------------
        # FINALIZAR ARCHIVO
        # ----------------------------------------------------

        libro.close()

        salida.seek(0)

        return send_file(
            salida,
            as_attachment=True,
            download_name=configuracion["nombre"],
            mimetype=(
                "application/vnd.openxmlformats-officedocument."
                "spreadsheetml.sheet"
            )
        )

    except Exception as error:

        print(
            f"Error al exportar gráfica {tipo}: {error}"
        )

        return jsonify({
            "ok": False,
            "error": "No fue posible generar el archivo Excel."
        }), 500