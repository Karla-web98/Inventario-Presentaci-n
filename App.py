from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory, send_file

from backend.routes.escanear import escanear_bp
from dotenv import load_dotenv

from backend.routes.contenedores import contenedores_bp
from backend.routes.cortes import cortes_bp
from backend.routes.reportes import reportes_bp

load_dotenv()
from backend.database import inicializar_db, verificar_conexion
import backend.models

import os
from io import BytesIO
from urllib.parse import urlparse
import requests

# ============================================================
# CONFIGURACIÓN
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"
PAGES_DIR = FRONTEND_DIR / "pages"

app = Flask(
    __name__,
    static_folder=str(FRONTEND_DIR),
    static_url_path="/static"
)

app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024

# ============================================================
# BASE DE DATOS
# ============================================================
inicializar_db(app)

# ============================================================
# BLUEPRINTS
# ============================================================
app.register_blueprint(escanear_bp)
app.register_blueprint(contenedores_bp)
app.register_blueprint(cortes_bp)
app.register_blueprint(reportes_bp)
# ============================================================
# PROXY DE FOTOGRAFÍAS DE CLOUDINARY
# ============================================================

@app.route("/api/fotografias/proxy", methods=["GET"])
def proxy_fotografia():
    url = request.args.get("url", "").strip()

    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", "").strip()

    if not url or not cloud_name:
        return jsonify({
            "ok": False,
            "error": "No se proporcionó una fotografía válida."
        }), 400

    try:
        direccion = urlparse(url)

        ruta_permitida = f"/{cloud_name}/image/upload/"

        if (
            direccion.scheme != "https"
            or direccion.hostname != "res.cloudinary.com"
            or not direccion.path.startswith(ruta_permitida)
        ):
            return jsonify({
                "ok": False,
                "error": "La dirección de la fotografía no está permitida."
            }), 403

        limite_bytes = 12 * 1024 * 1024

        with requests.get(
            url,
            stream=True,
            timeout=(5, 30),
            allow_redirects=False
        ) as respuesta:

            if respuesta.status_code != 200:
                return jsonify({
                    "ok": False,
                    "error": "No fue posible recuperar la fotografía."
                }), 502

            tipo = respuesta.headers.get(
                "Content-Type", ""
            ).split(";")[0].lower()

            tipos_permitidos = {
                "image/jpeg",
                "image/png",
                "image/webp"
            }

            if tipo not in tipos_permitidos:
                return jsonify({
                    "ok": False,
                    "error": "El archivo recuperado no es una imagen compatible."
                }), 415

            longitud = respuesta.headers.get("Content-Length")

            if longitud and int(longitud) > limite_bytes:
                return jsonify({
                    "ok": False,
                    "error": "La fotografía supera el tamaño permitido."
                }), 413

            contenido = bytearray()

            for fragmento in respuesta.iter_content(
                chunk_size=64 * 1024
            ):
                if not fragmento:
                    continue

                contenido.extend(fragmento)

                if len(contenido) > limite_bytes:
                    return jsonify({
                        "ok": False,
                        "error": "La fotografía supera el tamaño permitido."
                    }), 413

        return send_file(
            BytesIO(contenido),
            mimetype=tipo,
            download_name="fotografia",
            max_age=3600
        )

    except requests.RequestException:
        app.logger.exception(
            "Error al recuperar fotografía de Cloudinary"
        )

        return jsonify({
            "ok": False,
            "error": "No fue posible conectar con el servicio de fotografías."
        }), 502

    except Exception:
        app.logger.exception(
            "Error inesperado en el proxy de fotografías"
        )

        return jsonify({
            "ok": False,
            "error": "Ocurrió un error al procesar la fotografía."
        }), 500

# ============================================================
# VISTAS
# ============================================================
@app.route("/")
def inicio():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/operador")
def vista_operador():
    return send_from_directory(PAGES_DIR, "operador.html")


@app.route("/administrador")
def vista_administrador():
    return send_from_directory(PAGES_DIR, "administrador.html")

# ============================================================
# ESTADO DEL SISTEMA
# ============================================================
@app.route("/api/estado")
def estado():

    conexion_db = verificar_conexion(app)

    return jsonify({
        "estado": "ok",
        "backend": "Flask",
        "ocr": "disponible",
        "base_datos": conexion_db,
        "modo": "sincronizado" if conexion_db else "sin_conexion_db"
    })

# ============================================================
# ERROR 413
# ============================================================
@app.errorhandler(413)
def archivo_demasiado_grande(error):
    return jsonify({
        "error": "La solicitud supera el límite de 20 MB."
    }), 413

# ============================================================
# EJECUCIÓN
# ============================================================

if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )