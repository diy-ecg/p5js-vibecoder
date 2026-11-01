# ⚡ p5.js Vibe Coder (Browser Extension)

[![GitHub](https://img.shields.io/badge/GitHub-diy--ecg%2Fp5js--vibecoder-181717?logo=github)](https://github.com/diy-ecg/p5js-vibecoder)
[![Browsers](https://img.shields.io/badge/Browsers-Firefox%20%7C%20Chrome%20%7C%20Brave%20%7C%20Edge-success?logo=googlechrome)](https://editor.p5js.org/)
[![Manifest V3](https://img.shields.io/badge/Platform-WebExtension%20(MV3)-blue)](#-installation-guide)
[![Google Gemini](https://img.shields.io/badge/AI-Google%20Gemini%20API-4285F4?logo=google)](https://aistudio.google.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Bilingual](https://img.shields.io/badge/Language-English%20%7C%20Deutsch-blue)](#-bilingual-support-en--de)

A cross-browser extension for **vibe coding** directly inside the official [p5.js Web Editor](https://editor.p5js.org/). Works seamlessly in **Mozilla Firefox**, **Google Chrome**, **Brave**, **Microsoft Edge**, and other Chromium-based browsers.

Simply type what you want to visualize, build, or modify in natural language. Powered by **Google Gemini**, the extension generates production-ready p5.js code in seconds, injects it straight into your CodeMirror editor, and automatically runs your sketch!

---

## 🚀 Highlights & Features

### 💬 Multi-Turn Conversational Memory & Context
- **Zero-Friction Context Switching**: Automatically detects whether you are starting fresh on a blank canvas or iterating on an existing sketch.
- **True Multi-Turn Dialog**: Gemini remembers prior iteration turns (*"Make it neon green"*, *"Slow down the particle flow"*, *"Add a bounce effect when the user clicks"*).
- **New Chat Reset (`×`)**: Clear conversational memory with a single click to start a new sketch with a clean context.
- **Auto-Clearing Prompt Box**: The prompt field automatically clears after generation so you can immediately type your next instruction without having to delete old text.

### ▶️ Instant Auto-Play with React & Fiber Bridge
- **Immediate Visual Feedback**: The generated sketch automatically starts running in the preview window as soon as generation completes — no need to manually click the Play button.
- **On/Off Toggle**: A dedicated switch in the HUD header lets you disable or enable Auto-Play at any time (defaults to **ON**).
- **Bulletproof Execution**: Leverages a multi-stage execution bridge (React 18 Fiber dispatch, synthetic PointerEvents, and keyboard shortcuts) that reliably triggers execution across Firefox sandbox boundaries.

### ↩ 1-Click Undo
- Restore your previous code version with a single click on the `↩ Undo` button.
- Simultaneously rolls back conversational history by one turn, ensuring your AI dialog stays synchronized with your editor state.

### 🕒 Local Prompt History
- Automatically records your last 50 prompts in local browser storage (`browser.storage.local`).
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
- Automatically remembers its screen position and minimize state across browser reloads.

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
2. **Auto-Play Protection**: Incomplete code is prevented from running automatically to keep the p5 canvas from crashing.
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

The extension is open-source and built on Manifest V3. Thanks to its universal cross-browser architecture, it runs without modifications in **Firefox** and any **Chromium-based browser**:

### 🦊 Mozilla Firefox
1. Clone the repository or download it as a ZIP:
   ```bash
   git clone https://github.com/diy-ecg/p5js-vibecoder.git
   ```
2. In Firefox, open a new tab and navigate to:
   ```text
   about:debugging#/runtime/this-firefox
   ```
3. Click **"Load Temporary Add-on..."**.
4. In the file picker, select the **`manifest.json`** file inside the project directory.

---

### 🌐 Google Chrome, Brave, Microsoft Edge & Opera
1. Clone the repository or download it as a ZIP (if not already done).
2. Open your browser's extension management page:
   - **Chrome**: `chrome://extensions`
   - **Brave**: `brave://extensions`
   - **Edge**: `edge://extensions`
   - **Opera**: `opera://extensions`
3. Enable the **"Developer mode"** toggle (usually in the top right or sidebar).
4. Click **"Load unpacked"** (or *Entpackte Erweiterung laden*).
5. Select the cloned **`p5js-vibecoder`** root folder.
6. The extension is immediately loaded and active! 🎉

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
├── manifest.json         # WebExtension configuration (Manifest V3)
├── background.js         # Service worker & Gemini API communication bridge
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
├── LICENSE               # MIT License
└── README.md             # Project documentation
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).  
Contributions, ideas, bug reports, and pull requests are warmly welcomed!
