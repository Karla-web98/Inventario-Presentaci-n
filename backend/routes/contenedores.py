import os
import uuid

import cloudinary
import cloudinary.uploader
import requests

from urllib.parse import urlparse
from flask import Response
from flask import Blueprint, jsonify, request
from sqlalchemy import desc

from backend.database import db
from backend.models import Contenedor, Fotografia


contenedores_bp = Blueprint("contenedores", __name__)


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
        overwrite=False
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
        ),
    }

    if isinstance(contenedor.datos_extra, dict):
        registro.update(contenedor.datos_extra)

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
        (foto for foto in fotografias if foto.categoria == "sello"),
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

    except Exception as error:
        print("Error al consultar contenedores:", error)
        return jsonify({
            "ok": False,
            "error": "No fue posible consultar el inventario."
        }), 500

@contenedores_bp.route("/api/contenedores", methods=["POST"])
def registrar_contenedor():
    subidas = []
    try:
        datos = request.get_json(silent=True)

        if not isinstance(datos, dict):
            return jsonify({
                "ok": False,
                "error": "Los datos del registro no son válidos."
            }), 400

        numero = str(datos.get("numero") or "").strip().upper()

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

        if not isinstance(fotos_generales, list) or len(fotos_generales) > 5:
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
                and clave not in ("fotografias", "fotografiaSello")
            }
        )

        for indice, foto in enumerate(fotos_generales):
            fotografia = subir_fotografia(
                foto,
                contenedor_id,
                "general",
                indice
            )
            fotografia.contenedor = registro
            subidas.append(fotografia)

        if foto_sello:
            fotografia = subir_fotografia(
                foto_sello,
                contenedor_id,
                "sello"
            )
            fotografia.contenedor = registro
            subidas.append(fotografia)

        db.session.add(registro)
        db.session.add_all(subidas)
        db.session.commit()

        return jsonify({
            "ok": True,
            "mensaje": "Contenedor registrado correctamente.",
            "registro": serializar_contenedor(registro)
        }), 201

    except Exception as error:
        db.session.rollback()

        for foto in subidas:
            if foto.public_id:
                try:
                    cloudinary.uploader.destroy(foto.public_id)
                except Exception as error_cloudinary:
                    print("No se pudo limpiar una imagen:", error_cloudinary)

        print("Error al registrar contenedor:", error)

        mensaje = str(error)

        if "duplicate key" in mensaje.lower() or "unique constraint" in mensaje.lower():
            return jsonify({
                "ok": False,
                "error": "Ya existe un contenedor registrado con ese número."
            }), 409

        return jsonify({
            "ok": False,
            "error": "No fue posible guardar el contenedor. Inténtalo nuevamente."
        }), 500



@contenedores_bp.route("/api/contenedores/<string:contenedor_id>", methods=["DELETE"])
def eliminar_contenedor(contenedor_id):
    try:
        registro = db.session.get(Contenedor, contenedor_id)

        if not registro:
            return jsonify({
                "ok": False,
                "error": "El contenedor no existe."
            }), 404

        # Elimina el contenedor y sus registros de fotografías
        # en PostgreSQL, pero conserva los archivos en Cloudinary.
        # Los cortes históricos pueden seguir utilizando sus URL.
        db.session.delete(registro)
        db.session.commit()

        return jsonify({
            "ok": True,
            "mensaje": "Contenedor eliminado correctamente."
        })

    except Exception as error:
        db.session.rollback()
        print("Error al eliminar contenedor:", error)

        return jsonify({
            "ok": False,
            "error": "No fue posible eliminar el contenedor."
        }), 500


@contenedores_bp.route("/api/fotografias/proxy", methods=["GET"])
def obtener_fotografia_exportacion():
    url = request.args.get("url", "").strip()

    if not url:
        return jsonify({
            "ok": False,
            "error": "No se proporcionó la fotografía."
        }), 400

    try:
        cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
        parsed = urlparse(url)

        # Permitir únicamente imágenes de nuestro Cloudinary.
        ruta_permitida = f"/{cloud_name}/image/upload/"

        if (
            parsed.scheme != "https"
            or parsed.netloc.lower() != "res.cloudinary.com"
            or not cloud_name
            or not parsed.path.startswith(ruta_permitida)
        ):
            return jsonify({
                "ok": False,
                "error": "La dirección de la fotografía no está permitida."
            }), 400

        respuesta = requests.get(
            url,
            timeout=(5, 30),
            allow_redirects=False
        )

        respuesta.raise_for_status()

        tipo = respuesta.headers.get(
            "Content-Type", ""
        ).split(";")[0].lower()

        if tipo not in ("image/jpeg", "image/png", "image/webp"):
            return jsonify({
                "ok": False,
                "error": "El archivo solicitado no es una imagen válida."
            }), 400

        contenido = respuesta.content

        if len(contenido) > 15 * 1024 * 1024:
            return jsonify({
                "ok": False,
                "error": "La fotografía supera el tamaño permitido."
            }), 413

        return Response(
            contenido,
            mimetype=tipo,
            headers={
                "Cache-Control": "private, max-age=3600"
            }
        )

    except Exception as error:
        print("Error al recuperar fotografía para Excel:", error)

        return jsonify({
            "ok": False,
            "error": "No fue posible recuperar una fotografía."
        }), 502