"use strict";

import { escanearIdentificador } from "../../api/ocr.js";

export async function procesarOCR(archivo, modo) {
    if (!archivo) {
        throw new Error("Selecciona una fotografía para escanear.");
    }

    return await escanearIdentificador(archivo, modo);
}