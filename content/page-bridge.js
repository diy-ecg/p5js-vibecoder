/**
 * p5.js Vibe Coder - Page Context Bridge
 * Injected directly into editor.p5js.org to communicate with the CodeMirror instance.
 */

(() => {
  if (window.__p5VibeBridgeInjected) return;
  window.__p5VibeBridgeInjected = true;

  /**
   * Locate the active editor instance (CodeMirror 6, CodeMirror 5 or fallback)
   */
  function findEditor() {
    // 1. CodeMirror 6 (used by modern p5.js web editor)
    const cm6Targets = [
      document.querySelector('.cm-content'),
      document.querySelector('.cm-editor .cm-content'),
      document.querySelector('.cm-editor'),
      document.querySelector('.cm-scroller')
    ].filter(Boolean);

    for (const el of cm6Targets) {
      const candidates = [
        el.cmView?.view,
        el.cmTile?.view,
        el.editorView,
        el.view
      ];
      for (const view of candidates) {
        if (view && typeof view.dispatch === 'function' && view.state?.doc) {
          return { type: 'cm6', instance: view, element: el };
        }
      }

      // Check properties on element
      try {
        for (const key of Object.getOwnPropertyNames(el)) {
          const val = el[key];
          if (val && typeof val === 'object') {
            if (typeof val.dispatch === 'function' && val.state?.doc) {
              return { type: 'cm6', instance: val, element: el };
            }
            if (val.view && typeof val.view.dispatch === 'function' && val.view.state?.doc) {
              return { type: 'cm6', instance: val.view, element: el };
            }
          }
        }
      } catch (e) {}
    }

    // 2. CodeMirror 5
    const cmElements = document.querySelectorAll('.CodeMirror');
    for (const el of cmElements) {
      if (el.CodeMirror) {
        return { type: 'cm5', instance: el.CodeMirror, element: el };
      }
    }

    // 3. Fallback: Standard textarea
    const textarea = document.querySelector('textarea.editor, .editor textarea, textarea');
    if (textarea && textarea.offsetParent !== null) {
      return { type: 'textarea', instance: textarea, element: textarea };
    }

    return null;
  }

  /**
   * Get current code string from the active editor
   */
  function getCode() {
    const editor = findEditor();
    if (!editor) return null;

    try {
      if (editor.type === 'cm5') {
        return editor.instance.getValue();
      }
      if (editor.type === 'cm6') {
        return editor.instance.state.doc.toString();
      }
      if (editor.type === 'textarea') {
        return editor.instance.value;
      }
    } catch (e) {
      console.warn('[p5-vibe-bridge] Error reading code:', e);
    }
    return null;
  }

  /**
   * Set new code string into the active editor and trigger change events
   */
  function setCode(newCode) {
    const editor = findEditor();
    if (!editor) {
      console.error('[p5-vibe-bridge] No editor instance found to update code');
      return false;
    }

    try {
      if (editor.type === 'cm5') {
        const cm = editor.instance;
        cm.setValue(newCode);
        cm.focus();
        // Place cursor at the top
        cm.setCursor({ line: 0, ch: 0 });
        return true;
      }

      if (editor.type === 'cm6') {
        const view = editor.instance;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: newCode }
        });
        view.focus();
        return true;
      }

      if (editor.type === 'textarea') {
        editor.instance.value = newCode;
        editor.instance.dispatchEvent(new Event('input', { bubbles: true }));
        editor.instance.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    } catch (e) {
      console.error('[p5-vibe-bridge] Error setting code:', e);
      return false;
    }

    return false;
  }

  /**
   * Find the Play button in the p5.js Web Editor toolbar
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

  /**
   * Activate element via React internal handlers, mouse events and native click
   */
  function activateElement(el) {
    if (!el) return false;

    // React Fiber / Props onClick
    try {
      for (const key of Object.keys(el)) {
        if (key.startsWith('__reactProps$') || key.startsWith('__reactEventHandlers$') || key.startsWith('__reactFiber$')) {
          const val = el[key];
          const handler = val?.onClick || val?.memoizedProps?.onClick || val?.props?.onClick;
          if (typeof handler === 'function') {
            handler({
              preventDefault: () => {},
              stopPropagation: () => {},
              target: el,
              currentTarget: el,
              bubbles: true
            });
            console.log('[p5-vibe-bridge] Invoked React onClick directly');
          }
        }
      }
    } catch (e) {}

    // Pointer and mouse events
    try {
      el.focus();
      const eventTypes = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
      for (const type of eventTypes) {
        try {
          const isPointer = type.startsWith('pointer');
          const evt = isPointer
            ? new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, view: window, detail: 1, button: 0, buttons: 1 })
            : new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, view: window, detail: 1, button: 0, buttons: 1 });
          el.dispatchEvent(evt);
        } catch (e) {}
      }
    } catch (e) {}

    try { el.click(); } catch (e) {}
    return true;
  }

  /**
   * Dispatch Cmd+Enter (Mac) or Ctrl+Enter (Win) shortcut
   */
  function dispatchPlayShortcut() {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const eventInit = {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      metaKey: isMac,
      ctrlKey: !isMac
    };

    const targets = [
      document.querySelector('.cm-content'),
      document.querySelector('.cm-editor'),
      document.activeElement,
      document.body,
      window
    ].filter(Boolean);

    for (const t of targets) {
      try {
        t.dispatchEvent(new KeyboardEvent('keydown', eventInit));
        t.dispatchEvent(new KeyboardEvent('keyup', eventInit));
      } catch (e) {}
    }
  }

  function triggerPlayInPage() {
    const playBtn = findPlayButton();
    if (playBtn) {
      activateElement(playBtn);
    }
    dispatchPlayShortcut();
    return true;
  }

  // Handle messages from the extension content script
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.target !== 'p5-vibe-bridge') {
      return;
    }

    const { requestId, action, code } = event.data;

    if (action === 'GET_CODE') {
      const currentCode = getCode();
      window.postMessage({
        source: 'p5-vibe-bridge',
        requestId: requestId,
        success: currentCode !== null,
        code: currentCode
      }, '*');
    } else if (action === 'SET_CODE') {
      const ok = setCode(code);
      window.postMessage({
        source: 'p5-vibe-bridge',
        requestId: requestId,
        success: ok
      }, '*');
    } else if (action === 'PLAY_SKETCH') {
      const ok = triggerPlayInPage();
      window.postMessage({
        source: 'p5-vibe-bridge',
        requestId: requestId,
        success: ok
      }, '*');
    } else if (action === 'PING') {
      const editor = findEditor();
      window.postMessage({
        source: 'p5-vibe-bridge',
        requestId: requestId,
        success: true,
        hasEditor: !!editor
      }, '*');
    }
  });

  // Signal that bridge is initialized
  window.postMessage({
    source: 'p5-vibe-bridge',
    action: 'INIT'
  }, '*');
})();
