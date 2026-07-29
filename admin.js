import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { supabaseConfig } from "./assets/supabase-config.js";

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
                <td><strong>${row.fullName || '-'}</strong></td>
                <td>${row.instrument || '-'}</td>
                <td>${row.concertAvailability || '-'}</td>
                <td>${row.rehearsalCommitment || '-'}</td>
                <td>${row.absenceDates || '-'}</td>
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
            `"${row.fullName || ''}"`,
            `"${row.instrument || ''}"`,
            `"${row.concertAvailability || ''}"`,
            `"${row.rehearsalCommitment || ''}"`,
            `"${row.absenceDates || ''}"`,
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
            .map(line => line.split('|')[0].trim())
            .filter(date => date.length > 0);
    } catch (error) {
        console.error("Error fetching rehearsal dates:", error);
        return [];
    }
}

exportExcelBtn.addEventListener('click', async () => {
    if (displayedData.length === 0) return;

    const rehearsalDates = await fetchRehearsalDates();

    const sortedData = [...displayedData].sort((a, b) => {
        const instA = (a.instrument || "").toLowerCase();
        const instB = (b.instrument || "").toLowerCase();
        return instA.localeCompare(instB);
    });

    const exportData = sortedData.map(row => {
        const entry = {
            "Grupo": row.grupo === 'coro' ? 'Coro' : row.grupo === 'orquesta' ? 'Orquesta' : '-',
            "Nombre": row.fullName || '-',
            "Instrumento": row.instrument || '-',
            "Conciertos": row.concertAvailability || '-'
        };

        const commitment = row.rehearsalCommitment;
        const absences = (row.absenceDates || "").split(',').map(d => d.trim());

        rehearsalDates.forEach(date => {
            if (date === "14/06/2026" || date === "20/06/2026") {
                const availability = row.concertAvailability || "";
                let isGoing = false;

                if (date === "14/06/2026") {
                    isGoing = (availability === "Ambos conciertos" || availability === "Solo 14 junio (Gran Canaria)");
                } else if (date === "20/06/2026") {
                    isGoing = (availability === "Ambos conciertos" || availability === "Solo 20 junio (Fuerteventura)");
                }

                if (isGoing) {
                    entry[date] = "🟩";
                } else {
                    entry[date] = "🟥";
                }
            } else {
                if (commitment === "Asistencia regular") {
                    entry[date] = "🟩";
                } else if (commitment === "No puedo comprometer asistencia regular") {
                    entry[date] = "🟧";
                } else if (commitment === "Asistencia a la mayoría, salvo fechas") {
                    entry[date] = absences.includes(date) ? "🟥" : "🟩";
                } else {
                    entry[date] = "-";
                }
            }
        });

        return entry;
    });

    const summaryData = [];
    const instruments = Array.from(new Set(sortedData.map(d => d.instrument || "-"))).sort();

    const sectionTotals = {};
    instruments.forEach(inst => {
        sectionTotals[inst] = sortedData.filter(d => d.instrument === inst).length;
    });

    instruments.forEach(inst => {
        const totalInInst = sectionTotals[inst];
        const instRow = {
            "Instrumento": inst,
            "Plantilla": totalInInst
        };

        rehearsalDates.forEach(date => {
            let count = 0;
            sortedData.filter(d => d.instrument === inst).forEach(row => {
                if (date === "14/06/2026" || date === "20/06/2026") {
                    const availability = row.concertAvailability || "";
                    if (date === "14/06/2026") {
                        if (availability === "Ambos conciertos" || availability === "Solo 14 junio (Gran Canaria)") count++;
                    } else if (date === "20/06/2026") {
                        if (availability === "Ambos conciertos" || availability === "Solo 20 junio (Fuerteventura)") count++;
                    }
                } else {
                    const commitment = row.rehearsalCommitment;
                    const absences = (row.absenceDates || "").split(',').map(d => d.trim());
                    if (commitment === "Asistencia regular") count++;
                    else if (commitment === "Asistencia a la mayoría, salvo fechas" && !absences.includes(date)) count++;
                }
            });
            instRow[date] = count;
        });
        summaryData.push(instRow);
    });

    const globalTotal = sortedData.length;
    const totalRow = {
        "Instrumento": "TOTAL GENERAL",
        "Plantilla": globalTotal
    };

    rehearsalDates.forEach(date => {
        let count = 0;
        sortedData.forEach(row => {
            if (date === "14/06/2026" || date === "20/06/2026") {
                const availability = row.concertAvailability || "";
                if (date === "14/06/2026") {
                    if (availability === "Ambos conciertos" || availability === "Solo 14 junio (Gran Canaria)") count++;
                } else if (date === "20/06/2026") {
                    if (availability === "Ambos conciertos" || availability === "Solo 20 junio (Fuerteventura)") count++;
                }
            } else {
                const commitment = row.rehearsalCommitment;
                const absences = (row.absenceDates || "").split(',').map(d => d.trim());
                if (commitment === "Asistencia regular") count++;
                else if (commitment === "Asistencia a la mayoría, salvo fechas" && !absences.includes(date)) count++;
            }
        });
        totalRow[date] = count;
    });
    summaryData.push(totalRow);

    const workbook = XLSX.utils.book_new();

    const ws1 = XLSX.utils.json_to_sheet(exportData);
    const colWidths1 = [
        { wch: 12 },
        { wch: 30 },
        { wch: 20 },
        { wch: 25 }
    ];
    rehearsalDates.forEach(() => colWidths1.push({ wch: 10 }));
    ws1['!cols'] = colWidths1;
    XLSX.utils.book_append_sheet(workbook, ws1, "Asistencias Detalladas");

    const ws2 = XLSX.utils.json_to_sheet(summaryData);
    const summaryWidths = [{ wch: 20 }, { wch: 20 }];
    rehearsalDates.forEach(() => summaryWidths.push({ wch: 12 }));
    ws2['!cols'] = summaryWidths;
    XLSX.utils.book_append_sheet(workbook, ws2, "Resumen Totales");

    const observationsData = sortedData
        .filter(row => (row.observations || "").trim().length > 0)
        .map(row => ({
            "Grupo": row.grupo === 'coro' ? 'Coro' : row.grupo === 'orquesta' ? 'Orquesta' : '-',
            "Nombre": row.fullName || '-',
            "Instrumento": row.instrument || '-',
            "Tipo Asistencia": row.rehearsalCommitment || '-',
            "Observaciones": row.observations
        }));

    if (observationsData.length > 0) {
        const ws3 = XLSX.utils.json_to_sheet(observationsData);
        ws3['!cols'] = [
            { wch: 12 },
            { wch: 30 },
            { wch: 20 },
            { wch: 30 },
            { wch: 80 }
        ];
        XLSX.utils.book_append_sheet(workbook, ws3, "Observaciones Especiales");
    }

    XLSX.writeFile(workbook, "respuestas_aniversario_ocgc.xlsx");
});
