/**
 * p5.js Vibe Coder - Background Service Worker / Script
 * Handles Gemini API requests and storage management.
 */

const DEFAULT_MODEL = 'gemini-2.0-flash';

// Listen for messages from content script and popup (Promise-based for Firefox WebExtensions)
browser.runtime.onMessage.addListener((message, sender) => {
  if (message.action === 'GENERATE_CODE') {
    return handleGenerateCode(message);
  }

  if (message.action === 'GET_CONFIG') {
    return browser.storage.local.get(['geminiApiKey', 'geminiModel', 'p5VibeLang'])
      .then(res => ({
        apiKey: res.geminiApiKey || '',
        model: res.geminiModel || DEFAULT_MODEL,
        lang: res.p5VibeLang || 'de'
      }))
      .catch(err => ({ error: err.message }));
  }

  if (message.action === 'SAVE_CONFIG') {
    const toSet = {
      geminiApiKey: message.apiKey,
      geminiModel: message.model || DEFAULT_MODEL
    };
    if (message.lang) toSet.p5VibeLang = message.lang;
    return browser.storage.local.set(toSet)
      .then(() => ({ success: true }))
      .catch(err => ({ success: false, error: err.message }));
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
      const codePart = afterFirst.slice(lineEnd + 1);
      const closingFence = codePart.lastIndexOf('```');
      if (closingFence !== -1) {
        return codePart.slice(0, closingFence).trim();
      } else {
        // Output was cut off before closing fence was written
        return codePart.trim();
      }
    }
  }

  return text;
}

/**
 * Call the Google Gemini API to generate or modify p5.js code
 */
async function handleGenerateCode({ prompt, currentCode, mode, apiKey, model, chatSession, lang = 'de' }) {
  const isEn = (lang === 'en');
  if (!apiKey || !apiKey.trim()) {
    return {
      success: false,
      error: isEn
        ? 'Please enter your Gemini API key in settings first (gear icon).'
        : 'Bitte trage zuerst deinen Gemini API-Key in den Einstellungen ein (Zahnrad-Symbol).'
    };
  }

  let baseModel = model || DEFAULT_MODEL;
  if (baseModel.includes('2.5-flash')) baseModel = 'gemini-2.0-flash';
  if (baseModel.includes('2.5-pro')) baseModel = 'gemini-3.8-pro';

  const cascade = [baseModel];
  for (const alt of ['gemini-2.0-flash', 'gemini-3.8-flash']) {
    if (!cascade.includes(alt)) cascade.push(alt);
  }

  let lastError = null;

  for (const currentModel of cascade) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(currentModel)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

    let userInstruction = '';
    const hasHistory = chatSession && chatSession.length > 0;
    const hasExistingCode = currentCode && currentCode.trim().length > 30;

    if (hasHistory) {
      userInstruction = isEn
        ? `Follow-up instruction in chat: "${prompt}"\n\nCurrent code in web editor:\n\`\`\`javascript\n${currentCode}\n\`\`\`\n\nPlease adapt the code based on the previous conversation and this instruction. Return the complete updated p5.js code.`
        : `Folge-Anweisung im Chat: "${prompt}"\n\nAktueller Code im Webeditor:\n\`\`\`javascript\n${currentCode}\n\`\`\`\n\nBitte passe den Code basierend auf dem bisherigen Chat-Verlauf und dieser Anweisung an. Gib den vollständigen p5.js Code zurück.`;
    } else if (hasExistingCode) {
      userInstruction = isEn
        ? `Here is the current p5.js sketch:\n\`\`\`javascript\n${currentCode}\n\`\`\`\n\nModify or extend the sketch based on the following request:\n"${prompt}"\n\nReturn the complete, revised JavaScript code containing all functions (setup, draw etc.).`
        : `Hier ist der aktuelle p5.js Sketch:\n\`\`\`javascript\n${currentCode}\n\`\`\`\n\nÄndere oder erweitere den Sketch basierend auf folgendem Wunsch:\n"${prompt}"\n\nGib den vollständigen, überarbeiteten JavaScript-Code zurück, der alle Funktionen enthält (setup, draw etc.).`;
    } else {
      userInstruction = isEn
        ? `Create a new, complete p5.js sketch based on the following idea:\n\n"${prompt}"\n\nReturn the complete JavaScript code.`
        : `Erstelle einen neuen, vollständigen p5.js Sketch basierend auf folgender Idee:\n\n"${prompt}"\n\nGib den vollständigen JavaScript-Code zurück.`;
    }

    const currentTurn = { role: 'user', parts: [{ text: userInstruction }] };
    const contents = [...(chatSession || []), currentTurn];

    const systemText = isEn
      ? `You are a brilliant Creative Coder and p5.js specialist in an interactive chat.
Your task is to generate high-quality, aesthetic and bug-free p5.js code (JavaScript) for the p5.js web editor.

RULES:
1. Return EXCLUSIVELY executable JavaScript code for the p5.js web editor.
2. No explanations before or after the code, no markdown commentary outside fences, no polite phrases.
3. Code MUST include standard p5.js functions like setup() and draw() (if animated/interactive).
4. Ensure smooth 60 FPS performance and proper canvas initialization (e.g. createCanvas(400, 400) or windowWidth/windowHeight as appropriate).
5. Use beautiful colors, clever math (sin, cos, noise, lerp) or interactive elements (mouseX, mouseY, keys) when appropriate for the prompt.
6. Consider previous conversation messages and seamlessly build upon them.
7. For large sketches, write clean and token-efficient code without redundant verbose comments to stay safely within output token limits.`
      : `Du bist ein brillanter Creative Coder und p5.js Spezialist in einem interaktiven Chat.
Deine Aufgabe ist es, hochwertigen, ästhetischen und fehlerfreien p5.js Code (JavaScript) für den p5.js Web-Editor zu generieren.

REGELN:
1. Gib AUSSCHLIESSLICH den ausführbaren JavaScript-Code für den p5.js Webeditor zurück.
2. Keine Erklärungen vor oder nach dem Code, kein Begleittext, keine Höflichkeitsfloskeln.
3. Der Code MUSS standardmäßige p5.js Methoden enthalten wie setup() und draw() (sofern animiert/interaktiv).
4. Sorge für flüssige 60 FPS Performance und saubere Canvas-Initialisierung (z.B. createCanvas(400, 400) oder windowWidth/windowHeight falls passend).
5. Nutze schöne Farben, clevere mathematische Formeln (sin, cos, noise, lerp) oder interaktive Elemente (mouseX, mouseY, Tasten), wenn es zum Prompt passt.
6. Berücksichtige vorherige Nachrichten und baue nahtlos darauf auf.
7. Schreibe bei umfangreichen Sketchen sauberen und token-effizienten Code ohne überflüssige redundante Kommentare, um das Token-Limit nicht zu überschreiten.`;

    const requestBody = {
      contents: contents,
      systemInstruction: {
        parts: [{
          text: systemText
        }]
      },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192
      }
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
        lastError = errorMsg;
        const low = errorMsg.toLowerCase();
        if (low.includes('api key') && !low.includes('quota')) {
          return {
            success: false,
            error: isEn
              ? 'Invalid Gemini API key. Please check your key in settings.'
              : 'Ungültiger Gemini API-Key. Bitte überprüfe deinen Key.'
          };
        }
        // Try next model if high demand / overloaded
        continue;
      }

      const candidate = data.candidates?.[0];
      if (!candidate || !candidate.content?.parts?.[0]?.text) {
        continue;
      }

      const rawCode = candidate.content.parts[0].text;
      const finalCode = cleanGeneratedCode(rawCode);
      const isTruncated = candidate.finishReason === 'MAX_TOKENS';
      if (isTruncated) {
        console.warn('[p5-vibe] Gemini response hit maxOutputTokens (8192) in background script!');
      }

      return {
        success: true,
        code: finalCode,
        modelUsed: currentModel,
        isTruncated
      };
    } catch (networkError) {
      lastError = networkError.message;
    }
  }

  return {
    success: false,
    error: isEn
      ? `Gemini API error: ${lastError || 'All models are currently overloaded.'}`
      : `Gemini API Fehler: ${lastError || 'Alle Modelle sind momentan überlastet.'}`
  };
}
