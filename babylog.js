document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
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
    const filterButton = document.getElementById('filter-button');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');

    // --- State Variables ---
    let recognition;
    let final_transcript = '';

    // --- Functions ---
    function showSuccessMessage(message) {
        successMessage.textContent = message;
        successMessage.style.display = 'block';
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 3000);
    }

    function saveRecord(message, timestamp) {
        const record = { message, timestamp };
        let records = JSON.parse(localStorage.getItem('babyLogRecords')) || [];
        records.push(record);
        localStorage.setItem('babyLogRecords', JSON.stringify(records));
    }

    function parseTimeFromTranscript(transcript) {
        const now = new Date();
        transcript = transcript.toLowerCase();
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
            const messageElement = document.createElement('p');
            messageElement.textContent = record.message;
            const timeElement = document.createElement('small');
            timeElement.textContent = new Date(record.timestamp).toLocaleString();
            recordElement.appendChild(messageElement);
            recordElement.appendChild(timeElement);
            recordsContainer.appendChild(recordElement);
        });
    }

    function loadAndDisplayRecords() {
        const records = JSON.parse(localStorage.getItem('babyLogRecords')) || [];
        displayRecords(records);
    }

    function generateReport() {
        const allRecords = JSON.parse(localStorage.getItem('babyLogRecords')) || [];
        const summaryContainer = document.getElementById('summary-container');
        const dailyTableBody = document.getElementById('daily-table-body');

        const keywords = {
            Feed: ['feed', 'food', 'eat', 'ate', 'nurse', 'nursing', 'bottle', 'fed'],
            Poo: ['poo', 'poop', 'pooped', 'soiled', 'bowel movement'],
            Urine: ['urine', 'urinate', 'urinated', 'pee', 'wet']
        };

        function getEventType(message) {
            const lowerMessage = message.toLowerCase();
            for (const type in keywords) {
                if (keywords[type].some(keyword => new RegExp(`\\b${keyword}\\b`).test(lowerMessage))) {
                    return type;
                }
            }
            return null;
        }

        // --- 24-Hour Summary ---
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentRecords = allRecords.filter(r => new Date(r.timestamp) > twentyFourHoursAgo);

        const summaryCounts = { Feed: 0, Poo: 0, Urine: 0 };
        recentRecords.forEach(record => {
            const eventType = getEventType(record.message);
            if (eventType) {
                summaryCounts[eventType]++;
            }
        });

        summaryContainer.innerHTML = `
            <span><strong>Feeds:</strong> ${summaryCounts.Feed}</span> |
            <span><strong>Poo:</strong> ${summaryCounts.Poo}</span> |
            <span><strong>Urine:</strong> ${summaryCounts.Urine}</span>
        `;

        // --- Daily Breakdown ---
        const dailyData = {};
        allRecords.forEach(record => {
            const eventType = getEventType(record.message);
            if (eventType) {
                const recordDate = new Date(record.timestamp);
                const year = recordDate.getFullYear();
                const month = recordDate.getMonth() + 1;
                const day = recordDate.getDate();
                const date = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                if (!dailyData[date]) {
                    dailyData[date] = { Feed: 0, Poo: 0, Urine: 0 };
                }
                dailyData[date][eventType]++;
            }
        });

        dailyTableBody.innerHTML = ''; // Clear existing rows
        const sortedDates = Object.keys(dailyData).sort().reverse(); // Newest first

        sortedDates.forEach(date => {
            const data = dailyData[date];
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(date).toLocaleDateString()}</td>
                <td>${data.Feed}</td>
                <td>${data.Poo}</td>
                <td>${data.Urine}</td>
            `;
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

        // Load data if switching to records or report tab
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
        saveRecord(eventType, timestamp);
        showSuccessMessage('Standard log saved!');
        standardLogForm.reset();
        customTimeGroup.style.display = 'none';
    });

    filterButton.addEventListener('click', () => {
        const startDate = startDateInput.value ? new Date(startDateInput.value) : null;
        const endDate = endDateInput.value ? new Date(endDateInput.value) : null;
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
                saveRecord(message, timestamp);
                showSuccessMessage('Voice log saved!');
                confirmationArea.style.display = 'none';
                final_transcript = '';
            }
        });

        tryAgainButton.addEventListener('click', () => {
            confirmationArea.style.display = 'none';
            final_transcript = '';
        });

    } else {
        voiceLogButton.disabled = true;
        showSuccessMessage('Voice recognition not supported.');
    }
});
