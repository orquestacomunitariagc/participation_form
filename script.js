import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { supabaseConfig } from "./assets/supabase-config.js";
import { PROGRAM_CONFIG } from "./assets/config.js";

const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);

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

    let fpInstances = [];
    let selectedGroup = '';
    let calendarsInitialized = false;

    const instrumentOptions = PROGRAM_CONFIG.instrumentOptions;

    function updateInstrumentOptions(group) {
        const select = document.getElementById('instrument');
        const currentValue = select.value;
        select.innerHTML = '<option value="" disabled selected>Seleccione su instrumento/voz</option>';
        (instrumentOptions[group] || []).forEach(opt => {
            select.innerHTML += `<option value="${opt}">${opt}</option>`;
        });
        if (currentValue && instrumentOptions[group].includes(currentValue)) {
            select.value = currentValue;
        }
    }

    // Manejar apertura del modal del PDF
    if (downloadPlan) {
        downloadPlan.addEventListener('click', () => {
            const pdfViewer = document.getElementById('pdfViewer');
            const pdfPath = selectedGroup === 'coro'
                ? 'assets/planificacion_coro.pdf'
                : 'assets/planificacion_orquesta.pdf';

            const modalDownloadLink = document.getElementById('modalDownloadLink');
            if (modalDownloadLink) {
                modalDownloadLink.href = pdfPath;
            }

            if (pdfModal) {
                pdfModal.classList.remove('hidden');
                document.body.style.overflow = 'hidden';
            }
            if (confirmationSection) {
                confirmationSection.classList.remove('hidden');
            }

            if (pdfViewer) {
                pdfViewer.innerHTML = '<div style="color:white; text-align:center; padding:50px; font-weight:600; font-family: inherit;">Cargando documento...</div>';

                const pdfjsLib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
                if (pdfjsLib) {
                    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

                    pdfjsLib.getDocument(pdfPath).promise.then(function(pdfDoc) {
                        pdfViewer.innerHTML = '';

                        for(let num = 1; num <= pdfDoc.numPages; num++) {
                            const canvas = document.createElement('canvas');
                            pdfViewer.appendChild(canvas);

                            pdfDoc.getPage(num).then(function(page) {
                                const ctx = canvas.getContext('2d');
                                const viewport = page.getViewport({scale: 2.0});

                                canvas.height = viewport.height;
                                canvas.width = viewport.width;

                                const renderContext = {
                                    canvasContext: ctx,
                                    viewport: viewport
                                };
                                page.render(renderContext);
                            });
                        }
                    }).catch(function(error) {
                        console.error('Error procesando PDF: ', error);
                        pdfViewer.innerHTML = `
                            <div style="color:white; text-align:center; padding:40px;">
                                <p style="margin-bottom:20px;">Hubo un problema al cargar el visor.</p>
                                <a href="${pdfPath}" target="_blank" style="background:var(--primary-color); color:white; padding:12px 24px; border-radius:50px; text-decoration:none; font-weight:bold;">Ver PDF directamente</a>
                            </div>
                        `;
                    });
                } else {
                    pdfViewer.innerHTML = '<div style="color:white; text-align:center; padding:50px;">Error: No se pudo cargar el motor de PDF.</div>';
                }
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
    async function loadAllowedDates(group) {
        const file = group === 'coro' ? 'assets/fechas_ensayos_coro.txt' : 'assets/fechas_ensayos_orquesta.txt';
        try {
            const response = await fetch(file);
            if (!response.ok) throw new Error('No se pudo cargar el archivo de fechas');
            const text = await response.text();
            
            const allowed = [];
            const categoriesMap = new Map(); // Mapa de lowercase -> OriginalName
            
            text.split('\n').filter(l => l.trim()).forEach(line => {
                const parts = line.split('|');
                const dateStr = parts[0].trim();
                if (dateStr) {
                    allowed.push(dateStr);
                    if (parts[1]) {
                        const type = parts[1].trim();
                        datesData[dateStr] = type;
                        
                        const lowerType = type.toLowerCase();
                        if (!categoriesMap.has(lowerType)) {
                            categoriesMap.set(lowerType, type);
                        }
                    }
                }
            });

            // Asignar colores a categorías detectadas respetando el nombre original
            let colorIdx = 0;
            categoriesMap.forEach((originalName, lowerType) => {
                categoryColors[lowerType] = {
                    colors: colorPalette[colorIdx % colorPalette.length],
                    displayName: originalName
                };
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
        
        Object.values(categoryColors).forEach(({displayName, colors}) => {
            const item = document.createElement('div');
            item.className = 'legend-item';
            
            item.innerHTML = `
                <span class="dot" style="background-color: ${colors.bg}; border: 1px solid ${colors.border}"></span>
                ${displayName}
            `;
            legendContainer.appendChild(item);
        });
    }

    // Inicializar todo el sistema de calendarios de forma asíncrona
    async function initCalendars(group) {
        const allowedDates = await loadAllowedDates(group);
        const container = document.getElementById('dynamicCalendarsContainer');

        if (typeof flatpickr !== 'undefined' && allowedDates.length > 0 && container) {
            generateLegend();
            container.innerHTML = ''; // Limpiar contenedor
            fpInstances = [];

            // 1. Identificar meses/años únicos
            const monthYears = new Set();
            allowedDates.forEach(dateStr => {
                const [d, m, y] = dateStr.split('/');
                monthYears.add(`${y}-${m}`);
            });

            // 2. Ordenar cronológicamente
            const sortedMonths = Array.from(monthYears).sort();

            // 3. Crear función de actualización compartida
            const updateFn = function() {
                const allSelected = [];
                fpInstances.forEach(fp => allSelected.push(...fp.selectedDates));
                
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
                        const category = categoryColors[type.toLowerCase()];
                        if (category && category.colors) {
                            const c = category.colors;
                            dayElem.style.backgroundColor = c.bg;
                            dayElem.style.borderColor = c.border;
                            dayElem.style.color = c.text;
                        }
                    }
                }
            };

            // 4. Crear e inicializar cada mes
            sortedMonths.forEach(my => {
                const [year, month] = my.split('-');
                const monthNum = parseInt(month) - 1;
                const yearNum = parseInt(year);

                const calDiv = document.createElement('div');
                calDiv.className = 'cal-instance-wrapper';
                const calId = `cal-${my}`;
                calDiv.innerHTML = `<input type="text" id="${calId}" class="cal-inline" style="display:none;">`;
                container.appendChild(calDiv);

                const fp = flatpickr(`#${calId}`, Object.assign({}, configBase, {
                    minDate: new Date(yearNum, monthNum, 1),
                    maxDate: new Date(yearNum, monthNum, 31) // flatpickr lo ajusta solo al fin de mes
                }));
                fpInstances.push(fp);
            });
        }
    }

    // Toggle form view based on first checkbox (lazy init calendars)
    readPlanification.addEventListener('change', async (e) => {
        if (e.target.checked) {
            if (!calendarsInitialized && selectedGroup) {
                await initCalendars(selectedGroup);
                calendarsInitialized = true;
            }
            restOfForm.classList.remove('hidden');
            conditionalRequiredInputs.forEach(input => input.required = true);
            fpInstances.forEach(fp => fp.redraw());
        } else {
            restOfForm.classList.add('hidden');
            conditionalRequiredInputs.forEach(input => input.required = false);
        }
    });

    // Group selection handler
    document.querySelectorAll('.grupo-radio').forEach(radio => {
        radio.addEventListener('change', (e) => {
            selectedGroup = e.target.value;
            document.getElementById('planification-btn-container').classList.remove('hidden');
            updateInstrumentOptions(selectedGroup);
            calendarsInitialized = false;
            fpInstances = [];
        });
    });

    // Show rehearsal section only if user will attend the concert
    const concertRadios = document.getElementsByName('concertAvailability');
    const rehearsalSection = document.getElementById('rehearsal-section');

    concertRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'Participa') {
                rehearsalSection.classList.remove('hidden');
            } else {
                rehearsalSection.classList.add('hidden');
                absenceDatesGroup.classList.add('hidden');
                document.getElementById('absenceDates').value = '';
                Array.from(rehearsalRadios).forEach(r => r.checked = false);
                fpInstances.forEach(fp => fp.clear());
            }
        });
    });

    // Toggle absence dates conditionally
    rehearsalRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'Asistencia a la mayoría, salvo fechas') {
                absenceDatesGroup.classList.remove('hidden');
                setTimeout(() => {
                    fpInstances.forEach(fp => fp.redraw());
                }, 10);
            } else {
                absenceDatesGroup.classList.add('hidden');
                fpInstances.forEach(fp => fp.clear());
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
            const raw = Object.fromEntries(formData.entries());

            const absenceDates = isMostDaysSelected ? finalAbsenceDates : '-';

            const { error } = await supabase.from("respuestas_asistencia").insert({
                grupo: selectedGroup,
                full_name: raw.fullName || '',
                instrument: raw.instrument || '',
                concert_availability: raw.concertAvailability || '',
                rehearsal_commitment: raw.rehearsalCommitment || '',
                absence_dates: absenceDates,
                observations: raw.observations || ''
            });
            if (error) throw error;
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
