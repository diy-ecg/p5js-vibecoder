/**
 * p5.js Vibe Coder - Content Script
 * Manages the floating UI panel, interactions, and bridge communication.
 */

(() => {
  if (window.__p5VibeContentInjected) return;
  window.__p5VibeContentInjected = true;

  // State
  let config = {
    apiKey: '',
    model: 'gemini-3.8-flash',
    isMinimized: false,
    availableModels: []
  };
  let codeHistory = [];
  let promptHistory = [];
  let isGenerating = false;
  let activeMode = 'edit'; // 'edit' or 'create'
  let pendingRequests = new Map();

  // 1. Inject Page Bridge
  function injectBridge() {
    try {
      const script = document.createElement('script');
      script.src = browser.runtime.getURL('content/page-bridge.js');
      script.onload = () => script.remove();
      (document.head || document.documentElement).appendChild(script);
    } catch (e) {
      console.warn('[p5-vibe] Bridge script injection note:', e);
    }
  }

  // 2. Direct Gemini API Request with ModelService.ListModels Discovery & Exponential Backoff
  function cleanGeneratedCode(rawText) {
    if (!rawText) return '';
    let text = rawText.trim();
    const codeBlockRegex = /^```(?:javascript|js|p5|p5js)?\s*\n([\s\S]*?)\n```$/i;
    const match = text.match(codeBlockRegex);
    if (match) return match[1].trim();

    const firstFence = text.indexOf('```');
    if (firstFence !== -1) {
      const afterFirst = text.slice(firstFence);
      const lineEnd = afterFirst.indexOf('\n');
      if (lineEnd !== -1) {
        const closingFence = afterFirst.slice(lineEnd + 1).indexOf('```');
        if (closingFence !== -1) {
          return afterFirst.slice(lineEnd + 1, lineEnd + 1 + closingFence).trim();
        }
      }
    }
    return text;
  }

  /**
   * Fetch verified models directly from Google Gemini ModelService for this API key
   */
  async function fetchAvailableModels(apiKey) {
    if (!apiKey || !apiKey.trim()) return [];
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey.trim())}`;
      const response = await fetch(endpoint);
      if (!response.ok) return [];
      const data = await response.json();
      if (!data.models || !Array.isArray(data.models)) return [];

      const available = data.models
        .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
        .map(m => {
          const id = m.name.replace(/^models\//, '');
          return {
            id: id,
            displayName: m.displayName || id
          };
        });

      // Sort models: flash first, then pro, then others
      available.sort((a, b) => {
        const aFlash = a.id.includes('flash');
        const bFlash = b.id.includes('flash');
        if (aFlash && !bFlash) return -1;
        if (!aFlash && bFlash) return 1;
        return a.id.localeCompare(b.id);
      });

      return available;
    } catch (err) {
      console.warn('[p5-vibe] Error fetching models from Google:', err);
      return [];
    }
  }

  async function callSingleGeminiModel({ prompt, currentCode, mode, apiKey, model }) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

    let userInstruction = '';
    if (mode === 'create' || !currentCode || currentCode.trim().length === 0) {
      userInstruction = `Erstelle einen neuen, vollständigen p5.js Sketch basierend auf folgender Idee:\n\n"${prompt}"\n\nGib den vollständigen JavaScript-Code zurück.`;
    } else {
      userInstruction = `Hier ist der aktuelle p5.js Sketch:\n\`\`\`javascript\n${currentCode}\n\`\`\`\n\nÄndere oder erweitere den Sketch basierend auf folgendem Wunsch:\n"${prompt}"\n\nGib den vollständigen, überarbeiteten JavaScript-Code zurück, der alle Funktionen enthält (setup, draw etc.).`;
    }

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: userInstruction }] }],
      systemInstruction: {
        parts: [{
          text: `Du bist ein brillanter Creative Coder und p5.js Spezialist.
Deine Aufgabe ist es, hochwertigen, ästhetischen und fehlerfreien p5.js Code (JavaScript) für den p5.js Web-Editor zu generieren.

REGELN:
1. Gib AUSSCHLIESSLICH den ausführbaren JavaScript-Code für den p5.js Webeditor zurück.
2. Keine Erklärungen vor oder nach dem Code, kein Begleittext, keine Höflichkeitsfloskeln.
3. Der Code MUSS standardmäßige p5.js Methoden enthalten wie setup() und draw() (sofern animiert/interaktiv).
4. Sorge für flüssige 60 FPS Performance und saubere Canvas-Initialisierung (z.B. createCanvas(400, 400) oder windowWidth/windowHeight falls passend).
5. Nutze schöne Farben, clevere mathematische Formeln (sin, cos, noise, lerp) oder interaktive Elemente (mouseX, mouseY, Tasten), wenn es zum Prompt passt.`
        }]
      },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192
      }
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    if (!response.ok) {
      const errorMsg = data?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      return {
        success: false,
        error: errorMsg,
        status: response.status
      };
    }

    const candidate = data.candidates?.[0];
    if (!candidate || !candidate.content?.parts?.[0]?.text) {
      return { success: false, error: 'Keine Antwort von Gemini erhalten.' };
    }

    return {
      success: true,
      code: cleanGeneratedCode(candidate.content.parts[0].text)
    };
  }

  async function requestGeminiApi({ prompt, currentCode, mode, apiKey, model, onStatusUpdate }) {
    // 1. Ensure verified models are loaded
    let verified = config.availableModels;
    if (!verified || verified.length === 0) {
      verified = await fetchAvailableModels(apiKey);
      if (verified && verified.length > 0) {
        config.availableModels = verified;
      }
    }

    // 2. Build model queue: preferred model first, then verified models
    let queue = [];
    const base = model || 'gemini-3.8-flash';
    queue.push(base);

    if (verified && verified.length > 0) {
      for (const m of verified) {
        if (!queue.includes(m.id)) {
          queue.push(m.id);
        }
      }
    }

    let lastError = null;

    for (let modelIdx = 0; modelIdx < queue.length; modelIdx++) {
      const currentModel = queue[modelIdx];

      if (modelIdx > 0 && typeof onStatusUpdate === 'function') {
        onStatusUpdate(`Wechsle zu Alternativ-Modell ${currentModel}...`);
      }

      // Try current model with exponential backoff for high demand (up to 3 attempts)
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const res = await callSingleGeminiModel({
            prompt,
            currentCode,
            mode,
            apiKey,
            model: currentModel
          });

          if (res.success) {
            return {
              success: true,
              code: res.code,
              modelUsed: currentModel
            };
          }

          const errMsg = (res.error || '').toLowerCase();
          lastError = res.error;

          // If invalid key, stop immediately
          if (errMsg.includes('api key') && !errMsg.includes('quota')) {
            return {
              success: false,
              error: 'Ungültiger Gemini API-Key. Bitte überprüfe deinen Key in den Einstellungen.'
            };
          }

          // If 404 / not found, do not retry this model, skip to next
          if (res.status === 404 || errMsg.includes('not found')) {
            break;
          }

          // If high demand / 503 / 429
          const isOverloaded = errMsg.includes('high demand') ||
                               errMsg.includes('spikes in demand') ||
                               errMsg.includes('temporarily') ||
                               errMsg.includes('overloaded') ||
                               errMsg.includes('503') ||
                               errMsg.includes('429') ||
                               errMsg.includes('resource exhausted');

          if (isOverloaded) {
            if (attempt < maxAttempts) {
              const waitSec = attempt * 1.5;
              if (typeof onStatusUpdate === 'function') {
                onStatusUpdate(`⏳ Lastspitze bei ${currentModel} – automatischer Versuch in ${waitSec}s (${attempt}/${maxAttempts})...`);
              }
              await new Promise(r => setTimeout(r, waitSec * 1000));
              continue; // Retry same model
            } else {
              // Exceeded attempts on this model, try next model in queue
              break;
            }
          } else {
            // Other error
            break;
          }
        } catch (err) {
          lastError = err.message;
          break;
        }
      }
    }

    return {
      success: false,
      error: lastError || 'Gemini API ist momentan nicht erreichbar. Bitte versuche es kurz erneut.'
    };
  }

  // 3. Bridge Communication (Promise-based)
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'p5-vibe-bridge') {
      return;
    }
    const { requestId, code, success } = event.data;
    if (requestId && pendingRequests.has(requestId)) {
      const { resolve } = pendingRequests.get(requestId);
      pendingRequests.delete(requestId);
      resolve({ success, code });
    }
  });

  function sendBridgeAction(action, payload = {}) {
    return new Promise((resolve) => {
      const requestId = 'req_' + Math.random().toString(36).substring(2, 9);
      
      // Timeout fallback in case bridge isn't active or page is loading
      const timeoutId = setTimeout(() => {
        if (pendingRequests.has(requestId)) {
          pendingRequests.delete(requestId);
          // Fallback to Firefox wrappedJSObject
          const fallbackResult = handleWrappedJSObjectFallback(action, payload.code);
          resolve(fallbackResult);
        }
      }, 500);

      pendingRequests.set(requestId, {
        resolve: (result) => {
          clearTimeout(timeoutId);
          resolve(result);
        }
      });

      window.postMessage({
        target: 'p5-vibe-bridge',
        requestId,
        action,
        ...payload
      }, '*');
    });
  }

  /**
   * Helper: Locate CodeMirror 6 EditorView on DOM elements or wrappedJSObject (Firefox)
   */
  function findCM6View() {
    const targets = [
      document.querySelector('.cm-content'),
      document.querySelector('.cm-editor .cm-content'),
      document.querySelector('.cm-editor'),
      document.querySelector('.cm-scroller')
    ].filter(Boolean);

    for (const el of targets) {
      const candidates = [
        el.cmView?.view,
        el.cmTile?.view,
        el.editorView,
        el.view,
        el.wrappedJSObject?.cmView?.view,
        el.wrappedJSObject?.cmTile?.view,
        el.wrappedJSObject?.editorView,
        el.wrappedJSObject?.view
      ];
      for (const v of candidates) {
        if (v && typeof v.dispatch === 'function' && v.state?.doc) {
          return v;
        }
      }

      // Check all properties for dispatch
      for (const target of [el, el.wrappedJSObject]) {
        if (!target) continue;
        try {
          for (const key of Object.getOwnPropertyNames(target)) {
            const val = target[key];
            if (val && typeof val === 'object') {
              if (typeof val.dispatch === 'function' && val.state?.doc) return val;
              if (val.view && typeof val.view.dispatch === 'function' && val.view.state?.doc) return val.view;
            }
          }
        } catch (e) {}
      }
    }
    return null;
  }

  /**
   * Read the active code from the p5.js editor
   */
  async function getEditorCode() {
    // 1. Try CodeMirror 6 View
    const view = findCM6View();
    if (view && view.state?.doc) {
      try {
        return view.state.doc.toString();
      } catch (e) {}
    }

    // 2. Try CodeMirror 6 Content DOM node text
    const cmContent = document.querySelector('.cm-content') || document.querySelector('.cm-editor .cm-content');
    if (cmContent && cmContent.innerText && cmContent.innerText.trim().length > 0) {
      return cmContent.innerText;
    }

    // 3. Try CodeMirror 5
    const cm5El = document.querySelector('.CodeMirror');
    if (cm5El) {
      const cm = cm5El.CodeMirror || cm5El.wrappedJSObject?.CodeMirror;
      if (cm && typeof cm.getValue === 'function') {
        try {
          return cm.getValue();
        } catch (e) {}
      }
    }

    // 4. Try Textarea
    const textarea = document.querySelector('textarea.editor, .editor textarea, textarea');
    if (textarea && textarea.value) {
      return textarea.value;
    }

    // 5. Try bridge message
    try {
      const res = await sendBridgeAction('GET_CODE');
      if (res && res.success && res.code) return res.code;
    } catch (e) {}

    return '';
  }

  /**
   * Set new code into the p5.js editor
   */
  async function setEditorCode(newCode) {
    if (!newCode) return false;

    // 1. Try CodeMirror 6 View Transaction (Official CM6 API)
    const view = findCM6View();
    if (view && typeof view.dispatch === 'function' && view.state?.doc) {
      try {
        const docLength = view.state.doc.length;
        view.dispatch({
          changes: { from: 0, to: docLength, insert: newCode }
        });
        if (typeof view.focus === 'function') view.focus();
        return true;
      } catch (err) {
        console.warn('[p5-vibe] view.dispatch failed:', err);
      }
    }

    // 2. Try CodeMirror 5 (.CodeMirror)
    const cm5El = document.querySelector('.CodeMirror');
    if (cm5El) {
      const cm = cm5El.CodeMirror || cm5El.wrappedJSObject?.CodeMirror;
      if (cm && typeof cm.setValue === 'function') {
        try {
          cm.setValue(newCode);
          if (typeof cm.focus === 'function') cm.focus();
          return true;
        } catch (err) {
          console.warn('[p5-vibe] cm.setValue failed:', err);
        }
      }
    }

    // 3. Try CodeMirror 6 contenteditable DOM injection via Selection + execCommand / Paste
    const cmContent = document.querySelector('.cm-content') || document.querySelector('.cm-editor .cm-content');
    if (cmContent) {
      try {
        cmContent.focus();

        // Select all text
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(cmContent);
        selection.removeAllRanges();
        selection.addRange(range);

        // Execute execCommand insertText
        document.execCommand('selectAll', false, null);
        const execSuccess = document.execCommand('insertText', false, newCode);

        // Try Paste event as backup
        if (!execSuccess || !cmContent.textContent.includes('function')) {
          try {
            const dt = new DataTransfer();
            dt.setData('text/plain', newCode);
            const pasteEvent = new ClipboardEvent('paste', {
              bubbles: true,
              cancelable: true,
              clipboardData: dt
            });
            cmContent.dispatchEvent(pasteEvent);
          } catch (e) {}
        }

        // Return true if injected
        return true;
      } catch (err) {
        console.warn('[p5-vibe] contenteditable injection failed:', err);
      }
    }

    // 4. Try Page Bridge
    try {
      const bridgeRes = await sendBridgeAction('SET_CODE', { code: newCode });
      if (bridgeRes && bridgeRes.success) return true;
    } catch (e) {}

    // 5. Try Textarea fallback
    const textarea = document.querySelector('textarea.editor, .editor textarea, textarea');
    if (textarea && textarea.offsetParent !== null) {
      textarea.value = newCode;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    return false;
  }

  // 3. UI Construction
  function createUI() {
    // Floating Pill (when minimized)
    const pill = document.createElement('div');
    pill.id = 'p5-vibe-pill';
    pill.innerHTML = `<span>⚡</span> <span>Vibe Coder</span>`;
    pill.title = 'Klicken zum Öffnen des p5 Vibe Coder Panels';
    document.body.appendChild(pill);

    // Floating Main Panel
    const panel = document.createElement('div');
    panel.id = 'p5-vibe-panel';
    panel.innerHTML = `
      <div class="p5-vibe-header" id="p5-vibe-drag-header">
        <div class="p5-vibe-title-group">
          <div class="p5-vibe-badge-logo">⚡</div>
          <span class="p5-vibe-title">p5 Vibe Coder</span>
          <span class="p5-vibe-model-tag" id="p5-vibe-model-label">Gemini 3.8</span>
        </div>
        <div class="p5-vibe-actions">
          <button class="p5-vibe-icon-btn" id="p5-vibe-btn-settings" title="Einstellungen (API-Key)">⚙</button>
          <button class="p5-vibe-icon-btn" id="p5-vibe-btn-minimize" title="Minimieren">−</button>
          <button class="p5-vibe-icon-btn" id="p5-vibe-btn-close" title="Schließen">×</button>
        </div>
      </div>

      <div class="p5-vibe-body">
        <!-- Settings Drawer -->
        <div class="p5-vibe-settings" id="p5-vibe-settings-drawer">
          <div class="p5-vibe-field">
            <label for="p5-vibe-key-input">Gemini API Key</label>
            <div class="p5-vibe-input-wrapper">
              <input type="password" id="p5-vibe-key-input" class="p5-vibe-input" placeholder="AIzaSy..." spellcheck="false" autocomplete="off" />
              <button type="button" class="p5-vibe-input-toggle" id="p5-vibe-toggle-key" title="Passwort anzeigen">👁</button>
            </div>
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" class="p5-vibe-settings-link">
              Kostenlosen Key bei Google AI Studio holen ↗
            </a>
          </div>

          <div class="p5-vibe-field">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
              <label for="p5-vibe-model-select">Gemini Modell</label>
              <button type="button" class="p5-vibe-btn-refresh-models" id="p5-vibe-btn-refresh-models" title="Verfügbare Modelle für diesen Key prüfen">🔄 Modelle prüfen</button>
            </div>
            <select id="p5-vibe-model-select" class="p5-vibe-select">
              <option value="gemini-3.8-flash">Gemini 3.8 Flash</option>
              <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
            </select>
            <span id="p5-vibe-model-info" style="font-size: 10px; color: var(--p5-vibe-text-muted); margin-top: 2px;"></span>
          </div>
        </div>

        <!-- Mode Switcher -->
        <div class="p5-vibe-mode-switch">
          <button class="p5-vibe-mode-btn active" id="p5-vibe-mode-edit" data-mode="edit">✨ Sketch anpassen</button>
          <button class="p5-vibe-mode-btn" id="p5-vibe-mode-create" data-mode="create">🆕 Neuer Sketch</button>
        </div>

        <!-- Inspiration Chips -->
        <div class="p5-vibe-chips">
          <button class="p5-vibe-chip" data-prompt="Ein interaktiver 3D-Sternenhimmel mit WEBGL, bei dem die Sterne auf Mausbewegung reagieren">🌌 Sternenhimmel</button>
          <button class="p5-vibe-chip" data-prompt="Organische, pulsierende Perlin-Noise Wellen mit fließenden Regenbogen-Farbverläufen">🌊 Noise Wellen</button>
          <button class="p5-vibe-chip" data-prompt="50 bunte neonfarbene Bälle, die von den Wänden abprallen und Schwerkraft haben">🕹️ Bouncing Balls</button>
          <button class="p5-vibe-chip" data-prompt="Ein leuchtendes Partikelsystem, das einen Schweif hinter dem Mauszeiger herzieht">✨ Maus-Partikel</button>
        </div>

        <!-- Prompt Header with History Button -->
        <div class="p5-vibe-prompt-header">
          <label for="p5-vibe-prompt-text" class="p5-vibe-prompt-label">Dein Prompt</label>
          <button type="button" class="p5-vibe-btn-history" id="p5-vibe-btn-history" title="Verlauf bisheriger Prompts einsehen">
            🕒 Verlauf (<span id="p5-vibe-history-count">0</span>)
          </button>
        </div>

        <!-- History Popover / Drawer -->
        <div class="p5-vibe-history-drawer" id="p5-vibe-history-drawer">
          <div class="p5-vibe-history-header">
            <span>Bisherige Prompts</span>
            <button type="button" class="p5-vibe-btn-clear-history" id="p5-vibe-btn-clear-history">Leeren</button>
          </div>
          <div class="p5-vibe-history-list" id="p5-vibe-history-list"></div>
        </div>

        <!-- Prompt Input -->
        <div class="p5-vibe-prompt-area">
          <textarea 
            id="p5-vibe-prompt-text" 
            class="p5-vibe-textarea" 
            placeholder="Was möchtest du vibecoden? (z.B. Mach die Kreise größer und füge Musikreaktion oder Farbwechsel hinzu...)"
            rows="3"
          ></textarea>
        </div>

        <!-- Action Buttons -->
        <div class="p5-vibe-footer-actions">
          <button class="p5-vibe-btn-primary" id="p5-vibe-btn-generate">
            <span id="p5-vibe-gen-icon">⚡</span>
            <span id="p5-vibe-gen-text">Vibe Code</span>
          </button>
          <button class="p5-vibe-btn-secondary" id="p5-vibe-btn-undo" title="Letzte Änderung rückgängig machen" disabled>
            ↩ Undo
          </button>
        </div>

        <!-- Status / Feedback -->
        <div class="p5-vibe-status" id="p5-vibe-status-msg">
          Bereit. Gib eine Idee ein und klicke auf Vibe Code!
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    setupEvents(panel, pill);
    loadSavedSettings();
  }

  // 4. Setup Event Listeners
  function setupEvents(panel, pill) {
    const dragHeader = panel.querySelector('#p5-vibe-drag-header');
    const btnSettings = panel.querySelector('#p5-vibe-btn-settings');
    const settingsDrawer = panel.querySelector('#p5-vibe-settings-drawer');
    const keyInput = panel.querySelector('#p5-vibe-key-input');
    const toggleKeyBtn = panel.querySelector('#p5-vibe-toggle-key');
    const modelSelect = panel.querySelector('#p5-vibe-model-select');
    const modelLabel = panel.querySelector('#p5-vibe-model-label');
    const btnMinimize = panel.querySelector('#p5-vibe-btn-minimize');
    const btnClose = panel.querySelector('#p5-vibe-btn-close');
    const modeEditBtn = panel.querySelector('#p5-vibe-mode-edit');
    const modeCreateBtn = panel.querySelector('#p5-vibe-mode-create');
    const promptText = panel.querySelector('#p5-vibe-prompt-text');
    const btnGenerate = panel.querySelector('#p5-vibe-btn-generate');
    const btnUndo = panel.querySelector('#p5-vibe-btn-undo');
    const statusMsg = panel.querySelector('#p5-vibe-status-msg');
    const chips = panel.querySelectorAll('.p5-vibe-chip');

    // Dragging Logic
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    dragHeader.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return; // Don't drag when clicking header buttons
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      const rect = panel.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      panel.style.right = 'auto'; // Switch to absolute left/top
      panel.style.left = `${initialLeft}px`;
      panel.style.top = `${initialTop}px`;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    });

    function onMouseMove(e) {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;

      let newLeft = Math.max(10, Math.min(window.innerWidth - panel.offsetWidth - 10, initialLeft + dx));
      let newTop = Math.max(10, Math.min(window.innerHeight - 80, initialTop + dy));

      panel.style.left = `${newLeft}px`;
      panel.style.top = `${newTop}px`;
    }

    function onMouseUp() {
      if (!isDragging) return;
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      // Save position
      browser.storage.local.set({
        p5VibePosition: {
          left: panel.style.left,
          top: panel.style.top
        }
      });
    }

    // Settings Toggle
    btnSettings.addEventListener('click', () => {
      const isOpen = settingsDrawer.classList.toggle('open');
      btnSettings.classList.toggle('active', isOpen);
    });

    // Toggle API Key visibility
    toggleKeyBtn.addEventListener('click', () => {
      if (keyInput.type === 'password') {
        keyInput.type = 'text';
        toggleKeyBtn.textContent = '🔒';
      } else {
        keyInput.type = 'password';
        toggleKeyBtn.textContent = '👁';
      }
    });

    const btnRefreshModels = panel.querySelector('#p5-vibe-btn-refresh-models');
    const modelInfo = panel.querySelector('#p5-vibe-model-info');

    async function refreshModelList(showFeedback = true) {
      if (!config.apiKey) {
        if (showFeedback && modelInfo) modelInfo.textContent = 'Trage zuerst einen API-Key ein.';
        return;
      }
      if (showFeedback && modelInfo) modelInfo.textContent = 'Prüfe Modelle bei Google...';
      const models = await fetchAvailableModels(config.apiKey);
      if (models && models.length > 0) {
        config.availableModels = models;
        updateDropdown(models);
        if (modelInfo) modelInfo.textContent = `✓ ${models.length} Modelle für deinen Key aktiv`;
      } else {
        if (showFeedback && modelInfo) modelInfo.textContent = 'Konnte keine Modelle abrufen (Key prüfen).';
      }
    }

    function updateDropdown(models) {
      if (!modelSelect || !models || models.length === 0) return;
      const currentSelected = config.model;
      modelSelect.innerHTML = '';
      for (const m of models) {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.displayName !== m.id ? `${m.displayName} (${m.id})` : m.id;
        if (m.id === currentSelected) {
          opt.selected = true;
        }
        modelSelect.appendChild(opt);
      }
      if (!modelSelect.value) {
        modelSelect.value = models[0].id;
        config.model = models[0].id;
      }
      updateModelBadge();
      saveSettings();
    }

    if (btnRefreshModels) {
      btnRefreshModels.addEventListener('click', () => refreshModelList(true));
    }

    // Auto-save API Key and Model
    keyInput.addEventListener('change', () => {
      config.apiKey = keyInput.value.trim();
      saveSettings();
      if (config.apiKey) {
        refreshModelList(false);
      }
    });

    modelSelect.addEventListener('change', () => {
      config.model = modelSelect.value;
      updateModelBadge();
      saveSettings();
    });

    function updateModelBadge() {
      if (config.model.includes('3.8-pro')) {
        modelLabel.textContent = 'Gemini 3.8 Pro';
      } else if (config.model.includes('3.8-flash')) {
        modelLabel.textContent = 'Gemini 3.8 Flash';
      } else if (config.model.includes('2.0')) {
        modelLabel.textContent = 'Gemini 2.0 Flash';
      } else if (config.model.includes('1.5')) {
        modelLabel.textContent = 'Gemini 1.5 Flash';
      } else {
        modelLabel.textContent = 'Gemini';
      }
    }

    function saveSettings() {
      browser.storage.local.set({
        geminiApiKey: config.apiKey,
        geminiModel: config.model
      });
    }

    // Minimize / Expand
    function minimizePanel() {
      panel.classList.add('p5-vibe-hidden');
      pill.classList.add('visible');
      browser.storage.local.set({ p5VibeMinimized: true });
    }

    function expandPanel() {
      panel.classList.remove('p5-vibe-hidden');
      pill.classList.remove('visible');
      promptText.focus();
      browser.storage.local.set({ p5VibeMinimized: false });
    }

    btnMinimize.addEventListener('click', minimizePanel);
    btnClose.addEventListener('click', minimizePanel);
    pill.addEventListener('click', expandPanel);

    // Mode Switcher
    modeEditBtn.addEventListener('click', () => {
      activeMode = 'edit';
      modeEditBtn.classList.add('active');
      modeCreateBtn.classList.remove('active');
      promptText.placeholder = 'Was möchtest du am bestehenden Sketch ändern oder hinzufügen?';
    });

    modeCreateBtn.addEventListener('click', () => {
      activeMode = 'create';
      modeCreateBtn.classList.add('active');
      modeEditBtn.classList.remove('active');
      promptText.placeholder = 'Beschreibe eine völlig neue Idee für einen Sketch...';
    });

    // Quick Inspiration Chips
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.getAttribute('data-prompt');
        promptText.value = text;
        promptText.focus();
      });
    });

    // Prompt History UI & Navigation
    const btnHistory = panel.querySelector('#p5-vibe-btn-history');
    const historyDrawer = panel.querySelector('#p5-vibe-history-drawer');
    const historyList = panel.querySelector('#p5-vibe-history-list');
    const historyCount = panel.querySelector('#p5-vibe-history-count');
    const btnClearHistory = panel.querySelector('#p5-vibe-btn-clear-history');

    let historyNavIndex = -1;
    let draftPrompt = '';

    function renderHistoryList() {
      if (historyCount) historyCount.textContent = promptHistory.length;
      if (!historyList) return;
      historyList.innerHTML = '';
      if (promptHistory.length === 0) {
        historyList.innerHTML = '<div class="p5-vibe-history-empty">Noch keine Prompts gespeichert</div>';
        return;
      }
      promptHistory.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'p5-vibe-history-item';
        div.textContent = item;
        div.title = `Klicken zum Übernehmen:\n"${item}"`;
        div.addEventListener('click', () => {
          promptText.value = item;
          promptText.focus();
          historyDrawer.classList.remove('open');
          btnHistory.classList.remove('active');
          historyNavIndex = idx;
        });
        historyList.appendChild(div);
      });
    }

    btnHistory.addEventListener('click', () => {
      const isOpen = historyDrawer.classList.toggle('open');
      btnHistory.classList.toggle('active', isOpen);
      if (isOpen) {
        renderHistoryList();
      }
    });

    btnClearHistory.addEventListener('click', () => {
      promptHistory = [];
      browser.storage.local.set({ p5VibePromptHistory: [] });
      renderHistoryList();
    });

    function savePromptToHistory(prompt) {
      if (!prompt || !prompt.trim()) return;
      const clean = prompt.trim();
      promptHistory = promptHistory.filter(p => p !== clean);
      promptHistory.unshift(clean);
      if (promptHistory.length > 50) promptHistory.pop();
      browser.storage.local.set({ p5VibePromptHistory: promptHistory });
      renderHistoryList();
      historyNavIndex = -1;
      draftPrompt = '';
    }

    // Keyboard shortcut in textarea: Ctrl+Enter / Cmd+Enter to generate, ArrowUp/ArrowDown for history
    promptText.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        triggerGenerate();
        return;
      }

      // Terminal-style history browsing
      if (e.key === 'ArrowUp' && (promptText.selectionStart === 0 || promptText.value === '')) {
        if (promptHistory.length > 0) {
          if (historyNavIndex === -1) {
            draftPrompt = promptText.value;
          }
          if (historyNavIndex + 1 < promptHistory.length) {
            historyNavIndex++;
            promptText.value = promptHistory[historyNavIndex];
            e.preventDefault();
          }
        }
      } else if (e.key === 'ArrowDown') {
        if (historyNavIndex > 0) {
          historyNavIndex--;
          promptText.value = promptHistory[historyNavIndex];
          e.preventDefault();
        } else if (historyNavIndex === 0) {
          historyNavIndex = -1;
          promptText.value = draftPrompt;
          e.preventDefault();
        }
      }
    });

    // Global toggle shortcut: Alt+V
    window.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        if (panel.classList.contains('p5-vibe-hidden')) {
          expandPanel();
        } else {
          minimizePanel();
        }
      }
    });

    // Undo action
    btnUndo.addEventListener('click', async () => {
      if (codeHistory.length === 0) return;
      const prevCode = codeHistory.pop();
      updateUndoButtonState();
      
      setStatus('Code wird wiederhergestellt...', 'loading');
      const success = await setEditorCode(prevCode);
      if (success) {
        setStatus('↩ Vorheriger Code wiederhergestellt!', 'success');
      } else {
        setStatus('Konnte Code nicht in Editor einfügen.', 'error');
      }
    });

    function updateUndoButtonState() {
      btnUndo.disabled = codeHistory.length === 0;
      btnUndo.title = codeHistory.length > 0 
        ? `Letzte Version wiederherstellen (${codeHistory.length} Versionen im Speicher)`
        : 'Keine vorherige Version vorhanden';
    }

    // Set Status Message Helper
    function setStatus(text, type = 'info') {
      statusMsg.className = `p5-vibe-status ${type}`;
      if (type === 'loading') {
        statusMsg.innerHTML = `<span class="p5-vibe-spinner"></span> ${text}`;
      } else {
        statusMsg.textContent = text;
      }
    }

    // Generate Trigger
    btnGenerate.addEventListener('click', triggerGenerate);

    async function triggerGenerate() {
      if (isGenerating) return;

      const prompt = promptText.value.trim();
      if (!prompt) {
        promptText.focus();
        setStatus('Bitte gib zuerst eine Idee oder Anweisung ein.', 'error');
        return;
      }

      if (!config.apiKey) {
        settingsDrawer.classList.add('open');
        btnSettings.classList.add('active');
        keyInput.focus();
        setStatus('Bitte trage zuerst deinen Gemini API-Key ein.', 'error');
        return;
      }

      savePromptToHistory(prompt);

      isGenerating = true;
      btnGenerate.disabled = true;
      panel.querySelector('#p5-vibe-gen-icon').innerHTML = '<span class="p5-vibe-spinner"></span>';
      panel.querySelector('#p5-vibe-gen-text').textContent = 'Vibing...';
      setStatus(`Gemini denkt nach (${config.model})...`, 'loading');

      try {
        // Read current editor code
        const currentCode = await getEditorCode();

        // 1. Try direct API request from content script (with auto-fallback cascade)
        let response;
        try {
          response = await requestGeminiApi({
            prompt: prompt,
            currentCode: currentCode,
            mode: activeMode,
            apiKey: config.apiKey,
            model: config.model,
            onStatusUpdate: (msg) => setStatus(msg, 'loading')
          });
        } catch (directErr) {
          console.warn('[p5-vibe] Direct fetch fallback to background script:', directErr);
          // 2. Fallback to background script if direct fetch fails
          response = await browser.runtime.sendMessage({
            action: 'GENERATE_CODE',
            prompt: prompt,
            currentCode: currentCode,
            mode: activeMode,
            apiKey: config.apiKey,
            model: config.model
          });
        }

        if (response && response.success && response.code) {
          // Push previous code onto history for undo
          if (currentCode && currentCode.trim().length > 0) {
            codeHistory.push(currentCode);
            if (codeHistory.length > 20) codeHistory.shift();
            updateUndoButtonState();
          }

          // Inject into p5.js editor
          const setSuccess = await setEditorCode(response.code);

          if (setSuccess) {
            const modelNotice = response.modelUsed && response.modelUsed !== config.model 
              ? ` (Fallback auf ${response.modelUsed})` 
              : '';
            setStatus(`✅ Code eingefügt!${modelNotice} Drücke jetzt auf ▶ Play im Webeditor.`, 'success');
          } else {
            try {
              await navigator.clipboard.writeText(response.code);
              setStatus('⚠️ Code generiert & in Zwischenablage kopiert! (Drücke Cmd+V im Editor zum Einfügen)', 'error');
            } catch (clipErr) {
              setStatus('⚠️ Code generiert, konnte aber nicht automatisch eingefügt werden. Editor geöffnet?', 'error');
            }
          }
        } else {
          const errMsg = response?.error || 'Unbekannter Fehler bei der Generierung.';
          setStatus(`⚠️ ${errMsg}`, 'error');
        }
      } catch (err) {
        const msg = err.message || '';
        if (msg.includes('Receiving end does not exist') || msg.includes('Extension context invalidated') || msg.includes('Could not establish connection')) {
          setStatus('⚠️ Das Add-on wurde aktualisiert. Bitte lade diese Seite einmal neu (Cmd+R / F5).', 'error');
        } else {
          setStatus(`⚠️ Fehler: ${msg}`, 'error');
        }
      } finally {
        isGenerating = false;
        btnGenerate.disabled = false;
        panel.querySelector('#p5-vibe-gen-icon').textContent = '⚡';
        panel.querySelector('#p5-vibe-gen-text').textContent = 'Vibe Code';
      }
    }
  }

  // 5. Load Settings from Storage
  function loadSavedSettings() {
    browser.storage.local.get([
      'geminiApiKey',
      'geminiModel',
      'p5VibePosition',
      'p5VibeMinimized',
      'p5VibePromptHistory'
    ]).then((data) => {
      const panel = document.getElementById('p5-vibe-panel');
      const pill = document.getElementById('p5-vibe-pill');
      const keyInput = document.getElementById('p5-vibe-key-input');
      const modelSelect = document.getElementById('p5-vibe-model-select');
      const modelLabel = document.getElementById('p5-vibe-model-label');
      const historyCount = document.getElementById('p5-vibe-history-count');

      if (Array.isArray(data.p5VibePromptHistory)) {
        promptHistory = data.p5VibePromptHistory;
        if (historyCount) historyCount.textContent = promptHistory.length;
      }

      if (data.geminiApiKey) {
        config.apiKey = data.geminiApiKey;
        if (keyInput) keyInput.value = data.geminiApiKey;
        fetchAvailableModels(data.geminiApiKey).then((models) => {
          if (models && models.length > 0) {
            config.availableModels = models;
            const modelInfo = document.getElementById('p5-vibe-model-info');
            if (modelInfo) modelInfo.textContent = `✓ ${models.length} Modelle für deinen Key aktiv`;
            if (modelSelect) {
              const current = config.model;
              modelSelect.innerHTML = '';
              for (const m of models) {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = m.displayName !== m.id ? `${m.displayName} (${m.id})` : m.id;
                if (m.id === current) opt.selected = true;
                modelSelect.appendChild(opt);
              }
              if (!modelSelect.value) {
                modelSelect.value = models[0].id;
                config.model = models[0].id;
              }
              if (modelLabel) {
                modelLabel.textContent = config.model.replace(/^gemini-/, '').replace(/-/g, ' ');
              }
            }
          }
        });
      }

      if (data.geminiModel) {
        let m = data.geminiModel;
        // Migrate deprecated model names automatically
        if (m.includes('2.5-flash')) m = 'gemini-2.0-flash';
        if (m.includes('2.5-pro')) m = 'gemini-3.8-pro';
        config.model = m;
        if (m !== data.geminiModel) {
          browser.storage.local.set({ geminiModel: m });
        }
        if (modelSelect) modelSelect.value = m;
      }
      if (modelLabel) {
        if (config.model.includes('3.8-pro')) modelLabel.textContent = 'Gemini 3.8 Pro';
        else if (config.model.includes('3.8-flash')) modelLabel.textContent = 'Gemini 3.8 Flash';
        else if (config.model.includes('2.0')) modelLabel.textContent = 'Gemini 2.0 Flash';
        else if (config.model.includes('1.5')) modelLabel.textContent = 'Gemini 1.5 Flash';
        else modelLabel.textContent = 'Gemini';
      }

      if (data.p5VibePosition && panel) {
        if (data.p5VibePosition.left) panel.style.left = data.p5VibePosition.left;
        if (data.p5VibePosition.top) panel.style.top = data.p5VibePosition.top;
        if (data.p5VibePosition.left) panel.style.right = 'auto';
      }

      if (data.p5VibeMinimized && panel && pill) {
        panel.classList.add('p5-vibe-hidden');
        pill.classList.add('visible');
      }
    });
  }

  // Initialize
  injectBridge();
  createUI();
})();
