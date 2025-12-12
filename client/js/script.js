import { GeminiAgent } from './main/agent.js';
import { getConfig, getWebsocketUrl, getDeepgramApiKey, MODEL_SAMPLE_RATE } from './config/config.js';

import { GoogleSearchTool } from './tools/google-search.js';
import { ToolManager } from './tools/tool-manager.js';
import { CourseManager } from './courses/course-manager.js';
import { CourseUIManager } from './courses/ui-manager.js';

import { setupEventListeners } from './dom/events.js';

const url = getWebsocketUrl();
const config = getConfig();
const deepgramApiKey = getDeepgramApiKey();

const toolManager = new ToolManager();
toolManager.registerTool('googleSearch', new GoogleSearchTool());

const courseManager = new CourseManager();
const courseUIManager = new CourseUIManager(courseManager);

const geminiAgent = new GeminiAgent({
    url,
    config,
    deepgramApiKey,
    modelSampleRate: MODEL_SAMPLE_RATE,
    toolManager
});

// Track when Gemini last spoke for intelligent cooldown
let lastAISpeechTime = 0;

// Set up AI status event listeners
geminiAgent.on('audio_stream_start', () => {
    // Status UI removed in simplified design
});

geminiAgent.on('audio_stream_stop', () => {
    // Record when AI finished speaking for cooldown logic
    lastAISpeechTime = Date.now();
});

// Handle API errors
geminiAgent.on('quota_exceeded', () => {
    // Stop UI elements
    const micBtn = document.getElementById('micBtn');
    const screenBtn = document.getElementById('screenBtn');
    if (micBtn) micBtn.classList.remove('active');
    if (screenBtn) screenBtn.classList.remove('active');
    
    // Stop challenge completion checks
    stopChallengeCompletionChecks();
});

geminiAgent.on('auth_error', () => {
    // Stop UI elements
    const micBtn = document.getElementById('micBtn');
    const screenBtn = document.getElementById('screenBtn');
    if (micBtn) micBtn.classList.remove('active');
    if (screenBtn) screenBtn.classList.remove('active');
    
    // Stop challenge completion checks
    stopChallengeCompletionChecks();
});

// Handle course-related events
courseManager.on('course_selected', async (data) => {
    const { course, challenge } = data;
    
    // Auto-connect and start screen sharing when course is selected
    try {
        // Ensure connection is established (will skip if already connected)
        await geminiAgent.connect();
        
        // Ensure initialization is complete (will skip if already initialized)
        await geminiAgent.initialize();

        // Update challenge context
        await geminiAgent.updateChallengeContext(challenge, course.title);
        
        // Auto-start screen sharing for learning
        const screenBtn = document.getElementById('screenBtn');
        if (screenBtn && !screenBtn.classList.contains('active')) {
            await geminiAgent.startScreenShare();
            screenBtn.classList.add('active');
        }
        
        // Auto-activate microphone for voice interaction
        if (!geminiAgent.audioRecorder?.stream) {
            await geminiAgent.startRecording();
            const micBtn = document.getElementById('micBtn');
            if (micBtn) {
                micBtn.classList.add('active');
            }
        }
        
        // Check if this is the first challenge
        const isFirstChallenge = courseManager.currentChallengeIndex === 0;
        
        // Provide initial instructions for the challenge
        setTimeout(async () => {
            await geminiAgent.provideInitialInstructions(challenge, course.title, isFirstChallenge);
        }, 1000); // Wait 1 second for context to be set
        
        // Start periodic challenge completion checks
        startChallengeCompletionChecks();
        
        console.info('Started course:', course.title);
    } catch (error) {
        console.error('Error starting course:', error);
    }
});

courseManager.on('challenge_changed', async (challenge) => {
    if (courseManager.currentCourse && geminiAgent.connected) {
        await geminiAgent.updateChallengeContext(challenge, courseManager.currentCourse.title);
        
        // Check if this is the first challenge (should not happen in challenge_changed, but be safe)
        const isFirstChallenge = courseManager.currentChallengeIndex === 0;
        
        // Provide initial instructions for the new challenge
        setTimeout(async () => {
            await geminiAgent.provideInitialInstructions(challenge, courseManager.currentCourse.title, isFirstChallenge);
        }, 1000); // Wait 1 second for context to be set
        
        // Start periodic challenge completion checks
        startChallengeCompletionChecks();
    }
});

// Challenge completion checking
let completionCheckInterval = null;
let lastCheckTime = 0;
let challengeStartTime = 0;

function startChallengeCompletionChecks() {
    // Clear any existing interval
    if (completionCheckInterval) {
        clearInterval(completionCheckInterval);
    }
    
    // Record when the challenge started (for grace period)
    challengeStartTime = Date.now();
    lastCheckTime = Date.now();
    
    // Check for completion every 45 seconds (much less frequent to reduce interruptions)
    completionCheckInterval = setInterval(async () => {
        const now = Date.now();
        const timeSinceStart = now - challengeStartTime;
        const timeSinceLastCheck = now - lastCheckTime;
        const timeSinceLastSpeech = now - lastAISpeechTime;
        
        // Grace period: Don't check for at least 60 seconds after challenge starts
        // This gives users time to read instructions and start working without interruption
        if (timeSinceStart < 60000) {
            return;
        }
        
        // Cooldown after AI speaks: Wait at least 40 seconds after Gemini finishes talking
        // before checking again. This prevents back-to-back interruptions.
        if (lastAISpeechTime > 0 && timeSinceLastSpeech < 40000) {
            return;
        }
        
        // Ensure at least 45 seconds between checks
        if (timeSinceLastCheck < 45000) {
            return;
        }
        
        if (courseManager.isInCourse() && geminiAgent.connected && !courseManager.isTransitioning()) {
            const currentChallenge = courseManager.getCurrentChallenge();
            if (currentChallenge) {
                lastCheckTime = now;
                await geminiAgent.checkChallengeCompletion(currentChallenge);
            }
        }
    }, 45000); // Check every 45 seconds (but respects grace periods)
}

function stopChallengeCompletionChecks() {
    if (completionCheckInterval) {
        clearInterval(completionCheckInterval);
        completionCheckInterval = null;
    }
}

courseManager.on('course_exited', async () => {
    // Stop screen sharing when exiting course
    const screenBtn = document.getElementById('screenBtn');
    if (screenBtn && screenBtn.classList.contains('active')) {
        await geminiAgent.stopScreenShare();
        screenBtn.classList.remove('active');
    }
    
    // Stop audio streaming and microphone when exiting course
    if (geminiAgent.audioRecorder && geminiAgent.audioRecorder.stream) {
        geminiAgent.audioRecorder.stop();
        const micBtn = document.getElementById('micBtn');
        if (micBtn) {
            micBtn.classList.remove('active');
        }
    }
    
    // Stop audio playback if currently streaming
    if (geminiAgent.audioStreamer) {
        geminiAgent.audioStreamer.stop();
    }

    // Stop challenge completion checks
    stopChallengeCompletionChecks();
    
    console.info('Course exited - streaming stopped and resources cleaned up');
});

// Initialize course UI
courseUIManager.initialize();

// Load courses and show selection screen
courseManager.loadCourses();

// Track if welcome flow has been triggered
let welcomeFlowTriggered = false;

// Listen for courses_loaded to trigger welcome flow
courseManager.on('courses_loaded', async () => {
    // Only trigger welcome flow if user hasn't been welcomed yet and agent is connected
    if (!welcomeFlowTriggered && geminiAgent.connected && geminiAgent.initialized) {
        welcomeFlowTriggered = true;
        
        // Check if user already has a name stored
        const userName = geminiAgent.getUserName();
        if (!userName) {
            // Trigger welcome flow to ask for name
            setTimeout(async () => {
                await geminiAgent.startWelcomeFlow();
            }, 1500); // Wait 1.5 seconds after courses load
        }
    }
});

// Connect agent and auto-activate microphone
geminiAgent.connect().then(async () => {
    try {
        await geminiAgent.initialize();
        await geminiAgent.startRecording();
        // Mark microphone button as active
        const micBtn = document.getElementById('micBtn');
        if (micBtn) {
            micBtn.classList.add('active');
        }

        // Simplified UI removes first-time tooltip
        
        // If courses are already loaded, trigger welcome flow now
        if (courseManager.courses.length > 0 && !welcomeFlowTriggered) {
            welcomeFlowTriggered = true;
            const userName = geminiAgent.getUserName();
            if (!userName) {
                setTimeout(async () => {
                    await geminiAgent.startWelcomeFlow();
                }, 1500);
            }
        }
    } catch (error) {
        console.error('Error auto-activating microphone:', error);
    }
});

setupEventListeners(geminiAgent, courseManager);