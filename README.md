# Sidekick

**Sidekick** is a desktop application that helps people learn online through interactive, AI-powered courses. Built with Electron, Sidekick provides a personalized learning experience with real-time AI assistance, screen sharing, and multimodal interaction capabilities.

## Overview

Sidekick transforms online learning by combining structured courses with intelligent AI guidance. Whether you're learning Google Sheets, mastering design tools like Framer and Canva, exploring 3D modeling with Blender, or diving into automation with N8N, Sidekick provides hands-on challenges with real-time support.

## Key Features

### 🎓 Interactive Courses
- **Structured Learning Paths**: Step-by-step challenges across multiple topics
- **Progress Tracking**: Visual progress bars and challenge completion tracking
- **Course Library**: Access courses on:
  - Google Sheets Fundamentals
  - Framer Design Essentials
  - Blender 3D Fundamentals
  - ChatGPT Power User
  - N8N Automation Fundamentals
  - Canva Design Mastery
  - AI Prompting Mastery

### 🤖 AI-Powered Assistance
- **Real-time AI Guidance**: Get instant help from Gemini AI during your learning journey
- **Multimodal Interaction**: Communicate through text, voice, and visual context
- **Screen Sharing**: Share your screen with AI for contextual assistance
- **Voice Interaction**: Speak naturally and get audio responses
- **Interruption Support**: Interrupt and redirect the AI conversation as needed

### 🎯 Learning Tools
- **Screen Capture**: Share your screen for visual guidance
- **Audio Recording**: Voice input for hands-free learning
- **Camera Integration**: Visual context for learning sessions
- **Real-time Transcription**: See what you and the AI are saying

### 💻 Desktop Application
- **Native Desktop App**: Built with Electron for a native feel
- **Cross-platform**: Available for Windows, macOS, and Linux
- **Offline Capable**: Core features work without constant internet connection

## Prerequisites

- **Node.js** 18 or higher
- **Yarn** package manager
- **Google AI Studio API Key** (for AI features)
- **Deepgram API Key** (optional, for transcription features)

## Quick Start

1. **Get your API keys**:
   - Get a Google AI Studio API key from [Google AI Studio](https://aistudio.google.com/)
   - Optionally get a Deepgram API key from [Deepgram](https://deepgram.com/) for transcription

2. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd Sidekick
   ```

3. **Install dependencies**:
   ```bash
   yarn install
   ```

4. **Start the application**:
   ```bash
   yarn start
   ```

5. **Build for production**:
   ```bash
   yarn build:mac    # For macOS
   yarn build:win    # For Windows
   yarn build:linux  # For Linux
   ```

## How It Works

1. **Select a Course**: Browse available courses and choose one that interests you
2. **Start Learning**: Work through interactive challenges step by step
3. **Get Help**: Use the AI assistant when you need guidance or have questions
4. **Track Progress**: Monitor your progress through visual indicators
5. **Complete Challenges**: Move through challenges at your own pace

## Project Structure

```
Sidekick/
├── client/           # Frontend application code
│   ├── css/         # Stylesheets
│   ├── js/          # JavaScript modules
│   │   ├── courses/ # Course definitions and management
│   │   ├── audio/   # Audio recording and streaming
│   │   ├── camera/  # Camera integration
│   │   ├── screen/  # Screen capture
│   │   ├── transcribe/ # Speech transcription
│   │   └── ws/      # WebSocket client
│   └── index.html   # Main application HTML
├── server/          # Electron main process
│   ├── main.js      # Main Electron process
│   └── preload.js   # Preload script
├── components/      # React components (if used)
└── assets/          # Application icons and assets
```

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests. When contributing:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.

## Acknowledgments

Built with modern web technologies and powered by Google's Gemini AI for intelligent learning assistance.
