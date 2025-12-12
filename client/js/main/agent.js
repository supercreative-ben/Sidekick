/**
 * Core application class that orchestrates the interaction between various components
 * of the Gemini 2 Live API. Manages audio streaming, WebSocket communication, audio transcription,
 * and coordinates the overall application functionality.
 */
import { GeminiWebsocketClient } from '../ws/client.js';

import { AudioRecorder } from '../audio/recorder.js';
import { AudioStreamer } from '../audio/streamer.js';
// AudioVisualizer import removed - no longer needed

import { DeepgramTranscriber } from '../transcribe/deepgram.js';

import { CameraManager } from '../camera/camera.js';
import { ScreenManager } from '../screen/screen.js';

export class GeminiAgent{
    constructor({
        name = 'GeminiAgent',
        url,
        config,
        deepgramApiKey = null,
        transcribeModelsSpeech = true,
        transcribeUsersSpeech = false,
        modelSampleRate = 24000,
        toolManager = null
    } = {}) {
        if (!url) throw new Error('WebSocket URL is required');
        if (!config) throw new Error('Config is required');

        this.initialized = false;
        this.connected = false;

        // For audio components
        this.audioContext = null;
        this.audioRecorder = null;
        this.audioStreamer = null;
        
        // For transcribers
        this.transcribeModelsSpeech = transcribeModelsSpeech;
        this.transcribeUsersSpeech = transcribeUsersSpeech;
        this.deepgramApiKey = deepgramApiKey;
        this.modelSampleRate = modelSampleRate;

        // Initialize screen & camera settings
        this.fps = localStorage.getItem('fps') || '5';
        this.captureInterval = 1000 / this.fps;
        this.resizeWidth = localStorage.getItem('resizeWidth') || '640';
        this.quality = localStorage.getItem('quality') || '0.4';
        
        // Initialize camera
        this.cameraManager = new CameraManager({
            width: this.resizeWidth,
            quality: this.quality,
            facingMode: localStorage.getItem('facingMode') || 'environment'
        });
        this.cameraInterval = null;

        // Initialize screen sharing
        this.screenManager = new ScreenManager({
            width: this.resizeWidth,
            quality: this.quality,
            onStop: () => {
                // Clean up interval and emit event when screen sharing stops
                if (this.screenInterval) {
                    clearInterval(this.screenInterval);
                    this.screenInterval = null;
                }
                // Emit screen share stopped event
                this.emit('screenshare_stopped');
            }
        });
        this.screenInterval = null;
        
        // Add function declarations to config
        this.toolManager = toolManager;
        config.tools.functionDeclarations = toolManager.getToolDeclarations() || [];
        this.config = config;

        this.name = name;
        this.url = url;
        this.client = null;
        this._audioStreaming = false;
    }

    setupEventListeners() {
        // Handle incoming audio data from the model
        this.client.on('audio', async (data) => {
            try {
                if (!this.audioStreamer.isInitialized) {
                    this.audioStreamer.initialize();
                    this.emitAudioStreamStart();
                }
                this.audioStreamer.streamAudio(new Uint8Array(data));

                if (this.modelTranscriber && this.modelTranscriber.isConnected) {
                    this.modelTranscriber.sendAudio(data);
                }

            } catch (error) {
                throw new Error('Audio processing error:' + error);
            }
        });

        // Handle model interruptions by stopping audio playback
        this.client.on('interrupted', () => {
            if (this.audioStreamer) {
                this.audioStreamer.stop();
                this.audioStreamer.isInitialized = false;
            }
            this.emitAudioStreamStop();
            this.emit('interrupted');
        });

        // Add an event handler when the model finishes speaking if needed
        this.client.on('turn_complete', () => {
            console.info('Model finished speaking');
            if (this.audioStreamer) {
                this.audioStreamer.isInitialized = false;
            }
            this.emitAudioStreamStop();
            this.emit('turn_complete');
        });

        this.client.on('tool_call', async (toolCall) => {
            await this.handleToolCall(toolCall);
        });

        // Handle quota exceeded error
        this.client.on('quota_exceeded', (reason) => {
            console.error('🚫 API quota exceeded. Stopping all operations.');
            this.handleQuotaExceeded(reason);
        });

        // Handle authentication errors
        this.client.on('auth_error', (reason) => {
            console.error('🚫 Authentication error. Please check your API key.');
            this.handleAuthError(reason);
        });

        // Handle disconnection
        this.client.on('disconnected', (data) => {
            console.warn('Connection closed:', data);
            this.handleDisconnection(data);
        });
    }
        
    // TODO: Handle multiple function calls
    async handleToolCall(toolCall) {
        const functionCall = toolCall.functionCalls[0];
        const response = await this.toolManager.handleToolCall(functionCall);
        await this.client.sendToolResponse(response);
    }

    /**
     * Connects to the Gemini API using the GeminiWebsocketClient.connect() method.
     */
    async connect() {
        // If already connected, don't create a new connection
        if (this.connected && this.client && this.client.ws?.readyState === WebSocket.OPEN) {
            console.info('Already connected to Gemini');
            return;
        }
        
        // Create new client and connect
        this.client = new GeminiWebsocketClient(this.name, this.url, this.config);
        await this.client.connect();
        this.setupEventListeners();
        this.connected = true;
        console.info('Connected to Gemini successfully');
    }

    /**
     * Sends a text message to the Gemini API.
     * @param {string} text - The text message to send.
     */
    async sendText(text) {
        await this.client.sendText(text);
        this.emit('text_sent', text);
    }

    /**
     * Starts camera capture and sends images at regular intervals
     */
    async startCameraCapture() {
        if (!this.connected) {
            throw new Error('Must be connected to start camera capture');
        }

        try {
            await this.cameraManager.initialize();
            
            // Set up interval to capture and send images
            this.cameraInterval = setInterval(async () => {
                const imageBase64 = await this.cameraManager.capture();
                this.client.sendImage(imageBase64);                
            }, this.captureInterval);
            
            console.info('Camera capture started');
        } catch (error) {
            await this.disconnect();
            throw new Error('Failed to start camera capture: ' + error);
        }
    }

    /**
     * Stops camera capture and cleans up resources
     */
    async stopCameraCapture() {
        if (this.cameraInterval) {
            clearInterval(this.cameraInterval);
            this.cameraInterval = null;
        }
        
        if (this.cameraManager) {
            this.cameraManager.dispose();
        }
        
        console.info('Camera capture stopped');
    }

    /**
     * Starts screen sharing and sends screenshots at regular intervals
     */
    async startScreenShare() {
        if (!this.connected) {
            throw new Error('Websocket must be connected to start screen sharing');
        }

        try {
            await this.screenManager.initialize();
            
            // Set up interval to capture and send screenshots
            this.screenInterval = setInterval(async () => {
                const imageBase64 = await this.screenManager.capture();
                this.client.sendImage(imageBase64);
            }, this.captureInterval);
            
            console.info('Screen sharing started');
        } catch (error) {
            await this.stopScreenShare();
            throw new Error('Failed to start screen sharing: ' + error);
        }
    }

    /**
     * Stops screen sharing and cleans up resources
     */
    async stopScreenShare() {
        if (this.screenInterval) {
            clearInterval(this.screenInterval);
            this.screenInterval = null;
        }
        
        if (this.screenManager) {
            this.screenManager.dispose();
        }
        
        console.info('Screen sharing stopped');
    }

    /**
     * Gracefully terminates all active connections and streams.
     * Ensures proper cleanup of audio, screen sharing, and WebSocket resources.
     */
    async disconnect() {
        if (!this.connected) return;
        
        try {
            // Stop camera capture first
            await this.stopCameraCapture();

            // Stop screen sharing
            await this.stopScreenShare();

            // Cleanup audio resources in correct order
            if (this.audioRecorder) {
                this.audioRecorder.stop();
                this.audioRecorder = null;
            }

            // Visualizer cleanup removed - no longer needed

            // Clean up audio streamer before closing context
            if (this.audioStreamer) {
                this.audioStreamer.stop();
                this.audioStreamer = null;
            }

            // Cleanup model's speech transcriber
            if (this.modelTranscriber) {
                this.modelTranscriber.disconnect();
                this.modelTranscriber = null;
                if (this.modelsKeepAliveInterval) {
                    clearInterval(this.modelsKeepAliveInterval);
                    this.modelsKeepAliveInterval = null;
                }
            }

            // Cleanup user's speech transcriber
            if (this.userTranscriber) {
                this.userTranscriber.disconnect();
                this.userTranscriber = null;
                if (this.userKeepAliveInterval) {
                    clearInterval(this.userKeepAliveInterval);
                    this.userKeepAliveInterval = null;
                }
            }

            // Finally close audio context
            if (this.audioContext) {
                await this.audioContext.close();
                this.audioContext = null;
            }

            // Cleanup WebSocket
            if (this.client) {
                this.client.disconnect();
                this.client = null;
            }
            
            this.initialized = false;
            this.connected = false;
            
            this.emitAudioStreamStop();
            this.emit('disconnected');
            
            console.info('Disconnected and cleaned up all resources');
        } catch (error) {
            console.error('Disconnect error:', error);
            // Set flags even if there was an error
            this.initialized = false;
            this.connected = false;
        }
    }

    /**
     * Handle quota exceeded error
     */
    handleQuotaExceeded(reason) {
        // Stop recording
        if (this.audioRecorder?.stream) {
            this.audioRecorder.stop();
        }
        
        // Stop screen sharing
        this.stopScreenShare().catch(e => console.error('Error stopping screen share:', e));
        
        // Update UI
        this.emit('quota_exceeded', reason);
        
        // Show user-friendly message
        alert('⚠️ API Quota Exceeded\n\nYou have exceeded your Gemini API quota. Please check your plan and billing details at:\nhttps://aistudio.google.com/app/apikey');
    }

    /**
     * Handle authentication error
     */
    handleAuthError(reason) {
        // Stop recording
        if (this.audioRecorder?.stream) {
            this.audioRecorder.stop();
        }
        
        // Update UI
        this.emit('auth_error', reason);
        
        // Show user-friendly message
        alert('⚠️ Authentication Error\n\nYour API key is invalid or has expired. Please check your API key in Settings.');
    }

    /**
     * Handle disconnection
     */
    handleDisconnection(data) {
        // Mark as disconnected
        this.connected = false;
        
        // Only show error if it's an unexpected disconnection (not quota or auth error)
        if (data?.code && data.code !== 1000 && data.code !== 1011 && data.code !== 1008) {
            console.error('Unexpected disconnection:', data);
        }
    }

    /**
     * Initializes the model's speech transcriber with Deepgram
     */
    async initializeModelSpeechTranscriber() {
        if (!this.modelTranscriber) {
            console.warn('Either no Deepgram API key provided or model speech transcription disabled');
            return;
        }

        console.info('Initializing Deepgram model speech transcriber...');

        // Promise to send keep-alive every 10 seconds once connected
        const connectionPromise = new Promise((resolve) => {
            this.modelTranscriber.on('connected', () => {
                console.info('Model speech transcriber connection established, setting up keep-alive...');
                this.modelsKeepAliveInterval = setInterval(() => {
                    if (this.modelTranscriber.isConnected) {
                        this.modelTranscriber.ws.send(JSON.stringify({ type: 'KeepAlive' }));
                        console.info('Sent keep-alive message to model speech transcriber');
                    }
                }, 10000);
                resolve();
            });
        });

        // Just log transcription to console for now
        this.modelTranscriber.on('transcription', (transcript) => {
            this.emit('transcription', transcript);
            console.debug('Model speech transcription:', transcript);
        });

        // Connect to Deepgram and execute promise
        await this.modelTranscriber.connect();
        await connectionPromise;
    }

    /**
     * Initializes the user's speech transcriber with Deepgram
     */
    async initializeUserSpeechTranscriber() {
        if (!this.userTranscriber) {
            console.warn('Either no Deepgram API key provided or user speech transcription disabled');
            return;
        }

        console.info('Initializing Deepgram user speech transcriber...');

        // Promise to send keep-alive every 10 seconds once connected
        const connectionPromise = new Promise((resolve) => {
            this.userTranscriber.on('connected', () => {
                console.info('User speech transcriber connection established, setting up keep-alive...');
                this.userKeepAliveInterval = setInterval(() => {
                    if (this.userTranscriber.isConnected) {
                        this.userTranscriber.ws.send(JSON.stringify({ type: 'KeepAlive' }));
                        console.info('Sent keep-alive message to user transcriber');
                    }
                }, 10000);
                resolve();
            });
        });

        // Handle user transcription events
        this.userTranscriber.on('transcription', (transcript) => {
            this.emit('user_transcription', transcript);
            console.debug('User speech transcription:', transcript);
        });

        // Connect to Deepgram and execute promise
        await this.userTranscriber.connect();
        await connectionPromise;
    }

    /**
     * Initiates audio recording from the microphone.
     * Streams audio data to the model in real-time, handling interruptions
     */
    async initialize() {
        // If already initialized, don't initialize again
        if (this.initialized) {
            console.info('Agent already initialized');
            return;
        }
        
        try {            
            // Initialize audio components
            this.audioContext = new AudioContext();
            this.audioStreamer = new AudioStreamer(this.audioContext);
            this.audioStreamer.initialize();
            // Visualizer removed - no longer needed
            this.audioRecorder = new AudioRecorder();
            
            // Initialize transcriber if API key is provided
            if (this.deepgramApiKey) {
                if (this.transcribeModelsSpeech) {
                    this.modelTranscriber = new DeepgramTranscriber(this.deepgramApiKey, this.modelSampleRate);
                    await this.initializeModelSpeechTranscriber();
                }
                if (this.transcribeUsersSpeech) {
                    this.userTranscriber = new DeepgramTranscriber(this.deepgramApiKey, 16000);
                    await this.initializeUserSpeechTranscriber();
                }
            } else {
                console.warn('No Deepgram API key provided, transcription disabled');
            }
            
            this.initialized = true;
            console.info(`${this.client.name} initialized successfully`);
            await this.client.sendText('.');  // Trigger the model to start speaking first
        } catch (error) {
            console.error('Initialization error:', error);
            throw new Error('Error during the initialization of the client: ' + error.message);
        }
    }

    async startRecording() {
        // Start recording with callback to send audio data to websocket and transcriber
        await this.audioRecorder.start(async (audioData) => {
            try {
                this.client.sendAudio(audioData);
                if (this.userTranscriber && this.userTranscriber.isConnected) {
                    this.userTranscriber.sendAudio(new Uint8Array(audioData));
                }
            } catch (error) {
                console.error('Error sending audio data:', error);
                this.audioRecorder.stop();
            }
        });
    }

    /**
     * Toggles the microphone state between active and suspended
     */
    async toggleMic() {
        if (!this.audioRecorder.stream) {
            await this.startRecording();
            return;
        }
        await this.audioRecorder.toggleMic();
    }           

    // Add event emitter functionality
    on(eventName, callback) {
        if (!this._eventListeners) {
            this._eventListeners = new Map();
        }
        if (!this._eventListeners.has(eventName)) {
            this._eventListeners.set(eventName, []);
        }
        this._eventListeners.get(eventName).push(callback);
    }

    emit(eventName, data) {
        if (!this._eventListeners || !this._eventListeners.has(eventName)) {
            return;
        }
        for (const callback of this._eventListeners.get(eventName)) {
            callback(data);
        }
    }

    emitAudioStreamStart() {
        if (!this._audioStreaming) {
            this._audioStreaming = true;
            this.emit('audio_stream_start');
        }
    }

    emitAudioStreamStop() {
        if (this._audioStreaming) {
            this._audioStreaming = false;
            this.emit('audio_stream_stop');
        }
    }

    /**
     * Get the user's stored name
     * @returns {string|null} The user's name or null if not set
     */
    getUserName() {
        return localStorage.getItem('userName');
    }

    /**
     * Store the user's name
     * @param {string} name - The user's name
     */
    setUserName(name) {
        localStorage.setItem('userName', name);
    }

    /**
     * Initiate the welcome flow on course selection screen
     */
    async startWelcomeFlow() {
        if (!this.connected) {
            console.warn('Cannot start welcome flow - not connected');
            return;
        }

        const welcomeMessage = `SYSTEM INSTRUCTION: You are starting a new coaching session. Greet the user with this exact script:

"Welcome. I'm your coach Sidekick. What's your name?"

When the user responds with their name, confirm it by saying "Is it [Name]?" and then say: "Excellent. [Name], we're going to learn online like you've never learned before. No boring tutorials, just by practicing. Are you ready? Select a course to get started."

Remember their name and use it throughout all future interactions to make the coaching more personal.`;
        
        await this.client.sendText(welcomeMessage, true);
        console.info('Started welcome flow');
    }

    /**
     * Update the challenge context for the learning coach
     * @param {Object} challenge - The current challenge object
     * @param {string} courseName - The name of the course
     */
    async updateChallengeContext(challenge, courseName) {
        if (!this.connected) {
            console.warn('Cannot update challenge context - not connected');
            return;
        }

        const userName = this.getUserName();
        const userContext = userName ? `The student's name is ${userName}. ` : '';

        const contextMessage = `${userContext}${courseName} - Challenge: ${challenge.title}
${challenge.description}

Instructions: ${challenge.instructions}
${challenge.hints && challenge.hints.length > 0 ? `Hints: ${challenge.hints.join('; ')}` : ''}

IMPORTANT COACHING GUIDELINES:
- Be patient. Give the student time and space to work.
- Only speak when the student speaks to you or when checking progress.
- Do not fill silence with unnecessary talk.
- Be brief and encouraging when you do speak.
- Watch the screen quietly. When complete, say "Done! Next challenge."`;

        // Send the context as a system message
        await this.client.sendText(contextMessage, true);
        console.info('Updated challenge context for:', challenge.title);
    }

    /**
     * Check if challenge is completed based on screen content
     * @param {Object} challenge - The current challenge object
     */
    async checkChallengeCompletion(challenge) {
        if (!this.connected) {
            return false;
        }

        const completionCheck = `Silent progress check: Look at the student's screen. Have they completed "${challenge.title}"?

Objective: ${challenge.description}

RULES FOR RESPONSE:
1. If clearly completed: Briefly congratulate and say "Click Next challenge to continue."
2. If NOT completed but making good progress: Say NOTHING. Stay silent. Let them work.
3. ONLY if they seem stuck or confused (haven't made progress): Offer ONE brief hint.
4. Default to silence. The student needs focus time.

Do not ramble or explain. Be extremely brief or say nothing.`;

        // Send the completion check
        await this.client.sendText(completionCheck, true);
        return true;
    }

    /**
     * Ask Gemini to provide initial instructions for the challenge
     * @param {Object} challenge - The current challenge object
     * @param {string} courseName - The name of the course
     * @param {boolean} isFirstChallenge - Whether this is the first challenge of the course
     */
    async provideInitialInstructions(challenge, courseName, isFirstChallenge = false) {
        if (!this.connected) {
            return;
        }

        const userName = this.getUserName();

        const instructionMessage = `New challenge starting: ${challenge.title} in ${courseName}.

Objective: ${challenge.description}

Instructions to give:
${isFirstChallenge ? '- Start with "Welcome to this challenge!"' : '- Skip welcome, just give instructions'}
- Provide clear, concise steps (3-5 steps maximum)
- Be encouraging but brief
${userName ? `- Use the name ${userName}` : ''}
- End with: "Take your time. Let me know if you need help."
- Then STAY SILENT. Give them space to work. Do not interrupt unless they speak to you.`;

        await this.client.sendText(instructionMessage, true);
    }
}