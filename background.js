/**
 * p5.js Vibe Coder - Background Service Worker / Script
 * Handles Gemini API requests and storage management.
 */

const DEFAULT_MODEL = 'gemini-2.5-flash';

// Listen for messages from content script and popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'GENERATE_CODE') {
    handleGenerateCode(message)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message || 'Unbekannter Fehler' }));
    return true; // Keep message channel open for async response
  }

  if (message.action === 'GET_CONFIG') {
    browser.storage.local.get(['geminiApiKey', 'geminiModel'])
      .then(res => {
        sendResponse({
          apiKey: res.geminiApiKey || '',
          model: res.geminiModel || DEFAULT_MODEL
        });
      })
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (message.action === 'SAVE_CONFIG') {
    browser.storage.local.set({
      geminiApiKey: message.apiKey,
      geminiModel: message.model || DEFAULT_MODEL
    })
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

/**
 * Clean up markdown codeblocks and formatting from AI response
 */
function cleanGeneratedCode(rawText) {
  if (!rawText) return '';
  let text = rawText.trim();

  // Strip ```javascript or ```js or ``` code fence at start
  const codeBlockRegex = /^```(?:javascript|js|p5|p5js)?\s*\n([\s\S]*?)\n```$/i;
  const match = text.match(codeBlockRegex);
  if (match) {
    return match[1].trim();
  }

  // If there are multiple fences or text around fences, find the primary block
  const firstFence = text.indexOf('```');
  if (firstFence !== -1) {
    const afterFirst = text.slice(firstFence);
    const lineEnd = afterFirst.indexOf('\n');
    if (lineEnd !== -1) {
      const closingFence = afterFirst.indexOf('```', lineEnd);
      if (closingFence !== -1) {
        return afterFirst.slice(lineEnd + 1, closingFence).trim();
      }
    }
  }

  return text;
}

/**
 * Call the Google Gemini API to generate or modify p5.js code
 */
async function handleGenerateCode({ prompt, currentCode, mode, apiKey, model }) {
  if (!apiKey || !apiKey.trim()) {
    return {
      success: false,
      error: 'Bitte trage zuerst deinen Gemini API-Key in den Einstellungen ein (Zahnrad-Symbol).'
    };
  }

  const selectedModel = model || DEFAULT_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  // Build appropriate instructions based on mode
  let userInstruction = '';
  if (mode === 'create' || !currentCode || currentCode.trim().length === 0) {
    userInstruction = `Erstelle einen neuen, vollständigen p5.js Sketch basierend auf folgender Idee:\n\n"${prompt}"\n\nGib den vollständigen JavaScript-Code zurück.`;
  } else {
    userInstruction = `Hier ist der aktuelle p5.js Sketch:\n\`\`\`javascript\n${currentCode}\n\`\`\`\n\nÄndere oder erweitere den Sketch basierend auf folgendem Wunsch:\n"${prompt}"\n\nGib den vollständigen, überarbeiteten JavaScript-Code zurück, der alle Funktionen enthält (setup, draw etc.).`;
  }

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: userInstruction }
        ]
      }
    ],
    systemInstruction: {
      parts: [
        {
          text: `Du bist ein brillanter Creative Coder und p5.js Spezialist.
Deine Aufgabe ist es, hochwertigen, ästhetischen und fehlerfreien p5.js Code (JavaScript) für den p5.js Web-Editor zu generieren.

REGELN:
1. Gib AUSSCHLIESSLICH den ausführbaren JavaScript-Code für den p5.js Webeditor zurück.
2. Keine Erklärungen vor oder nach dem Code, kein Begleittext, keine Höflichkeitsfloskeln.
3. Der Code MUSS standardmäßige p5.js Methoden enthalten wie setup() und draw() (sofern animiert/interaktiv).
4. Sorge für flüssige 60 FPS Performance und saubere Canvas-Initialisierung (z.B. createCanvas(400, 400) oder windowWidth/windowHeight falls passend).
5. Nutze schöne Farben, clevere mathematische Formeln (sin, cos, noise, lerp) oder interaktive Elemente (mouseX, mouseY, Tasten), wenn es zum Prompt passt.`
        }
      ]
    },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192
    }
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      if (response.status === 400 && errorMsg.includes('API key')) {
        return { success: false, error: 'Ungültiger Gemini API-Key. Bitte überprüfe deinen Key.' };
      }
      if (response.status === 429) {
        return { success: false, error: 'Gemini Rate-Limit erreicht (Zu viele Anfragen). Bitte warte kurz.' };
      }
      return { success: false, error: `Gemini API Fehler: ${errorMsg}` };
    }

    const candidate = data.candidates?.[0];
    if (!candidate || !candidate.content?.parts?.[0]?.text) {
      const blockReason = candidate?.finishReason || 'Keine Antwort erhalten';
      return { success: false, error: `Kein Code generiert (${blockReason}).` };
    }

    const rawCode = candidate.content.parts[0].text;
    const finalCode = cleanGeneratedCode(rawCode);

    return {
      success: true,
      code: finalCode
    };
  } catch (networkError) {
    return {
      success: false,
      error: `Netzwerkfehler: ${networkError.message || 'Verbindung zu Google Gemini fehlgeschlagen.'}`
    };
  }
}
