# 🛠️ Software-Dokumentation & Entwickler-Handbuch: p5.js Vibe Coder

Diese Dokumentation beschreibt die interne Architektur, den Datenfluss, die Komponenten und die wichtigsten Code-Stellen von **p5.js Vibe Coder**. Sie dient als praktischer Leitfaden, um den Code schnell zu verstehen und eigenständig Anpassungen oder Erweiterungen vorzunehmen.

---

## 📑 Inhaltsverzeichnis
1. [Architektur-Übersicht & Konzept](#1-architektur-übersicht--konzept)
2. [Dateistruktur & Modul-Verantwortlichkeiten](#2-dateistruktur--modul-verantwortlichkeiten)
3. [End-to-End Datenfluss (Der Lebenszyklus eines Prompts)](#3-end-to-end-datenfluss-der-lebenszyklus-eines-prompts)
4. [Schlüssel-Module im Detail](#4-schlüssel-module-im-detail)
   - [lib/ai-transformer.js (Prompts, Payloads & Bereinigung)](#libai-transformerjs)
   - [content/page-bridge.js (CodeMirror 6 & React 18 Bridge)](#contentpage-bridgejs)
   - [content/content.js (Floating HUD, UI-Logik & State)](#contentcontentjs)
   - [background.js (Service Worker)](#backgroundjs)
   - [popup/ (Toolbar-Menü)](#popup)
5. [Praktische Anleitungen für eigene Änderungen (How-Tos)](#5-praktische-anleitungen-für-eigene-änderungen-how-tos)
   - [Neues KI-Modell hinzufügen](#how-to-1-neues-ki-modell-hinzufügen)
   - [System-Prompt oder KI-Regeln ändern](#how-to-2-system-prompt-oder-ki-regeln-ändern)
   - [Neuen Button im UI ergänzen](#how-to-3-neuen-button-im-ui-ergänzen)
   - [Tastenkombinationen anpassen](#how-to-4-tastenkombinationen-anpassen)
   - [Farben / Design (CSS) verändern](#how-to-5-farben--design-css-verändern)
   - [Texte & Übersetzungen (i18n) anpassen](#how-to-6-texte--übersetzungen-i18n-anpassen)
6. [Testen, Bauen & Release-Workflow](#6-testen-bauen--release-workflow)

---

## 1. Architektur-Übersicht & Konzept

Browser-Erweiterungen nach dem modernen **Manifest V3** Standard unterliegen strengen Sicherheits- und Sandbox-Grenzen. Die Anwendung ist deshalb in **drei getrennte Ausführungswelten** aufgeteilt:

```
┌────────────────────────────────────────────────────────────────────────┐
│ BROWSER (Chromium / Firefox)                                           │
│                                                                        │
│  ┌───────────────────────┐          ┌───────────────────────────────┐  │
│  │ BACKGROUND / SERVICE  │          │ TOOLBAR POPUP                 │  │
│  │ WORKER                │          │                               │  │
│  │ (background.js)       │◄────────►│ (popup.js / popup.html)       │  │
│  └───────────▲───────────┘          └───────────────▲───────────────┘  │
│              │ (runtime.sendMessage)                │                  │
│              │                                      │ (chrome.storage) │
│  ┌───────────▼──────────────────────────────────────▼───────────────┐  │
│  │ CONTENT SCRIPT (Isolierte Extension-Welt)                        │  │
│  │                                                                  │  │
│  │  - content.js  (Floating HUD, Event Listener, State Management)  │  │
│  │  - content.css (HUD Styling, Themes, Positionierung)             │  │
│  │  - lib/ai-transformer.js (Payload-Builder, Response-Cleaner)     │  │
│  └───────────────────────────────▲──────────────────────────────────┘  │
│                                  │ (window.postMessage)                 │
│                                  │                                     │
│  ┌───────────────────────────────▼──────────────────────────────────┐  │
│  │ MAIN WORLD (Webseite: editor.p5js.org)                           │  │
│  │                                                                  │  │
│  │  - page-bridge.js (Injected Script)                              │  │
│  │      ├── CodeMirror 6 EditorView (view.dispatch - Code einfügen) │  │
│  │      ├── React 18 Fiber Root (Play/Stop Button triggern)         │  │
│  │      └── Window Error / Console Listener (Fehler abfangen)       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Warum die `page-bridge.js` nötig ist:
Google Chrome isoliert Content-Scripts strikt in einer eigenen JavaScript-Laufzeitumgebung (*Isolated World*). Aus dieser Welt heraus kann man zwar das DOM sehen, aber **nicht** auf JavaScript-Objekte der Webseite zugreifen (z. B. `editorView` von CodeMirror 6 oder interne `__reactFiber$`-Eigenschaften von React 18).

Damit der Code **atomar, ohne Duplikate und ohne Cursor-Verlust** in den Editor geschrieben werden kann und der Play-Button zuverlässig gedrückt wird, injiziert `content.js` ein unsandboxtes Hilfsskript (`page-bridge.js`) direkt in die Webseite. Beide kommunizieren sicher über `window.postMessage` mit einer eindeutigen Quell-ID (`p5-vibe-coder-bridge`).

---

## 2. Dateistruktur & Modul-Verantwortlichkeiten

```text
p5-Assistant/
├── manifest.json              # Aktives WebExtension Manifest (Manifest V3 für Chromium)
├── manifest.chrome.json       # Preset: Chromium Standard (reiner Service Worker)
├── manifest.firefox.json      # Preset: Firefox Standard (background.scripts Array)
├── background.js              # Service Worker (Hintergrund-Dienst & API-Fallback)
├── package.json               # NPM-Skripte: test, build:zip, manifest-Presets
├── PRIVACY.md                 # Datenschutzerklärung (englisch + deutsch)
├── README.md                  # Dokumentation für Nutzer & Entwickler
│
├── lib/
│   └── ai-transformer.js      # UMD-Modul: System-Prompts, OpenAI-Payloads, Code-Bereinigung
│
├── content/
│   ├── content.js             # Hauptskript: Baut HUD, steuert Dialoge, API-Calls & Undo
│   ├── content.css            # Stylesheet: Dunkles HUD, Responsivität, Schalter, Drawer
│   └── page-bridge.js         # Main-World Bridge: Greift direkt auf CodeMirror 6 & React zu
│
├── popup/
│   ├── popup.html             # HTML-Dialog des Erweiterungs-Symbols in der Browser-Toolbar
│   ├── popup.js               # Synchronisiert Einstellungen (API-Key, Modell, Sprache)
│   └── popup.css              # Kompaktes Styling für das Toolbar-Popup
│
├── icons/
│   ├── icon-16.png            # 16x16 Favicon / Menü-Icon
│   ├── icon-48.png            # 48x48 Erweiterungsübersicht
│   └── icon-128.png           # 128x128 Chrome Web Store & High-DPI
│
└── tests/
    ├── ai-transformer.test.js # Tests für Message-Builder, Prompts & Fehler-Parser
    ├── api-client.test.js     # End-to-End Simulation mit Mock-Servern (401, 429, Success)
    └── code-cleaner.test.js   # Tests für das verlässliche Entfernen von Markdown-Fences
```

---

## 3. End-to-End Datenfluss (Der Lebenszyklus eines Prompts)

Wenn du im p5.js Web-Editor auf **„Vibe Code“** klickst oder `Ctrl+Enter` drückst:

1. **Trigger & Validierung (`content.js: triggerGenerate`)**:
   - Liest das Textfeld aus (`#p5-vibe-prompt-text`).
   - Prüft, ob ein API-Key vorhanden ist (falls nicht: öffnet automatisch die Einstellungen).
2. **Editor-Code auslesen (`content.js: getActiveCode`)**:
   - Sendet Action `GET_CODE` an `page-bridge.js`.
   - `page-bridge.js` liest den Text direkt aus CodeMirror 6 (`view.state.doc.toString()`) aus.
3. **Payload zusammenbauen (`lib/ai-transformer.js`)**:
   - `buildSystemPrompt`: Gibt präzise p5.js-Regeln vor (kein HTML, setup() und draw() vollständig halten, etc.).
   - `buildOpenAiMessages`: Baut die Nachrichten-Historie auf (System-Prompt, bisherige Chat-Runden, neue Anweisung inkl. aktuellem Sketch-Code).
   - `buildOpenAiRequestBody`: Standardisiertes OpenAI-Format (`model`, `messages`, `temperature: 0.7`, `maxTokens: 8192`).
4. **API-Aufruf an Google Gemini (`content.js: requestGeminiApi`)**:
   - Sendet einen `POST`-Request direkt an `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`.
   - Bei Rate-Limits (HTTP 429) oder temporären Fehlern greift automatisch eine **Modell-Kaskade** (z. B. Fallback auf `gemini-2.0-flash`).
5. **Code-Bereinigung (`lib/ai-transformer.js: cleanGeneratedCode`)**:
   - Entfernt Markdown-Codeblöcke (` ```javascript `, ` ```p5js `, etc.).
   - Schneidet Höflichkeitsfloskeln (*"Hier ist dein Code:"*) vor und nach dem Code ab.
   - Repariert abgeschnittene Skripte, falls das Tokenlimit erreicht wurde.
6. **Atomare Injektion (`content.js` -> `page-bridge.js: setCode`)**:
   - Sendet Action `SET_CODE` mit dem neuen Code an `page-bridge.js`.
   - CodeMirror 6 führt einen atomaren Dispatch durch:
     ```javascript
     view.dispatch({
       changes: { from: 0, to: view.state.doc.length, insert: newCode }
     });
     ```
   - Dadurch bleibt die Undo-Historie des Editors intakt und es entstehen keine doppelten Zeilen!
7. **Automatischer Start des Sketches (`page-bridge.js: triggerPlay`)**:
   - Wenn der Schalter **Auto-Start** aktiv ist, sucht `page-bridge.js` den Play-Button des Webeditors und triggert den React-Click-Handler. Der Sketch läuft sofort los.
8. **Zustandsspeicherung (`content.js`)**:
   - Vorheriger Code wird auf den internen `undoStack` gelegt (`↩ Undo` wird aktiv).
   - Die Chat-Runde wird in `chatSession` gespeichert (Multi-Turn Kontext bleibt erhalten).
   - Der Prompt wandert in den Verlauf (`promptHistory` via `chrome.storage.local`).

---

## 4. Schlüssel-Module im Detail

### `lib/ai-transformer.js`
Dieses Modul ist als **Universal Module Definition (UMD)** geschrieben: Es läuft sowohl im Node.js-Testrunner als auch im Browser ohne Build-Tool.

- **`cleanGeneratedCode(rawText)`**:
  Nimmt den rohen KI-Text und filtert zuverlässig alle Markdown-Backticks heraus. Erkennt auch Sonderfälle wie ` ```p5 ` oder unvollständige, abgeschnittene Fences.
- **`buildSystemPrompt({ lang })`**:
  Erzeugt den strengen System-Prompt auf Deutsch oder Englisch. Enthaltene Regeln:
  - Vollständiger, ausführbarer p5.js-Code.
  - Niemals Platzhalter oder `// ... Rest bleibt gleich` erzeugen.
  - Keine HTML-Tags (kein `<html>`, `<canvas>`), da p5.js dies selbst injiziert.
- **`buildOpenAiMessages({ prompt, currentCode, chatSession, lang })`**:
  Unterscheidet drei Szenarien:
  1. *Neuer Sketch* (Editor ist leer oder enthält nur Default-Template).
  2. *Modifikation* (Vorhandener Code soll gezielt verändert werden).
  3. *Fortsetzungs-Chat* (Vorherige Dialog-Historie fließt als Kontext ein).
- **`parseOpenAiResponse(data)`**:
  Extrahiert `choices[0].message.content`, prüft `finish_reason === 'length'` auf Abschneiden und leitet den Text durch `cleanGeneratedCode`.
- **`parseApiError(status, data)`**:
  Übersetzt HTTP-Statuscodes (401 = Ungültiger Key, 429 = Quota erschöpft, 500 = Server-Problem) in freundliche, leicht verständliche Fehlermeldungen.

---

### `content/page-bridge.js`
Läuft direkt im Hauptkontext der p5.js-Webseite (`window`).

- **`findEditor()`**:
  Findet die aktive CodeMirror 6 Instanz. Durchsucht rekursiv `.cm-content`, `.cm-editor` sowie React-Fiber-Knoten (`__reactFiber$`), um an das `editorView`-Objekt zu gelangen.
- **`getCode()`**:
  Gibt den aktuellen Code des Benutzers als String zurück.
- **`setCode(newCode)`**:
  Ersetzt den Dokumentinhalt sauber über `view.dispatch({ changes: ... })`.
- **`triggerPlay()`**:
  Sucht den Play-Button im React-DOM und ruft dessen synthetische Klick-Events auf.
- **Konsolen-Fehler-Interceptor**:
  Fängt `window.onerror` und `console.error` ab. Wenn im Sketch ein Syntax- oder Laufzeitfehler auftritt, speichert die Bridge diesen temporär. Der Benutzer kann ihn dann mit einem Klick auf **„🐛 Fehler einfügen“** in den Prompt übernehmen.

---

### `content/content.js`
Das Herzstück der Benutzeroberfläche und Benutzerinteraktion.

- **`createUI()`**:
  Erzeugt das DOM für das schwebende HUD:
  - Minimierte Pille (`#p5-vibe-pill`) mit Logo und Tastatur-Shortcut `Alt+V`.
  - Haupt-Panel (`#p5-vibe-panel`) mit Drag & Drop Header.
  - Header-Buttons: Info (`i`), Einstellungen (`⚙`), Minimieren (`−`).
  - Dropdown-Drawers: Info-Drawer, Settings-Drawer, History-Drawer, Error-Banner.
- **`setupEvents(panel, pill)`**:
  Registriert alle Klick-, Tastatur- und Drag-Events:
  - Drag & Drop: Verschieben des HUDs per Maus mit automatischer Positions-Speicherung.
  - Tastatur-Shortcuts: `Ctrl+Enter` (Generieren), `Alt+V` (Auf-/Zuklappen), `Pfeil Oben/Unten` (Prompt-Verlauf durchblättern).
  - Drawer-Exklusivität: Öffnet man die Einstellungen, schließt sich das Info-Panel automatisch.
- **`applyLanguage(lang)`**:
  Schaltet alle Texte, Buttons, Tooltips und Platzhalter live zwischen Deutsch (`de`) und Englisch (`en`) um.
- **`triggerUndo()`**:
  Stellt die letzte Codeversion wieder her und setzt die Chat-Historie synchron um eine Runde zurück.

---

### `background.js`
Der Service Worker nach Manifest V3.
- Hält den Hintergrund-Dienst bereit.
- Dient als Rückfallebene (`browser.runtime.onMessage`), falls direkte API-Aufrufe aus dem Content-Script blockiert würden.
- Unterstützt universell Chromium (`chrome.*`) und Firefox (`browser.*`).

---

### `popup/`
Das Menü, das sich öffnet, wenn man oben rechts im Browser auf das Erweiterungssymbol klickt.
- Ermöglicht das Eintragen des API-Keys und die Modellauswahl auch außerhalb des p5.js-Webeditors.
- Liest und schreibt direkt in `chrome.storage.local`, sodass Änderungen sofort im Editor aktiv sind.

---

## 5. Praktische Anleitungen für eigene Änderungen (How-Tos)

### How-To 1: Neues KI-Modell hinzufügen
Möchtest du ein neues Google-Modell (z. B. ein zukünftiges `gemini-3.0-flash` oder Pro-Modelle) hinzufügen:

1. **In `content/content.js`**:
   Suche nach `<select id="p5-vibe-model-select"` (ca. Zeile 990) und ergänze deine `<option>`:
   ```html
   <option value="gemini-3.0-flash">Gemini 3.0 Flash</option>
   ```
2. **In `popup/popup.html`**:
   Füge die gleiche Option im Dropdown `<select id="gemini-model">` ein.
3. **In `background.js`**:
   Ergänze das Modell ggf. in der Fallback-Kaskade (`const cascade = ...`).

---

### How-To 2: System-Prompt oder KI-Regeln ändern
Möchtest du der KI beibringen, wie sie den p5.js-Code formatieren soll (z. B. standardmäßig dunkler Hintergrund, Kommentare auf Deutsch, bestimmte Bibliotheken einbinden):

1. Öffne **`lib/ai-transformer.js`**.
2. Suche die Funktion **`buildSystemPrompt({ lang })`**.
3. Bearbeite den String unter `isEn ? ... : ...`.
4. Führe im Terminal `npm test` aus, um sicherzustellen, dass die Tests weiter grün sind!

---

### How-To 3: Neuen Button im UI ergänzen
Angenommen, du möchtest einen Button für *„Canvas leeren“* oder *„Zufalls-Prompt“* hinzufügen:

1. Öffne **`content/content.js`**.
2. Suche in **`createUI()`** die Stelle im HTML-Template, an der der Button erscheinen soll (z. B. neben dem Undo-Button in `.p5-vibe-footer`):
   ```html
   <button type="button" class="p5-vibe-btn-secondary" id="p5-vibe-btn-random">
     🎲 Zufall
   </button>
   ```
3. Suche in **`setupEvents()`** und hänge den Event-Listener an:
   ```javascript
   const btnRandom = panel.querySelector('#p5-vibe-btn-random');
   if (btnRandom) {
     btnRandom.addEventListener('click', () => {
       promptText.value = 'Erstelle ein psychedelisches Partikelsystem';
       promptText.focus();
     });
   }
   ```
4. Füge passende Übersetzungen in das `I18N`-Objekt oben in `content/content.js` ein.

---

### How-To 4: Tastenkombinationen anpassen
Aktuell löst `Ctrl+Enter` bzw. `Cmd+Enter` das Generieren aus, und `Alt+V` schaltet das Panel um.

- **`Alt+V` ändern**:
  In `content/content.js` nach `e.altKey && (e.key === 'v' || e.key === 'V')` suchen und die Tastenbedingung anpassen.
- **`Ctrl+Enter` ändern**:
  In `content/content.js` nach `e.key === 'Enter' && (e.ctrlKey || e.metaKey)` suchen.

---

### How-To 5: Farben / Design (CSS) verändern
Alle visuellen Stile sind zentral in **`content/content.css`** definiert.

Ganz oben in `content/content.css` findest du die Design-Tokens:
```css
:root {
  --p5-vibe-bg: #1e1e24;          /* Hintergrund des Panels */
  --p5-vibe-surface: #2b2b36;     /* Hintergrund von Eingabefeldern & Drawers */
  --p5-vibe-primary: #ed225d;     /* Akzentfarbe (p5.js Magenta-Rot) */
  --p5-vibe-primary-hover: #f53d73;
  --p5-vibe-text: #f1f5f9;        /* Hauptschriftfarbe */
  --p5-vibe-text-muted: #94a3b8;  /* Gedämpfter Hinweistext */
  --p5-vibe-border: rgba(255, 255, 255, 0.1);
}
```
Änderst du hier beispielsweise `--p5-vibe-primary`, passt sich die Akzentfarbe im gesamten HUD (Buttons, Lade-Spinner, Badges) automatisch an!

---

### How-To 6: Texte & Übersetzungen (i18n) anpassen
Alle UI-Texte sind im `I18N`-Objekt am Anfang von **`content/content.js`** hinterlegt:

```javascript
const I18N = {
  de: {
    panelTitle: 'p5.js Vibe Coder',
    btnGenerate: 'Vibe Code',
    statusReady: 'Bereit. Gib eine Idee ein und klicke auf Vibe Code!',
    // ...
  },
  en: {
    panelTitle: 'p5.js Vibe Coder',
    btnGenerate: 'Vibe Code',
    statusReady: 'Ready. Enter an idea and click Vibe Code!',
    // ...
  }
};
```
Wenn du einen Text änderst oder einen neuen Schlüssel hinzufügst, aktualisiere auch die Funktion `applyLanguage()` in `content/content.js`, damit die DOM-Elemente beim Sprachwechsel korrekt aktualisiert werden.

---

## 6. Testen, Bauen & Release-Workflow

### 1. Automatisierte Tests ausführen
Das Projekt verfügt über eine native Node.js-Testsuite (keine externen Testframeworks wie Jest nötig):

```bash
npm test
```
*Alle 25 Tests prüfen die OpenAI-Kompatibilität, das Entfernen von Markdown-Fences, die Prompt-Generierung und das Fehler-Handling.*

### 2. Änderungen im Browser testen
1. Öffne in Chrome: `chrome://extensions`
2. Klicke bei **p5.js Vibe Coder** auf den **Aktualisieren-Pfeil (🔄)**.
3. Lade die Seite [editor.p5js.org](https://editor.p5js.org/) neu (`Cmd+R` bzw. `F5`).
4. Deine Änderungen sind sofort aktiv.

### 3. ZIP-Datei für den Chrome Web Store packen
Wenn du ein Update im Store veröffentlichen möchtest:

1. Erhöhe die Versionsnummer (z. B. `1.0.1`):
   - in `manifest.json`
   - in `package.json`
2. Führe den Build-Befehl aus:
   ```bash
   npm run build:zip
   ```
3. Die fertige Datei **`p5js-vibecoder.zip`** liegt im Hauptordner.
4. Lade diese ZIP im [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole) unter *Paket → Neue Version hochladen* hoch und klicke auf *Zur Überprüfung einreichen*.
