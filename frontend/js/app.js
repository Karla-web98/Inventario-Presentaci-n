"use strict";

const operatorRole = document.querySelector("#operatorRole");
const adminRole = document.querySelector("#adminRole");

function entrarComoOperador() {
    window.location.href = "/operador";
}

function entrarComoAdministrador() {
    window.location.href = "/administrador";
}

operatorRole?.addEventListener("click", entrarComoOperador);
adminRole?.addEventListener("click", entrarComoAdministrador);

operatorRole?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        entrarComoOperador();
    }
});

adminRole?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        entrarComoAdministrador();
    }
});