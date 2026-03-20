import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { firebaseConfig } from "./assets/firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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
    instrument: document.getElementById('filterInstrument'),
    concertAvailability: document.getElementById('filterConcerts'),
    rehearsalCommitment: document.getElementById('filterRehearsals')
};

let allData = [];

// Auth State Observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        loadData();
    } else {
        loginSection.classList.remove('hidden');
        dashboardSection.classList.add('hidden');
    }
});

// Login Handler
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.style.display = 'none';
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        loginError.textContent = "Error: Credenciales incorrectas o usuario no encontrado.";
        loginError.style.display = 'block';
    }
});

logoutBtn.addEventListener('click', () => signOut(auth));

// Load Data
async function loadData() {
    try {
        const q = query(collection(db, "respuestas_aniversario_ocgc"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);

        allData = [];
        querySnapshot.forEach((doc) => {
            allData.push(doc.data());
        });

        // Populate dynamic filters from data
        populateDynamicFilters();

        // Render table
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
    responsesBody.innerHTML = '';
    let count = 0;

    data.forEach(row => {
        count++;
        const date = row.timestamp ? new Date(row.timestamp.seconds * 1000).toLocaleString() : 'N/A';

        const tr = `
            <tr>
                <td>${date}</td>
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
        instrument: filters.instrument.value,
        concertAvailability: filters.concertAvailability.value,
        rehearsalCommitment: filters.rehearsalCommitment.value
    };

    const filteredData = allData.filter(row => {
        return Object.keys(filtersValues).every(key => {
            const filterVal = filtersValues[key];
            if (!filterVal) return true; // No filter selected for this key
            return row[key] === filterVal;
        });
    });

    renderTable(filteredData);
}

// Add listeners to filters
Object.values(filters).forEach(select => {
    select.addEventListener('change', applyFilters);
});

clearFiltersBtn.addEventListener('click', () => {
    Object.values(filters).forEach(select => select.value = "");
    applyFilters();
});

exportBtn.addEventListener('click', () => {
    if (allData.length === 0) return;

    const headers = ["Fecha", "Nombre", "Instrumento", "Conciertos", "Ensayos", "Fechas Ausencia", "Observaciones"];
    const csvRows = [headers.join(',')];

    allData.forEach(row => {
        const date = row.timestamp ? new Date(row.timestamp.seconds * 1000).toLocaleString().replace(',', '') : 'N/A';
        const values = [
            date,
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
        const response = await fetch('assets/fechas_ensayos.txt');
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
    if (allData.length === 0) return;

    const rehearsalDates = await fetchRehearsalDates();

    // 1. Sort by instrument alphabetically
    const sortedData = [...allData].sort((a, b) => {
        const instA = (a.instrument || "").toLowerCase();
        const instB = (b.instrument || "").toLowerCase();
        return instA.localeCompare(instB);
    });

    // 2. Build the export objects (Individual Sheet - No Observations here)
    const exportData = sortedData.map(row => {
        const entry = {
            "Nombre": row.fullName || '-',
            "Instrumento": row.instrument || '-',
            "Conciertos": row.concertAvailability || '-'
        };

        const commitment = row.rehearsalCommitment;
        const absences = (row.absenceDates || "").split(',').map(d => d.trim());

        rehearsalDates.forEach(date => {
            if (commitment === "Asistencia regular") {
                entry[date] = "🟩 SÍ";
            } else if (commitment === "No puedo comprometer asistencia regular") {
                entry[date] = "🟥 NO";
            } else if (commitment === "Asistencia a la mayoría, salvo fechas") {
                entry[date] = absences.includes(date) ? "🟥 NO" : "🟩 SÍ";
            } else {
                entry[date] = "-";
            }
        });

        return entry;
    });

    // 3. Build Summary Data (INCLUDING ALL participants)
    const summaryData = [];
    const instruments = Array.from(new Set(sortedData.map(d => d.instrument || "-"))).sort();

    // Mapping for total per section
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
                const commitment = row.rehearsalCommitment;
                const absences = (row.absenceDates || "").split(',').map(d => d.trim());
                if (commitment === "Asistencia regular") count++;
                else if (commitment === "Asistencia a la mayoría, salvo fechas" && !absences.includes(date)) count++;
            });
            instRow[date] = count;
        });
        summaryData.push(instRow);
    });

    // Add a Global Total row to summary
    const globalTotal = sortedData.length;
    const totalRow = { 
        "Instrumento": "TOTAL GENERAL",
        "Plantilla": globalTotal
    };
    
    rehearsalDates.forEach(date => {
        let count = 0;
        sortedData.forEach(row => {
            const commitment = row.rehearsalCommitment;
            const absences = (row.absenceDates || "").split(',').map(d => d.trim());
            if (commitment === "Asistencia regular") count++;
            else if (commitment === "Asistencia a la mayoría, salvo fechas" && !absences.includes(date)) count++;
        });
        totalRow[date] = count;
    });
    summaryData.push(totalRow);

    const workbook = XLSX.utils.book_new();
    
    // Sheet 1: Individual Attendance
    const ws1 = XLSX.utils.json_to_sheet(exportData);
    const colWidths1 = [
        { wch: 30 }, // Nombre
        { wch: 20 }, // Instrumento
        { wch: 25 }  // Conciertos
    ];
    rehearsalDates.forEach(() => colWidths1.push({ wch: 10 }));
    ws1['!cols'] = colWidths1;
    XLSX.utils.book_append_sheet(workbook, ws1, "Asistencias Detalladas");

    // Sheet 2: Summary Totals
    const ws2 = XLSX.utils.json_to_sheet(summaryData);
    const summaryWidths = [{ wch: 20 }, { wch: 20 }];
    rehearsalDates.forEach(() => summaryWidths.push({ wch: 12 }));
    ws2['!cols'] = summaryWidths;
    XLSX.utils.book_append_sheet(workbook, ws2, "Resumen Totales");

    // Sheet 3: ONLY people with observations
    const observationsData = sortedData
        .filter(row => (row.observations || "").trim().length > 0)
        .map(row => ({
            "Nombre": row.fullName || '-',
            "Instrumento": row.instrument || '-',
            "Tipo Asistencia": row.rehearsalCommitment || '-',
            "Observaciones": row.observations
        }));
    
    if (observationsData.length > 0) {
        const ws3 = XLSX.utils.json_to_sheet(observationsData);
        ws3['!cols'] = [
            { wch: 30 }, // Nombre
            { wch: 20 }, // Instrumento
            { wch: 30 }, // Tipo Asistencia
            { wch: 80 }  // Observaciones
        ];
        XLSX.utils.book_append_sheet(workbook, ws3, "Observaciones Especiales");
    }

    XLSX.writeFile(workbook, "respuestas_aniversario_ocgc.xlsx");
});


