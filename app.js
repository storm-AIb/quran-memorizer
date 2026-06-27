// Smart Quran Memorizer Application Code

// State Variables
let currentSurah = 71; // Default to Surah Nuh
let surahList = [];
let surahAyahs = [];
let surahTafsir = []; // Caches Tafsir Al-Muyassar
let currentAyahIndex = 0;
let reciterAudio = document.getElementById('reciter-audio-element');
let isAudioPlaying = false;
let loopMode = false;
let autoplayMode = false; // Auto-play next verse
let currentAyahRepeatCount = 0; // Tracks repeating current ayah
let checkMode = false;
let showTafsir = false;
let wordSegments = [];
let highlightAnimationFrameId = null;

// User Surah Full Playback State
let isUserSurahPlaying = false;
let userSurahPlayList = []; // Array of { numberInSurah, index, blobUrl }
let currentUserSurahAudio = null;
let userSurahPlayIndex = 0;

// Web Audio API & Recording State
let audioCtx = null;
let micStream = null;
let processorStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordedAudioBlob = null;
let recordedAudioUrl = null;
let visualizerAnimationId = null;
let recordTimerInterval = null;
let recordSeconds = 0;

// Nodes
let micSource = null;
let micInputGainNode = null;
let dryGainNode = null;
let wetGainNode = null;
let convolverNode = null;
let compressorNode = null;
let filterLow = null;
let filterHigh = null;
let analyserNode = null;
let destNode = null;

// Recorded Player State
let userAudioElement = null;
let userAudioPlaying = false;
let userAudioDuration = 0;

// DOM Elements
const surahSearchSelect = document.getElementById('surah-search-select');
const surahSelectTrigger = document.getElementById('surah-select-trigger');
const selectedSurahLabel = document.getElementById('selected-surah-label');
const surahSelectDropdown = document.getElementById('surah-select-dropdown');
const surahSearchInput = document.getElementById('surah-search-input');
const surahOptionsList = document.getElementById('surah-options-list');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const recordedCountText = document.getElementById('recorded-count');
const basmalaContainer = document.getElementById('basmala-container');
const quranTextContainer = document.getElementById('quran-text-container');
const checkOverlay = document.getElementById('check-overlay');
const btnListen = document.getElementById('btn-listen');
const btnLoop = document.getElementById('btn-loop');
const btnHideText = document.getElementById('btn-hide-text');
const btnPrevAyah = document.getElementById('btn-prev-ayah');
const btnNextAyah = document.getElementById('btn-next-ayah');
const ayahIndexText = document.getElementById('ayah-index-text');
const indexTitle = document.getElementById('index-title');
const ayahIndexList = document.getElementById('ayah-index-list');
const btnTafsir = document.getElementById('btn-tafsir');
const tafsirContainer = document.getElementById('tafsir-container');
const tafsirTextContent = document.getElementById('tafsir-text-content');
const btnAutoplay = document.getElementById('btn-autoplay');
const btnKidsModeToggle = document.getElementById('btn-kids-mode-toggle');
const kidsModeLabel = document.getElementById('kids-mode-label');
// Reciter selector dropdown
const reciterSelect = document.getElementById('reciter-select');


// Audio Sliders & Tracker Actions DOM Elements
const sliderGain = document.getElementById('slider-gain');
const valSliderGain = document.getElementById('val-slider-gain');
const sliderReverb = document.getElementById('slider-reverb');
const valSliderReverb = document.getElementById('val-slider-reverb');
// Track currently selected reciter
let selectedReciter = reciterSelect.value; // Default from dropdown
const groupSliderReverb = document.getElementById('group-slider-reverb');
const btnPlayUserSurah = document.getElementById('btn-play-user-surah');
const btnExportUserSurah = document.getElementById('btn-export-user-surah');

// Recorder DOM Elements
const canvas = document.getElementById('visualizer');
const canvasCtx = canvas.getContext('2d');
const visualizerText = document.getElementById('visualizer-text');
const btnRecordMain = document.getElementById('btn-record-main');
const recordTimer = document.getElementById('record-timer');
const recordStatus = document.getElementById('record-status');
const playbackArea = document.getElementById('playback-area');
const btnDeleteRec = document.getElementById('btn-delete-rec');
const btnPlayRecorded = document.getElementById('btn-play-recorded');
const playerProgressBar = document.getElementById('player-progress-bar');
const playerProgressFill = document.getElementById('player-progress-fill');
const playerTimeDisplay = document.getElementById('player-time-display');

// Initialize the Canvas Size
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- 1. App Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    // Check kids mode preference
    const savedKids = localStorage.getItem('quran_memorizer_kids_mode');
    if (savedKids === 'true') {
        document.body.classList.add('kids-mode');
    }
    updateKidsModeUI();

    // Load surahs list
    await fetchSurahsList();
    
    // Setup Event Listeners
    setupEventHandlers();
    
    // Draw an idle visualizer screen
    drawIdleVisualizer();
});

// Setup event handlers
function setupEventHandlers() {
    // Reciter selection change
    reciterSelect.addEventListener('change', () => {
        selectedReciter = reciterSelect.value;
        // If an ayah is currently loaded, update audio source
        if (surahAyahs.length > 0 && currentAyahIndex >= 0) {
            const ayah = surahAyahs[currentAyahIndex];
            const surahStr = pad3(currentSurah);
            const ayahStr = pad3(ayah.numberInSurah);
            reciterAudio.src = `https://everyayah.com/data/${selectedReciter}/${surahStr}${ayahStr}.mp3`;
            reciterAudio.load();
        }
    });

    // Custom search dropdown toggle
    surahSelectTrigger.addEventListener('click', () => {
        const isOpen = surahSearchSelect.classList.contains('open');
        if (isOpen) {
            surahSearchSelect.classList.remove('open');
            surahSelectDropdown.classList.add('hidden');
        } else {
            surahSearchSelect.classList.add('open');
            surahSelectDropdown.classList.remove('hidden');
            surahSearchInput.value = '';
            surahSearchInput.focus();
            
            // Show all options initially
            surahOptionsList.querySelectorAll('.search-select-option').forEach(o => o.classList.remove('hidden'));
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!surahSearchSelect.contains(e.target)) {
            surahSearchSelect.classList.remove('open');
            surahSelectDropdown.classList.add('hidden');
        }
    });

    // Search input filter logic
    surahSearchInput.addEventListener('input', (e) => {
        const filter = e.target.value.trim().toLowerCase();
        const options = surahOptionsList.querySelectorAll('.search-select-option');
        options.forEach(opt => {
            const text = opt.dataset.searchText;
            if (text.includes(filter)) {
                opt.classList.remove('hidden');
            } else {
                opt.classList.add('hidden');
            }
        });
    });
    
    btnListen.addEventListener('click', toggleRecitation);
    btnLoop.addEventListener('click', toggleLoopMode);
    btnHideText.addEventListener('click', toggleCheckMode);
    btnPrevAyah.addEventListener('click', loadPrevAyah);
    btnNextAyah.addEventListener('click', loadNextAyah);
    btnTafsir.addEventListener('click', toggleTafsir);
    btnAutoplay.addEventListener('click', toggleAutoplayMode);
    btnKidsModeToggle.addEventListener('click', toggleKidsMode);
    
    // Audio sliders and settings listeners
    sliderGain.addEventListener('input', (e) => {
        valSliderGain.textContent = `${parseFloat(e.target.value).toFixed(1)}x`;
        updateMicGainNode();
    });
    
    sliderReverb.addEventListener('input', (e) => {
        valSliderReverb.textContent = `${parseFloat(e.target.value).toFixed(2)}x`;
        updateReverbMixNode();
    });
    
    // Listen for changes in selected mode radio buttons to show/hide reverb slider
    document.querySelectorAll('input[name="audio-mode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const mode = e.target.value;
            if (mode === 'echo') {
                groupSliderReverb.classList.remove('hidden');
            } else {
                groupSliderReverb.classList.add('hidden');
            }
        });
    });
    
    btnPlayUserSurah.addEventListener('click', toggleUserSurahPlayback);
    btnExportUserSurah.addEventListener('click', exportFullSurahRecitation);
    
    // Reveal text temporarily when blurred on click/touch
    quranTextContainer.addEventListener('mousedown', () => {
        if (checkMode) {
            quranTextContainer.classList.add('reveal-temp');
        }
    });
    document.addEventListener('mouseup', () => {
        quranTextContainer.classList.remove('reveal-temp');
    });
    
    quranTextContainer.addEventListener('touchstart', (e) => {
        if (checkMode) {
            quranTextContainer.classList.add('reveal-temp');
            e.preventDefault(); // Prevent double triggering on mobile
        }
    });
    quranTextContainer.addEventListener('touchend', () => {
        quranTextContainer.classList.remove('reveal-temp');
    });
    
    // Reciter Audio listeners
    reciterAudio.addEventListener('loadedmetadata', onAudioMetadataLoaded);
    reciterAudio.addEventListener('timeupdate', onAudioTimeUpdate);
    reciterAudio.addEventListener('ended', onAudioEnded);
    
    // Recording controls
    btnRecordMain.addEventListener('click', toggleRecording);
    btnDeleteRec.addEventListener('click', deleteCurrentRecording);
    btnPlayRecorded.addEventListener('click', toggleRecordedPlayback);
    playerProgressBar.addEventListener('click', seekRecordedAudio);
}

// Draw idle grid on visualizer canvas
function drawIdleVisualizer() {
    resizeCanvas();
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    
    const isKids = document.body.classList.contains('kids-mode');
    
    // Draw background
    if (isKids) {
        canvasCtx.fillStyle = '#ffffff';
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
        canvasCtx.strokeStyle = 'rgba(34, 197, 94, 0.2)';
    } else {
        canvasCtx.fillStyle = '#030d0a';
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
        canvasCtx.strokeStyle = 'rgba(16, 185, 129, 0.15)';
    }
    
    // Draw a subtle horizontal line in the middle
    canvasCtx.beginPath();
    canvasCtx.moveTo(0, canvas.height / 2);
    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.lineWidth = 2;
    canvasCtx.stroke();
    
    // Draw some static background wave patterns
    canvasCtx.beginPath();
    for (let i = 0; i < canvas.width; i++) {
        const x = i;
        const y = canvas.height / 2 + Math.sin(i * 0.05) * 4;
        if (i === 0) canvasCtx.moveTo(x, y);
        else canvasCtx.lineTo(x, y);
    }
    canvasCtx.strokeStyle = isKids ? 'rgba(34, 197, 94, 0.1)' : 'rgba(16, 185, 129, 0.08)';
    canvasCtx.lineWidth = 1;
    canvasCtx.stroke();
}

// --- 2. Data Fetching Functions ---

async function fetchSurahsList() {
    try {
        const response = await fetch('https://api.alquran.cloud/v1/surah');
        if (!response.ok) throw new Error('فشل جلب قائمة السور');
        const json = await response.json();
        surahList = json.data;
        
        // Populate custom search dropdown options list
        surahOptionsList.innerHTML = '';
        surahList.forEach(surah => {
            const opt = document.createElement('div');
            opt.className = 'search-select-option';
            opt.dataset.value = surah.number;
            opt.dataset.searchText = `${surah.number} ${surah.name} ${surah.englishName.toLowerCase()}`;
            
            if (surah.number === currentSurah) {
                opt.classList.add('active');
                selectedSurahLabel.textContent = `${surah.number}. ${surah.name} (${surah.englishName})`;
            }
            
            opt.innerHTML = `
                <span>${surah.number}. ${surah.name}</span>
                <span class="search-select-option-meta">${surah.englishName}</span>
            `;
            
            opt.addEventListener('click', () => {
                surahSearchSelect.classList.remove('open');
                surahSelectDropdown.classList.add('hidden');
                
                surahOptionsList.querySelectorAll('.search-select-option').forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                selectedSurahLabel.textContent = `${surah.number}. ${surah.name} (${surah.englishName})`;
                
                loadSurah(surah.number);
            });
            
            surahOptionsList.appendChild(opt);
        });
        
        // Load default Surah
        await loadSurah(currentSurah);
    } catch (err) {
        console.error('Error fetching surahs list:', err);
        quranTextContainer.textContent = 'خطأ في الاتصال بالشبكة. يرجى التأكد من اتصال الإنترنت وإعادة تحميل الصفحة.';
    }
}

async function loadSurah(surahNum) {
    currentSurah = surahNum;
    quranTextContainer.innerHTML = '<div class="empty-state-text">جاري تحميل آيات السورة والتفسير...</div>';
    basmalaContainer.classList.add('hidden');
    
    try {
        // Fetch Surah Uthmani text and Tafsir Al-Muyassar combined in a single request
        const response = await fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/editions/quran-uthmani,ar.muyassar`);
        if (!response.ok) throw new Error('فشل تحميل السورة أو التفسير');
        
        const json = await response.json();
        
        // Find which index corresponds to which edition
        let uthmaniData = null;
        let muyassarData = null;
        
        if (json.data && json.data.length >= 2) {
            json.data.forEach(item => {
                if (item.edition.identifier === 'quran-uthmani') {
                    uthmaniData = item;
                } else if (item.edition.identifier === 'ar.muyassar') {
                    muyassarData = item;
                }
            });
        }
        
        // Fallback in case list structure varies
        if (!uthmaniData) uthmaniData = json.data[0];
        if (!muyassarData) muyassarData = json.data[1] || json.data[0];
        
        surahAyahs = uthmaniData.ayahs;
        surahTafsir = muyassarData.ayahs;
        
        // Update UI
        indexTitle.textContent = `فهرس آيات سورة ${uthmaniData.name}`;
        currentAyahIndex = 0;
        
        // Load the first Ayah
        loadAyah(0);
        
        // Draw Surah Index Directory Grid
        renderIndexGrid();
        
        // Update Memorization progress bar
        updateProgressTracker();
    } catch (err) {
        console.error('Error loading surah:', err);
        quranTextContainer.textContent = 'حدث خطأ أثناء تحميل آيات السورة والتفسير. يرجى المحاولة مرة أخرى.';
    }
}

// Format number to 3-digit string for EveryAyah filenames
function pad3(num) {
    return String(num).padStart(3, '0');
}

function loadAyah(index) {
    if (index < 0 || index >= surahAyahs.length) return;
    
    // Stop any playing recitations
    stopRecitation();
    
    currentAyahIndex = index;
    currentAyahRepeatCount = 0; // Reset repeat counter
    const ayah = surahAyahs[index];
    
    // Determine if we show Basmala
    // In Al Quran Cloud Uthmani text, Basmala is concatenated at the beginning of the first Ayah
    // except for Surah 1 (Al-Fatihah) and Surah 9 (At-Tawbah)
    let textToDisplay = ayah.text;
    let basmalaText = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ";
    
    if (currentSurah !== 1 && currentSurah !== 9 && ayah.numberInSurah === 1) {
        const words = textToDisplay.trim().split(/\s+/);
        // In Uthmani script, the Basmala is exactly the first 4 words.
        // We verify that the first word starts with the letters of "Bismillah" (like ب or بِ)
        if (words.length >= 4 && (words[0].startsWith("ب") || words[0].startsWith("بِ"))) {
            basmalaText = words.slice(0, 4).join(' ');
            textToDisplay = words.slice(4).join(' ');
            basmalaContainer.textContent = basmalaText;
            basmalaContainer.classList.remove('hidden');
        } else {
            basmalaContainer.classList.add('hidden');
        }
    } else {
        basmalaContainer.classList.add('hidden');
    }
    
    // Split into spans for word highlighting
    renderAyahWords(textToDisplay);
    
    // Update Tafsir text
    updateTafsirText();
    
    // Update navigation numbers
    ayahIndexText.textContent = `آية: ${ayah.numberInSurah} / ${surahAyahs.length}`;
    
    // Highlight active cell in index grid
    const cells = document.querySelectorAll('.ayah-grid-cell');
    cells.forEach((cell, i) => {
        if (i === index) {
            cell.classList.add('active');
            cell.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            cell.classList.remove('active');
        }
    });
    
    // Configure audio source for Sheikh Fares Abbad
    const surahStr = pad3(currentSurah);
    const ayahStr = pad3(ayah.numberInSurah);
    reciterAudio.src = `https://everyayah.com/data/${selectedReciter}/${surahStr}${ayahStr}.mp3`;
    reciterAudio.load();
    
    // Reset Karaoke State
    wordSegments = [];
    
    // Check if user has a recorded audio file for this Ayah
    loadUserRecordingForAyah();
}

function renderAyahWords(text) {
    quranTextContainer.innerHTML = '';
    const words = text.trim().split(/\s+/);
    words.forEach((word, idx) => {
        const span = document.createElement('span');
        span.className = 'quran-word';
        span.textContent = word;
        span.dataset.wordIdx = idx;
        quranTextContainer.appendChild(span);
    });
}

function loadPrevAyah() {
    if (currentAyahIndex > 0) {
        loadAyah(currentAyahIndex - 1);
    }
}

function loadNextAyah() {
    if (currentAyahIndex < surahAyahs.length - 1) {
        loadAyah(currentAyahIndex + 1);
    }
}

// --- 3. Quran Recitation & Karaoke ---

function toggleRecitation() {
    if (isAudioPlaying) {
        pauseRecitation();
    } else {
        playRecitation();
    }
}

function playRecitation() {
    if (typeof stopUserSurahPlayback === 'function' && isUserSurahPlaying) {
        stopUserSurahPlayback();
    }
    reciterAudio.play()
        .then(() => {
            isAudioPlaying = true;
            btnListen.classList.add('active');
            btnListen.querySelector('.icon-play').classList.add('hidden');
            btnListen.querySelector('.icon-pause').classList.remove('hidden');
            startHighlightLoop();
        })
        .catch(err => {
            console.error('Recitation play failed:', err);
            alert('تعذر تشغيل التلاوة. تأكد من اتصالك بالإنترنت.');
        });
}

function pauseRecitation() {
    reciterAudio.pause();
    isAudioPlaying = false;
    btnListen.classList.remove('active');
    btnListen.querySelector('.icon-play').classList.remove('hidden');
    btnListen.querySelector('.icon-pause').classList.add('hidden');
    stopHighlightLoop();
    
    // Remove word highlights
    document.querySelectorAll('.quran-word').forEach(span => span.classList.remove('highlighted'));
}

function stopRecitation() {
    pauseRecitation();
    reciterAudio.currentTime = 0;
}

function toggleLoopMode() {
    loopMode = !loopMode;
    btnLoop.classList.toggle('active', loopMode);
    currentAyahRepeatCount = 0; // Reset repeat counter
}

function toggleAutoplayMode() {
    autoplayMode = !autoplayMode;
    btnAutoplay.classList.toggle('active', autoplayMode);
    currentAyahRepeatCount = 0; // Reset repeat counter
}

function toggleCheckMode() {
    checkMode = !checkMode;
    btnHideText.classList.toggle('active', checkMode);
    quranTextContainer.classList.toggle('blurred', checkMode);
    checkOverlay.classList.toggle('hidden', !checkMode);
}

function onAudioMetadataLoaded() {
    const duration = reciterAudio.duration;
    const text = Array.from(document.querySelectorAll('.quran-word')).map(s => s.textContent).join(' ');
    
    // Estimate word timings based on character count ratios
    wordSegments = getEstimatedWordTimestamps(text, duration);
}

function getEstimatedWordTimestamps(text, duration) {
    const words = text.trim().split(/\s+/);
    if (words.length === 0) return [];
    
    // Clean words to count phonetic base letters (Arabic letters range: \u0621-\u064A, plus Superscript Alif \u0670, Alif Wasla \u0671, Farsi Yeh \u06CC)
    const arabicLettersRegex = /[\u0621-\u064A\u0670\u0671\u06CC]/g;
    const wordLengths = words.map(w => {
        const matches = w.match(arabicLettersRegex);
        return matches ? matches.length : 1; // Fallback to 1 if no base letters
    });
    
    const totalLetters = wordLengths.reduce((sum, len) => sum + len, 0);
    
    // Estimate starting and ending silence padding (Fares Abbad recitations have ~0.3-0.4s initial gap)
    const startPadding = Math.min(0.4, duration * 0.05);
    const endPadding = Math.min(0.5, duration * 0.06);
    
    const pool = duration - startPadding - endPadding;
    
    let currentTime = startPadding;
    const segments = [];
    
    for (let i = 0; i < words.length; i++) {
        const wordDur = (wordLengths[i] / totalLetters) * pool;
        segments.push({
            start: currentTime,
            end: currentTime + wordDur
        });
        currentTime += wordDur;
    }
    return segments;
}

function startHighlightLoop() {
    if (highlightAnimationFrameId) {
        cancelAnimationFrame(highlightAnimationFrameId);
    }
    
    function update() {
        if (isAudioPlaying) {
            updateWordHighlighting();
            highlightAnimationFrameId = requestAnimationFrame(update);
        }
    }
    
    highlightAnimationFrameId = requestAnimationFrame(update);
}

function stopHighlightLoop() {
    if (highlightAnimationFrameId) {
        cancelAnimationFrame(highlightAnimationFrameId);
        highlightAnimationFrameId = null;
    }
}

function updateWordHighlighting() {
    if (wordSegments.length === 0) return;
    
    const time = reciterAudio.currentTime;
    let activeIdx = -1;
    
    for (let i = 0; i < wordSegments.length; i++) {
        if (time >= wordSegments[i].start && time <= wordSegments[i].end) {
            activeIdx = i;
            break;
        }
    }
    
    const wordSpans = document.querySelectorAll('.quran-word');
    wordSpans.forEach((span, idx) => {
        if (idx === activeIdx) {
            span.classList.add('highlighted');
        } else {
            span.classList.remove('highlighted');
        }
    });
}

function onAudioTimeUpdate() {
    // Keep as fallback/backup
    updateWordHighlighting();
}

function onAudioEnded() {
    pauseRecitation();
    
    if (loopMode && autoplayMode) {
        // BOTH active: repeat the active Ayah 3 times, then transition to next Ayah
        currentAyahRepeatCount++;
        if (currentAyahRepeatCount < 3) {
            setTimeout(playRecitation, 100); // 100ms very small pause before repeating
        } else {
            currentAyahRepeatCount = 0; // Reset for next Ayah
            setTimeout(() => {
                if (currentAyahIndex < surahAyahs.length - 1) {
                    loadAyah(currentAyahIndex + 1);
                    playRecitation();
                } else {
                    // Reached the end of the Surah
                    autoplayMode = false;
                    btnAutoplay.classList.remove('active');
                }
            }, 150); // Fast transition to next Ayah
        }
    } else if (loopMode) {
        // ONLY Loop active: repeat indefinitely
        setTimeout(playRecitation, 100); // Fast repetition
    } else if (autoplayMode) {
        // ONLY Autoplay active: play once and advance
        setTimeout(() => {
            if (currentAyahIndex < surahAyahs.length - 1) {
                loadAyah(currentAyahIndex + 1);
                playRecitation();
            } else {
                autoplayMode = false;
                btnAutoplay.classList.remove('active');
            }
        }, 150); // Fast transition
    }
}

// --- 4. Web Audio API and Recording Logic ---

async function initAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }
}

async function toggleRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        stopRecording();
    } else {
        await startRecording();
    }
}

async function startRecording() {
    // Make sure recitation stops
    stopRecitation();
    stopRecordedPlayback();
    if (typeof stopUserSurahPlayback === 'function' && isUserSurahPlaying) {
        stopUserSurahPlayback();
    }
    
    try {
        // Request Microphone Permission
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        
        // Initialize Web Audio
        await initAudioContext();
        
        // Clear previous recordings
        deleteCurrentBlob();
        
        // Setup Web Audio Nodes
        setupAudioPipeline();
        
        // Setup MediaRecorder using processing destination node
        mediaRecorder = new MediaRecorder(destNode.stream);
        recordedChunks = [];
        
        mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                recordedChunks.push(e.data);
            }
        };
        
        mediaRecorder.onstop = saveRecordingBlob;
        
        // Start recording
        mediaRecorder.start();
        
        // Start Timer
        recordSeconds = 0;
        recordTimer.textContent = "00:00";
        recordTimerInterval = setInterval(updateRecordTimer, 1000);
        
        // Start Visualizer
        startVisualizerDrawing();
        
        // Update Buttons
        btnRecordMain.classList.add('recording');
        recordStatus.textContent = "جاري تسجيل تلاوتك الآن... تحدث بصوت عذب";
        visualizerText.textContent = "تسجيل حي للميكروفون";
        
    } catch (err) {
        console.error('Microphone access denied or error:', err);
        alert('تعذر الوصول للميكروفون. يرجى تفعيل إذن استخدام الميكروفون في متصفحك للتسجيل.');
        recordStatus.textContent = "فشل بدء التسجيل (لا يوجد إذن ميكروفون)";
    }
}

function setupAudioPipeline() {
    // 1. Microphone Source & Input Gain Control Node
    micSource = audioCtx.createMediaStreamSource(micStream);
    micInputGainNode = audioCtx.createGain();
    const gainVal = parseFloat(sliderGain.value);
    micInputGainNode.gain.setValueAtTime(gainVal, audioCtx.currentTime);
    
    micSource.connect(micInputGainNode);
    
    // 2. Analyser Node
    analyserNode = audioCtx.createAnalyser();
    analyserNode.fftSize = 256;
    
    // 3. Effects Nodes Initialization
    compressorNode = audioCtx.createDynamicsCompressor();
    compressorNode.threshold.setValueAtTime(-24, audioCtx.currentTime);
    compressorNode.knee.setValueAtTime(30, audioCtx.currentTime);
    compressorNode.ratio.setValueAtTime(4, audioCtx.currentTime);
    compressorNode.attack.setValueAtTime(0.003, audioCtx.currentTime);
    compressorNode.release.setValueAtTime(0.25, audioCtx.currentTime);
    
    filterLow = audioCtx.createBiquadFilter();
    filterLow.type = 'highpass';
    filterLow.frequency.setValueAtTime(80, audioCtx.currentTime); // Cut deep bass rumble
    
    filterHigh = audioCtx.createBiquadFilter();
    filterHigh.type = 'lowpass';
    filterHigh.frequency.setValueAtTime(8500, audioCtx.currentTime); // Cut high sibilance hiss
    
    // Mosque Reverb (Convolver) setup
    convolverNode = audioCtx.createConvolver();
    convolverNode.buffer = createReverbImpulseResponse(3.5, 4.0); // Generate 3.5s Reverb with decay 4.0
    
    dryGainNode = audioCtx.createGain();
    wetGainNode = audioCtx.createGain();
    
    // 4. Processing Destination Node (for capturing output in MediaRecorder)
    destNode = audioCtx.createMediaStreamDestination();
    
    // Get Selected Audio Mode
    const selectedMode = document.querySelector('input[name="audio-mode"]:checked').value;
    
    // Routing connections based on selected mode
    if (selectedMode === 'normal') {
        // Direct pass-through via input gain node
        micInputGainNode.connect(analyserNode);
        analyserNode.connect(destNode);
    } 
    else if (selectedMode === 'studio') {
        // High-pass -> Low-pass -> Compressor
        micInputGainNode.connect(filterLow);
        filterLow.connect(filterHigh);
        filterHigh.connect(compressorNode);
        compressorNode.connect(analyserNode);
        analyserNode.connect(destNode);
    } 
    else if (selectedMode === 'echo') {
        // Add a spiritual mosque echo effect: Parallel routing
        // Connect input gain node to filters first
        micInputGainNode.connect(filterLow);
        filterLow.connect(filterHigh);
        
        // Connect filtered signal to dry gain and wet gain
        filterHigh.connect(dryGainNode);
        filterHigh.connect(wetGainNode);
        
        // Connect wet gain to convolver
        wetGainNode.connect(convolverNode);
        
        // Adjust Mix Gains based on Reverb Slider
        const wetVal = parseFloat(sliderReverb.value);
        dryGainNode.gain.setValueAtTime(0.7, audioCtx.currentTime);
        wetGainNode.gain.setValueAtTime(wetVal, audioCtx.currentTime);
        
        // Connect both Dry and Wet outputs to Analyser
        dryGainNode.connect(analyserNode);
        convolverNode.connect(analyserNode);
        
        analyserNode.connect(destNode);
    }
}

// Generate mathematical synthetic reverb impulse response (Exponential Decaying White Noise)
function createReverbImpulseResponse(duration, decay) {
    const sampleRate = audioCtx.sampleRate;
    const length = sampleRate * duration;
    const impulse = audioCtx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);
    
    for (let i = 0; i < length; i++) {
        const percent = i / length;
        const decayFactor = Math.exp(-percent * decay);
        // Exponentially decaying white noise
        left[i] = (Math.random() * 2 - 1) * decayFactor;
        right[i] = (Math.random() * 2 - 1) * decayFactor;
    }
    return impulse;
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
    
    // Stop recording timer
    clearInterval(recordTimerInterval);
    
    // Stop microphone stream track to release the device
    if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
    }
    
    // Disconnect Web Audio nodes to free up memory
    disconnectNodes();
    
    // Update button visual state
    btnRecordMain.classList.remove('recording');
    recordStatus.textContent = "تم إيقاف التسجيل وتطبيق الفلاتر بنجاح!";
}

function disconnectNodes() {
    try {
        if (micSource) micSource.disconnect();
        if (micInputGainNode) micInputGainNode.disconnect();
        if (dryGainNode) dryGainNode.disconnect();
        if (wetGainNode) wetGainNode.disconnect();
        if (convolverNode) convolverNode.disconnect();
        if (compressorNode) compressorNode.disconnect();
        if (filterLow) filterLow.disconnect();
        if (filterHigh) filterHigh.disconnect();
        if (analyserNode) analyserNode.disconnect();
    } catch (e) {
        console.warn('Node disconnect error:', e);
    }
}

function updateRecordTimer() {
    recordSeconds++;
    const minutes = Math.floor(recordSeconds / 60);
    const seconds = recordSeconds % 60;
    recordTimer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Save audio chunk as blob and create URL
async function saveRecordingBlob() {
    recordedAudioBlob = new Blob(recordedChunks, { type: 'audio/webm;codecs=opus' });
    recordedAudioUrl = URL.createObjectURL(recordedAudioBlob);
    
    // Save the Audio Blob to IndexedDB for persistent storage
    try {
        const ayahNum = surahAyahs[currentAyahIndex].numberInSurah;
        await saveAudioRecording(currentSurah, ayahNum, recordedAudioBlob);
    } catch (e) {
        console.error('Failed to save audio to IndexedDB:', e);
    }
    
    // Save to Local Storage representation & update index cell checkmark
    saveCurrentAyahMemorized();
    
    // Populate user audio player
    setupRecordedPlayer();
}

// --- 5. Recorded Playback Custom Player ---

function setupRecordedPlayer() {
    if (userAudioElement) {
        userAudioElement.pause();
    }
    
    userAudioElement = new Audio(recordedAudioUrl);
    userAudioPlaying = false;
    
    // Reset player elements
    btnPlayRecorded.querySelector('.play-svg').classList.remove('hidden');
    btnPlayRecorded.querySelector('.pause-svg').classList.add('hidden');
    playerProgressFill.style.width = '0%';
    playerTimeDisplay.textContent = '00:00';
    
    userAudioElement.addEventListener('loadedmetadata', () => {
        userAudioDuration = userAudioElement.duration;
        const mins = Math.floor(userAudioDuration / 60);
        const secs = Math.floor(userAudioDuration % 60);
        playerTimeDisplay.textContent = `00:00 / ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    });
    
    userAudioElement.addEventListener('timeupdate', () => {
        const curr = userAudioElement.currentTime;
        const percent = (curr / userAudioDuration) * 100;
        playerProgressFill.style.width = `${percent}%`;
        
        const currMins = Math.floor(curr / 60);
        const currSecs = Math.floor(curr % 60);
        const durMins = Math.floor(userAudioDuration / 60);
        const durSecs = Math.floor(userAudioDuration % 60);
        
        playerTimeDisplay.textContent = `${String(currMins).padStart(2, '0')}:${String(currSecs).padStart(2, '0')} / ${String(durMins).padStart(2, '0')}:${String(durSecs).padStart(2, '0')}`;
    });
    
    userAudioElement.addEventListener('ended', () => {
        userAudioPlaying = false;
        btnPlayRecorded.querySelector('.play-svg').classList.remove('hidden');
        btnPlayRecorded.querySelector('.pause-svg').classList.add('hidden');
        playerProgressFill.style.width = '0%';
    });
    
    // Show playback area container
    playbackArea.classList.remove('hidden');
}

function toggleRecordedPlayback() {
    if (!userAudioElement) return;
    
    // Stop reciter recitation first
    stopRecitation();
    
    if (userAudioPlaying) {
        userAudioElement.pause();
        userAudioPlaying = false;
        btnPlayRecorded.querySelector('.play-svg').classList.remove('hidden');
        btnPlayRecorded.querySelector('.pause-svg').classList.add('hidden');
    } else {
        userAudioElement.play();
        userAudioPlaying = true;
        btnPlayRecorded.querySelector('.play-svg').classList.add('hidden');
        btnPlayRecorded.querySelector('.pause-svg').classList.remove('hidden');
    }
}

function stopRecordedPlayback() {
    if (userAudioElement && userAudioPlaying) {
        userAudioElement.pause();
        userAudioPlaying = false;
        btnPlayRecorded.querySelector('.play-svg').classList.remove('hidden');
        btnPlayRecorded.querySelector('.pause-svg').classList.add('hidden');
    }
}

function seekRecordedAudio(e) {
    if (!userAudioElement || userAudioDuration === 0) return;
    
    const rect = playerProgressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = clickX / width;
    
    userAudioElement.currentTime = percentage * userAudioDuration;
}

async function deleteCurrentRecording() {
    if (confirm('هل أنت متأكد من حذف تسجيل تسميع هذه الآية؟')) {
        const ayahNum = surahAyahs[currentAyahIndex].numberInSurah;
        try {
            await deleteAudioRecording(currentSurah, ayahNum);
        } catch (e) {
            console.error('Failed to delete audio from IndexedDB:', e);
        }
        deleteCurrentBlob();
        removeCurrentAyahMemorized();
        playbackArea.classList.add('hidden');
        recordStatus.textContent = "تم حذف التسجيل بنجاح.";
    }
}

function deleteCurrentBlob() {
    if (userAudioElement) {
        userAudioElement.pause();
        userAudioElement = null;
    }
    if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
        recordedAudioUrl = null;
    }
    recordedAudioBlob = null;
}

// --- 6. Live Audio Visualizer Canvas Drawing ---

function startVisualizerDrawing() {
    if (visualizerAnimationId) {
        cancelAnimationFrame(visualizerAnimationId);
    }
    
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    function draw() {
        visualizerAnimationId = requestAnimationFrame(draw);
        
        analyserNode.getByteFrequencyData(dataArray);
        
        const isKids = document.body.classList.contains('kids-mode');
        canvasCtx.fillStyle = isKids ? '#ffffff' : '#030d0a';
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
        
        const barWidth = (canvas.width / bufferLength) * 2.2;
        let barHeight;
        let x = 0;
        
        // Draw symmetrical audio wavebars
        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i];
            
            if (isKids) {
                // Playful rainbow/cyan-green hue for kids mode
                const hue = (i / bufferLength) * 120 + 100; // green to cyan
                canvasCtx.fillStyle = `hsl(${hue}, 85%, 55%)`;
            } else {
                // Emerald gradient color representation
                const red = 16 + (barHeight/2);
                const green = 185;
                const blue = 129 + (barHeight/4);
                canvasCtx.fillStyle = `rgb(${red},${green},${blue})`;
            }
            
            // Draw bars mirrored centerward or expanding vertically
            const yPos = canvas.height / 2 - (barHeight / 3);
            const height = (barHeight / 1.5) + 2; // small min height
            
            canvasCtx.beginPath();
            canvasCtx.roundRect(x, yPos, barWidth - 2, height, 4);
            canvasCtx.fill();
            
            x += barWidth;
        }
    }
    
    draw();
}

// --- 7. Local Storage & Memorization Tracker Progress ---

// Key structure: quran_memorizer_rec_v1_{surahNum}
function getLocalStorageKey() {
    return `quran_memorizer_rec_v1_${currentSurah}`;
}

function getSavedRecordingsList() {
    const key = getLocalStorageKey();
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
}

function saveCurrentAyahMemorized() {
    const list = getSavedRecordingsList();
    const ayahNum = surahAyahs[currentAyahIndex].numberInSurah;
    
    if (!list.includes(ayahNum)) {
        list.push(ayahNum);
        list.sort((a, b) => a - b);
        localStorage.setItem(getLocalStorageKey(), JSON.stringify(list));
    }
    
    // Update active cell in index grid
    const activeCell = document.querySelector(`.ayah-grid-cell[data-index="${currentAyahIndex}"]`);
    if (activeCell) {
        activeCell.classList.add('recorded');
    }
    
    // Update progress tracker percentage
    updateProgressTracker(true);
}

function removeCurrentAyahMemorized() {
    const list = getSavedRecordingsList();
    const ayahNum = surahAyahs[currentAyahIndex].numberInSurah;
    
    const index = list.indexOf(ayahNum);
    if (index > -1) {
        list.splice(index, 1);
        localStorage.setItem(getLocalStorageKey(), JSON.stringify(list));
    }
    
    // Update active cell in index grid
    const activeCell = document.querySelector(`.ayah-grid-cell[data-index="${currentAyahIndex}"]`);
    if (activeCell) {
        activeCell.classList.remove('recorded');
    }
    
    // Update progress tracker percentage
    updateProgressTracker();
}

async function loadUserRecordingForAyah() {
    playbackArea.classList.add('hidden');
    deleteCurrentBlob();
    
    recordTimer.textContent = "00:00";
    recordStatus.textContent = "اضغط على الزر الأحمر لبدء التسميع";
    
    // Try to load user recording from IndexedDB
    try {
        const ayahNum = surahAyahs[currentAyahIndex].numberInSurah;
        const blob = await getAudioRecording(currentSurah, ayahNum);
        if (blob) {
            recordedAudioBlob = blob;
            recordedAudioUrl = URL.createObjectURL(recordedAudioBlob);
            setupRecordedPlayer();
            recordStatus.textContent = "يوجد تسميع مسجل سابقاً لهذه الآية. يمكنك الاستماع إليه.";
        }
    } catch (e) {
        console.error('Failed to load recording from IndexedDB:', e);
    }
}

function updateProgressTracker(isNewCompletion = false) {
    if (surahAyahs.length === 0) return;
    
    const savedList = getSavedRecordingsList();
    const totalAyahs = surahAyahs.length;
    const recordedCount = savedList.length;
    
    const percentage = Math.round((recordedCount / totalAyahs) * 100);
    
    // Update progress elements
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = `${percentage}%`;
    recordedCountText.textContent = `الآيات المحفوظة والمسمّعة: ${recordedCount} من أصل ${totalAyahs}`;
    
    // Toggle full surah playback and export actions
    if (recordedCount > 0) {
        btnPlayUserSurah.classList.remove('hidden');
        btnExportUserSurah.classList.remove('hidden');
    } else {
        btnPlayUserSurah.classList.add('hidden');
        btnExportUserSurah.classList.add('hidden');
    }
    
    if (isNewCompletion && percentage === 100) {
        triggerCelebration();
    }
}

// --- 8. Render Surah Index Grid ---

function renderIndexGrid() {
    ayahIndexList.innerHTML = '';
    const savedList = getSavedRecordingsList();
    
    surahAyahs.forEach((ayah, index) => {
        const cell = document.createElement('div');
        cell.className = 'ayah-grid-cell';
        cell.dataset.index = index;
        cell.textContent = ayah.numberInSurah;
        
        // Add recorded class if user recorded it previously
        if (savedList.includes(ayah.numberInSurah)) {
            cell.classList.add('recorded');
        }
        
        if (index === currentAyahIndex) {
            cell.classList.add('active');
        }
        
        cell.addEventListener('click', () => {
            loadAyah(index);
        });
        
        ayahIndexList.appendChild(cell);
    });
}

// --- 9. Tafsir & IndexedDB Helper Functions ---

// Toggle Tafsir Box Visibility
function toggleTafsir() {
    showTafsir = !showTafsir;
    btnTafsir.classList.toggle('active', showTafsir);
    tafsirContainer.classList.toggle('hidden', !showTafsir);
    updateTafsirText();
}

// Update Tafsir Content with contiguous grouping check
function updateTafsirText() {
    if (surahTafsir && surahTafsir.length > currentAyahIndex) {
        const activeText = surahTafsir[currentAyahIndex].text;
        
        // Find contiguous range of verses that share the exact same explanation
        let groupStart = currentAyahIndex;
        while (groupStart > 0 && surahTafsir[groupStart - 1].text === activeText) {
            groupStart--;
        }
        
        let groupEnd = currentAyahIndex;
        while (groupEnd < surahTafsir.length - 1 && surahTafsir[groupEnd + 1].text === activeText) {
            groupEnd++;
        }
        
        const startNum = surahTafsir[groupStart].numberInSurah;
        const endNum = surahTafsir[groupEnd].numberInSurah;
        
        const headerText = (startNum === endNum) 
            ? `💡 التفسير الميسر للآية (${startNum}):` 
            : `💡 التفسير الميسر للآيات (${startNum} - ${endNum}):`;
            
        document.querySelector('.tafsir-header').textContent = headerText;
        tafsirTextContent.textContent = activeText;
    } else {
        tafsirTextContent.textContent = "تفسير الآية غير متوفر حالياً.";
    }
}

// --- IndexedDB Settings ---
const dbName = "QuranMemorizerDB";
const storeName = "recordings";

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName);
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function saveAudioRecording(surah, ayah, blob) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const key = `rec_S${surah}_A${ayah}`;
        const request = store.put(blob, key);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

async function getAudioRecording(surah, ayah) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const key = `rec_S${surah}_A${ayah}`;
        const request = store.get(key);
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function deleteAudioRecording(surah, ayah) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const key = `rec_S${surah}_A${ayah}`;
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

// --- 10. Kids Mode & Celebration functions ---

function toggleKidsMode() {
    const isKids = document.body.classList.toggle('kids-mode');
    localStorage.setItem('quran_memorizer_kids_mode', isKids ? 'true' : 'false');
    updateKidsModeUI();
}

function updateKidsModeUI() {
    const isKids = document.body.classList.contains('kids-mode');
    if (isKids) {
        kidsModeLabel.textContent = "وضع الكبار 🧔";
        btnKidsModeToggle.querySelector('.kids-mode-icon').textContent = "🧔";
        btnKidsModeToggle.title = "تفعيل وضع الكبار (الزمردي الفاخر)";
    } else {
        kidsModeLabel.textContent = "وضع الأطفال 👶";
        btnKidsModeToggle.querySelector('.kids-mode-icon').textContent = "👶";
        btnKidsModeToggle.title = "تفعيل وضع الأطفال المبسط والودود";
    }
    // Redraw the idle visualizer to match the theme background immediately
    if (typeof drawIdleVisualizer === 'function') {
        drawIdleVisualizer();
    }
}

function triggerCelebration() {
    // Confetti particles generator
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];
    const emojis = ['🎉', '✨', '🌟', '🎈', '🍭', '🥳'];
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100vw';
    container.style.height = '100vh';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '9999';
    container.style.overflow = 'hidden';
    document.body.appendChild(container);
    
    // Spawn particles
    for (let i = 0; i < 80; i++) {
        const particle = document.createElement('div');
        const isEmoji = Math.random() > 0.5;
        
        if (isEmoji) {
            particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            particle.style.fontSize = `${Math.floor(Math.random() * 24) + 16}px`;
        } else {
            particle.style.width = `${Math.floor(Math.random() * 12) + 6}px`;
            particle.style.height = `${Math.floor(Math.random() * 12) + 6}px`;
            particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            particle.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        }
        
        particle.style.position = 'absolute';
        particle.style.left = `${Math.random() * 100}vw`;
        particle.style.top = `${Math.random() * -20 - 10}px`;
        particle.style.opacity = Math.random().toString();
        particle.style.transform = `rotate(${Math.random() * 360}deg)`;
        particle.style.transition = `all ${Math.random() * 2.5 + 2}s cubic-bezier(0.1, 0.8, 0.3, 1)`;
        
        container.appendChild(particle);
        
        // Trigger falling animation
        setTimeout(() => {
            particle.style.top = '105vh';
            particle.style.left = `${parseFloat(particle.style.left) + (Math.random() * 200 - 100)}px`;
            particle.style.transform = `rotate(${Math.random() * 720}deg)`;
            particle.style.opacity = '0';
        }, 100);
    }
    
    // Play a lovely success tone
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const playChime = (pitch, delay) => {
            setTimeout(() => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(pitch, ctx.currentTime);
                gain.gain.setValueAtTime(0.15, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.6);
            }, delay);
        };
        
        playChime(523.25, 0);   // C5
        playChime(659.25, 150); // E5
        playChime(783.99, 300); // G5
        playChime(1046.50, 450); // C6
    } catch (err) {
        console.warn('AudioContext chime blocked or unsupported:', err);
    }
    
    // Alert child/user with a congratulations message
    setTimeout(() => {
        alert('✨ مبارك! 🎉 لقد أتممت حفظ وتسميع السورة بنسبة 100%! 🌟');
    }, 800);
    
    // Remove container after animations finish
    setTimeout(() => {
        container.remove();
    }, 5000);
}

// --- 11. Recording System Improvements, Full Surah Playback & Export ---

function updateMicGainNode() {
    if (audioCtx && micInputGainNode) {
        const val = parseFloat(sliderGain.value);
        micInputGainNode.gain.setValueAtTime(val, audioCtx.currentTime);
    }
}

function updateReverbMixNode() {
    if (audioCtx && wetGainNode) {
        const val = parseFloat(sliderReverb.value);
        wetGainNode.gain.setValueAtTime(val, audioCtx.currentTime);
    }
}

async function toggleUserSurahPlayback() {
    if (isUserSurahPlaying) {
        stopUserSurahPlayback();
    } else {
        await startUserSurahPlayback();
    }
}

async function startUserSurahPlayback() {
    // Stop all other playbacks
    stopRecitation();
    stopRecordedPlayback();
    
    const savedList = getSavedRecordingsList(); // Array of recorded numberInSurah
    if (savedList.length === 0) {
        alert('لم تقم بتسجيل أي آيات في هذه السورة بعد.');
        return;
    }
    
    // Build playlist
    userSurahPlayList = [];
    
    btnPlayUserSurah.classList.add('active');
    btnPlayUserSurah.querySelector('.icon-play').classList.add('hidden');
    btnPlayUserSurah.querySelector('.icon-pause').classList.remove('hidden');
    btnPlayUserSurah.querySelector('span').textContent = "إيقاف التسميع ⏹️";
    
    isUserSurahPlaying = true;
    userSurahPlayIndex = 0;
    
    // Map recorded numberInSurah to their index in surahAyahs
    for (let i = 0; i < surahAyahs.length; i++) {
        const ayahNum = surahAyahs[i].numberInSurah;
        if (savedList.includes(ayahNum)) {
            try {
                const blob = await getAudioRecording(currentSurah, ayahNum);
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    userSurahPlayList.push({
                        numberInSurah: ayahNum,
                        index: i,
                        blobUrl: url
                    });
                }
            } catch (e) {
                console.error(`Error loading ayah ${ayahNum} recording for playlist:`, e);
            }
        }
    }
    
    if (userSurahPlayList.length === 0) {
        stopUserSurahPlayback();
        alert('تعذر تحميل أي من التسجيلات الصوتية.');
        return;
    }
    
    playNextUserSurahAyah();
}

function stopUserSurahPlayback() {
    isUserSurahPlaying = false;
    if (currentUserSurahAudio) {
        currentUserSurahAudio.pause();
        currentUserSurahAudio = null;
    }
    
    // Revoke object URLs to prevent memory leak
    userSurahPlayList.forEach(item => {
        URL.revokeObjectURL(item.blobUrl);
    });
    userSurahPlayList = [];
    
    btnPlayUserSurah.classList.remove('active');
    btnPlayUserSurah.querySelector('.icon-play').classList.remove('hidden');
    btnPlayUserSurah.querySelector('.icon-pause').classList.add('hidden');
    btnPlayUserSurah.querySelector('span').textContent = "تشغيل تسميعي 🎧";
    
    // Reset highlighted active cell
    const cells = document.querySelectorAll('.ayah-grid-cell');
    cells.forEach((cell, i) => {
        if (i === currentAyahIndex) {
            cell.classList.add('active');
        } else {
            cell.classList.remove('active');
        }
    });
}

function playNextUserSurahAyah() {
    if (!isUserSurahPlaying) return;
    
    if (userSurahPlayIndex >= userSurahPlayList.length) {
        // Finished playing all recorded ayahs
        stopUserSurahPlayback();
        alert('🎉 أحسنت! لقد استمعت لتسميعك الكامل للسورة بنجاح!');
        return;
    }
    
    const item = userSurahPlayList[userSurahPlayIndex];
    
    // Load the corresponding Ayah card
    loadAyah(item.index);
    
    currentUserSurahAudio = new Audio(item.blobUrl);
    currentUserSurahAudio.play()
        .then(() => {
            currentUserSurahAudio.addEventListener('ended', () => {
                userSurahPlayIndex++;
                playNextUserSurahAyah();
            });
        })
        .catch(err => {
            console.error('Play user surah ayah failed:', err);
            userSurahPlayIndex++;
            playNextUserSurahAyah();
        });
}

async function exportFullSurahRecitation() {
    const savedList = getSavedRecordingsList();
    if (savedList.length === 0) {
        alert('لم تقم بتسجيل أي آيات في هذه السورة بعد.');
        return;
    }
    
    // Show loading indicator
    btnExportUserSurah.classList.add('active');
    btnExportUserSurah.querySelector('span').textContent = "جاري تجميع التلاوة... ⏳";
    
    try {
        // Initialize dynamic AudioContext for decoding
        const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
        const decodedBuffers = [];
        
        // Fetch and decode each recording sequentially
        for (let i = 0; i < surahAyahs.length; i++) {
            const ayahNum = surahAyahs[i].numberInSurah;
            if (savedList.includes(ayahNum)) {
                const blob = await getAudioRecording(currentSurah, ayahNum);
                if (blob) {
                    const arrayBuffer = await blob.arrayBuffer();
                    const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
                    decodedBuffers.push(audioBuffer);
                }
            }
        }
        
        if (decodedBuffers.length === 0) {
            throw new Error('No recordings found.');
        }
        
        // Create a merged single AudioBuffer
        const sampleRate = decodedBuffers[0].sampleRate;
        const numberOfChannels = decodedBuffers[0].numberOfChannels;
        
        let totalLength = 0;
        decodedBuffers.forEach(buf => {
            totalLength += buf.length;
            // Add a short gap/silence between ayahs (e.g. 0.8 seconds gap)
            totalLength += Math.floor(sampleRate * 0.8);
        });
        
        const combinedBuffer = tempCtx.createBuffer(numberOfChannels, totalLength, sampleRate);
        
        // Copy channel data sequentially
        for (let channel = 0; channel < numberOfChannels; channel++) {
            const combinedData = combinedBuffer.getChannelData(channel);
            let offset = 0;
            
            decodedBuffers.forEach(buf => {
                const channelData = buf.getChannelData(channel);
                combinedData.set(channelData, offset);
                offset += channelData.length;
                
                // Offset by the 0.8 seconds gap duration (silence)
                offset += Math.floor(sampleRate * 0.8);
            });
        }
        
        // Convert AudioBuffer to WAV Blob
        const wavBlob = audioBufferToWavBlob(combinedBuffer);
        
        // Trigger download
        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement('a');
        a.href = url;
        
        // Find surah name in Arabic
        const surahNameStr = selectedSurahLabel.textContent.split('.')[1]?.trim() || `السورة_${currentSurah}`;
        a.download = `تسميع_سورة_${surahNameStr.replace(/\s+/g, '_')}_بصوتي.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('🎉 تم تجميع تلاوتك الكاملة بنجاح وتنزيل الملف بصيغة WAV!');
        
        // Close temp ctx
        await tempCtx.close();
    } catch (err) {
        console.error('Failed to compile full Surah recitation:', err);
        alert('حدث خطأ أثناء تجميع الصوت. يرجى التأكد من التسجيلات والمحاولة مرة أخرى.');
    } finally {
        btnExportUserSurah.classList.remove('active');
        btnExportUserSurah.querySelector('span').textContent = "تنزيل تلاوتتي بصيغة WAV 📥";
    }
}

// WAV Encoder Helper Functions
function audioBufferToWavBlob(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // raw PCM
    const bitDepth = 16;
    
    let result;
    if (numOfChan === 2) {
        result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
    } else {
        result = buffer.getChannelData(0);
    }
    
    const bufferLength = result.length * 2;
    const wavBuffer = new ArrayBuffer(44 + bufferLength);
    const view = new DataView(wavBuffer);
    
    /* RIFF identifier */
    writeString(view, 0, 'RIFF');
    /* file length */
    view.setUint32(4, 36 + bufferLength, true);
    /* RIFF type */
    writeString(view, 8, 'WAVE');
    /* format chunk identifier */
    writeString(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw) */
    view.setUint16(20, format, true);
    /* channel count */
    view.setUint16(22, numOfChan, true);
    /* sample rate */
    view.setUint32(24, sampleRate, true);
    /* byte rate (sample rate * block align) */
    view.setUint32(28, sampleRate * numOfChan * (bitDepth / 8), true);
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, numOfChan * (bitDepth / 8), true);
    /* bits per sample */
    view.setUint16(34, bitDepth, true);
    /* data chunk identifier */
    writeString(view, 36, 'data');
    /* data chunk length */
    view.setUint32(40, bufferLength, true);
    
    // Write audio PCM data
    floatTo16BitPCM(view, 44, result);
    
    return new Blob([wavBuffer], { type: 'audio/wav' });
}

function interleave(inputL, inputR) {
    const length = inputL.length + inputR.length;
    const result = new Float32Array(length);
    
    let index = 0;
    let inputIndex = 0;
    
    while (index < length) {
        result[index++] = inputL[inputIndex];
        result[index++] = inputR[inputIndex];
        inputIndex++;
    }
    return result;
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function floatTo16BitPCM(output, offset, input) {
    for (let i = 0; i < input.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
}

