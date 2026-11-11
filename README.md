# ⚡ p5.js Vibe Coder (Browser Extension)

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Available-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/hepphlodjiibdknhgndjaephkccjigbo)
[![GitHub](https://img.shields.io/badge/GitHub-diy--ecg%2Fp5js--vibecoder-181717?logo=github)](https://github.com/diy-ecg/p5js-vibecoder)
[![Browsers](https://img.shields.io/badge/Browsers-Chrome%20%7C%20Brave%20%7C%20Edge%20%7C%20Firefox-success?logo=googlechrome)](https://chromewebstore.google.com/detail/hepphlodjiibdknhgndjaephkccjigbo)
[![Manifest V3](https://img.shields.io/badge/Platform-WebExtension%20(MV3)-blue)](#-installation-guide)
[![Google Gemini](https://img.shields.io/badge/AI-Google%20Gemini%20API-4285F4?logo=google)](https://aistudio.google.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Privacy: Clean](https://img.shields.io/badge/Privacy-Strict%20(No%20Tracking)-brightgreen)](PRIVACY.md)
[![Bilingual](https://img.shields.io/badge/Language-English%20%7C%20Deutsch-blue)](#-bilingual-support-en--de)

A cross-browser extension for **vibe coding** directly inside the official [p5.js Web Editor](https://editor.p5js.org/). Built for equal, first-class performance across **Google Chrome**, **Brave**, **Microsoft Edge**, **Mozilla Firefox**, **Opera**, and other modern browsers.

Simply type what you want to visualize, build, or modify in natural language. Powered by **Google Gemini**, the extension generates production-ready p5.js code in seconds, injects it straight into your CodeMirror editor, and automatically runs your sketch!

---

## 🚀 Highlights & Features

### 💬 Multi-Turn Conversational Memory & Context
- **Zero-Friction Context Switching**: Automatically detects whether you are starting fresh on a blank canvas or iterating on an existing sketch.
- **True Multi-Turn Dialog**: Gemini remembers prior iteration turns (*"Make it neon green"*, *"Slow down the particle flow"*, *"Add a bounce effect when the user clicks"*).
- **New Chat Reset (`×`)**: Clear conversational memory with a single click to start a new sketch with a clean context.
- **Auto-Clearing Prompt Box**: The prompt field automatically clears after generation so you can immediately type your next instruction without having to delete old text.

### ▶️ Instant Auto-Start with React & Fiber Bridge
- **Immediate Visual Feedback**: The generated sketch automatically starts running in the preview window as soon as generation completes — no need to manually click the Play button.
- **On/Off Toggle**: A dedicated switch in the HUD header lets you disable or enable Auto-Start at any time (defaults to **ON**).
- **Bulletproof Execution**: Leverages a multi-stage execution bridge (React 18 Fiber dispatch, synthetic PointerEvents, and keyboard shortcuts) that reliably triggers execution across browser sandbox and extension isolation boundaries.

### ↩ 1-Click Undo
- Restore your previous code version with a single click on the `↩ Undo` button.
- Simultaneously rolls back conversational history by one turn, ensuring your AI dialog stays synchronized with your editor state.

### 🕒 Local Prompt History
- Automatically records your last 50 prompts in local browser storage (`storage.local`).
- **History Modal**: Click the **"🕒 History"** button to review past prompts, copy them, or load them back into the editor with one click.
- **Terminal-Style Navigation**: Press the <kbd>↑</kbd> and <kbd>↓</kbd> arrow keys inside an empty prompt input to quickly cycle through previous prompts.

### 🌍 Bilingual Support (EN / DE)
- **English by Default**: Pre-configured for English (`en`), with full support for German (`de`).
- Switch languages on the fly via the settings menu in the floating HUD or the toolbar popup.
- Every UI element, error message, toast alert, and underlying Gemini system prompt dynamically adapts to your selected language.

### ⚡ Live Gemini Model Discovery & Auto-Fallback
- Queries the Google Gemini API to detect all models available for your API key (**Gemini 2.0 Flash**, **Gemini 3.8 Flash**, **Gemini 3.8 Pro**, etc.).
- **Cascade Fallback**: Automatically falls back to stable secondary models if your chosen model experiences temporary rate limits or server load.
- Dynamic status badge in the HUD header showing the active model in real time.

### 🎨 Ergonomic Floating Dark HUD
- Fully draggable floating panel across your browser window.
- Collapsible into an unobtrusive floating pill badge via the header button or keyboard shortcut (<kbd>Alt</kbd> + <kbd>V</kbd>).
- Starts automatically in minimized pill mode on page load to keep the p5.js canvas and editor completely unobstructed.
- Automatically remembers its custom screen position when expanded.

---

## 🧠 Technical Deep-Dive: Token Limits & Large Sketches

### Understanding the 8,192 Output Token Ceiling

| Parameter | Google Gemini Limit | Impact on p5.js Sketches |
| :--- | :--- | :--- |
| **Input Context** | Up to 1,000,000 tokens | Massive: Gemini can easily read existing sketches containing thousands of lines of code. |
| **Output Token Limit** | **8,192 tokens** (~500–600 lines) | The maximum response size is strictly capped per API generation call. |

#### Why can sketches truncate around 600 lines?
To guarantee complete code integrity, p5.js Vibe Coder instructs Gemini to always output the **entire, self-contained, immediately runnable sketch**. As a sketch grows beyond 500 to 600 lines (including complex math, comments, and nested brackets), the generated output can hit the strict **8,192 token limit**, causing the Google API to terminate generation mid-stream (`finishReason: "MAX_TOKENS"`).

#### Built-in Truncation Safeguards:
1. **Truncation Detection**: The extension monitors the Gemini response payload for `finishReason === 'MAX_TOKENS'`.
2. **Auto-Start Protection**: Incomplete code is prevented from running automatically to keep the p5 canvas from crashing.
3. **Fence Sanitization**: Cleans up unclosed markdown code fences (````) so broken markup does not corrupt the CodeMirror editor.
4. **Instant Rollback**: Displays a prominent warning toast prompting you to use `↩ Undo` to restore your last working code version.
5. **Token Efficiency Instructions**: System prompts explicitly instruct the AI to write clean, concise, token-efficient code without redundant comments when dealing with large sketches.

#### 💡 Best Practices for Large Projects (>500 lines):
- **Refactoring Prompts**: Ask Gemini: *"Refactor redundant logic into compact helper functions and keep code concise."*
- **Modular Sketch Files**: In the p5.js Web Editor, click the arrow next to **Sketch Files** in the left sidebar to add separate JavaScript files (e.g., `Particle.js`, `Physics.js`, `Constants.js`). This keeps `sketch.js` slim and well below the 8,192 token ceiling.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>Enter</kbd> / <kbd>Cmd</kbd> + <kbd>Enter</kbd> | Submit prompt & generate p5.js code |
| <kbd>↑</kbd> / <kbd>↓</kbd> (in empty prompt box) | Navigate previous prompt history |
| <kbd>Alt</kbd> + <kbd>V</kbd> | Toggle / minimize floating HUD panel |

---

## 🛠️ Installation Guide

### ⚡ 1-Click Install via Chrome Web Store (Recommended)

Install the extension directly with a single click from the official **Google Chrome Web Store** (compatible with Google Chrome, Brave, Microsoft Edge, Opera, Vivaldi, and Arc):

👉 **[Install p5.js Vibe Coder from Chrome Web Store ↗](https://chromewebstore.google.com/detail/hepphlodjiibdknhgndjaephkccjigbo)**

---

### 💻 Manual Installation from Source (Developer Mode)

The extension is fully open-source and built on the cross-browser Manifest V3 standard. It is natively compatible with both **Chromium-based browsers** and **Mozilla Firefox**.

#### 1. Clone or Download
```bash
git clone https://github.com/diy-ecg/p5js-vibecoder.git
```
*(Or click **Code → Download ZIP** on GitHub and extract the folder).*

---

### 🌐 Chromium Browsers (Google Chrome, Brave, Microsoft Edge, Opera, Arc)
1. Open your browser's extensions manager:
   - **Google Chrome**: `chrome://extensions`
   - **Brave**: `brave://extensions`
   - **Microsoft Edge**: `edge://extensions`
   - **Opera / Opera GX**: `opera://extensions`
2. Enable the **"Developer mode"** toggle (top right or left sidebar).
3. Click **"Load unpacked"** (or *Entpackte Erweiterung laden*).
4. Select the downloaded/cloned **`p5js-vibecoder`** directory.
5. The extension is installed and ready to go! 🎉

---

### 🦊 Mozilla Firefox
1. Open Firefox and navigate to:
   ```text
   about:debugging#/runtime/this-firefox
   ```
2. Click **"Load Temporary Add-on..."**.
3. Select the **`manifest.json`** file inside the **`p5js-vibecoder`** directory.
4. The extension is installed and ready to go! 🎉

---

## 🔑 Setting Up Your Gemini API Key

1. Get a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Open the p5.js Web Editor: [editor.p5js.org](https://editor.p5js.org/).
3. In the p5.js Vibe Coder HUD, click the **Gear icon (⚙)** in the top right.
4. Paste your API key. The key is stored locally in your browser's private extension storage and is never sent to third-party servers.
5. Click **"🔄 Refresh Models"** to verify your key and populate the available Gemini models.

---

## 📁 Repository Structure

```text
p5js-vibecoder/
├── manifest.json         # Universal WebExtension manifest (Manifest V3 for Chromium & Firefox)
├── background.js         # Service Worker (Chromium) / Event Page (Firefox) & Gemini API bridge
├── content/
│   ├── content.js        # Floating HUD logic, i18n, event handlers & API client
│   ├── content.css       # Ergonomic dark theme, animations & responsive styling
│   └── page-bridge.js    # Unsandboxed page bridge for CodeMirror & React 18
├── popup/
│   ├── popup.html        # Toolbar popup for settings, key management & language
│   ├── popup.css         # Styling for the toolbar popup
│   └── popup.js          # Synchronized configuration controller
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
├── ARCHITECTURE.md       # Complete software architecture & developer guide (German)
├── PRIVACY.md            # Privacy policy & data protection declaration
├── LICENSE               # MIT License
└── README.md             # Project documentation
```

---

## 🛠️ Developer Documentation

For an in-depth code walkthrough, architecture diagrams, module breakdown, and step-by-step modification guides (how to add models, adjust prompts, or customize UI), see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## 🔒 Privacy & Data Protection

p5.js Vibe Coder does **not track**, collect telemetry, or store user prompts on any remote server. Direct API calls are made exclusively between your browser and the Google Gemini API using your personal API key. For full details, see our [Privacy Policy](PRIVACY.md).

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).  
Contributions, ideas, bug reports, and pull requests are warmly welcomed!
