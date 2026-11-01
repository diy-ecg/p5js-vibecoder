/**
 * p5.js Vibe Coder - Extension Popup Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  const keyInput = document.getElementById('gemini-key');
  const btnToggleKey = document.getElementById('btn-toggle-key');
  const modelSelect = document.getElementById('gemini-model');
  const btnSave = document.getElementById('btn-save');
  const saveMsg = document.getElementById('save-msg');
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');

  // Load existing settings
  try {
    const data = await browser.storage.local.get(['geminiApiKey', 'geminiModel']);
    if (data.geminiApiKey) {
      keyInput.value = data.geminiApiKey;
      updateStatus(true);
    } else {
      updateStatus(false);
    }

    if (data.geminiModel) {
      modelSelect.value = data.geminiModel;
    }
  } catch (err) {
    console.error('Error loading popup settings:', err);
  }

  function updateStatus(hasKey) {
    if (hasKey) {
      statusIndicator.className = 'status-indicator ready';
      statusText.textContent = 'Bereit für den Webeditor';
    } else {
      statusIndicator.className = 'status-indicator';
      statusText.textContent = 'API-Key fehlt noch';
    }
  }

  // Toggle API key visibility
  btnToggleKey.addEventListener('click', () => {
    if (keyInput.type === 'password') {
      keyInput.type = 'text';
      btnToggleKey.textContent = '🔒';
    } else {
      keyInput.type = 'password';
      btnToggleKey.textContent = '👁';
    }
  });

  // Save settings
  btnSave.addEventListener('click', async () => {
    const apiKey = keyInput.value.trim();
    const model = modelSelect.value;

    try {
      await browser.storage.local.set({
        geminiApiKey: apiKey,
        geminiModel: model
      });

      updateStatus(!!apiKey);
      saveMsg.textContent = '✓ Gespeichert!';
      setTimeout(() => {
        saveMsg.textContent = '';
      }, 2500);
    } catch (err) {
      saveMsg.textContent = 'Fehler beim Speichern: ' + err.message;
      saveMsg.style.color = '#ef4444';
    }
  });
});
