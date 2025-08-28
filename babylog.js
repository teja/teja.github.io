document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    // Areas
    const confirmationArea = document.getElementById('confirmation-area');
    const recordsArea = document.getElementById('records-area');
    const successMessage = document.getElementById('success-message');
    // Buttons
    const logButton = document.getElementById('log-button');
    const showRecordsButton = document.getElementById('show-records-button');
    const confirmButton = document.getElementById('confirm-button');
    const tryAgainButton = document.getElementById('try-again-button');
    const filterButton = document.getElementById('filter-button');
    // Voice Log
    const transcribedText = document.getElementById('transcribed-text');
    // Standard Log
    const standardLogForm = document.getElementById('standard-log-form');
    const eventTypeSelect = document.getElementById('event-type');
    const timeOffsetSelect = document.getElementById('time-offset');
    const customTimeGroup = document.getElementById('custom-time-group');
    const customTimeInput = document.getElementById('custom-time');
    // Records
    const recordsContainer = document.getElementById('records-container');
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
        }, 3000); // Hide after 3 seconds
    }

    // Generic function to save a record
    function saveRecord(message, timestamp) {
        const record = { message, timestamp };
        let records = JSON.parse(localStorage.getItem('babyLogRecords')) || [];
        records.push(record);
        localStorage.setItem('babyLogRecords', JSON.stringify(records));
    }

    function parseTimeFromTranscript(transcript) {
        const now = new Date();
        transcript = transcript.toLowerCase();

        // Pattern: "30 minutes ago", "1 minute ago"
        let match = transcript.match(/(\d+)\s+minutes? ago/);
        if (match) {
            const minutes = parseInt(match[1], 10);
            now.setMinutes(now.getMinutes() - minutes);
            return now;
        }

        // Pattern: "2 hours ago", "1 hour ago"
        match = transcript.match(/(\d+)\s+hours? ago/);
        if (match) {
            const hours = parseInt(match[1], 10);
            now.setHours(now.getHours() - hours);
            return now;
        }

        // Pattern: "an hour ago"
        if (transcript.includes('an hour ago')) {
            now.setHours(now.getHours() - 1);
            return now;
        }

        // Pattern: "yesterday"
        if (transcript.includes('yesterday')) {
            now.setDate(now.getDate() - 1);
            return now;
        }

        // Pattern: "last night"
        if (transcript.includes('last night')) {
            now.setDate(now.getDate() - 1);
            now.setHours(20, 0, 0, 0); // Assume 8 PM
            return now;
        }

        return null; // No time expression found
    }


    // --- Voice Recognition Setup ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;

        recognition.onstart = () => {
            logButton.textContent = 'Listening...';
            logButton.disabled = true;
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
            logButton.textContent = 'Log';
            logButton.disabled = false;
            if (final_transcript) {
                transcribedText.textContent = final_transcript;
                confirmationArea.style.display = 'block';
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            logButton.textContent = 'Log';
            logButton.disabled = false;
        };
    } else {
        alert('Your browser does not support the Web Speech API. Please try Chrome or another supported browser.');
        logButton.disabled = true;
    }

    logButton.addEventListener('click', () => {
        if (recognition) {
            final_transcript = '';
            recognition.start();
        }
    });

    confirmButton.addEventListener('click', () => {
        const message = final_transcript;
        if (message) {
            const parsedDate = parseTimeFromTranscript(message);
            const timestamp = (parsedDate || new Date()).toISOString();

            saveRecord(message, timestamp);

            confirmationArea.style.display = 'none';
            final_transcript = '';
            transcribedText.textContent = '';
            showSuccessMessage('Voice log saved!');
        }
    });

    tryAgainButton.addEventListener('click', () => {
        confirmationArea.style.display = 'none';
        final_transcript = '';
        transcribedText.textContent = '';
    });


    // --- Standard Log Logic ---
    timeOffsetSelect.addEventListener('change', () => {
        if (timeOffsetSelect.value === 'custom') {
            customTimeGroup.style.display = 'block';
        } else {
            customTimeGroup.style.display = 'none';
        }
    });

    standardLogForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const eventType = eventTypeSelect.options[eventTypeSelect.selectedIndex].text;
        const timeOffset = timeOffsetSelect.value;

        let timestamp;

        if (timeOffset === 'custom') {
            if (customTimeInput.value) {
                timestamp = new Date(customTimeInput.value).toISOString();
            } else {
                // Handle case where custom is selected but no time is entered
                alert('Please select a custom time.');
                return;
            }
        } else {
            const now = new Date();
            now.setMinutes(now.getMinutes() - parseInt(timeOffset, 10));
            timestamp = now.toISOString();
        }

        saveRecord(eventType, timestamp);
        showSuccessMessage('Standard log saved!');

        // Optional: Reset form
        standardLogForm.reset();
        customTimeGroup.style.display = 'none';
    });


    // --- Record Display and Filtering ---
    function displayRecords(records) {
        recordsContainer.innerHTML = ''; // Clear previous records
        if (!records || records.length === 0) {
            recordsContainer.innerHTML = '<p>No records found.</p>';
            return;
        }

        // Sort records by timestamp, newest first
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

    showRecordsButton.addEventListener('click', () => {
        const isDisplayed = recordsArea.style.display !== 'none';
        recordsArea.style.display = isDisplayed ? 'none' : 'block';
        if (!isDisplayed) {
            loadAndDisplayRecords();
        }
    });

    filterButton.addEventListener('click', () => {
        const startDate = startDateInput.value ? new Date(startDateInput.value) : null;
        const endDate = endDateInput.value ? new Date(endDateInput.value) : null;

        const allRecords = JSON.parse(localStorage.getItem('babyLogRecords')) || [];

        const filteredRecords = allRecords.filter(record => {
            const recordDate = new Date(record.timestamp);
            if (startDate && recordDate < startDate) {
                return false;
            }
            if (endDate && recordDate > endDate) {
                return false;
            }
            return true;
        });

        displayRecords(filteredRecords);
    });
});
