# ⚡ p5.js Vibe Coder (Firefox Extension)

[![GitHub](https://img.shields.io/badge/GitHub-diy--ecg%2Fp5js--vibecoder-181717?logo=github)](https://github.com/diy-ecg/p5js-vibecoder)
[![Firefox Add-on](https://img.shields.io/badge/Platform-Firefox%20WebExtension%20(MV3)-FF7139?logo=firefox-browser)](https://editor.p5js.org/)
[![Google Gemini](https://img.shields.io/badge/AI-Google%20Gemini%20API-4285F4?logo=google)](https://aistudio.google.com/)
[![Language](https://img.shields.io/badge/Language-Deutsch%20%7C%20English-blue)](#-zweisprachig--bilingual-de--en)

Ein leistungsstarkes Browser-Plug-In für **Vibe-Coding** direkt im offiziellen [p5.js Webeditor](https://editor.p5js.org/).

Tippe einfach auf Deutsch oder Englisch ein, was du visualisieren oder ändern möchtest. Google Gemini generiert in Sekundenschnelle den p5.js-Code und überträgt ihn direkt in deinen CodeMirror-Editor – inklusive automatischem Start des Sketches!

---

## 🚀 Features & Highlights

### 💬 Multi-Turn Chat & Intelligenter Kontext
- **Kein manuelles Umschalten nötig**: Erkennt automatisch, ob du an einem bestehenden Sketch weiterbaust oder bei leerem Editor von Grund auf neu beginnst.
- **Konversations-Gedächtnis**: Gemini behält die letzten Dialog-Runden im Gedächtnis (*„Mache es grün“*, *„Lass die Partikel langsamer fallen“*).
- **Neuer Chat (`×`)**: Setzt das Chat-Gedächtnis mit einem Klick zurück, um ein frisches Projekt ohne Altlasten zu starten.
- **Sauberes Eingabefeld**: Das Prompt-Feld leert sich nach dem Absenden automatisch, damit du direkt deine nächste Idee eingeben kannst.

### ▶️ Auto-Play mit React- & Fiber-Bridge
- **Direktes Starten**: Der generierte Sketch wird sofort im Vorschaufenster gerendert – kein manueller Klick auf den Play-Button mehr nötig.
- **Ein-/Ausschalter**: Direkt neben dem Verlauf kann der Auto-Play-Modus per Schiebeschalter (standardmäßig *ON*) jederzeit auf *OFF* gestellt werden.
- **Robuste Ausführung**: Nutzt ein mehrstufiges Event-System (React 18 Fiber-Dispatch, PointerEvents und Tastatur-Shortcuts), um Firefox-Sandbox-Restriktionen nahtlos zu überwinden.

### ↩ 1-Klick Undo
- Setzt den Editor mit einem Klick auf die vorherige Code-Version zurück.
- Spult gleichzeitig auch das Chat-Gedächtnis um eine Runde zurück, damit der Dialog konsistent bleibt.

### 🕒 Lokaler Prompt-Verlauf (History)
- Speichert deine letzten 50 Prompts dauerhaft im Browser (`browser.storage.local`).
- Klickbarer **„🕒 Verlauf“**-Button mit Übersicht und Schnellübernahme.
- **Terminal-Style**: Mit den Pfeiltasten <kbd>↑</kbd> und <kbd>↓</kbd> im leeren Eingabefeld kannst du direkt durch deine früheren Prompts blättern.

### 🌍 Zweisprachig / Bilingual (DE / EN)
- Umschaltbar zwischen **🇩🇪 Deutsch** und **🇬🇧 English** direkt in den Einstellungen.
- Alle Buttons, Labels, Fehlermeldungen, Status-Texte und Gemini-Systemprompts passen sich in Echtzeit an.
- Voll synchronisiert zwischen In-Page-Panel und Toolbar-Popup.

### ⚡ Live-Modell-Erkennung & Fallback
- Erkennt automatisch die für deinen API-Key freigeschalteten Gemini-Modelle (**Gemini 2.0 Flash**, **Gemini 3.8 Flash**, **Gemini 3.8 Pro**, etc.).
- **Automatischer Cascade-Fallback**: Weicht bei vorübergehender Auslastung eines Modells automatisch auf alternative Modelle aus.
- Dynamische Anzeige des aktuell aktiven Modells direkt im Header-Badge.

### 🎨 Ergonomisches Dark UI
- Frei verschiebbar über die gesamte Zeichenfläche (Drag & Drop am Header).
- Mit einem Klick oder per Tastaturkürzel (<kbd>Alt</kbd> + <kbd>V</kbd>) zu einem dezenten Badge minimierbar.
- Speichert Fensterposition und Minimierungsstatus automatisch.

---

## 🧠 Wichtige Erkenntnisse & Best Practices

### Das 8.192 Token-Ausgabelimit bei großen Sketchen

| Parameter | Gemini Limit | Bedeutung für p5.js |
| :--- | :--- | :--- |
| **Input Context** | Bis zu 1.000.000 Tokens | Riesig – Gemini kann auch 10.000 Zeilen bestehenden Code problemlos lesen. |
| **Output Limit** | **8.192 Tokens** (ca. 500–600 Zeilen) | Die maximale Ausgabelänge pro Antwort ist durch die Google API strikt gedeckelt. |

#### Warum brechen Skripte ab ~600 Zeilen ab?
Da der Vibe-Coder Gemini anweist, den *vollständigen, sofort lauffähigen Code* zurückzugeben, muss die KI bei jeder Änderung den gesamten Sketch neu formulieren. Bei etwa 500 bis 600 Zeilen (inkl. Einrückungen, mathematischen Formeln und Kommentaren) erreicht die Antwort exakt **8.192 Tokens** und Google schneidet die Übertragung abrupt ab (`finishReason: "MAX_TOKENS"`).

#### Integrierter Schutz im Plugin:
1. **Truncation-Erkennung**: Das Plug-In erkennt das `MAX_TOKENS`-Signal sofort.
2. **Auto-Play-Schutz**: Unvollständiger Code wird **nicht** gestartet, um Abstürze im p5-Viewer zu verhindern.
3. **Markdown-Säuberung**: Verhindert, dass abgebrochene Code-Fences (````) als Syntaxfehler im Editor landen.
4. **Warnung & Undo**: Zeigt eine deutliche Warnmeldung an – mit `↩ Undo` stellst du deinen funktionierenden Code sofort wieder her.
5. **Token-Effizienz**: Der System-Prompt weist Gemini an, bei umfangreichen Sketchen auf überflüssige Kommentare zu verzichten und kompakten, token-sparenden Code zu schreiben.

#### 💡 Tipps für große Projekte (> 500 Zeilen):
- **Refactoring-Prompt**: Bitte Gemini vorab: *„Fasse wiederkehrende Logik in kompakte Hilfsfunktionen zusammen und halte den Code prägnant.“*
- **Dateien aufteilen (Sketch Files)**: Im p5.js Editor links auf den Pfeil neben *Sketch Files* klicken und Klassen (z. B. `Particle.js`, `Physics.js`) in eigene Dateien auslagern. So bleibt die Hauptdatei `sketch.js` immer schlank und weit unter dem Token-Limit.

---

## ⌨️ Tastatur-Kürzel

| Tastenkürzel | Funktion |
| :--- | :--- |
| <kbd>Strg</kbd> + <kbd>Enter</kbd> / <kbd>Cmd</kbd> + <kbd>Enter</kbd> | Prompt abschicken & Code generieren |
| <kbd>↑</kbd> / <kbd>↓</kbd> (im leeren Promptfeld) | Durch bisherige Prompts aus dem Verlauf blättern |
| <kbd>Alt</kbd> + <kbd>V</kbd> | Panel ein- oder ausblenden / minimieren |

---

## 🛠️ Installation in Mozilla Firefox

Da die Erweiterung quelloffen als lokale WebExtension (Manifest V3) vorliegt, kannst du sie in Firefox innerhalb von 30 Sekunden installieren:

1. Klone das Repository oder lade es als ZIP herunter:
   ```bash
   git clone https://github.com/diy-ecg/p5js-vibecoder.git
   ```
2. Öffne Firefox und navigiere zu:
   ```text
   about:debugging#/runtime/this-firefox
   ```
3. Klicke auf die Schaltfläche **„Temporäres Add-on laden...“** (Load Temporary Add-on).
4. Wähle die Datei **`manifest.json`** im geklonten Projektordner aus.
5. Das Plug-In ist sofort aktiv! 🎉

---

## 🔑 Gemini API-Key einrichten

1. Erstelle dir kostenlos einen API-Key bei [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Öffne den p5.js Webeditor: [editor.p5js.org](https://editor.p5js.org/).
3. Klicke im p5.js Vibe Coder Panel oben rechts auf das **Zahnrad-Symbol (⚙)**.
4. Trage deinen API-Key ein. Er wird ausschließlich lokal im sicheren Speicher deines Firefox-Profils abgelegt.
5. Klicke auf **„🔄 Modelle prüfen“**, um die für deinen Key freigeschalteten Modelle zu laden.

---

## 📁 Projektstruktur

```text
p5js-vibecoder/
├── manifest.json         # Firefox WebExtension Konfiguration (Manifest V3)
├── background.js         # Service Worker & Fallback-API-Kommunikation mit Gemini
├── content/
│   ├── content.js        # Floating UI Panel Logik, i18n, Event-Handling & API-Client
│   ├── content.css       # Stylesheets, Dark-Theme, Animationen & Layout
│   └── page-bridge.js    # Unsanboxed Page-Script zur Interaktion mit CodeMirror & React
├── popup/
│   ├── popup.html        # Toolbar-Popup für Einstellungen & Sprache
│   ├── popup.css         # Styling des Popups
│   └── popup.js          # Synchronisierte Einstellungslogik
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
└── README.md
```

---

## 📄 Lizenz

Open Source – lizenziert unter der [MIT License](LICENSE).
Beiträge, Feedback und Issue-Reports sind herzlich willkommen!
