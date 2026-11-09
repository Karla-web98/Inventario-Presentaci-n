"use strict";

const ubicacionesPorPatio = {
    "T-REX": ["Zona A", "Zona B", "Zona C", "Zona D"],
    "FÃ“SIL": ["Fila 1", "Fila 2", "Fila 3", "Fila 4"]
};

export function validarDatosContenedor(datos) {
    const errores = [];

    const numero = String(datos.numero || "").trim().toUpperCase();

    if (!numero) {
        errores.push("Ingresa el nÃºmero del contenedor.");
    } else if (!/^[A-Z0-9]{4,20}$/.test(numero)) {
        errores.push("El nÃºmero debe contener entre 4 y 20 letras o nÃºmeros.");
    }

    if (!datos.carrier?.trim()) {
        errores.push("Selecciona o ingresa el carrier.");
    }

    if (!datos.estado) {
        errores.push("Selecciona el estado del contenedor.");
    }

    if (!datos.patio) {
        errores.push("Selecciona el patio.");
    }

    const ubicacionesPermitidas = ubicacionesPorPatio[datos.patio] || [];

    if (!datos.ubicacion) {
        errores.push("Selecciona la ubicaciÃ³n.");
    } else if (!ubicacionesPermitidas.includes(datos.ubicacion)) {
        errores.push("La ubicaciÃ³n no corresponde al patio seleccionado.");
    }

    if (
        !datos.spot ||
        !Number.isInteger(Number(datos.spot)) ||
        Number(datos.spot) < 1
    ) {
        errores.push("Ingresa un Spot vÃ¡lido.");
    }

    return {
        valido: errores.length === 0,
        errores
    };
}

export function obtenerDatosFormulario() {
    return {
        numero: document.querySelector("#containerNumber")?.value.trim() || "",
        carrier: document.querySelector("#carrier")?.value.trim() || "",
        estado: document.querySelector("#containerStatus")?.value || "",
        ubicacion: document.querySelector("#location")?.value || "",
        patio: document.querySelector("#yard")?.value || "",
        spot: document.querySelector("#spot")?.value.trim() || "",
        observaciones: document.querySelector("#observations")?.value.trim() || ""
    };
}