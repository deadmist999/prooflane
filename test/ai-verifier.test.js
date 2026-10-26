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
