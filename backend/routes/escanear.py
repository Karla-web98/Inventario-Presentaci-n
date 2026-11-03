import cv2
import numpy as np

from flask import Blueprint, jsonify, request

from ocr import calcular_digito_control, leer_identificador


# ============================================================
# BLUEPRINT
# ============================================================

escanear_bp = Blueprint(
    "escanear",
    __name__,
    url_prefix="/api/escanear"
)


# ============================================================
# MODOS PERMITIDOS
# ============================================================

MODOS_VALIDOS = {
    "auto",
    "iso",
    "numerico"
}


# ============================================================
# ENDPOINT DE ESCANEO
# ============================================================

@escanear_bp.route("", methods=["POST"])
@escanear_bp.route("/", methods=["POST"])
def escanear():

    print(">>> ENTRE A /api/escanear", flush=True)

    # --------------------------------------------------------
    # 1. RECIBIR IMAGEN
    # --------------------------------------------------------

    archivo = request.files.get("imagen")

    print(
        ">>> ARCHIVO RECIBIDO:",
        archivo.filename if archivo else None,
        flush=True
    )

    if archivo is None or not archivo.filename:
        return jsonify({
            "error": "Debes enviar una fotografía en el campo 'imagen'"
        }), 400

    # --------------------------------------------------------
    # 2. VALIDAR MODO
    # --------------------------------------------------------

    modo = request.form.get(
        "modo",
        "auto"
    ).strip().lower()

    if modo not in MODOS_VALIDOS:
        return jsonify({
            "error": (
                "El modo debe ser "
                "'auto', 'iso' o 'numerico'"
            )
        }), 400

    # --------------------------------------------------------
    # 3. LEER ARCHIVO
    # --------------------------------------------------------

    datos = archivo.read()

    print(
        ">>> BYTES RECIBIDOS:",
        len(datos),
        flush=True
    )

    if not datos:
        return jsonify({
            "error": "La fotografía está vacía"
        }), 400

    # --------------------------------------------------------
    # 4. CONVERTIR IMAGEN PARA OPENCV
    # --------------------------------------------------------

    imagen = cv2.imdecode(
        np.frombuffer(
            datos,
            dtype=np.uint8
        ),
        cv2.IMREAD_COLOR
    )

    if imagen is None:
        return jsonify({
            "error": (
                "No se pudo leer la imagen. "
                "Usa JPG, PNG o WEBP"
            )
        }), 400

    print(
        ">>> IMAGEN DECODIFICADA:",
        imagen.shape,
        flush=True
    )

    # --------------------------------------------------------
    # 5. EJECUTAR OCR
    # --------------------------------------------------------

    print(
        ">>> ANTES DE EJECUTAR OCR",
        flush=True
    )

    try:

        resultado = leer_identificador(
            imagen,
            modo=modo,
            log=print
        )

        print(
            ">>> OCR TERMINADO:",
            resultado,
            flush=True
        )

    except Exception as error:

        print(
            ">>> ERROR DURANTE OCR:",
            repr(error),
            flush=True
        )

        return jsonify({
            "error": "Falló el procesamiento de la imagen",
            "detalle": str(error)
        }), 500

    # --------------------------------------------------------
    # 6. NO SE ENCONTRÓ IDENTIFICADOR
    # --------------------------------------------------------

    if resultado is None:

        return jsonify({
            "encontrado": False,
            "mensaje": (
                "No se encontró un número reconocible. "
                "Acércate más, toma la fotografía de frente "
                "y evita reflejos."
            )
        }), 200

    # --------------------------------------------------------
    # 7. PROCESAR RESULTADO
    # --------------------------------------------------------

    tipo = resultado["tipo"]
    valor = resultado["valor"]

    control_calculado = None
    valor_completo = valor

    # --------------------------------------------------------
    # 8. ISO SIN DÍGITO DE CONTROL
    # --------------------------------------------------------

    if tipo == "iso_sin_control":

        control_calculado = calcular_digito_control(
            valor
        )

        valor_completo = (
            f"{valor}{control_calculado}"
        )

    # --------------------------------------------------------
    # 9. DETERMINAR SI REQUIERE REVISIÓN
    # --------------------------------------------------------

    requiere_revision = (
        tipo not in (
            "iso_valido",
            "iso_sin_control",
            "numerico"
        )
    )

    # --------------------------------------------------------
    # 10. RESPUESTA
    # --------------------------------------------------------

    return jsonify({
        "encontrado": True,
        "tipo": tipo,
        "valor": valor_completo,
        "control_calculado": control_calculado,
        "confianza": round(
            float(resultado["confianza"]),
            1
        ),
        "requiere_revision": requiere_revision,
        "orientacion": resultado.get(
            "orientacion"
        ),
        "metodo": resultado.get(
            "fuente"
        )
    }), 200