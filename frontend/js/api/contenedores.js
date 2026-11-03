"use strict";

import { obtenerRegistros, guardarRegistros } from "./api.js";

function normalizarNumero(numero) {
    return String(numero || "").trim().toUpperCase();
}

export function listarContenedores() {
    return obtenerRegistros();
}

export function buscarContenedor(id) {
    return obtenerRegistros().find(
        registro => registro.id === id
    ) || null;
}

export function registrarContenedor(datos) {
    const registros = obtenerRegistros();
    const numero = normalizarNumero(datos.numero);

    if (!numero) {
        throw new Error("El número del contenedor es obligatorio.");
    }

    const existe = registros.some(registro =>
        normalizarNumero(registro.numero) === numero
    );

    if (existe) {
        throw new Error(
            "Ya existe un contenedor registrado con ese número."
        );
    }

    const nuevoRegistro = {
        ...datos,
        numero,
        id: typeof crypto !== "undefined" &&
            typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `registro-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        fechaRegistro: new Date().toISOString()
    };

    registros.unshift(nuevoRegistro);
    guardarRegistros(registros);

    return nuevoRegistro;
}

export function eliminarContenedor(id) {
    const registros = obtenerRegistros();

    guardarRegistros(
        registros.filter(registro => registro.id !== id)
    );
}