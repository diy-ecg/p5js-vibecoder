/**
 * p5.js Vibe Coder - Content Script
 * Manages the floating UI panel, interactions, and bridge communication.
 */

(() => {
  if (window.__p5VibeContentInjected) return;
  window.__p5VibeContentInjected = true;

  // Cross-browser compatibility polyfill (Firefox 'browser' vs Chromium 'chrome')
  const browser = globalThis.browser || globalThis.chrome;

  // State
  let config = {
    apiKey: '',
    model: 'gemini-2.0-flash',
    autoRun: true,
    isMinimized: false,
    availableModels: [],
    lang: 'en'
  };
  let codeHistory = [];
  let promptHistory = [];
  let chatSession = []; // Multi-turn conversational memory
  let isGenerating = false;
  let pendingRequests = new Map();

  /**
   * Bilingual localization dictionary (DE / EN)
   */
  const I18N = {
    de: {
      panelTitle: 'p5.js Vibe Coder',
      pillTitle: 'Klicken zum Öffnen des p5.js Vibe Coder Panels (Alt+V)',
      modelBadgeTitle: (m) => `Aktives Modell: ${m}`,
      btnInfoTitle: 'Informationen & Kontakt (Version, Lizenz)',
      btnInfoCloseTitle: 'Schließen',
      btnSettingsTitle: 'Einstellungen (API-Key & Sprache)',
      btnMinimizeTitle: 'Minimieren',
      infoContactLabel: 'Kontakt / Feedback',
      infoLicenseLabel: 'Lizenz',
      infoLicenseValue: 'MIT License (Open Source)',
      infoRepoLabel: 'GitHub Projekt',
      apiKeyLabel: 'Gemini API Key',
      showPassword: 'Passwort anzeigen',
      hidePassword: 'Passwort verbergen',
      getKeyLink: 'Kostenlosen Key bei Google AI Studio holen ↗',
      modelLabel: 'Gemini Modell',
      refreshModelsBtn: '🔄 Modelle prüfen',
      refreshModelsTitle: 'Verfügbare Modelle für diesen Key prüfen',
      languageLabel: 'Sprache / Language',
      chatIndicatorNew: '💬 Neuer Chat',
      chatIndicatorNewTitle: 'Erste Nachricht startet einen neuen Dialog',
      chatIndicatorActive: (n) => `💬 Chat (${n} ${n === 1 ? 'Runde' : 'Runden'})`,
      chatIndicatorActiveTitle: (n) => `${n} vorherige Chat-${n === 1 ? 'Runde fließt' : 'Runden fließen'} als Kontext mit ein. Klicke × zum Zurücksetzen.`,
      resetChatTitle: 'Chat-Kontext zurücksetzen',
      autoStartTitle: 'Auto-Start: Startet das p5.js Skript nach Generierung direkt (on/off)',
      autoStartText: 'Auto-Start',
      historyBtn: (n) => `🕒 Verlauf (${n})`,
      historyBtnTitle: 'Verlauf bisheriger Prompts einsehen',
      historyHeader: 'Bisherige Prompts',
      historyClear: 'Leeren',
      historyEmpty: 'Noch keine Prompts gespeichert',
      historyItemTitle: (item) => `Klicken zum Übernehmen:\n"${item}"`,
      btnGenerate: 'Vibe Code',
      btnGenerating: 'Vibing...',
      btnUndo: '↩ Undo',
      undoTitleEmpty: 'Keine vorherige Version vorhanden',
      undoTitleCount: (n) => `Letzte Version wiederherstellen (${n} ${n === 1 ? 'Version' : 'Versionen'} im Speicher)`,
      statusReady: 'Bereit. Gib eine Idee ein und klicke auf Vibe Code!',
      statusEnterPrompt: '⚠️ Bitte gib zuerst eine Idee oder Anweisung ein.',
      statusEnterKey: '⚠️ Bitte trage zuerst deinen Gemini API-Key in den Einstellungen ein.',
      statusThinking: (m) => `Gemini denkt nach (${m})...`,
      statusSuccessRunning: (m) => `✅ Code eingefügt & Skript gestartet!${m}`,
      statusSuccessManual: (m) => `✅ Code eingefügt!${m} Drücke jetzt auf ▶ Play im Webeditor.`,
      statusClipboard: '⚠️ Code generiert & in Zwischenablage kopiert! (Drücke Cmd+V im Editor zum Einfügen)',
      statusInjectError: '⚠️ Code generiert, konnte aber nicht automatisch eingefügt werden. Editor geöffnet?',
      statusExtensionUpdated: '⚠️ Das Add-on wurde aktualisiert. Bitte lade diese Seite einmal neu (Cmd+R / F5).',
      statusRestoring: 'Code wird wiederhergestellt...',
      statusRestoredRunning: '↩ Vorheriger Code wiederhergestellt & Skript gestartet!',
      statusRestoredManual: '↩ Vorheriger Code wiederhergestellt!',
      statusRestoreError: 'Konnte Code nicht in Editor einfügen.',
      statusChatReset: 'Chat-Kontext zurückgesetzt. Neuer Dialog begonnen.',
      statusHistoryCleared: 'Verlauf geleert.',
      statusSwitchingModel: (m) => `Wechsle zu Alternativ-Modell ${m}...`,
      modelInfoEnterKey: 'Trage zuerst einen API-Key ein.',
      modelInfoChecking: 'Prüfe Modelle bei Google...',
      modelInfoActive: (n) => `✓ ${n} Modelle für deinen Key aktiv`,
      modelInfoError: 'Konnte keine Modelle abrufen (Key prüfen).',
      invalidKeyError: 'Ungültiger Gemini API-Key. Bitte überprüfe deinen Key in den Einstellungen.',
      noResponseError: 'Keine Antwort von Gemini erhalten.',
      statusTruncatedWarning: '⚠️ Warnung: Das Skript hat das Token-Ausgabelimit von Gemini (8.192 Tokens) erreicht und wurde abgeschnitten! Nutze ↩ Undo.',
      fixErrorBtn: 'Fehler einfügen',
      fixErrorBtnTitle: 'Kopiert den letzten Konsolenfehler in das Promptfeld',
      errorBadge: 'Fehler in Konsole',
      btnInsertError: 'In Prompt einfügen',
      dismissErrorTitle: 'Fehlerhinweis schließen',
      errorCopiedToast: '✅ Fehlermeldung in Prompt übernommen! Drücke Strg+Enter zum Beheben.',
      noErrorDetectedToast: 'Kein Fehler in der Konsole gefunden.',
      errorPromptPrefix: (msg) => `Behebe folgenden p5.js-Fehler:\n${msg}`
    },
    en: {
      panelTitle: 'p5.js Vibe Coder',
      pillTitle: 'Click to open p5.js Vibe Coder panel (Alt+V)',
      modelBadgeTitle: (m) => `Active model: ${m}`,
      btnInfoTitle: 'Information & Contact (Version, License)',
      btnInfoCloseTitle: 'Close',
      btnSettingsTitle: 'Settings (API Key & Language)',
      btnMinimizeTitle: 'Minimize',
      infoContactLabel: 'Contact / Feedback',
      infoLicenseLabel: 'License',
      infoLicenseValue: 'MIT License (Open Source)',
      infoRepoLabel: 'GitHub Project',
      apiKeyLabel: 'Gemini API Key',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      getKeyLink: 'Get free key from Google AI Studio ↗',
      modelLabel: 'Gemini Model',
      refreshModelsBtn: '🔄 Check Models',
      refreshModelsTitle: 'Check available models for this key',
      languageLabel: 'Language / Sprache',
      chatIndicatorNew: '💬 New Chat',
      chatIndicatorNewTitle: 'First prompt starts a new conversation',
      chatIndicatorActive: (n) => `💬 Chat (${n} ${n === 1 ? 'round' : 'rounds'})`,
      chatIndicatorActiveTitle: (n) => `${n} previous chat ${n === 1 ? 'round is' : 'rounds are'} included as context. Click × to reset.`,
      resetChatTitle: 'Reset chat context',
      autoStartTitle: 'Auto-Start: Automatically runs the p5.js sketch after generation (on/off)',
      autoStartText: 'Auto-Start',
      historyBtn: (n) => `🕒 History (${n})`,
      historyBtnTitle: 'View previous prompts',
      historyHeader: 'Previous Prompts',
      historyClear: 'Clear',
      historyEmpty: 'No prompts saved yet',
      historyItemTitle: (item) => `Click to load:\n"${item}"`,
      btnGenerate: 'Vibe Code',
      btnGenerating: 'Vibing...',
      btnUndo: '↩ Undo',
      undoTitleEmpty: 'No previous version available',
      undoTitleCount: (n) => `Restore previous version (${n} ${n === 1 ? 'version' : 'versions'} in memory)`,
      statusReady: 'Ready. Enter an idea and click Vibe Code!',
      statusEnterPrompt: '⚠️ Please enter an idea or instruction first.',
      statusEnterKey: '⚠️ Please enter your Gemini API key in settings first.',
      statusThinking: (m) => `Gemini is thinking (${m})...`,
      statusSuccessRunning: (m) => `✅ Code injected & sketch started!${m}`,
      statusSuccessManual: (m) => `✅ Code injected!${m} Click ▶ Play in the web editor now.`,
      statusClipboard: '⚠️ Code generated & copied to clipboard! (Press Cmd+V in editor to paste)',
      statusInjectError: '⚠️ Code generated but could not be auto-injected. Is editor open?',
      statusExtensionUpdated: '⚠️ The extension was updated. Please reload this page (Cmd+R / F5).',
      statusRestoring: 'Restoring code...',
      statusRestoredRunning: '↩ Previous code restored & sketch started!',
      statusRestoredManual: '↩ Previous code restored!',
      statusRestoreError: 'Could not inject code into editor.',
      statusChatReset: 'Chat context reset. Started new conversation.',
      statusHistoryCleared: 'History cleared.',
      statusSwitchingModel: (m) => `Switching to alternative model ${m}...`,
      modelInfoEnterKey: 'Enter an API key first.',
      modelInfoChecking: 'Checking models with Google...',
      modelInfoActive: (n) => `✓ ${n} models active for your key`,
      modelInfoError: 'Could not fetch models (check key).',
      invalidKeyError: 'Invalid Gemini API key. Please check your key in settings.',
      noResponseError: 'No response received from Gemini.',
      statusTruncatedWarning: '⚠️ Warning: The script reached Gemini\'s output token limit (8,192 tokens) and was truncated! Use ↩ Undo.',
      fixErrorBtn: 'Insert Error',
      fixErrorBtnTitle: 'Copies the latest console error into the prompt field',
      errorBadge: 'Console Error',
      btnInsertError: 'Insert into Prompt',
      dismissErrorTitle: 'Dismiss error banner',
      errorCopiedToast: '✅ Error copied to prompt! Press Ctrl+Enter to fix.',
      noErrorDetectedToast: 'No error detected in console.',
      errorPromptPrefix: (msg) => `Fix the following p5.js error:\n${msg}`
    }
  };

  function t(key, ...args) {
    const lang = config.lang || 'en';
    const dict = I18N[lang] || I18N.en;
    const val = dict[key] !== undefined ? dict[key] : (I18N.en[key] !== undefined ? I18N.en[key] : (I18N.de[key] !== undefined ? I18N.de[key] : ''));
    if (typeof val === 'function') {
      return val(...args);
    }
    return val;
  }

  /**
   * Format Gemini model IDs to clean, human-readable display names
   * e.g. 'gemini-2.0-flash' -> 'Gemini 2.0 Flash'
   */
  function formatModelName(modelId) {
    if (!modelId) return 'Gemini';
    const clean = modelId.replace(/^models\//, '');
    if (clean === 'gemini-2.0-flash') return 'Gemini 2.0 Flash';
    if (clean === 'gemini-3.8-flash') return 'Gemini 3.8 Flash';
    if (clean === 'gemini-3.8-pro') return 'Gemini 3.8 Pro';
    if (clean === 'gemini-1.5-flash') return 'Gemini 1.5 Flash';
    if (clean === 'gemini-1.5-pro') return 'Gemini 1.5 Pro';
    return clean
      .split(/[-_]/)
      .map(part => {
        const lower = part.toLowerCase();
        if (lower === 'gemini') return 'Gemini';
        if (/^\d+(\.\d+)*$/.test(part)) return part;
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(' ');
  }

  /**
   * Dynamically update the header model badge with the active/used model
   */
  function updateModelBadge(modelId) {
    const label = document.getElementById('p5-vibe-model-label');
    const target = modelId || config.model;
    if (label && target) {
      label.textContent = formatModelName(target);
      label.title = t('modelBadgeTitle', target);
    }
  }

  // 1. Inject Page Bridge
  function injectBridge() {
    try {
      if (document.getElementById('p5-vibe-bridge-script')) return;
      const script = document.createElement('script');
      script.id = 'p5-vibe-bridge-script';
      script.src = browser.runtime.getURL('content/page-bridge.js');
      (document.head || document.documentElement).appendChild(script);
    } catch (e) {
      console.warn('[p5-vibe] Bridge script injection note:', e);
    }
  }

  // 2. Direct AI API Request (OpenAI-compatible) with ModelService Discovery & Exponential Backoff
  const transformer = window.__p5VibeAiTransformer;

  function cleanGeneratedCode(rawText) {
    return transformer ? transformer.cleanGeneratedCode(rawText) : (rawText || '').trim();
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

  async function callSingleGeminiModel({ prompt, currentCode, apiKey, model, chatSession }) {
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

    const { messages, userInstruction } = transformer.buildOpenAiMessages({
      prompt,
      currentCode,
      chatSession,
      lang: config.lang
    });

    const requestBody = transformer.buildOpenAiRequestBody({
      model,
      messages,
      temperature: 0.7,
      maxTokens: 8192
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    if (!response.ok) {
      const errorMsg = transformer.parseApiError(response.status, data);
      return {
        success: false,
        error: errorMsg,
        status: response.status
      };
    }

    const parsed = transformer.parseOpenAiResponse(data);
    if (!parsed.success || !parsed.code) {
      return { success: false, error: parsed.error || t('noResponseError') };
    }

    if (parsed.isTruncated) {
      console.warn('[p5-vibe] Gemini response hit max_tokens (8192) and was truncated by the API!');
    }

    return {
      success: true,
      code: parsed.code,
      userInstruction: userInstruction,
      isTruncated: parsed.isTruncated
    };
  }

  async function requestGeminiApi({ prompt, currentCode, apiKey, model, chatSession, onStatusUpdate }) {
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
        onStatusUpdate(t('statusSwitchingModel', formatModelName(currentModel)));
      }

      // Try current model with exponential backoff for high demand (up to 3 attempts)
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const res = await callSingleGeminiModel({
            prompt,
            currentCode,
            apiKey,
            model: currentModel,
            chatSession
          });

          if (res.success) {
            return {
              success: true,
              code: res.code,
              modelUsed: currentModel,
              userInstruction: res.userInstruction,
              isTruncated: res.isTruncated
            };
          }

          const errMsg = (res.error || '').toLowerCase();
          lastError = res.error;

          // If invalid key, stop immediately
          if (errMsg.includes('api key') && !errMsg.includes('quota')) {
            return {
              success: false,
              error: t('invalidKeyError')
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
                onStatusUpdate(`⏳ Lastspitze bei ${formatModelName(currentModel)} – automatischer Versuch in ${waitSec}s (${attempt}/${maxAttempts})...`);
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
    const { requestId, code, success, action, error } = event.data;
    if (requestId && pendingRequests.has(requestId)) {
      const { resolve } = pendingRequests.get(requestId);
      pendingRequests.delete(requestId);
      resolve({ success, code, error });
      return;
    }

    // Proactive error event pushed from sketch preview iframe
    if (action === 'ERROR_DETECTED' && error) {
      if (typeof window.__p5VibeHandleDetectedError === 'function') {
        window.__p5VibeHandleDetectedError(error);
      }
    }
  });

  function sendBridgeAction(action, payload = {}) {
    injectBridge();
    return new Promise((resolve) => {
      const requestId = 'req_' + Math.random().toString(36).substring(2, 9);
      
      // Timeout fallback in case bridge isn't active or page is loading
      const timeoutId = setTimeout(() => {
        if (pendingRequests.has(requestId)) {
          pendingRequests.delete(requestId);
          resolve({ success: false, error: 'Bridge request timeout' });
        }
      }, 1500);

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
        el.cmView,
        el.cmTile?.view,
        el.editorView,
        el.view,
        el.editor,
        el.wrappedJSObject?.cmView?.view,
        el.wrappedJSObject?.cmView,
        el.wrappedJSObject?.cmTile?.view,
        el.wrappedJSObject?.editorView,
        el.wrappedJSObject?.view,
        el.wrappedJSObject?.editor
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
    // 1. Try direct CodeMirror 6 View (Firefox wrappedJSObject)
    const view = findCM6View();
    if (view && view.state?.doc) {
      try {
        const code = view.state.doc.toString();
        if (code && code.trim().length > 0) return code;
      } catch (e) {}
    }

    // 2. Try Page Bridge (Primary for Chrome / Chromium - retrieves full virtualized doc via CM6 API)
    try {
      const res = await sendBridgeAction('GET_CODE');
      if (res && res.success && typeof res.code === 'string' && res.code.trim().length > 0) {
        return res.code;
      }
    } catch (e) {}

    // 3. Try CodeMirror 5 (.CodeMirror)
    const cm5El = document.querySelector('.CodeMirror');
    if (cm5El) {
      const cm = cm5El.CodeMirror || cm5El.wrappedJSObject?.CodeMirror;
      if (cm && typeof cm.getValue === 'function') {
        try {
          const code = cm.getValue();
          if (code && code.trim().length > 0) return code;
        } catch (e) {}
      }
    }

    // 4. Try Textarea fallback
    const textarea = document.querySelector('textarea.editor, .editor textarea, textarea');
    if (textarea && textarea.value && textarea.value.trim().length > 0) {
      return textarea.value;
    }

    // 5. Emergency DOM fallback: CodeMirror 6 Content DOM node text
    const cmContent = document.querySelector('.cm-content') || document.querySelector('.cm-editor .cm-content');
    if (cmContent && cmContent.innerText && cmContent.innerText.trim().length > 0) {
      return cmContent.innerText;
    }

    return '';
  }

  /**
   * Set new code into the p5.js editor (100% clean replacement, no duplicates)
   */
  async function setEditorCode(newCode) {
    if (!newCode) return false;

    // 1. Try direct CodeMirror 6 View Transaction (Firefox wrappedJSObject)
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
        console.warn('[p5-vibe] direct view.dispatch note:', err);
      }
    }

    // 2. Try Page Bridge (Primary for Chrome / Chromium - atomic replace from 0 to doc.length)
    try {
      const bridgeRes = await sendBridgeAction('SET_CODE', { code: newCode });
      if (bridgeRes && bridgeRes.success) {
        console.log('[p5-vibe] Successfully replaced editor code via Page Bridge');
        return true;
      }
    } catch (e) {
      console.warn('[p5-vibe] Page bridge SET_CODE failed:', e);
    }

    // 3. Try CodeMirror 5 (.CodeMirror)
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

    // 4. Try Textarea fallback
    const textarea = document.querySelector('textarea.editor, .editor textarea, textarea');
    if (textarea && textarea.offsetParent !== null) {
      textarea.value = newCode;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    // 5. Emergency DOM fallback (only if both direct view and bridge are unavailable)
    const cmContent = document.querySelector('.cm-content') || document.querySelector('.cm-editor .cm-content');
    if (cmContent) {
      try {
        cmContent.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        return document.execCommand('insertText', false, newCode);
      } catch (err) {
        console.warn('[p5-vibe] Emergency contenteditable fallback failed:', err);
      }
    }

    return false;
  }

  /**
   * Find Play button via multiple resilient strategies
   */
  function findPlayButton() {
    let btn = document.querySelector('[data-testid*="play" i], [data-testid*="start" i]');
    if (btn) return btn;

    btn = document.querySelector('button[aria-label*="start" i], button[aria-label*="play" i], [role="button"][aria-label*="start" i], [role="button"][aria-label*="play" i]');
    if (btn) return btn;

    btn = document.querySelector('button[title*="start" i], button[title*="play" i]');
    if (btn) return btn;

    btn = document.querySelector('button[class*="play" i], [class*="toolbar__play" i], [class*="play_button" i], [class*="play-button" i]');
    if (btn) return btn;

    // Proximity to Auto-refresh text
    try {
      const allElements = document.querySelectorAll('label, span, div, p');
      for (const el of allElements) {
        if (el.textContent && el.textContent.trim().toLowerCase().includes('auto-refresh')) {
          let container = el.parentElement;
          for (let depth = 0; depth < 5; depth++) {
            if (!container) break;
            const buttons = container.querySelectorAll('button');
            if (buttons.length >= 1) return buttons[0];
            container = container.parentElement;
          }
        }
      }
    } catch (e) {}

    // Top-left area button with SVG (<120px top, <300px left)
    try {
      const allButtons = document.querySelectorAll('button');
      for (const b of allButtons) {
        const rect = b.getBoundingClientRect();
        if (rect.top >= 0 && rect.top < 120 && rect.left >= 0 && rect.left < 300) {
          const svg = b.querySelector('svg');
          if (svg) return b;
        }
      }
    } catch (e) {}

    return document.querySelector('.toolbar button, [class*="toolbar" i] button, nav button');
  }

  function findStopButton() {
    let btn = document.querySelector('[data-testid*="stop" i]');
    if (btn) return btn;

    btn = document.querySelector('button[aria-label*="stop" i], [role="button"][aria-label*="stop" i]');
    if (btn) return btn;

    btn = document.querySelector('button[class*="stop" i], [class*="toolbar__stop" i], [class*="stop_button" i], [class*="stop-button" i]');
    if (btn) return btn;

    try {
      const allElements = document.querySelectorAll('label, span, div, p');
      for (const el of allElements) {
        if (el.textContent && el.textContent.trim().toLowerCase().includes('auto-refresh')) {
          let container = el.parentElement;
          for (let depth = 0; depth < 5; depth++) {
            if (!container) break;
            const buttons = container.querySelectorAll('button');
            if (buttons.length >= 2) return buttons[1];
            container = container.parentElement;
          }
        }
      }
    } catch (e) {}

    return null;
  }

  function activateElement(element) {
    if (!element) return false;
    const targets = [element, element.wrappedJSObject].filter(Boolean);
    const win = window.wrappedJSObject || window;

    // 1. Invoke React internal onClick directly
    for (const t of targets) {
      try {
        for (const key of Object.keys(t)) {
          if (key.startsWith('__reactProps$') || key.startsWith('__reactEventHandlers$') || key.startsWith('__reactFiber$')) {
            const val = t[key];
            const handler = val?.onClick || val?.memoizedProps?.onClick || val?.props?.onClick;
            if (typeof handler === 'function') {
              handler({
                preventDefault: () => {},
                stopPropagation: () => {},
                target: t,
                currentTarget: t,
                bubbles: true
              });
              console.log('[p5-vibe] Invoked React onClick handler directly');
            }
          }
        }
      } catch (err) {}
    }

    // 2. Dispatch pointer & mouse events
    for (const t of targets) {
      try {
        t.focus();
        const eventTypes = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
        for (const type of eventTypes) {
          try {
            const isPointer = type.startsWith('pointer');
            const evt = isPointer
              ? new win.PointerEvent(type, { bubbles: true, cancelable: true, composed: true, view: win, detail: 1, button: 0, buttons: 1 })
              : new win.MouseEvent(type, { bubbles: true, cancelable: true, composed: true, view: win, detail: 1, button: 0, buttons: 1 });
            t.dispatchEvent(evt);
          } catch (e) {}
        }
      } catch (err) {}
    }

    // 3. Native .click()
    for (const t of targets) {
      try {
        if (typeof t.click === 'function') t.click();
      } catch (err) {}
    }

    return true;
  }

  function dispatchPlayShortcut() {
    const win = window.wrappedJSObject || window;
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const eventInit = {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
      composed: true,
      view: win,
      metaKey: isMac,
      ctrlKey: !isMac
    };

    const targets = [
      document.querySelector('.cm-content'),
      document.querySelector('.cm-editor'),
      document.activeElement,
      document.body,
      win.document,
      win
    ].filter(Boolean);

    for (const t of targets) {
      const unwrappedT = t.wrappedJSObject || t;
      try {
        unwrappedT.dispatchEvent(new win.KeyboardEvent('keydown', eventInit));
        unwrappedT.dispatchEvent(new win.KeyboardEvent('keyup', eventInit));
      } catch (e) {}
    }
  }

  /**
   * Automatically start / run the sketch in the p5.js Web Editor
   */
  function triggerPlaySketch() {
    console.log('[p5-vibe] Auto-Start trigger initiated');

    // 1. Send action to page-bridge (executes in pure page context)
    try {
      sendBridgeAction('PLAY_SKETCH');
    } catch (e) {}

    // 2. Check if previous sketch is currently running (Stop button active)
    const stopBtn = findStopButton();
    let isStopActive = false;
    if (stopBtn) {
      const bg = getComputedStyle(stopBtn).backgroundColor || '';
      isStopActive = stopBtn.classList.contains('active') ||
                     (stopBtn.className || '').includes('active') ||
                     bg.includes('237') ||
                     bg.includes('255');
    }

    if (isStopActive) {
      console.log('[p5-vibe] Sketch currently running. Stopping first for clean restart...');
      activateElement(stopBtn);
      setTimeout(() => {
        executePlay();
      }, 100);
    } else {
      executePlay();
    }

    function executePlay() {
      const playBtn = findPlayButton();
      if (playBtn) {
        console.log('[p5-vibe] Found Play button, activating:', playBtn);
        activateElement(playBtn);
      } else {
        console.warn('[p5-vibe] Play button not located directly, using shortcut fallback');
      }
      dispatchPlayShortcut();

      // Check for console/runtime errors shortly after sketch runs
      setTimeout(() => {
        if (typeof window.__p5VibeCheckErrors === 'function') {
          window.__p5VibeCheckErrors();
        }
      }, 900);
      setTimeout(() => {
        if (typeof window.__p5VibeCheckErrors === 'function') {
          window.__p5VibeCheckErrors();
        }
      }, 2200);
    }

    return true;
  }

  /**
   * Search the p5.js Web Editor console DOM and lint markers for errors
   */
  function findConsoleErrorInDom() {
    function cleanErr(raw) {
      if (!raw) return '';
      return String(raw)
        .replace(/^[\s\u200B\uFEFF]+|[\s\u200B\uFEFF]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    try {
      // 1. Explicit error elements from console-feed / p5 console
      const errorElements = document.querySelectorAll(
        '[class*="console" i] [class*="error" i], ' +
        '[class*="preview-console" i] [class*="error" i], ' +
        '[data-method="error"], ' +
        '[class*="message--error"], ' +
        '[class*="log--error"], ' +
        '[role="log"] [class*="error" i]'
      );

      if (errorElements && errorElements.length > 0) {
        for (let i = errorElements.length - 1; i >= 0; i--) {
          const el = errorElements[i];
          const text = cleanErr(el.innerText || el.textContent);
          if (text && text.length > 3 && !text.includes('p5-vibe')) {
            return text;
          }
        }
      }

      // 2. Scan all console containers line-by-line for error patterns
      const consoleContainers = document.querySelectorAll(
        '[class*="preview-console" i], [class*="console" i], [role="log"]'
      );
      for (const container of consoleContainers) {
        const lines = (container.innerText || container.textContent || '').split('\n');
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = cleanErr(lines[i]);
          if (!line) continue;
          if (
            line.includes('🌸 p5.js says:') ||
            /^(?:Uncaught\s+)?(?:ReferenceError|TypeError|SyntaxError|RangeError):/i.test(line) ||
            /\b(?:Error|is not defined|Cannot read propert)\b/i.test(line)
          ) {
            return line;
          }
        }
      }

      // 3. Check CodeMirror lint error markers
      const lintMarkers = document.querySelectorAll(
        '.cm-lint-marker-error, .cm-lintRange-error, .CodeMirror-lint-marker-error'
      );
      if (lintMarkers && lintMarkers.length > 0) {
        for (let i = lintMarkers.length - 1; i >= 0; i--) {
          const marker = lintMarkers[i];
          const tooltip = marker.getAttribute('title') || marker.getAttribute('aria-label') || marker.textContent;
          if (tooltip && tooltip.trim()) {
            return `Syntax error: ${cleanErr(tooltip)}`;
          }
        }
      }
    } catch (e) {
      console.warn('[p5-vibe] Error scanning DOM for console errors:', e);
    }
    return null;
  }

  // 3. UI Construction
  function createUI() {
    // Floating Pill (starts visible on initial page load)
    const pill = document.createElement('div');
    pill.id = 'p5-vibe-pill';
    pill.className = 'visible';
    pill.innerHTML = `<span>⚡</span> <span>p5.js Vibe Coder</span>`;
    pill.title = t('pillTitle');
    document.body.appendChild(pill);

    // Floating Main Panel (starts minimized/hidden on initial page load)
    const panel = document.createElement('div');
    panel.id = 'p5-vibe-panel';
    panel.className = 'p5-vibe-hidden';

    const extVersion = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest)
      ? (chrome.runtime.getManifest()?.version || '1.0.0')
      : '1.0.0';

    panel.innerHTML = `
      <div class="p5-vibe-header" id="p5-vibe-drag-header">
        <div class="p5-vibe-title-group">
          <div class="p5-vibe-badge-logo">⚡</div>
          <span class="p5-vibe-title">p5.js Vibe Coder</span>
          <span class="p5-vibe-model-tag" id="p5-vibe-model-label">Gemini 2.0 Flash</span>
        </div>
        <div class="p5-vibe-actions">
          <button class="p5-vibe-icon-btn p5-vibe-btn-info" id="p5-vibe-btn-info" title="${t('btnInfoTitle')}"><i>i</i></button>
          <button class="p5-vibe-icon-btn" id="p5-vibe-btn-settings" title="${t('btnSettingsTitle')}">⚙</button>
          <button class="p5-vibe-icon-btn" id="p5-vibe-btn-minimize" title="${t('btnMinimizeTitle')}">−</button>
        </div>
      </div>

      <div class="p5-vibe-body">
        <!-- Info Drawer -->
        <div class="p5-vibe-info-drawer" id="p5-vibe-info-drawer">
          <div class="p5-vibe-info-header">
            <div class="p5-vibe-info-title-wrap">
              <span class="p5-vibe-info-title">p5.js Vibe Coder</span>
              <span class="p5-vibe-info-version">v${extVersion}</span>
            </div>
            <button type="button" class="p5-vibe-info-close" id="p5-vibe-btn-info-close" title="${t('btnInfoCloseTitle')}">×</button>
          </div>
          <div class="p5-vibe-info-body">
            <div class="p5-vibe-info-row">
              <span class="p5-vibe-info-label" id="p5-vibe-label-contact">${t('infoContactLabel')}</span>
              <a href="mailto:info@diy-ecg.org" class="p5-vibe-info-link">info@diy-ecg.org</a>
            </div>
            <div class="p5-vibe-info-row">
              <span class="p5-vibe-info-label" id="p5-vibe-label-license">${t('infoLicenseLabel')}</span>
              <span class="p5-vibe-info-val" id="p5-vibe-val-license">${t('infoLicenseValue')}</span>
            </div>
            <div class="p5-vibe-info-row">
              <span class="p5-vibe-info-label" id="p5-vibe-label-repo">${t('infoRepoLabel')}</span>
              <a href="https://github.com/diy-ecg/p5js-vibecoder" target="_blank" rel="noopener noreferrer" class="p5-vibe-info-link">GitHub Repo ↗</a>
            </div>
          </div>
        </div>

        <!-- Settings Drawer -->
        <div class="p5-vibe-settings" id="p5-vibe-settings-drawer">
          <div class="p5-vibe-field">
            <label for="p5-vibe-key-input" id="p5-vibe-label-key">${t('apiKeyLabel')}</label>
            <div class="p5-vibe-input-wrapper">
              <input type="password" id="p5-vibe-key-input" class="p5-vibe-input" placeholder="AIzaSy..." spellcheck="false" autocomplete="off" />
              <button type="button" class="p5-vibe-input-toggle" id="p5-vibe-toggle-key" title="${t('showPassword')}">👁</button>
            </div>
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" class="p5-vibe-settings-link" id="p5-vibe-settings-link">
              ${t('getKeyLink')}
            </a>
          </div>

          <div class="p5-vibe-field">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
              <label for="p5-vibe-model-select" id="p5-vibe-label-model">${t('modelLabel')}</label>
              <button type="button" class="p5-vibe-btn-refresh-models" id="p5-vibe-btn-refresh-models" title="${t('refreshModelsTitle')}">${t('refreshModelsBtn')}</button>
            </div>
            <select id="p5-vibe-model-select" class="p5-vibe-select">
              <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
              <option value="gemini-3.8-flash">Gemini 3.8 Flash</option>
            </select>
            <span id="p5-vibe-model-info" style="font-size: 10px; color: var(--p5-vibe-text-muted); margin-top: 2px;"></span>
          </div>

          <div class="p5-vibe-field">
            <label for="p5-vibe-lang-select" id="p5-vibe-label-lang">${t('languageLabel')}</label>
            <select id="p5-vibe-lang-select" class="p5-vibe-select">
              <option value="en">🇬🇧 English</option>
              <option value="de">🇩🇪 Deutsch</option>
            </select>
          </div>
        </div>

        <!-- Prompt Header with Chat Indicator, Auto-Start Switch and History Button -->
        <div class="p5-vibe-prompt-header">
          <div class="p5-vibe-prompt-label-group">
            <span id="p5-vibe-chat-indicator" class="p5-vibe-chat-pill" title="${t('chatIndicatorNewTitle')}">${t('chatIndicatorNew')}</span>
          </div>
          <div class="p5-vibe-prompt-tools">
            <label class="p5-vibe-switch" title="${t('autoStartTitle')}">
              <input type="checkbox" id="p5-vibe-autorun-toggle" checked />
              <span class="p5-vibe-switch-slider"></span>
              <span class="p5-vibe-switch-text">${t('autoStartText')}</span>
            </label>
            <button type="button" class="p5-vibe-btn-history" id="p5-vibe-btn-history" title="${t('historyBtnTitle')}">
              ${t('historyBtn', 0)}
            </button>
          </div>
        </div>

        <!-- History Popover / Drawer -->
        <div class="p5-vibe-history-drawer" id="p5-vibe-history-drawer">
          <div class="p5-vibe-history-header">
            <span id="p5-vibe-history-header-title">${t('historyHeader')}</span>
            <button type="button" class="p5-vibe-btn-clear-history" id="p5-vibe-btn-clear-history">${t('historyClear')}</button>
          </div>
          <div class="p5-vibe-history-list" id="p5-vibe-history-list"></div>
        </div>

        <!-- Detected Console Error Banner (appears when an error is captured) -->
        <div class="p5-vibe-error-banner" id="p5-vibe-error-banner" style="display: none;">
          <div class="p5-vibe-error-header">
            <span class="p5-vibe-error-badge" id="p5-vibe-error-badge">⚠️ ${t('errorBadge')}</span>
            <button type="button" class="p5-vibe-btn-error-dismiss" id="p5-vibe-btn-error-dismiss" title="${t('dismissErrorTitle')}">×</button>
          </div>
          <div class="p5-vibe-error-text" id="p5-vibe-error-text"></div>
          <div class="p5-vibe-error-actions">
            <button type="button" class="p5-vibe-btn-error-insert" id="p5-vibe-btn-error-insert" title="${t('fixErrorBtnTitle')}">
              📋 <span id="p5-vibe-btn-error-insert-text">${t('btnInsertError')}</span>
            </button>
          </div>
        </div>

        <!-- Prompt Input -->
        <div class="p5-vibe-prompt-area">
          <textarea 
            id="p5-vibe-prompt-text" 
            class="p5-vibe-textarea" 
            rows="3"
          ></textarea>
        </div>

        <!-- Action Buttons -->
        <div class="p5-vibe-footer-actions">
          <button class="p5-vibe-btn-primary" id="p5-vibe-btn-generate">
            <span id="p5-vibe-gen-icon">⚡</span>
            <span id="p5-vibe-gen-text">${t('btnGenerate')}</span>
          </button>
          <button class="p5-vibe-btn-secondary" id="p5-vibe-btn-undo" title="${t('undoTitleEmpty')}">
            ${t('btnUndo')}
          </button>
        </div>

        <!-- Status & Tool Row -->
        <div class="p5-vibe-status-row">
          <div class="p5-vibe-status" id="p5-vibe-status-msg">
            ${t('statusReady')}
          </div>
          <button type="button" class="p5-vibe-btn-secondary p5-vibe-btn-fix-error" id="p5-vibe-btn-fix-error" title="${t('fixErrorBtnTitle')}">
            🐛 <span id="p5-vibe-btn-fix-error-text">${t('fixErrorBtn')}</span>
          </button>
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
    const btnInfo = panel.querySelector('#p5-vibe-btn-info');
    const infoDrawer = panel.querySelector('#p5-vibe-info-drawer');
    const btnInfoClose = panel.querySelector('#p5-vibe-btn-info-close');
    const btnSettings = panel.querySelector('#p5-vibe-btn-settings');
    const settingsDrawer = panel.querySelector('#p5-vibe-settings-drawer');
    const keyInput = panel.querySelector('#p5-vibe-key-input');
    const toggleKeyBtn = panel.querySelector('#p5-vibe-toggle-key');
    const modelSelect = panel.querySelector('#p5-vibe-model-select');
    const modelLabel = panel.querySelector('#p5-vibe-model-label');
    const langSelect = panel.querySelector('#p5-vibe-lang-select');
    const btnMinimize = panel.querySelector('#p5-vibe-btn-minimize');
    const promptText = panel.querySelector('#p5-vibe-prompt-text');
    const btnGenerate = panel.querySelector('#p5-vibe-btn-generate');
    const btnUndo = panel.querySelector('#p5-vibe-btn-undo');
    const statusMsg = panel.querySelector('#p5-vibe-status-msg');
    const btnHistory = panel.querySelector('#p5-vibe-btn-history');
    const historyDrawer = panel.querySelector('#p5-vibe-history-drawer');
    const historyList = panel.querySelector('#p5-vibe-history-list');
    const btnClearHistory = panel.querySelector('#p5-vibe-btn-clear-history');
    const chatIndicator = panel.querySelector('#p5-vibe-chat-indicator');
    const btnRefreshModels = panel.querySelector('#p5-vibe-btn-refresh-models');
    const modelInfo = panel.querySelector('#p5-vibe-model-info');
    const autoRunToggle = panel.querySelector('#p5-vibe-autorun-toggle');
    const btnFixError = panel.querySelector('#p5-vibe-btn-fix-error');
    const btnFixErrorText = panel.querySelector('#p5-vibe-btn-fix-error-text');
    const errorBanner = panel.querySelector('#p5-vibe-error-banner');
    const errorTextEl = panel.querySelector('#p5-vibe-error-text');
    const errorBadge = panel.querySelector('#p5-vibe-error-badge');
    const btnErrorInsert = panel.querySelector('#p5-vibe-btn-error-insert');
    const btnErrorInsertText = panel.querySelector('#p5-vibe-btn-error-insert-text');
    const btnErrorDismiss = panel.querySelector('#p5-vibe-btn-error-dismiss');

    let historyNavIndex = -1;
    let draftPrompt = '';
    let currentErrorText = null;

    function showConsoleError(errorText) {
      if (!errorText || !errorText.trim()) return;
      currentErrorText = errorText.trim();
      if (errorTextEl) errorTextEl.textContent = currentErrorText;
      if (errorBanner) errorBanner.style.display = 'block';
      if (btnFixError) btnFixError.classList.add('has-error');
    }

    function hideConsoleError() {
      currentErrorText = null;
      if (errorBanner) errorBanner.style.display = 'none';
      if (btnFixError) btnFixError.classList.remove('has-error');
    }

    async function getLatestErrorText() {
      if (currentErrorText) return currentErrorText;
      // 1. Query page bridge
      try {
        const res = await sendBridgeAction('GET_LAST_ERROR');
        if (res && res.success && res.error) {
          return res.error;
        }
      } catch (e) {}
      // 2. Query DOM directly
      return findConsoleErrorInDom();
    }

    async function handleInsertErrorClick() {
      const err = await getLatestErrorText();
      if (!err) {
        setStatus(t('noErrorDetectedToast'), 'info');
        return;
      }

      const formatted = t('errorPromptPrefix', err);
      const existing = (promptText.value || '').trim();
      if (existing && !existing.includes(err)) {
        promptText.value = `${existing}\n\n${formatted}`;
      } else {
        promptText.value = formatted;
      }

      promptText.focus();
      promptText.setSelectionRange(promptText.value.length, promptText.value.length);
      setStatus(t('errorCopiedToast'), 'success');
      hideConsoleError();
    }

    if (btnFixError) {
      btnFixError.addEventListener('click', handleInsertErrorClick);
    }
    if (btnErrorInsert) {
      btnErrorInsert.addEventListener('click', handleInsertErrorClick);
    }
    if (btnErrorDismiss) {
      btnErrorDismiss.addEventListener('click', hideConsoleError);
    }

    // Connect global hooks for error detection
    window.__p5VibeHandleDetectedError = (err) => {
      showConsoleError(err);
    };

    window.__p5VibeCheckErrors = async () => {
      const err = await getLatestErrorText();
      if (err) {
        showConsoleError(err);
      }
    };

    // Apply language across UI dynamically
    function applyLanguage(lang) {
      config.lang = lang === 'de' ? 'de' : 'en';

      if (pill) pill.title = t('pillTitle');
      if (btnInfo) btnInfo.title = t('btnInfoTitle');
      if (btnInfoClose) btnInfoClose.title = t('btnInfoCloseTitle');
      if (btnSettings) btnSettings.title = t('btnSettingsTitle');
      if (btnMinimize) btnMinimize.title = t('btnMinimizeTitle');
      updateModelBadge(config.model);

      const labelContact = panel.querySelector('#p5-vibe-label-contact');
      if (labelContact) labelContact.textContent = t('infoContactLabel');
      const labelLicense = panel.querySelector('#p5-vibe-label-license');
      if (labelLicense) labelLicense.textContent = t('infoLicenseLabel');
      const valLicense = panel.querySelector('#p5-vibe-val-license');
      if (valLicense) valLicense.textContent = t('infoLicenseValue');
      const labelRepo = panel.querySelector('#p5-vibe-label-repo');
      if (labelRepo) labelRepo.textContent = t('infoRepoLabel');

      const labelKey = panel.querySelector('#p5-vibe-label-key');
      if (labelKey) labelKey.textContent = t('apiKeyLabel');

      if (toggleKeyBtn && keyInput) {
        toggleKeyBtn.title = keyInput.type === 'password' ? t('showPassword') : t('hidePassword');
      }

      const settingsLink = panel.querySelector('#p5-vibe-settings-link');
      if (settingsLink) settingsLink.textContent = t('getKeyLink');

      const labelModel = panel.querySelector('#p5-vibe-label-model');
      if (labelModel) labelModel.textContent = t('modelLabel');

      if (btnRefreshModels) {
        btnRefreshModels.textContent = t('refreshModelsBtn');
        btnRefreshModels.title = t('refreshModelsTitle');
      }

      const labelLang = panel.querySelector('#p5-vibe-label-lang');
      if (labelLang) labelLang.textContent = t('languageLabel');

      if (langSelect && langSelect.value !== config.lang) {
        langSelect.value = config.lang;
      }

      const switchLabel = panel.querySelector('.p5-vibe-switch');
      if (switchLabel) switchLabel.title = t('autoStartTitle');
      const switchText = panel.querySelector('.p5-vibe-switch-text');
      if (switchText) switchText.textContent = t('autoStartText');

      if (btnFixError) btnFixError.title = t('fixErrorBtnTitle');
      if (btnFixErrorText) btnFixErrorText.textContent = t('fixErrorBtn');
      if (errorBadge) errorBadge.textContent = `⚠️ ${t('errorBadge')}`;
      if (btnErrorInsert) btnErrorInsert.title = t('fixErrorBtnTitle');
      if (btnErrorInsertText) btnErrorInsertText.textContent = t('btnInsertError');
      if (btnErrorDismiss) btnErrorDismiss.title = t('dismissErrorTitle');

      const historyHeader = panel.querySelector('#p5-vibe-history-header-title');
      if (historyHeader) historyHeader.textContent = t('historyHeader');

      if (btnClearHistory) btnClearHistory.textContent = t('historyClear');

      updateHistoryButton();
      renderHistoryList();
      updateChatIndicator();

      const genText = panel.querySelector('#p5-vibe-gen-text');
      if (genText && !isGenerating) genText.textContent = t('btnGenerate');

      if (btnUndo) btnUndo.textContent = t('btnUndo');
      updateUndoButtonState();

      if (statusMsg && (statusMsg.textContent.includes('Bereit') || statusMsg.textContent.includes('Ready'))) {
        statusMsg.textContent = t('statusReady');
      }
    }

    // Expose applyLanguage for storage listeners
    panel.__applyLanguage = applyLanguage;

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

    // Info Drawer Toggle
    if (btnInfo && infoDrawer) {
      btnInfo.addEventListener('click', () => {
        const isOpen = infoDrawer.classList.toggle('open');
        btnInfo.classList.toggle('active', isOpen);
        if (isOpen) {
          if (settingsDrawer) {
            settingsDrawer.classList.remove('open');
            if (btnSettings) btnSettings.classList.remove('active');
          }
          if (historyDrawer) {
            historyDrawer.classList.remove('open');
            if (btnHistory) btnHistory.classList.remove('active');
          }
        }
      });
    }

    if (btnInfoClose && infoDrawer) {
      btnInfoClose.addEventListener('click', () => {
        infoDrawer.classList.remove('open');
        if (btnInfo) btnInfo.classList.remove('active');
      });
    }

    // Settings Toggle
    btnSettings.addEventListener('click', () => {
      const isOpen = settingsDrawer.classList.toggle('open');
      btnSettings.classList.toggle('active', isOpen);
      if (isOpen) {
        if (infoDrawer) {
          infoDrawer.classList.remove('open');
          if (btnInfo) btnInfo.classList.remove('active');
        }
        if (historyDrawer) {
          historyDrawer.classList.remove('open');
          if (btnHistory) btnHistory.classList.remove('active');
        }
      }
    });

    // Toggle API Key visibility
    toggleKeyBtn.addEventListener('click', () => {
      if (keyInput.type === 'password') {
        keyInput.type = 'text';
        toggleKeyBtn.textContent = '🔒';
        toggleKeyBtn.title = t('hidePassword');
      } else {
        keyInput.type = 'password';
        toggleKeyBtn.textContent = '👁';
        toggleKeyBtn.title = t('showPassword');
      }
    });

    async function refreshModelList(showFeedback = true) {
      if (!config.apiKey) {
        if (showFeedback && modelInfo) modelInfo.textContent = t('modelInfoEnterKey');
        return;
      }
      if (showFeedback && modelInfo) modelInfo.textContent = t('modelInfoChecking');
      const models = await fetchAvailableModels(config.apiKey);
      if (models && models.length > 0) {
        config.availableModels = models;
        updateDropdown(models);
        if (modelInfo) modelInfo.textContent = t('modelInfoActive', models.length);
      } else {
        if (showFeedback && modelInfo) modelInfo.textContent = t('modelInfoError');
      }
    }

    function updateDropdown(models) {
      if (!modelSelect || !models || models.length === 0) return;
      const currentSelected = config.model;
      modelSelect.innerHTML = '';
      for (const m of models) {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.displayName !== m.id ? `${m.displayName} (${m.id})` : formatModelName(m.id);
        if (m.id === currentSelected) {
          opt.selected = true;
        }
        modelSelect.appendChild(opt);
      }
      if (!modelSelect.value) {
        modelSelect.value = models[0].id;
        config.model = models[0].id;
      }
      updateModelBadge(config.model);
      saveSettings();
    }

    if (btnRefreshModels) {
      btnRefreshModels.addEventListener('click', () => refreshModelList(true));
    }

    // Language Selector Event
    if (langSelect) {
      langSelect.addEventListener('change', () => {
        config.lang = langSelect.value;
        applyLanguage(config.lang);
        browser.storage.local.set({ p5VibeLang: config.lang });
      });
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
      updateModelBadge(config.model);
      saveSettings();
    });

    // Auto-Play Toggle Switch
    if (autoRunToggle) {
      autoRunToggle.checked = config.autoRun;
      autoRunToggle.addEventListener('change', () => {
        config.autoRun = autoRunToggle.checked;
        browser.storage.local.set({ p5VibeAutoRun: config.autoRun });
      });
    }

    function saveSettings() {
      browser.storage.local.set({
        geminiApiKey: config.apiKey,
        geminiModel: config.model,
        p5VibeLang: config.lang
      });
    }

    // Minimize / Expand
    function minimizePanel() {
      panel.classList.add('p5-vibe-hidden');
      pill.classList.add('visible');
    }

    function expandPanel() {
      panel.classList.remove('p5-vibe-hidden');
      pill.classList.remove('visible');
      promptText.focus();
    }

    btnMinimize.addEventListener('click', minimizePanel);
    pill.addEventListener('click', expandPanel);

    // Chat indicator UI
    function updateChatIndicator() {
      if (!chatIndicator) return;
      const turnPairs = Math.floor(chatSession.length / 2);
      if (turnPairs === 0) {
        chatIndicator.className = 'p5-vibe-chat-pill';
        chatIndicator.innerHTML = t('chatIndicatorNew');
        chatIndicator.title = t('chatIndicatorNewTitle');
      } else {
        chatIndicator.className = 'p5-vibe-chat-pill active';
        chatIndicator.innerHTML = `${t('chatIndicatorActive', turnPairs)} <button type="button" class="p5-vibe-btn-reset-chat" id="p5-vibe-btn-reset-chat" title="${t('resetChatTitle')}">×</button>`;
        chatIndicator.title = t('chatIndicatorActiveTitle', turnPairs);

        const btnReset = chatIndicator.querySelector('#p5-vibe-btn-reset-chat');
        if (btnReset) {
          btnReset.addEventListener('click', (e) => {
            e.stopPropagation();
            resetChatSession();
          });
        }
      }
    }

    function resetChatSession() {
      chatSession = [];
      updateChatIndicator();
      setStatus(t('statusChatReset'), 'info');
    }

    // Prompt History UI & Navigation
    function updateHistoryButton() {
      if (!btnHistory) return;
      btnHistory.title = t('historyBtnTitle');
      btnHistory.innerHTML = `${t('historyBtn', promptHistory.length)}`;
    }

    function renderHistoryList() {
      updateHistoryButton();
      if (!historyList) return;
      historyList.innerHTML = '';
      if (promptHistory.length === 0) {
        historyList.innerHTML = `<div class="p5-vibe-history-empty">${t('historyEmpty')}</div>`;
        return;
      }
      promptHistory.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'p5-vibe-history-item';
        div.textContent = item;
        div.title = t('historyItemTitle', item);
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
        if (infoDrawer) {
          infoDrawer.classList.remove('open');
          if (btnInfo) btnInfo.classList.remove('active');
        }
        if (settingsDrawer) {
          settingsDrawer.classList.remove('open');
          if (btnSettings) btnSettings.classList.remove('active');
        }
        renderHistoryList();
      }
    });

    btnClearHistory.addEventListener('click', () => {
      promptHistory = [];
      browser.storage.local.set({ p5VibePromptHistory: [] });
      renderHistoryList();
      setStatus(t('statusHistoryCleared'), 'info');
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
      if (codeHistory.length === 0) {
        setStatus(t('undoTitleEmpty'), 'info');
        return;
      }
      hideConsoleError();
      const prevCode = codeHistory.pop();
      updateUndoButtonState();

      // Rewind chat context by one turn
      if (chatSession.length >= 2) {
        chatSession.splice(-2, 2);
        updateChatIndicator();
      }
      
      setStatus(t('statusRestoring'), 'loading');
      const success = await setEditorCode(prevCode);
      if (success) {
        if (config.autoRun) {
          setTimeout(() => {
            triggerPlaySketch();
          }, 180);
          setStatus(t('statusRestoredRunning'), 'success');
        } else {
          setStatus(t('statusRestoredManual'), 'success');
        }
      } else {
        setStatus(t('statusRestoreError'), 'error');
      }
    });

    function updateUndoButtonState() {
      if (!btnUndo) return;
      btnUndo.disabled = false;
      btnUndo.title = codeHistory.length > 0 
        ? t('undoTitleCount', codeHistory.length)
        : t('undoTitleEmpty');
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
      hideConsoleError();

      const prompt = promptText.value.trim();
      if (!prompt) {
        promptText.focus();
        setStatus(t('statusEnterPrompt'), 'error');
        return;
      }

      if (!config.apiKey) {
        if (infoDrawer) {
          infoDrawer.classList.remove('open');
          if (btnInfo) btnInfo.classList.remove('active');
        }
        settingsDrawer.classList.add('open');
        btnSettings.classList.add('active');
        keyInput.focus();
        setStatus(t('statusEnterKey'), 'error');
        return;
      }

      savePromptToHistory(prompt);

      isGenerating = true;
      btnGenerate.disabled = true;
      panel.querySelector('#p5-vibe-gen-icon').innerHTML = '<span class="p5-vibe-spinner"></span>';
      panel.querySelector('#p5-vibe-gen-text').textContent = t('btnGenerating');
      setStatus(t('statusThinking', formatModelName(config.model)), 'loading');

      try {
        // Read current editor code
        const currentCode = await getEditorCode();

        // 1. Try direct API request from content script (with multi-turn chat context & auto-fallback)
        let response;
        try {
          response = await requestGeminiApi({
            prompt: prompt,
            currentCode: currentCode,
            apiKey: config.apiKey,
            model: config.model,
            chatSession: chatSession,
            onStatusUpdate: (msg) => setStatus(msg, 'loading')
          });
        } catch (directErr) {
          console.warn('[p5-vibe] Direct fetch fallback to background script:', directErr);
          // 2. Fallback to background script if direct fetch fails
          response = await browser.runtime.sendMessage({
            action: 'GENERATE_CODE',
            prompt: prompt,
            currentCode: currentCode,
            apiKey: config.apiKey,
            model: config.model,
            chatSession: chatSession,
            lang: config.lang
          });
        }

        if (response && response.success && response.code) {
          // Keep header badge updated with the exact model used
          if (response.modelUsed) {
            updateModelBadge(response.modelUsed);
          }

          // Record conversational turn in chatSession for multi-turn chat (standard OpenAI format)
          chatSession.push(
            { role: 'user', content: response.userInstruction || prompt },
            { role: 'assistant', content: `\`\`\`javascript\n${response.code}\n\`\`\`` }
          );
          // Keep chat context bounded to last 10 messages (5 exchanges)
          if (chatSession.length > 10) {
            chatSession = chatSession.slice(-10);
          }
          updateChatIndicator();

          // Push previous code onto history for undo
          if (currentCode && currentCode.trim().length > 0) {
            codeHistory.push(currentCode);
            if (codeHistory.length > 20) codeHistory.shift();
            updateUndoButtonState();
          }

          // Inject into p5.js editor
          const setSuccess = await setEditorCode(response.code);

          if (setSuccess) {
            // Clear prompt field so it is clean for the next idea
            promptText.value = '';
            draftPrompt = '';
            historyNavIndex = -1;

            if (response.isTruncated) {
              setStatus(t('statusTruncatedWarning'), 'error');
            } else if (config.autoRun) {
              setTimeout(() => {
                triggerPlaySketch();
              }, 100);
              setTimeout(() => {
                triggerPlaySketch();
              }, 300);
              const modelNotice = response.modelUsed && response.modelUsed !== config.model 
                ? ` (${formatModelName(response.modelUsed)})` 
                : '';
              setStatus(t('statusSuccessRunning', modelNotice), 'success');
            } else {
              const modelNotice = response.modelUsed && response.modelUsed !== config.model 
                ? ` (${formatModelName(response.modelUsed)})` 
                : '';
              setStatus(t('statusSuccessManual', modelNotice), 'success');
            }
          } else {
            try {
              await navigator.clipboard.writeText(response.code);
              setStatus(t('statusClipboard'), 'error');
            } catch (clipErr) {
              setStatus(t('statusInjectError'), 'error');
            }
          }
        } else {
          const errMsg = response?.error || (config.lang === 'en' ? 'Unknown error during code generation.' : 'Unbekannter Fehler bei der Generierung.');
          setStatus(`⚠️ ${errMsg}`, 'error');
        }
      } catch (err) {
        const msg = err.message || '';
        if (msg.includes('Receiving end does not exist') || msg.includes('Extension context invalidated') || msg.includes('Could not establish connection')) {
          setStatus(t('statusExtensionUpdated'), 'error');
        } else {
          setStatus(`⚠️ ${config.lang === 'en' ? 'Error: ' : 'Fehler: '}${msg}`, 'error');
        }
      } finally {
        isGenerating = false;
        btnGenerate.disabled = false;
        panel.querySelector('#p5-vibe-gen-icon').textContent = '⚡';
        panel.querySelector('#p5-vibe-gen-text').textContent = t('btnGenerate');
      }
    }
  }

  // 5. Load Settings from Storage
  function loadSavedSettings() {
    browser.storage.local.get([
      'geminiApiKey',
      'geminiModel',
      'p5VibePosition',
      'p5VibePromptHistory',
      'p5VibeAutoRun',
      'p5VibeLang'
    ]).then((data) => {
      const panel = document.getElementById('p5-vibe-panel');
      const pill = document.getElementById('p5-vibe-pill');
      const keyInput = document.getElementById('p5-vibe-key-input');
      const modelSelect = document.getElementById('p5-vibe-model-select');
      const modelLabel = document.getElementById('p5-vibe-model-label');
      const historyCount = document.getElementById('p5-vibe-history-count');
      const autoRunToggle = document.getElementById('p5-vibe-autorun-toggle');

      if (data.p5VibeLang === 'en' || data.p5VibeLang === 'de') {
        config.lang = data.p5VibeLang;
      } else {
        config.lang = 'en';
      }
      if (panel && typeof panel.__applyLanguage === 'function') {
        panel.__applyLanguage(config.lang);
      }

      if (typeof data.p5VibeAutoRun === 'boolean') {
        config.autoRun = data.p5VibeAutoRun;
      } else {
        config.autoRun = true; // default: ON
      }
      if (autoRunToggle) {
        autoRunToggle.checked = config.autoRun;
      }

      if (Array.isArray(data.p5VibePromptHistory)) {
        promptHistory = data.p5VibePromptHistory;
        const btnHistory = document.getElementById('p5-vibe-btn-history');
        if (btnHistory) {
          btnHistory.innerHTML = `${t('historyBtn', promptHistory.length)}`;
        }
      }

      if (data.geminiApiKey) {
        config.apiKey = data.geminiApiKey;
        if (keyInput) keyInput.value = data.geminiApiKey;
        fetchAvailableModels(data.geminiApiKey).then((models) => {
          if (models && models.length > 0) {
            config.availableModels = models;
            const modelInfo = document.getElementById('p5-vibe-model-info');
            if (modelInfo) modelInfo.textContent = t('modelInfoActive', models.length);
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
              updateModelBadge(config.model);
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
      updateModelBadge(config.model);

      if (data.p5VibePosition && panel) {
        if (data.p5VibePosition.left) panel.style.left = data.p5VibePosition.left;
        if (data.p5VibePosition.top) panel.style.top = data.p5VibePosition.top;
        if (data.p5VibePosition.left) panel.style.right = 'auto';
      }
    });
  }

  // Cross-context storage listener (keeps in-page panel synced with toolbar popup settings)
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      const panel = document.getElementById('p5-vibe-panel');
      if (changes.p5VibeLang && changes.p5VibeLang.newValue) {
        config.lang = changes.p5VibeLang.newValue;
        if (panel && typeof panel.__applyLanguage === 'function') {
          panel.__applyLanguage(config.lang);
        }
      }
      if (changes.geminiApiKey && changes.geminiApiKey.newValue !== undefined) {
        config.apiKey = changes.geminiApiKey.newValue;
        const keyInput = document.getElementById('p5-vibe-key-input');
        if (keyInput) keyInput.value = config.apiKey;
      }
      if (changes.geminiModel && changes.geminiModel.newValue !== undefined) {
        config.model = changes.geminiModel.newValue;
        const modelSelect = document.getElementById('p5-vibe-model-select');
        if (modelSelect) modelSelect.value = config.model;
        updateModelBadge(config.model);
      }
      if (changes.p5VibeAutoRun && typeof changes.p5VibeAutoRun.newValue === 'boolean') {
        config.autoRun = changes.p5VibeAutoRun.newValue;
        const autoRunToggle = document.getElementById('p5-vibe-autorun-toggle');
        if (autoRunToggle) autoRunToggle.checked = config.autoRun;
      }
    }
  });

  // Initialize
  injectBridge();
  createUI();
})();
