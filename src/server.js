import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createContract, attachAuthorization, recordAssessment, releaseDecision, demoAssess, logEvent } from './proof-engine.js';
import { PayPalClient } from './paypal-client.js';
import { AiVerifier } from './ai-verifier.js';

const contracts = new Map();
const paypal = new PayPalClient({
  baseUrl: process.env.PAYPAL_BASE_URL,
  clientId: process.env.PAYPAL_CLIENT_ID,
  clientSecret: process.env.PAYPAL_CLIENT_SECRET,
});
const threshold = Number(process.env.AUTO_RELEASE_THRESHOLD ?? 0.9);
const ai = new AiVerifier({
  baseUrl: process.env.AI_BASE_URL,
  apiKey: process.env.AI_API_KEY,
  model: process.env.AI_MODEL,
});

const staticFiles = new Map([
  ['/', { path: new URL('../public/index.html', import.meta.url), type: 'text/html; charset=utf-8' }],
  ['/app.js', { path: new URL('../public/app.js', import.meta.url), type: 'text/javascript; charset=utf-8' }],
  ['/styles.css', { path: new URL('../public/styles.css', import.meta.url), type: 'text/css; charset=utf-8' }],
]);

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

function send(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body, null, 2));
}

async function sendStatic(response, file) {
  const body = await readFile(file.path);
  response.writeHead(200, {
    'Content-Type': file.type,
    'Cache-Control': 'no-store',
  });
  response.end(body);
}

async function handler(request, response) {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (request.method === 'GET' && staticFiles.has(url.pathname)) {
      return await sendStatic(response, staticFiles.get(url.pathname));
    }
    if (request.method === 'GET' && url.pathname === '/health') {
      return send(response, 200, {
        ok: true,
        paypalConfigured: paypal.configured(),
        aiConfigured: ai.configured(),
        aiModel: ai.configured() ? ai.model : null,
        threshold,
        mode: 'sandbox',
      });
    }
    if (request.method === 'GET' && url.pathname === '/contracts') {
      return send(response, 200, [...contracts.values()].reverse());
    }
    if (request.method === 'POST' && url.pathname === '/contracts') {
      const contract = createContract(await readJson(request));
      contracts.set(contract.id, contract);
      return send(response, 201, contract);
    }

    const single = url.pathname.match(/^\/contracts\/([^/]+)$/);
    if (request.method === 'GET' && single) {
      const found = contracts.get(single[1]);
      return found ? send(response, 200, found) : send(response, 404, { error: 'contract_not_found' });
    }
    const match = url.pathname.match(/^\/contracts\/([^/]+)\/(order|authorize|evidence|release)$/);
    if (!match) return send(response, 404, { error: 'not_found' });
    const contract = contracts.get(match[1]);
    if (!contract) return send(response, 404, { error: 'contract_not_found' });

    if (request.method === 'POST' && match[2] === 'order') {
      const origin = (process.env.PUBLIC_URL ?? `http://${request.headers.host}`).replace(/\/$/, '');
      const order = await paypal.createAuthorizationOrder(contract, {
        returnUrl: `${origin}/?contract=${contract.id}`,
        cancelUrl: `${origin}/?contract=${contract.id}&cancelled=1`,
      });
      contract.pendingOrderId = order.orderId;
      logEvent(contract, 'order_created', { orderId: order.orderId });
      return send(response, 201, order);
    }
    if (request.method === 'POST' && match[2] === 'authorize') {
      const { orderId } = await readJson(request);
      attachAuthorization(contract, await paypal.authorizeOrder(orderId));
      return send(response, 200, contract);
    }
    if (request.method === 'POST' && match[2] === 'evidence') {
      const evidence = await readJson(request);
      const assessment = ai.configured() ? await ai.assess(contract, evidence) : demoAssess(contract, evidence);
      recordAssessment(contract, assessment);
      return send(response, 200, contract);
    }
    if (request.method === 'POST' && match[2] === 'release') {
      const decision = releaseDecision(contract, threshold);
      if (!decision.allowed) return send(response, 409, decision);
      const capture = await paypal.captureAuthorization(contract.payment.authorizationId);
      contract.releasedAt = new Date().toISOString();
      contract.status = 'released';
      contract.payment.captureId = capture.id;
      logEvent(contract, 'captured', { captureId: capture.id });
      return send(response, 200, contract);
    }
    return send(response, 405, { error: 'method_not_allowed' });
  } catch (error) {
    return send(response, 400, { error: error.message });
  }
}

const port = Number(process.env.PORT ?? 3210);
const host = process.env.HOST ?? '127.0.0.1';
http.createServer(handler).listen(port, host, () => {
  console.log(`Prooflane listening on http://${host}:${port}`);
});
