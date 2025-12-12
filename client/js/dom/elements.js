// DOM elements object
const elements = {
    // Button elements
    micBtn: document.getElementById('micBtn'),
    screenBtn: document.getElementById('screenBtn'),
    settingsBtn: document.getElementById('settingsBtn'),

    // Preview elements
    screenPreview: document.getElementById('screenPreview'),

    // Challenge content elements
    challengeCourse: document.getElementById('challengeCourse'),
    challengeTitle: document.getElementById('challengeTitle'),
    challengeSubtitle: document.getElementById('challengeSubtitle'),
    challengeInstructions: document.getElementById('challengeInstructions'),

    // Footer controls
    stopGeminiBtn: document.getElementById('stopGeminiBtn'),
    audiogramWrapper: document.querySelector('.audiogram'),
    audiogramBars: null, // Will be populated after DOM load
    playIcon: null, // Will be populated after DOM load
    statusIndicator: null, // Will be populated after DOM load
};

export default elements;
