import uuid
from datetime import datetime

from flask import Blueprint, jsonify, request
from sqlalchemy import desc
from sqlalchemy.exc import IntegrityError

from backend.database import db
from backend.models import CorteHistorico


cortes_bp = Blueprint("cortes", __name__)


def serializar_corte(corte):
    return {
        "id": corte.id,
        "fecha": corte.fecha,
        "fechaHora": (
            corte.fecha_hora.isoformat()
            if corte.fecha_hora else None
        ),
        "resumen": corte.resumen or {},
        "registros": corte.registros or []
    }


@cortes_bp.route("/api/cortes", methods=["GET"])
def listar_cortes():
    try:
        cortes = (
            CorteHistorico.query
            .order_by(desc(CorteHistorico.fecha))
            .all()
        )

        return jsonify({
            "ok": True,
            "cortes": [
                serializar_corte(corte)
                for corte in cortes
            ]
        })

    except Exception as error:
        print("Error al consultar cortes históricos:", error)

        return jsonify({
            "ok": False,
            "error": "No fue posible consultar los cortes históricos."
        }), 500


@cortes_bp.route("/api/cortes", methods=["POST"])
def guardar_corte():
    try:
        datos = request.get_json(silent=True)

        if not isinstance(datos, dict):
            return jsonify({
                "ok": False,
                "error": "Los datos del corte no son válidos."
            }), 400

        fecha = str(datos.get("fecha") or "").strip()
        registros = datos.get("registros")
        resumen = datos.get("resumen")

        if not fecha:
            return jsonify({
                "ok": False,
                "error": "La fecha del corte es obligatoria."
            }), 400

        try:
            datetime.strptime(fecha, "%Y-%m-%d")
        except ValueError:
            return jsonify({
                "ok": False,
                "error": "La fecha debe tener el formato YYYY-MM-DD."
            }), 400

        if not isinstance(registros, list):
            return jsonify({
                "ok": False,
                "error": "Los registros del corte no son válidos."
            }), 400

        if not isinstance(resumen, dict):
            return jsonify({
                "ok": False,
                "error": "El resumen del corte no es válido."
            }), 400

        # Evitar generar más de un corte por día.
        existente = CorteHistorico.query.filter_by(
            fecha=fecha
        ).first()

        if existente:
            return jsonify({
                "ok": True,
                "creado": False,
                "mensaje": "Ya existe un corte para esta fecha.",
                "corte": serializar_corte(existente)
            }), 200

        nuevo_corte = CorteHistorico(
            id=str(datos.get("id") or f"corte-{fecha}-{uuid.uuid4().hex[:8]}"),
            fecha=fecha,
            resumen=resumen,
            registros=registros
        )

        fecha_hora = datos.get("fechaHora")

        if fecha_hora:
            try:
                nuevo_corte.fecha_hora = datetime.fromisoformat(
                    str(fecha_hora).replace("Z", "+00:00")
                )
            except ValueError:
                return jsonify({
                    "ok": False,
                    "error": "La fecha y hora del corte no son válidas."
                }), 400

        db.session.add(nuevo_corte)
        db.session.commit()

        return jsonify({
            "ok": True,
            "creado": True,
            "mensaje": "Corte histórico guardado correctamente.",
            "corte": serializar_corte(nuevo_corte)
        }), 201

    except IntegrityError:
        db.session.rollback()

        # Puede ocurrir si dos dispositivos crean el corte
        # del mismo día prácticamente al mismo tiempo.
        existente = CorteHistorico.query.filter_by(
            fecha=fecha
        ).first()

        if existente:
            return jsonify({
                "ok": True,
                "creado": False,
                "mensaje": "Ya existe un corte para esta fecha.",
                "corte": serializar_corte(existente)
            }), 200

        return jsonify({
            "ok": False,
            "error": "No fue posible guardar el corte histórico."
        }), 500

    except Exception as error:
        db.session.rollback()
        print("Error al guardar corte histórico:", error)

        return jsonify({
            "ok": False,
            "error": "No fue posible guardar el corte histórico."
        }), 500
