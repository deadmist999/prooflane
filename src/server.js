import http from 'node:http';
import { createContract, attachAuthorization, recordAssessment, releaseDecision, demoAssess } from './proof-engine.js';
import { PayPalClient } from './paypal-client.js';

const contracts = new Map();
const paypal = new PayPalClient({
  baseUrl: process.env.PAYPAL_BASE_URL,
  clientId: process.env.PAYPAL_CLIENT_ID,
  clientSecret: process.env.PAYPAL_CLIENT_SECRET,
});
const threshold = Number(process.env.AUTO_RELEASE_THRESHOLD ?? 0.9);

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

function send(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body, null, 2));
}

async function handler(request, response) {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (request.method === 'GET' && url.pathname === '/health') {
      return send(response, 200, { ok: true, paypalConfigured: paypal.configured(), mode: 'sandbox' });
    }
    if (request.method === 'POST' && url.pathname === '/contracts') {
      const contract = createContract(await readJson(request));
      contracts.set(contract.id, contract);
      return send(response, 201, contract);
    }

    const match = url.pathname.match(/^\/contracts\/([^/]+)\/(order|authorize|evidence|release)$/);
    if (!match) return send(response, 404, { error: 'not_found' });
    const contract = contracts.get(match[1]);
    if (!contract) return send(response, 404, { error: 'contract_not_found' });

    if (request.method === 'POST' && match[2] === 'order') {
      return send(response, 201, await paypal.createAuthorizationOrder(contract));
    }
    if (request.method === 'POST' && match[2] === 'authorize') {
      const { orderId } = await readJson(request);
      attachAuthorization(contract, await paypal.authorizeOrder(orderId));
      return send(response, 200, contract);
    }
    if (request.method === 'POST' && match[2] === 'evidence') {
      recordAssessment(contract, demoAssess(contract, await readJson(request)));
      return send(response, 200, contract);
    }
    if (request.method === 'POST' && match[2] === 'release') {
      const decision = releaseDecision(contract, threshold);
      if (!decision.allowed) return send(response, 409, decision);
      const capture = await paypal.captureAuthorization(contract.payment.authorizationId);
      contract.releasedAt = new Date().toISOString();
      contract.status = 'released';
      contract.payment.captureId = capture.id;
      return send(response, 200, contract);
    }
    return send(response, 405, { error: 'method_not_allowed' });
  } catch (error) {
    return send(response, 400, { error: error.message });
  }
}

const port = Number(process.env.PORT ?? 3210);
http.createServer(handler).listen(port, '127.0.0.1', () => {
  console.log(`Prooflane listening on http://127.0.0.1:${port}`);
});
