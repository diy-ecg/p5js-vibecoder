/**
 * p5.js Vibe Coder - Background Service Worker / Script
 * Handles Gemini API requests and storage management.
 */

// Cross-browser compatibility polyfill (Firefox 'browser' vs Chromium 'chrome')
const browser = globalThis.browser || globalThis.chrome;

// Import shared AI transformer module
try {
  importScripts('lib/ai-transformer.js');
} catch (e) {
  console.warn('[p5-vibe-bg] importScripts note:', e);
}

const transformer = globalThis.__p5VibeAiTransformer;
const DEFAULT_MODEL = 'gemini-2.0-flash';

// Listen for messages from content script and popup (Universal Promise & sendResponse handler)
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'GENERATE_CODE') {
    handleGenerateCode(message)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async response in Chromium
  }

  if (message.action === 'GET_CONFIG') {
    browser.storage.local.get(['geminiApiKey', 'geminiModel', 'p5VibeLang'])
      .then(res => sendResponse({
        apiKey: res.geminiApiKey || '',
        model: res.geminiModel || DEFAULT_MODEL,
        lang: res.p5VibeLang || 'en'
      }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (message.action === 'SAVE_CONFIG') {
    const toSet = {
      geminiApiKey: message.apiKey,
      geminiModel: message.model || DEFAULT_MODEL
    };
    if (message.lang) toSet.p5VibeLang = message.lang;
    browser.storage.local.set(toSet)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

/**
 * Clean up markdown codeblocks and formatting from AI response (delegate to transformer)
 */
function cleanGeneratedCode(rawText) {
  return transformer ? transformer.cleanGeneratedCode(rawText) : (rawText || '').trim();
}

/**
 * Call the AI API (via OpenAI-compatible standard endpoint) to generate or modify p5.js code
 */
async function handleGenerateCode({ prompt, currentCode, mode, apiKey, model, chatSession, lang = 'en' }) {
  const isEn = (lang === 'en');
  if (!apiKey || !apiKey.trim()) {
    return {
      success: false,
      error: isEn
        ? 'Please enter your API key in settings first (gear icon).'
        : 'Bitte trage zuerst deinen API-Key in den Einstellungen ein (Zahnrad-Symbol).'
    };
  }

  let baseModel = model || DEFAULT_MODEL;
  if (baseModel.includes('2.5-flash')) baseModel = 'gemini-2.0-flash';
  if (baseModel.includes('2.5-pro')) baseModel = 'gemini-3.8-pro';

  const cascade = [baseModel];
  for (const alt of ['gemini-2.0-flash', 'gemini-3.8-flash']) {
    if (!cascade.includes(alt)) cascade.push(alt);
  }

  // Format messages via standard OpenAI contract
  const { messages, userInstruction } = transformer.buildOpenAiMessages({
    prompt,
    currentCode,
    chatSession,
    lang
  });

  let lastError = null;

  for (const currentModel of cascade) {
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
    const requestBody = transformer.buildOpenAiRequestBody({
      model: currentModel,
      messages,
      temperature: 0.7,
      maxTokens: 8192
    });

    try {
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
        lastError = transformer.parseApiError(response.status, data);
        if (response.status === 401 || response.status === 403) {
          return { success: false, error: lastError };
        }
        // Try next model if overloaded (429 or 500+)
        continue;
      }

      const parsed = transformer.parseOpenAiResponse(data);
      if (!parsed.success || !parsed.code) {
        lastError = parsed.error || 'Empty response from model';
        continue;
      }

      return {
        success: true,
        code: parsed.code,
        modelUsed: currentModel,
        userInstruction: userInstruction,
        isTruncated: parsed.isTruncated
      };
    } catch (networkError) {
      lastError = networkError.message;
    }
  }

  return {
    success: false,
    error: lastError || (isEn ? 'All models are currently overloaded.' : 'Alle Modelle sind momentan überlastet.')
  };
}
