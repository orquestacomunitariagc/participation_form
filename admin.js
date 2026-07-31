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

// Filters
const filters = {
    grupo: document.getElementById('filterGrupo'),
    instrument: document.getElementById('filterInstrument'),
    concertAvailability: document.getElementById('filterConcerts'),
    rehearsalCommitment: document.getElementById('filterRehearsals')
};

let allData = [];
let displayedData = [];

function checkSession() {
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            loginSection.classList.add('hidden');
            dashboardSection.classList.remove('hidden');
            loadData();
        } else {
            loginSection.classList.remove('hidden');
            dashboardSection.classList.add('hidden');
        }
    });
}

supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
        loginSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        loadData();
    } else if (event === 'SIGNED_OUT') {
        loginSection.classList.remove('hidden');
        dashboardSection.classList.add('hidden');
        allData = [];
    }
});

checkSession();

// Login Handler
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.style.display = 'none';
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        loginError.textContent = "Error: Credenciales incorrectas o usuario no encontrado.";
        loginError.style.display = 'block';
    }
});

logoutBtn.addEventListener('click', () => supabase.auth.signOut());

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

// Load Rehearsal Dates for Export
async function fetchRehearsalDates() {
    try {
        const response = await fetch('assets/fechas_ensayos_orquesta.txt');
        if (!response.ok) return [];
        const text = await response.text();
        return text.split('\n')
            .filter(line => line.trim().length > 0)
            .map(line => {
                const parts = line.split('|');
                return {
                    date: (parts[0] || '').trim(),
                    isConcert: ((parts[1] || '').trim().toLowerCase().includes('concierto'))
                };
            });
    } catch (error) {
        console.error("Error fetching rehearsal dates:", error);
        return [];
    }
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

exportExcelBtn.addEventListener('click', async () => {
    if (displayedData.length === 0) return;

    const rehearsalDates = await fetchRehearsalDates();

    const sortedData = [...displayedData].sort((a, b) => {
        const instA = (a.instrument || "").toLowerCase();
        const instB = (b.instrument || "").toLowerCase();
        return instA.localeCompare(instB);
    });

    const instruments = Array.from(new Set(sortedData.map(d => d.instrument || "-"))).sort();
    const lastDataRow = sortedData.length + 1;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "OCGC";
    workbook.created = new Date();
    workbook.calcProperties = { fullCalcOnLoad: true };

    // --- Asistencias Detalladas ---
    const ws1 = workbook.addWorksheet("Asistencias Detalladas");
    ws1.addRow(["Grupo", "Nombre", "Instrumento", "Conciertos", ...rehearsalDates.map(d => d.date), "% Asistencia"]);

    const rehearsalCols = [];
    rehearsalDates.forEach((d, i) => {
        const col = 5 + i;
        if (!d.isConcert) rehearsalCols.push(col);
    });

    sortedData.forEach(row => {
        const commitment = row.rehearsal_commitment;
        const absences = (row.absence_dates || "").split(',').map(d => d.trim());
        const availability = row.concert_availability || "";

        const values = [
            row.grupo === 'coro' ? 'Coro' : row.grupo === 'orquesta' ? 'Orquesta' : '-',
            row.full_name || '-',
            row.instrument || '-',
            availability || '-'
        ];

        rehearsalDates.forEach(({ date, isConcert }) => {
            if (isConcert) {
                values.push(availability === "Participa" ? "🟩" : "🟥");
            } else if (commitment === "Asistencia regular") {
                values.push("🟩");
            } else if (commitment === "No puedo comprometer asistencia regular") {
                values.push("🟧");
            } else if (commitment === "Asistencia a la mayoría, salvo fechas") {
                values.push(absences.includes(date) ? "🟥" : "🟩");
            } else {
                values.push("-");
            }
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
    const ws2 = workbook.addWorksheet("Resumen Totales");
    const detailRef = "'Asistencias Detalladas'";
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
        const ws4 = workbook.addWorksheet("Observaciones Especiales");
        ws4.addRow(["Grupo", "Nombre", "Instrumento", "Tipo Asistencia", "Observaciones"]);
        observationsData.forEach(o => ws4.addRow([o.Grupo, o.Nombre, o.Instrumento, o["Tipo Asistencia"], o.Observaciones]));
        ws4.getColumn(1).width = 12;
        ws4.getColumn(2).width = 30;
        ws4.getColumn(3).width = 20;
        ws4.getColumn(4).width = 30;
        ws4.getColumn(5).width = 80;
    }

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
