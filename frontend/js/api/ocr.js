"use strict";

export async function escanearIdentificador(imagen, modo = "auto") {
    const formulario = new FormData();

    formulario.append("imagen", imagen);
    formulario.append("modo", modo);

    let respuesta;

    try {
        respuesta = await fetch("/api/escanear", {
            method: "POST",
            body: formulario
        });
    } catch (error) {
        throw new Error(
            "No se pudo conectar con Flask. Verifica que App.py esté ejecutándose."
        );
    }

    let resultado;

    try {
        resultado = await respuesta.json();
    } catch {
        throw new Error("El servicio OCR devolvió una respuesta no válida.");
    }

    if (!respuesta.ok) {
        throw new Error(
            resultado.error || resultado.detalle || "No fue posible procesar la fotografía."
        );
    }

    return resultado;
}