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
    const planificationBtnContainer = document.getElementById('planification-btn-container');
    const rehearsalSection = document.getElementById('rehearsal-section');

    const concertSection = document.getElementById('concert-section');
    const concertSectionTitle = document.getElementById('concert-section-title');
    const concertSectionSubtitle = document.getElementById('concert-section-subtitle');
    const concertOptions = document.getElementById('concertOptions');

    const groupSelection = document.getElementById('group-selection');
    const groupOptions = document.getElementById('groupOptions');
    const singleGroupDisplay = document.getElementById('single-group-display');
    const singleGroupName = document.getElementById('single-group-name');
    const noGroupsDisplay = document.getElementById('no-groups-display');

    const pdfModal = document.getElementById('pdfModal');
    const closeModal = document.querySelector('.close-modal');

    let fpInstances = [];
    let selectedGroup = '';
    let activeGroup = null;
    let calendarsInitialized = false;

    const instrumentOptions = PROGRAM_CONFIG.instrumentOptions;

    // Marca/desmarca como obligatorios todos los campos condicionales,
    // incluidos los que se generan dinámicamente (conciertos).
    function setConditionalRequired(required) {
        document.querySelectorAll('.conditional-required').forEach(input => {
            input.required = required;
        });
    }

    // Paleta curada para las categorías de los calendarios. Se amplía a 14
    // tonos distintos para que los tipos no repitan color tan rápido.
    const colorPalette = [
        { bg: '#e3f2fd', border: '#90caf9', text: '#1565c0' }, // Azul
        { bg: '#fff3e0', border: '#ffb74d', text: '#e65100' }, // Naranja
        { bg: '#fce4ec', border: '#f06292', text: '#880e4f' }, // Rosa
        { bg: '#e8f5e9', border: '#a5d6a7', text: '#2e7d32' }, // Verde
        { bg: '#f3e5f5', border: '#ce93d8', text: '#7b1fa2' }, // Púrpura
        { bg: '#e0f2f1', border: '#80cbc4', text: '#00695c' }, // Turquesa
        { bg: '#fff8e1', border: '#ffd54f', text: '#8d6e00' }, // Ámbar
        { bg: '#e8eaf6', border: '#9fa8da', text: '#283593' }, // Índigo
        { bg: '#ffebee', border: '#ef9a9a', text: '#b71c1c' }, // Rojo
        { bg: '#f1f8e9', border: '#aed581', text: '#33691e' }, // Lima
        { bg: '#e0f7fa', border: '#4dd0e1', text: '#006064' }, // Cian
        { bg: '#fde7f3', border: '#ec7fc4', text: '#8e2a6b' }, // Magenta
        { bg: '#efebe9', border: '#bcaaa4', text: '#4e342e' }, // Marrón
        { bg: '#eceff1', border: '#b0bec5', text: '#37474f' }  // Pizarra
    ];

    // Devuelve un color distinto para cada categoría. Si alguna vez hay más
    // categorías que colores en la paleta, se generan tonos adicionales.
    function getCategoryColor(index) {
        if (index < colorPalette.length) return colorPalette[index];

        const hue = Math.round((index * 137.508) % 360); // ángulo áureo
        return {
            bg: `hsl(${hue}, 85%, 94%)`,
            border: `hsl(${hue}, 60%, 68%)`,
            text: `hsl(${hue}, 75%, 28%)`
        };
    }

    function updateInstrumentOptions(group) {
        const select = document.getElementById('instrument');
        const currentValue = select.value;
        select.innerHTML = '<option value="" disabled selected>Seleccione su instrumento/voz</option>';
        (instrumentOptions[group] || []).forEach(opt => {
            select.innerHTML += `<option value="${opt}">${opt}</option>`;
        });
        if (currentValue && (instrumentOptions[group] || []).includes(currentValue)) {
            select.value = currentValue;
        }
    }

    // ---------------------------------------------------------------------
    // Detección de agrupaciones a partir de los archivos de fechas
    // ---------------------------------------------------------------------

    function getGroupConfig(key) {
        return (PROGRAM_CONFIG.groups || {})[key] || {};
    }

    function getGroupOrder() {
        return PROGRAM_CONFIG.groupOrder || Object.keys(PROGRAM_CONFIG.groups || {});
    }

    // Comprueba que una cadena sea una fecha real en formato DD/MM/YYYY.
    function isValidDateString(value) {
        const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
        if (!match) return false;

        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        const year = parseInt(match[3], 10);

        const date = new Date(year, month - 1, day);
        return date.getFullYear() === year
            && date.getMonth() === month - 1
            && date.getDate() === day;
    }

    // Convierte el contenido de un archivo de fechas en datos utilizables.
    function parseDatesFile(text) {
        const allowed = [];
        const datesData = {}; // { "DD/MM/YYYY": "Tipo" }
        const categoriesMap = new Map(); // lowerCase -> nombre original
        const categoryColors = {}; // lowerCase -> { colors, displayName }
        const concerts = []; // [{ date, type, info }]
        const concertDates = new Set();

        // Eliminar un posible BOM al inicio del archivo.
        const content = text.replace(/^\uFEFF/, '');

        content.split(/\r?\n/).filter(l => l.trim()).forEach(line => {
            const parts = line.split('|');
            const dateStr = parts[0].trim();
            if (!dateStr) return;

            if (!isValidDateString(dateStr)) {
                console.warn('Línea ignorada por fecha no válida:', line.trim());
                return;
            }

            allowed.push(dateStr);

            const type = (parts[1] || '').trim();
            if (type) {
                datesData[dateStr] = type;
                const lowerType = type.toLowerCase();
                if (!categoriesMap.has(lowerType)) {
                    categoriesMap.set(lowerType, type);
                }
            }

            // Un tercer campo (o varios) añade información extra al concierto.
            const info = parts.slice(2).map(p => p.trim()).filter(Boolean).join(' · ');

            if (type.toLowerCase().includes('concierto') && !concertDates.has(dateStr)) {
                concertDates.add(dateStr);
                concerts.push({ date: dateStr, type, info });
            }
        });

        let colorIdx = 0;
        categoriesMap.forEach((originalName, lowerType) => {
            categoryColors[lowerType] = {
                colors: getCategoryColor(colorIdx),
                displayName: originalName
            };
            colorIdx++;
        });

        return { allowed, datesData, categoryColors, concerts };
    }

    async function fetchText(url) {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) return null;
        return response.text();
    }

    // Comprueba si un archivo existe sin descargarlo entero (HEAD con fallback a GET).
    async function fileExists(url) {
        try {
            let response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
            if (response.status === 405 || response.status === 501) {
                response = await fetch(url, { cache: 'no-store' });
            }
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    // Si la detección no puede ejecutarse (por ejemplo al abrir con file://),
    // se asume el comportamiento clásico con todas las agrupaciones.
    function fallbackGroups() {
        return getGroupOrder().map(key => {
            const cfg = getGroupConfig(key);
            return {
                key,
                label: cfg.label || key,
                fechas: cfg.fechas,
                planificacion: cfg.planificacion,
                hasPdf: true
            };
        });
    }

    async function detectGroups() {
        const found = [];

        for (const key of getGroupOrder()) {
            const cfg = getGroupConfig(key);
            if (!cfg.fechas) continue;

            try {
                const text = await fetchText(cfg.fechas);
                if (!text) continue; // 404: agrupación no disponible

                const parsed = parseDatesFile(text);
                if (parsed.allowed.length === 0) continue; // archivo sin fechas válidas

                const hasPdf = cfg.planificacion ? await fileExists(cfg.planificacion) : false;
                found.push({
                    key,
                    label: cfg.label || key,
                    fechas: cfg.fechas,
                    planificacion: cfg.planificacion,
                    hasPdf,
                    ...parsed
                });
            } catch (error) {
                console.warn('No se pudo detectar la agrupación, se muestran todas:', error);
                return null;
            }
        }

        return found;
    }

    // ---------------------------------------------------------------------
    // Calendarios de fechas de ausencia
    // ---------------------------------------------------------------------

    function generateLegend(categoryColors) {
        const legendContainer = document.getElementById('calendarLegend');
        if (!legendContainer) return;

        legendContainer.innerHTML = '';

        Object.values(categoryColors).forEach(({ displayName, colors }) => {
            const item = document.createElement('div');
            item.className = 'legend-item';

            item.innerHTML = `
                <span class="dot" style="background-color: ${colors.bg}; border: 1px solid ${colors.border}"></span>
                ${displayName}
            `;
            legendContainer.appendChild(item);
        });
    }

    // Fail-open: carga y parsea las fechas de la agrupación si aún no están.
    async function ensureGroupData(entry) {
        if (entry.allowed) return entry;

        let parsed = { allowed: [], datesData: {}, categoryColors: {}, concerts: [] };
        try {
            const text = await fetchText(entry.fechas);
            if (text) parsed = parseDatesFile(text);
        } catch (error) {
            console.error('Error cargando fechas:', error);
        }

        Object.assign(entry, parsed);
        return entry;
    }

    async function initCalendars(entry) {
        const data = await ensureGroupData(entry);
        const { allowed, datesData, categoryColors } = data;
        const container = document.getElementById('dynamicCalendarsContainer');

        if (typeof flatpickr !== 'undefined' && allowed.length > 0 && container) {
            generateLegend(categoryColors);
            container.innerHTML = '';
            fpInstances = [];

            // 1. Identificar meses/años únicos
            const monthYears = new Set();
            allowed.forEach(dateStr => {
                const [d, m, y] = dateStr.split('/');
                monthYears.add(`${y}-${m}`);
            });

            // 2. Ordenar cronológicamente
            const sortedMonths = Array.from(monthYears).sort();

            // 3. Crear función de actualización compartida
            const updateFn = function () {
                const allSelected = [];
                fpInstances.forEach(fp => allSelected.push(...fp.selectedDates));

                allSelected.sort((a, b) => a - b);
                const formatted = allSelected.map(d => flatpickr.formatDate(d, "d/m/Y"));
                document.getElementById('absenceDates').value = formatted.join(', ');
            };

            const configBase = {
                mode: "multiple",
                inline: true,
                dateFormat: "d/m/Y",
                locale: "es",
                monthSelectorType: "static",
                enable: allowed,
                onChange: updateFn,
                onDayCreate: function (dObj, dStr, fp, dayElem) {
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

    async function ensureCalendars(entry) {
        if (calendarsInitialized) return;
        await initCalendars(entry);
        calendarsInitialized = true;
    }

    // ---------------------------------------------------------------------
    // Sección de conciertos
    // ---------------------------------------------------------------------

    // Genera todas las combinaciones posibles, del total a ninguna.
    function generateConcertCombinations(concerts) {
        const total = Math.pow(2, concerts.length);
        const combinations = [];

        for (let mask = total - 1; mask >= 0; mask--) {
            const selected = concerts.filter((concert, index) => mask & (1 << index));
            combinations.push({ mask, selected });
        }

        combinations.sort((a, b) => b.selected.length - a.selected.length || a.mask - b.mask);
        return combinations;
    }

    // Fecha en negrita + información extra como etiqueta destacada.
    function createConcertDetail(concert) {
        const detail = document.createElement('span');
        detail.className = 'concert-detail';

        const date = document.createElement('strong');
        date.className = 'concert-date';
        date.textContent = concert.date;
        detail.appendChild(date);

        if (concert.info) {
            const info = document.createElement('span');
            info.className = 'concert-info';
            info.textContent = concert.info;
            detail.appendChild(info);
        }

        return detail;
    }

    function appendConcertDetails(container, concerts) {
        concerts.forEach((concert, index) => {
            if (index > 0) container.appendChild(document.createTextNode(' · '));
            container.appendChild(createConcertDetail(concert));
        });
    }

    function appendBoldText(container, value) {
        const strong = document.createElement('strong');
        strong.textContent = value;
        container.appendChild(strong);
    }

    function createConcertOptionText(selected, concerts) {
        const text = document.createElement('span');
        text.className = 'concert-option-text';

        if (selected.length === 0) {
            if (concerts.length === 1) {
                text.textContent = 'No puedo participar en el concierto';
            } else {
                text.appendChild(document.createTextNode('No puedo participar en '));
                appendBoldText(text, 'ninguno');
                text.appendChild(document.createTextNode(' de los conciertos'));
            }
            return text;
        }

        if (selected.length === concerts.length) {
            if (concerts.length === 1) {
                text.textContent = 'Puedo participar en el concierto';
            } else {
                text.appendChild(document.createTextNode('Puedo participar en '));
                appendBoldText(text, 'todos');
                text.appendChild(document.createTextNode(' los conciertos'));
            }
            return text;
        }

        text.appendChild(document.createTextNode('Solo puedo participar en: '));
        appendConcertDetails(text, selected);
        return text;
    }

    function renderConcertSection(entry) {
        const concerts = entry.concerts || [];
        concertOptions.innerHTML = '';

        // Sin conciertos: se oculta la pregunta y se pasa directamente a ensayos.
        if (concerts.length === 0) {
            concertSection.classList.add('hidden');
            rehearsalSection.classList.remove('hidden');
            return;
        }

        concertSection.classList.remove('hidden');
        rehearsalSection.classList.add('hidden');

        concertSectionTitle.innerHTML = `Participación en ${concerts.length === 1 ? 'el concierto' : 'los conciertos'} <span data-program-name></span>`;
        const programName = concertSectionTitle.querySelector('[data-program-name]');
        if (programName) programName.textContent = PROGRAM_CONFIG.name;

        concertSectionSubtitle.textContent = '';
        if (concerts.length === 1) {
            concertSectionSubtitle.appendChild(createConcertDetail(concerts[0]));
        } else {
            const subtitleLabel = document.createElement('span');
            subtitleLabel.className = 'concert-subtitle-label';
            subtitleLabel.textContent = 'Conciertos previstos: ';
            concertSectionSubtitle.appendChild(subtitleLabel);
            appendConcertDetails(concertSectionSubtitle, concerts);
        }

        if (concerts.length > 5) {
            console.warn(`Hay ${concerts.length} conciertos: se generarán ${Math.pow(2, concerts.length)} combinaciones.`);
        }

        generateConcertCombinations(concerts).forEach((combination, index) => {
            const label = document.createElement('label');
            label.className = 'radio-option';

            const input = document.createElement('input');
            input.type = 'radio';
            input.name = 'concertAvailability';
            input.value = String(index);
            input.className = 'concert-choice conditional-required';
            input.dataset.dates = combination.selected.map(c => c.date).join(', ');

            label.appendChild(input);
            label.appendChild(createConcertOptionText(combination.selected, concerts));
            concertOptions.appendChild(label);
        });
    }

    // ---------------------------------------------------------------------
    // Selección de agrupación
    // ---------------------------------------------------------------------

    async function selectGroup(entry) {
        activeGroup = entry;
        selectedGroup = entry.key;

        updateInstrumentOptions(entry.key);

        // Reiniciar estado dependiente de la agrupación
        calendarsInitialized = false;
        fpInstances = [];

        const calendarsContainer = document.getElementById('dynamicCalendarsContainer');
        if (calendarsContainer) calendarsContainer.innerHTML = '';
        const legend = document.getElementById('calendarLegend');
        if (legend) legend.innerHTML = '';
        const absenceDatesInput = document.getElementById('absenceDates');
        if (absenceDatesInput) absenceDatesInput.value = '';

        absenceDatesGroup.classList.add('hidden');
        Array.from(rehearsalRadios).forEach(r => r.checked = false);

        readPlanification.checked = false;
        restOfForm.classList.add('hidden');
        confirmationSection.classList.add('hidden');
        setConditionalRequired(false);

        await ensureGroupData(entry);
        renderConcertSection(entry);

        if (entry.hasPdf) {
            // Flujo normal: descargar y leer la planificación antes de continuar.
            planificationBtnContainer.classList.remove('hidden');
            readPlanification.required = true;
            return;
        }

        // Sin planificación disponible: se simplifica el flujo y se accede
        // directamente al formulario.
        planificationBtnContainer.classList.add('hidden');
        readPlanification.required = false;

        await ensureCalendars(entry);
        restOfForm.classList.remove('hidden');
        setConditionalRequired(true);
    }

    function setupGroups(groups) {
        if (groups.length === 0) {
            groupSelection.classList.add('hidden');
            singleGroupDisplay.classList.add('hidden');
            noGroupsDisplay.classList.remove('hidden');
            planificationBtnContainer.classList.add('hidden');
            form.classList.add('hidden');
            return;
        }

        if (groups.length === 1) {
            // Formulario simplificado: no se pregunta la agrupación.
            groupSelection.classList.add('hidden');
            noGroupsDisplay.classList.add('hidden');
            singleGroupName.textContent = groups[0].label;
            singleGroupDisplay.classList.remove('hidden');
            selectGroup(groups[0]);
            return;
        }

        groupSelection.classList.remove('hidden');
        singleGroupDisplay.classList.add('hidden');
        noGroupsDisplay.classList.add('hidden');
        planificationBtnContainer.classList.add('hidden');
        groupOptions.innerHTML = '';

        groups.forEach(entry => {
            const label = document.createElement('label');
            label.className = 'radio-option';
            label.innerHTML = `
                <input type="radio" name="grupo" value="${entry.key}" class="grupo-radio">
                <span><strong>${entry.label}</strong></span>
            `;

            const radio = label.querySelector('input');
            radio.addEventListener('change', () => selectGroup(entry));
            groupOptions.appendChild(label);
        });
    }

    const detected = await detectGroups();
    setupGroups(detected === null ? fallbackGroups() : detected);

    // ---------------------------------------------------------------------
    // Modal del PDF de planificación
    // ---------------------------------------------------------------------

    if (downloadPlan) {
        downloadPlan.addEventListener('click', () => {
            if (!activeGroup || !activeGroup.planificacion) return;

            const pdfViewer = document.getElementById('pdfViewer');
            const pdfPath = activeGroup.planificacion;

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

                    pdfjsLib.getDocument(pdfPath).promise.then(function (pdfDoc) {
                        pdfViewer.innerHTML = '';

                        for (let num = 1; num <= pdfDoc.numPages; num++) {
                            const canvas = document.createElement('canvas');
                            pdfViewer.appendChild(canvas);

                            pdfDoc.getPage(num).then(function (page) {
                                const ctx = canvas.getContext('2d');
                                const viewport = page.getViewport({ scale: 2.0 });

                                canvas.height = viewport.height;
                                canvas.width = viewport.width;

                                const renderContext = {
                                    canvasContext: ctx,
                                    viewport: viewport
                                };
                                page.render(renderContext);
                            });
                        }
                    }).catch(function (error) {
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

    // ---------------------------------------------------------------------
    // Resto del formulario
    // ---------------------------------------------------------------------

    // Toggle form view based on first checkbox (lazy init calendars)
    readPlanification.addEventListener('change', async (e) => {
        if (e.target.checked) {
            if (!calendarsInitialized && activeGroup) {
                await ensureCalendars(activeGroup);
            }
            restOfForm.classList.remove('hidden');
            setConditionalRequired(true);
            fpInstances.forEach(fp => fp.redraw());
        } else {
            restOfForm.classList.add('hidden');
            setConditionalRequired(false);
        }
    });

    // Mostrar la sección de ensayos solo si puede asistir a algún concierto.
    function resetRehearsalSection() {
        rehearsalSection.classList.add('hidden');
        absenceDatesGroup.classList.add('hidden');
        document.getElementById('absenceDates').value = '';
        Array.from(rehearsalRadios).forEach(r => r.checked = false);
        fpInstances.forEach(fp => fp.clear());
    }

    concertOptions.addEventListener('change', (e) => {
        if (!e.target.classList.contains('concert-choice')) return;

        if (e.target.dataset.dates) {
            rehearsalSection.classList.remove('hidden');
        } else {
            resetRehearsalSection();
        }
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

        if (!selectedGroup) {
            alert("No hay ninguna agrupación disponible en este momento.");
            return;
        }

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

            // Lista de conciertos a los que puede asistir (vacío = ninguno).
            let concertAvailability = '-';
            if (!concertSection.classList.contains('hidden')) {
                const selectedDates = document.querySelector('.concert-choice:checked')?.dataset.dates || '';
                concertAvailability = selectedDates || 'No participa';
            }

            const { error } = await supabase.from("respuestas_asistencia").insert({
                grupo: selectedGroup,
                full_name: raw.fullName || '',
                instrument: raw.instrument || '',
                concert_availability: concertAvailability,
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
