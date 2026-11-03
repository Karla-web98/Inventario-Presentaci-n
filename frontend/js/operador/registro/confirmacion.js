"use strict";

import { registrarContenedor } from "../../api/contenedores.js";

export function mostrarConfirmacion(datos, fotografias, fotografiaSello = null) {
    const contenedor = document.querySelector("#confirmationDetails");

    const campos = [
        ["Número de caja", datos.numero],
        ["Carrier", datos.carrier],
        ["Status", datos.estado],
        ["Patio", datos.patio],
        ["Ubicación", datos.ubicacion],
        ["Número de Spot", datos.spot],
        ["Observaciones", datos.observaciones || "Sin observaciones"],
        ["Fotografías generales", `${fotografias.length} fotografía(s)`],
        [
            "Fotografía del sello",
            fotografiaSello ? "Agregada" : "No requerida"
        ]
    ];

    contenedor.innerHTML = "";

    campos.forEach(([etiqueta, valor]) => {
        const elemento = document.createElement("div");
        elemento.className = "confirmation-item";

        const titulo = document.createElement("small");
        titulo.textContent = etiqueta;

        const contenido = document.createElement("strong");
        contenido.textContent = valor;

        elemento.append(titulo, contenido);
        contenedor.appendChild(elemento);
    });
}

export function guardarRegistro(datos, fotografias, fotografiaSello = null) {
    const registro = {
        ...datos,
        fotografias,
        fotografiaSello,
        operador: "Operador",
        fecha: new Date().toLocaleDateString("es-MX"),
        hora: new Date().toLocaleTimeString("es-MX", {
            hour: "2-digit",
            minute: "2-digit"
        })
    };

    return registrarContenedor(registro);
}