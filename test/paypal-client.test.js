import test from 'node:test';
import assert from 'node:assert/strict';
import { PayPalClient } from '../src/paypal-client.js';

test('runs OAuth, AUTHORIZE order, order authorization, and capture against sandbox endpoints', async () => {
  const calls = [];
  const responses = [
    { access_token: 'TOKEN' },
    { id: 'ORDER-1', status: 'CREATED', links: [{ rel: 'approve', href: 'https://sandbox/approve' }] },
    { access_token: 'TOKEN' },
    { status: 'COMPLETED', purchase_units: [{ payments: { authorizations: [{ id: 'AUTH-1' }] } }] },
    { access_token: 'TOKEN' },
    { id: 'CAPTURE-1', status: 'COMPLETED' },
  ];
  const client = new PayPalClient({
    baseUrl: 'https://api-m.sandbox.paypal.com',
    clientId: 'client',
    clientSecret: 'secret',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(responses.shift()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  const order = await client.createAuthorizationOrder({
    id: 'CONTRACT-1', title: 'Verified delivery', amount: '40.00', currency: 'USD',
  });
  const authorization = await client.authorizeOrder(order.orderId);
  const capture = await client.captureAuthorization(authorization.authorizationId);

  assert.equal(order.approveUrl, 'https://sandbox/approve');
  assert.equal(authorization.authorizationId, 'AUTH-1');
  assert.equal(capture.id, 'CAPTURE-1');
  assert.equal(calls[1].url, 'https://api-m.sandbox.paypal.com/v2/checkout/orders');
  assert.equal(JSON.parse(calls[1].init.body).intent, 'AUTHORIZE');
  assert.equal(calls[3].url, 'https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER-1/authorize');
  assert.equal(calls[5].url, 'https://api-m.sandbox.paypal.com/v2/payments/authorizations/AUTH-1/capture');
});
