import { PROGRAM_CONFIG } from "./config.js";

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-program-name]').forEach(el => {
        el.textContent = PROGRAM_CONFIG.name;
    });

    document.querySelectorAll('[data-program-download]').forEach(el => {
        el.setAttribute('download', "Planificacion_" + PROGRAM_CONFIG.nameSlug + ".pdf");
    });
});
