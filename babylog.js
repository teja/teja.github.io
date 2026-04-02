document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const appContainer = document.querySelector('.app-container');
    const voiceLogButton = document.getElementById('voice-log-button');
    const standardLogForm = document.getElementById('standard-log-form');
    // Tab Elements
    const tabBar = document.querySelector('.tab-bar');
    const tabPanels = document.querySelectorAll('.tab-panel');
    const timeOffsetGroup = document.getElementById('time-offset-group');
    const customTimeGroup = document.getElementById('custom-time-group');
    const customDateInput = document.getElementById('custom-date');
    const customTimeInput = document.getElementById('custom-time');
    const confirmationArea = document.getElementById('confirmation-area');
    const transcribedText = document.getElementById('transcribed-text');
    const confirmButton = document.getElementById('confirm-button');
    const tryAgainButton = document.getElementById('try-again-button');
    const recordsArea = document.getElementById('records-area');
    const recordsContainer = document.getElementById('records-container');
    const successMessage = document.getElementById('success-message');
    const saveOverlay = document.getElementById('save-overlay');
    const filterButton = document.getElementById('filter-button');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const exportRecordsButton = document.getElementById('export-records-button');
    const exportReportButton = document.getElementById('export-report-button');
    const noteInput = document.getElementById('note-input');
    const noteVoiceButton = document.getElementById('note-voice-button');

    // Settings Elements
    const customizeEventsButton = document.getElementById('customize-events-button');
    const settingsModal = document.getElementById('settings-modal');
    const closeButton = document.querySelector('.close-button');
    const eventManagementList = document.getElementById('event-management-list');
    const addEventForm = document.getElementById('add-event-form');
    const newEventNameInput = document.getElementById('new-event-name');
    const newEventKeywordsInput = document.getElementById('new-event-keywords');
    const eventTypeGroup = document.getElementById('event-type-group');
    const dailyTableHeaderRow = document.getElementById('daily-table-header-row');

    // --- State Variables ---
    const DEFAULT_EVENT_CONFIG = {
        Feed: { keywords: ['feed', 'food', 'eat', 'ate', 'nurse', 'nursing', 'bottle', 'fed'], enabled: true },
        Poo: { keywords: ['poo', 'poop', 'pooped', 'soiled', 'bowel movement'], enabled: true },
        Urine: { keywords: ['urine', 'urinate', 'urinated', 'pee', 'wet'], enabled: true },
        Sleep: { keywords: ['sleep', 'slept', 'nap', 'napped', 'bedtime'], enabled: true }
    };

    let eventConfig = loadEventConfig();

    let recognition;
    let final_transcript = '';

    // --- Functions ---
    function showSuccessMessage(message) {
        appContainer.classList.add('blur');
        saveOverlay.classList.add('active');

        setTimeout(() => {
            appContainer.classList.remove('blur');
            saveOverlay.classList.remove('active');
        }, 500);
    }

    function playAnimalSound(animal) {
        const audio = new Audio(`https://raw.githubusercontent.com/earthspecies/library/main/${animal.toLowerCase()}/sound.mp3`);
        audio.play();
    }

    function saveRecord(message, timestamp, note = '') {
        const record = { message, timestamp, note };
        let records = JSON.parse(localStorage.getItem('babyLogRecords')) || [];
        records.push(record);
        localStorage.setItem('babyLogRecords', JSON.stringify(records));
        updateSummary(records);
    }

    function parseTimeFromTranscript(transcript) {
        const now = new Date();
        transcript = transcript.toLowerCase();

        // Check for explicit time like "4:00" or "4:00 pm"
        let timeMatch = transcript.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?/);
        if (timeMatch) {
            let hour = parseInt(timeMatch[1], 10);
            const minute = parseInt(timeMatch[2], 10);
            const period = timeMatch[3];

            if (period === 'pm' && hour < 12) {
                hour += 12;
            } else if (period === 'am' && hour === 12) { // Midnight case
                hour = 0;
            }

            const candidateDate = new Date();
            candidateDate.setHours(hour, minute, 0, 0);

            // If the time is in the future, assume it was yesterday
            if (candidateDate > now) {
                candidateDate.setDate(candidateDate.getDate() - 1);
            }
            return candidateDate;
        }

        let match = transcript.match(/(\d+)\s+minutes? ago/);
        if (match) { now.setMinutes(now.getMinutes() - parseInt(match[1], 10)); return now; }
        match = transcript.match(/(\d+)\s+hours? ago/);
        if (match) { now.setHours(now.getHours() - parseInt(match[1], 10)); return now; }
        if (transcript.includes('an hour ago')) { now.setHours(now.getHours() - 1); return now; }
        if (transcript.includes('yesterday')) { now.setDate(now.getDate() - 1); return now; }
        if (transcript.includes('last night')) { now.setDate(now.getDate() - 1); now.setHours(20, 0, 0, 0); return now; }
        return null;
    }

    function displayRecords(records) {
        recordsContainer.innerHTML = '';
        if (!records || records.length === 0) {
            recordsContainer.innerHTML = '<p>No records found.</p>';
            return;
        }
        records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        records.forEach(record => {
            const recordElement = document.createElement('div');
            recordElement.classList.add('record');
            const contentWrapper = document.createElement('div');
            const messageElement = document.createElement('p');
            messageElement.textContent = record.message;
            contentWrapper.appendChild(messageElement);

            if (record.note) {
                const noteElement = document.createElement('p');
                noteElement.classList.add('record-note');
                noteElement.textContent = record.note;
                contentWrapper.appendChild(noteElement);
            }
            recordElement.appendChild(contentWrapper);

            const timeElement = document.createElement('small');
            timeElement.textContent = new Date(record.timestamp).toLocaleString();
            recordElement.appendChild(timeElement);

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete';
            deleteButton.classList.add('delete-record-button');
            deleteButton.dataset.timestamp = record.timestamp;
            recordElement.appendChild(deleteButton);

            recordsContainer.appendChild(recordElement);
        });
    }

    function loadAndDisplayRecords() {
        const records = JSON.parse(localStorage.getItem('babyLogRecords')) || [];
        displayRecords(records);
    }

    // --- Configuration Logic ---
    function loadEventConfig() {
        const savedConfig = localStorage.getItem('babyLogEventConfig');
        if (savedConfig) {
            return JSON.parse(savedConfig);
        }
        return DEFAULT_EVENT_CONFIG;
    }

    function saveEventConfig() {
        localStorage.setItem('babyLogEventConfig', JSON.stringify(eventConfig));
    }

    function getEnabledEvents() {
        return Object.keys(eventConfig).filter(type => eventConfig[type].enabled);
    }

    function getEventType(message) {
        const lowerMessage = message.toLowerCase();
        for (const type in eventConfig) {
            if (eventConfig[type].keywords.some(keyword => new RegExp(`\\b${keyword}\\b`).test(lowerMessage))) {
                return type;
            }
        }
        return null;
    }

    // --- Dynamic UI Rendering ---
    function renderEventButtons() {
        const enabledEvents = getEnabledEvents();
        eventTypeGroup.innerHTML = '';
        enabledEvents.forEach((type, index) => {
            const input = document.createElement('input');
            input.type = 'radio';
            input.id = `event-${type.toLowerCase()}`;
            input.name = 'event-type';
            input.value = type;
            if (index === 0) input.checked = true;

            const label = document.createElement('label');
            label.htmlFor = `event-${type.toLowerCase()}`;
            label.textContent = type;

            eventTypeGroup.appendChild(input);
            eventTypeGroup.appendChild(label);
        });
    }

    function renderReportHeaders() {
        const enabledEvents = getEnabledEvents();
        dailyTableHeaderRow.innerHTML = '<th>Date</th>';
        enabledEvents.forEach(type => {
            const th = document.createElement('th');
            th.textContent = type === 'Feed' ? 'Feeds' : type; // Special case for Feed as Feeds
            dailyTableHeaderRow.appendChild(th);
        });
    }

    function renderSettingsModal() {
        eventManagementList.innerHTML = '';
        Object.keys(eventConfig).forEach(type => {
            const item = document.createElement('div');
            item.className = 'event-manage-item';
            item.innerHTML = `
                <span>${type}</span>
                <input type="checkbox" data-event="${type}" ${eventConfig[type].enabled ? 'checked' : ''}>
            `;
            eventManagementList.appendChild(item);
        });
    }

    function formatTimeSince(date) {
        if (!date) return 'N/A';
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + "h " + Math.floor((seconds % 3600) / 60) + "m";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + "m";
        return Math.floor(seconds) + "s";
    }

    function updateSummary(allRecords) {
        const summaryContainers = document.querySelectorAll('.summary-container');
        if (summaryContainers.length === 0) return;

        const enabledEvents = getEnabledEvents();

        // --- 24-Hour Summary ---
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentRecords = allRecords.filter(r => new Date(r.timestamp) > twentyFourHoursAgo);

        const summaryCounts = {};
        enabledEvents.forEach(type => summaryCounts[type] = 0);

        recentRecords.forEach(record => {
            const eventType = getEventType(record.message);
            if (eventType && summaryCounts.hasOwnProperty(eventType)) {
                summaryCounts[eventType]++;
            }
        });

        // --- Time Since Last Event ---
        const lastEvents = {};
        enabledEvents.forEach(type => lastEvents[type] = null);

        const sortedRecords = [...allRecords].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        for (const record of sortedRecords) {
            const eventType = getEventType(record.message);
            if (eventType && lastEvents.hasOwnProperty(eventType) && !lastEvents[eventType]) {
                lastEvents[eventType] = new Date(record.timestamp);
            }
            // Optimization: check if all enabled events found
            if (enabledEvents.every(type => lastEvents[type] !== null)) break;
        }

        const headerRow = `<tr><th></th>${enabledEvents.map(type => `<th>${type}</th>`).join('')}</tr>`;
        const countRow = `<tr><td><strong>In last 24 hrs</strong></td>${enabledEvents.map(type => `<td>${summaryCounts[type]}</td>`).join('')}</tr>`;
        const timeRow = `<tr><td><strong>Last time was..</strong></td>${enabledEvents.map(type => `<td>${formatTimeSince(lastEvents[type])}</td>`).join('')}</tr>`;

        const summaryHTML = `
            <table class="summary-table">
                <thead>
                    ${headerRow}
                </thead>
                <tbody>
                    ${countRow}
                    ${timeRow}
                </tbody>
            </table>
        `;

        summaryContainers.forEach(container => {
            container.innerHTML = summaryHTML;
        });
    }

    let dailyDataForExport = {};

    function generateReport() {
        const allRecords = JSON.parse(localStorage.getItem('babyLogRecords')) || [];
        const dailyTableBody = document.getElementById('daily-table-body');
        const enabledEvents = getEnabledEvents();

        // --- Daily Breakdown ---
        const dailyData = {};
        allRecords.forEach(record => {
            const eventType = getEventType(record.message);
            if (eventType && eventConfig[eventType].enabled) {
                const recordDate = new Date(record.timestamp);
                const year = recordDate.getFullYear();
                const month = recordDate.getMonth() + 1;
                const day = recordDate.getDate();
                const date = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                if (!dailyData[date]) {
                    dailyData[date] = {};
                    enabledEvents.forEach(type => dailyData[date][type] = 0);
                }
                if (dailyData[date].hasOwnProperty(eventType)) {
                    dailyData[date][eventType]++;
                }
            }
        });

        dailyTableBody.innerHTML = ''; // Clear existing rows
        const sortedDates = Object.keys(dailyData).sort().reverse(); // Newest first

        dailyDataForExport = sortedDates.map(date => ({
            date,
            ...dailyData[date]
        }));

        sortedDates.forEach(date => {
            const data = dailyData[date];
            const row = document.createElement('tr');
            let rowHTML = `<td>${date}</td>`;
            enabledEvents.forEach(type => {
                rowHTML += `<td>${data[type] || 0}</td>`;
            });
            row.innerHTML = rowHTML;
            dailyTableBody.appendChild(row);
        });
    }

    // --- Event Listeners ---
    function switchTab(tabId) {
        // Deactivate all tabs and panels
        document.querySelectorAll('.tab-button').forEach(button => button.classList.remove('active'));
        tabPanels.forEach(panel => panel.classList.remove('active'));

        // Activate the selected tab and panel
        const tabButton = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
        const tabPanel = document.getElementById(`${tabId}-tab`);
        if (tabButton && tabPanel) {
            tabButton.classList.add('active');
            tabPanel.classList.add('active');
        }

        // Load data if switching to a tab
        if (tabId === 'records') {
            loadAndDisplayRecords();
        } else if (tabId === 'report') {
            generateReport();
        }
    }

    tabBar.addEventListener('click', (event) => {
        if (event.target.matches('.tab-button')) {
            const tabId = event.target.dataset.tab;
            switchTab(tabId);
        }
    });

    // Settings Modal Listeners
    customizeEventsButton.addEventListener('click', () => {
        renderSettingsModal();
        settingsModal.classList.add('active');
    });

    closeButton.addEventListener('click', () => {
        settingsModal.classList.remove('active');
    });

    window.addEventListener('click', (event) => {
        if (event.target === settingsModal) {
            settingsModal.classList.remove('active');
        }
    });

    eventManagementList.addEventListener('change', (event) => {
        if (event.target.matches('input[type="checkbox"]')) {
            const eventType = event.target.dataset.event;
            eventConfig[eventType].enabled = event.target.checked;
            saveEventConfig();
            renderEventButtons();
            renderReportHeaders();
            updateSummary(JSON.parse(localStorage.getItem('babyLogRecords')) || []);
            if (document.getElementById('report-tab').classList.contains('active')) {
                generateReport();
            }
        }
    });

    addEventForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const name = newEventNameInput.value.trim();
        const keywordsInput = newEventKeywordsInput.value.trim();
        if (name && keywordsInput) {
            const keywordsArray = keywordsInput.split(',').map(k => k.trim().toLowerCase());
            eventConfig[name] = { keywords: keywordsArray, enabled: true };
            saveEventConfig();
            renderSettingsModal();
            renderEventButtons();
            renderReportHeaders();
            updateSummary(JSON.parse(localStorage.getItem('babyLogRecords')) || []);
            addEventForm.reset();
        }
    });

    timeOffsetGroup.addEventListener('change', (event) => {
        if (event.target.value === 'custom') {
            customTimeGroup.style.display = 'block';
            const now = new Date();
            const year = now.getFullYear();
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const day = now.getDate().toString().padStart(2, '0');
            customDateInput.value = `${year}-${month}-${day}`;
        } else {
            customTimeGroup.style.display = 'none';
        }
    });

    standardLogForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const eventType = document.querySelector('input[name="event-type"]:checked').value;
        const timeOffset = document.querySelector('input[name="time-offset"]:checked').value;
        const note = noteInput.value.trim();

        let timestamp;
        if (timeOffset === 'custom') {
            if (customDateInput.value && customTimeInput.value) {
                const dateTimeString = `${customDateInput.value}T${customTimeInput.value}`;
                timestamp = new Date(dateTimeString).toISOString();
            } else {
                alert('Please select a custom date and time.');
                return;
            }
        } else {
            const now = new Date();
            now.setMinutes(now.getMinutes() - parseInt(timeOffset, 10));
            timestamp = now.toISOString();
        }
        saveRecord(eventType, timestamp, note);
        showSuccessMessage('Standard log saved!');
        standardLogForm.reset();
        noteInput.value = '';
        customTimeGroup.style.display = 'none';
    });

    exportRecordsButton.addEventListener('click', exportRecordsToCSV);
    exportReportButton.addEventListener('click', exportReportToCSV);

    filterButton.addEventListener('click', () => {
        const startDate = startDateInput.value ? new Date(startDateInput.value.replace(/-/g, '\/')) : null;
        const endDate = endDateInput.value ? new Date(endDateInput.value.replace(/-/g, '\/')) : null;
        if (endDate) {
            endDate.setHours(23, 59, 59, 999); // Set to end of day
        }
        const allRecords = JSON.parse(localStorage.getItem('babyLogRecords')) || [];
        const filteredRecords = allRecords.filter(record => {
            const recordDate = new Date(record.timestamp);
            if (startDate && recordDate < startDate) return false;
            if (endDate && recordDate > endDate) return false;
            return true;
        });
        displayRecords(filteredRecords);
    });

    // Voice Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        // Main voice log recognition
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;

        recognition.onstart = () => {
            voiceLogButton.textContent = 'Listening...';
            voiceLogButton.disabled = true;
            confirmationArea.style.display = 'none';
        };

        recognition.onresult = (event) => {
            let interim_transcript = '';
            final_transcript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    final_transcript += event.results[i][0].transcript;
                } else {
                    interim_transcript += event.results[i][0].transcript;
                }
            }
            transcribedText.textContent = final_transcript || interim_transcript;
        };

        recognition.onend = () => {
            voiceLogButton.textContent = 'Voice Log';
            voiceLogButton.disabled = false;
            if (final_transcript) {
                transcribedText.textContent = final_transcript;
                confirmationArea.style.display = 'block';
            }
        };

        voiceLogButton.addEventListener('click', () => {
            final_transcript = '';
            recognition.start();
        });

        confirmButton.addEventListener('click', () => {
            const message = final_transcript;
            if (message) {
                const parsedDate = parseTimeFromTranscript(message);
                const timestamp = (parsedDate || new Date()).toISOString();
                saveRecord(message, timestamp, ''); // No note for voice logs yet
                showSuccessMessage('Voice log saved!');
                confirmationArea.style.display = 'none';
                final_transcript = '';
            }
        });

        tryAgainButton.addEventListener('click', () => {
            confirmationArea.style.display = 'none';
            final_transcript = '';
        });

        // Note field voice input recognition
        const noteRecognition = new SpeechRecognition();
        noteRecognition.continuous = false;
        noteRecognition.interimResults = false; // We just want the final result

        noteRecognition.onstart = () => {
            noteVoiceButton.textContent = '...';
            noteVoiceButton.disabled = true;
        };

        noteRecognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            noteInput.value += transcript; // Append to existing text
        };

        noteRecognition.onend = () => {
            noteVoiceButton.textContent = '🎤';
            noteVoiceButton.disabled = false;
        };

        noteVoiceButton.addEventListener('click', () => {
            noteRecognition.start();
        });

    } else {
        voiceLogButton.disabled = true;
        showSuccessMessage('Voice recognition not supported.');
    }

    // --- Export Functions ---
    function downloadCSV(csvContent, fileName) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.href) {
            URL.revokeObjectURL(link.href);
        }
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function exportReportToCSV() {
        const enabledEvents = getEnabledEvents();
        let csvContent = '"Date",' + enabledEvents.map(type => `"${type === 'Feed' ? 'Feeds' : type}"`).join(',') + '\n';

        dailyDataForExport.forEach(row => {
            let rowData = [row.date];
            enabledEvents.forEach(type => {
                rowData.push(row[type] || 0);
            });
            csvContent += rowData.join(',') + '\n';
        });
        downloadCSV(csvContent, 'babylog-report.csv');
    }

    function exportRecordsToCSV() {
        const allRecords = JSON.parse(localStorage.getItem('babyLogRecords')) || [];
        const startDate = startDateInput.value ? new Date(startDateInput.value.replace(/-/g, '\/')) : null;
        const endDate = endDateInput.value ? new Date(endDateInput.value.replace(/-/g, '\/')) : null;
        if (endDate) {
            endDate.setHours(23, 59, 59, 999);
        }

        const filteredRecords = allRecords.filter(record => {
            const recordDate = new Date(record.timestamp);
            if (startDate && recordDate < startDate) return false;
            if (endDate && recordDate > endDate) return false;
            return true;
        });

        let csvContent = '"Timestamp","Message"\n';
        filteredRecords.forEach(record => {
            const timestamp = record.timestamp;
            const message = `"${record.message.replace(/"/g, '""')}"`;
            csvContent += `${timestamp},${message}\n`;
        });

        downloadCSV(csvContent, 'babylog-records.csv');
    }

    recordsContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('delete-record-button')) {
            const timestampToDelete = event.target.dataset.timestamp;
            if (confirm('Are you sure you want to delete this record?')) {
                let records = JSON.parse(localStorage.getItem('babyLogRecords')) || [];
                const updatedRecords = records.filter(record => record.timestamp !== timestampToDelete);
                localStorage.setItem('babyLogRecords', JSON.stringify(updatedRecords));
                loadAndDisplayRecords();
                updateSummary(updatedRecords);
                showSuccessMessage('Record deleted.');
            }
        }
    });

    // --- Initial Load ---
    const initialRecords = JSON.parse(localStorage.getItem('babyLogRecords')) || [];
    renderEventButtons();
    renderReportHeaders();
    updateSummary(initialRecords);

    // --- PWA Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                })
                .catch((error) => {
                    console.log('ServiceWorker registration failed: ', error);
                });
        });
    }

    // --- Animal Sounds ---
    const animalSoundsButton = document.getElementById('animal-sounds-button');
    const animalSoundsVideo = document.getElementById('animal-sounds-video');
    const animalSoundsOverlay = document.getElementById('animal-sounds-overlay');
    let stream;
    let model;

    async function startCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
            animalSoundsVideo.srcObject = stream;
            animalSoundsButton.textContent = 'Stop Camera';
            detectObjects();
        } catch (error) {
            console.error('Error accessing camera:', error);
        }
    }

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            animalSoundsVideo.srcObject = null;
            animalSoundsButton.textContent = 'Start Camera';
        }
    }

    animalSoundsButton.addEventListener('click', () => {
        if (animalSoundsVideo.srcObject) {
            stopCamera();
        } else {
            startCamera();
        }
    });

    const animalClasses = ['bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe'];

    async function detectObjects() {
        if (!model) {
            model = await cocoSsd.load();
        }

        if (animalSoundsVideo.srcObject) {
            const predictions = await model.detect(animalSoundsVideo);
            const animals = predictions.filter(prediction => animalClasses.includes(prediction.class));

            if (animals.length > 0) {
                const animal = animals[0];
                animalSoundsOverlay.textContent = animal.class;
                playAnimalSound(animal.class);
            } else {
                animalSoundsOverlay.textContent = '';
            }

            requestAnimationFrame(detectObjects);
        }
    }
});
