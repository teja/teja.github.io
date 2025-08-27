document.addEventListener('DOMContentLoaded', () => {
    const logButton = document.getElementById('log-button');
    const showRecordsButton = document.getElementById('show-records-button');
    const confirmationArea = document.getElementById('confirmation-area');
    const transcribedText = document.getElementById('transcribed-text');
    const confirmButton = document.getElementById('confirm-button');
    const tryAgainButton = document.getElementById('try-again-button');
    const recordsArea = document.getElementById('records-area');
    const recordsContainer = document.getElementById('records-container');
    const filterButton = document.getElementById('filter-button');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');

    let recognition;
    let final_transcript = '';

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
            const timestamp = new Date().toISOString();
            const record = { message, timestamp };

            let records = JSON.parse(localStorage.getItem('babyLogRecords')) || [];
            records.push(record);
            localStorage.setItem('babyLogRecords', JSON.stringify(records));

            confirmationArea.style.display = 'none';
            final_transcript = '';
            transcribedText.textContent = '';
            alert('Record saved!');
        }
    });

    tryAgainButton.addEventListener('click', () => {
        confirmationArea.style.display = 'none';
        final_transcript = '';
        transcribedText.textContent = '';
    });

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
