const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildSystemPrompt,
  buildUserInstruction,
  buildOpenAiMessages,
  buildOpenAiRequestBody,
  parseOpenAiResponse,
  parseApiError
} = require('../lib/ai-transformer.js');

describe('AI Transformer (OpenAI Compatibility)', () => {

  describe('buildSystemPrompt', () => {
    it('returns English system prompt with p5.js rules when lang is en', () => {
      const prompt = buildSystemPrompt('en');
      assert.ok(prompt.includes('p5.js specialist'));
      assert.ok(prompt.includes('createCanvas(400, 400)'));
      assert.ok(prompt.includes('setup() and draw()'));
    });

    it('returns German system prompt when lang is de', () => {
      const prompt = buildSystemPrompt('de');
      assert.ok(prompt.includes('p5.js Spezialist'));
      assert.ok(prompt.includes('setup() und draw()'));
      assert.ok(prompt.includes('AUSSCHLIESSLICH den ausführbaren JavaScript-Code'));
    });
  });

  describe('buildUserInstruction', () => {
    it('creates new sketch instruction when currentCode is empty', () => {
      const instruction = buildUserInstruction({
        prompt: 'Rainbow spiral',
        currentCode: '',
        hasChatHistory: false,
        lang: 'en'
      });
      assert.ok(instruction.includes('Rainbow spiral'));
      assert.ok(instruction.includes('Create a new, complete p5.js sketch'));
    });

    it('creates modification instruction when currentCode exists', () => {
      const currentCode = 'function setup() { createCanvas(400, 400); }';
      const instruction = buildUserInstruction({
        prompt: 'Change background to dark blue',
        currentCode,
        hasChatHistory: false,
        lang: 'en'
      });
      assert.ok(instruction.includes('Change background to dark blue'));
      assert.ok(instruction.includes(currentCode));
      assert.ok(instruction.includes('Modify or extend the sketch'));
    });

    it('creates follow-up chat turn instruction when hasChatHistory is true', () => {
      const currentCode = 'function setup() {}';
      const instruction = buildUserInstruction({
        prompt: 'Make it faster',
        currentCode,
        hasChatHistory: true,
        lang: 'de'
      });
      assert.ok(instruction.includes('Make it faster'));
      assert.ok(instruction.includes('Folge-Anweisung im laufenden Chat'));
    });
  });

  describe('buildOpenAiMessages', () => {
    it('constructs valid OpenAI messages array with system, history, and user turn', () => {
      const chatSession = [
        { role: 'user', content: 'Create a red square' },
        { role: 'assistant', content: '```javascript\nfunction setup() {}\n```' }
      ];

      const { messages, userInstruction } = buildOpenAiMessages({
        prompt: 'Make the square spin',
        currentCode: 'function setup() {}',
        chatSession,
        lang: 'en'
      });

      // Must have system + 2 history turns + 1 current user turn = 4
      assert.strictEqual(messages.length, 4);
      assert.strictEqual(messages[0].role, 'system');
      assert.strictEqual(messages[1].role, 'user');
      assert.strictEqual(messages[1].content, 'Create a red square');
      assert.strictEqual(messages[2].role, 'assistant');
      assert.strictEqual(messages[3].role, 'user');
      assert.ok(messages[3].content.includes('Make the square spin'));
      assert.strictEqual(messages[3].content, userInstruction);
    });
  });

  describe('buildOpenAiRequestBody', () => {
    it('creates standard OpenAI payload with model, messages, temperature and max_tokens', () => {
      const messages = [{ role: 'user', content: 'hello' }];
      const body = buildOpenAiRequestBody({
        model: 'gemini-2.0-flash',
        messages,
        temperature: 0.5,
        maxTokens: 4096
      });

      assert.strictEqual(body.model, 'gemini-2.0-flash');
      assert.deepStrictEqual(body.messages, messages);
      assert.strictEqual(body.temperature, 0.5);
      assert.strictEqual(body.max_tokens, 4096);
    });
  });

  describe('parseOpenAiResponse', () => {
    it('parses successful OpenAI completion and cleans code', () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        model: 'gemini-2.0-flash',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: '```javascript\nfunction setup() {\n  createCanvas(400, 400);\n}\n```'
            },
            finish_reason: 'stop'
          }
        ]
      };

      const result = parseOpenAiResponse(mockResponse);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.code, 'function setup() {\n  createCanvas(400, 400);\n}');
      assert.strictEqual(result.isTruncated, false);
      assert.strictEqual(result.modelUsed, 'gemini-2.0-flash');
    });

    it('detects truncation when finish_reason is length', () => {
      const mockResponse = {
        model: 'gemini-2.0-flash',
        choices: [
          {
            message: {
              role: 'assistant',
              content: '```javascript\nfunction setup() {\n  // long code cut off'
            },
            finish_reason: 'length'
          }
        ]
      };

      const result = parseOpenAiResponse(mockResponse);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.isTruncated, true);
      assert.ok(result.code.includes('long code cut off'));
    });

    it('handles API error object in response payload', () => {
      const mockErrorResponse = {
        error: {
          message: 'Rate limit exceeded for model',
          type: 'insufficient_quota',
          code: 429
        }
      };

      const result = parseOpenAiResponse(mockErrorResponse);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'Rate limit exceeded for model');
    });

    it('returns error when payload has empty choices', () => {
      const result = parseOpenAiResponse({ choices: [] });
      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });
  });

  describe('parseApiError', () => {
    it('formats 401/403 as API key errors', () => {
      const err = parseApiError(401, { error: { message: 'Invalid API key' } });
      assert.ok(err.includes('Ungültiger API-Key'));
    });

    it('formats 429 as rate limit / quota error', () => {
      const err = parseApiError(429, { error: { message: 'Rate limit' } });
      assert.ok(err.includes('Rate-Limit'));
    });

    it('formats 500+ as server error', () => {
      const err = parseApiError(503, { error: { message: 'Service unavailable' } });
      assert.ok(err.includes('temporären Fehler'));
    });
  });
});
