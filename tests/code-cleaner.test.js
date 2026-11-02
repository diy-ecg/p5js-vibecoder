const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { cleanGeneratedCode } = require('../lib/ai-transformer.js');

describe('Code Cleaner (cleanGeneratedCode)', () => {
  it('returns empty string when input is falsy or empty', () => {
    assert.strictEqual(cleanGeneratedCode(''), '');
    assert.strictEqual(cleanGeneratedCode(null), '');
    assert.strictEqual(cleanGeneratedCode(undefined), '');
  });

  it('strips ```javascript markdown fence cleanly', () => {
    const raw = '```javascript\nfunction setup() {\n  createCanvas(400, 400);\n}\n```';
    const expected = 'function setup() {\n  createCanvas(400, 400);\n}';
    assert.strictEqual(cleanGeneratedCode(raw), expected);
  });

  it('strips ```js markdown fence cleanly', () => {
    const raw = '```js\nfunction draw() {\n  background(220);\n}\n```';
    const expected = 'function draw() {\n  background(220);\n}';
    assert.strictEqual(cleanGeneratedCode(raw), expected);
  });

  it('strips ```p5js or ```p5 markdown fence', () => {
    const raw = '```p5js\nfunction setup() {}\n```';
    assert.strictEqual(cleanGeneratedCode(raw), 'function setup() {}');
  });

  it('strips bare ``` code fences', () => {
    const raw = '```\nlet x = 100;\n```';
    assert.strictEqual(cleanGeneratedCode(raw), 'let x = 100;');
  });

  it('removes conversational commentary before and after code fence', () => {
    const raw = `Here is your p5.js sketch with bouncing balls:

\`\`\`javascript
function setup() {
  createCanvas(400, 400);
}
function draw() {
  circle(mouseX, mouseY, 20);
}
\`\`\`

Enjoy creative coding!`;

    const expected = `function setup() {
  createCanvas(400, 400);
}
function draw() {
  circle(mouseX, mouseY, 20);
}`;
    assert.strictEqual(cleanGeneratedCode(raw), expected);
  });

  it('handles truncated code where closing fence was cut off by token limit', () => {
    const truncatedRaw = `Here is your complex sketch:
\`\`\`javascript
function setup() {
  createCanvas(800, 800);
}
function draw() {
  // partially generated code`;

    const expected = `function setup() {
  createCanvas(800, 800);
}
function draw() {
  // partially generated code`;

    assert.strictEqual(cleanGeneratedCode(truncatedRaw), expected);
  });

  it('returns clean raw code intact if model outputs code without any fences', () => {
    const raw = 'function setup() {\n  createCanvas(400, 400);\n}';
    assert.strictEqual(cleanGeneratedCode(raw), raw);
  });
});
