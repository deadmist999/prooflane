#!/usr/bin/env node
// Prooflane as an MCP server (stdio, newline-delimited JSON-RPC 2.0), so an AI
// agent can hire work, reserve payment and release it only against proof.
// It talks to a running Prooflane server; the release policy stays there.
import { createInterface } from 'node:readline';

const BASE = (process.env.PROOFLANE_URL ?? 'http://127.0.0.1:3210').replace(/\/$/, '');
const PROTOCOL = '2025-06-18';

const id = { type: 'string', description: 'Contract id returned by create_milestone' };
const tools = [
  {
    name: 'create_milestone',
    description: 'Create a milestone contract: what will be delivered, the price, and the acceptance checks that decide whether it gets paid.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        amount: { type: 'number', exclusiveMinimum: 0 },
        currency: { type: 'string', enum: ['USD', 'EUR', 'GBP'], default: 'USD' },
        acceptanceChecks: { type: 'array', items: { type: 'string' }, minItems: 1 },
      },
      required: ['title', 'amount', 'acceptanceChecks'],
    },
    call: (a) => api('POST', '/contracts', a),
  },
  {
    name: 'reserve_payment',
    description: 'Create a PayPal order with AUTHORIZE intent for the milestone. Returns the approval URL the buyer must open. Nothing is captured.',
    inputSchema: { type: 'object', properties: { contractId: id }, required: ['contractId'] },
    call: (a) => api('POST', `/contracts/${a.contractId}/order`),
  },
  {
    name: 'confirm_authorization',
    description: 'After the buyer approved the PayPal order, authorize it so the funds are reserved for this milestone.',
    inputSchema: { type: 'object', properties: { contractId: id, orderId: { type: 'string' } }, required: ['contractId', 'orderId'] },
    call: (a) => api('POST', `/contracts/${a.contractId}/authorize`, { orderId: a.orderId }),
  },
  {
    name: 'submit_evidence',
    description: 'Submit delivery evidence. The verifier assesses every acceptance check and returns pass/fail, reasons and a confidence score.',
    inputSchema: { type: 'object', properties: { contractId: id, description: { type: 'string' } }, required: ['contractId', 'description'] },
    call: (a) => api('POST', `/contracts/${a.contractId}/evidence`, { description: a.description }),
  },
  {
    name: 'release_payment',
    description: 'Ask for the payment to be captured. Policy code allows it only when the payment is authorized, every check passed, confidence meets the threshold, and it was not released before.',
    inputSchema: { type: 'object', properties: { contractId: id }, required: ['contractId'] },
    call: (a) => api('POST', `/contracts/${a.contractId}/release`),
  },
  {
    name: 'list_milestones',
    description: 'List all milestone contracts with their status, assessment and PayPal identifiers.',
    inputSchema: { type: 'object', properties: {} },
    call: () => api('GET', '/contracts'),
  },
];

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function handle(msg) {
  switch (msg.method) {
    case 'initialize':
      return {
        protocolVersion: PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: { name: 'prooflane', version: '0.2.0' },
        instructions: 'Pay for work only against proof: create_milestone → reserve_payment → (buyer approves) → confirm_authorization → submit_evidence → release_payment.',
      };
    case 'tools/list':
      return { tools: tools.map(({ call, ...t }) => t) };
    case 'tools/call': {
      const tool = tools.find((t) => t.name === msg.params?.name);
      if (!tool) throw Object.assign(new Error(`Unknown tool: ${msg.params?.name}`), { code: -32602 });
      const { ok, status, data } = await tool.call(msg.params.arguments ?? {});
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        structuredContent: Array.isArray(data) ? { milestones: data } : data,
        isError: !ok || undefined,
        _meta: { httpStatus: status },
      };
    }
    case 'ping':
      return {};
    default:
      throw Object.assign(new Error(`Method not found: ${msg.method}`), { code: -32601 });
  }
}

const write = (obj) => process.stdout.write(`${JSON.stringify(obj)}\n`);

createInterface({ input: process.stdin }).on('line', async (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
  }
  if (msg.id === undefined) return; // notifications need no answer
  try {
    write({ jsonrpc: '2.0', id: msg.id, result: await handle(msg) });
  } catch (err) {
    write({ jsonrpc: '2.0', id: msg.id, error: { code: err.code ?? -32603, message: err.message } });
  }
});
