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
const clearFiltersBtn = document.getElementById('clearFiltersBtn');

// Views
const viewButtons = {
    table: document.getElementById('viewTableBtn'),
    members: document.getElementById('viewMembersBtn'),
    sections: document.getElementById('viewSectionsBtn')
};
const viewContainers = {
    table: document.getElementById('view-table'),
    members: document.getElementById('view-members'),
    sections: document.getElementById('view-sections')
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
}

Object.keys(viewButtons).forEach(key => {
    viewButtons[key].addEventListener('click', () => setView(key));
});

function pctColor(p) {
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

async function addGroupSheets(workbook, rows, group, mixed) {
    const rehearsalDates = await fetchRehearsalDates(group);

    const sortedData = [...rows].sort(compareByInstrument);
    const instruments = Array.from(new Set(sortedData.map(d => d.instrument || "-"))).sort();
    const lastDataRow = sortedData.length + 1;
    const groupLabel = group === 'coro' ? 'Coro' : 'Orquesta';

    // --- Detalle del grupo ---
    const ws1 = workbook.addWorksheet(mixed ? `Detalle ${groupLabel}` : "Asistencias Detalladas");
    ws1.addRow(["Grupo", "Nombre", "Instrumento", "Conciertos", ...rehearsalDates.map(d => d.date), "% Asistencia"]);

    const rehearsalCols = [];
    rehearsalDates.forEach((d, i) => {
        const col = 5 + i;
        if (!d.isConcert) rehearsalCols.push(col);
    });

    sortedData.forEach(row => {
        const availability = row.concert_availability || "";

        const values = [
            row.grupo === 'coro' ? 'Coro' : row.grupo === 'orquesta' ? 'Orquesta' : '-',
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
            const pctCell = rowObj.getCell(5 + rehearsalDates.length);
            pctCell.value = {
                formula: `IF(${rehearsalCols.length}=0,"",(${sumTerms})/${rehearsalCols.length})`
            };
            pctCell.numFmt = '0.00%';
        }
    });

    ws1.getColumn(1).width = 12;
    ws1.getColumn(2).width = 30;
    ws1.getColumn(3).width = 20;
    ws1.getColumn(4).width = 25;
    rehearsalDates.forEach((_, i) => ws1.getColumn(5 + i).width = 10);
    if (rehearsalDates.length > 0) ws1.getColumn(5 + rehearsalDates.length).width = 14;

    if (rehearsalCols.length > 0) {
        const pctCol = colLetter(5 + rehearsalDates.length);
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
    const ws2 = workbook.addWorksheet(mixed ? `Resumen ${groupLabel}` : "Resumen Totales");
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
            formula: `COUNTIF(${detailRef}!$C$2:$C$${lastDataRow},$A${r})`
        };
        rehearsalDates.forEach((d, di) => {
            const dateCol = colLetter(5 + di);
            ws2.getCell(r, 3 + di).value = {
                formula: `SUMPRODUCT((${detailRef}!$C$2:$C$${lastDataRow}=$A${r})*(${detailRef}!${dateCol}$2:${dateCol}$${lastDataRow}="🟩"))`
            };
        });
    });

    ws2.getCell(totalRowIndex, 1).value = "TOTAL GENERAL";
    ws2.getCell(totalRowIndex, 2).value = {
        formula: `COUNTA(${detailRef}!$C$2:$C$${lastDataRow})`
    };
    rehearsalDates.forEach((d, di) => {
        const dateCol = colLetter(5 + di);
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
            "Grupo": row.grupo === 'coro' ? 'Coro' : row.grupo === 'orquesta' ? 'Orquesta' : '-',
            "Nombre": row.full_name || '-',
            "Instrumento": row.instrument || '-',
            "Tipo Asistencia": row.rehearsal_commitment || '-',
            "Observaciones": row.observations
        }));

    if (observationsData.length > 0) {
        const ws4 = workbook.addWorksheet(mixed ? `Observaciones ${groupLabel}` : "Observaciones Especiales");
        ws4.addRow(["Grupo", "Nombre", "Instrumento", "Tipo Asistencia", "Observaciones"]);
        observationsData.forEach(o => ws4.addRow([o.Grupo, o.Nombre, o.Instrumento, o["Tipo Asistencia"], o.Observaciones]));
        ws4.getColumn(1).width = 12;
        ws4.getColumn(2).width = 30;
        ws4.getColumn(3).width = 20;
        ws4.getColumn(4).width = 30;
        ws4.getColumn(5).width = 80;
    }
}

exportExcelBtn.addEventListener('click', async () => {
    if (displayedData.length === 0) return;

    const sortedData = [...displayedData].sort(compareByInstrument);

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
