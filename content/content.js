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
    model: 'gemini-2.5-flash',
    isMinimized: false
  };
  let codeHistory = [];
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

  // 2. Bridge Communication (Promise-based)
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

  // Fallback for Firefox content script direct Xray access
  function handleWrappedJSObjectFallback(action, newCode) {
    try {
      const cmEl = document.querySelector('.CodeMirror');
      const cm = cmEl?.wrappedJSObject?.CodeMirror;
      if (cm) {
        if (action === 'GET_CODE') {
          return { success: true, code: cm.getValue() };
        }
        if (action === 'SET_CODE') {
          cm.setValue(newCode);
          cm.focus();
          return { success: true };
        }
      }
    } catch (err) {
      console.warn('[p5-vibe] wrappedJSObject fallback failed:', err);
    }
    return { success: false, code: null };
  }

  async function getEditorCode() {
    const res = await sendBridgeAction('GET_CODE');
    return res && res.success ? res.code : '';
  }

  async function setEditorCode(code) {
    const res = await sendBridgeAction('SET_CODE', { code });
    return res && res.success;
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
          <span class="p5-vibe-model-tag" id="p5-vibe-model-label">Gemini 2.5</span>
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
            <label for="p5-vibe-model-select">Gemini Modell</label>
            <select id="p5-vibe-model-select" class="p5-vibe-select">
              <option value="gemini-2.5-flash">Gemini 2.5 Flash (Empfohlen, schnell & smart)</option>
              <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
              <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro (Präzise für komplexe Mathematik)</option>
            </select>
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

    // Auto-save API Key and Model
    keyInput.addEventListener('change', () => {
      config.apiKey = keyInput.value.trim();
      saveSettings();
    });

    modelSelect.addEventListener('change', () => {
      config.model = modelSelect.value;
      updateModelBadge();
      saveSettings();
    });

    function updateModelBadge() {
      if (config.model.includes('2.5-pro')) {
        modelLabel.textContent = 'Gemini 2.5 Pro';
      } else if (config.model.includes('2.5-flash')) {
        modelLabel.textContent = 'Gemini 2.5 Flash';
      } else if (config.model.includes('2.0')) {
        modelLabel.textContent = 'Gemini 2.0';
      } else {
        modelLabel.textContent = 'Gemini 1.5';
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

    // Keyboard shortcut in textarea: Ctrl+Enter or Cmd+Enter to generate
    promptText.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        triggerGenerate();
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

      isGenerating = true;
      btnGenerate.disabled = true;
      panel.querySelector('#p5-vibe-gen-icon').innerHTML = '<span class="p5-vibe-spinner"></span>';
      panel.querySelector('#p5-vibe-gen-text').textContent = 'Vibing...';
      setStatus(`Gemini denkt nach (${config.model})...`, 'loading');

      try {
        // Read current editor code
        const currentCode = await getEditorCode();

        // Call background script for Gemini generation
        const response = await browser.runtime.sendMessage({
          action: 'GENERATE_CODE',
          prompt: prompt,
          currentCode: currentCode,
          mode: activeMode,
          apiKey: config.apiKey,
          model: config.model
        });

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
            setStatus('✅ Code eingefügt! Drücke jetzt auf ▶ Play im Webeditor.', 'success');
          } else {
            setStatus('⚠️ Code generiert, konnte aber nicht automatisch eingefügt werden. Editor geöffnet?', 'error');
          }
        } else {
          const errMsg = response?.error || 'Unbekannter Fehler bei der Generierung.';
          setStatus(`⚠️ ${errMsg}`, 'error');
        }
      } catch (err) {
        setStatus(`⚠️ Fehler: ${err.message}`, 'error');
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
      'p5VibeMinimized'
    ]).then((data) => {
      const panel = document.getElementById('p5-vibe-panel');
      const pill = document.getElementById('p5-vibe-pill');
      const keyInput = document.getElementById('p5-vibe-key-input');
      const modelSelect = document.getElementById('p5-vibe-model-select');
      const modelLabel = document.getElementById('p5-vibe-model-label');

      if (data.geminiApiKey) {
        config.apiKey = data.geminiApiKey;
        if (keyInput) keyInput.value = data.geminiApiKey;
      }

      if (data.geminiModel) {
        config.model = data.geminiModel;
        if (modelSelect) modelSelect.value = data.geminiModel;
        if (modelLabel) {
          if (config.model.includes('2.5-pro')) modelLabel.textContent = 'Gemini 2.5 Pro';
          else if (config.model.includes('2.5-flash')) modelLabel.textContent = 'Gemini 2.5 Flash';
          else if (config.model.includes('2.0')) modelLabel.textContent = 'Gemini 2.0';
          else modelLabel.textContent = 'Gemini 1.5';
        }
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
