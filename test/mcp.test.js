import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';

const PORT = 3219;

function start(script, env) {
  return spawn(process.execPath, [script], { env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'inherit'] });
}

test('an agent can create, verify and is refused release without PayPal authorization', async (t) => {
  const server = start('src/server.js', { PORT: String(PORT), PAYPAL_CLIENT_ID: '', PAYPAL_CLIENT_SECRET: '', AI_MODEL: '', AI_API_KEY: '' });
  t.after(() => server.kill());
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(`http://127.0.0.1:${PORT}/health`);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  const mcp = start('src/mcp.js', { PROOFLANE_URL: `http://127.0.0.1:${PORT}` });
  t.after(() => mcp.kill());
  const lines = createInterface({ input: mcp.stdout });
  let next = 0;
  const call = async (method, params) => {
    const id = ++next;
    mcp.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    for (;;) {
      const [line] = await once(lines, 'line');
      const msg = JSON.parse(line);
      if (msg.id === id) return msg;
    }
  };

  const init = await call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
  assert.equal(init.result.serverInfo.name, 'prooflane');
  const list = await call('tools/list');
  assert.ok(list.result.tools.some((tool) => tool.name === 'release_payment'));

  const created = await call('tools/call', {
    name: 'create_milestone',
    arguments: { title: 'Landing page', amount: 5, acceptanceChecks: ['Evidence describes a completed deliverable'] },
  });
  const contractId = created.result.structuredContent.id;
  assert.ok(contractId);

  const evidence = await call('tools/call', {
    name: 'submit_evidence',
    arguments: { contractId, description: 'Evidence describes the completed deliverable.' },
  });
  assert.equal(evidence.result.structuredContent.status, 'verified');

  const release = await call('tools/call', { name: 'release_payment', arguments: { contractId } });
  assert.equal(release.result.isError, true);
  assert.equal(release.result.structuredContent.reason, 'not_authorized');
});
