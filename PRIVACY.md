# Privacy Policy for p5.js Vibe Coder

*Last updated: November 3, 2026*

**p5.js Vibe Coder** is a free, open-source browser extension designed to assist creative coders with generating and refining p5.js sketches directly inside the official [p5.js Web Editor](https://editor.p5js.org/).

We take your privacy seriously. This extension is built with a **strict privacy-by-design** approach:
- **No telemetry or tracking**
- **No advertising or monetization**
- **No analytics cookies**
- **No intermediate developer servers**

All communications occur strictly between your browser, the p5.js Web Editor, and your chosen AI service (Google Gemini API).

---

## 1. Information We Process

### a. User-Entered Prompts and Code
When you submit a prompt using the Vibe Coder HUD:
- Your natural-language instruction and the current sketch code from your active p5.js editor tab are packaged into an AI request.
- This request is transmitted **directly from your browser** to the Google Gemini API endpoint (`https://generativelanguage.googleapis.com/`).
- Neither your prompt nor your code passes through any servers owned, operated, or accessed by the developers of this extension.

### b. API Keys
- Your Google Gemini API key is stored **exclusively in your browser's private local storage** (`chrome.storage.local`).
- It is never shared with, transmitted to, or viewable by the extension author. It is only included in the `Authorization` header of direct requests to the Google Gemini API.

### c. Settings and Prompt History
- Your preferences (selected AI model, interface language, auto-start toggle) and your recent prompt history (up to 50 entries) are kept strictly within your browser's local storage.
- You can clear your prompt history at any time by clicking the **"Clear"** button inside the History drawer.

---

## 2. Permissions Justification

In accordance with the Chrome Web Store Developer Program Policies and WebExtension guidelines, the extension requests only the minimum necessary permissions:

| Permission | Justification |
| :--- | :--- |
| **`storage`** | Stores your API key, UI preferences (model, language, auto-run), and prompt history locally on your computer. |
| **`https://editor.p5js.org/*`** | Required to display the floating HUD on the p5.js Web Editor, read existing sketch code, and insert generated code. |
| **`https://generativelanguage.googleapis.com/*`** | Required to send prompts and receive generated p5.js code directly from the Google Gemini API. |

---

## 3. Third-Party Services

This extension connects directly to:

- **Google Gemini API** (Google LLC):
  Used to process prompts and generate p5.js code. Data sent to Google is subject to Google's Privacy Policy and the Google AI Studio Terms of Service:
  - [Google Privacy Policy](https://policies.google.com/privacy)
  - [Google Generative AI Additional Terms of Service](https://policies.google.com/terms/generative-ai)

We do not use any third-party analytics services (e.g. Google Analytics, Mixpanel) or advertising networks.

---

## 4. Data Sharing and Sale

- We **do not sell, rent, trade, or monetize** any user data.
- We **do not transfer** user data to data brokers or advertising partners.
- We **do not use** your data for creditworthiness evaluations or lending purposes.

---

## 5. Data Retention and Deletion

All user data (API key, settings, prompt history) is stored on your local device. You retain full control over your data:
- **Delete Prompt History**: Click `🕒 History` → `Clear` in the extension HUD.
- **Remove API Key**: Clear the API key field in the settings drawer (`⚙`).
- **Complete Deletion**: Uninstalling the extension automatically removes all stored data from your browser.

---

## 6. Open Source Code

The full source code of p5.js Vibe Coder is publicly available and inspectable under the open-source MIT License:
👉 [https://github.com/diy-ecg/p5js-vibecoder](https://github.com/diy-ecg/p5js-vibecoder)

---

## 7. Contact & Responsible Person

If you have questions, feedback, or concerns regarding this Privacy Policy, please contact:

**Jens Bongartz**  
Email: [info@diy-ecg.org](mailto:info@diy-ecg.org)  
GitHub: [https://github.com/diy-ecg/p5js-vibecoder](https://github.com/diy-ecg/p5js-vibecoder)

---

<details>
<summary>🇩🇪 <strong>Deutsche Fassung der Datenschutzerklärung (Hier klicken zum Aufklappen)</strong></summary>

### Datenschutzerklärung für p5.js Vibe Coder

*Stand: 3. November 2026*

**p5.js Vibe Coder** ist eine kostenlose Open-Source-Browser-Erweiterung für die Erstellung und Bearbeitung von p5.js-Sketches im offiziellen [p5.js Web Editor](https://editor.p5js.org/).

Der Schutz Ihrer Daten steht an oberster Stelle:
- **Kein Tracking, keine Telemetrie**
- **Keine Werbenetzwerke oder Monetarisierung**
- **Keine eigenen Zwischen- oder Analysenserver**

#### 1. Welche Daten verarbeitet werden
- **Prompts und Code**: Bei einer Generierung werden Ihre Anweisung und der aktuelle p5.js-Code direkt von Ihrem Browser an die Google Gemini API übertragen.
- **API-Key**: Ihr Google Gemini API-Key wird ausschließlich lokal im geschützten Browserspeicher (`chrome.storage.local`) abgelegt und nur zur Authentifizierung an Google übermittelt.
- **Verlauf & Einstellungen**: Der Prompt-Verlauf (max. 50 Einträge) und Ihre Einstellungen verbleiben lokal auf Ihrem Rechner und können jederzeit mit einem Klick gelöscht werden.

#### 2. Berechtigungen
- `storage`: Lokales Speichern von API-Key, Sprache, Modell und Verlauf.
- `https://editor.p5js.org/*`: Einblenden des Panels im Webeditor sowie Lesen und Einfügen von Code.
- `https://generativelanguage.googleapis.com/*`: Direkte Kommunikation mit der Gemini-API.

#### 3. Weitergabe von Daten
Es erfolgt keinerlei Weitergabe oder Verkauf von Daten an Dritte oder Werbetreibende. Die Anfragen erfolgen ausschließlich an die API des gewählten Anbieters (Google Gemini).

#### 4. Kontakt
**Jens Bongartz**  
E-Mail: [info@diy-ecg.org](mailto:info@diy-ecg.org)  
Projekt: [https://github.com/diy-ecg/p5js-vibecoder](https://github.com/diy-ecg/p5js-vibecoder)

</details>
