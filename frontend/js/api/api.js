"use strict";

const STORAGE_KEY = "inventario_operador_registros";

export function obtenerRegistros() {
    try {
        const contenido = localStorage.getItem(STORAGE_KEY);
        const registros = contenido ? JSON.parse(contenido) : [];
        return Array.isArray(registros) ? registros : [];
    } catch (error) {
        console.error("No se pudieron leer los registros:", error);
        return [];
    }
}

export function guardarRegistros(registros) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(registros));
        return true;
    } catch (error) {
        console.error("Error al guardar:", error);

        if (error.name === "QuotaExceededError") {
            throw new Error(
                "El almacenamiento del navegador está lleno. Elimina algunos registros o fotografías e inténtalo nuevamente."
            );
        }

        throw new Error("No fue posible guardar la información en este navegador.");
    }
}