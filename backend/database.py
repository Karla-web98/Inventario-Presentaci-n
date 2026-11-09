
import os

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text


db = SQLAlchemy()

DATABASE_CONFIGURED = False


def inicializar_db(app):
    """
    Configura SQLAlchemy utilizando la variable DATABASE_URL
    proporcionada por Render.
    """

    global DATABASE_CONFIGURED

    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        DATABASE_CONFIGURED = False
        print("ADVERTENCIA: DATABASE_URL no está configurada.")
        return False

    # Compatibilidad con las URL de PostgreSQL de Render.
    if database_url.startswith("postgres://"):
        database_url = database_url.replace(
            "postgres://",
            "postgresql+psycopg://",
            1
        )

    elif database_url.startswith("postgresql://"):
        database_url = database_url.replace(
            "postgresql://",
            "postgresql+psycopg://",
            1
        )

    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_pre_ping": True
    }

    db.init_app(app)

    DATABASE_CONFIGURED = True

    print("Configuración de PostgreSQL cargada.")

    return True


def verificar_conexion(app):
    """
    Comprueba que PostgreSQL responda correctamente.
    No crea ni modifica tablas.
    """

    if not DATABASE_CONFIGURED:
        return False

    try:
        with app.app_context():
            db.session.execute(text("SELECT 1"))
            db.session.remove()

        return True

    except Exception as error:
        print("Error al conectar con PostgreSQL:", error)
        return False