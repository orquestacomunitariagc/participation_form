import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { firebaseConfig } from "./assets/firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('responseForm');
    const readPlanification = document.getElementById('readPlanification');
    const confirmationSection = document.getElementById('confirmation-section');
    const downloadPlan = document.getElementById('downloadPlan');
    const restOfForm = document.getElementById('rest-of-form');
    const rehearsalRadios = document.getElementsByName('rehearsalCommitment');
    const absenceDatesGroup = document.getElementById('absence-dates-group');
    const conditionalRequiredInputs = document.querySelectorAll('.conditional-required');

    const pdfModal = document.getElementById('pdfModal');
    const closeModal = document.querySelector('.close-modal');

    let fpMarch, fpApril, fpMay, fpJune; // Declaradas aquí para ser accesibles globalmente en el scope

    // Manejar apertura del modal del PDF
    if (downloadPlan) {
        downloadPlan.addEventListener('click', () => {
            if (pdfModal) {
                pdfModal.classList.remove('hidden');
                document.body.style.overflow = 'hidden'; // Evitar scroll de fondo
            }
            if (confirmationSection) {
                confirmationSection.classList.remove('hidden');
            }
        });
    }

    // Cerrar modal
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            pdfModal.classList.add('hidden');
            document.body.style.overflow = 'auto';
        });
    }

    // Cerrar si hace clic fuera del contenido
    window.addEventListener('click', (e) => {
        if (e.target === pdfModal) {
            pdfModal.classList.add('hidden');
            document.body.style.overflow = 'auto';
        }
    });

    let datesData = {}; // Objeto para guardar { "DD/MM/YYYY": "Tipo" }
    let categoryColors = {}; // Mapeo de Categoría -> Colores

    const colorPalette = [
        { bg: '#e3f2fd', border: '#90caf9', text: '#1565c0' }, // Azul
        { bg: '#fff3e0', border: '#ffb74d', text: '#e65100' }, // Naranja
        { bg: '#fce4ec', border: '#f06292', text: '#880e4f' }, // Rosa
        { bg: '#e8f5e9', border: '#a5d6a7', text: '#2e7d32' }, // Verde
        { bg: '#f3e5f5', border: '#ce93d8', text: '#7b1fa2' }, // Púrpura
        { bg: '#e0f2f1', border: '#80cbc4', text: '#00695c' }  // Turquesa
    ];

    // Función para cargar fechas desde el archivo externo
    async function loadAllowedDates() {
        try {
            const response = await fetch('assets/fechas_ensayos.txt');
            if (!response.ok) throw new Error('No se pudo cargar el archivo de fechas');
            const text = await response.text();
            
            const allowed = [];
            const categories = new Set();
            
            text.split('\n').filter(l => l.trim()).forEach(line => {
                const parts = line.split('|');
                const dateStr = parts[0].trim();
                if (dateStr) {
                    allowed.push(dateStr);
                    if (parts[1]) {
                        const type = parts[1].trim();
                        datesData[dateStr] = type;
                        categories.add(type);
                    }
                }
            });

            // Asignar colores a categorías detectadas
            let colorIdx = 0;
            categories.forEach(cat => {
                categoryColors[cat.toLowerCase()] = colorPalette[colorIdx % colorPalette.length];
                colorIdx++;
            });

            return allowed;
        } catch (error) {
            console.error("Error cargando fechas:", error);
            return [];
        }
    }

    // Generar leyenda dinámica
    function generateLegend() {
        const legendContainer = document.getElementById('calendarLegend');
        if (!legendContainer) return;
        
        legendContainer.innerHTML = ''; // Limpiar
        
        Object.entries(categoryColors).forEach(([name, colors]) => {
            const item = document.createElement('div');
            item.className = 'legend-item';
            
            const displayName = name.charAt(0).toUpperCase() + name.slice(1);
            
            item.innerHTML = `
                <span class="dot" style="background-color: ${colors.bg}; border: 1px solid ${colors.border}"></span>
                ${displayName}
            `;
            legendContainer.appendChild(item);
        });
    }

    // Inicializar todo el sistema de calendarios de forma asíncrona
    async function initCalendars() {
        const allowedDates = await loadAllowedDates();

        if (typeof flatpickr !== 'undefined' && allowedDates.length > 0) {
            generateLegend();

            const updateFn = function() {
                const allSelected = [];
                if(fpMarch) allSelected.push(...fpMarch.selectedDates);
                if(fpApril) allSelected.push(...fpApril.selectedDates);
                if(fpMay) allSelected.push(...fpMay.selectedDates);
                if(fpJune) allSelected.push(...fpJune.selectedDates);
                
                allSelected.sort((a,b) => a - b);
                const formatted = allSelected.map(d => flatpickr.formatDate(d, "d/m/Y"));
                document.getElementById('absenceDates').value = formatted.join(', ');
            };

            const configBase = {
                mode: "multiple",
                inline: true,
                dateFormat: "d/m/Y",
                locale: "es",
                monthSelectorType: "static",
                enable: allowedDates,
                onChange: updateFn,
                onDayCreate: function(dObj, dStr, fp, dayElem) {
                    const dateString = flatpickr.formatDate(dayElem.dateObj, "d/m/Y");
                    const type = datesData[dateString];
                    if (type) {
                        const colors = categoryColors[type.toLowerCase()];
                        if (colors) {
                            dayElem.style.backgroundColor = colors.bg;
                            dayElem.style.borderColor = colors.border;
                            dayElem.style.color = colors.text;
                        }
                    }
                }
            };

            fpMarch = flatpickr("#cal-march", Object.assign({}, configBase, { 
                minDate: new Date(2026, 2, 1), maxDate: new Date(2026, 2, 31) 
            }));
            fpApril = flatpickr("#cal-april", Object.assign({}, configBase, { 
                minDate: new Date(2026, 3, 1), maxDate: new Date(2026, 3, 30) 
            }));
            fpMay   = flatpickr("#cal-may",   Object.assign({}, configBase, { 
                minDate: new Date(2026, 4, 1), maxDate: new Date(2026, 4, 31) 
            }));
            fpJune  = flatpickr("#cal-june",  Object.assign({}, configBase, { 
                minDate: new Date(2026, 5, 1), maxDate: new Date(2026, 5, 30) 
            }));
        }
    }

    // Esperar a que los calendarios se carguen antes de continuar
    await initCalendars();

    // Toggle form view based on first checkbox
    readPlanification.addEventListener('change', (e) => {
        if (e.target.checked) {
            restOfForm.classList.remove('hidden');
            conditionalRequiredInputs.forEach(input => input.required = true);
            
            if (fpMarch) fpMarch.redraw();
            if (fpApril) fpApril.redraw();
            if (fpMay) fpMay.redraw();
            if (fpJune) fpJune.redraw();
        } else {
            restOfForm.classList.add('hidden');
            conditionalRequiredInputs.forEach(input => input.required = false);
        }
    });

    // Toggle absence dates conditionally
    rehearsalRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'Asistencia a la mayoría, salvo fechas') {
                absenceDatesGroup.classList.remove('hidden');
                setTimeout(() => {
                    if (fpMarch) fpMarch.redraw();
                    if (fpApril) fpApril.redraw();
                    if (fpMay) fpMay.redraw();
                    if (fpJune) fpJune.redraw();
                }, 10);
            } else {
                absenceDatesGroup.classList.add('hidden');
                if (fpMarch) fpMarch.clear();
                if (fpApril) fpApril.clear();
                if (fpMay) fpMay.clear();
                if (fpJune) fpJune.clear();
                document.getElementById('absenceDates').value = '';
            }
        });
    });

    // Handle Form Submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const isMostDaysSelected = Array.from(rehearsalRadios).find(r => r.checked)?.value === 'Asistencia a la mayoría, salvo fechas';
        let finalAbsenceDates = document.getElementById('absenceDates')?.value || '';

        if (isMostDaysSelected && !finalAbsenceDates) {
            alert("Por favor, selecciona al menos un día de ausencia en los calendarios.");
            return;
        }

        const submitBtn = document.getElementById('submitBtn');
        const originalBtnText = submitBtn.innerText;
        submitBtn.disabled = true;
        submitBtn.innerText = 'Enviando...';

        try {
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            if (isMostDaysSelected) {
                data.absenceDates = finalAbsenceDates;
            } else {
                data.absenceDates = '-';
            }
            
            data.timestamp = serverTimestamp();
            await addDoc(collection(db, "respuestas_aniversario_ocgc"), data);
            window.location.href = 'thank-you.html';
        } catch (error) {
            console.error("Error adding document: ", error);
            alert("Hubo un error al guardar tu respuesta.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = originalBtnText;
        }
    });
});
