from pathlib import Path
from flask import Flask, jsonify, send_from_directory
from backend.routes.escanear import escanear_bp

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
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

# ============================================================
# BLUEPRINTS
# ============================================================
app.register_blueprint(escanear_bp)

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
    return jsonify({
        "estado": "ok",
        "backend": "Flask",
        "ocr": "disponible",
        "base_datos": False,
        "modo": "presentacion"
    })

# ============================================================
# ERROR 413
# ============================================================
@app.errorhandler(413)
def archivo_demasiado_grande(error):
    return jsonify({
        "error": "La imagen supera el límite de 10 MB"
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