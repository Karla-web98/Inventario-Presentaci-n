"use strict";

const TIPOS_PERMITIDOS = [
    "image/jpeg",
    "image/png",
    "image/webp"
];

const MAX_FOTOS = 5;
const MAX_TAMANO_ORIGINAL = 10 * 1024 * 1024;

function comprimirImagen(archivo) {
    return new Promise((resolve, reject) => {
        if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
            reject(new Error(`${archivo.name}: formato no permitido.`));
            return;
        }

        if (archivo.size > MAX_TAMANO_ORIGINAL) {
            reject(new Error(`${archivo.name}: supera el límite de 10 MB.`));
            return;
        }

        const lector = new FileReader();

        lector.onerror = () => reject(
            new Error(`No se pudo leer ${archivo.name}.`)
        );

        lector.onload = () => {
            const imagen = new Image();

            imagen.onerror = () => reject(
                new Error(`No se pudo procesar ${archivo.name}.`)
            );

            imagen.onload = () => {
                const maximo = 1100;
                const escala = Math.min(
                    1,
                    maximo / Math.max(imagen.width, imagen.height)
                );

                const canvas = document.createElement("canvas");
                canvas.width = Math.max(1, Math.round(imagen.width * escala));
                canvas.height = Math.max(1, Math.round(imagen.height * escala));

                const contexto = canvas.getContext("2d");

                if (!contexto) {
                    reject(new Error("No se pudo procesar la fotografía."));
                    return;
                }

                contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height);

                const resultado = canvas.toDataURL("image/jpeg", 0.62);

                resolve({
                    nombre: archivo.name,
                    tipo: "image/jpeg",
                    data: resultado
                });
            };

            imagen.src = lector.result;
        };

        lector.readAsDataURL(archivo);
    });
}

export async function prepararFotografias(archivos, cantidadActual = 0) {
    const seleccionados = Array.from(archivos);

    if (cantidadActual + seleccionados.length > MAX_FOTOS) {
        throw new Error("Puedes registrar un máximo de 5 fotografías.");
    }

    const fotografias = [];

    for (const archivo of seleccionados) {
        fotografias.push(await comprimirImagen(archivo));
    }

    return fotografias;
}