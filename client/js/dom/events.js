import elements from './elements.js';
import settingsManager from '../settings/settings-manager.js';

// Disconnect functionality removed

let isScreenShareActive = false;

const ensureAgentReady = async (agent) => {
    if (!agent.connected) {
        await agent.connect();
    }
    if (!agent.initialized) {
        await agent.initialize();
    }
    if (!agent.audioRecorder?.stream) {
        await agent.startRecording();
        if (elements.micBtn) elements.micBtn.classList.add('active');
    }
};

let audiogramInterval = null;
let isGeminiActive = true;

// Initialize audiogram bars reference
const initializeAudiogramBars = () => {
    if (!elements.audiogramBars) {
        elements.audiogramBars = document.querySelectorAll('.audiogram span');
        elements.playIcon = document.querySelector('.play-icon');
        elements.statusIndicator = document.querySelector('.status-indicator');
    }
};

const startAudiogram = () => {
    initializeAudiogramBars();
    // Clear any existing interval first to ensure clean start
    if (audiogramInterval) {
        clearInterval(audiogramInterval);
        audiogramInterval = null;
    }
    
    const bars = Array.from(elements.audiogramBars || []);
    if (bars.length === 0) return;
    
    audiogramInterval = setInterval(() => {
        bars.forEach((bar, index) => {
            const baseHeight = index === 1 ? 21 : index === 2 ? 13 : 9;
            const variation = Math.random() * 16;
            bar.style.height = `${Math.max(6, baseHeight + variation)}px`;
        });
    }, 120);
};

const stopAudiogram = () => {
    if (audiogramInterval) {
        clearInterval(audiogramInterval);
        audiogramInterval = null;
    }
    initializeAudiogramBars();
    const bars = Array.from(elements.audiogramBars || []);
    const heights = [9, 21, 13];
    bars.forEach((bar, index) => {
        bar.style.height = `${heights[index] ?? 12}px`;
    });
};

const toggleGeminiState = (active) => {
    initializeAudiogramBars();
    isGeminiActive = active;
    
    const audiogramWrapper = elements.audiogramWrapper;
    const playIcon = elements.playIcon;
    const statusIndicator = elements.statusIndicator;
    const stopBtn = elements.stopGeminiBtn;
    
    if (audiogramWrapper) audiogramWrapper.style.display = active ? 'inline-flex' : 'none';
    if (playIcon) {
        playIcon.style.display = active ? 'none' : 'block';
        playIcon.style.color = active ? '' : '#ffffff';
    }
    if (statusIndicator) {
        statusIndicator.style.background = active ? '#a7a7a7' : '#ffffff';
    }
    if (stopBtn) {
        stopBtn.setAttribute('data-state', active ? 'active' : 'stopped');
        stopBtn.setAttribute('aria-label', active ? 'Stop Gemini' : 'Resume Gemini');
    }
};

export function setupEventListeners(agent, courseManager) {
    // Initialize audiogram bars on setup
    initializeAudiogramBars();

    if (elements.micBtn) {
        elements.micBtn.addEventListener('click', async () => {
        try {
            await ensureAgentReady(agent);
            await agent.toggleMic();
            elements.micBtn.classList.toggle('active');
        } catch (error) {
            console.error('Error toggling microphone:', error);
            elements.micBtn.classList.remove('active');
        }
        });
    }

    agent.on('audio_stream_start', startAudiogram);
    agent.on('audio_stream_stop', stopAudiogram);

    agent.on('screenshare_stopped', () => {
        if (elements.screenBtn) {
            elements.screenBtn.classList.remove('active');
        }
        isScreenShareActive = false;
        console.info('Screen share stopped');
    });

    if (elements.screenBtn) {
        elements.screenBtn.addEventListener('click', async () => {
        try {
            await ensureAgentReady(agent);

            if (!isScreenShareActive) {
                await agent.startScreenShare();
                elements.screenBtn.classList.add('active');
            } else {
                await agent.stopScreenShare();
                elements.screenBtn.classList.remove('active');
            }
            isScreenShareActive = !isScreenShareActive;
        } catch (error) {
            console.error('Error toggling screen share:', error);
            elements.screenBtn.classList.remove('active');
            isScreenShareActive = false;
        }
        });
    }

    if (elements.settingsBtn) {
        elements.settingsBtn.addEventListener('click', () => settingsManager.show());
    }

    if (elements.stopGeminiBtn) {
        elements.stopGeminiBtn.addEventListener('click', async () => {
            try {
                if (isGeminiActive) {
                    // Stop Gemini
                    await agent.disconnect?.();
                    stopAudiogram();
                    toggleGeminiState(false);
                    if (elements.micBtn) elements.micBtn.classList.remove('active');
                    if (elements.screenBtn) elements.screenBtn.classList.remove('active');
                } else {
                    // Resume Gemini
                    await ensureAgentReady(agent);
                    toggleGeminiState(true);
                    if (elements.micBtn) elements.micBtn.classList.add('active');
                }
            } catch (error) {
                console.error('Error toggling Gemini:', error);
            }
        });
    }

    if (courseManager) {
        courseManager.on('course_selected', () => {
            if (!isScreenShareActive && elements.screenBtn) {
                elements.screenBtn.classList.add('active');
                isScreenShareActive = true;
            }
        });

        courseManager.on('course_exited', () => {
            if (elements.screenBtn) {
                elements.screenBtn.classList.remove('active');
            }
            isScreenShareActive = false;
            if (elements.micBtn) {
                elements.micBtn.classList.add('active');
            }
        });
    }
}

settingsManager;
