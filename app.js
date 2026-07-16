// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// API Endpoints
const FACULTY_API_ENDPOINT = '/api/faculties';

// State Management
const state = {
    schedule: {},
    dtrData: null,
    employeeName: '',
    month: '',
    currentFaculty: null // Track currently selected/edited faculty
};

// Hardcoded Schedule Templates
const HARDCODED_FACULTIES = [
    {
        name: "Regular Schedule",
        schedule: {
            "Mon": "07:30am-12:30pm, 01:30pm-06:30pm",
            "Tue": "07:30am-12:30pm, 01:30pm-06:30pm",
            "Wed": "07:30am-12:30pm, 01:30pm-06:30pm",
            "Thu": "07:30am-12:30pm, 01:30pm-06:30pm"
        }
    }
    // {
    //     name: "Template: Full Day",
    //     schedule: {
    //         "Mon": "08:00am-12:00pm, 01:00pm-05:00pm",
    //         "Tue": "08:00am-12:00pm, 01:00pm-05:00pm",
    //         "Wed": "08:00am-12:00pm, 01:00pm-05:00pm",
    //         "Thu": "08:00am-12:00pm, 01:00pm-05:00pm",
    //         "Fri": "08:00am-12:00pm, 01:00pm-05:00pm"
    //     }
    // }
];

// Initialize PDF.js
const pdfInput = document.getElementById('pdfInput');
const uploadArea = document.getElementById('uploadArea');
const scheduleForm = document.getElementById('scheduleForm');
const facultyDropdown = document.getElementById('facultyDropdown');
const facultyNameInput = document.getElementById('facultyName');
const deleteFacultyBtn = document.getElementById('deleteFacultyBtn');
const saveFacultyBtn = document.getElementById('saveFacultyBtn');
const clearFormBtn = document.getElementById('clearFormBtn');
const editScheduleBtn = document.getElementById('editScheduleBtn');
const scheduleDisplay = document.getElementById('scheduleDisplay');

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
    setupUploadListeners();
    setupScheduleForm();
    setupFacultyManagement();
    await loadFacultyList();
});

function setupUploadListeners() {
    uploadArea.addEventListener('click', () => pdfInput.click());

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handlePdfUpload(files[0]);
        }
    });

    pdfInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handlePdfUpload(e.target.files[0]);
        }
    });
}

// Faculty Management
function setupFacultyManagement() {
    facultyDropdown.addEventListener('change', handleFacultySelect);
    facultyNameInput.addEventListener('input', updateFormState);
    deleteFacultyBtn.addEventListener('click', deleteFaculty);
    clearFormBtn.addEventListener('click', clearForm);
    editScheduleBtn.addEventListener('click', editSchedule);
}

async function loadFacultyList() {
    try {
        const serverFaculties = await getFacultiesFromServer();
        
        facultyDropdown.innerHTML = '<option value="">-- Select Existing Faculty --</option>';
        
        // Group for hardcoded templates
        const templateGroup = document.createElement('optgroup');
        templateGroup.label = "Hardcoded Templates";
        
        HARDCODED_FACULTIES.forEach(faculty => {
            const option = document.createElement('option');
            option.value = faculty.name;
            option.textContent = faculty.name;
            templateGroup.appendChild(option);
        });
        facultyDropdown.appendChild(templateGroup);

        // Group for server-saved faculties
        if (serverFaculties.length > 0) {
            const customGroup = document.createElement('optgroup');
            customGroup.label = "Saved Faculties";
            
            serverFaculties.forEach(faculty => {
                const option = document.createElement('option');
                option.value = faculty.name;
                option.textContent = faculty.name;
                customGroup.appendChild(option);
            });
            facultyDropdown.appendChild(customGroup);
        }
    } catch (error) {
        console.error('Error loading faculty list:', error);
        showMessage('Unable to load faculty list from server.', 'error');
    }
}

async function handleFacultySelect(e) {
    const selectedName = e.target.value;
    
    if (!selectedName) {
        // Deselect
        state.currentFaculty = null;
        facultyNameInput.value = '';
        clearFormFields();
        scheduleDisplay.classList.add('hidden');
        deleteFacultyBtn.style.display = 'none';
        state.schedule = {};
        return;
    }

    try {
        const serverFaculties = await getFacultiesFromServer();
        // Combine both sources to find the selected schedule
        const allFaculties = [...HARDCODED_FACULTIES, ...serverFaculties];
        const faculty = allFaculties.find(f => f.name === selectedName);
        
        if (faculty) {
            state.currentFaculty = faculty.name;
            state.schedule = faculty.schedule;
            facultyNameInput.value = '';
            loadScheduleIntoForm(faculty.schedule);
            displaySchedule(faculty.name, faculty.schedule);
            
            // Only show delete button if it's a server-saved schedule, not a hardcoded one
            const isHardcoded = HARDCODED_FACULTIES.some(f => f.name === faculty.name);
            deleteFacultyBtn.style.display = isHardcoded ? 'none' : 'inline-block';
        }
    } catch (error) {
        console.error('Error loading faculty:', error);
        showMessage('Unable to load faculty list from server.', 'error');
    }
}

function updateFormState() {
    // Reset dropdown when typing new faculty name
    if (facultyNameInput.value.trim()) {
        facultyDropdown.value = '';
        state.currentFaculty = null;
        deleteFacultyBtn.style.display = 'none';
        scheduleDisplay.classList.add('hidden');
    }
}

function setupScheduleForm() {
    scheduleForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveFacultySchedule();
    });
}

async function saveFacultySchedule() {
    const facultyName = facultyNameInput.value.trim();
    const selectedFromDropdown = facultyDropdown.value;
    const nameToUse = selectedFromDropdown || facultyName;

    if (!nameToUse) {
        showMessage('Please enter a faculty name', 'warning');
        return;
    }

    const schedule = {};
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    days.forEach((day, index) => {
        const value = document.querySelector(`input[name="${day}"]`).value.trim();
        if (value) {
            schedule[dayLabels[index]] = value;
        }
    });

    if (Object.keys(schedule).length === 0) {
        showMessage('Please enter at least one schedule', 'warning');
        return;
    }

    try {
        await saveFacultyToServer(nameToUse, schedule);
        state.schedule = schedule;
        state.currentFaculty = nameToUse;

        await loadFacultyList();
        facultyDropdown.value = nameToUse;
        facultyNameInput.value = '';
        displaySchedule(nameToUse, schedule);
        deleteFacultyBtn.style.display = 'inline-block';

        showMessage(`Schedule for ${nameToUse} saved successfully!`, 'success');
    } catch (error) {
        console.error('Error saving schedule:', error);
        showMessage('Unable to save schedule to server.', 'error');
    }
}

function loadScheduleIntoForm(schedule) {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    days.forEach((day, index) => {
        const input = document.querySelector(`input[name="${day}"]`);
        const scheduleValue = schedule[dayLabels[index]] || '';
        input.value = scheduleValue;
    });
}

function displaySchedule(facultyName, schedule) {
    const scheduleList = document.getElementById('scheduleList');
    scheduleList.innerHTML = '';

    Object.entries(schedule).forEach(([day, times]) => {
        const item = document.createElement('div');
        item.className = 'schedule-item';
        item.innerHTML = `
            <span class="schedule-item-day">${day}</span>
            <span class="schedule-item-time">${times}</span>
        `;
        scheduleList.appendChild(item);
    });

    document.getElementById('selectedFacultyName').textContent = facultyName;
    scheduleDisplay.classList.remove('hidden');
}

function editSchedule() {
    scheduleDisplay.classList.add('hidden');
    window.scrollTo({ top: document.querySelector('.schedule-form').offsetTop - 100, behavior: 'smooth' });
    document.querySelector('.schedule-form input').focus();
}

function clearForm() {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    days.forEach(day => {
        document.querySelector(`input[name="${day}"]`).value = '';
    });
    facultyNameInput.value = '';
    facultyDropdown.value = '';
    state.currentFaculty = null;
    scheduleDisplay.classList.add('hidden');
    deleteFacultyBtn.style.display = 'none';
    state.schedule = {};
}

function clearFormFields() {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    days.forEach(day => {
        document.querySelector(`input[name="${day}"]`).value = '';
    });
}

async function deleteFaculty() {
    if (!state.currentFaculty) return;

    if (!confirm(`Are you sure you want to delete ${state.currentFaculty}'s schedule?`)) {
        return;
    }

    try {
        await deleteFacultyFromServer(state.currentFaculty);
        clearForm();
        await loadFacultyList();
        showMessage(`${state.currentFaculty}'s schedule deleted`, 'success');
    } catch (error) {
        console.error('Error deleting faculty:', error);
        showMessage('Unable to delete faculty schedule from server.', 'error');
    }
}

// Server API Functions
async function getFacultiesFromServer() {
    const response = await fetch(FACULTY_API_ENDPOINT);
    if (!response.ok) {
        throw new Error('Failed to fetch faculties');
    }
    return response.json();
}

async function saveFacultyToServer(name, schedule) {
    const response = await fetch(FACULTY_API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, schedule })
    });

    if (!response.ok) {
        throw new Error('Failed to save faculty schedule');
    }

    return response.json();
}

async function deleteFacultyFromServer(name) {
    const response = await fetch(`${FACULTY_API_ENDPOINT}/${encodeURIComponent(name)}`, {
        method: 'DELETE'
    });

    if (!response.ok) {
        throw new Error('Failed to delete faculty schedule');
    }

    return response.json();
}

// PDF Upload and Processing
async function handlePdfUpload(file) {
    if (!file.type.includes('pdf')) {
        showMessage('Please upload a valid PDF file', 'error');
        return;
    }

    const uploadStatus = document.getElementById('uploadStatus');
    const statusMessage = document.getElementById('statusMessage');
    
    uploadStatus.classList.remove('hidden');
    statusMessage.textContent = 'Processing PDF...';

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        let textContent = '';
        for (let i = 0; i < pdf.numPages; i++) {
            const page = await pdf.getPage(i + 1);
            const content = await page.getTextContent();
            // Preserve structure better with line breaks
            textContent += content.items.map((item, idx) => {
                // Add line break if Y position changes significantly (new line)
                return item.str;
            }).join(' ') + '\n';
        }

        console.log('Extracted PDF text length:', textContent.length);
        state.dtrData = parseDTR(textContent);
        console.log('Parsed DTR rows:', state.dtrData.rows.length);
        
        uploadStatus.classList.add('hidden');
        calculateAndDisplay();
        showMessage('DTR processed successfully!', 'success');
    } catch (error) {
        console.error('PDF Error:', error);
        uploadStatus.classList.add('hidden');
        showMessage('Error processing PDF: ' + error.message, 'error');
    }
}

// DTR Parsing - Robust version with deduplication
function parseDTR(text) {
    // Extract employee name
    let nameMatch = text.match(/Daily Time Record\s+(.+?)\s+\(Name\)/i);
    state.employeeName = nameMatch ? nameMatch[1].trim() : 'Unknown';
    
    // Extract month
    let monthMatch = text.match(/For the month of\s+(\w+),?\s+(\d{4})/i);
    state.month = monthMatch ? `${monthMatch[1]} ${monthMatch[2]}` : 'Unknown';

    console.log('Employee:', state.employeeName, 'Month:', state.month);

    const dtrRows = [];
    const seenDays = new Set(); // Track which days we've already added
    
    // Find all day entries: look for pattern like "01 Mon" or "02 Tue"
    // This matches: day number (01-31) + day name + everything until next day or end
    const dayEntryPattern = /(\d{1,2})\s+(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?=\s|$)/g;
    
    let dayMatch;
    const dayEntries = [];
    
    while ((dayMatch = dayEntryPattern.exec(text)) !== null) {
        dayEntries.push({
            dayNum: parseInt(dayMatch[1]),
            dayName: dayMatch[2],
            pos: dayMatch.index
        });
    }

    console.log('Found day entries (before dedup):', dayEntries.length);

    // For each day entry, extract the data between it and the next entry
    for (let i = 0; i < dayEntries.length; i++) {
        const entry = dayEntries[i];
        
        // Skip if we've already processed this day (deduplicate)
        if (seenDays.has(entry.dayNum)) {
            console.log('Skipping duplicate day:', entry.dayNum);
            continue;
        }
        
        const nextPos = i + 1 < dayEntries.length ? dayEntries[i + 1].pos : text.length;
        const entryText = text.substring(entry.pos, nextPos);

        const row = {
            day: entry.dayNum,
            dayName: entry.dayName,
            amArrival: null,
            amDeparture: null,
            pmArrival: null,
            pmDeparture: null,
            hours: null,
            minutes: null,
            isTravel: false,
            isHoliday: false,
            note: ''
        };

        // Check for Travel
        if (/travel/i.test(entryText)) {
            row.isTravel = true;
            row.note = 'Travel';
            // Try to extract hours and minutes from travel entries
            const travelMatch = entryText.match(/travel\s+(\d+)\s+(\d+)?/i);
            if (travelMatch) {
                row.hours = parseInt(travelMatch[1]);
                row.minutes = travelMatch[2] ? parseInt(travelMatch[2]) : 0;
            }
        } 
        // Check for Holiday
        else if (/holiday/i.test(entryText)) {
            row.isHoliday = true;
            row.note = 'Holiday';
        } 
        // Extract actual times
        else {
            const times = [];
            const timeRegex = /(\d{1,2}):(\d{2})\s*(AM|PM)/gi;
            let timeMatch;
            
            while ((timeMatch = timeRegex.exec(entryText)) !== null) {
                times.push({
                    hour: parseInt(timeMatch[1]),
                    minute: parseInt(timeMatch[2]),
                    period: timeMatch[3].toUpperCase()
                });
            }

            // Assign times to AM/PM arrival/departure
            if (times.length >= 1) row.amArrival = times[0];
            if (times.length >= 2) row.amDeparture = times[1];
            if (times.length >= 3) row.pmArrival = times[2];
            if (times.length >= 4) row.pmDeparture = times[3];
        }

        if (row.day >= 1 && row.day <= 31) {
            dtrRows.push(row);
            seenDays.add(row.day); // Mark this day as processed
        }
    }

    console.log('Parsed rows (after dedup):', dtrRows.length, 'Sample:', dtrRows.slice(0, 3));

    return {
        rows: dtrRows,
        employeeName: state.employeeName,
        month: state.month
    };
}

// Time Utilities
function timeToMinutes(hour, minute, period) {
    let h = hour;
    if (period.toUpperCase() === 'PM' && h !== 12) {
        h += 12;
    } else if (period.toUpperCase() === 'AM' && h === 12) {
        h = 0;
    }
    return h * 60 + minute;
}

function minutesToHours(minutes) {
    return Math.round((minutes / 60) * 100) / 100;
}

function parseTimeBlock(blockStr) {
    // Parse time blocks like "07:30am-12:00pm" or "01:00pm-04:00pm"
    const timePattern = /(\d{1,2}):(\d{2})(am|pm)/gi;
    const times = [];
    let match;
    
    while ((match = timePattern.exec(blockStr)) !== null) {
        times.push({
            hour: parseInt(match[1]),
            minute: parseInt(match[2]),
            period: match[3].toUpperCase()
        });
    }

    if (times.length >= 2) {
        return {
            start: times[0],
            end: times[1]
        };
    }
    return null;
}

function calculateOverlap(actualStart, actualEnd, scheduledStart, scheduledEnd) {
    // Convert to minutes since midnight (24-hour)
    const actualStartMin = actualStart ? timeToMinutes(actualStart.hour, actualStart.minute, actualStart.period) : null;
    const actualEndMin = actualEnd ? timeToMinutes(actualEnd.hour, actualEnd.minute, actualEnd.period) : null;
    const schedStartMin = timeToMinutes(scheduledStart.hour, scheduledStart.minute, scheduledStart.period);
    const schedEndMin = timeToMinutes(scheduledEnd.hour, scheduledEnd.minute, scheduledEnd.period);

    // If no actual times, no hours credited
    if (actualStartMin === null || actualEndMin === null) {
        return 0;
    }

    // Calculate overlap
    const overlapStart = Math.max(actualStartMin, schedStartMin);
    const overlapEnd = Math.min(actualEndMin, schedEndMin);

    // If no overlap or end is before start, return 0
    if (overlapEnd <= overlapStart) {
        return 0;
    }

    return overlapEnd - overlapStart;
}

// Calculate Hours from Schedule
function calculateHours(dtrRow, dayName) {
    if (dtrRow.isTravel || dtrRow.isHoliday || !state.schedule[dayName]) {
        return 0;
    }

    const scheduleStr = state.schedule[dayName];
    const blocks = scheduleStr.split(',').map(b => b.trim());
    
    let totalMinutes = 0;

    for (const block of blocks) {
        const timeBlock = parseTimeBlock(block);
        if (!timeBlock) continue;

        // Determine if this is AM or PM block
        const blockStartPeriod = timeBlock.start.period.toUpperCase();
        const isAMBlock = (blockStartPeriod === 'AM');

        if (isAMBlock) {
            // Use AM times
            if (dtrRow.amArrival && dtrRow.amDeparture) {
                const minutes = calculateOverlap(
                    dtrRow.amArrival,
                    dtrRow.amDeparture,
                    timeBlock.start,
                    timeBlock.end
                );
                totalMinutes += minutes;
            }
        } else {
            // Use PM times
            if (dtrRow.pmArrival && dtrRow.pmDeparture) {
                const minutes = calculateOverlap(
                    dtrRow.pmArrival,
                    dtrRow.pmDeparture,
                    timeBlock.start,
                    timeBlock.end
                );
                totalMinutes += minutes;
            }
        }
    }

    return minutesToHours(totalMinutes);
}

// Calculate and Display Results
function calculateAndDisplay() {
    if (!state.dtrData || Object.keys(state.schedule).length === 0) {
        showMessage('Please configure schedule and upload PDF', 'warning');
        return;
    }

    if (!state.dtrData.rows || state.dtrData.rows.length === 0) {
        console.error('No DTR rows parsed from PDF');
        showMessage('Could not parse DTR data from PDF. Please check the file format.', 'error');
        return;
    }

    const resultsTable = document.getElementById('resultsTable').querySelector('tbody');
    const employeeInfo = document.getElementById('employeeInfo');
    const noResults = document.getElementById('noResults');
    const resultsContainer = document.getElementById('resultsContainer');

    resultsTable.innerHTML = '';

    // Employee Info
    employeeInfo.innerHTML = `
        <p><strong>Employee:</strong> ${state.employeeName}</p>
        <p><strong>Month:</strong> ${state.month}</p>
    `;

    let totalHours = 0;
    let workingDays = 0;

    // Parse month and year more robustly
    const monthName = state.month.split(' ')[0] || 'June';
    const yearStr = state.month.split(' ')[1] || '2026';
    const tempDate = new Date(`${monthName} 1, ${yearStr}`);
    const monthIndex = tempDate.getMonth();
    const year = tempDate.getFullYear();

    console.log('Processing rows for month:', monthName, 'year:', year, 'monthIndex:', monthIndex);

    state.dtrData.rows.forEach(row => {
        const date = new Date(year, monthIndex, row.day);
        const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
        
        let calculatedHours = 0;
        let status = '';

        if (row.isHoliday) {
            status = 'Holiday';
        } else if (row.isTravel) {
            status = `Travel - ${row.hours || 0}h${row.minutes ? ` ${row.minutes}m` : ''}`;
        } else if (!state.schedule[dayName]) {
            status = 'No Schedule';
        } else if (row.amArrival || row.pmArrival) {
            calculatedHours = calculateHours(row, dayName);
            if (calculatedHours > 0) {
                workingDays++;
                totalHours += calculatedHours;
            }
        } else {
            status = 'No Entry';
        }

        const amDisplay = row.amArrival && row.amDeparture 
            ? `${formatTime(row.amArrival)}-${formatTime(row.amDeparture)}`
            : '-';
        const pmDisplay = row.pmArrival && row.pmDeparture 
            ? `${formatTime(row.pmArrival)}-${formatTime(row.pmDeparture)}`
            : '-';

        const tr = document.createElement('tr');
        tr.className = (calculatedHours > 0 || row.isTravel) ? 'working-day' : 'non-working-day';
        
        tr.innerHTML = `
            <td>${dayName}</td>
            <td>${date.getDate().toString().padStart(2, '0')} ${date.toLocaleString('default', { month: 'short' })}</td>
            <td>${amDisplay}</td>
            <td>${pmDisplay}</td>
            <td>${calculatedHours > 0 ? `<span class="hours-highlight">${calculatedHours.toFixed(2)}h</span>` : '-'}</td>
            <td>${status ? (status.startsWith('Travel') ? `<span class="note-travel">${status}</span>` : `<span class="note-holiday">${status}</span>`) : ''}</td>
        `;

        resultsTable.appendChild(tr);
    });

    console.log('Final totals - Days:', workingDays, 'Hours:', totalHours);
    
    document.getElementById('totalDays').textContent = workingDays;
    document.getElementById('totalHours').textContent = totalHours.toFixed(2);

    noResults.classList.add('hidden');
    resultsContainer.classList.remove('hidden');
}

function formatTime(timeObj) {
    if (!timeObj) return '-';
    const hour = timeObj.hour.toString().padStart(2, '0');
    const minute = timeObj.minute.toString().padStart(2, '0');
    const period = timeObj.period || 'AM';
    return `${hour}:${minute} ${period}`;
}

// Utility Functions
function showMessage(message, type = 'info') {
    // Create a temporary alert (you can enhance this)
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        border-radius: 8px;
        z-index: 1000;
        animation: slideDown 0.3s ease;
    `;

    if (type === 'success') {
        alertDiv.style.backgroundColor = '#10b981';
        alertDiv.style.color = 'white';
    } else if (type === 'error') {
        alertDiv.style.backgroundColor = '#ef4444';
        alertDiv.style.color = 'white';
    } else if (type === 'warning') {
        alertDiv.style.backgroundColor = '#f59e0b';
        alertDiv.style.color = 'white';
    } else {
        alertDiv.style.backgroundColor = '#2563eb';
        alertDiv.style.color = 'white';
    }

    alertDiv.textContent = message;
    document.body.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.style.animation = 'fadeIn 0.3s ease reverse';
        setTimeout(() => alertDiv.remove(), 300);
    }, 3000);
}

function resetCalculator() {
    if (confirm('Are you sure you want to reset the calculator?')) {
        state.dtrData = null;
        state.employeeName = '';
        state.month = '';
        
        document.getElementById('scheduleDisplay').classList.add('hidden');
        document.getElementById('resultsContainer').classList.add('hidden');
        document.getElementById('noResults').classList.remove('hidden');
        pdfInput.value = '';
        
        showMessage('Calculator reset', 'info');
    }
}

function printResults() {
    window.print();
}
