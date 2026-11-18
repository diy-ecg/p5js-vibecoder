/**
 * p5.js Vibe Coder - Extension Popup Script
 * Fully bilingual (DE / EN) settings management
 */

// Cross-browser compatibility polyfill (Firefox 'browser' vs Chromium 'chrome')
const browser = globalThis.browser || globalThis.chrome;

const POPUP_I18N = {
  de: {
    statusLoading: 'Wird geladen...',
    statusReady: 'Bereit für den Webeditor',
    statusNoKey: 'API-Key fehlt noch',
    apiKeyLabel: 'Gemini API-Key',
    showKeyTitle: 'Passwort anzeigen',
    hideKeyTitle: 'Passwort verbergen',
    getKeyLink: 'Kostenlosen Key bei Google AI Studio holen ↗',
    modelLabel: 'Gemini Modell',
    langLabel: 'Sprache / Language',
    tokensLabel: 'Max. Ausgabetokens',
    btnSave: 'Einstellungen speichern',
    saveSuccess: '✓ Gespeichert!',
    saveError: 'Fehler beim Speichern: ',
    shortcutsTitle: 'Tastatur-Shortcuts',
    shortcutGen: 'Code generieren',
    shortcutToggle: 'Panel anzeigen / minimieren',
    openEditor: 'p5.js Webeditor öffnen ↗',
    tokens: {
      '8192': '8.192 Tokens (Standard)',
      '16384': '16.384 Tokens (Empfohlen)',
      '32768': '32.768 Tokens (Große Skripte)',
      '65536': '65.536 Tokens (Maximum)'
    },
    models: {
      'gemini-2.0-flash': 'Gemini 2.0 Flash (Sehr stabil & schnell – Empfohlen)',
      'gemini-3.8-flash': 'Gemini 3.8 Flash (Neueste Generation)',
      'gemini-1.5-flash': 'Gemini 1.5 Flash (Klassisch)',
      'gemini-3.8-pro': 'Gemini 3.8 Pro'
    }
  },
  en: {
    statusLoading: 'Loading...',
    statusReady: 'Ready for Web Editor',
    statusNoKey: 'API key missing',
    apiKeyLabel: 'Gemini API Key',
    showKeyTitle: 'Show password',
    hideKeyTitle: 'Hide password',
    getKeyLink: 'Get free key from Google AI Studio ↗',
    modelLabel: 'Gemini Model',
    langLabel: 'Language / Sprache',
    tokensLabel: 'Max Output Tokens',
    btnSave: 'Save Settings',
    saveSuccess: '✓ Saved!',
    saveError: 'Error saving: ',
    shortcutsTitle: 'Keyboard Shortcuts',
    shortcutGen: 'Generate code',
    shortcutToggle: 'Toggle panel display',
    openEditor: 'Open p5.js Web Editor ↗',
    tokens: {
      '8192': '8,192 tokens (Default)',
      '16384': '16,384 tokens (Recommended)',
      '32768': '32,768 tokens (Large sketches)',
      '65536': '65,536 tokens (Maximum)'
    },
    models: {
      'gemini-2.0-flash': 'Gemini 2.0 Flash (Fast & reliable – Recommended)',
      'gemini-3.8-flash': 'Gemini 3.8 Flash (Latest generation)',
      'gemini-1.5-flash': 'Gemini 1.5 Flash (Classic)',
      'gemini-3.8-pro': 'Gemini 3.8 Pro'
    }
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  const keyInput = document.getElementById('gemini-key');
  const btnToggleKey = document.getElementById('btn-toggle-key');
  const modelSelect = document.getElementById('gemini-model');
  const langSelect = document.getElementById('app-lang');
  const tokensSelect = document.getElementById('gemini-tokens');
  const btnSave = document.getElementById('btn-save');
  const saveMsg = document.getElementById('save-msg');
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');

  let currentLang = 'en';

  function applyPopupLanguage(lang) {
    currentLang = lang === 'de' ? 'de' : 'en';
    const t = POPUP_I18N[currentLang];

    if (langSelect && langSelect.value !== currentLang) {
      langSelect.value = currentLang;
    }

    const labelKey = document.getElementById('popup-label-key');
    if (labelKey) labelKey.textContent = t.apiKeyLabel;

    const linkKey = document.getElementById('popup-link-key');
    if (linkKey) linkKey.textContent = t.getKeyLink;

    const labelModel = document.getElementById('popup-label-model');
    if (labelModel) labelModel.textContent = t.modelLabel;

    const labelLang = document.getElementById('popup-label-lang');
    if (labelLang) labelLang.textContent = t.langLabel;

    const labelTokens = document.getElementById('popup-label-tokens');
    if (labelTokens) labelTokens.textContent = t.tokensLabel;

    if (btnSave) btnSave.textContent = t.btnSave;

    const shortcutsTitle = document.getElementById('popup-shortcuts-title');
    if (shortcutsTitle) shortcutsTitle.textContent = t.shortcutsTitle;

    const shortcutGen = document.getElementById('shortcut-desc-generate');
    if (shortcutGen) shortcutGen.textContent = t.shortcutGen;

    const shortcutToggle = document.getElementById('shortcut-desc-toggle');
    if (shortcutToggle) shortcutToggle.textContent = t.shortcutToggle;

    const linkEditor = document.getElementById('popup-link-editor');
    if (linkEditor) linkEditor.textContent = t.openEditor;

    if (btnToggleKey && keyInput) {
      btnToggleKey.title = keyInput.type === 'password' ? t.showKeyTitle : t.hideKeyTitle;
    }

    // Translate model dropdown options while preserving selected value
    if (modelSelect) {
      const selectedVal = modelSelect.value;
      Array.from(modelSelect.options).forEach((opt) => {
        if (t.models[opt.value]) {
          opt.textContent = t.models[opt.value];
        }
      });
      if (selectedVal) modelSelect.value = selectedVal;
    }

    // Translate tokens dropdown options while preserving selected value
    if (tokensSelect) {
      const selectedTokens = tokensSelect.value;
      Array.from(tokensSelect.options).forEach((opt) => {
        if (t.tokens && t.tokens[opt.value]) {
          opt.textContent = t.tokens[opt.value];
        }
      });
      if (selectedTokens) tokensSelect.value = selectedTokens;
    }

    // Refresh status indicator text
    updateStatus(!!(keyInput && keyInput.value.trim()));
  }

  function updateStatus(hasKey) {
    const t = POPUP_I18N[currentLang];
    if (hasKey) {
      statusIndicator.className = 'status-indicator ready';
      statusText.textContent = t.statusReady;
    } else {
      statusIndicator.className = 'status-indicator';
      statusText.textContent = t.statusNoKey;
    }
  }

  // Load existing settings
  try {
    const data = await browser.storage.local.get(['geminiApiKey', 'geminiModel', 'p5VibeLang', 'p5VibeMaxTokens']);

    if (data.p5VibeLang === 'en' || data.p5VibeLang === 'de') {
      currentLang = data.p5VibeLang;
    } else {
      currentLang = 'en';
    }

    if (data.geminiApiKey) {
      keyInput.value = data.geminiApiKey;
    }

    if (data.p5VibeMaxTokens && tokensSelect) {
      tokensSelect.value = String(data.p5VibeMaxTokens);
    }

    if (data.geminiModel) {
      let m = data.geminiModel;
      if (m.includes('2.5-flash')) m = 'gemini-2.0-flash';
      if (m.includes('2.5-pro')) m = 'gemini-3.8-pro';
      modelSelect.value = m;
      if (m !== data.geminiModel) {
        browser.storage.local.set({ geminiModel: m });
      }
    }

    applyPopupLanguage(currentLang);
  } catch (err) {
    console.error('Error loading popup settings:', err);
  }

  // Language change handler
  if (langSelect) {
    langSelect.addEventListener('change', () => {
      currentLang = langSelect.value;
      applyPopupLanguage(currentLang);
      browser.storage.local.set({ p5VibeLang: currentLang });
    });
  }

  // Toggle API key visibility
  btnToggleKey.addEventListener('click', () => {
    const t = POPUP_I18N[currentLang];
    if (keyInput.type === 'password') {
      keyInput.type = 'text';
      btnToggleKey.textContent = '🔒';
      btnToggleKey.title = t.hideKeyTitle;
    } else {
      keyInput.type = 'password';
      btnToggleKey.textContent = '👁';
      btnToggleKey.title = t.showKeyTitle;
    }
  });

  // Save settings
  btnSave.addEventListener('click', async () => {
    const t = POPUP_I18N[currentLang];
    const apiKey = keyInput.value.trim();
    const model = modelSelect.value;
    const lang = langSelect ? langSelect.value : currentLang;
    const maxTokens = tokensSelect ? (parseInt(tokensSelect.value, 10) || 16384) : 16384;

    try {
      await browser.storage.local.set({
        geminiApiKey: apiKey,
        geminiModel: model,
        p5VibeLang: lang,
        p5VibeMaxTokens: maxTokens
      });

      updateStatus(!!apiKey);
      saveMsg.textContent = t.saveSuccess;
      saveMsg.style.color = '#10b981';
      setTimeout(() => {
        saveMsg.textContent = '';
      }, 2500);
    } catch (err) {
      saveMsg.textContent = t.saveError + err.message;
      saveMsg.style.color = '#ef4444';
    }
  });

  // Keep synced if modified elsewhere
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.p5VibeLang && changes.p5VibeLang.newValue) {
        currentLang = changes.p5VibeLang.newValue;
        applyPopupLanguage(currentLang);
      }
      if (changes.geminiApiKey && changes.geminiApiKey.newValue !== undefined) {
        keyInput.value = changes.geminiApiKey.newValue;
        updateStatus(!!keyInput.value.trim());
      }
      if (changes.geminiModel && changes.geminiModel.newValue !== undefined) {
        modelSelect.value = changes.geminiModel.newValue;
      }
      if (changes.p5VibeMaxTokens && changes.p5VibeMaxTokens.newValue !== undefined && tokensSelect) {
        tokensSelect.value = String(changes.p5VibeMaxTokens.newValue);
      }
    }
  });
});
