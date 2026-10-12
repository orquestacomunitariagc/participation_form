import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { supabaseConfig } from "./assets/supabase-config.js";
import { PROGRAM_CONFIG } from "./assets/config.js";

const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);

// DOM Elements
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const responsesBody = document.getElementById('responsesBody');
const totalCount = document.getElementById('total-count');
const filteredCountLabel = document.getElementById('filtered-count-label');
const exportBtn = document.getElementById('exportBtn');
const exportExcelBtn = document.getElementById('exportExcelBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');

// Views
const viewButtons = {
    table: document.getElementById('viewTableBtn'),
    members: document.getElementById('viewMembersBtn'),
    sections: document.getElementById('viewSectionsBtn'),
    afternoon: document.getElementById('viewAfternoonBtn')
};
const viewContainers = {
    table: document.getElementById('view-table'),
    members: document.getElementById('view-members'),
    sections: document.getElementById('view-sections'),
    afternoon: document.getElementById('view-afternoon')
};
let currentView = 'table';
const datesCache = { orquesta: null, coro: null };

// Filters
const filters = {
    grupo: document.getElementById('filterGrupo'),
    instrument: document.getElementById('filterInstrument'),
    concertAvailability: document.getElementById('filterConcerts'),
    rehearsalCommitment: document.getElementById('filterRehearsals')
};

let allData = [];
let displayedData = [];
let afternoonData = [];

// Dev-only default credentials (file gitignored: assets/dev-auth.js)
let devSession = false;
let devAuthCache = null;
let devAuthLoaded = false;

async function loadDevAuth() {
    if (devAuthLoaded) return devAuthCache;
    devAuthLoaded = true;
    try {
        const mod = await import('./assets/dev-auth.js');
        devAuthCache = mod.default || null;
    } catch (e) {
        devAuthCache = null;
    }
    return devAuthCache;
}

function showDashboard() {
    loginSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
}

function showLogin() {
    loginSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
}

async function showDevHint() {
    const devAuth = await loadDevAuth();
    const hint = document.getElementById('devHint');
    if (hint && devAuth) {
        hint.textContent = `(Dev) Usuario: ${devAuth.email} · Contraseña: ${devAuth.password}`;
        hint.style.display = 'block';
    }
}

function checkSession() {
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            showDashboard();
            loadData();
        } else {
            showLogin();
        }
    });
}

supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
        showDashboard();
        loadData();
    } else if (event === 'SIGNED_OUT') {
        showLogin();
        allData = [];
        afternoonData = [];
    }
});

checkSession();
showDevHint();

// Login Handler
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.style.display = 'none';
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const devAuth = await loadDevAuth();
    if (devAuth && email === devAuth.email && password === devAuth.password) {
        devSession = true;
        showDashboard();
        loadData();
        return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        loginError.textContent = "Error: Credenciales incorrectas o usuario no encontrado.";
        loginError.style.display = 'block';
    }
});

logoutBtn.addEventListener('click', () => {
    if (devSession) {
        devSession = false;
        showLogin();
        allData = [];
        afternoonData = [];
    } else {
        supabase.auth.signOut();
    }
});

// Load Data
async function loadData() {
    try {
        const { data, error } = await supabase
            .from("respuestas_asistencia")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        allData = data || [];

        try {
            const { data: afternoon, error: afternoonError } = await supabase
                .from("respuestas_ensayos_tarde")
                .select("*")
                .order("created_at", { ascending: false });
            if (afternoonError) throw afternoonError;
            afternoonData = afternoon || [];
        } catch (afternoonErr) {
            console.warn("No se pudieron cargar las respuestas de ensayos de tarde:", afternoonErr);
            afternoonData = [];
        }

        populateDynamicFilters();
        renderTable(allData);

    } catch (error) {
        console.error("Error loading data:", error);
        alert("Error al cargar datos. Verifica permisos.");
    }
}

function getUniqueValues(key) {
    const values = new Set();
    allData.forEach(row => {
        if (row[key]) values.add(row[key]);
    });
    return Array.from(values).sort();
}

function populateDynamicFilters() {
    populateSelect(filters.grupo, getUniqueValues('grupo'), "Grupo (Todos)");
    populateSelect(filters.instrument, getUniqueValues('instrument'), "Instrumento (Todos)");
    populateSelect(filters.concertAvailability, getUniqueValues('concertAvailability'), "Conciertos (Todos)");
    populateSelect(filters.rehearsalCommitment, getUniqueValues('rehearsalCommitment'), "Ensayos (Todos)");
}

function populateSelect(selectResult, options, defaultText) {
    selectResult.innerHTML = `<option value="">${defaultText}</option>`;
    options.forEach(opt => {
        selectResult.innerHTML += `<option value="${opt}">${opt}</option>`;
    });
}

function renderTable(data) {
    displayedData = data;
    responsesBody.innerHTML = '';
    refreshActiveView();
    let count = 0;

    data.forEach(row => {
        count++;
        const date = row.created_at ? new Date(row.created_at).toLocaleString() : 'N/A';

        const grupoLabel = row.grupo === 'coro' ? 'Coro' : row.grupo === 'orquesta' ? 'Orquesta' : '-';

        const tr = `
            <tr>
                <td>${date}</td>
                <td><strong>${grupoLabel}</strong></td>
                <td><strong>${row.full_name || '-'}</strong></td>
                <td>${row.instrument || '-'}</td>
                <td>${row.concert_availability || '-'}</td>
                <td>${row.rehearsal_commitment || '-'}</td>
                <td>${row.absence_dates || '-'}</td>
                <td>${row.observations || '-'}</td>
            </tr>
        `;
        responsesBody.innerHTML += tr;
    });

    totalCount.textContent = allData.length;
    if (data.length !== allData.length) {
        filteredCountLabel.textContent = `(Filtrados: ${count})`;
    } else {
        filteredCountLabel.textContent = '';
    }
}

// Filter Logic
function applyFilters() {
    const filtersValues = {
        grupo: filters.grupo.value,
        instrument: filters.instrument.value,
        concertAvailability: filters.concertAvailability.value,
        rehearsalCommitment: filters.rehearsalCommitment.value
    };

    const filteredData = allData.filter(row => {
        return Object.keys(filtersValues).every(key => {
            const filterVal = filtersValues[key];
            if (!filterVal) return true;
            return row[key] === filterVal;
        });
    });

    renderTable(filteredData);
}

Object.values(filters).forEach(select => {
    select.addEventListener('change', applyFilters);
});

clearFiltersBtn.addEventListener('click', () => {
    Object.values(filters).forEach(select => select.value = "");
    applyFilters();
});

// View Toggle
function setView(view) {
    currentView = view;
    Object.keys(viewButtons).forEach(key => {
        viewButtons[key].classList.toggle('active', key === view);
        viewContainers[key].classList.toggle('hidden', key !== view);
    });
    refreshActiveView();
}

function activeGroupKey() {
    return filters.grupo.value === 'coro' ? 'coro' : 'orquesta';
}

function refreshActiveView() {
    if (currentView === 'members') renderMembersView(displayedData);
    else if (currentView === 'sections') renderSectionsView(displayedData);
    else if (currentView === 'afternoon') renderAfternoonView(afternoonData);
}

// ---- Vista "Ensayos de tarde" (tabla respuestas_ensayos_tarde) ----

function splitAfternoonDates(value) {
    return String(value || '')
        .split(',')
        .map(s => s.trim())
        .filter(s => s && s !== '-');
}

function getAfternoonDates() {
    const configured = (PROGRAM_CONFIG.afternoonRehearsals || []).map(r => r.date);
    const extra = [];
    afternoonData.forEach(row => {
        splitAfternoonDates(row.available_dates).forEach(d => {
            if (!configured.includes(d) && !extra.includes(d)) extra.push(d);
        });
    });
    return [...configured, ...extra];
}

function renderAfternoonView(data) {
    const container = viewContainers.afternoon;
    if (!data || data.length === 0) {
        container.innerHTML = emptyStateHTML();
        return;
    }

    const dates = getAfternoonDates();
    let html = '<table><thead><tr><th>Fecha</th><th>Nombre</th><th>Instrumento</th>';
    dates.forEach(d => { html += `<th>${d}</th>`; });
    html += '<th>Total</th></tr></thead><tbody>';

    data.forEach(row => {
        const chosen = splitAfternoonDates(row.available_dates);
        const created = row.created_at ? new Date(row.created_at).toLocaleString() : '-';
        html += `<tr>
            <td>${created}</td>
            <td><strong>${row.full_name || '-'}</strong></td>
            <td>${row.instrument || '-'}</td>`;
        dates.forEach(d => {
            const has = chosen.includes(d);
            html += `<td class="emoji-cell" style="${has ? 'color:#2e7d32;font-weight:700;' : 'color:#bbb;'}">${has ? '✓' : '–'}</td>`;
        });
        html += `<td class="pct-cell">${chosen.length}</td></tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

Object.keys(viewButtons).forEach(key => {
    viewButtons[key].addEventListener('click', () => setView(key));
});

function pctRgb(p) {
    const x = Math.max(0, Math.min(1, p)) * 2;
    let r, g, b;
    if (x <= 1) {
        const k = x;
        r = Math.round(248 + (255 - 248) * k);
        g = Math.round(105 + (235 - 105) * k);
        b = Math.round(107 + (132 - 107) * k);
    } else {
        const k = x - 1;
        r = Math.round(255 + (99 - 255) * k);
        g = Math.round(235 + (190 - 235) * k);
        b = Math.round(132 + (123 - 132) * k);
    }
    return [r, g, b];
}

function pctColor(p) {
    const [r, g, b] = pctRgb(p);
    return `rgb(${r},${g},${b})`;
}

function emptyStateHTML() {
    return '<p style="padding: 20px; color: #666;">Sin datos para mostrar.</p>';
}

async function renderMembersView(data) {
    const container = viewContainers.members;
    if (data.length === 0) {
        container.innerHTML = emptyStateHTML();
        return;
    }
    const dates = await fetchRehearsalDates(activeGroupKey());
    const sorted = [...data].sort((a, b) =>
        (a.instrument || '').toLowerCase().localeCompare((b.instrument || '').toLowerCase()) ||
        (a.full_name || '').localeCompare(b.full_name || '')
    );
    const rehearsalCols = [];
    dates.forEach((d, i) => { if (!d.isConcert) rehearsalCols.push(i); });

    let html = `<table><thead><tr><th>Grupo</th><th>Nombre</th><th>Instrumento</th><th>Conciertos</th>`;
    dates.forEach(d => { html += `<th>${d.date}</th>`; });
    html += `<th>% Asistencia</th></tr></thead><tbody>`;

    sorted.forEach(row => {
        const emojis = dates.map(d => statusEmoji(row, d.date, d.isConcert));
        let greens = 0;
        rehearsalCols.forEach(i => { if (emojis[i] === "🟩") greens++; });
        const pct = rehearsalCols.length > 0 ? greens / rehearsalCols.length : null;
        html += `<tr><td>${row.grupo === 'coro' ? 'Coro' : row.grupo === 'orquesta' ? 'Orquesta' : '-'}</td>`;
        html += `<td><strong>${row.full_name || '-'}</strong></td>`;
        html += `<td>${row.instrument || '-'}</td>`;
        html += `<td>${row.concert_availability || '-'}</td>`;
        emojis.forEach(e => { html += `<td class="emoji-cell">${e}</td>`; });
        html += `<td class="pct-cell">${pct === null ? '-' : (pct * 100).toFixed(2) + '%'}</td></tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

async function renderSectionsView(data) {
    const container = viewContainers.sections;
    if (data.length === 0) {
        container.innerHTML = emptyStateHTML();
        return;
    }
    const dates = await fetchRehearsalDates(activeGroupKey());
    const instruments = Array.from(new Set(data.map(d => d.instrument || '-'))).sort();

    const counts = instruments.map(inst => {
        const rows = data.filter(r => (r.instrument || '-') === inst);
        return {
            inst,
            plantilla: rows.length,
            perDate: dates.map(d => rows.filter(r => statusEmoji(r, d.date, d.isConcert) === "🟩").length)
        };
    });
    const totals = dates.map((_, di) => counts.reduce((s, c) => s + c.perDate[di], 0));
    const totalPlantilla = counts.reduce((s, c) => s + c.plantilla, 0);

    const header = `<thead><tr><th>Instrumento</th><th>Plantilla</th>${dates.map(d => `<th>${d.date}</th>`).join('')}</tr></thead>`;

    let html = `<h3 class="summary-title">Conteos por sección</h3>`;
    html += `<table>${header}<tbody>`;
    counts.forEach(c => {
        html += `<tr><td>${c.inst}</td><td>${c.plantilla}</td>${c.perDate.map(n => `<td>${n}</td>`).join('')}</tr>`;
    });
    html += `<tr class="total-row"><td>TOTAL GENERAL</td><td>${totalPlantilla}</td>${totals.map(n => `<td>${n}</td>`).join('')}</tr></tbody></table>`;

    html += `<h3 class="summary-title">Porcentajes por sección</h3>`;
    html += `<table>${header}<tbody>`;
    counts.forEach(c => {
        html += `<tr><td>${c.inst}</td><td>${c.plantilla}</td>`;
        c.perDate.forEach(n => {
            const p = c.plantilla > 0 ? n / c.plantilla : null;
            html += `<td class="pct-cell" style="background-color:${p === null ? '' : pctColor(p)}">${p === null ? '-' : Math.round(p * 100) + '%'}</td>`;
        });
        html += `</tr>`;
    });
    html += `<tr class="total-row"><td>TOTAL GENERAL</td><td>${totalPlantilla}</td>`;
    dates.forEach((_, di) => {
        const p = totalPlantilla > 0 ? totals[di] / totalPlantilla : null;
        html += `<td class="pct-cell" style="background-color:${p === null ? '' : pctColor(p)}">${p === null ? '-' : Math.round(p * 100) + '%'}</td>`;
    });
    html += `</tr></tbody></table>`;

    container.innerHTML = html;
}

exportBtn.addEventListener('click', () => {
    if (currentView === 'afternoon') return exportAfternoonCsv();
    if (displayedData.length === 0) return;

    const headers = ["Fecha", "Grupo", "Nombre", "Instrumento", "Conciertos", "Ensayos", "Fechas Ausencia", "Observaciones"];
    const csvRows = [headers.join(',')];

    displayedData.forEach(row => {
        const date = row.created_at ? new Date(row.created_at).toLocaleString().replace(',', '') : 'N/A';
        const values = [
            date,
            `"${row.grupo === 'coro' ? 'Coro' : row.grupo === 'orquesta' ? 'Orquesta' : ''}"`,
            `"${row.full_name || ''}"`,
            `"${row.instrument || ''}"`,
            `"${row.concert_availability || ''}"`,
            `"${row.rehearsal_commitment || ''}"`,
            `"${row.absence_dates || ''}"`,
            `"${row.observations || ''}"`
        ];
        csvRows.push(values.join(','));
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "respuestas_formulario.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// Load Rehearsal Dates (per group, cached)
async function fetchRehearsalDates(group = 'orquesta') {
    const key = group === 'coro' ? 'coro' : 'orquesta';
    if (datesCache[key]) return datesCache[key];
    try {
        const response = await fetch(`assets/fechas_ensayos_${key}.txt`);
        if (!response.ok) return [];
        const text = await response.text();
        datesCache[key] = text.split('\n')
            .filter(line => line.trim().length > 0)
            .map(line => {
                const parts = line.split('|');
                return {
                    date: (parts[0] || '').trim(),
                    isConcert: ((parts[1] || '').trim().toLowerCase().includes('concierto'))
                };
            });
        return datesCache[key];
    } catch (error) {
        console.error("Error fetching rehearsal dates:", error);
        return [];
    }
}

function statusEmoji(row, date, isConcert) {
    const commitment = row.rehearsal_commitment;
    if (isConcert) {
        return (row.concert_availability || "") === "Participa" ? "🟩" : "🟥";
    }
    if (commitment === "Asistencia regular") return "🟩";
    if (commitment === "No puedo comprometer asistencia regular") return "🟧";
    if (commitment === "Asistencia a la mayoría, salvo fechas") {
        const absences = (row.absence_dates || "").split(',').map(d => d.trim());
        return absences.includes(date) ? "🟥" : "🟩";
    }
    return "-";
}

function colLetter(index) {
    let letters = '';
    let n = index;
    while (n > 0) {
        const rem = (n - 1) % 26;
        letters = String.fromCharCode(65 + rem) + letters;
        n = Math.floor((n - 1) / 26);
    }
    return letters;
}

function compareByInstrument(a, b) {
    return (a.instrument || "").toLowerCase().localeCompare((b.instrument || "").toLowerCase());
}

function dedupeLatest(rows) {
    const byKey = new Map();
    rows.forEach(row => {
        const key = `${(row.instrument || "-").trim().toLowerCase()}|${(row.full_name || "").trim().toLowerCase()}`;
        const prev = byKey.get(key);
        if (!prev || new Date(row.created_at || 0) > new Date(prev.created_at || 0)) {
            byKey.set(key, row);
        }
    });
    return Array.from(byKey.values());
}

async function addGroupSheets(workbook, rows, group, mixed) {
    const rehearsalDates = await fetchRehearsalDates(group);

    const sortedData = [...rows].sort(compareByInstrument);
    const instruments = Array.from(new Set(sortedData.map(d => d.instrument || "-"))).sort();
    const lastDataRow = sortedData.length + 1;
    const groupLabel = group === 'coro' ? 'Coro' : 'Orquesta';

    // Orden de hojas: Resumen -> Detalle -> Observaciones
    const ws2 = workbook.addWorksheet(mixed ? `Resumen ${groupLabel}` : "Resumen Totales");
    const ws1 = workbook.addWorksheet(mixed ? `Detalle ${groupLabel}` : "Asistencias Detalladas");
    ws1.addRow(["Nombre", "Instrumento", "Conciertos", ...rehearsalDates.map(d => d.date), "% Asistencia"]);

    const rehearsalCols = [];
    rehearsalDates.forEach((d, i) => {
        const col = 4 + i;
        if (!d.isConcert) rehearsalCols.push(col);
    });

    sortedData.forEach(row => {
        const availability = row.concert_availability || "";

        const values = [
            row.full_name || '-',
            row.instrument || '-',
            availability || '-'
        ];

        rehearsalDates.forEach(({ date, isConcert }) => {
            values.push(statusEmoji(row, date, isConcert));
        });

        const rowObj = ws1.addRow(values);

        if (rehearsalCols.length > 0) {
            const sumTerms = rehearsalCols.map(c => `IF(${colLetter(c)}${rowObj.number}="🟩",1,0)`).join("+");
            const pctCell = rowObj.getCell(4 + rehearsalDates.length);
            pctCell.value = {
                formula: `IF(${rehearsalCols.length}=0,"",(${sumTerms})/${rehearsalCols.length})`
            };
            pctCell.numFmt = '0.00%';
        }
    });

    ws1.getColumn(1).width = 30;
    ws1.getColumn(2).width = 20;
    ws1.getColumn(3).width = 25;
    rehearsalDates.forEach((_, i) => ws1.getColumn(4 + i).width = 10);
    if (rehearsalDates.length > 0) ws1.getColumn(4 + rehearsalDates.length).width = 14;

    if (rehearsalCols.length > 0) {
        const pctCol = colLetter(4 + rehearsalDates.length);
        ws1.addConditionalFormatting({
            ref: `${pctCol}2:${pctCol}${lastDataRow}`,
            rules: [{
                type: 'colorScale',
                cfvo: [
                    { type: 'num', value: 0 },
                    { type: 'num', value: 0.5 },
                    { type: 'num', value: 1 }
                ],
                color: [
                    { argb: 'FFF8696B' },
                    { argb: 'FFFFEB84' },
                    { argb: 'FF63BE7B' }
                ],
                priority: 1
            }]
        });
    }

    // --- Resumen Totales (recuentos + porcentajes debajo) ---
    const detailRef = `'${ws1.name}'`;
    const totalRowIndex = 2 + instruments.length;
    const pctHeaderRow = totalRowIndex + 2;
    const pctStartRow = pctHeaderRow + 1;
    const pctTotalRow = pctStartRow + instruments.length;

    ws2.addRow(["Instrumento", "Plantilla", ...rehearsalDates.map(d => d.date)]);

    instruments.forEach((inst, idx) => {
        const r = 2 + idx;
        ws2.getCell(r, 1).value = inst;
        ws2.getCell(r, 2).value = {
            formula: `COUNTIF(${detailRef}!$B$2:$B$${lastDataRow},$A${r})`
        };
        rehearsalDates.forEach((d, di) => {
            const dateCol = colLetter(4 + di);
            ws2.getCell(r, 3 + di).value = {
                formula: `SUMPRODUCT((${detailRef}!$B$2:$B$${lastDataRow}=$A${r})*(${detailRef}!${dateCol}$2:${dateCol}$${lastDataRow}="🟩"))`
            };
        });
    });

    ws2.getCell(totalRowIndex, 1).value = "TOTAL GENERAL";
    ws2.getCell(totalRowIndex, 2).value = {
        formula: `COUNTA(${detailRef}!$B$2:$B$${lastDataRow})`
    };
    rehearsalDates.forEach((d, di) => {
        const dateCol = colLetter(4 + di);
        ws2.getCell(totalRowIndex, 3 + di).value = {
            formula: `SUMPRODUCT(--(${detailRef}!${dateCol}2:${dateCol}${lastDataRow}="🟩"))`
        };
    });

    ws2.addRow([]);
    ws2.addRow(["Instrumento", "Plantilla", ...rehearsalDates.map(d => d.date)]);

    instruments.forEach((inst, idx) => {
        const r = pctStartRow + idx;
        const c = 2 + idx;
        ws2.getCell(r, 1).value = inst;
        ws2.getCell(r, 2).value = { formula: `=$B$${c}` };
        rehearsalDates.forEach((d, di) => {
            const col = 3 + di;
            ws2.getCell(r, col).value = {
                formula: `IF($B$${c}=0,"",${colLetter(col)}$${c}/$B$${c})`
            };
            ws2.getCell(r, col).numFmt = '0%';
        });
    });

    ws2.getCell(pctTotalRow, 1).value = "TOTAL GENERAL";
    ws2.getCell(pctTotalRow, 2).value = { formula: `=$B$${totalRowIndex}` };
    rehearsalDates.forEach((d, di) => {
        const col = 3 + di;
        ws2.getCell(pctTotalRow, col).value = {
            formula: `IF($B$${totalRowIndex}=0,"",${colLetter(col)}$${totalRowIndex}/$B$${totalRowIndex})`
        };
        ws2.getCell(pctTotalRow, col).numFmt = '0%';
    });

    ws2.getColumn(1).width = 20;
    ws2.getColumn(2).width = 20;
    rehearsalDates.forEach((_, i) => ws2.getColumn(3 + i).width = 12);

    if (rehearsalDates.length > 0) {
        ws2.addConditionalFormatting({
            ref: `C${pctStartRow}:${colLetter(2 + rehearsalDates.length)}${pctTotalRow}`,
            rules: [{
                type: 'colorScale',
                cfvo: [
                    { type: 'num', value: 0 },
                    { type: 'num', value: 0.5 },
                    { type: 'num', value: 1 }
                ],
                color: [
                    { argb: 'FFF8696B' },
                    { argb: 'FFFFEB84' },
                    { argb: 'FF63BE7B' }
                ],
                priority: 1
            }]
        });
    }

    // --- Observaciones Especiales ---
    const observationsData = sortedData
        .filter(row => (row.observations || "").trim().length > 0)
        .map(row => ({
            "Nombre": row.full_name || '-',
            "Instrumento": row.instrument || '-',
            "Tipo Asistencia": row.rehearsal_commitment || '-',
            "Observaciones": row.observations
        }));

    if (observationsData.length > 0) {
        const ws4 = workbook.addWorksheet(mixed ? `Observaciones ${groupLabel}` : "Observaciones Especiales");
        ws4.addRow(["Nombre", "Instrumento", "Tipo Asistencia", "Observaciones"]);
        observationsData.forEach(o => ws4.addRow([o.Nombre, o.Instrumento, o["Tipo Asistencia"], o.Observaciones]));
        ws4.getColumn(1).width = 30;
        ws4.getColumn(2).width = 20;
        ws4.getColumn(3).width = 30;
        ws4.getColumn(4).width = 80;
    }
}

exportExcelBtn.addEventListener('click', async () => {
    if (currentView === 'afternoon') return exportAfternoonExcel();
    if (displayedData.length === 0) return;

    const sortedData = dedupeLatest(displayedData).sort(compareByInstrument);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "OCGC";
    workbook.created = new Date();
    workbook.calcProperties = { fullCalcOnLoad: true };

    const coroRows = sortedData.filter(row => row.grupo === 'coro');
    const orquestaRows = sortedData.filter(row => row.grupo !== 'coro');
    const mixed = coroRows.length > 0 && orquestaRows.length > 0;

    if (orquestaRows.length > 0) await addGroupSheets(workbook, orquestaRows, 'orquesta', mixed);
    if (coroRows.length > 0) await addGroupSheets(workbook, coroRows, 'coro', mixed);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = PROGRAM_CONFIG.exportFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
});

// ==================== Exportación PDF ====================
// Espejo exacto de la exportación a Excel: mismas tablas, mismo orden,
// mismos valores calculados y misma escala de color de los formatos condicionales.
// Detalle y Resumen en A4 horizontal ajustados al ancho; Observaciones en A4 vertical.

const PDF_EMOJI_FILL = { '🟩': [99, 190, 123], '🟥': [248, 105, 107], '🟧': [251, 172, 119] };
const PDF_MARGIN = 10;
const PDF_LINE = { lineColor: [170, 170, 170], lineWidth: 0.1 };

function pdfTitleRow(title, colSpan) {
    return [{
        content: title,
        colSpan,
        styles: { halign: 'left', fontStyle: 'bold', fontSize: 10, fillColor: [255, 255, 255], textColor: 40, cellPadding: { top: 0.5, bottom: 2, left: 0.5, right: 0 } }
    }];
}

function pdfTotalStyle(data) {
    if (data.section === 'body' && data.row.raw[0] === 'TOTAL GENERAL') {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [240, 240, 240];
    }
}

async function addGroupPdfSections(doc, rows, group, mixed, firstPage) {
    const rehearsalDates = await fetchRehearsalDates(group);
    const sortedData = [...rows].sort(compareByInstrument);
    const instruments = Array.from(new Set(sortedData.map(d => d.instrument || "-"))).sort();
    const groupLabel = group === 'coro' ? 'Coro' : 'Orquesta';
    const detailTitle = mixed ? `Detalle ${groupLabel}` : "Asistencias Detalladas";
    const summaryTitle = mixed ? `Resumen ${groupLabel}` : "Resumen Totales";
    const obsTitle = mixed ? `Observaciones ${groupLabel}` : "Observaciones Especiales";
    const rehearsalCount = rehearsalDates.filter(d => !d.isConcert).length;

    const greensFor = (rowFilter, { date, isConcert }) =>
        sortedData.filter(r => (!rowFilter || rowFilter(r)) && statusEmoji(r, date, isConcert) === '🟩').length;

    // --- Resumen Totales (página propia: recuentos + porcentajes debajo) ---
    if (!firstPage) doc.addPage('a4', 'landscape');

    const plantillaOf = inst => sortedData.filter(r => (r.instrument || '-') === inst).length;
    const summaryHead = ["Instrumento", "Plantilla", ...rehearsalDates.map(d => d.date)];
    const compactMargin = { left: PDF_MARGIN, right: PDF_MARGIN, top: PDF_MARGIN };
    const compactStyles = { fontSize: 6, cellPadding: 0.7, halign: 'center', textColor: 30, overflow: 'linebreak', ...PDF_LINE };
    const compactHead = { fillColor: [238, 238, 238], textColor: 30, fontStyle: 'bold', fontSize: 6 };

    doc.autoTable({
        head: [pdfTitleRow(summaryTitle, 2 + rehearsalDates.length), summaryHead],
        body: [
            ...instruments.map(inst => [
                inst,
                plantillaOf(inst),
                ...rehearsalDates.map(d => greensFor(r => (r.instrument || '-') === inst, d))
            ]),
            ["TOTAL GENERAL", sortedData.length, ...rehearsalDates.map(d => greensFor(null, d))]
        ],
        margin: compactMargin,
        tableWidth: 'auto',
        styles: compactStyles,
        headStyles: compactHead,
        columnStyles: { 0: { halign: 'left', cellWidth: 38 }, 1: { cellWidth: 26 } },
        didParseCell: pdfTotalStyle
    });

    doc.autoTable({
        head: [summaryHead],
        body: [
            ...instruments.map(inst => {
                const pl = plantillaOf(inst);
                return [
                    inst,
                    pl,
                    ...rehearsalDates.map(d => {
                        const c = greensFor(r => (r.instrument || '-') === inst, d);
                        return pl === 0 ? '' : c / pl;
                    })
                ];
            }),
            ["TOTAL GENERAL",
                sortedData.length,
                ...rehearsalDates.map(d => {
                    const c = greensFor(null, d);
                    return sortedData.length === 0 ? '' : c / sortedData.length;
                })
            ]
        ],
        startY: doc.lastAutoTable.finalY + 5,
        margin: compactMargin,
        tableWidth: 'auto',
        styles: compactStyles,
        headStyles: compactHead,
        columnStyles: { 0: { halign: 'left', cellWidth: 38 }, 1: { cellWidth: 26 } },
        didParseCell: (data) => {
            pdfTotalStyle(data);
            if (data.section === 'body' && data.column.index > 1 && typeof data.cell.raw === 'number') {
                data.cell.text = [Math.round(data.cell.raw * 100) + '%'];
                data.cell.styles.fillColor = pctRgb(data.cell.raw);
            }
        }
    });

    // --- Detalle del grupo (página nueva) ---
    doc.addPage('a4', 'landscape');
    const pctColIndex = 3 + rehearsalDates.length;

    // Anchura de Nombre ajustada al nombre más largo
    doc.setFontSize(compactStyles.fontSize);
    let longestName = "Nombre";
    sortedData.forEach(row => {
        const n = row.full_name || '-';
        if (doc.getTextWidth(n) > doc.getTextWidth(longestName)) longestName = n;
    });
    const nameW = Math.ceil(doc.getTextWidth(longestName)) + 2.5;

    const longestDate = rehearsalDates.reduce((a, d) => (d.date.length > a.length ? d.date : a), "");
    const minDateW = Math.ceil(doc.getTextWidth(longestDate)) + 2;

    const availPerDate = Math.floor((275 - (nameW + 14 + 14 + 16)) / Math.max(1, rehearsalDates.length));
    const dateW = Math.max(minDateW, Math.min(16, availPerDate));

    // Márgenes izquierdo y derecho igualados: si el ancho total excede el útil,
    // se escalan proporcionalmente todas las columnas para que la tabla quepa.
    const layout = [
        [0, nameW],
        [1, 14],
        [2, 14],
        [pctColIndex, 16],
        ...rehearsalDates.map((_, i) => [3 + i, dateW])
    ];
    const totalW = layout.reduce((s, [, w]) => s + w, 0);
    if (totalW > 275) {
        const k = 275 / totalW;
        layout.forEach(col => { col[1] = Math.max(3, Math.floor(col[1] * k * 100) / 100); });
    }

    const detailColumns = {};
    layout.forEach(([idx, w]) => {
        const base = (idx === 0 || idx === 1) ? { halign: 'left' } : {};
        detailColumns[idx] = { ...base, cellWidth: w };
    });

    doc.autoTable({
        head: [
            pdfTitleRow(detailTitle, 4 + rehearsalDates.length),
            ["Nombre", "Instrumento", "Conciertos", ...rehearsalDates.map(d => d.date), "% Asistencia"]
        ],
        body: sortedData.map(row => {
            const pct = rehearsalCount > 0
                ? rehearsalDates.filter(d => !d.isConcert && statusEmoji(row, d.date, false) === '🟩').length / rehearsalCount
                : '';
            return [
                row.full_name || '-',
                row.instrument || '-',
                row.concert_availability || '-',
                ...rehearsalDates.map(({ date, isConcert }) => statusEmoji(row, date, isConcert)),
                pct
            ];
        }),
        margin: compactMargin,
        tableWidth: layout.reduce((s, [, w]) => s + w, 0),
        styles: compactStyles,
        headStyles: compactHead,
        columnStyles: detailColumns,
        didParseCell: (data) => {
            if (data.section !== 'body') return;
            const fill = PDF_EMOJI_FILL[data.cell.raw];
            if (fill) {
                data.cell.styles.fillColor = fill;
                data.cell.text = [''];
            } else if (data.column.index === pctColIndex && typeof data.cell.raw === 'number') {
                data.cell.text = [(data.cell.raw * 100).toFixed(2) + '%'];
                data.cell.styles.fillColor = pctRgb(data.cell.raw);
            }
        }
    });

    // --- Observaciones (página nueva vertical) ---
    const observationsData = sortedData
        .filter(row => (row.observations || "").trim().length > 0)
        .map(row => [
            row.full_name || '-',
            row.instrument || '-',
            row.rehearsal_commitment || '-',
            row.observations
        ]);

    if (observationsData.length > 0) {
        doc.addPage('a4', 'portrait');
        doc.autoTable({
            head: [pdfTitleRow(obsTitle, 4), ["Nombre", "Instrumento", "Tipo Asistencia", "Observaciones"]],
            body: observationsData,
            margin: compactMargin,
            tableWidth: 'auto',
            styles: { fontSize: 7, cellPadding: 1.2, halign: 'left', valign: 'top', textColor: 30, ...PDF_LINE },
            headStyles: { fillColor: [238, 238, 238], textColor: 30, fontStyle: 'bold', fontSize: 7 },
            columnStyles: { 0: { cellWidth: 34 }, 1: { cellWidth: 24 }, 2: { cellWidth: 42 }, 3: { cellWidth: 'auto' } },
            didParseCell: pdfTotalStyle
        });
    }
}

exportPdfBtn.addEventListener('click', async () => {
    if (currentView === 'afternoon') return exportAfternoonPdf();
    if (displayedData.length === 0) return;
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert('No se pudo cargar el generador de PDF.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const sortedData = dedupeLatest(displayedData);

    const coroRows = sortedData.filter(row => row.grupo === 'coro');
    const orquestaRows = sortedData.filter(row => row.grupo !== 'coro');
    const mixed = coroRows.length > 0 && orquestaRows.length > 0;

    let firstPage = true;
    if (orquestaRows.length > 0) {
        await addGroupPdfSections(doc, orquestaRows, 'orquesta', mixed, firstPage);
        firstPage = false;
    }
    if (coroRows.length > 0) {
        await addGroupPdfSections(doc, coroRows, 'coro', mixed, firstPage);
    }

    doc.save(PROGRAM_CONFIG.exportFileName.replace(/\.xlsx$/i, '') + '.pdf');
});

// ==================== Exportación "Ensayos de tarde" ====================
// Versión paralela a la exportación de asistencia, pero limitada a las fechas
// posibles de la tarde (PROGRAM_CONFIG.afternoonRehearsals):
//   Excel: "Resumen Totales" + "Disponibilidad Detallada" (con % y escala de color).
//   PDF:   espejo exacto (Resumen + Detalle) en A4 horizontal.

const AFTERNOON_EMOJI_FILL = { '🟩': [99, 190, 123], '🟥': [248, 105, 107] };

function afternoonDates() {
    return (PROGRAM_CONFIG.afternoonRehearsals || []).map(r => r.date);
}

function statusAfternoonEmoji(row, date) {
    return splitAfternoonDates(row.available_dates).includes(date) ? '🟩' : '🟥';
}

function addAfternoonSheets(workbook, rows) {
    const dates = afternoonDates();
    const sortedData = [...rows].sort(compareByInstrument);
    const instruments = Array.from(new Set(sortedData.map(d => d.instrument || "-"))).sort();
    const lastDataRow = sortedData.length + 1;

    // Orden de hojas: Resumen -> Detalle
    const ws2 = workbook.addWorksheet("Resumen Totales");
    const ws1 = workbook.addWorksheet("Disponibilidad Detallada");
    ws1.addRow(["Nombre", "Instrumento", ...dates, "% Disponibilidad"]);

    const dateCols = dates.map((_, i) => 3 + i);

    sortedData.forEach(row => {
        const values = [row.full_name || '-', row.instrument || '-'];
        dates.forEach(d => values.push(statusAfternoonEmoji(row, d)));
        const rowObj = ws1.addRow(values);

        if (dateCols.length > 0) {
            const sumTerms = dateCols.map(c => `IF(${colLetter(c)}${rowObj.number}="🟩",1,0)`).join("+");
            const pctCell = rowObj.getCell(3 + dates.length);
            pctCell.value = {
                formula: `IF(${dateCols.length}=0,"",(${sumTerms})/${dateCols.length})`
            };
            pctCell.numFmt = '0.00%';
        }
    });

    ws1.getColumn(1).width = 30;
    ws1.getColumn(2).width = 20;
    dates.forEach((_, i) => ws1.getColumn(3 + i).width = 10);
    if (dates.length > 0) ws1.getColumn(3 + dates.length).width = 16;

    if (dateCols.length > 0) {
        const pctCol = colLetter(3 + dates.length);
        ws1.addConditionalFormatting({
            ref: `${pctCol}2:${pctCol}${lastDataRow}`,
            rules: [{
                type: 'colorScale',
                cfvo: [
                    { type: 'num', value: 0 },
                    { type: 'num', value: 0.5 },
                    { type: 'num', value: 1 }
                ],
                color: [
                    { argb: 'FFF8696B' },
                    { argb: 'FFFFEB84' },
                    { argb: 'FF63BE7B' }
                ],
                priority: 1
            }]
        });
    }

    // --- Resumen Totales (recuentos + porcentajes debajo) ---
    const detailRef = `'${ws1.name}'`;
    const totalRowIndex = 2 + instruments.length;
    const pctStartRow = totalRowIndex + 3;
    const pctTotalRow = pctStartRow + instruments.length;

    ws2.addRow(["Instrumento", "Plantilla", ...dates]);

    instruments.forEach((inst, idx) => {
        const r = 2 + idx;
        ws2.getCell(r, 1).value = inst;
        ws2.getCell(r, 2).value = {
            formula: `COUNTIF(${detailRef}!$B$2:$B$${lastDataRow},$A${r})`
        };
        dates.forEach((d, di) => {
            const dateCol = colLetter(3 + di);
            ws2.getCell(r, 3 + di).value = {
                formula: `SUMPRODUCT((${detailRef}!$B$2:$B$${lastDataRow}=$A${r})*(${detailRef}!${dateCol}$2:${dateCol}$${lastDataRow}="🟩"))`
            };
        });
    });

    ws2.getCell(totalRowIndex, 1).value = "TOTAL GENERAL";
    ws2.getCell(totalRowIndex, 2).value = {
        formula: `COUNTA(${detailRef}!$B$2:$B$${lastDataRow})`
    };
    dates.forEach((d, di) => {
        const dateCol = colLetter(3 + di);
        ws2.getCell(totalRowIndex, 3 + di).value = {
            formula: `SUMPRODUCT(--(${detailRef}!${dateCol}2:${dateCol}${lastDataRow}="🟩"))`
        };
    });

    ws2.addRow([]);
    ws2.addRow(["Instrumento", "Plantilla", ...dates]);

    instruments.forEach((inst, idx) => {
        const r = pctStartRow + idx;
        const c = 2 + idx;
        ws2.getCell(r, 1).value = inst;
        ws2.getCell(r, 2).value = { formula: `=$B$${c}` };
        dates.forEach((d, di) => {
            const col = 3 + di;
            ws2.getCell(r, col).value = {
                formula: `IF($B$${c}=0,"",${colLetter(col)}$${c}/$B$${c})`
            };
            ws2.getCell(r, col).numFmt = '0%';
        });
    });

    ws2.getCell(pctTotalRow, 1).value = "TOTAL GENERAL";
    ws2.getCell(pctTotalRow, 2).value = { formula: `=$B$${totalRowIndex}` };
    dates.forEach((d, di) => {
        const col = 3 + di;
        ws2.getCell(pctTotalRow, col).value = {
            formula: `IF($B$${totalRowIndex}=0,"",${colLetter(col)}$${totalRowIndex}/$B$${totalRowIndex})`
        };
        ws2.getCell(pctTotalRow, col).numFmt = '0%';
    });

    ws2.getColumn(1).width = 20;
    ws2.getColumn(2).width = 20;
    dates.forEach((_, i) => ws2.getColumn(3 + i).width = 12);

    if (dates.length > 0) {
        ws2.addConditionalFormatting({
            ref: `C${pctStartRow}:${colLetter(2 + dates.length)}${pctTotalRow}`,
            rules: [{
                type: 'colorScale',
                cfvo: [
                    { type: 'num', value: 0 },
                    { type: 'num', value: 0.5 },
                    { type: 'num', value: 1 }
                ],
                color: [
                    { argb: 'FFF8696B' },
                    { argb: 'FFFFEB84' },
                    { argb: 'FF63BE7B' }
                ],
                priority: 1
            }]
        });
    }
}

function addAfternoonPdfSections(doc, rows, firstPage) {
    const dates = afternoonDates();
    const sortedData = [...rows].sort(compareByInstrument);
    const instruments = Array.from(new Set(sortedData.map(d => d.instrument || "-"))).sort();

    const compactMargin = { left: PDF_MARGIN, right: PDF_MARGIN, top: PDF_MARGIN };
    const compactStyles = { fontSize: 6, cellPadding: 0.7, halign: 'center', textColor: 30, overflow: 'linebreak', ...PDF_LINE };
    const compactHead = { fillColor: [238, 238, 238], textColor: 30, fontStyle: 'bold', fontSize: 6 };

    const greensFor = (rowFilter, date) =>
        sortedData.filter(r => (!rowFilter || rowFilter(r)) && statusAfternoonEmoji(r, date) === '🟩').length;

    // --- Resumen Totales (página propia: recuentos + porcentajes debajo) ---
    if (!firstPage) doc.addPage('a4', 'landscape');

    const plantillaOf = inst => sortedData.filter(r => (r.instrument || '-') === inst).length;
    const summaryHead = ["Instrumento", "Plantilla", ...dates];

    doc.autoTable({
        head: [pdfTitleRow("Resumen Totales", 2 + dates.length), summaryHead],
        body: [
            ...instruments.map(inst => [
                inst,
                plantillaOf(inst),
                ...dates.map(d => greensFor(r => (r.instrument || '-') === inst, d))
            ]),
            ["TOTAL GENERAL", sortedData.length, ...dates.map(d => greensFor(null, d))]
        ],
        margin: compactMargin,
        tableWidth: 'auto',
        styles: compactStyles,
        headStyles: compactHead,
        columnStyles: { 0: { halign: 'left', cellWidth: 38 }, 1: { cellWidth: 26 } },
        didParseCell: pdfTotalStyle
    });

    doc.autoTable({
        head: [summaryHead],
        body: [
            ...instruments.map(inst => {
                const pl = plantillaOf(inst);
                return [
                    inst,
                    pl,
                    ...dates.map(d => {
                        const c = greensFor(r => (r.instrument || '-') === inst, d);
                        return pl === 0 ? '' : c / pl;
                    })
                ];
            }),
            ["TOTAL GENERAL",
                sortedData.length,
                ...dates.map(d => {
                    const c = greensFor(null, d);
                    return sortedData.length === 0 ? '' : c / sortedData.length;
                })
            ]
        ],
        startY: doc.lastAutoTable.finalY + 5,
        margin: compactMargin,
        tableWidth: 'auto',
        styles: compactStyles,
        headStyles: compactHead,
        columnStyles: { 0: { halign: 'left', cellWidth: 38 }, 1: { cellWidth: 26 } },
        didParseCell: (data) => {
            pdfTotalStyle(data);
            if (data.section === 'body' && data.column.index > 1 && typeof data.cell.raw === 'number') {
                data.cell.text = [Math.round(data.cell.raw * 100) + '%'];
                data.cell.styles.fillColor = pctRgb(data.cell.raw);
            }
        }
    });

    // --- Disponibilidad Detallada (página nueva) ---
    doc.addPage('a4', 'landscape');
    const pctColIndex = 2 + dates.length;

    doc.setFontSize(compactStyles.fontSize);
    let longestName = "Nombre";
    sortedData.forEach(row => {
        const n = row.full_name || '-';
        if (doc.getTextWidth(n) > doc.getTextWidth(longestName)) longestName = n;
    });
    const nameW = Math.ceil(doc.getTextWidth(longestName)) + 2.5;

    const longestDate = dates.reduce((a, d) => (d.length > a.length ? d : a), "");
    const minDateW = Math.ceil(doc.getTextWidth(longestDate)) + 2;

    const availPerDate = Math.floor((275 - (nameW + 14 + 16)) / Math.max(1, dates.length));
    const dateW = Math.max(minDateW, Math.min(20, availPerDate));

    // Márgenes izquierdo y derecho igualados: si el ancho total excede el útil,
    // se escalan proporcionalmente todas las columnas para que la tabla quepa.
    const layout = [
        [0, nameW],
        [1, 14],
        [pctColIndex, 16],
        ...dates.map((_, i) => [2 + i, dateW])
    ];
    const totalW = layout.reduce((s, [, w]) => s + w, 0);
    if (totalW > 275) {
        const k = 275 / totalW;
        layout.forEach(col => { col[1] = Math.max(3, Math.floor(col[1] * k * 100) / 100); });
    }

    const detailColumns = {};
    layout.forEach(([idx, w]) => {
        const base = (idx === 0 || idx === 1) ? { halign: 'left' } : {};
        detailColumns[idx] = { ...base, cellWidth: w };
    });

    const dateCount = dates.length;
    doc.autoTable({
        head: [
            pdfTitleRow("Disponibilidad Detallada", 3 + dates.length),
            ["Nombre", "Instrumento", ...dates, "% Disponibilidad"]
        ],
        body: sortedData.map(row => {
            const pct = dateCount > 0
                ? dates.filter(d => statusAfternoonEmoji(row, d) === '🟩').length / dateCount
                : '';
            return [
                row.full_name || '-',
                row.instrument || '-',
                ...dates.map(d => statusAfternoonEmoji(row, d)),
                pct
            ];
        }),
        margin: compactMargin,
        tableWidth: layout.reduce((s, [, w]) => s + w, 0),
        styles: compactStyles,
        headStyles: compactHead,
        columnStyles: detailColumns,
        didParseCell: (data) => {
            if (data.section !== 'body') return;
            const fill = AFTERNOON_EMOJI_FILL[data.cell.raw];
            if (fill) {
                data.cell.styles.fillColor = fill;
                data.cell.text = [''];
            } else if (data.column.index === pctColIndex && typeof data.cell.raw === 'number') {
                data.cell.text = [(data.cell.raw * 100).toFixed(2) + '%'];
                data.cell.styles.fillColor = pctRgb(data.cell.raw);
            }
        }
    });
}

function exportAfternoonCsv() {
    if (afternoonData.length === 0) {
        alert('No hay respuestas de ensayos de tarde para exportar.');
        return;
    }

    const dates = afternoonDates();
    const headers = ["Nombre", "Instrumento", ...dates, "% Disponibilidad"];
    const csvRows = [headers.join(',')];

    [...afternoonData].sort(compareByInstrument).forEach(row => {
        const chosen = splitAfternoonDates(row.available_dates);
        const pct = dates.length > 0 ? Math.round((chosen.filter(d => dates.includes(d)).length / dates.length) * 100) + '%' : '';
        const values = [
            `"${row.full_name || ''}"`,
            `"${row.instrument || ''}"`,
            ...dates.map(d => `"${chosen.includes(d) ? 'Sí' : '-'}"`),
            `"${pct}"`
        ];
        csvRows.push(values.join(','));
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "respuestas_ensayos_tarde.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function exportAfternoonExcel() {
    if (afternoonData.length === 0) {
        alert('No hay respuestas de ensayos de tarde para exportar.');
        return;
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "OCGC";
    workbook.created = new Date();
    workbook.calcProperties = { fullCalcOnLoad: true };

    addAfternoonSheets(workbook, dedupeLatest(afternoonData));

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = PROGRAM_CONFIG.exportFileName.replace(/\.xlsx$/i, '') + '_ensayos_tarde.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

function exportAfternoonPdf() {
    if (afternoonData.length === 0) {
        alert('No hay respuestas de ensayos de tarde para exportar.');
        return;
    }
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert('No se pudo cargar el generador de PDF.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    addAfternoonPdfSections(doc, dedupeLatest(afternoonData), true);
    doc.save(PROGRAM_CONFIG.exportFileName.replace(/\.xlsx$/i, '') + '_ensayos_tarde.pdf');
}
