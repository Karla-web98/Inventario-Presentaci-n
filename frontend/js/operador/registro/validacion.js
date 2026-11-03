"use strict";

import { listarContenedores } from "../../api/contenedores.js";

const ubicacionesPorPatio = {
    "T-REX": ["Zona A", "Zona B", "Zona C", "Zona D"],
    "FÓSIL": ["Fila 1", "Fila 2", "Fila 3", "Fila 4"]
};

function normalizarNumero(numero) {
    return String(numero || "").trim().toUpperCase();
}

export function validarDatosContenedor(datos) {
    const errores = [];

    const numero = normalizarNumero(datos.numero);

    if (!numero) {
        errores.push("Ingresa el número del contenedor.");
    } else {
        if (!/^[A-Z0-9]{4,20}$/.test(numero)) {
            errores.push(
                "El número debe contener entre 4 y 20 letras o números, sin espacios."
            );
        }

        const existe = listarContenedores().some(registro =>
            normalizarNumero(registro.numero) === numero
        );

        if (existe) {
            errores.push(
                "Ya existe un contenedor registrado con ese número."
            );
        }
    }

    if (!datos.carrier.trim()) {
        errores.push("Ingresa el carrier.");
    }

    if (!datos.estado) {
        errores.push("Selecciona el status.");
    }

    if (!datos.patio) {
        errores.push("Selecciona el patio.");
    }

    const ubicacionesPermitidas = ubicacionesPorPatio[datos.patio] || [];

    if (!datos.ubicacion) {
        errores.push("Selecciona una ubicación.");
    } else if (!ubicacionesPermitidas.includes(datos.ubicacion)) {
        errores.push("La ubicación no corresponde al patio seleccionado.");
    }

    if (
        !datos.spot ||
        !Number.isInteger(Number(datos.spot)) ||
        Number(datos.spot) < 1
    ) {
        errores.push("Ingresa un número de Spot válido, mayor que cero.");
    }

    return {
        valido: errores.length === 0,
        errores
    };
}

export function obtenerDatosFormulario() {
    return {
        numero: document.querySelector("#containerNumber").value.trim().toUpperCase(),
        carrier: document.querySelector("#carrier").value.trim(),
        estado: document.querySelector("#containerStatus").value,
        patio: document.querySelector("#yard").value,
        ubicacion: document.querySelector("#location").value,
        spot: document.querySelector("#spot").value.trim(),
        observaciones: document.querySelector("#observations").value.trim()
    };
}