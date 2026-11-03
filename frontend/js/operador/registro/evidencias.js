"use strict";

import { prepararFotografias } from "../../api/fotos.js";

let fotografias = [];
let fotografiaSello = null;

const $ = selector => document.querySelector(selector);

function mostrarMensaje(selector, mensaje, tipo = "error") {
    const elemento = $(selector);

    elemento.textContent = mensaje;
    elemento.className = `message ${tipo}`;
}

// ----------------------------------
// FOTOGRAFÍAS GENERALES
// ----------------------------------

function actualizarVista() {
    const contador = $("#photoCounter");
    const contenedor = $("#evidencePreview");

    contador.textContent = `${fotografias.length} / 5 fotografías`;
    contenedor.innerHTML = "";

    fotografias.forEach((foto, indice) => {
        const elemento = document.createElement("article");
        elemento.className = "evidence-item";

        const imagen = document.createElement("img");
        imagen.src = foto.data;
        imagen.alt = `Evidencia ${indice + 1}`;

        const boton = document.createElement("button");
        boton.type = "button";
        boton.textContent = "Eliminar fotografía";
        boton.addEventListener("click", () => eliminarFotografia(indice));

        elemento.append(imagen, boton);
        contenedor.appendChild(elemento);
    });
}

export async function agregarFotografias(archivos) {
    if (!archivos || archivos.length === 0) return;

    try {
        const nuevas = await prepararFotografias(
            archivos,
            fotografias.length
        );

        fotografias = [...fotografias, ...nuevas];

        actualizarVista();

        mostrarMensaje(
            "#evidenceMessage",
            "Fotografías agregadas correctamente.",
            "success"
        );
    } catch (error) {
        mostrarMensaje("#evidenceMessage", error.message);
    }
}

export function eliminarFotografia(indice) {
    fotografias = fotografias.filter((_, i) => i !== indice);
    actualizarVista();
}

export function obtenerFotografias() {
    return [...fotografias];
}

export function validarEvidencias() {
    return fotografias.length >= 1 && fotografias.length <= 5;
}

// ----------------------------------
// FOTOGRAFÍA DEL SELLO
// ----------------------------------

function actualizarVistaSello() {
    const contenedor = $("#sealEvidencePreview");

    contenedor.innerHTML = "";

    if (!fotografiaSello) return;

    const elemento = document.createElement("article");
    elemento.className = "evidence-item";

    const imagen = document.createElement("img");
    imagen.src = fotografiaSello.data;
    imagen.alt = "Fotografía del sello";

    const boton = document.createElement("button");
    boton.type = "button";
    boton.textContent = "Eliminar fotografía";
    boton.addEventListener("click", eliminarFotografiaSello);

    elemento.append(imagen, boton);
    contenedor.appendChild(elemento);
}

export async function agregarFotografiaSello(archivo) {
    if (!archivo) return;

    try {
        const nuevas = await prepararFotografias([archivo]);

        fotografiaSello = nuevas[0];

        actualizarVistaSello();

        mostrarMensaje(
            "#sealEvidenceMessage",
            "Fotografía del sello agregada correctamente.",
            "success"
        );
    } catch (error) {
        mostrarMensaje("#sealEvidenceMessage", error.message);
    }
}

export function eliminarFotografiaSello() {
    fotografiaSello = null;
    actualizarVistaSello();

    const mensaje = $("#sealEvidenceMessage");
    mensaje.textContent = "";
    mensaje.className = "message hidden";
}

export function obtenerFotografiaSello() {
    return fotografiaSello;
}

export function validarFotografiaSello(estado) {
    const estadoNormalizado = normalizarEstado(estado);

    const requiereSello = [
        "cargado prod",
        "equipo vacio",
        "danado"
    ].includes(estadoNormalizado);

    return !requiereSello || fotografiaSello !== null;
}

export function actualizarRequisitoSello(estado) {
    const seccion = $("#sealEvidenceSection");

    if (!seccion) return;

    const estadoNormalizado = normalizarEstado(estado);

    const requiereSello = [
        "cargado prod",
        "equipo vacio",
        "danado"
    ].includes(estadoNormalizado);

    seccion.classList.toggle("hidden", !requiereSello);
}

function normalizarEstado(estado) {
    return String(estado || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

// ----------------------------------
// LIMPIEZA
// ----------------------------------

export function limpiarEvidencias() {
    fotografias = [];
    actualizarVista();

    const mensaje = $("#evidenceMessage");
    mensaje.textContent = "";
    mensaje.className = "message hidden";

    limpiarFotografiaSello();
}

export function limpiarFotografiaSello() {
    fotografiaSello = null;
    actualizarVistaSello();

    const entrada = $("#sealEvidenceInput");
    if (entrada) entrada.value = "";

    const mensaje = $("#sealEvidenceMessage");

    if (mensaje) {
        mensaje.textContent = "";
        mensaje.className = "message hidden";
    }
}