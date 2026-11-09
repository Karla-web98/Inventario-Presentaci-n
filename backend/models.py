
from datetime import datetime, timezone

from backend.database import db


def ahora_utc():
    return datetime.now(timezone.utc)


class Contenedor(db.Model):
    __tablename__ = "contenedores"

    id = db.Column(db.String(100), primary_key=True)
    numero = db.Column(db.String(30), nullable=False, unique=True, index=True)

    carrier = db.Column(db.String(120))
    estado = db.Column(db.String(50))
    ubicacion = db.Column(db.String(150))
    patio = db.Column(db.String(100))
    spot = db.Column(db.String(50))
    observaciones = db.Column(db.Text)

    operador = db.Column(db.String(120))
    fecha = db.Column(db.String(30))
    hora = db.Column(db.String(30))

    fecha_registro = db.Column(
        db.DateTime(timezone=True),
        default=ahora_utc
    )

    datos_extra = db.Column(db.JSON, default=dict)

    fotografias = db.relationship(
        "Fotografia",
        back_populates="contenedor",
        lazy=True,
        cascade="all, delete-orphan"
    )


class Fotografia(db.Model):
    __tablename__ = "fotografias"

    id = db.Column(db.String(100), primary_key=True)

    contenedor_id = db.Column(
        db.String(100),
        db.ForeignKey("contenedores.id"),
        nullable=False,
        index=True
    )

    categoria = db.Column(db.String(30), nullable=False)
    nombre = db.Column(db.String(255))
    url = db.Column(db.Text, nullable=False)
    public_id = db.Column(db.String(255))

    tipo_mime = db.Column(db.String(100))
    tamano_bytes = db.Column(db.Integer)
    orden = db.Column(db.Integer, default=0)

    fecha_subida = db.Column(
        db.DateTime(timezone=True),
        default=ahora_utc
    )

    contenedor = db.relationship(
        "Contenedor",
        back_populates="fotografias"
    )


class CorteHistorico(db.Model):
    __tablename__ = "historial_cortes"

    id = db.Column(db.String(100), primary_key=True)
    fecha = db.Column(db.String(30), nullable=False, unique=True)

    fecha_hora = db.Column(
        db.DateTime(timezone=True),
        default=ahora_utc
    )

    resumen = db.Column(db.JSON, nullable=False, default=dict)

    # Conserva una fotografía histórica del inventario.
    # Las imágenes se guardarán mediante sus URL, no como Base64.
    registros = db.Column(db.JSON, nullable=False, default=list)