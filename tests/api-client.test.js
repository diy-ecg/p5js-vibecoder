const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildOpenAiMessages,
  buildOpenAiRequestBody,
  parseOpenAiResponse,
  parseApiError
} = require('../lib/ai-transformer.js');

describe('API Client Workflow Simulation', () => {

  it('successfully completes full request-response lifecycle with mock server', async () => {
    const mockApiKey = 'mock-api-key-12345';
    const mockModel = 'gemini-2.0-flash';
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

    // 1. Build messages & request body
    const { messages } = buildOpenAiMessages({
      prompt: 'Draw a neon pulsating circle',
      currentCode: '',
      chatSession: [],
      lang: 'en'
    });

    const requestBody = buildOpenAiRequestBody({
      model: mockModel,
      messages
    });

    // 2. Simulate fetch call
    let capturedUrl = '';
    let capturedHeaders = {};
    let capturedBody = {};

    const mockFetch = async (url, options) => {
      capturedUrl = url;
      capturedHeaders = options.headers;
      capturedBody = JSON.parse(options.body);

      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'chatcmpl-test',
          model: mockModel,
          choices: [
            {
              message: {
                role: 'assistant',
                content: '```javascript\nfunction setup() {\n  createCanvas(400, 400);\n}\nfunction draw() {\n  circle(200, 200, 50);\n}\n```'
              },
              finish_reason: 'stop'
            }
          ]
        })
      };
    };

    // Execute mock request
    const response = await mockFetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mockApiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    const result = parseOpenAiResponse(data);

    // 3. Verify outgoing contract
    assert.strictEqual(capturedUrl, endpoint);
    assert.strictEqual(capturedHeaders['Authorization'], 'Bearer mock-api-key-12345');
    assert.strictEqual(capturedHeaders['Content-Type'], 'application/json');
    assert.strictEqual(capturedBody.model, 'gemini-2.0-flash');
    assert.strictEqual(capturedBody.messages[0].role, 'system');
    assert.ok(capturedBody.messages[1].content.includes('Draw a neon pulsating circle'));

    // 4. Verify parsed result
    assert.strictEqual(result.success, true);
    assert.ok(result.code.includes('function setup()'));
    assert.ok(result.code.includes('createCanvas(400, 400)'));
    assert.strictEqual(result.isTruncated, false);
    assert.strictEqual(result.modelUsed, 'gemini-2.0-flash');
  });

  it('handles simulated 429 quota exhaustion gracefully', async () => {
    const mockFetch = async () => {
      return {
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            message: 'Resource has been exhausted (e.g. check quota).',
            type: 'insufficient_quota'
          }
        })
      };
    };

    const response = await mockFetch();
    const errorData = await response.json();
    const errorMessage = parseApiError(response.status, errorData);

    assert.strictEqual(response.status, 429);
    assert.ok(errorMessage.includes('Rate-Limit'));
  });

  it('handles simulated 401 invalid key error', async () => {
    const mockFetch = async () => {
      return {
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            message: 'API key not valid. Please pass a valid API key.'
          }
        })
      };
    };

    const response = await mockFetch();
    const errorData = await response.json();
    const errorMessage = parseApiError(response.status, errorData);

    assert.strictEqual(response.status, 401);
    assert.ok(errorMessage.includes('Ungültiger API-Key'));
  });
});
