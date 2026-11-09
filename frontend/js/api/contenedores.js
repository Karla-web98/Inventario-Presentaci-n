"use strict";
const API_URL = "/api/contenedores";

async function procesarRespuesta(response) {
    let resultado;
    try {
        resultado = await response.json();
    } catch {
        throw new Error("El servidor devolvió una respuesta no válida.");
    }

    if (!response.ok || resultado.ok === false) {
        throw new Error(
            resultado.error ||
            resultado.mensaje ||
            "Ocurrió un error al comunicarse con el servidor."
        );
    }
    return resultado;
}

export async function listarContenedores() {
    const response = await fetch(API_URL);
    const resultado = await procesarRespuesta(response);

    return resultado.registros || [];
}

export async function buscarContenedor(id) {
    const registros = await listarContenedores();

    return registros.find(registro => registro.id === id) || null;
}

export async function registrarContenedor(datos) {
    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(datos)
    });
    const resultado = await procesarRespuesta(response);
    return resultado.registro;
}

export async function eliminarContenedor(id) {
    const response = await fetch(
        `${API_URL}/${encodeURIComponent(id)}`,
        {
            method: "DELETE"
        }
    );
    return await procesarRespuesta(response);
}