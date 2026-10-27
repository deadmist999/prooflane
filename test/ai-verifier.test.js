import test from 'node:test';
import assert from 'node:assert/strict';
import { AiVerifier } from '../src/ai-verifier.js';
import { createContract } from '../src/proof-engine.js';

test('requests structured verification and preserves the model identity', async () => {
  const calls = [];
  const verifier = new AiVerifier({
    apiKey: 'test-key',
    model: 'test-model',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          checks: [{ id: 'check-1', passed: true, reason: 'Test report is attached.' }],
          confidence: 0.93,
          summary: 'Verified',
        }) } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });
  const item = createContract({ title: 'Ship it', amount: 25, acceptanceChecks: ['Tests pass'] });
  const result = await verifier.assess(item, { description: 'Attached test output.' });
  assert.equal(result.provider, 'test-model');
  assert.equal(result.confidence, 0.93);
  assert.equal(calls.length, 1);
  assert.equal(JSON.parse(calls[0].init.body).response_format.type, 'json_object');
});

test('normalizes drifting model output and fails unassessed checks closed', async () => {
  const { normalizeAssessment } = await import('../src/ai-verifier.js');
  const item = createContract({ title: 'Ship it', amount: 25, acceptanceChecks: ['Tests pass', 'Docs updated', 'Demo recorded'] });
  const result = normalizeAssessment(item, {
    checks: [
      { id: '1', passed: 'true', reason: 'CI output attached.' },
      { id: 'check-2', passed: true, reason: '' },
    ],
    confidence: 87,
  });
  assert.deepEqual(result.checks.map((c) => [c.id, c.passed]), [['check-1', true], ['check-2', true], ['check-3', false]]);
  assert.equal(result.checks[1].reason, 'No reason given.');
  assert.equal(result.confidence, 0.87);
});

test('a local OpenAI-compatible server needs a model but no key', () => {
  assert.equal(new AiVerifier({ baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5:7b-instruct' }).configured(), true);
  assert.equal(new AiVerifier({ baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' }).configured(), false);
});
