"use strict";

import { listarContenedores } from "../api/contenedores.js";
import { procesarOCR } from "./registro/ocr.js";
import {
    obtenerDatosFormulario,
    validarDatosContenedor
} from "./registro/validacion.js";
import {
    agregarFotografias,
    obtenerFotografias,
    validarEvidencias,
    limpiarEvidencias,
    agregarFotografiaSello,
    obtenerFotografiaSello,
    validarFotografiaSello,
    actualizarRequisitoSello
} from "./registro/evidencias.js";
import {
    mostrarConfirmacion,
    guardarRegistro
} from "./registro/confirmacion.js";
import {
    renderizarHistorial,
    renderizarRecientes,
    inicializarHistorial
} from "./historial.js";

const $ = selector => document.querySelector(selector);

let pasoActual = 1;

function mostrarMensaje(elemento, mensaje, tipo = "error") {
    elemento.textContent = mensaje;
    elemento.className = `message ${tipo}`;
}

async function cambiarVista(vista) {
    const vistas = {
        dashboard: {
            elemento: "#dashboardView",
            titulo: "Panel del operador"
        },
        registro: {
            elemento: "#registroView",
            titulo: "Registrar contenedor"
        },
        historial: {
            elemento: "#historialView",
            titulo: "Historial de registros"
        }
    };

    if (!vistas[vista]) return;

    document.querySelectorAll(".view-section").forEach(seccion => {
        seccion.classList.add("hidden");
    });

    $(vistas[vista].elemento).classList.remove("hidden");
    $("#pageTitle").textContent = vistas[vista].titulo;

    document.querySelectorAll(".nav-link").forEach(boton => {
        boton.classList.toggle(
            "active",
            boton.dataset.view === vista
        );
    });

    try {
        if (vista === "dashboard") {
            await actualizarDashboard();
        }

        if (vista === "historial") {
            await renderizarHistorial();
        }
    } catch (error) {
        console.error("Error al cambiar de vista:", error);
        window.alert(error.message || "No fue posible cargar los registros.");
    }
}

function cambiarPaso(numero) {
    pasoActual = numero;

    [1, 2, 3].forEach(paso => {
        $(`#step${paso}`).classList.toggle("hidden", paso !== numero);

        const indicador = $(`[data-step-indicator="${paso}"]`);
        indicador.classList.toggle("active", paso === numero);
        indicador.classList.toggle("completed", paso < numero);
    });
}

async function actualizarDashboard() {
    const registros = await listarContenedores();

    const totalFotos = registros.reduce(
        (total, registro) =>
            total +
            (registro.fotografias?.length || 0) +
            (registro.fotografiaSello ? 1 : 0),
        0
    );

    $("#totalContainers").textContent = registros.length;
    $("#totalPhotos").textContent = totalFotos;

    if (registros.length > 0) {
        const ultimo = registros[0];
        $("#lastRegistration").textContent =
            `${ultimo.fecha || ""} ${ultimo.hora || ""}`.trim();
    } else {
        $("#lastRegistration").textContent = "Sin registros";
    }

    await renderizarRecientes();
}

function limpiarFormulario() {
    $("#ocrForm").reset();

    $("#containerNumber").value = "";
    $("#carrier").value = "";
    $("#containerStatus").value = "";
    actualizarRequisitoSello("");

    $("#yard").value = "";
    $("#yard").dispatchEvent(new Event("change"));

    $("#spot").value = "";
    $("#observations").value = "";

    $("#ocrMessage").textContent = "";
    $("#ocrMessage").className = "message hidden";

    $("#scanButton").disabled = false;
    $("#scanButton").textContent = "Escanear con OCR";

    limpiarEvidencias();
    cambiarPaso(1);
}

function inicializarPatioUbicacion() {
    const patio = $("#yard");
    const ubicacion = $("#location");

    const ubicacionesPorPatio = {
        "T-REX": ["Zona A", "Zona B", "Zona C", "Zona D"],
        "FÓSIL": ["Fila 1", "Fila 2", "Fila 3", "Fila 4"]
    };

    patio.addEventListener("change", () => {
        const opciones = ubicacionesPorPatio[patio.value] || [];

        ubicacion.innerHTML = "";

        const opcionInicial = document.createElement("option");
        opcionInicial.value = "";
        opcionInicial.textContent = opciones.length
            ? "Selecciona una ubicación"
            : "Primero selecciona un patio";

        ubicacion.appendChild(opcionInicial);

        opciones.forEach(nombre => {
            const opcion = document.createElement("option");
            opcion.value = nombre;
            opcion.textContent = nombre;
            ubicacion.appendChild(opcion);
        });

        ubicacion.disabled = opciones.length === 0;
    });

    patio.value = "";
    patio.dispatchEvent(new Event("change"));
}

function inicializarNavegacion() {
    document.querySelectorAll("[data-view]").forEach(boton => {
        boton.addEventListener("click", () => {
            void cambiarVista(boton.dataset.view);
        });
    });

    document.querySelectorAll("[data-go]").forEach(boton => {
        boton.addEventListener("click", () => {
            void cambiarVista(boton.dataset.go);
        });
    });
}

function inicializarOCR() {
    $("#ocrForm").addEventListener("submit", async event => {
        event.preventDefault();

        const archivo = $("#scanImage").files[0];
        const modo = $("#scanMode").value;
        const boton = $("#scanButton");
        const mensaje = $("#ocrMessage");

        if (!archivo) {
            mostrarMensaje(mensaje, "Selecciona una fotografía primero.");
            return;
        }

        boton.disabled = true;
        boton.textContent = "Procesando...";
        mensaje.className = "message info";
        mensaje.textContent =
            "Analizando fotografía. Esto puede tardar unos segundos.";

        try {
            const resultado = await procesarOCR(archivo, modo);

            if (!resultado.encontrado) {
                mostrarMensaje(
                    mensaje,
                    resultado.mensaje ||
                    "No se encontró un identificador. Intenta otra fotografía."
                );
                return;
            }

            $("#containerNumber").value = resultado.valor || "";

            const confianza = resultado.confianza !== undefined
                ? `${resultado.confianza}%`
                : "No disponible";

            const revision = resultado.requiere_revision
                ? " Revisa el número antes de continuar."
                : "";

            mostrarMensaje(
                mensaje,
                `Identificador detectado: ${resultado.valor}. Confianza: ${confianza}.${revision}`,
                "success"
            );
        } catch (error) {
            mostrarMensaje(mensaje, error.message);
        } finally {
            boton.disabled = false;
            boton.textContent = "Escanear con OCR";
        }
    });
}

function inicializarPasoUno() {
    $("#toEvidence").addEventListener("click", () => {
        const datos = obtenerDatosFormulario();
        const validacion = validarDatosContenedor(datos);

        if (!validacion.valido) {
            const mensaje = $("#ocrMessage");
            mostrarMensaje(mensaje, validacion.errores.join(" "));
            mensaje.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
            return;
        }

        cambiarPaso(2);
    });
}

function inicializarPasoDos() {
    $("#containerStatus").addEventListener("change", event => {
        actualizarRequisitoSello(event.target.value);
    });

    $("#evidenceInput").addEventListener("change", async event => {
        try {
            await agregarFotografias(event.target.files);
        } catch (error) {
            mostrarMensaje($("#evidenceMessage"), error.message);
        }

        event.target.value = "";
    });

    $("#sealEvidenceInput").addEventListener("change", async event => {
        try {
            await agregarFotografiaSello(event.target.files[0]);
        } catch (error) {
            mostrarMensaje($("#sealEvidenceMessage"), error.message);
        }

        event.target.value = "";
    });

    $("#backToData").addEventListener("click", () => cambiarPaso(1));

    $("#toConfirmation").addEventListener("click", () => {
        const datos = obtenerDatosFormulario();

        if (!validarEvidencias()) {
            mostrarMensaje(
                $("#evidenceMessage"),
                "Debes agregar al menos una fotografía general para continuar."
            );
            return;
        }

        if (!validarFotografiaSello(datos.estado)) {
            const mensaje = $("#sealEvidenceMessage");

            mostrarMensaje(
                mensaje,
                "Debes agregar la fotografía del sello para el status seleccionado."
            );

            mensaje.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });

            return;
        }

        mostrarConfirmacion(
            datos,
            obtenerFotografias(),
            obtenerFotografiaSello()
        );

        cambiarPaso(3);
    });
}

function inicializarPasoTres() {
    $("#backToEvidence").addEventListener("click", () => cambiarPaso(2));

    $("#saveRegistration").addEventListener("click", async () => {
        const boton = $("#saveRegistration");
        const mensaje = $("#confirmationMessage");

        const datos = obtenerDatosFormulario();
        const fotografias = obtenerFotografias();
        const fotografiaSello = obtenerFotografiaSello();

        const validacion = validarDatosContenedor(datos);
        const evidenciasValidas = validarEvidencias();
        const selloValido = validarFotografiaSello(datos.estado);

        const errores = [...validacion.errores];

        if (!evidenciasValidas) {
            errores.push("Agrega al menos una fotografía general.");
        }

        if (!selloValido) {
            errores.push(
                "Agrega la fotografía del sello para el status seleccionado."
            );
        }

        if (errores.length > 0) {
            mostrarMensaje(mensaje, errores.join(" "));
            return;
        }

        boton.disabled = true;
        boton.textContent = "Guardando...";

        try {
            await guardarRegistro(
                datos,
                fotografias,
                fotografiaSello
            );

            mostrarMensaje(
                mensaje,
                "¡Registro guardado correctamente!",
                "success"
            );

            await actualizarDashboard();

            boton.textContent = "Registro guardado";

            window.alert("El contenedor se registró correctamente.");

            limpiarFormulario();
            await cambiarVista("historial");

        } catch (error) {
            mostrarMensaje(mensaje, error.message);
            boton.disabled = false;
            boton.textContent = "Confirmar y guardar";
        }
    });
}

function inicializarDatosOperador() {
    const nombre = "Operador";

    $("#operatorName").textContent = nombre;
    $("#welcomeName").textContent = nombre;

    const fecha = new Date();

    $("#currentDate").textContent = fecha.toLocaleDateString("es-MX", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    });

    $("#operationDate").textContent = fecha.toLocaleDateString("es-MX");
    $("#operatorShift").textContent = "Matutino";
    $("#shiftManager").textContent = "Por asignar";
}

async function iniciarAplicacion() {
    inicializarDatosOperador();
    inicializarNavegacion();
    inicializarPatioUbicacion();
    inicializarOCR();
    inicializarPasoUno();
    inicializarPasoDos();
    actualizarRequisitoSello($("#containerStatus").value);
    inicializarPasoTres();
    inicializarHistorial();

    await cambiarVista("dashboard");
}

document.addEventListener("DOMContentLoaded", () => {
    iniciarAplicacion().catch(error => {
        console.error("Error al iniciar la aplicación:", error);
        window.alert(
            error.message || "No fue posible cargar el inventario del servidor."
        );
    });
});