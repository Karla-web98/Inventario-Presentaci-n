
import os
import time
import uuid

import cloudinary
import cloudinary.uploader
import requests

from urllib.parse import urlparse
from flask import Blueprint, jsonify, request, Response
from sqlalchemy import desc

from backend.database import db
from backend.models import Contenedor, Fotografia


contenedores_bp = Blueprint("contenedores", __name__)


# ============================================================
# CONFIGURACIÓN DE CLOUDINARY
# ============================================================

def configurar_cloudinary():
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
    api_key = os.getenv("CLOUDINARY_API_KEY")
    api_secret = os.getenv("CLOUDINARY_API_SECRET")

    if not all([cloud_name, api_key, api_secret]):
        raise RuntimeError("Cloudinary no está configurado.")

    cloudinary.config(
        cloud_name=cloud_name,
        api_key=api_key,
        api_secret=api_secret,
        secure=True
    )


# ============================================================
# SUBIR FOTOGRAFÍA
# ============================================================

def subir_fotografia(foto, contenedor_id, categoria, orden=0):
    if not isinstance(foto, dict):
        raise ValueError("Formato de fotografía no válido.")

    data = foto.get("data")
    nombre = str(foto.get("nombre") or "fotografia.jpg")
    tipo = str(foto.get("tipo") or "image/jpeg")

    if tipo not in ("image/jpeg", "image/png", "image/webp"):
        raise ValueError("El formato de fotografía no está permitido.")

    if not isinstance(data, str) or not data.startswith("data:image/"):
        raise ValueError("La fotografía no contiene una imagen válida.")

    resultado = cloudinary.uploader.upload(
        data,
        folder="inventario/contenedores",
        resource_type="image",
        public_id=f"{contenedor_id}_{categoria}_{uuid.uuid4().hex}",
        overwrite=False,
        timeout=30
    )

    return Fotografia(
        id=str(uuid.uuid4()),
        categoria=categoria,
        nombre=nombre,
        url=resultado["secure_url"],
        public_id=resultado["public_id"],
        tipo_mime=tipo,
        tamano_bytes=resultado.get("bytes"),
        orden=orden
    )


# ============================================================
# SERIALIZAR CONTENEDOR
# ============================================================

def serializar_contenedor(contenedor):
    registro = {
        "id": contenedor.id,
        "numero": contenedor.numero,
        "carrier": contenedor.carrier,
        "estado": contenedor.estado,
        "ubicacion": contenedor.ubicacion,
        "patio": contenedor.patio,
        "spot": contenedor.spot,
        "observaciones": contenedor.observaciones,
        "operador": contenedor.operador,
        "fecha": contenedor.fecha,
        "hora": contenedor.hora,
        "fechaRegistro": (
            contenedor.fecha_registro.isoformat()
            if contenedor.fecha_registro else None
        )
    }

    if isinstance(contenedor.datos_extra, dict):
        registro.update(contenedor.datos_extra)
        registro["id"] = contenedor.id

    fotografias = sorted(
        contenedor.fotografias,
        key=lambda foto: foto.orden or 0
    )

    registro["fotografias"] = [
        {
            "id": foto.id,
            "nombre": foto.nombre,
            "tipo": foto.tipo_mime,
            "data": foto.url
        }
        for foto in fotografias
        if foto.categoria == "general"
    ]

    sello = next(
        (
            foto for foto in fotografias
            if foto.categoria == "sello"
        ),
        None
    )

    registro["fotografiaSello"] = (
        {
            "id": sello.id,
            "nombre": sello.nombre,
            "tipo": sello.tipo_mime,
            "data": sello.url
        }
        if sello else None
    )

    return registro


# ============================================================
# LISTAR CONTENEDORES
# ============================================================

@contenedores_bp.route("/api/contenedores", methods=["GET"])
def listar_contenedores():
    try:
        registros = (
            Contenedor.query
            .order_by(desc(Contenedor.fecha_registro))
            .all()
        )

        return jsonify({
            "ok": True,
            "registros": [
                serializar_contenedor(registro)
                for registro in registros
            ]
        })

    except Exception:
        db.session.rollback()

        print(
            "Error al consultar contenedores:",
            flush=True
        )

        return jsonify({
            "ok": False,
            "error": "No fue posible consultar el inventario."
        }), 500


# ============================================================
# REGISTRAR CONTENEDOR
# ============================================================

@contenedores_bp.route("/api/contenedores", methods=["POST"])
def registrar_contenedor():
    subidas = []
    inicio = time.perf_counter()
    numero = "PENDIENTE"
    commit_realizado = False

    def medir(mensaje):
        segundos = time.perf_counter() - inicio

        print(
            f"[REGISTRO {numero}] {mensaje}: {segundos:.2f} segundos",
            flush=True
        )

    try:
        datos = request.get_json(silent=True)

        if not isinstance(datos, dict):
            return jsonify({
                "ok": False,
                "error": "Los datos del registro no son válidos."
            }), 400

        numero = str(datos.get("numero") or "").strip().upper()

        medir("Datos recibidos")

        if not numero:
            return jsonify({
                "ok": False,
                "error": "El número del contenedor es obligatorio."
            }), 400

        if Contenedor.query.filter_by(numero=numero).first():
            return jsonify({
                "ok": False,
                "error": "Ya existe un contenedor registrado con ese número."
            }), 409

        fotos_generales = datos.get("fotografias") or []
        foto_sello = datos.get("fotografiaSello")

        if (
            not isinstance(fotos_generales, list)
            or len(fotos_generales) > 5
        ):
            return jsonify({
                "ok": False,
                "error": "Puedes registrar un máximo de 5 fotografías generales."
            }), 400

        if len(fotos_generales) < 1:
            return jsonify({
                "ok": False,
                "error": "Debes agregar al menos una fotografía."
            }), 400

        configurar_cloudinary()
        medir("Cloudinary configurado")

        contenedor_id = str(uuid.uuid4())

        campos = {
            "numero",
            "carrier",
            "estado",
            "ubicacion",
            "patio",
            "spot",
            "observaciones",
            "operador",
            "fecha",
            "hora"
        }

        registro = Contenedor(
            id=contenedor_id,
            numero=numero,
            carrier=datos.get("carrier"),
            estado=datos.get("estado"),
            ubicacion=datos.get("ubicacion"),
            patio=datos.get("patio"),
            spot=datos.get("spot"),
            observaciones=datos.get("observaciones"),
            operador=datos.get("operador"),
            fecha=datos.get("fecha"),
            hora=datos.get("hora"),
            datos_extra={
                clave: valor
                for clave, valor in datos.items()
                if clave not in campos
                and clave not in (
                    "fotografias",
                    "fotografiaSello"
                )
            }
        )

        # Subir fotografías generales.
        for indice, foto in enumerate(fotos_generales):
            fotografia = subir_fotografia(
                foto,
                contenedor_id,
                "general",
                indice
            )

            fotografia.contenedor = registro
            subidas.append(fotografia)

            medir(
                f"Fotografía general {indice + 1} subida"
            )

        # Subir fotografía del sello, si existe.
        if foto_sello:
            fotografia = subir_fotografia(
                foto_sello,
                contenedor_id,
                "sello"
            )

            fotografia.contenedor = registro
            subidas.append(fotografia)

            medir("Fotografía del sello subida")

        # Guardar información en PostgreSQL.
        db.session.add(registro)
        db.session.add_all(subidas)
        db.session.commit()

        commit_realizado = True

        medir("Registro confirmado en PostgreSQL")

        # Preparar respuesta.
        respuesta = serializar_contenedor(registro)

        medir("Respuesta preparada")

        return jsonify({
            "ok": True,
            "mensaje": "Contenedor registrado correctamente.",
            "registro": respuesta
        }), 201

    except Exception as error:
        if not commit_realizado:
            db.session.rollback()

        print(
            f"[REGISTRO {numero}] Error al registrar contenedor: {error}",
            flush=True
        )

        # Limpiar imágenes únicamente si la transacción
        # todavía no se confirmó en PostgreSQL.
        if not commit_realizado:
            for foto in subidas:
                if foto.public_id:
                    try:
                        cloudinary.uploader.destroy(
                            foto.public_id,
                            resource_type="image",
                            timeout=15
                        )

                    except Exception as error_cloudinary:
                        print(
                            "No se pudo limpiar una imagen:",
                            error_cloudinary,
                            flush=True
                        )

        mensaje = str(error).lower()

        if (
            "duplicate key" in mensaje
            or "unique constraint" in mensaje
        ):
            return jsonify({
                "ok": False,
                "error": "Ya existe un contenedor registrado con ese número."
            }), 409

        return jsonify({
            "ok": False,
            "error": (
                "No fue posible guardar el contenedor. "
                "Inténtalo nuevamente."
            )
        }), 500


# ============================================================
# ELIMINAR CONTENEDOR
# ============================================================

@contenedores_bp.route(
    "/api/contenedores/<string:contenedor_id>",
    methods=["DELETE"]
)
def eliminar_contenedor(contenedor_id):
    try:
        registro = db.session.get(
            Contenedor,
            contenedor_id
        )

        if not registro:
            return jsonify({
                "ok": False,
                "error": "El contenedor no existe."
            }), 404

        # Eliminar registros de PostgreSQL.
        # Las imágenes permanecen en Cloudinary para
        # conservar las referencias de los cortes históricos.
        db.session.delete(registro)
        db.session.commit()

        return jsonify({
            "ok": True,
            "mensaje": "Contenedor eliminado correctamente."
        })

    except Exception as error:
        db.session.rollback()

        print(
            "Error al eliminar contenedor:",
            error,
            flush=True
        )

        return jsonify({
            "ok": False,
            "error": "No fue posible eliminar el contenedor."
        }), 500


# ============================================================
# PROXY DE FOTOGRAFÍAS PARA EXPORTACIÓN
# ============================================================

@contenedores_bp.route(
    "/api/fotografias/proxy",
    methods=["GET"]
)
def obtener_fotografia_exportacion():
    url = request.args.get("url", "").strip()

    if not url:
        return jsonify({
            "ok": False,
            "error": "No se proporcionó la fotografía."
        }), 400

    try:
        cloud_name = os.getenv(
            "CLOUDINARY_CLOUD_NAME",
            ""
        ).strip()

        parsed = urlparse(url)

        ruta_permitida = f"/{cloud_name}/image/upload/"

        if (
            not cloud_name
            or parsed.scheme != "https"
            or parsed.hostname != "res.cloudinary.com"
            or parsed.port is not None
            or parsed.username is not None
            or parsed.password is not None
            or not parsed.path.startswith(ruta_permitida)
        ):
            return jsonify({
                "ok": False,
                "error": "La dirección de la fotografía no está permitida."
            }), 400

        limite_bytes = 15 * 1024 * 1024

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
                "Content-Type",
                ""
            ).split(";")[0].lower()

            if tipo not in (
                "image/jpeg",
                "image/png",
                "image/webp"
            ):
                return jsonify({
                    "ok": False,
                    "error": "El archivo solicitado no es una imagen válida."
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

        return Response(
            bytes(contenido),
            mimetype=tipo,
            headers={
                "Cache-Control": "private, max-age=3600"
            }
        )

    except requests.RequestException as error:
        print(
            "Error al recuperar fotografía para Excel:",
            error,
            flush=True
        )

        return jsonify({
            "ok": False,
            "error": "No fue posible conectar con el servicio de fotografías."
        }), 502

    except Exception as error:
        print(
            "Error inesperado en el proxy de fotografías:",
            error,
            flush=True
        )

        return jsonify({
            "ok": False,
            "error": "No fue posible recuperar una fotografía."
        }), 500