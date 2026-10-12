import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { supabaseConfig } from "./supabase-config.js";
import { PROGRAM_CONFIG } from "./config.js";

const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);

const AFTERNOON_TABLE = "respuestas_ensayos_tarde";

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('afternoonForm');
    const instrumentSelect = document.getElementById('instrument');
    const dateOptions = document.getElementById('dateOptions');
    const submitBtn = document.getElementById('submitBtn');

    // Instrumentos de orquesta (fuente única: config.js, compartida con el formulario principal)
    const instruments = (PROGRAM_CONFIG.instrumentOptions.orquesta) || [];
    instruments.forEach(opt => {
        instrumentSelect.innerHTML += `<option value="${opt}">${opt}</option>`;
    });

    // Fechas configurables (desde config.js)
    const rehearsals = PROGRAM_CONFIG.afternoonRehearsals || [];
    const infoDates = document.getElementById('infoDates');
    if (infoDates) {
        if (rehearsals.length === 0) {
            infoDates.innerHTML = '<p style="margin-bottom:0;color:#888;">No hay fechas configuradas.</p>';
        } else {
            infoDates.innerHTML = rehearsals
                .map((r, i) => `<p style="margin:0 0 ${i === rehearsals.length - 1 ? 0 : 5}px;"><strong>${r.label}</strong></p>`)
                .join('');
        }
    }

    if (rehearsals.length === 0) {
        dateOptions.innerHTML = '<p style="color:#888;">No hay fechas configuradas.</p>';
    }

    // Opciones mutuamente excluyentes: una fecha, ambas, o ninguna (obligatorio)
    const CHOICE_NAME = 'afternoonChoice';
    let firstRadio = null;
    const addChoice = (value, labelHtml) => {
        const label = document.createElement('label');
        label.className = 'radio-option';
        label.innerHTML = `
            <input type="radio" name="${CHOICE_NAME}" value="${value}" class="afternoon-choice">
            <span>${labelHtml}</span>
        `;
        dateOptions.appendChild(label);
        if (!firstRadio) firstRadio = label.querySelector('input');
    };

    rehearsals.forEach(r => {
        addChoice(r.date, `${r.label} <small class="clarification">(${r.date})</small>`);
    });
    if (rehearsals.length >= 2) {
        addChoice('todas', rehearsals.length === 2 ? 'Ambas fechas' : 'Todas las fechas');
    }
    addChoice('ninguna', 'Ninguna de las fechas');
    if (firstRadio) firstRadio.required = true;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const choice = document.querySelector('.afternoon-choice:checked')?.value || '';
        if (!choice) {
            alert("Por favor, selecciona una de las opciones de disponibilidad.");
            return;
        }

        let selected;
        if (choice === 'todas') selected = rehearsals.map(r => r.date);
        else if (choice === 'ninguna') selected = [];
        else selected = [choice];
        const availableDates = selected.length > 0 ? selected.join(', ') : '-';

        const raw = Object.fromEntries(new FormData(form).entries());
        const originalBtnText = submitBtn.innerText;
        submitBtn.disabled = true;
        submitBtn.innerText = 'Enviando...';

        try {
            const { error } = await supabase.from(AFTERNOON_TABLE).insert({
                full_name: raw.fullName || '',
                instrument: raw.instrument || '',
                available_dates: availableDates
            });
            if (error) throw error;
            window.location.href = 'thank-you-ensayos.html';
        } catch (error) {
            const code = error?.code || error?.status || '';
            console.error("Error adding document:", {
                message: error?.message,
                code: error?.code,
                status: error?.status,
                details: error?.details,
                hint: error?.hint
            }, error);
            let msg = "Hubo un error al guardar tu respuesta.";
            if (/row-level security|permission|42501|403/i.test(String(error?.message) + code)) {
                msg += "\n\n(Error de permisos/RLS en Supabase: falta la política de INSERT para la tabla respuestas_ensayos_tarde.)";
            }
            alert(msg);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = originalBtnText;
        }
    });
});
