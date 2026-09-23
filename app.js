let audioCtx;
let activeOscillators = [];

// DOM Elements Settings
const osc1WaveSelect = document.getElementById('osc1Wave');
const osc1VolSlider = document.getElementById('osc1Vol');
const osc2WaveSelect = document.getElementById('osc2Wave');
const osc2VolSlider = document.getElementById('osc2Vol');
const osc3WaveSelect = document.getElementById('osc3Wave');
const osc3VolSlider = document.getElementById('osc3Vol');

const filterSlider = document.getElementById('filter');
const releaseSlider = document.getElementById('release');

const reverbTypeSelect = document.getElementById('reverbType');
const reverbMixSlider = document.getElementById('reverbMix');

const delayTimeSlider = document.getElementById('delayTime');
const delayFeedbackSlider = document.getElementById('delayFeedback');
const delayMixSlider = document.getElementById('delayMix');

// DOM Sequencer
const bpmSlider = document.getElementById('bpmSlider');
const bpmValue = document.getElementById('bpmValue');
const btnPlaySeq = document.getElementById('btnPlaySeq');
const btnClearSeq = document.getElementById('btnClearSeq');
const btnSavePreset = document.getElementById('btnSavePreset');
const presetNameInput = document.getElementById('presetName');
const savedPresetsSelect = document.getElementById('savedPresetsSelect');
const stepCards = document.querySelectorAll('.step-card');
const stepSelects = document.querySelectorAll('.seq-note');

// Audio Nodes
let filterNode, convolverNode, reverbMixGain, delayNode, delayFeedbackGain, delayMixGain, dryGain, delayFilter;

// Page Switch Logic (Drei Tabs)
const playPage = document.getElementById('playPage');
const settingsPage = document.getElementById('settingsPage');
const seqPage = document.getElementById('seqPage');

const btnPlayTab = document.getElementById('btnPlayTab');
const btnSettingsTab = document.getElementById('btnSettingsTab');
const btnSeqTab = document.getElementById('btnSeqTab');
const btnTestNote = document.getElementById('btnTestNote');

function switchTab(activePage, activeBtn) {
  [playPage, settingsPage, seqPage].forEach(p => p.classList.remove('active'));
  [btnPlayTab, btnSettingsTab, btnSeqTab].forEach(b => b.className = 'nav-btn inactive');
  
  activePage.classList.add('active');
  activeBtn.className = 'nav-btn active';
}

btnPlayTab.addEventListener('click', () => switchTab(playPage, btnPlayTab));
btnSettingsTab.addEventListener('click', () => switchTab(settingsPage, btnSettingsTab));
btnSeqTab.addEventListener('click', () => switchTab(seqPage, btnSeqTab));

// Chromatische Tonleiter (2 Oktaven: C3 bis B4 inkl. Halbtöne)
const NOTE_OPTIONS = [
  { name: '---', freq: 0 },
  { name: 'C3', freq: 130.81 },
  { name: 'C#3 / Db3', freq: 138.59 },
  { name: 'D3', freq: 146.83 },
  { name: 'D#3 / Eb3', freq: 155.56 },
  { name: 'E3', freq: 164.81 },
  { name: 'F3', freq: 174.61 },
  { name: 'F#3 / Gb3', freq: 185.00 },
  { name: 'G3', freq: 196.00 },
  { name: 'G#3 / Ab3', freq: 207.65 },
  { name: 'A3', freq: 220.00 },
  { name: 'A#3 / Bb3', freq: 233.08 },
  { name: 'B3', freq: 246.94 },
  { name: 'C4 (Mid C)', freq: 261.63 },
  { name: 'C#4 / Db4', freq: 277.18 },
  { name: 'D4', freq: 293.66 },
  { name: 'D#4 / Eb4', freq: 311.13 },
  { name: 'E4', freq: 329.63 },
  { name: 'F4', freq: 349.23 },
  { name: 'F#4 / Gb4', freq: 369.99 },
  { name: 'G4', freq: 392.00 },
  { name: 'G#4 / Ab4', freq: 415.30 },
  { name: 'A4', freq: 440.00 },
  { name: 'A#4 / Bb4', freq: 466.16 },
  { name: 'B4', freq: 493.88 }
];

// Populate Sequencer Dropdowns
stepSelects.forEach((select, index) => {
  NOTE_OPTIONS.forEach(note => {
    const opt = document.createElement('option');
    opt.value = note.freq;
    opt.textContent = note.name;
    select.appendChild(opt);
  });
  // Standard-Demomelodie vorgeben
  const defaultNoteIndexes = [13, 0, 17, 0, 20, 0, 17, 0];
  select.selectedIndex = defaultNoteIndexes[index];
});

// Reverb Impulse Generator
function createImpulseResponse(duration, decay) {
  const sampleRate = audioCtx.sampleRate;
  const length = sampleRate * duration;
  const impulse = audioCtx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    left[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    right[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
  }
  return impulse;
}

function updateReverbBuffer() {
  if (!convolverNode) return;
  const type = reverbTypeSelect.value;
  if (type === 'none') convolverNode.buffer = null;
  else if (type === 'room') convolverNode.buffer = createImpulseResponse(0.8, 3.0);
  else if (type === 'hall') convolverNode.buffer = createImpulseResponse(2.5, 2.0);
  else if (type === 'cathedral') convolverNode.buffer = createImpulseResponse(5.0, 1.2);
}

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    filterNode = audioCtx.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.value = parseFloat(filterSlider.value);

    convolverNode = audioCtx.createConvolver();
    updateReverbBuffer();

    reverbMixGain = audioCtx.createGain();
    reverbMixGain.gain.value = parseFloat(reverbMixSlider.value);

    delayNode = audioCtx.createDelay();
    delayNode.delayTime.value = parseFloat(delayTimeSlider.value);

    delayFeedbackGain = audioCtx.createGain();
    delayFeedbackGain.gain.value = parseFloat(delayFeedbackSlider.value);

    delayFilter = audioCtx.createBiquadFilter();
    delayFilter.type = 'highpass';
    delayFilter.frequency.value = 200; 

    delayMixGain = audioCtx.createGain();
    delayMixGain.gain.value = parseFloat(delayMixSlider.value);

    dryGain = audioCtx.createGain();
    dryGain.gain.value = 1.0;

    filterNode.connect(dryGain);
    dryGain.connect(audioCtx.destination);

    filterNode.connect(convolverNode);
    convolverNode.connect(reverbMixGain);
    reverbMixGain.connect(audioCtx.destination);

    filterNode.connect(delayNode);
    delayNode.connect(delayFilter);
    delayFilter.connect(delayFeedbackGain);
    delayFeedbackGain.connect(delayNode);
    delayFilter.connect(delayMixGain);
    delayMixGain.connect(audioCtx.destination);

    filterSlider.addEventListener('input', (e) => filterNode.frequency.value = parseFloat(e.target.value));
    reverbTypeSelect.addEventListener('change', updateReverbBuffer);
    reverbMixSlider.addEventListener('input', (e) => reverbMixGain.gain.value = parseFloat(e.target.value));
    delayTimeSlider.addEventListener('input', (e) => delayNode.delayTime.value = parseFloat(e.target.value));
    delayFeedbackSlider.addEventListener('input', (e) => delayFeedbackGain.gain.value = parseFloat(e.target.value));
    delayMixSlider.addEventListener('input', (e) => delayMixGain.gain.value = parseFloat(e.target.value));
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playChord(frequencies) {
  initAudio();
  stopChord();

  const vol1 = parseFloat(osc1VolSlider.value);
  const vol2 = parseFloat(osc2VolSlider.value);
  const vol3 = parseFloat(osc3VolSlider.value);

  frequencies.forEach(freq => {
    if (freq <= 0) return;

    const osc1 = audioCtx.createOscillator();
    osc1.type = osc1WaveSelect.value;
    osc1.frequency.value = freq;
    const gain1 = audioCtx.createGain();
    gain1.gain.value = vol1 * 0.15;
    osc1.connect(gain1);

    const osc2 = audioCtx.createOscillator();
    osc2.type = osc2WaveSelect.value;
    osc2.frequency.value = freq;
    osc2.detune.value = 7; 
    const gain2 = audioCtx.createGain();
    gain2.gain.value = vol2 * 0.15;
    osc2.connect(gain2);

    const osc3 = audioCtx.createOscillator();
    osc3.type = osc3WaveSelect.value;
    osc3.frequency.value = freq / 2;
    const gain3 = audioCtx.createGain();
    gain3.gain.value = vol3 * 0.15;
    osc3.connect(gain3);

    const voiceGain = audioCtx.createGain();
    voiceGain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    voiceGain.gain.linearRampToValueAtTime(1.0, audioCtx.currentTime + 0.02);

    gain1.connect(voiceGain);
    gain2.connect(voiceGain);
    gain3.connect(voiceGain);

    voiceGain.connect(filterNode);

    osc1.start();
    osc2.start();
    osc3.start();

    activeOscillators.push({ osc1, osc2, osc3, voiceGain });
  });
}

function stopChord() {
  const releaseTime = parseFloat(releaseSlider.value);
  
  activeOscillators.forEach(({ osc1, osc2, osc3, voiceGain }) => {
    const now = audioCtx.currentTime;
    voiceGain.gain.cancelScheduledValues(now);
    voiceGain.gain.setValueAtTime(voiceGain.gain.value, now);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);

    setTimeout(() => {
      try {
        osc1.stop();
        osc2.stop();
        osc3.stop();
        osc1.disconnect();
        osc2.disconnect();
        osc3.disconnect();
      } catch(e) {}
    }, releaseTime * 1000 + 50);
  });
  
  activeOscillators = [];
}

// Pads Setup
document.querySelectorAll('.chord-pad').forEach(pad => {
  const freqs = pad.dataset.notes.split(',').map(Number);
  pad.addEventListener('mousedown', () => playChord(freqs));
  pad.addEventListener('touchstart', (e) => { e.preventDefault(); playChord(freqs); });
  pad.addEventListener('mouseup', stopChord);
  pad.addEventListener('mouseleave', stopChord);
  pad.addEventListener('touchend', stopChord);
});

// Test Note Button
btnTestNote.addEventListener('mousedown', () => playChord([261.63]));
btnTestNote.addEventListener('touchstart', (e) => { e.preventDefault(); playChord([261.63]); });
btnTestNote.addEventListener('mouseup', stopChord);
btnTestNote.addEventListener('mouseleave', stopChord);
btnTestNote.addEventListener('touchend', stopChord);

// SEQUENCER ENGINE
let isPlayingSeq = false;
let currentStep = 0;
let seqTimer = null;

bpmSlider.addEventListener('input', (e) => {
  bpmValue.textContent = e.target.value;
  if (isPlayingSeq) {
    restartSeqTimer();
  }
});

function stepLoop() {
  stepCards.forEach(c => c.classList.remove('active-step'));
  
  const currentCard = stepCards[currentStep];
  currentCard.classList.add('active-step');

  const selectedFreq = parseFloat(stepSelects[currentStep].value);
  if (selectedFreq > 0) {
    playChord([selectedFreq]);
  }

  currentStep = (currentStep + 1) % 8;
}

function startSequencer() {
  initAudio();
  isPlayingSeq = true;
  btnPlaySeq.textContent = '⏸ Pause';
  btnPlaySeq.classList.add('play-active');
  currentStep = 0;
  stepLoop();
  restartSeqTimer();
}

function stopSequencer() {
  isPlayingSeq = false;
  btnPlaySeq.textContent = '▶ Start Loop';
  btnPlaySeq.classList.remove('play-active');
  clearInterval(seqTimer);
  stepCards.forEach(c => c.classList.remove('active-step'));
  stopChord();
}

function restartSeqTimer() {
  clearInterval(seqTimer);
  const interval = (60 / parseInt(bpmSlider.value)) * 1000 / 2; // Achtelnoten Tempo
  seqTimer = setInterval(stepLoop, interval);
}

btnPlaySeq.addEventListener('click', () => {
  if (isPlayingSeq) stopSequencer();
  else startSequencer();
});

btnClearSeq.addEventListener('click', () => {
  stepSelects.forEach(s => s.selectedIndex = 0);
});

// SAVE & LOAD SYSTEM (LocalStorage)
function loadPresetList() {
  savedPresetsSelect.innerHTML = '<option value="">-- Laden --</option>';
  const presets = JSON.parse(localStorage.getItem('june13_presets') || '{}');
  Object.keys(presets).forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    savedPresetsSelect.appendChild(opt);
  });
}

btnSavePreset.addEventListener('click', () => {
  const name = presetNameInput.value.trim();
  if (!name) return alert('Bitte einen Namen eingeben!');
  
  const pattern = Array.from(stepSelects).map(s => s.value);
  const presets = JSON.parse(localStorage.getItem('june13_presets') || '{}');
  presets[name] = pattern;
  
  localStorage.setItem('june13_presets', JSON.stringify(presets));
  presetNameInput.value = '';
  loadPresetList();
  alert(`Loop "${name}" gespeichert!`);
});

savedPresetsSelect.addEventListener('change', (e) => {
  const name = e.target.value;
  if (!name) return;
  const presets = JSON.parse(localStorage.getItem('june13_presets') || '{}');
  if (presets[name]) {
    presets[name].forEach((freq, idx) => {
      stepSelects[idx].value = freq;
    });
  }
});

// Init Presets beim Laden
loadPresetList();