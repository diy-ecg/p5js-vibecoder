/**
 * p5.js Vibe Coder - AI Request & Response Transformer
 * Shared transformer logic for OpenAI-compatible APIs (Google Gemini, Mistral, Groq, Ollama)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node.js / CommonJS environment (for automated tests)
    module.exports = factory();
  } else {
    // Browser global / content script / background worker
    root.__p5VibeAiTransformer = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  /**
   * Cleans raw AI output to extract pure, executable p5.js JavaScript.
   * Strips markdown code fences (```javascript ... ```), unclosed fences, or commentary.
   */
  function cleanGeneratedCode(rawText) {
    if (!rawText) return '';
    let text = rawText.trim();
    
    // 1. Direct standard markdown code block: ```javascript\n...\n```
    const codeBlockRegex = /^```(?:javascript|js|p5|p5js)?\s*\n([\s\S]*?)\n```$/i;
    const match = text.match(codeBlockRegex);
    if (match) return match[1].trim();

    // 2. Code block surrounded by conversational text before/after
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
          // Output was cut off before closing fence was written (truncated by token limit)
          return codePart.trim();
        }
      }
    }
    
    // 3. Fallback: already raw code without fences
    return text;
  }

  /**
   * System prompt instructing the AI model to behave as a p5.js specialist
   */
  function buildSystemPrompt(lang = 'en') {
    const isEn = lang === 'en';
    return isEn
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
6. Berücksichtige die bisherige Unterhaltung und baue nahtlos auf vorherigen Anweisungen auf.
7. Schreibe bei umfangreichen Sketchen sauberen und token-effizienten Code ohne überflüssige redundante Kommentare, um das Token-Limit nicht zu überschreiten.`;
  }

  /**
   * Formats user instruction based on whether there's existing code and prior chat history
   */
  function buildUserInstruction({ prompt, currentCode, hasChatHistory = false, lang = 'en' }) {
    const isEn = lang === 'en';
    const hasExistingCode = Boolean(currentCode && currentCode.trim().length > 0);

    if (hasChatHistory && hasExistingCode) {
      return isEn
        ? `Follow-up instruction in ongoing chat: "${prompt}"\n\nCurrent code in web editor:\n\`\`\`javascript\n${currentCode}\n\`\`\`\n\nPlease update the code based on the previous conversation and this instruction. Return the complete, updated p5.js code.`
        : `Folge-Anweisung im laufenden Chat: "${prompt}"\n\nAktueller Code im Webeditor:\n\`\`\`javascript\n${currentCode}\n\`\`\`\n\nBitte passe den Code basierend auf dem bisherigen Chat-Verlauf und dieser Anweisung an. Gib den vollständigen p5.js Code zurück.`;
    } else if (hasExistingCode) {
      return isEn
        ? `Here is the current p5.js sketch:\n\`\`\`javascript\n${currentCode}\n\`\`\`\n\nModify or extend the sketch based on the following request:\n"${prompt}"\n\nReturn the complete, revised JavaScript code containing all functions (setup, draw etc.).`
        : `Hier ist der aktuelle p5.js Sketch:\n\`\`\`javascript\n${currentCode}\n\`\`\`\n\nÄndere oder erweitere den Sketch basierend auf folgendem Wunsch:\n"${prompt}"\n\nGib den vollständigen, überarbeiteten JavaScript-Code zurück, der alle Funktionen enthält (setup, draw etc.).`;
    } else {
      return isEn
        ? `Create a new, complete p5.js sketch based on the following idea:\n\n"${prompt}"\n\nReturn the complete JavaScript code.`
        : `Erstelle einen neuen, vollständigen p5.js Sketch basierend auf folgender Idee:\n\n"${prompt}"\n\nGib den vollständigen JavaScript-Code zurück.`;
    }
  }

  /**
   * Builds OpenAI-compatible messages array from system prompt, history, and user input
   */
  function buildOpenAiMessages({ prompt, currentCode, chatSession = [], lang = 'en' }) {
    const messages = [];

    // 1. System prompt
    messages.push({
      role: 'system',
      content: buildSystemPrompt(lang)
    });

    // 2. Chat history (turns formatted as { role: 'user'|'assistant', content: string })
    if (Array.isArray(chatSession)) {
      for (const turn of chatSession) {
        if (!turn || !turn.role || !turn.content) continue;
        messages.push({
          role: turn.role,
          content: turn.content
        });
      }
    }

    // 3. Current user instruction
    const hasChatHistory = chatSession && chatSession.length > 0;
    const userInstruction = buildUserInstruction({
      prompt,
      currentCode,
      hasChatHistory,
      lang
    });

    messages.push({
      role: 'user',
      content: userInstruction
    });

    return {
      messages,
      userInstruction
    };
  }

  /**
   * Builds the complete OpenAI-compatible request body
   */
  function buildOpenAiRequestBody({ model, messages, temperature = 0.7, maxTokens = 8192 }) {
    return {
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    };
  }

  /**
   * Parses an OpenAI-compatible JSON response
   */
  function parseOpenAiResponse(data) {
    if (!data) {
      return { success: false, error: 'Empty response data from AI provider' };
    }

    // Check for provider error in body
    if (data.error) {
      const msg = typeof data.error === 'string' ? data.error : data.error.message || JSON.stringify(data.error);
      return { success: false, error: msg };
    }

    const choice = data.choices?.[0];
    if (!choice || !choice.message || typeof choice.message.content !== 'string') {
      return { success: false, error: 'No choices or content returned from AI provider' };
    }

    const rawCode = choice.message.content;
    const finalCode = cleanGeneratedCode(rawCode);
    const isTruncated = choice.finish_reason === 'length';

    return {
      success: true,
      code: finalCode,
      isTruncated,
      modelUsed: data.model || undefined
    };
  }

  /**
   * Parses error responses into clear human-friendly text
   */
  function parseApiError(status, errorData) {
    let message = '';
    if (typeof errorData === 'string') {
      message = errorData;
    } else if (errorData && typeof errorData === 'object') {
      if (typeof errorData.error === 'string') {
        message = errorData.error;
      } else if (errorData.error && typeof errorData.error.message === 'string') {
        message = errorData.error.message;
      } else if (errorData.message) {
        message = errorData.message;
      }
    }

    if (status === 401 || status === 403) {
      return `Ungültiger API-Key oder fehlende Berechtigung (HTTP ${status}). Bitte API-Key in den Einstellungen prüfen.`;
    }
    if (status === 429) {
      return `Rate-Limit / Quota überschritten (HTTP 429). Bitte einen kurzen Moment warten oder Modell wechseln.`;
    }
    if (status >= 500) {
      return `Der KI-Server meldet einen temporären Fehler (HTTP ${status}). Bitte gleich erneut versuchen.`;
    }

    return message || `HTTP ${status}: Unerwarteter Fehler bei der Anfrage.`;
  }

  return {
    cleanGeneratedCode,
    buildSystemPrompt,
    buildUserInstruction,
    buildOpenAiMessages,
    buildOpenAiRequestBody,
    parseOpenAiResponse,
    parseApiError
  };
});
