const MODES = {
    pomodoro: {
        time: 25 * 60,
        color: 'var(--pomodoro-color)',
        glow: 'rgba(244, 63, 94, 0.5)',
        text: 'Time to focus!'
    },
    shortBreak: {
        time: 5 * 60,
        color: 'var(--short-break-color)',
        glow: 'rgba(59, 130, 246, 0.5)',
        text: 'Take a quick breather.'
    },
    longBreak: {
        time: 15 * 60,
        color: 'var(--long-break-color)',
        glow: 'rgba(16, 185, 129, 0.5)',
        text: 'Time for a longer break.'
    }
};

let currentMode = 'pomodoro';
let timeLeft = MODES[currentMode].time;
let timerInterval = null;
let isRunning = false;
let audioContext = null;

// DOM Elements
const timeDisplay = document.getElementById('time-left');
const statusText = document.getElementById('status-text');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const modeBtns = document.querySelectorAll('.mode-btn');
const progressCircle = document.querySelector('.progress-ring__circle');
const timerContainer = document.querySelector('.timer-display');

// Settings Elements
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const pomodoroInput = document.getElementById('pomodoro-time');
const shortBreakInput = document.getElementById('short-break-time');
const longBreakInput = document.getElementById('long-break-time');

// SVG Circle properties
const radius = progressCircle.r.baseVal.value;
const circumference = radius * 2 * Math.PI;
progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
progressCircle.style.strokeDashoffset = circumference;

// Initialize
updateDisplay();
setProgress(1);

// Event Listeners
startBtn.addEventListener('click', () => {
    // Initialize AudioContext on first user interaction to comply with browser policies
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    toggleTimer();
});
resetBtn.addEventListener('click', resetTimer);

modeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (isRunning) {
            const confirmSwitch = confirm('Timer is running. Are you sure you want to switch modes?');
            if (!confirmSwitch) return;
            pauseTimer();
        }
        modeBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentMode = e.target.dataset.mode;
        setMode(currentMode);
    });
});

// Settings Event Listeners
settingsBtn.addEventListener('click', () => {
    // Populate inputs with current settings
    pomodoroInput.value = Math.round(MODES.pomodoro.time / 60);
    shortBreakInput.value = Math.round(MODES.shortBreak.time / 60);
    longBreakInput.value = Math.round(MODES.longBreak.time / 60);
    settingsModal.classList.remove('hidden');
});

closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
});

saveSettingsBtn.addEventListener('click', () => {
    const newPomo = parseInt(pomodoroInput.value);
    const newShort = parseInt(shortBreakInput.value);
    const newLong = parseInt(longBreakInput.value);

    if (newPomo > 0) MODES.pomodoro.time = newPomo * 60;
    if (newShort > 0) MODES.shortBreak.time = newShort * 60;
    if (newLong > 0) MODES.longBreak.time = newLong * 60;

    settingsModal.classList.add('hidden');
    resetTimer(); // Apply new time to current mode
});

function toggleTimer() {
    if (isRunning) pauseTimer();
    else startTimer();
}

function startTimer() {
    isRunning = true;
    timerContainer.classList.add('timer-active');
    
    startBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-pause"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
        <span>Pause</span>
    `;

    timerInterval = setInterval(() => {
        timeLeft--;
        updateDisplay();
        
        const totalTime = MODES[currentMode].time;
        const progress = timeLeft / totalTime;
        setProgress(progress);

        if (timeLeft <= 0) {
            pauseTimer();
            playAlarm();
            setTimeout(() => {
                alert('Timer finished!');
                resetTimer();
            }, 100);
        }
    }, 1000);
}

function pauseTimer() {
    isRunning = false;
    timerContainer.classList.remove('timer-active');
    clearInterval(timerInterval);
    
    startBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-play"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        <span>Start</span>
    `;
}

function resetTimer() {
    pauseTimer();
    timeLeft = MODES[currentMode].time;
    updateDisplay();
    setProgress(1);
}

function setMode(mode) {
    const root = document.documentElement;
    root.style.setProperty('--theme-color', MODES[mode].color);
    root.style.setProperty('--theme-glow', MODES[mode].glow);
    
    statusText.textContent = MODES[mode].text;
    resetTimer();
}

function updateDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const displayString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    timeDisplay.textContent = displayString;
    document.title = `${displayString} - Focus Timer`;
}

function setProgress(percent) {
    const offset = circumference - percent * circumference;
    progressCircle.style.strokeDashoffset = offset;
}

function playAlarm() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Play a sequence of 3 pleasant beeps
    for (let i = 0; i < 3; i++) {
        const osc = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioContext.currentTime + i * 0.5);
        osc.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + i * 0.5 + 0.3);
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime + i * 0.5);
        gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + i * 0.5 + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.5 + 0.4);
        
        osc.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        osc.start(audioContext.currentTime + i * 0.5);
        osc.stop(audioContext.currentTime + i * 0.5 + 0.4);
    }
}
