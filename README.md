# ⚡ p5.js Vibe Coder (Firefox Extension)

Ein Firefox-Plugin für **Vibe-Coding** direkt im offiziellen Webeditor von [p5.js](https://editor.p5js.org/).

Gib einfach auf Deutsch oder Englisch ein, was du programmieren oder ändern möchtest. Die Google Gemini KI generiert den vollständigen p5.js-Code und fügt ihn direkt in dein Editorfenster ein – du musst nur noch auf den **Play-Button (▶)** drücken!

---

## 🚀 Features

- **Schwebendes Panel (Floating Panel)**: Frei über den Webeditor verschiebbar (Drag & Drop am Header) und minimierbar zu einem dezenten Badge.
- **Google Gemini Anbindung**: Unterstützt **Gemini 3.8 Flash** (schnell & smart) und **Gemini 3.8 Pro** (für komplexe 3D- & Mathe-Sketche).
- **Zwei Modi**:
  - `✨ Sketch anpassen`: Liest deinen aktuellen Code aus und baut Erweiterungen oder Änderungen gezielt ein.
  - `🆕 Neuer Sketch`: Generiert einen frischen Sketch von Grund auf.
- **💬 Echter Multi-Turn Chat & Schlankes Interface**:
  - Kein manuelles Umschalten zwischen Modi nötig: Das Plugin erkennt automatisch, ob du an einem bestehenden Sketch weiterbaust oder bei leerem Editor von Grund auf neu startest.
  - Die KI behält den gesamten Dialog-Verlauf im Gedächtnis (*„Mache es grün“*, *„Lass es pulsieren“* etc.).
  - Mit dem kleinen **`×`**-Reset auf der Chat-Pille startest du jederzeit einen frischen Dialog für eine neue Idee.
- **↩ Undo-Funktion**: Macht die letzte KI-Änderung mit einem Klick rückgängig – und spult gleichzeitig auch das Gedächtnis des Chats um eine Runde zurück!
- **🕒 Prompt-Verlauf (History)**:
  - Speichert deine letzten Prompts dauerhaft im Browser.
  - Klickbarer **„🕒 Verlauf“**-Button mit Liste aller bisherigen Prompts.
  - Wie im Terminal: Mit <kbd>↑</kbd> und <kbd>↓</kbd> im Textfeld direkt durch frühere Prompts blättern!
- **Inspirations-Chips**: Klickbare Schnellstarter für Ideen (z. B. 🌌 *Sternenhimmel*, 🌊 *Noise Wellen*, 🕹️ *Bouncing Balls*, ✨ *Maus-Partikel*).
- **Tastatur-Kürzel**:
  - <kbd>Strg</kbd> + <kbd>Enter</kbd> (bzw. <kbd>Cmd</kbd> + <kbd>Enter</kbd> auf Mac): Prompt sofort abschicken & generieren.
  - <kbd>Alt</kbd> + <kbd>V</kbd>: Panel ein- oder ausblenden.
- **Kein Auto-Run**: Volle Kontrolle – du bestimmst, wann der Sketch gestartet wird.

---

## 🛠️ Installation in Mozilla Firefox

Da das Plugin lokal auf deinem Rechner liegt, kannst du es in Firefox in wenigen Sekunden als temporäre Erweiterung laden:

1. Öffne Firefox und tippe in die Adressleiste:
   ```text
   about:debugging#/runtime/this-firefox
   ```
2. Klicke auf die Schaltfläche **„Temporäres Add-on laden...“** (Load Temporary Add-on).
3. Wähle im Dateidialog die Datei **`manifest.json`** im Ordner:
   ```text
   /Users/bongartz/Documents/Antigravity/p5-Assistant/manifest.json
   ```
4. Das Plugin ist nun sofort in Firefox aktiv! 🎉

---

## 🔑 Gemini API-Key einrichten

1. Falls du noch keinen Gemini API-Key hast, erstelle dir kostenlos einen auf [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Öffne den Webeditor: [editor.p5js.org](https://editor.p5js.org/)
3. Im schwebenden Panel oben rechts auf das **Zahnrad-Symbol (⚙)** klicken.
4. Trage deinen API-Key ein. Er wird sicher lokal im Speicher deines Firefox-Profils gespeichert.

---

## 🎨 So nutzt du das Vibe-Coding

1. Navigiere zu [editor.p5js.org](https://editor.p5js.org/).
2. Rechts oben siehst du das **p5.js Vibe Coder** Panel.
3. Tippe deine Idee oder Anweisung ein (z. B. *„Erstelle ein flüssiges Partikelsystem in WEBGL, das auf Mausbewegungen reagiert und bunte Spuren hinterlässt“*).
   - In Folge-Prompts kannst du einfach im Chat-Stil weitermachen (z. B. *„Mache es bitte grün“* oder *„Lass die Partikel langsamer fallen“*).
   - Mit dem Verlauf-Button (🕒) oder den Pfeiltasten <kbd>↑</kbd> / <kbd>↓</kbd> im leeren Eingabefeld kannst du frühere Prompts durchblättern.
4. Drücke <kbd>Cmd</kbd> + <kbd>Enter</kbd> oder klicke auf **⚡ Vibe Code**.
5. Nach wenigen Sekunden wird der Code direkt in den CodeMirror-Editor eingefügt.
6. Drücke im Webeditor auf den **Play-Button (▶)**, um deinen Sketch zu starten!

---

## 📁 Projektstruktur

```text
p5-Assistant/
├── manifest.json         # Firefox WebExtension Konfiguration (MV3)
├── background.js         # Service Worker / API-Kommunikation mit Gemini
├── content/
│   ├── content.js        # Floating UI Panel Logik & Event-Handling
│   ├── content.css       # Styling & Animationen des Panels
│   └── page-bridge.js    # Direkte Anbindung an den CodeMirror-Editor
├── popup/
│   ├── popup.html        # Toolbar-Popup für Einstellungen
│   ├── popup.css         # Styling des Popups
│   └── popup.js          # Logik des Popups
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
└── README.md
```
